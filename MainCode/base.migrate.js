// base.migrate — moves established rooms onto the automatic layout, one structure at a time.
//
// An established room (it has a storage) is first given a migration target: a full layout
// planned as if the room were empty, except for what cannot move. The core is built around the
// existing storage (a full storage cannot be moved), and nukers stay (their energy and ghodium
// cannot be withdrawn). Then, one step at a time per room:
//   1. pick an out-of-place structure. Blockers first: those sitting on a tile the plan needs
//      for something else, the core's creep tiles or a kept-clear path.
//   2. evacuate it if it holds goods (terminal, factory, lab): the lab worker carries everything
//      to the storage first
//   3. destroy it; base.builder places the replacement site at the planned tile right away
//   4. wait until the replacement is built, then a short cooldown before the next step
//
// Safety, so a room never collapses:
//   - nothing while hostiles are in the room, when sites are short (the replacement could not be
//     placed), or without twice the rebuild cost (+30k) in storage
//   - a structure is only removed if its replacement has a free planned tile, except cheap
//     blockers (extension, link, observer, lab, container) that clear the way for others
//   - spawns: never the last one, never one that is spawning
//   - towers: always 2 left standing
//   - important buildings (spawn, tower, terminal, factory, power spawn) only when the room has
//     no other construction sites, so builders rebuild them first
//   - power spawn: only while the room's operator (if any) has 2,500+ ticks to live to cover
//     the rebuild
//   - terminal/factory: only if the storage can take everything they hold
// Order in a room (ranker):
//   1. towers, what stands on a tower's planned tile, and what stands on the Supply tile: a room's towers
//      depend on them (shard2 E26N32: a stray tower on the Supply tile left the others unfed)
//   2. until a spawn stands on the first planned spawn tile, beside the Supply tile: spawns, and what
//      stands on that tile (the supplier is made there)
//   3. what stands across a terrain wall from the core (behind: tile -> bool)
//   4. labs and what stands on a lab's planned tile (labsFirst, base.builder.labsUrgent)
//   5. everything else
// A step in progress gives way to a lower number unless its structure is just being destroyed: the
// emptied terminal goes back to work, and a replacement already placed is still built. The next step
// follows a move of 1-4 at once. Ranks 1 and 2 do not wait for the room's other sites, and need the
// rebuild cost plus 30k in storage. A rank short of energy holds the ones after it, so it can save
// up; a rank that cannot move for another reason does not. holdLabs: labs stay for now.
// Layout flags (Supply, storageMiner, upgradeMiner) move once their planned tile is clear (the
// upgrade miner's once its new link is built); miners walk to the new spot.
//
// Memory.baseMigrate[room] = { step: { id, kind, tile, phase, t, before }, next, done }
const runtimeCache = require('runtime.cache');

const PASS_INTERVAL = 50;       // ticks between looks for a new step in a room
const ROOM_COOLDOWN = 20;       // after a replacement is finished
const EVACUATE_TIMEOUT = 3000;
const REBUILD_TIMEOUT = 10000;
const SITE_HEADROOM = 95;
// Leftovers below this stay in the ruin (salvagers pick them up). Terminals keep receiving
// deliveries while being emptied, so they get a looser bar.
const EVACUATED = { lab: 100, terminal: 3000, factory: 3000 };
const evacuatedBelow = kind => EVACUATED[kind] || 500;
const LAB_EVACUATE_TIMEOUT = 300;   // what is left stays in the ruin for the salvagers
const LAB_COOLDOWN = 5;
const SITE_GRACE = 110;             // ticks for a build pass to place the replacement (about 100 apart)
const LAB_FLOOR = 100000;           // storage energy to start a lab move at, labs first
const OPERATOR_TTL = 2500;
const MIN_TOWERS_LEFT = 2;

const MOVABLE = ['container', 'extension', 'observer', 'link', 'lab', 'tower', 'spawn', 'factory', 'powerSpawn', 'terminal'];
const EXPENDABLE = new Set(['extension', 'link', 'observer', 'lab', 'container']);
const EVACUATE = new Set(['terminal', 'factory', 'lab']);
const IMPORTANT = new Set(['spawn', 'tower', 'terminal', 'factory', 'powerSpawn']);
const PASSABLE = new Set(['road', 'rampart']);
const COST = { container: 5000, extension: 3000, observer: 8000, link: 5000, lab: 50000, tower: 5000,
    spawn: 15000, factory: 100000, powerSpawn: 100000, terminal: 100000 };

/**
 * Pure step choice (tests feed plain data).
 * s = {
 *   plan: { structures: {kind: [tile]}, paths: [tile], flags: {name: tile} },
 *   built: [{ id, kind, tile, used, spawning }]   own structures (kind as in base.builder)
 *   siteTiles: Set(tile)   construction sites in the room; roomSites: non-road/rampart sites in the room
 *   globalSites, energy (storage), storageFree, hostiles (bool), operatorTtl (number|undefined)
 * }
 *   canPlace (optional): kind -> can its replacement site go down now without blocking a path
 *   labsFirst, holdLabs, behind (optional): see the top of this file
 * Returns { id, kind, tile, evacuate } or null; s.misplaced is set to how many are left.
 */
// A lab, or anything standing on a tile planned for one.
function isLabWork(b, planned) {
    return b.kind === 'lab' || planned.get(b.tile) === 'lab';
}

function chooseStep(s) {
    const planned = new Map();
    for (const kind in s.plan.structures) for (const tile of s.plan.structures[kind]) planned.set(tile, kind);
    const mustBeClear = new Set(s.plan.paths || []);
    for (const name in s.plan.flags || {}) mustBeClear.add(s.plan.flags[name]);
    const solid = new Map();
    const counts = {};
    for (const b of s.built) {
        if (!PASSABLE.has(b.kind)) solid.set(b.tile, b.kind);
        counts[b.kind] = (counts[b.kind] || 0) + 1;
    }
    const misplaced = s.built.filter(b => MOVABLE.includes(b.kind) && planned.get(b.tile) !== b.kind &&
        (b.kind !== 'container' || planned.has(b.tile) || mustBeClear.has(b.tile)));
    s.misplaced = misplaced.length;
    if (!misplaced.length || s.hostiles || s.globalSites >= SITE_HEADROOM) return null;

    // A free planned tile, where a site can also go right now without cutting a path (old
    // structures still standing can make a planned tile the only way through).
    const freeTileFor = kind => (s.plan.structures[kind] || []).some(t => !solid.has(t) && !s.siteTiles.has(t)) &&
        (!s.canPlace || s.canPlace(kind));
    const isBlocker = b => (planned.has(b.tile) && planned.get(b.tile) !== b.kind) || mustBeClear.has(b.tile);
    misplaced.sort((a, b) => (isBlocker(b) - isBlocker(a)) || MOVABLE.indexOf(a.kind) - MOVABLE.indexOf(b.kind));
    const rank = ranker(s);
    const list = s.holdLabs ? misplaced.filter(b => !isLabWork(b, planned)) : misplaced;
    const needsEmptying = b => EVACUATE.has(b.kind) && (b.used || 0) > evacuatedBelow(b.kind);
    for (let r = RANK_TOWER; r <= RANK_REST; r++) {
        // What moves at once before what has to be emptied first: one step at a time per room.
        const tier = list.filter(b => rank(b) === r).sort((a, b) => needsEmptying(a) - needsEmptying(b));
        let short = false;
        for (const b of tier) {
            const kind = b.kind;
            if (kind === 'container') return { id: b.id, kind, tile: b.tile, evacuate: false };
            const floor = r <= RANK_SPAWN ? COST[kind] + 30000 : r === RANK_LAB && kind === 'lab' ? LAB_FLOOR : COST[kind] * 2 + 30000;
            if (s.energy < floor) { short = true; continue; }
            if (IMPORTANT.has(kind) && s.roomSites > 0 && r > RANK_SPAWN) continue;
            if (kind === 'spawn' && (counts.spawn || 0) < 2) continue;
            if (kind === 'spawn' && b.spawning) { short = r <= RANK_SPAWN || short; continue; }
            if (kind === 'tower' && (counts.tower || 0) - 1 < MIN_TOWERS_LEFT) continue;
            if (kind === 'powerSpawn' && s.operatorTtl !== undefined && s.operatorTtl < OPERATOR_TTL) continue;
            if ((kind === 'terminal' || kind === 'factory') && s.storageFree < (b.used || 0) + 50000) continue;
            const hasDestination = freeTileFor(kind);
            // A tower on the Supply tile goes even with no tile to go to: the others are unfed until it does.
            const onSupply = kind === 'tower' && b.tile === (s.plan.flags || {}).Supply;
            if (!hasDestination && !(isBlocker(b) && (EXPENDABLE.has(kind) || onSupply) && (counts[kind] || 0) >= 2)) continue;
            // No free tile yet: it comes back once something else moves, so nothing waits for it.
            const step = { id: b.id, kind, tile: b.tile, evacuate: needsEmptying(b) };
            if (!hasDestination) step.noWait = true;
            if (r < RANK_REST) step.fast = true;
            return step;
        }
        if (short && r < RANK_REST) return null;
    }
    return null;
}

// How soon a structure out of place moves (the top of this file). s: plan, built, labsFirst, behind.
const RANK_TOWER = 1, RANK_SPAWN = 2, RANK_BEHIND = 3, RANK_LAB = 4, RANK_REST = 5;
function ranker(s) {
    const planned = new Map();
    for (const kind in s.plan.structures) for (const tile of s.plan.structures[kind]) planned.set(tile, kind);
    const supply = s.plan.flags && s.plan.flags.Supply;
    const coreSpawn = (s.plan.structures.spawn || [])[0];
    const coreStands = coreSpawn === undefined || s.built.some(b => b.kind === 'spawn' && b.tile === coreSpawn);
    return b => {
        if (b.kind === 'tower' || planned.get(b.tile) === 'tower' || (supply !== undefined && b.tile === supply)) return RANK_TOWER;
        if (!coreStands && (b.kind === 'spawn' || b.tile === coreSpawn)) return RANK_SPAWN;
        if (s.behind && b.kind !== 'container' && s.behind(b.tile)) return RANK_BEHIND;
        if (s.labsFirst && isLabWork(b, planned)) return RANK_LAB;
        return RANK_REST;
    };
}

// Is something more urgent than this step out of place?
function outranked(step, state) {
    const rank = ranker(state);
    const own = rank(step);
    if (own === RANK_TOWER) return false;
    const planned = new Map();
    for (const kind in state.plan.structures) for (const tile of state.plan.structures[kind]) planned.set(tile, kind);
    return state.built.some(b => MOVABLE.includes(b.kind) && planned.get(b.tile) !== b.kind && rank(b) < own &&
        !(state.holdLabs && isLabWork(b, planned)));
}

// ---------------------------------------------------------------- game side

function memoryFor(roomName) {
    if (!Memory.baseMigrate) Memory.baseMigrate = {};
    return Memory.baseMigrate[roomName] || (Memory.baseMigrate[roomName] = {});
}

const tileOf = pos => pos.x * 50 + pos.y;
// A lab's store has no total (getUsedCapacity() is null, and its labs were destroyed with what they
// held); its minerals are what matters, the energy goes with the ruin.
const used = obj => {
    if (!obj || !obj.store) return 0;
    if (obj.structureType === STRUCTURE_LAB) return Object.keys(obj.store).reduce((n, res) => n + (res === RESOURCE_ENERGY ? 0 : obj.store[res] || 0), 0);
    return obj.store.getUsedCapacity ? obj.store.getUsedCapacity() : 0;
};

function operatorTtl(room) {
    for (const name in Game.powerCreeps) {
        const pc = Game.powerCreeps[name];
        if (pc.room && pc.room.name === room.name && pc.memory && pc.memory.homeRoom === room.name) return pc.ticksToLive;
    }
    return undefined;
}

function gather(room, plan, kindOf) {
    const built = [];
    for (const structure of runtimeCache.find(room, FIND_STRUCTURES)) {
        const kind = structure.structureType === STRUCTURE_CONTAINER ? 'container' : kindOf[structure.structureType];
        if (!kind && structure.structureType !== STRUCTURE_ROAD && structure.structureType !== STRUCTURE_RAMPART) continue;
        if (kind && kind !== 'container' && !structure.my) continue;
        built.push({ id: structure.id, kind: kind || (structure.structureType === STRUCTURE_ROAD ? 'road' : 'rampart'),
            tile: tileOf(structure.pos), used: used(structure), spawning: !!structure.spawning });
    }
    const siteTiles = new Set();
    let roomSites = 0;
    for (const site of runtimeCache.find(room, FIND_MY_CONSTRUCTION_SITES)) {
        siteTiles.add(tileOf(site.pos));
        if (site.structureType !== STRUCTURE_ROAD && site.structureType !== STRUCTURE_RAMPART) roomSites++;
    }
    return {
        plan, built, siteTiles, roomSites,
        globalSites: Object.keys(Game.constructionSites).length,
        energy: room.storage ? room.storage.store[RESOURCE_ENERGY] || 0 : 0,
        storageFree: room.storage ? room.storage.store.getFreeCapacity() : 0,
        hostiles: runtimeCache.find(room, FIND_HOSTILE_CREEPS).length > 0,
        operatorTtl: operatorTtl(room),
    };
}

// Sites of movable kinds on tiles the plan does not want them: free to remove, and they would
// count against the RCL limit the replacements need.
function removeStraySites(room, plan, kindOf) {
    const planned = new Map();
    for (const kind in plan.structures) for (const tile of plan.structures[kind]) planned.set(tile, kind);
    for (const site of runtimeCache.find(room, FIND_MY_CONSTRUCTION_SITES)) {
        const kind = kindOf[site.structureType];
        if (kind && MOVABLE.includes(kind) && planned.get(tileOf(site.pos)) !== kind) site.remove();
    }
}

// Move layout flags onto their planned tiles once those are clear.
function moveFlags(room, plan) {
    const solid = new Set();
    let links = [];
    for (const structure of runtimeCache.find(room, FIND_STRUCTURES)) {
        if (structure.structureType === STRUCTURE_ROAD || structure.structureType === STRUCTURE_RAMPART) continue;
        solid.add(tileOf(structure.pos));
        if (structure.structureType === STRUCTURE_LINK) links.push(structure);
    }
    for (const name in plan.flags) {
        const flag = Game.flags[room.name + name];
        const tile = plan.flags[name];
        if (!flag || tileOf(flag.pos) === tile || solid.has(tile)) continue;
        const x = (tile / 50) | 0, y = tile % 50;
        let link;
        if (name === 'upgradeMiner') {
            // The miner hands energy to a link beside it: wait for the new one.
            link = links.find(l => Math.max(Math.abs(l.pos.x - x), Math.abs(l.pos.y - y)) === 1);
            if (!link) continue;
        }
        if (flag.setPosition(new RoomPosition(x, y, room.name)) !== OK) continue;
        for (const creep of runtimeCache.find(room, FIND_MY_CREEPS)) {
            const job = creep.memory.jobSpecific;
            if (!job || !(job === name || job === name + 'NearDeath')) continue;
            creep.memory.atSpot = false;
            creep.memory.ignoreTravel = false;
            if (link) creep.memory.linkSource = link.id;
        }
    }
    // Auto-build rooms with 3+ spawns only make suppliers in the spawn beside the Supply flag
    // (spawn.BuildCreeps5). While no spawn touches the (moved) flag the room stays out of that
    // list, so it never loses its supplier; it joins once the core spawn stands.
    const supply = Game.flags[room.name + 'Supply'];
    if (supply && plan.flags.Supply === tileOf(supply.pos)) {
        if (!Memory.autoBuildRooms) Memory.autoBuildRooms = [];
        const index = Memory.autoBuildRooms.indexOf(room.name);
        const spawnBeside = runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_SPAWN } })
            .some(spawn => spawn.pos.isNearTo(supply.pos));
        if (spawnBeside && index === -1) Memory.autoBuildRooms.push(room.name);
        if (!spawnBeside && index !== -1) Memory.autoBuildRooms.splice(index, 1);
    }
}

// Advance the room's current step. Cheap; runs every tick while a step is active.
function progress(room, mem, kindOf, rebuildNow) {
    const step = mem.step;
    const target = Game.getObjectById(step.id);
    if (step.phase === 'evacuate') {
        if (target && used(target) > evacuatedBelow(step.kind)) {
            if (step.kind === 'lab' && Game.time - step.t > LAB_EVACUATE_TIMEOUT) {
                // Fall through to the destroy: a lab's rest is not worth holding the move up.
            } else if (Game.time - step.t <= EVACUATE_TIMEOUT) {
                return;
            } else {
                console.log(`[migrate] ${room.name}: gave up emptying ${step.kind} at ${(step.tile / 50) | 0},${step.tile % 50}`);
                delete mem.step;
                mem.next = Game.time + 2000;
                return;
            }
        }
        step.phase = 'destroy';
    }
    if (step.phase === 'destroy') {
        if (target && target.destroy() !== OK) return;
        step.phase = 'rebuild';
        step.t = Game.time;
        rebuildNow(room.name);   // the replacement site goes down once the destroy has resolved
        if (step.noWait) {
            mem.next = Game.time + LAB_COOLDOWN;
            delete mem.step;
        }
        return;
    }
    // rebuild: done when the kind is back to its count before the move
    const type = Object.keys(kindOf).find(t => kindOf[t] === step.kind);
    const count = step.kind === 'container' ? step.before
        : runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: type } }).length;
    // Nothing being built, and the build passes have had their chance: its tile is refused for now (a
    // stray terminal still needs it for access). Waiting would hold up that terminal's own move.
    const noSite = Game.time - step.t >= SITE_GRACE && !runtimeCache.find(room, FIND_MY_CONSTRUCTION_SITES).some(s => s.structureType === type);
    if (count >= step.before || noSite || Game.time - step.t > REBUILD_TIMEOUT) {
        mem.next = Game.time + (step.fast ? LAB_COOLDOWN : ROOM_COOLDOWN);
        delete mem.step;
    }
}

/**
 * One room's migration pass. plan: the room's (target) plan from base.builder; kindOf:
 * structureType -> kind; rebuildNow(roomName): asks base.builder for a build pass next tick.
 * Returns true when it started or advanced a step.
 */
function runRoom(room, plan, kindOf, rebuildNow, canPlace, options = {}) {
    const mem = memoryFor(room.name);
    if (mem.step && mem.step.phase !== 'destroy' && Game.time % 10 === 0) {
        const state = gather(room, plan, kindOf);
        Object.assign(state, { labsFirst: options.labsFirst, holdLabs: options.holdLabs, behind: options.behind });
        if (outranked(mem.step, state)) {
            console.log('[migrate] ' + room.name + ': something more urgent first; ' + mem.step.kind + ' waits');
            delete mem.step;
        }
    }
    if (mem.step) {
        progress(room, mem, kindOf, rebuildNow);
        return true;
    }
    if (mem.done || Game.time < (mem.next || 0)) return false;
    mem.next = Game.time + PASS_INTERVAL;
    removeStraySites(room, plan, kindOf);
    moveFlags(room, plan);
    const state = gather(room, plan, kindOf);
    state.canPlace = canPlace;
    state.labsFirst = options.labsFirst;
    state.holdLabs = options.holdLabs;
    state.behind = options.behind;
    const step = chooseStep(state);
    if (!step) {
        if (state.misplaced === 0) {
            mem.done = Game.time;
            console.log(`[migrate] ${room.name}: on the automatic layout`);
        }
        return false;
    }
    const counts = state.built.filter(b => b.kind === step.kind).length;
    mem.step = { id: step.id, kind: step.kind, tile: step.tile, phase: step.evacuate ? 'evacuate' : 'destroy', t: Game.time, before: counts };
    if (step.noWait) mem.step.noWait = 1;
    if (step.fast) mem.step.fast = 1;
    console.log(`[migrate] ${room.name}: moving ${step.kind} from ${(step.tile / 50) | 0},${step.tile % 50}${step.evacuate ? ' (emptying it first)' : ''}`);
    if (!step.evacuate) progress(room, mem, kindOf, rebuildNow);
    return true;
}

// Structure the lab worker should empty into the storage (a step in its evacuate phase).
function evacuationTarget(roomName) {
    const mem = Memory.baseMigrate && Memory.baseMigrate[roomName];
    return mem && mem.step && mem.step.phase === 'evacuate' ? mem.step.id : undefined;
}

module.exports = { chooseStep, runRoom, evacuationTarget, ranker, outranked, progress, moveFlags, COST, MOVABLE };
