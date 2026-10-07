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

const VERSION = 1;
const BUILD_INTERVAL = 1000;
const RETRY_FAILED = 20000;
const SITES_PER_PASS = 10;
const SITE_HEADROOM = 90;          // leave room under the 100-site cap for roads/repairs elsewhere
const RAMPART_RCL = 2;             // ramparts over every planned structure (previous generator)
const PATH_CHECK_EVERY = 100;      // ticks between checks for sites that seal a path
const OFFSET = 48;

const TYPES = {
    spawn: STRUCTURE_SPAWN, extension: STRUCTURE_EXTENSION, storage: STRUCTURE_STORAGE, tower: STRUCTURE_TOWER,
    link: STRUCTURE_LINK, terminal: STRUCTURE_TERMINAL, lab: STRUCTURE_LAB, factory: STRUCTURE_FACTORY,
    powerSpawn: STRUCTURE_POWER_SPAWN, nuker: STRUCTURE_NUKER, observer: STRUCTURE_OBSERVER,
};
const KIND_OF = {};
for (const kind in TYPES) KIND_OF[TYPES[kind]] = kind;
// Build order when sites are scarce.
const ORDER = ['spawn', 'extension', 'storage', 'tower', 'link', 'terminal', 'lab', 'factory', 'powerSpawn', 'nuker', 'observer'];
const PASSABLE = new Set([STRUCTURE_ROAD, STRUCTURE_CONTAINER, STRUCTURE_RAMPART]);

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
    const plan = { mode: stored.m, anchor: stored.a, flags: stored.f || {}, structures, roads: unpack(stored.r), paths: unpack(stored.p), migration: !!stored.mg };
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
    let storage;
    for (const structure of runtimeCache.find(room, FIND_STRUCTURES)) {
        const tile = tileOf(structure.pos);
        const type = structure.structureType;
        if (type === STRUCTURE_SPAWN && structure.my) spawns.push(tile);
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
    for (const kind of ['Supply', 'storageMiner', 'upgradeMiner']) {
        const flag = Game.flags[room.name + kind];
        if (flag && flag.pos.roomName === room.name) walkable[tileOf(flag.pos)] = 0;
    }
    const mineral = runtimeCache.find(room, FIND_MINERALS)[0];
    const req = connectivity.requirements(walkable, {
        spawns, storage,
        sources: runtimeCache.find(room, FIND_SOURCES).map(s => tileOf(s.pos)),
        mineral: mineral ? tileOf(mineral.pos) : undefined,
        controller: room.controller && room.controller.pos ? tileOf(room.controller.pos) : undefined,
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

// A planned tile of this kind a site could go on right now without cutting a path (base.migrate
// only moves a structure when its replacement can be placed).
function replacementTile(room, plan, kind) {
    const live = liveState(room);
    const before = connectivity.status(live.walkable, live.req);
    const occupied = new Set();
    for (const structure of runtimeCache.find(room, FIND_STRUCTURES)) {
        if (!PASSABLE.has(structure.structureType) || structure.structureType === STRUCTURE_CONTAINER) occupied.add(tileOf(structure.pos));
    }
    for (const site of runtimeCache.find(room, FIND_MY_CONSTRUCTION_SITES)) occupied.add(tileOf(site.pos));
    for (const tile of (plan.structures[kind] || [])) {
        if (occupied.has(tile)) continue;
        if (!connectivity.blocks(live.walkable, live.req, before, tile)) return tile;
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
    const site = (tile, type) => {
        if (budget <= 0) return false;
        const blocksMovement = !PASSABLE.has(type);
        if (blocksMovement && reachable && connectivity.blocks(live.walkable, live.req, reachable, tile)) return false;
        if (room.createConstructionSite((tile / 50) | 0, tile % 50, type) !== OK) return false;
        budget--;
        add({ x: (tile / 50) | 0, y: tile % 50 }, type);
        if (blocksMovement) live.walkable[tile] = 0;
        return true;
    };

    // Adopted rooms keep hand-built lab sets intact; migrating rooms replace them.
    const skipLabs = plan.mode === 'adopt' && foreignLabs(room, plan);
    for (const kind of ORDER) {
        const type = TYPES[kind];
        const allowed = (CONTROLLER_STRUCTURES[type] && CONTROLLER_STRUCTURES[type][rcl]) || 0;
        if (kind === 'lab' && skipLabs) continue;
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
    }

    // Base roads beside something already built or being built. Never on a wall tile (tunnels
    // cost 150x to build and maintain); plans never contain one, this guards older plans.
    const terrain = Game.map.getRoomTerrain(room.name);
    if (rcl >= 2) {
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

    // Ramparts over finished planned structures and over the core's creep spots (Supply,
    // miner tiles), as the previous generator did.
    if (rcl >= RAMPART_RCL) {
        const covered = [];
        for (const kind in plan.structures) for (const tile of plan.structures[kind]) if (finished.has(tile)) covered.push(tile);
        if (plan.mode === 'fresh') for (const name in plan.flags) covered.push(plan.flags[name]);
        for (const tile of covered) {
            if (budget <= 0) break;
            const here = occupied.get(tile);
            if (here && here.includes(STRUCTURE_RAMPART)) continue;
            site(tile, STRUCTURE_RAMPART);
        }
    }

    ensureExtractor(room, rcl, budget);

    if (!Memory.baseBuild) Memory.baseBuild = {};
    const stagger = (room.name.charCodeAt(1) * 7 + room.name.charCodeAt(room.name.length - 1) * 13) % 200;
    Memory.baseBuild[room.name] = {
        rcl,
        next: Game.time + (again ? 5 : budget <= 0 ? 100 : BUILD_INTERVAL + stagger),
    };
    return SITES_PER_PASS - budget;
}

function ensureExtractor(room, rcl, budget) {
    if (rcl < 6 || budget <= 0) return;
    const mineral = runtimeCache.find(room, FIND_MINERALS)[0];
    if (!mineral) return;
    if (mineral.pos.lookFor(LOOK_STRUCTURES).some(s => s.structureType === STRUCTURE_EXTRACTOR)) return;
    if (mineral.pos.lookFor(LOOK_CONSTRUCTION_SITES).some(s => s.structureType === STRUCTURE_EXTRACTOR)) return;
    mineral.pos.createConstructionSite(STRUCTURE_EXTRACTOR);
}

// ---------------------------------------------------------------- tick

function enabled(roomName) {
    return !(Memory.baseBuildOff && Memory.baseBuildOff[roomName]);
}

function run() {
    if (Memory.settings && Memory.settings.basePlanning === false) return;
    let planned = false;
    let built = false;
    let migrating = false;
    let index = 0;
    for (const name in Game.rooms) {
        const room = Game.rooms[name];
        if (!room.controller || !room.controller.my) continue;
        // Every 100 ticks per room (staggered, opted-out rooms too): remove construction sites
        // that seal a path, without waiting for the next build pass.
        if ((Game.time + index++ * 7) % PATH_CHECK_EVERY === 0) {
            const cpu = roomCpu.timer();
            removeBlockingSites(room, liveState(room));
            cpu.lap(name);
        }
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
        if (!planned && migrationWanted(room, stored) && governor.allows('planning')) {
            planned = true;
            const cpu = roomCpu.timer();
            planMigration(room);
            cpu.lap(name);
            continue;
        }
        if (stored.mg && migrationOn()) {
            const mem = Memory.baseMigrate && Memory.baseMigrate[name];
            const active = !!(mem && mem.step);
            // Active steps advance every tick (cheap); at most one room looks for a new step.
            if (active || !migrating) {
                const cpu = roomCpu.timer();
                if (!active) migrating = true;
                const roomPlan = planOf(name);
                migrate.runRoom(room, roomPlan, KIND_OF, rebuildNow, kind => replacementTile(room, roomPlan, kind) !== undefined);
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

// Planned lab tiles in role order (3 boost, 2 reagent, 5 output), or null.
function labOrder(roomName) {
    const plan = planOf(roomName);
    return plan && plan.structures.lab && plan.structures.lab.length ? plan.structures.lab : null;
}

// Planned base road tiles (system.roads keeps them as priority roads).
function roadTiles(roomName) {
    const plan = planOf(roomName);
    return plan ? plan.roads : [];
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
            if (kind === 'lab') glyph = n < 3 ? 'B' : n < 5 ? 'I' : 'L';
            if (glyph) vis.text(glyph, x, y + 0.2, { color: '#000000', font: 0.5 });
        });
    }
    for (const name in plan.flags) {
        const tile = plan.flags[name];
        vis.text(name === 'Supply' ? '@' : name === 'storageMiner' ? 'm' : 'u', (tile / 50) | 0, tile % 50 + 0.2, { color: '#ffffff', font: 0.6 });
    }
    vis.text(`base plan (${plan.mode}${labs.length ? '' : ', no lab stamp fits'})`, 25, 1, { color: '#ffffff', font: 0.7 });
}

module.exports = { run, planRoom, planMigration, buildRoom, liveState, removeBlockingSites, replacementTile, planOf, replan, optOut, labOrder, roadTiles, contextFor, pack, unpack, VERSION, KIND_OF };
