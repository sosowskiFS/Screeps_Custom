// base.builder — automatic base layout for every owned room.
//
// Each room is planned once (base.planner; terrain never changes) and the plan is kept in
// Memory.basePlan. Building is a cheap pass that places construction sites for whatever the
// room's RCL allows and the plan still lacks. CPU:
//   - at most one room is planned per tick, only when the CPU governor allows path-heavy work
//     (a plan is a few ms of breadth-first passes), so a deploy or global reset with every room
//     unplanned spreads them over ticks instead of timing out
//   - at most one room is built per tick: on RCL change, else every ~1000 ticks (staggered)
//   - existing structures are never destroyed, except (fresh layouts only) a road on a tile where
//     the plan puts a building (it would block the site)
//
// Rooms that already have a storage are "adopted": their storage and core stay, and the plan
// only fills in around existing structures (anything not yet at its RCL limit). Each of them then
// gets a migration target (planned as if empty, core around its storage, nuker kept) and
// base.migrate moves it onto that layout one structure at a time
// (Memory.settings.baseMigration = false stops it). Rooms are opted
// out with the RemoveAutobuildRoom flag (Memory.baseBuildOff[room]); InitAutoBuild/
// AddAutobuildRoom opt back in and replan.
//
// Memory.basePlan[room] = { v, t, m: mode, a: anchor, f: {flag: tile}, s: {kind: packed tiles},
//                           r: packed roads, p: packed kept-clear paths } or { v, fail: tick }
const runtimeCache = require('runtime.cache');
const governor = require('runtime.cpuGovernor');
const planner = require('base.planner');
const roomCpu = require('runtime.roomCpu');
const migrate = require('base.migrate');
const connectivity = require('base.connectivity');
const labRefit = require('base.labRefit');
const corePass = require('base.corePass');

const VERSION = 1;
const BUILD_INTERVAL = 1000;
const RETRY_FAILED = 20000;
const SITES_PER_PASS = 10;
const SITE_HEADROOM = 90;          // leave room under the 100-site cap for roads/repairs elsewhere
const RAMPART_RCL = 2;
// Below RCL8 ramparts go only over the core (spawns, towers, storage, and the Supply tile once the
// storage stands): a room in development could not keep up with building and repairing more.
// From RCL8 every planned structure gets one.
const CORE_RAMPART_RCL = 8;
// The outer rampart ring round the planned base (ringTiles), for every room with a tower: one tile
// wide from RCL6 (rooms were attacked between RCL6 and 7 with nothing in the way, terminal or not),
// and RING_DEPTH tiles further in from RCL8, so a ranged attacker (range 3) outside it reaches
// nothing uncovered. In two steps for the energy.
const RING_RCL = 6;
const RING_DEPTH_RCL = 8;
const RING_DEPTH = 2;
const RING_REFRESH = 5000;       // ticks between ring recomputations (picks up rule changes without a replan)
const CORE_RAMPART_TYPES = () => [STRUCTURE_SPAWN, STRUCTURE_TOWER, STRUCTURE_STORAGE];
const RING_RANGE = 13;           // planned tiles this far from the core (or nearer) make the base footprint
const WALL_SWAP_MIN_HITS = 100000;   // ring ramparts at least this strong before the next wall is swapped
const PATH_CHECK_EVERY = 100;      // ticks between checks for sites that seal a path
const OFFSET = 48;

const TYPES = {
    spawn: STRUCTURE_SPAWN, extension: STRUCTURE_EXTENSION, storage: STRUCTURE_STORAGE, tower: STRUCTURE_TOWER,
    link: STRUCTURE_LINK, terminal: STRUCTURE_TERMINAL, lab: STRUCTURE_LAB, factory: STRUCTURE_FACTORY,
    powerSpawn: STRUCTURE_POWER_SPAWN, nuker: STRUCTURE_NUKER, observer: STRUCTURE_OBSERVER,
};
const KIND_OF = {};
for (const kind in TYPES) KIND_OF[TYPES[kind]] = kind;
// Build priority: what grows the room fastest first. Towers always lead (defence; and the tower-first
// rule in buildRoom), then extensions (bigger creeps, cheap), the storage (energy kept), links (miners
// and upgraders without hauling), more spawns, then the terminal (100k to build) and the late kinds.
// A kind with sites still unfinished holds back every kind after it (buildRoom), so builders work on
// the most useful thing: a terminal used to go up beside half-built extensions.
const ORDER = ['tower', 'extension', 'storage', 'link', 'spawn', 'terminal', 'lab', 'factory', 'observer', 'powerSpawn', 'nuker'];
const LABS_FIRST = ['tower', 'spawn', 'lab', ...ORDER.filter(kind => !['tower', 'spawn', 'lab'].includes(kind))];
const PASSABLE = new Set([STRUCTURE_ROAD, STRUCTURE_CONTAINER, STRUCTURE_RAMPART]);
// Below RCL8 these wait: labs, the factory and the extractor would take energy the controller needs.
// Ones already built stay; sites not yet started are removed.
const LATE_RCL = 8;
const LATE_KINDS = new Set(['lab', 'factory']);
// ...except EARLY_LABS boost lab(s) once the room has a terminal: XKHO2 for its defenders
// (system.defenseBoost). Any lab of the plan serves: the first in its list.
const EARLY_LABS = 1;
const LATE_TYPES = () => [STRUCTURE_LAB, STRUCTURE_FACTORY, STRUCTURE_EXTRACTOR];

function pack(tiles) {
    let out = '';
    for (const tile of tiles) out += String.fromCharCode(tile + OFFSET);
    return out;
}

function unpack(text) {
    const out = [];
    for (let i = 0; i < (text || '').length; i++) out.push(text.charCodeAt(i) - OFFSET);
    return out;
}

const tileOf = pos => pos.x * 50 + pos.y;
const stage = require('room.stage');

// Parked work tiles and the kinds their creep serves (the supplier fills towers and spawns; the
// miners feed their link and the storage). Anything else next to them needs other access.
const SERVED_BY = {
    Supply: [STRUCTURE_TOWER, STRUCTURE_SPAWN],
    storageMiner: [STRUCTURE_LINK, STRUCTURE_STORAGE],
    upgradeMiner: [STRUCTURE_LINK],
};

// Structures a hauler has to reach (filled or emptied by creeps).
const SERVICED = new Set([STRUCTURE_EXTENSION, STRUCTURE_SPAWN, STRUCTURE_TOWER, STRUCTURE_LAB, STRUCTURE_LINK, STRUCTURE_TERMINAL,
    STRUCTURE_FACTORY, STRUCTURE_POWER_SPAWN, STRUCTURE_NUKER]);

// ---------------------------------------------------------------- planning

// Kinds base.migrate can move; a migration target ignores them (they will be moved).
const MOVABLE_TYPES = new Set([STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_LINK, STRUCTURE_TERMINAL,
    STRUCTURE_LAB, STRUCTURE_FACTORY, STRUCTURE_POWER_SPAWN, STRUCTURE_OBSERVER]);

function contextFor(room, forMigration) {
    const terrain = Game.map.getRoomTerrain(room.name);
    const walls = new Uint8Array(2500);
    for (let x = 0; x < 50; x++) {
        for (let y = 0; y < 50; y++) walls[x * 50 + y] = terrain.get(x, y) & TERRAIN_MASK_WALL ? 1 : 0;
    }
    const typeAt = {};
    let storageTile;
    for (const structure of runtimeCache.find(room, FIND_STRUCTURES)) {
        if (PASSABLE.has(structure.structureType)) continue;
        if (forMigration && structure.my && MOVABLE_TYPES.has(structure.structureType)) continue;
        if (leftover(room, structure)) continue;   // another player's, being removed (clearLeftovers)
        if (structure.structureType === STRUCTURE_STORAGE) storageTile = tileOf(structure.pos);
        typeAt[tileOf(structure.pos)] = KIND_OF[structure.structureType] || structure.structureType;
    }
    for (const site of runtimeCache.find(room, FIND_MY_CONSTRUCTION_SITES)) {
        if (PASSABLE.has(site.structureType)) continue;
        if (forMigration && MOVABLE_TYPES.has(site.structureType)) continue;
        typeAt[tileOf(site.pos)] = KIND_OF[site.structureType] || site.structureType;
    }
    const sources = runtimeCache.find(room, FIND_SOURCES).map(s => tileOf(s.pos));
    const mineral = runtimeCache.find(room, FIND_MINERALS)[0];
    for (const tile of sources) typeAt[tile] = 'source';
    if (mineral) typeAt[tileOf(mineral.pos)] = 'mineral';
    if (room.controller && room.controller.pos) typeAt[tileOf(room.controller.pos)] = 'controller';
    const supplyFlag = Game.flags[room.name + 'Supply'];
    return {
        walls, typeAt, sources,
        requireStorage: forMigration ? storageTile : undefined,
        controller: room.controller && room.controller.pos ? tileOf(room.controller.pos) : undefined,
        mineral: mineral ? tileOf(mineral.pos) : undefined,
        // A migration target places the core freshly (the Supply flag moves to it).
        supply: !forMigration && supplyFlag && supplyFlag.pos.roomName === room.name ? tileOf(supplyFlag.pos) : undefined,
    };
}

function encode(result, migration) {
    const s = {};
    for (const kind in result.structures) s[kind] = pack(result.structures[kind]);
    const out = { v: VERSION, t: Game.time, m: result.mode, a: result.anchor, f: result.flags, s, r: pack(result.roads), p: pack(result.paths) };
    if ((result.structures.lab || []).length === 10) out.lf = 1;   // all 10 in reaction range
    out.cf = 1;                                                    // towers and first spawn on the core
    if (migration) out.mg = 1;
    return out;
}

const decoded = Object.create(null);   // heap: room -> { t, plan }
function planOf(roomName) {
    const stored = Memory.basePlan && Memory.basePlan[roomName];
    if (!stored || stored.fail || stored.v !== VERSION) return null;
    const cached = decoded[roomName];
    if (cached && cached.t === stored.t) return cached.plan;
    const structures = {};
    for (const kind in stored.s) structures[kind] = unpack(stored.s[kind]);
    const plan = { mode: stored.m, anchor: stored.a, flags: stored.f || {}, structures, roads: unpack(stored.r), paths: unpack(stored.p), migration: !!stored.mg,
        lane: unpack(stored.ln) };
    decoded[roomName] = { t: stored.t, plan };
    return plan;
}

function planRoom(room) {
    if (!Memory.basePlan) Memory.basePlan = {};
    const result = planner.plan(contextFor(room));
    if (!result) {
        Memory.basePlan[room.name] = { v: VERSION, fail: Game.time };
        console.log(`[base] ${room.name}: no free 3x3 next to a source with a miner tile; retrying in ${RETRY_FAILED} ticks`);
        return null;
    }
    Memory.basePlan[room.name] = encode(result);
    // Fresh layouts use the supply-spawn handling of auto-built rooms (spawn.BuildCreeps*).
    if (result.mode === 'fresh') {
        if (!Memory.autoBuildRooms) Memory.autoBuildRooms = [];
        if (Memory.autoBuildRooms.indexOf(room.name) === -1) Memory.autoBuildRooms.push(room.name);
    }
    if (!Memory.baseBuild) Memory.baseBuild = {};
    delete Memory.baseBuild[room.name];   // build on the next pass
    return planOf(room.name);
}

// Migration target for an established room: the full layout as if the room were empty except
// for its storage (the core forms around it), nuker and other immovables. Kept as the room's plan;
// base.migrate moves the room onto it. Null when no core fits around the storage (the room keeps
// its adopted plan; retried later).
function planMigration(room) {
    const ctx = contextFor(room, true);
    if (ctx.requireStorage === undefined) return null;
    const result = planner.plan(ctx);
    const stored = Memory.basePlan[room.name];
    if (!result || result.mode !== 'fresh') {
        stored.mgFail = Game.time;
        console.log('[base] ' + room.name + ': no layout fits around the existing storage; staying as is');
        return null;
    }
    // The nuker stays where it is (its energy and ghodium cannot be taken out).
    const nuker = runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_NUKER } })[0];
    if (nuker) result.structures.nuker = [tileOf(nuker.pos)];
    Memory.basePlan[room.name] = encode(result, true);
    if (!Memory.baseBuild) Memory.baseBuild = {};
    delete Memory.baseBuild[room.name];
    console.log('[base] ' + room.name + ': migration target planned');
    return planOf(room.name);
}

// Plans from before all 10 labs stood in reaction range (lf): new lab tiles (base.labRefit), keeping
// the plan otherwise. The room's migration then moves the labs: first of everything outside shardX.
const REFIT_MIN_BUCKET = 500;
function refitDue(stored) {
    if (stored.lf || stored.fail || stored.m !== 'fresh' || (stored.lfFail && Game.time - stored.lfFail < RETRY_FAILED)) return false;
    return Game.cpu.bucket >= REFIT_MIN_BUCKET;
}

// Plans made before behindWall (shard2 E13N22's factory, power spawn and extensions stand across a
// terrain wall from its core, the attackers' side, with its ring drawn round them): the tiles move once
// (mark bw), and base.migrate moves what stands there before anything else. Nukers stay (they cannot be
// emptied), links work where they are, and the storage is what the distance is measured from.
const BEHIND_ORDER = ['tower', 'spawn', 'terminal', 'factory', 'powerSpawn', 'observer', 'extension'];
const BEHIND_RANGE = { extension: 25 };
const BEHIND_RANGE_OTHER = 15;
// Plans whose towers or first spawn were moved off the 8 tiles round the Supply tile (the old relocation:
// shard2 E26N32's tower went to 14,35, E22N19's to 43,15), where the supplier cannot reach them. Each goes
// back onto a core tile, and whatever else was planned there takes the tile it leaves. Once (mark cf).
function coreDue(stored) {
    return !stored.cf && !stored.fail && stored.m === 'fresh' && Game.cpu.bucket >= REFIT_MIN_BUCKET;
}

// Pure: the changed lists, or null. plan: { structures, flags, roads, paths }; wall: tile -> bool.
function coreRepair(plan, wall) {
    const supply = plan.flags && plan.flags.Supply;
    if (supply === undefined) return null;
    const x = (supply / 50) | 0, y = supply % 50;
    const beside = t => Math.max(Math.abs(((t / 50) | 0) - x), Math.abs(t % 50 - y)) === 1;
    const lists = {};
    for (const kind in plan.structures) lists[kind] = plan.structures[kind].slice();
    const reserved = new Set(Object.keys(plan.flags).filter(n => n !== 'Supply').map(n => plan.flags[n]));
    const ring = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const t = (x + dx) * 50 + y + dy;
        if ((dx || dy) && !wall(t) && !reserved.has(t) && !(lists.storage || []).includes(t)) ring.push(t);
    }
    const kindAt = t => Object.keys(lists).find(k => lists[k].includes(t));
    const coreTile = t => (lists.tower || []).includes(t) || (lists.spawn || [])[0] === t;
    const spare = () => ring.filter(t => !coreTile(t)).sort((a, b) => (kindAt(a) ? 1 : 0) - (kindAt(b) ? 1 : 0) || a - b)[0];
    let changed = false;
    const bring = (kind, index) => {
        const from = lists[kind][index], to = spare();
        if (to === undefined) return;
        const other = kindAt(to);
        if (other) lists[other][lists[other].indexOf(to)] = from;
        lists[kind][index] = to;
        changed = true;
    };
    if (lists.spawn && lists.spawn.length && !beside(lists.spawn[0])) {
        const near = lists.spawn.findIndex(beside);
        if (near > 0) {
            [lists.spawn[0], lists.spawn[near]] = [lists.spawn[near], lists.spawn[0]];
            changed = true;
        } else bring('spawn', 0);
    }
    (lists.tower || []).forEach((t, i) => { if (!beside(t)) bring('tower', i); });
    if (!changed) return null;
    const onCore = new Set([...(lists.tower || []), (lists.spawn || [])[0]]);
    return { structures: lists, roads: plan.roads.filter(t => !onCore.has(t)), paths: plan.paths.filter(t => !onCore.has(t)) };
}

function repairCore(room) {
    const stored = Memory.basePlan[room.name];
    stored.cf = 1;
    const terrain = Game.map.getRoomTerrain(room.name);
    const result = coreRepair(planOf(room.name), t => (terrain.get((t / 50) | 0, t % 50) & TERRAIN_MASK_WALL) !== 0);
    if (!result) return false;
    for (const kind in result.structures) stored.s[kind] = pack(result.structures[kind]);
    stored.r = pack(result.roads);
    stored.p = pack(result.paths);
    stored.t = Game.time;
    if (Memory.baseMigrate && Memory.baseMigrate[room.name]) delete Memory.baseMigrate[room.name].done;
    if (Memory.baseBuild) delete Memory.baseBuild[room.name];
    console.log('[base] ' + room.name + ': towers and first spawn planned back round the Supply tile');
    return true;
}

// A core filling a narrow passage: a lane past it (base.corePass). Checked once per plan (mark lp), new ones too.
const PASS_MIN_BUCKET = 1000;
function passDue(stored) {
    return !stored.lp && !stored.fail && stored.m === 'fresh' && Game.cpu.bucket >= PASS_MIN_BUCKET;
}

function layLane(room) {
    const stored = Memory.basePlan[room.name];
    stored.lp = 1;
    const plan = planOf(room.name);
    const terrain = Game.map.getRoomTerrain(room.name);
    const walls = new Uint8Array(2500);
    for (let x = 0; x < 50; x++) for (let y = 0; y < 50; y++) walls[x * 50 + y] = terrain.get(x, y) & TERRAIN_MASK_WALL ? 1 : 0;
    const mineral = runtimeCache.find(room, FIND_MINERALS)[0];
    const result = corePass.corePass({
        walls, structures: plan.structures, roads: plan.roads, paths: plan.paths, flags: plan.flags,
        sources: runtimeCache.find(room, FIND_SOURCES).map(s => tileOf(s.pos)),
        mineral: mineral ? tileOf(mineral.pos) : undefined,
        controller: room.controller && room.controller.pos ? tileOf(room.controller.pos) : undefined,
    });
    if (!result) return false;
    for (const kind in result.structures) stored.s[kind] = pack(result.structures[kind]);
    stored.r = pack(result.roads);
    stored.p = pack(result.paths);
    stored.ln = pack(result.lane);
    stored.t = Game.time;
    if (Memory.baseMigrate && Memory.baseMigrate[room.name]) delete Memory.baseMigrate[room.name].done;
    if (Memory.baseBuild) delete Memory.baseBuild[room.name];
    console.log('[base] ' + room.name + ': lane past the core, mean detour ' + result.before.mean.toFixed(1) + ' -> ' + result.after.mean.toFixed(1) +
        ', ' + result.moved.length + ' planned tiles moved');
    return true;
}

function behindDue(stored) {
    return !stored.bw && !stored.fail && stored.m === 'fresh' && Game.cpu.bucket >= REFIT_MIN_BUCKET;
}

function fixBehind(room) {
    const stored = Memory.basePlan[room.name];
    let plan = planOf(room.name);
    let moved = 0;
    if ((plan.structures.lab || []).some(t => behindWall(room, plan, t))) {
        refitLabs(room);
        plan = planOf(room.name);
    }
    const live = liveState(room);
    const before = connectivity.status(live.walkable, live.req);
    const occupied = new Set();
    for (const s of runtimeCache.find(room, FIND_STRUCTURES)) {
        if (!PASSABLE.has(s.structureType) || s.structureType === STRUCTURE_CONTAINER) occupied.add(tileOf(s.pos));
    }
    for (const s of runtimeCache.find(room, FIND_MY_CONSTRUCTION_SITES)) occupied.add(tileOf(s.pos));
    for (const kind of BEHIND_ORDER) {
        for (const from of (plan.structures[kind] || []).slice()) {
            if (!behindWall(room, plan, from)) continue;
            if (relocate(room, plan, kind, from, live, before, occupied, BEHIND_RANGE[kind] || BEHIND_RANGE_OTHER) !== undefined) { moved++; continue; }
            if (kind === 'extension') {
                console.log('[base] ' + room.name + ': no place for the extension at ' + ((from / 50) | 0) + ',' + (from % 50) + ' behind terrain');
                continue;
            }
            if (kind === 'tower') continue;      // on the core: repairCore
            // No free tile: the nearest extension's tile, and the extension moves on later in this pass.
            const walk = terrainWalk(room, room.storage ? tileOf(room.storage.pos) : plan.anchor);
            const swap = (plan.structures.extension || []).filter(t => !behindWall(room, plan, t) && walk[t] >= 0).sort((a, b) => walk[a] - walk[b])[0];
            if (swap === undefined) continue;
            plan.structures[kind] = plan.structures[kind].map(t => (t === from ? swap : t));
            plan.structures.extension = plan.structures.extension.map(t => (t === swap ? from : t));
            stored.s[kind] = pack(plan.structures[kind]);
            stored.s.extension = pack(plan.structures.extension);
            moved++;
        }
    }
    stored.bw = 1;
    if (!moved) return 0;
    stored.t = Game.time;
    if (Memory.baseMigrate && Memory.baseMigrate[room.name]) delete Memory.baseMigrate[room.name].done;
    if (Memory.baseBuild) delete Memory.baseBuild[room.name];
    console.log('[base] ' + room.name + ': ' + moved + ' planned tiles moved out from behind terrain');
    return moved;
}

function refitLabs(room) {
    const stored = Memory.basePlan[room.name];
    const plan = planOf(room.name);
    const walls = new Uint8Array(2500);
    const terrain = Game.map.getRoomTerrain(room.name);
    for (let x = 0; x < 50; x++) for (let y = 0; y < 50; y++) walls[x * 50 + y] = terrain.get(x, y) & TERRAIN_MASK_WALL ? 1 : 0;
    const mineral = runtimeCache.find(room, FIND_MINERALS)[0];
    const result = labRefit.refit({
        behind: t => behindWall(room, plan, t),
        walls, structures: plan.structures, roads: plan.roads, paths: plan.paths, flags: plan.flags, anchor: plan.anchor,
        live: runtimeCache.find(room, FIND_STRUCTURES).filter(s => s.structureType !== STRUCTURE_ROAD && s.structureType !== STRUCTURE_RAMPART)
            .map(s => ({ tile: tileOf(s.pos), type: KIND_OF[s.structureType] || s.structureType })),
        sources: runtimeCache.find(room, FIND_SOURCES).map(s => tileOf(s.pos)),
        mineral: mineral ? tileOf(mineral.pos) : undefined,
        controller: room.controller && room.controller.pos ? tileOf(room.controller.pos) : undefined,
    });
    if (!result) {
        stored.lfFail = Game.time;
        console.log('[base] ' + room.name + ': no place for 10 labs in reaction range');
        return false;
    }
    stored.s.lab = pack(result.lab);
    stored.s.extension = pack(result.extension);
    stored.r = pack(result.roads);
    stored.lf = 1;
    stored.t = Game.time;      // planOf decodes the changed plan again
    delete stored.lfFail;
    if (Memory.baseMigrate && Memory.baseMigrate[room.name]) delete Memory.baseMigrate[room.name].done;
    if (!Memory.baseBuild) Memory.baseBuild = {};
    delete Memory.baseBuild[room.name];
    console.log('[base] ' + room.name + ': labs replanned in reaction range, ' + result.kept + ' stay, ' + (10 - result.kept) + ' to build');
    return true;
}

// Moving the labs comes before the rest of this room's migration and building: a full room, outside
// shardX (under attack there; its rooms catch up in the ordinary order at RCL8). Below RCL8 a room has
// at most its one defenders' boost lab, and it stays until the full set is due.
function labsUrgent(room) {
    return room.controller.level >= LATE_RCL && Game.shard.name !== 'shardX';
}

// Whose turn in base.migrate this tick: a step in progress always advances, and one due room looks for a
// new step. A room with nothing due must not take the turn: the first such room used to hold it, and most
// of shard2 went unvisited for 260,000+ ticks with up to 70 structures out of place.
function migrationTurn(active, due, migrating) {
    return active ? 'step' : due && !migrating ? 'look' : null;
}

// Layout flags follow the plan whatever the room's migration is doing: base.migrate moved them only
// between steps, and never once a room was done. shard2 E26N32's Supply flag stayed on 14,38 under a
// planned tower, its plan's tile being 15,38, and its spawn could only make a supplier onto that tower.
const FLAG_CHECK_EVERY = 20;
const STUCK_CHECK_EVERY = 10;
function syncFlags(room, plan) {
    for (const name in plan.flags || {}) {
        const flag = Game.flags[room.name + name];
        if (flag && tileOf(flag.pos) !== plan.flags[name]) return migrate.moveFlags(room, plan);
    }
    return undefined;
}

// A finished creep a spawn cannot let out (every direction it was given is blocked) waits for ever, and
// holds the spawn: it may leave any way. Directions are fixed when the creep is ordered, so the move of a
// flag or a new structure beside the spawn does not reach it.
function unstickSpawns(room) {
    let freed = 0;
    for (const spawn of runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_SPAWN } })) {
        const job = spawn.spawning;
        if (!job || job.remainingTime > 0 || typeof job.setDirections !== 'function') continue;
        if (job.setDirections([TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT]) === OK) freed++;
    }
    return freed;
}

function migrationOn() {
    return !(Memory.settings && Memory.settings.baseMigration === false);
}

function migrationWanted(room, stored) {
    if (!migrationOn() || !room.storage || stored.mg || stored.fail) return false;
    return !stored.mgFail || Game.time - stored.mgFail >= RETRY_FAILED;
}

function rebuildNow(roomName) {
    if (!Memory.baseBuild) Memory.baseBuild = {};
    const state = Memory.baseBuild[roomName] || (Memory.baseBuild[roomName] = {});
    state.next = Game.time + 1;
}

// ---------------------------------------------------------------- live connectivity

// The room as it stands now: where creeps can walk (terrain, built structures, our sites), the
// places that must stay reachable (base.connectivity), and our sites that block movement.
function liveState(room) {
    const terrain = Game.map.getRoomTerrain(room.name);
    const walkable = new Uint8Array(2500);
    for (let x = 0; x < 50; x++) {
        for (let y = 0; y < 50; y++) walkable[x * 50 + y] = terrain.get(x, y) & TERRAIN_MASK_WALL ? 0 : 1;
    }
    const spawns = [];
    const serviced = [];
    let storage;
    for (const structure of runtimeCache.find(room, FIND_STRUCTURES)) {
        const tile = tileOf(structure.pos);
        const type = structure.structureType;
        if (type === STRUCTURE_SPAWN && structure.my) spawns.push(tile);
        if (structure.my && SERVICED.has(type)) serviced.push({ t: tile, type });
        if (type === STRUCTURE_STORAGE) storage = tile;
        if (type === STRUCTURE_ROAD || type === STRUCTURE_CONTAINER || (type === STRUCTURE_RAMPART && (structure.my || structure.isPublic))) continue;
        walkable[tile] = 0;
    }
    const blockingSites = [];
    for (const site of runtimeCache.find(room, FIND_MY_CONSTRUCTION_SITES)) {
        if (PASSABLE.has(site.structureType)) continue;
        const tile = tileOf(site.pos);
        if (walkable[tile]) blockingSites.push({ tile, site });
        walkable[tile] = 0;
    }
    // Work tiles of parked creeps (tower supplier, storage and upgrade miners) are occupied for
    // good: never count them as a way through.
    const service = {};
    for (const kind in SERVED_BY) {
        const flag = Game.flags[room.name + kind];
        if (flag && flag.pos.roomName === room.name) {
            walkable[tileOf(flag.pos)] = 0;
            service[tileOf(flag.pos)] = SERVED_BY[kind];
        }
    }
    const mineral = runtimeCache.find(room, FIND_MINERALS)[0];
    const req = connectivity.requirements(walkable, {
        spawns, storage,
        sources: runtimeCache.find(room, FIND_SOURCES).map(s => tileOf(s.pos)),
        mineral: mineral ? tileOf(mineral.pos) : undefined,
        controller: room.controller && room.controller.pos ? tileOf(room.controller.pos) : undefined,
        serviced, service,
    });
    return { walkable, req, blockingSites, spawns };
}

// Remove our construction sites that cut a spawn off from the room exits, or the exits off from
// the storage, sources, mineral or controller (checked against the room without those sites).
function removeBlockingSites(room, live) {
    if (!live.spawns.length || !live.blockingSites.length) return 0;
    const open = live.walkable.slice();
    for (const { tile } of live.blockingSites) open[tile] = 1;
    const ideal = connectivity.status(open, live.req);
    let now = connectivity.status(live.walkable, live.req);
    if (connectivity.keeps(ideal, now)) return 0;
    let removed = 0;
    // First the sites that fix something on their own; then, if a cut is made of several,
    // reopen more until it is fixed.
    for (const pass of [true, false]) {
        for (const entry of live.blockingSites) {
            if (connectivity.keeps(ideal, now) || entry.removed) continue;
            live.walkable[entry.tile] = 1;
            const fixed = connectivity.status(live.walkable, live.req);
            const helps = fixed.some((ok, i) => ok && !now[i]);
            if (helps || !pass) {
                entry.removed = true;
                entry.site.remove();
                removed++;
                now = fixed;
                console.log('[base] ' + room.name + ': removed ' + entry.site.structureType + ' site at ' +
                    ((entry.tile / 50) | 0) + ',' + (entry.tile % 50) + ' (it blocked the only path)');
            } else {
                live.walkable[entry.tile] = 0;
            }
        }
    }
    return removed;
}

// A structure owned by another player in a room we own: the previous owner's (E25N43 on shard3
// came with someone's storage, terminal, labs and link). The planner adopted their storage as
// ours, so our own core was never built.
function leftover(room, structure) {
    return !!(room.controller && room.controller.my && structure.owner && !structure.my &&
        structure.structureType !== STRUCTURE_CONTROLLER);
}

// Destroy the previous owner's structures (allowed in our own room) and replan the room fresh.
function clearLeftovers(room) {
    let removed = 0;
    for (const structure of runtimeCache.find(room, FIND_STRUCTURES)) {
        if (leftover(room, structure) && structure.destroy() === OK) removed++;
    }
    if (!removed) return false;
    // Our sites followed the plan drawn around their structures: start clean.
    for (const site of runtimeCache.find(room, FIND_MY_CONSTRUCTION_SITES)) site.remove();
    if (Memory.basePlan) delete Memory.basePlan[room.name];
    if (Memory.baseBuild) delete Memory.baseBuild[room.name];
    console.log('[base] ' + room.name + ': removed ' + removed + ' structures left by a previous owner; replanning');
    return true;
}

// Where a rampart of ours may stand (anything else is removed, clearStrays): over a structure of ours
// (built, or a site for one), the Supply tile (the tower supplier's spot), and the ring with its
// depth (ringTiles: outer tiles and the 2 tiles in) in a ring room from RCL7.
const NOT_COVERED = () => new Set([STRUCTURE_ROAD, STRUCTURE_CONTAINER, STRUCTURE_RAMPART, STRUCTURE_WALL, STRUCTURE_CONTROLLER]);
function rampartTiles(room, plan) {
    const allowed = new Set();
    const skip = NOT_COVERED();
    for (const s of runtimeCache.find(room, FIND_MY_STRUCTURES)) if (!skip.has(s.structureType)) allowed.add(tileOf(s.pos));
    for (const s of runtimeCache.find(room, FIND_MY_CONSTRUCTION_SITES)) if (!skip.has(s.structureType)) allowed.add(tileOf(s.pos));
    const flag = Game.flags[room.name + 'Supply'];
    if (flag && flag.pos.roomName === room.name) allowed.add(tileOf(flag.pos));
    if (plan.flags && plan.flags.Supply !== undefined) allowed.add(plan.flags.Supply);
    if (room.controller.level >= RING_RCL) {
        const ring = ringTiles(room, plan);
        for (const t of ring.r.concat(ring.d || [])) allowed.add(t);
    }
    return allowed;
}

// Our structures off the plan, removed on each build pass while no hostile is in the room:
//   - ramparts (and rampart sites) where rampartTiles allows none; in every room, migrating too.
//     Ramparts kept going up over everything (the old generator, a ring at RCL5, the controller's
//     tiles): an enemy does not come from those sides, each one costs repairs for ever, and finding
//     repair targets among them costs CPU (about 2,240 stray ramparts with 232 billion hits). From
//     STRAY_KEEP_HITS up, and constructed walls (off the ring, where they get swapped), only once
//     the ring stands (ringHolds): till then they may be all that covers a gap.
//   - walls beside the controller stay in young rooms and on shardX (claimers came for controllers).
//   - fresh-layout rooms not migrating (base.migrate moves those): a structure of a planned kind
//     on a tile not planned for that kind, one per pass. Never the last spawn, a spawning one, or
//     a store holding anything but a little energy (storage, terminal: never while not empty).
// Other players' structures go by clearLeftovers.
const STRAY_RAMPARTS_PER_PASS = 20;
// shardX E32N45: 27 of 36 ring tiles ramparted at 1M+, 9 left open for good because its storage stayed
// under the 50,000 reserve (ringAffordable).
const RING_FINISH = 0.75;
function ringNearlyDone(room, plan) {
    const ring = ringTiles(room, plan).r;
    if (!ring.length) return false;
    const onRing = new Set(ring);
    const built = runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_RAMPART } })
        .filter(s => onRing.has(tileOf(s.pos))).length;
    return built >= ring.length * RING_FINISH && built < ring.length;
}

const STRAY_KEEP_HITS = 1000000;
const RING_HOLDS = 0.8;          // of the ring's tiles ramparted to WALL_SWAP_MIN_HITS
function ringHolds(room, plan) {
    if (room.controller.level < RING_RCL) return false;
    const ring = ringTiles(room, plan).r;
    if (!ring.length) return false;
    const onRing = new Set(ring);
    const strong = runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_RAMPART } })
        .filter(s => onRing.has(tileOf(s.pos)) && s.hits >= WALL_SWAP_MIN_HITS).length;
    return strong >= ring.length * RING_HOLDS;
}

function clearStrays(room, plan) {
    if (runtimeCache.find(room, FIND_HOSTILE_CREEPS).length) return 0;
    if ((Memory.roomsUnderAttack || []).includes(room.name)) return 0;
    const allowed = rampartTiles(room, plan);
    let removed = 0;
    for (const site of runtimeCache.find(room, FIND_MY_CONSTRUCTION_SITES)) {
        if (site.structureType === STRUCTURE_RAMPART && !allowed.has(tileOf(site.pos)) && typeof site.remove === 'function') site.remove();
    }
    const holds = ringHolds(room, plan);
    for (const s of runtimeCache.find(room, FIND_MY_STRUCTURES)) {
        if (removed >= STRAY_RAMPARTS_PER_PASS) break;
        if (s.structureType !== STRUCTURE_RAMPART || allowed.has(tileOf(s.pos)) || (s.hits >= STRAY_KEEP_HITS && !holds)) continue;
        if (typeof s.destroy === 'function' && s.destroy() === OK) removed++;
    }
    if (holds) {
        const onRing = new Set(ringTiles(room, plan).r);
        const c = room.controller.pos;
        const keepByController = Game.shard.name === 'shardX' || !stage.established(room);
        for (const s of runtimeCache.find(room, FIND_STRUCTURES, { filter: { structureType: STRUCTURE_WALL } })) {
            if (removed >= STRAY_RAMPARTS_PER_PASS) break;
            if (onRing.has(tileOf(s.pos))) continue;
            if (keepByController && c && Math.max(Math.abs(s.pos.x - c.x), Math.abs(s.pos.y - c.y)) <= 1) continue;
            if (typeof s.destroy === 'function' && s.destroy() === OK) removed++;
        }
    }
    if (removed) console.log('[base] ' + room.name + ': removed ' + removed + ' stray barrier' + (removed > 1 ? 's' : '') + ' (off the structures and the ring)');
    if (plan.mode === 'fresh' && !plan.migration) {
        const misplaced = misplacedStructure(room, plan);
        if (misplaced && typeof misplaced.destroy === 'function' && misplaced.destroy() === OK) {
            removed++;
            console.log('[base] ' + room.name + ': removed a ' + misplaced.structureType + ' at ' + misplaced.pos.x + ',' + misplaced.pos.y + ' (not a planned tile for it)');
        }
    }
    return removed;
}

function misplacedStructure(room, plan) {
    const mine = runtimeCache.find(room, FIND_MY_STRUCTURES);
    const spawns = mine.filter(s => s.structureType === STRUCTURE_SPAWN);
    for (const s of mine) {
        const kind = KIND_OF[s.structureType];
        if (!kind || (plan.structures[kind] || []).includes(tileOf(s.pos))) continue;
        if (s.structureType === STRUCTURE_SPAWN && (spawns.length <= 1 || s.spawning)) continue;
        if (s.store) {
            const used = s.store.getUsedCapacity ? s.store.getUsedCapacity() : Object.values(s.store).reduce((n, v) => n + (v || 0), 0);
            const energyOnly = !s.store.getUsedCapacity || used === (s.store.getUsedCapacity(RESOURCE_ENERGY) || 0);
            const big = s.structureType === STRUCTURE_STORAGE || s.structureType === STRUCTURE_TERMINAL || s.structureType === STRUCTURE_FACTORY;
            if ((big && used > 0) || !energyOnly || used > 2000) continue;
        }
        return s;
    }
    return undefined;
}

// Extensions no hauler can reach any more (walled in by structures of two layouts during a
// migration: E19N59 37,47). One per pass is destroyed; the builder only puts it back once its
// tile is reachable again. Other kinds are only reported.
function releaseSealed(room, live) {
    if (!live.spawns.length) return 0;
    if (Memory.roomsUnderAttack && Memory.roomsUnderAttack.indexOf(room.name) !== -1) return 0;
    const label = connectivity.components(live.walkable);
    // Our sites for such structures that nothing could reach once built (placed by an older plan):
    // removed; the builder places the kind again where it can be reached (replacementTile).
    for (const site of runtimeCache.find(room, FIND_MY_CONSTRUCTION_SITES)) {
        if (!SERVICED.has(site.structureType)) continue;
        if (connectivity.accessible(live.walkable, live.req, tileOf(site.pos), label, site.structureType)) continue;
        console.log('[base] ' + room.name + ': removed ' + site.structureType + ' site at ' + site.pos.x + ',' + site.pos.y + ' (nothing could reach it)');
        site.remove();
        return 1;
    }
    for (const structure of runtimeCache.find(room, FIND_MY_STRUCTURES)) {
        if (!SERVICED.has(structure.structureType)) continue;
        const tile = tileOf(structure.pos);
        if (connectivity.accessible(live.walkable, live.req, tile, label, structure.structureType)) continue;
        const where = structure.structureType + ' at ' + structure.pos.x + ',' + structure.pos.y;
        if (structure.structureType === STRUCTURE_EXTENSION && structure.destroy() === OK) {
            console.log('[base] ' + room.name + ': removed ' + where + ' (walled in: no hauler can reach it); rebuilt once reachable');
            return 1;
        }
        if (Game.time % 1000 < PATH_CHECK_EVERY) console.log('[base] ' + room.name + ': ' + where + ' is walled in');
    }
    return 0;
}

// Behind a terrain wall: a base structure's tile whose walk from the base (storage, else the plan's
// anchor; terrain only) is longer than DETOUR_FACTOR x its range plus DETOUR_SLACK. Close as the crow
// flies, but the long way round, outside the base and its defences: shardX E19N44's second spawn was
// relocated to 36,30, in a pocket north of a wall band with the base south of it, reachable only
// round the west side. Links (at sources and the controller), containers, roads and barriers are
// not checked: they go where their job is.
const DETOUR_FACTOR = 1.5;
const DETOUR_SLACK = 4;
const BASE_KINDS = () => new Set([STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_STORAGE, STRUCTURE_TERMINAL,
    STRUCTURE_FACTORY, STRUCTURE_POWER_SPAWN, STRUCTURE_NUKER, STRUCTURE_OBSERVER, STRUCTURE_LAB]);
const walkCache = Object.create(null);
function terrainWalk(room, from) {
    const key = room.name + ':' + from;
    const c = walkCache[key];
    if (c && c.t === Game.time) return c.dist;
    const terrain = Game.map.getRoomTerrain(room.name);
    const dist = new Int16Array(2500).fill(-1);
    const queue = [from];
    dist[from] = 0;
    for (let head = 0; head < queue.length; head++) {
        const t = queue[head], x = (t / 50) | 0, y = t % 50;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx > 49 || ny > 49) continue;
            const n = nx * 50 + ny;
            if (dist[n] !== -1 || terrain.get(nx, ny) & TERRAIN_MASK_WALL) continue;
            dist[n] = dist[t] + 1;
            queue.push(n);
        }
    }
    walkCache[key] = { t: Game.time, dist };
    return dist;
}
function behindWall(room, plan, tile, type) {
    if (type && !BASE_KINDS().has(type)) return false;
    const anchor = room.storage ? tileOf(room.storage.pos) : plan.anchor;
    if (anchor === undefined || tile === anchor) return false;
    const walk = terrainWalk(room, anchor)[tile];
    const range = Math.max(Math.abs(((tile / 50) | 0) - ((anchor / 50) | 0)), Math.abs(tile % 50 - anchor % 50));
    return walk < 0 || walk > range * DETOUR_FACTOR + DETOUR_SLACK;
}

// A planned tile of this kind a site could go on right now without cutting a path (base.migrate
// only moves a structure when its replacement can be placed). Never one behind a terrain wall.
function replacementTile(room, plan, kind) {
    const live = liveState(room);
    const before = connectivity.status(live.walkable, live.req);
    const occupied = new Set();
    for (const structure of runtimeCache.find(room, FIND_STRUCTURES)) {
        if (!PASSABLE.has(structure.structureType) || structure.structureType === STRUCTURE_CONTAINER) occupied.add(tileOf(structure.pos));
    }
    for (const site of runtimeCache.find(room, FIND_MY_CONSTRUCTION_SITES)) occupied.add(tileOf(site.pos));
    const type = TYPES[kind];
    const access = SERVICED.has(type) && type;
    let unusable;
    for (const tile of (plan.structures[kind] || [])) {
        if (occupied.has(tile)) continue;
        if (!behindWall(room, plan, tile, type) && !connectivity.blocks(live.walkable, live.req, before, tile, access)) return tile;
        if (unusable === undefined) unusable = tile;
    }
    // Every free planned tile is unusable (shard3 E29N43: the power spawn's only free neighbour
    // would have been the storage miner's tile). Move that planned tile to the nearest free tile
    // around the storage that works, so the structure still gets rebuilt.
    if (unusable !== undefined && RELOCATABLE.has(kind)) return relocate(room, plan, kind, unusable, live, before, occupied);
    return undefined;
}

const RELOCATABLE = new Set(['powerSpawn', 'factory', 'terminal', 'nuker', 'observer', 'extension', 'spawn']);
const RELOCATE_RANGE = 8;

function relocate(room, plan, kind, from, live, before, occupied, range = RELOCATE_RANGE) {
    // The core's tiles are its point: a tower or the first spawn elsewhere is out of the supplier's reach.
    // A tile refused for now (a stray terminal still needs it for access) waits for that to move.
    if (kind === 'tower' || (kind === 'spawn' && from === plan.structures.spawn[0])) return undefined;
    const anchor = room.storage ? tileOf(room.storage.pos) : plan.anchor;
    if (anchor === undefined) return undefined;
    const reserved = new Set(plan.roads.concat(plan.paths));
    for (const k in plan.structures) for (const t of plan.structures[k]) reserved.add(t);
    for (const k in plan.flags || {}) reserved.add(plan.flags[k]);
    const type = TYPES[kind];
    const ax = (anchor / 50) | 0, ay = anchor % 50;
    const tiles = [];
    for (let x = Math.max(2, ax - range); x <= Math.min(47, ax + range); x++) {
        for (let y = Math.max(2, ay - range); y <= Math.min(47, ay + range); y++) {
            const t = x * 50 + y;
            if (!live.walkable[t] || occupied.has(t) || reserved.has(t) || behindWall(room, plan, t, type)) continue;
            // Nearest by walking, not by range (a tile behind a terrain wall is near by range).
            tiles.push([terrainWalk(room, anchor)[t], t]);
        }
    }
    tiles.sort((a, b) => a[0] - b[0]);
    for (const [, t] of tiles) {
        if (connectivity.blocks(live.walkable, live.req, before, t, SERVICED.has(type) && type)) continue;
        const stored = Memory.basePlan && Memory.basePlan[room.name];
        if (!stored || !stored.s || !stored.s[kind]) return undefined;
        stored.s[kind] = pack(unpack(stored.s[kind]).map(tile => (tile === from ? t : tile)));
        stored.t = Game.time;   // planOf decodes the changed plan again
        plan.structures[kind] = plan.structures[kind].map(tile => (tile === from ? t : tile));
        occupied.add(t);
        console.log('[base] ' + room.name + ': ' + kind + ' moved from ' + ((from / 50) | 0) + ',' + (from % 50) + ' to ' +
            ((t / 50) | 0) + ',' + (t % 50) + ' (the planned tile could not be reached)');
        return t;
    }
    return undefined;
}

// ---------------------------------------------------------------- building

// Labs follow the plan's role order only if every lab in the room is one the plan placed:
// mixing in hand-built labs would break the reaction range rules.
function foreignLabs(room, plan) {
    const planned = new Set(plan.structures.lab || []);
    return runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LAB } })
        .some(lab => !planned.has(tileOf(lab.pos)));
}

function buildRoom(room, plan) {
    plan = plan || planOf(room.name);
    if (!plan || !room.controller || !room.controller.my) return 0;
    const rcl = room.controller.level;
    const moreStrays = clearStrays(room, plan) >= STRAY_RAMPARTS_PER_PASS;
    const occupied = new Map();   // tile -> [structureType]
    const roadObjects = new Map();
    const finished = new Set();   // tiles holding a built (not just planned) structure
    const counts = {};
    const add = (pos, type) => {
        const tile = tileOf(pos);
        (occupied.get(tile) || occupied.set(tile, []).get(tile)).push(type);
    };
    for (const structure of runtimeCache.find(room, FIND_STRUCTURES)) {
        add(structure.pos, structure.structureType);
        if (structure.structureType === STRUCTURE_ROAD) roadObjects.set(tileOf(structure.pos), structure);
        else if (!PASSABLE.has(structure.structureType)) finished.add(tileOf(structure.pos));
        if (structure.my) counts[structure.structureType] = (counts[structure.structureType] || 0) + 1;
    }
    for (const site of runtimeCache.find(room, FIND_MY_CONSTRUCTION_SITES)) {
        add(site.pos, site.structureType);
        counts[site.structureType] = (counts[site.structureType] || 0) + 1;
    }

    let budget = Math.min(SITES_PER_PASS, SITE_HEADROOM - Object.keys(Game.constructionSites).length);
    let again = false;
    const underAttack = Memory.roomsUnderAttack && Memory.roomsUnderAttack.indexOf(room.name) !== -1;

    // Never cut a path: sites already doing so go, new blocking sites are checked first.
    const live = liveState(room);
    if (removeBlockingSites(room, live)) again = true;
    const reachable = live.spawns.length ? connectivity.status(live.walkable, live.req) : null;
    let refused = false;   // a planned tile was refused this kind: it would cut a path or be unreachable
    const site = (tile, type) => {
        if (budget <= 0) return false;
        // Not behind a terrain wall: the tile moves (replacementTile) instead.
        if (behindWall(room, plan, tile, type)) {
            refused = true;
            return false;
        }
        // Under fire, nothing placed where ranged attackers outside the walls can shoot it
        // (system.safeMode.buildHeld); it is placed once they have gone.
        if (underAttack && require('system.safeMode').buildHeld(room, { x: (tile / 50) | 0, y: tile % 50 }, type)) return false;
        const blocksMovement = !PASSABLE.has(type);
        if (blocksMovement && reachable && connectivity.blocks(live.walkable, live.req, reachable, tile, SERVICED.has(type) && type)) {
            refused = true;
            return false;
        }
        if (room.createConstructionSite((tile / 50) | 0, tile % 50, type) !== OK) return false;
        budget--;
        add({ x: (tile / 50) | 0, y: tile % 50 }, type);
        if (blocksMovement) live.walkable[tile] = 0;
        return true;
    };

    // Young room (no terminal yet, room.stage): no roads or ramparts, and sites already placed for
    // them go, so builders spend everything on structures and upgrading. Exception: roads on the
    // swamp tiles that measurably slow the room's creeps (system.swampRoads).
    const established = stage.established(room);
    // Every developing room gets a deliberately tiny rampart shell, attacked or not: its current
    // spawns, towers and storage, and the Supply tile once a supplier stands there (it only spawns
    // with a storage and towers). It buys time against a random assault; an attack only raises the
    // hits the shell is kept at (system.guardSquads.rampartCap).
    // A shardX room reclaimed after a loss is built fortified (system.shardX.fortified): towers only,
    // ramparts over them (and over a spawn it already has), walls around the controller.
    const fortified = !established && require('system.shardX').fortified(room);
    const shellRamparts = new Set();
    // The outer rampart ring (RING_RCL), once a tower stands to fight from behind it. In a young room
    // its ramparts are kept at the shell's cap (system.guardSquads.protectedRampart).
    const ringRoom = rcl >= RING_RCL && runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } }).length > 0;
    // No new ring sites while the room cannot afford them (system.energyFlow.ringAffordable): they
    // and their repairs are what emptied W1N9. A ring mostly standing is finished regardless (ringNearlyDone):
    // its holes are the way in, and a rampart costs next to nothing to place; the depth still waits.
    const affordable = ringRoom && require('system.energyFlow').ringAffordable(room);
    const ringPlan = ringRoom && (affordable || ringNearlyDone(room, plan)) ? ringTiles(room, plan) : null;
    const ring = new Set(ringPlan ? ringPlan.r : []);
    // From RCL8 the ring is RING_DEPTH tiles deeper: ramparts over whatever stands there.
    const ringDepth = new Set(ringPlan && affordable && rcl >= RING_DEPTH_RCL ? ringPlan.d || [] : []);
    // Below it, ramparts over the structures inside the ring that ranged attackers outside reach (ringCover).
    const ringCovered = new Set(ringPlan && affordable && rcl < RING_DEPTH_RCL ? ringCover(room, plan, ringPlan) : []);
    // The Supply tile (the tower supplier's spot) once the storage stands.
    const supplyFlag = Game.flags[room.name + 'Supply'];
    const supplyTile = room.storage ? (supplyFlag && supplyFlag.pos.roomName === room.name ? tileOf(supplyFlag.pos) : plan.flags && plan.flags.Supply) : undefined;
    if (!established && rcl >= RAMPART_RCL) {
        for (const structure of runtimeCache.find(room, FIND_MY_STRUCTURES)) {
            if (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_TOWER ||
                structure.structureType === STRUCTURE_STORAGE) {
                shellRamparts.add(tileOf(structure.pos));
            }
        }
        if (supplyTile !== undefined && !fortified) shellRamparts.add(supplyTile);
    }
    const built = type => runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: type } }).length;
    // Young and no tower yet: hostile creeps can stomp construction sites unopposed, so only the
    // spawn (the room cannot make creeps without it) and, from RCL3, the tower go down; builders
    // upgrade the controller meanwhile. Containers stay: miners need them.
    // While the controller cannot be upgraded (attacked: upgradeBlocked) the builders would have
    // nothing to do, so the other structures go down after all.
    // Only for a room someone else carries (room.stage.supported): its sponsor's helpers bring the
    // energy. A room on its own needs its extensions to grow (Seasonal W1N7 sat at RCL2 with none).
    const towerless = !established && stage.supported(room) && built(STRUCTURE_TOWER) === 0 && !(room.controller.upgradeBlocked > 0);
    // Under attack: sites not yet started out where the attackers can reach go, in any room; they are
    // placed again once it is over (buildHeld).
    if (underAttack) {
        const safeMode = require('system.safeMode');
        for (const s of runtimeCache.find(room, FIND_MY_CONSTRUCTION_SITES)) {
            if (s.progress === 0 && typeof s.remove === 'function' && safeMode.buildHeld(room, s.pos, s.structureType)) s.remove();
        }
    }
    if (!established) {
        for (const s of runtimeCache.find(room, FIND_MY_CONSTRUCTION_SITES)) {
            const type = s.structureType;
            const keepSiegeRampart = type === STRUCTURE_RAMPART && (shellRamparts.has(tileOf(s.pos)) || ring.has(tileOf(s.pos)) || ringDepth.has(tileOf(s.pos)) || ringCovered.has(tileOf(s.pos)));
            const held = towerless && s.progress === 0 && !keepSiegeRampart && type !== STRUCTURE_SPAWN && type !== STRUCTURE_TOWER &&
                type !== STRUCTURE_CONTAINER && type !== STRUCTURE_WALL;
            const swampRoad = type === STRUCTURE_ROAD && require('system.swampRoads').wanted(room.name, s.pos.x, s.pos.y);
            // Fortified: towers, shell ramparts and walls only; even a started spawn goes.
            const offFortify = fortified && type !== STRUCTURE_TOWER && type !== STRUCTURE_WALL && !keepSiegeRampart;
            if ((type === STRUCTURE_ROAD && !swampRoad) || (type === STRUCTURE_RAMPART && !keepSiegeRampart) || (held && !swampRoad) || offFortify) s.remove();
        }
    }

    // Below RCL8: unstarted lab, factory and extractor sites go (LATE_RCL).
    const earlyLab = rcl < LATE_RCL && !!room.terminal;
    if (rcl < LATE_RCL) {
        for (const s of runtimeCache.find(room, FIND_MY_CONSTRUCTION_SITES)) {
            if (s.progress === 0 && LATE_TYPES().includes(s.structureType) && !(earlyLab && s.structureType === STRUCTURE_LAB)) s.remove();
        }
    }

    // Focus: builders go to the nearest site, so placement order alone decides nothing. A room
    // without a spawn gets only its spawn; a tower the controller level now allows is placed
    // (and built) before anything else; a young room with no tower possible yet gets nothing more.
    const towersAllowed = Math.min((CONTROLLER_STRUCTURES[STRUCTURE_TOWER] || {})[rcl] || 0, (plan.structures.tower || []).length);
    const order = labsUrgent(room) ? LABS_FIRST : ORDER;
    let kinds = order;
    if (fortified) kinds = built(STRUCTURE_TOWER) < towersAllowed ? ['tower'] : [];   // no spawn first either
    else if (built(STRUCTURE_SPAWN) === 0 && (plan.structures.spawn || []).length) kinds = ['spawn'];
    else if (built(STRUCTURE_TOWER) < towersAllowed) kinds = ['tower'];
    else if (towerless) kinds = [];

    // Spend the small per-pass site budget on the rampart shell before ordinary extensions.
    for (const tile of shellRamparts) {
        if (budget <= 0) break;
        const here = occupied.get(tile);
        if (here && here.includes(STRUCTURE_RAMPART)) continue;
        site(tile, STRUCTURE_RAMPART);
    }

    // Adopted rooms keep hand-built lab sets intact; migrating rooms replace them.
    const skipLabs = plan.mode === 'adopt' && foreignLabs(room, plan);
    for (const kind of kinds) {
        const type = TYPES[kind];
        let allowed = (CONTROLLER_STRUCTURES[type] && CONTROLLER_STRUCTURES[type][rcl]) || 0;
        if (kind === 'lab' && skipLabs) continue;
        if (rcl < LATE_RCL && LATE_KINDS.has(kind) && !(kind === 'lab' && earlyLab)) continue;
        if (rcl < LATE_RCL && kind === 'lab') allowed = Math.min(allowed, EARLY_LABS);
        for (const tile of plan.structures[kind] || []) {
            if ((counts[type] || 0) >= allowed || budget <= 0) break;
            const here = occupied.get(tile) || [];
            if (here.includes(type)) continue;
            if (here.some(t => !PASSABLE.has(t) || t === STRUCTURE_CONTAINER)) continue;
            if (here.includes(STRUCTURE_ROAD)) {
                // A road would block the site. Fresh layouts clear it now and build next pass;
                // adopted rooms keep their roads (they may be the room's real traffic routes).
                const road = roadObjects.get(tile);
                if (plan.mode === 'fresh' && road && !underAttack && road.destroy() === OK) again = true;
                continue;
            }
            if (site(tile, type)) counts[type] = (counts[type] || 0) + 1;
        }
        // Still short and a planned tile was refused: a usable planned tile, or the plan's tile moved
        // somewhere reachable (replacementTile), so a migrated structure is still rebuilt.
        if (refused && RELOCATABLE.has(kind) && (counts[type] || 0) < allowed && budget > 0) {
            const tile = replacementTile(room, plan, kind);
            if (tile !== undefined && site(tile, type)) counts[type] = (counts[type] || 0) + 1;
        }
        refused = false;
        // Sites of this kind still to build (placed now or before): the kinds after it wait, and their
        // sites not yet started go (started ones are finished).
        if ((counts[type] || 0) > built(type)) {
            if (kinds === order) {
                const later = new Set(order.slice(order.indexOf(kind) + 1).map(k => TYPES[k]));
                for (const s of runtimeCache.find(room, FIND_MY_CONSTRUCTION_SITES)) {
                    if (s.progress === 0 && later.has(s.structureType)) s.remove();
                }
            }
            break;
        }
    }

    // Base roads beside something already built or being built. Never on a wall tile (tunnels
    // cost 150x to build and maintain); plans never contain one, this guards older plans.
    const terrain = Game.map.getRoomTerrain(room.name);
    if (rcl >= 2 && established && kinds === ORDER) {
        for (const tile of plan.roads) {
            if (budget <= 0) break;
            if (occupied.has(tile)) continue;
            const x = (tile / 50) | 0, y = tile % 50;
            if (terrain.get(x, y) & TERRAIN_MASK_WALL) continue;
            let serves = false;
            for (let dx = -1; dx <= 1 && !serves; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const here = occupied.get((x + dx) * 50 + y + dy);
                    if (here && here.some(t => !PASSABLE.has(t))) { serves = true; break; }
                }
            }
            if (serves) site(tile, STRUCTURE_ROAD);
        }
    }

    // Layout flags (fresh layouts only; adopted rooms keep their own). A migrating room's tile may
    // still hold an old structure: no flag there until base.migrate has cleared it, or the
    // supplier/miners would be sent to a tile they cannot stand on.
    if (plan.mode === 'fresh') {
        for (const name in plan.flags) {
            if (Game.flags[room.name + name]) continue;
            const here = occupied.get(plan.flags[name]);
            if (plan.migration && here && here.some(t => !PASSABLE.has(t))) continue;
            room.createFlag((plan.flags[name] / 50) | 0, plan.flags[name] % 50, room.name + name);
        }
    }

    // Ramparts over finished planned structures and the Supply tile (rampartTiles: nothing else).
    // Below RCL8: the core only (CORE_RAMPART_RCL).
    const coreTiles = new Set(runtimeCache.find(room, FIND_MY_STRUCTURES)
        .filter(s => CORE_RAMPART_TYPES().includes(s.structureType)).map(s => tileOf(s.pos)));
    if (supplyTile !== undefined) coreTiles.add(supplyTile);
    if (rcl < CORE_RAMPART_RCL) {
        for (const s of runtimeCache.find(room, FIND_MY_CONSTRUCTION_SITES)) {
            const t = tileOf(s.pos);
            if (s.structureType === STRUCTURE_RAMPART && s.progress === 0 && !coreTiles.has(t) && !ring.has(t)) s.remove();
        }
    }
    if (rcl >= RAMPART_RCL && established && kinds === ORDER) {
        const covered = [];
        if (rcl < CORE_RAMPART_RCL) {
            for (const tile of coreTiles) covered.push(tile);
        } else {
            for (const kind in plan.structures) for (const tile of plan.structures[kind]) if (finished.has(tile)) covered.push(tile);
            if (supplyTile !== undefined) covered.push(supplyTile);
        }
        for (const tile of covered) {
            if (budget <= 0) break;
            const here = occupied.get(tile);
            if (here && here.includes(STRUCTURE_RAMPART)) continue;
            site(tile, STRUCTURE_RAMPART);
        }
    }

    // The outer rampart ring (RING_RCL), after everything else this pass (the site budget goes to
    // structures first); its deeper tiles from RCL8, over whatever stands there.
    // Every ring tile needs its barrier, whatever stands there: a rampart over a structure or road,
    // and on a wall tile that holds anything (a wall needs an empty tile). W1N9's ring had gaps on
    // wall tiles a road was built on later and on edge tiles under its extensions.
    // Ramparts only. A constructed wall left on a ring tile (W1N9's alternating ring: defenders cannot
    // stand on walls, and it left them no posts) is replaced, one a pass, while the room is quiet and
    // every ring rampart already holds WALL_SWAP_MIN_HITS: destroyed now, its rampart placed next pass.
    let swapped = false;
    const swapReady = () => !swapped && !underAttack && !require('system.safeMode').underFire(room) &&
        runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_RAMPART } })
            .every(s => !ring.has(tileOf(s.pos)) || s.hits >= WALL_SWAP_MIN_HITS);
    for (const tile of ring) {
        if (budget <= 0) break;
        const here = occupied.get(tile) || [];
        if (here.includes(STRUCTURE_RAMPART)) continue;
        if (here.includes(STRUCTURE_WALL)) {
            if (swapReady()) {
                const wallObj = runtimeCache.find(room, FIND_STRUCTURES, { filter: { structureType: STRUCTURE_WALL } })
                    .find(s => tileOf(s.pos) === tile);
                if (wallObj && wallObj.destroy() === OK) { swapped = true; again = true; }
            }
            continue;
        }
        site(tile, STRUCTURE_RAMPART);
    }
    for (const tile of ringDepth) {
        if (budget <= 0) break;
        const here = occupied.get(tile) || [];
        if (here.includes(STRUCTURE_RAMPART)) continue;
        site(tile, STRUCTURE_RAMPART);
    }
    for (const tile of ringCovered) {
        if (budget <= 0) break;
        const here = occupied.get(tile) || [];
        if (here.includes(STRUCTURE_RAMPART)) continue;
        site(tile, STRUCTURE_RAMPART);
    }
    // Roads on the ring's swamp tiles (ringSwampRoads): defenders move along it at full speed.
    for (const tile of ringSwampRoads(room, plan, ringPlan)) {
        if (budget <= 0) break;
        const here = occupied.get(tile) || [];
        if (here.includes(STRUCTURE_ROAD) || here.some(t => !PASSABLE.has(t))) continue;
        site(tile, STRUCTURE_ROAD);
    }

    if (!established) controllerWalls(room, plan, rcl, site, occupied, fortified);

    ensureExtractor(room, rcl, budget);

    if (!Memory.baseBuild) Memory.baseBuild = {};
    const stagger = (room.name.charCodeAt(1) * 7 + room.name.charCodeAt(room.name.length - 1) * 13) % 200;
    Memory.baseBuild[room.name] = {
        rcl,
        next: Game.time + (again || moreStrays ? 5 : budget <= 0 || kinds !== ORDER ? 100 : BUILD_INTERVAL + stagger),
    };
    return SITES_PER_PASS - budget;
}

// Walls on the free tiles next to a controller far from the base, so nothing can stand beside it to
// attack (declaim) it. Young rooms only, from RCL2 (walls need it). Never on a planned tile (link,
// roads, paths, work tiles) and never where it would cut a path (site() checks). Walls, not
// ramparts: ramparts decay. Helpers repair them to CONTROLLER_WALL_HITS x RCL.
const CONTROLLER_FAR = 8;
// A fortified room walls its controller in wherever it is (its attackers came for the controller).
function controllerWalls(room, plan, rcl, site, occupied, always) {
    const controller = room.controller;
    if (rcl < 2 || !controller || plan.anchor === undefined) return;
    const c = tileOf(controller.pos);
    const ax = (plan.anchor / 50) | 0, ay = plan.anchor % 50;
    if (!always && Math.max(Math.abs(controller.pos.x - ax), Math.abs(controller.pos.y - ay)) < CONTROLLER_FAR) return;
    const reserved = new Set(plan.roads.concat(plan.paths));
    for (const k in plan.structures) for (const t of plan.structures[k]) reserved.add(t);
    for (const k in plan.flags || {}) reserved.add(plan.flags[k]);
    const terrain = Game.map.getRoomTerrain(room.name);
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const x = controller.pos.x + dx, y = controller.pos.y + dy;
            const t = x * 50 + y;
            if ((!dx && !dy) || x < 1 || x > 48 || y < 1 || y > 48 || t === c) continue;
            if (terrain.get(x, y) & TERRAIN_MASK_WALL || reserved.has(t) || occupied.has(t)) continue;
            site(t, STRUCTURE_WALL);
        }
    }
}

function ensureExtractor(room, rcl, budget) {
    if (rcl < LATE_RCL || budget <= 0) return;      // see LATE_RCL
    const mineral = runtimeCache.find(room, FIND_MINERALS)[0];
    if (!mineral) return;
    if (mineral.pos.lookFor(LOOK_STRUCTURES).some(s => s.structureType === STRUCTURE_EXTRACTOR)) return;
    if (mineral.pos.lookFor(LOOK_CONSTRUCTION_SITES).some(s => s.structureType === STRUCTURE_EXTRACTOR)) return;
    mineral.pos.createConstructionSite(STRUCTURE_EXTRACTOR);
}

// ---------------------------------------------------------------- tick

// The outer ring of the planned base: open tiles just outside its footprint (planned structures and
// roads within RING_RANGE of the core, and the tiles around the controller when it is that close), on
// the side reachable from the room's exits. Barriers there give defenders cover all round the base.
//   - Nothing can be built within 1 tile of an exit: where a ring tile is that close, the barrier
//     moves inward onto the footprint tiles next to it (ramparts on its roads and structures), and
//     further in while those are that close too. W1N9's base runs up to its north exits and its
//     ring had gaps there.
//   - Ramparts only: an alternating wall ring (every other outer tile a wall when the ramparts
//     outnumbered what the repairers kept up) left W1N9's defenders no posts; it is gone.
//   - Depth (d): the tiles inside the ring within RING_DEPTH of it (not next to an exit),
//     ramparted from RCL8 over whatever stands there.
// Returns { r: rampart tiles, w: [] (no walls), d: depth tiles }; kept with the plan (plan.ring).
function ringTiles(room, plan) {
    // Kept with the plan; recomputed every RING_REFRESH ticks (and a ring kept from the wall days).
    const fresh = plan.ring && plan.ring.at !== undefined && Game.time - plan.ring.at < RING_REFRESH && Game.time >= plan.ring.at;
    if (fresh && plan.ring.r && plan.ring.d && !plan.ring.alt) return plan.ring;
    const anchor = plan.anchor;
    if (anchor === undefined) return (plan.ring = { r: [], w: [], d: [], n: 0 });
    const terrain = room.getTerrain ? room.getTerrain() : Game.map.getRoomTerrain(room.name);
    const ax = (anchor / 50) | 0, ay = anchor % 50;
    const near = t => Math.max(Math.abs(((t / 50) | 0) - ax), Math.abs(t % 50 - ay)) <= RING_RANGE;
    const footprint = new Set();
    for (const kind in plan.structures) {
        if (kind === 'container' || kind === 'extractor') continue;
        for (const t of plan.structures[kind]) if (near(t)) footprint.add(t);
    }
    for (const t of plan.roads || []) if (near(t)) footprint.add(t);
    const c = room.controller && room.controller.pos;
    if (c && near(c.x * 50 + c.y)) {
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) footprint.add((c.x + dx) * 50 + c.y + dy);
    }
    const blocked = new Set(room.find(FIND_SOURCES).concat(room.find(FIND_MINERALS)).map(o => o.pos.x * 50 + o.pos.y));
    if (c) blocked.add(c.x * 50 + c.y);
    const wall = t => terrain.get((t / 50) | 0, t % 50) === TERRAIN_MASK_WALL;
    const around = t => {
        const x = (t / 50) | 0, y = t % 50, out = [];
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) out.push((x + dx) * 50 + y + dy);
        return out;
    };
    const inside = t => { const x = (t / 50) | 0, y = t % 50; return x >= 1 && y >= 1 && x <= 48 && y <= 48; };
    const open = t => inside(t) && !wall(t) && !blocked.has(t) && !footprint.has(t);
    // No building next to an exit (an open edge tile).
    const exitNear = t => {
        const x = (t / 50) | 0, y = t % 50;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
            const ex = x + dx, ey = y + dy;
            if ((ex === 0 || ey === 0 || ex === 49 || ey === 49) && ex >= 0 && ey >= 0 && ex <= 49 && ey <= 49 && terrain.get(ex, ey) !== TERRAIN_MASK_WALL) return true;
        }
        return false;
    };
    // Outside: everything reachable from the tiles next to the exits without crossing the footprint.
    const seen = new Set(), queue = [];
    for (let i = 1; i <= 48; i++) for (const t of [1 * 50 + i, 48 * 50 + i, i * 50 + 1, i * 50 + 48]) {
        if (!seen.has(t) && open(t)) { seen.add(t); queue.push(t); }
    }
    for (let q = 0; q < queue.length; q++) for (const n of around(queue[q])) if (!seen.has(n) && open(n)) { seen.add(n); queue.push(n); }
    const outer = [], inner = new Set();
    for (const t of seen) {
        if (!around(t).some(n => footprint.has(n))) continue;
        if (!exitNear(t)) { outer.push(t); continue; }
        // Too close to an exit: the footprint tiles next to it instead, further in while needed.
        const stack = around(t).filter(n => footprint.has(n)), done = new Set(stack);
        while (stack.length) {
            const f = stack.pop();
            if (!inside(f) || wall(f) || blocked.has(f)) continue;
            if (!exitNear(f)) { inner.add(f); continue; }
            for (const n of around(f)) if (footprint.has(n) && !done.has(n)) { done.add(n); stack.push(n); }
        }
    }
    // Only ring tiles an enemy can reach from an exit without crossing another ring tile: the rest sit
    // behind the ring already (a corridor between the base and the room's edge walls, sealed at its
    // mouth: shard2 E3N18's west side had ramparts all along it).
    const ringAll = new Set(outer.concat([...inner]));
    const reach = new Set(), q2 = [];
    const passable = t => { const x = (t / 50) | 0, y = t % 50; return x >= 0 && y >= 0 && x <= 49 && y <= 49 && !wall(t) && !blocked.has(t) && !footprint.has(t) && !ringAll.has(t); };
    for (let i = 0; i <= 49; i++) for (const t of [i, 49 * 50 + i, i * 50, i * 50 + 49]) {
        if (!reach.has(t) && passable(t)) { reach.add(t); q2.push(t); }
    }
    for (let q = 0; q < q2.length; q++) for (const n of around(q2[q])) if (!reach.has(n) && passable(n)) { reach.add(n); q2.push(n); }
    // No exit found (a closed test room): nothing to prune against.
    const exposed = t => !q2.length || around(t).some(n => reach.has(n));
    for (let i = outer.length - 1; i >= 0; i--) if (!exposed(outer[i])) outer.splice(i, 1);
    for (const t of [...inner]) if (!exposed(t)) inner.delete(t);
    const r = [...inner].concat(outer);
    // Depth: tiles inside the ring (not reachable from the exits) within RING_DEPTH of it (Chebyshev):
    // planned structures and roads, and open ground between them where defenders stand.
    const ringSet = new Set(r);
    const d = new Set();
    for (const t of ringSet) {
        const x = (t / 50) | 0, y = t % 50;
        for (let dx = -RING_DEPTH; dx <= RING_DEPTH; dx++) for (let dy = -RING_DEPTH; dy <= RING_DEPTH; dy++) {
            const n = (x + dx) * 50 + y + dy;
            if (x + dx < 1 || x + dx > 48 || y + dy < 1 || y + dy > 48) continue;
            if (ringSet.has(n) || seen.has(n) || wall(n) || blocked.has(n) || exitNear(n)) continue;
            d.add(n);
        }
    }
    return (plan.ring = { r: r.sort((a, b) => a - b), w: [], d: [...d].sort((a, b) => a - b), n: outer.length, at: Game.time });
}

// ---------------------------------------------------------------- decoy bases
// A decoy room (system.bait) looks like a full base: the normal plan (a one-source room just has no
// upgrade miner's tile), built by its lone creep. One site at a time, and none while the shard has
// DECOY_SITE_LIMIT sites (the cap is 100): the main rooms need them. No ramparts or roads: those
// need upkeep for ever. Cheapest kinds first; every kind the controller level allows, labs and all
// (the normal builder holds those back for the controller, which a decoy does not hurry).
const DECOY_RCL = 3;              // below it the creep upgrades toward its first tower: no plan yet
const DECOY_PLAN_EVERY = 20;      // ticks between decoy plans on the shard
const DECOY_SITE_LIMIT = 50;
const DECOY_ORDER = ['tower', 'spawn', 'extension', 'link', 'observer', 'storage', 'lab', 'powerSpawn', 'terminal', 'factory', 'nuker'];
function decoyPlanDue(room) {
    if (room.controller.level < DECOY_RCL || Game.time % DECOY_PLAN_EVERY !== 0) return false;
    const stored = Memory.basePlan && Memory.basePlan[room.name];
    if (stored && stored.v === VERSION && !(stored.fail && Game.time - stored.fail >= RETRY_FAILED)) return false;
    return governor.allows('planning') && (!Game.cpu || Game.cpu.bucket >= require('system.bait').BUCKET_MIN);
}
// May a decoy place a site now? (Walls too.)
function decoySiteRoom() {
    return Object.keys(Game.constructionSites || {}).length < DECOY_SITE_LIMIT;
}
// The next planned structure for this decoy's site: { x, y, type }, or null (no plan, or nothing more
// its controller level allows).
function decoyNext(room) {
    const plan = planOf(room.name);
    if (!plan) return null;
    const rcl = room.controller.level;
    const counts = {};
    const occupied = new Set();
    for (const s of runtimeCache.find(room, FIND_STRUCTURES)) {
        if (s.my) counts[s.structureType] = (counts[s.structureType] || 0) + 1;
        if (!PASSABLE.has(s.structureType)) occupied.add(tileOf(s.pos));
    }
    for (const s of runtimeCache.find(room, FIND_MY_CONSTRUCTION_SITES)) {
        counts[s.structureType] = (counts[s.structureType] || 0) + 1;
        occupied.add(tileOf(s.pos));
    }
    let live, before;
    for (const kind of DECOY_ORDER) {
        const type = TYPES[kind];
        const allowed = (CONTROLLER_STRUCTURES[type] && CONTROLLER_STRUCTURES[type][rcl]) || 0;
        if ((counts[type] || 0) >= allowed) continue;
        for (const tile of plan.structures[kind] || []) {
            if (occupied.has(tile) || behindWall(room, plan, tile, type)) continue;
            if (!live) {
                live = liveState(room);
                before = live.spawns.length ? connectivity.status(live.walkable, live.req) : null;
            }
            if (before && connectivity.blocks(live.walkable, live.req, before, tile, SERVICED.has(type) && type)) continue;
            return { x: (tile / 50) | 0, y: tile % 50, type };
        }
    }
    return null;
}

// Is this tile on the room's outer rampart ring? Per room per tick.
const ringSets = Object.create(null);
function onRing(room, tile) {
    let c = ringSets[room.name];
    if (!c || c.t !== Game.time) {
        const plan = room.controller && room.controller.level >= RING_RCL ? planOf(room.name) : null;
        const ring = plan ? ringTiles(room, plan) : null;
        // The covered structures below RCL8 (ringCover) are kept at the ring's cap too.
        const cover = ring && room.controller.level < RING_DEPTH_RCL ? ringCover(room, plan, ring) : [];
        c = ringSets[room.name] = { t: Game.time, tiles: new Set(ring ? ring.r.concat(cover) : []) };
    }
    return c.tiles.has(tile);
}

// Below RCL8 (no depth ramparts yet) the structures inside the ring that a ranged attacker standing
// outside it reaches (RANGED_REACH): their own rampart, so a quad outside cannot shoot them down over
// the ring. Above all the extensions: without them the room cannot spawn the large defenders it needs.
// Outside: everything walkable from the exits without crossing a ring tile. Roads, containers, walls
// and the controller are left bare (NOT_COVERED). Cached COVER_TTL ticks.
const RANGED_REACH = 3;
const COVER_TTL = 100;
const coverCache = Object.create(null);
function ringCover(room, plan, ringPlan) {
    const ringAt = ringPlan.at;
    const hit = coverCache[room.name];
    if (hit && hit.at === ringAt && Game.time - hit.t < COVER_TTL && Game.time >= hit.t) return hit.tiles;
    const ring = new Set(ringPlan.r || []);
    const tiles = [];
    if (ring.size) {
        const terrain = room.getTerrain ? room.getTerrain() : Game.map.getRoomTerrain(room.name);
        const walk = (x, y) => x >= 0 && y >= 0 && x <= 49 && y <= 49 && !(terrain.get(x, y) & TERRAIN_MASK_WALL) && !ring.has(x * 50 + y);
        const outside = new Uint8Array(2500), queue = [];
        for (let i = 0; i < 50; i++) for (const [x, y] of [[i, 0], [i, 49], [0, i], [49, i]]) {
            if (walk(x, y) && !outside[x * 50 + y]) { outside[x * 50 + y] = 1; queue.push(x * 50 + y); }
        }
        for (let q = 0; q < queue.length; q++) {
            const x = (queue[q] / 50) | 0, y = queue[q] % 50;
            for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
                const nx = x + dx, ny = y + dy;
                if (walk(nx, ny) && !outside[nx * 50 + ny]) { outside[nx * 50 + ny] = 1; queue.push(nx * 50 + ny); }
            }
        }
        const reached = (x, y) => {
            for (let dx = -RANGED_REACH; dx <= RANGED_REACH; dx++) for (let dy = -RANGED_REACH; dy <= RANGED_REACH; dy++) {
                const nx = x + dx, ny = y + dy;
                if (nx >= 0 && ny >= 0 && nx <= 49 && ny <= 49 && outside[nx * 50 + ny]) return true;
            }
            return false;
        };
        const skip = NOT_COVERED();
        const seen = new Set();
        for (const s of runtimeCache.find(room, FIND_MY_STRUCTURES)) {
            const k = tileOf(s.pos);
            if (skip.has(s.structureType) || seen.has(k) || ring.has(k) || outside[k]) continue;   // outside: not ours to cover (all of it while the ring has a gap)
            seen.add(k);
            if (reached(s.pos.x, s.pos.y)) tiles.push(k);
        }
        tiles.sort((a, b) => a - b);
    }
    coverCache[room.name] = { t: Game.time, at: ringAt, tiles };
    return tiles;
}

function enabled(roomName) {
    return !(Memory.baseBuildOff && Memory.baseBuildOff[roomName]);
}

function run() {
    if (Memory.settings && Memory.settings.basePlanning === false) return;
    let planned = false;
    let built = false;
    let migrating = false;
    let refitted = false;
    let index = 0;
    for (const name in Game.rooms) {
        const room = Game.rooms[name];
        if (!room.controller || !room.controller.my) continue;
        // shardX decoy rooms (system.bait): planned here, built by their creep one site at a time
        // (decoyNext, creep.xBait); nothing else of a normal room's upkeep runs for them.
        if (require('system.bait').isBait(name)) {
            if (!planned && decoyPlanDue(room)) {
                planned = true;
                const cpu = roomCpu.timer();
                planRoom(room);
                cpu.lap(name);
            }
            continue;
        }
        // Every 100 ticks per room (staggered, opted-out rooms too): remove construction sites
        // that seal a path, without waiting for the next build pass.
        if ((Game.time + index++ * 7) % PATH_CHECK_EVERY === 0) {
            const cpu = roomCpu.timer();
            if (clearLeftovers(room)) {
                cpu.lap(name);
                continue;
            }
            const live = liveState(room);
            removeBlockingSites(room, live);
            releaseSealed(room, live);
            cpu.lap(name);
        }
        if (Game.time % STUCK_CHECK_EVERY === 0) unstickSpawns(room);
        if (!enabled(name)) continue;
        const stored = Memory.basePlan && Memory.basePlan[name];
        if (!stored || stored.v !== VERSION || (stored.fail && Game.time - stored.fail >= RETRY_FAILED)) {
            if (!planned && governor.allows('planning')) {
                planned = true;
                const cpu = roomCpu.timer();
                if (planRoom(room) && !built) {
                    built = true;
                    buildRoom(room);
                }
                cpu.lap(name);
            }
            continue;
        }
        if (stored.fail) continue;
        if (stored.mg && Game.time % FLAG_CHECK_EVERY === 0) syncFlags(room, planOf(name));
        if (!planned && migrationWanted(room, stored) && governor.allows('planning')) {
            planned = true;
            const cpu = roomCpu.timer();
            planMigration(room);
            cpu.lap(name);
            continue;
        }
        // Not on the planning governor: this is one flood-fill search, once per room, and a shard short
        // of CPU (shard2) would never get its labs moved.
        if (!refitted && refitDue(stored)) {
            refitted = true;
            const cpu = roomCpu.timer();
            refitLabs(room);
            cpu.lap(name);
            continue;
        }
        if (!refitted && coreDue(stored)) {
            refitted = true;
            const cpu = roomCpu.timer();
            repairCore(room);
            cpu.lap(name);
            continue;
        }
        if (!refitted && behindDue(stored)) {
            refitted = true;
            const cpu = roomCpu.timer();
            fixBehind(room);
            cpu.lap(name);
            continue;
        }
        if (!refitted && passDue(stored)) {
            refitted = true;
            const cpu = roomCpu.timer();
            layLane(room);
            cpu.lap(name);
            continue;
        }
        if (stored.mg && migrationOn()) {
            const mem = Memory.baseMigrate && Memory.baseMigrate[name];
            const active = !!(mem && mem.step);
            const due = !(mem && mem.done) && Game.time >= ((mem && mem.next) || 0);
            const turn = migrationTurn(active, due, migrating);
            if (turn) {
                const cpu = roomCpu.timer();
                if (turn === 'look') migrating = true;
                const roomPlan = planOf(name);
                migrate.runRoom(room, roomPlan, KIND_OF, rebuildNow, kind => replacementTile(room, roomPlan, kind) !== undefined,
                    { labsFirst: labsUrgent(room), holdLabs: room.controller.level < LATE_RCL, behind: tile => behindWall(room, roomPlan, tile) });
                cpu.lap(name);
            }
        }
        if (built) continue;
        const state = Memory.baseBuild && Memory.baseBuild[name];
        if (!state || state.rcl !== room.controller.level || Game.time >= state.next) {
            built = true;
            const cpu = roomCpu.timer();
            buildRoom(room);
            cpu.lap(name);
        }
    }
    visualizeFlagged();
}

// Opt a room back in and plan it now (InitAutoBuild / AddAutobuildRoom flags).
function replan(room) {
    if (Memory.baseBuildOff) delete Memory.baseBuildOff[room.name];
    if (Memory.basePlan) delete Memory.basePlan[room.name];
    const plan = planRoom(room);
    if (plan) buildRoom(room, plan);
    return plan;
}

function optOut(roomName) {
    if (!Memory.baseBuildOff) Memory.baseBuildOff = {};
    Memory.baseBuildOff[roomName] = true;
}

// Planned lab tiles in role order (3 that load boosts on demand, 2 reagent, 5 output), or null.
function labOrder(roomName) {
    const plan = planOf(roomName);
    return plan && plan.structures.lab && plan.structures.lab.length ? plan.structures.lab : null;
}

// Planned base road tiles (system.roads keeps them as priority roads).
function roadTiles(roomName) {
    const plan = planOf(roomName);
    if (!plan) return [];
    const room = Game.rooms[roomName];
    const extra = room && room.controller && room.controller.my ? ringSwampRoads(room, plan) : [];
    return extra.length ? plan.roads.concat(extra) : plan.roads;
}

// The ring's swamp tiles (outer ring and its depth): roads there, so defenders running along the ramparts
// after an enemy are not slowed to a crawl (a swamp step costs 5x the fatigue). They count as the base's
// own roads, so system.roads keeps them and the towers repair them. From the ring's level (RING_RCL).
function ringSwampRoads(room, plan, ringPlan) {
    if (!room.controller || room.controller.level < RING_RCL) return [];
    const ring = ringPlan || ringTiles(room, plan);
    const terrain = Game.map.getRoomTerrain(room.name);
    return ring.r.concat(ring.d || []).filter(t => terrain.get((t / 50) | 0, t % 50) === TERRAIN_MASK_SWAMP);
}

// ---------------------------------------------------------------- visualization

const preview = Object.create(null);   // heap: room -> { t, plan } for rooms without a stored plan
const GLYPH = { spawn: 'S', extension: '', storage: '$', tower: 'T', link: 'K', terminal: 'M', lab: 'L',
    factory: 'F', powerSpawn: 'P', nuker: 'N', observer: 'O' };
const COLOR = { spawn: '#ffcc00', extension: '#ffee88', storage: '#66ccff', tower: '#ff6666', link: '#cc88ff',
    terminal: '#66ffcc', lab: '#88ff88', factory: '#ffaa66', powerSpawn: '#ff66cc', nuker: '#aaaaaa', observer: '#ffffff' };

// VisualizeBase flag: draw the room's plan (planning a preview first for rooms not yet owned).
function visualizeFlagged() {
    const flag = Game.flags.VisualizeBase;
    if (!flag || !flag.room) return;
    const roomName = flag.pos.roomName;
    let plan = planOf(roomName);
    if (!plan) {
        const cached = preview[roomName];
        if (cached && Game.time - cached.t < 1000) {
            plan = cached.plan;
        } else {
            const result = planner.plan(contextFor(flag.room));
            plan = result && { mode: result.mode, flags: result.flags, structures: result.structures, roads: result.roads, paths: result.paths };
            preview[roomName] = { t: Game.time, plan };
        }
    }
    if (!plan) return;
    const vis = new RoomVisual(roomName);
    for (const tile of plan.paths || []) vis.circle((tile / 50) | 0, tile % 50, { radius: 0.12, fill: '#888888', opacity: 0.4 });
    for (const tile of plan.roads) vis.circle((tile / 50) | 0, tile % 50, { radius: 0.18, fill: '#bbbbbb', opacity: 0.6 });
    const labs = plan.structures.lab || [];
    for (const kind in plan.structures) {
        plan.structures[kind].forEach((tile, n) => {
            const x = (tile / 50) | 0, y = tile % 50;
            vis.circle(x, y, { radius: 0.4, fill: COLOR[kind] || '#ffffff', opacity: 0.5 });
            let glyph = GLYPH[kind];
            if (kind === 'lab') glyph = n === 3 || n === 4 ? 'I' : 'L';
            if (glyph) vis.text(glyph, x, y + 0.2, { color: '#000000', font: 0.5 });
        });
    }
    for (const name in plan.flags) {
        const tile = plan.flags[name];
        vis.text(name === 'Supply' ? '@' : name === 'storageMiner' ? 'm' : 'u', (tile / 50) | 0, tile % 50 + 0.2, { color: '#ffffff', font: 0.6 });
    }
    vis.text(`base plan (${plan.mode}${labs.length ? '' : ', no lab stamp fits'})`, 25, 1, { color: '#ffffff', font: 0.7 });
}

module.exports = { ringCover, ringSwampRoads, ringNearlyDone, passDue, layLane, coreRepair, coreDue, repairCore, syncFlags, unstickSpawns, refitDue, refitLabs, behindDue, fixBehind, clearStrays, ringHolds, labsUrgent, migrationTurn, decoyNext, decoySiteRoom, decoyPlanDue, DECOY_SITE_LIMIT, RING_RCL, onRing, behindWall, ringTiles, rampartTiles, clearStrays, misplacedStructure, STRAY_KEEP_HITS, run, planRoom, planMigration, buildRoom, liveState, removeBlockingSites, releaseSealed, clearLeftovers, replacementTile, planOf, replan, optOut, labOrder, roadTiles, contextFor, pack, unpack, VERSION, KIND_OF };
