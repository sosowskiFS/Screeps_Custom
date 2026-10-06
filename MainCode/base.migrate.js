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
//   4. wait until the replacement is built, then a cooldown before the next step
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
// Layout flags (Supply, storageMiner, upgradeMiner) move once their planned tile is clear (the
// upgrade miner's once its new link is built); miners walk to the new spot.
//
// Memory.baseMigrate[room] = { step: { id, kind, tile, phase, t, before }, next, done }
const runtimeCache = require('runtime.cache');

const PASS_INTERVAL = 100;      // ticks between looks for a new step in a room
const ROOM_COOLDOWN = 300;      // after a replacement is finished
const START_GAP = 20;           // empire-wide: ticks between two steps starting
const EVACUATE_TIMEOUT = 3000;
const REBUILD_TIMEOUT = 10000;
const SITE_HEADROOM = 90;
// Leftovers below this stay in the ruin (salvagers pick them up). Terminals keep receiving
// deliveries while being emptied, so they get a looser bar.
const EVACUATED = { lab: 500, terminal: 3000, factory: 3000 };
const evacuatedBelow = kind => EVACUATED[kind] || 500;
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
 * Returns { id, kind, tile, evacuate } or null; s.misplaced is set to how many are left.
 */
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

    const freeTileFor = kind => (s.plan.structures[kind] || []).some(t => !solid.has(t) && !s.siteTiles.has(t));
    const isBlocker = b => (planned.has(b.tile) && planned.get(b.tile) !== b.kind) || mustBeClear.has(b.tile);
    misplaced.sort((a, b) => (isBlocker(b) - isBlocker(a)) || MOVABLE.indexOf(a.kind) - MOVABLE.indexOf(b.kind));

    for (const b of misplaced) {
        const kind = b.kind;
        if (kind === 'container') return { id: b.id, kind, tile: b.tile, evacuate: false };
        if (s.energy < COST[kind] * 2 + 30000) continue;
        if (IMPORTANT.has(kind) && s.roomSites > 0) continue;
        if (kind === 'spawn' && ((counts.spawn || 0) < 2 || b.spawning)) continue;
        if (kind === 'tower' && (counts.tower || 0) - 1 < MIN_TOWERS_LEFT) continue;
        if (kind === 'powerSpawn' && s.operatorTtl !== undefined && s.operatorTtl < OPERATOR_TTL) continue;
        if ((kind === 'terminal' || kind === 'factory') && s.storageFree < (b.used || 0) + 50000) continue;
        const hasDestination = freeTileFor(kind);
        if (!hasDestination && !(isBlocker(b) && EXPENDABLE.has(kind) && (counts[kind] || 0) >= 2)) continue;
        return { id: b.id, kind, tile: b.tile, evacuate: EVACUATE.has(kind) && (b.used || 0) > evacuatedBelow(kind) };
    }
    return null;
}

// ---------------------------------------------------------------- game side

function memoryFor(roomName) {
    if (!Memory.baseMigrate) Memory.baseMigrate = {};
    return Memory.baseMigrate[roomName] || (Memory.baseMigrate[roomName] = {});
}

const tileOf = pos => pos.x * 50 + pos.y;
const used = obj => (obj && obj.store && obj.store.getUsedCapacity ? obj.store.getUsedCapacity() : 0);

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
            if (Game.time - step.t > EVACUATE_TIMEOUT) {
                console.log(`[migrate] ${room.name}: gave up emptying ${step.kind} at ${(step.tile / 50) | 0},${step.tile % 50}`);
                delete mem.step;
                mem.next = Game.time + 2000;
            }
            return;
        }
        step.phase = 'destroy';
    }
    if (step.phase === 'destroy') {
        if (target && target.destroy() !== OK) return;
        step.phase = 'rebuild';
        step.t = Game.time;
        rebuildNow(room.name);   // the replacement site goes down once the destroy has resolved
        return;
    }
    // rebuild: done when the kind is back to its count before the move
    const type = Object.keys(kindOf).find(t => kindOf[t] === step.kind);
    const count = step.kind === 'container' ? step.before
        : runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: type } }).length;
    if (count >= step.before || Game.time - step.t > REBUILD_TIMEOUT) {
        delete mem.step;
        mem.next = Game.time + ROOM_COOLDOWN;
    }
}

/**
 * One room's migration pass. plan: the room's (target) plan from base.builder; kindOf:
 * structureType -> kind; rebuildNow(roomName): asks base.builder for a build pass next tick.
 * Returns true when it started or advanced a step.
 */
function runRoom(room, plan, kindOf, rebuildNow) {
    const mem = memoryFor(room.name);
    if (mem.step) {
        progress(room, mem, kindOf, rebuildNow);
        return true;
    }
    if (mem.done || Game.time < (mem.next || 0)) return false;
    mem.next = Game.time + PASS_INTERVAL;
    removeStraySites(room, plan, kindOf);
    moveFlags(room, plan);
    if (Memory.baseMigrateLast && Game.time - Memory.baseMigrateLast < START_GAP) return false;

    const state = gather(room, plan, kindOf);
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
    Memory.baseMigrateLast = Game.time;
    console.log(`[migrate] ${room.name}: moving ${step.kind} from ${(step.tile / 50) | 0},${step.tile % 50}${step.evacuate ? ' (emptying it first)' : ''}`);
    if (!step.evacuate) progress(room, mem, kindOf, rebuildNow);
    return true;
}

// Structure the lab worker should empty into the storage (a step in its evacuate phase).
function evacuationTarget(roomName) {
    const mem = Memory.baseMigrate && Memory.baseMigrate[roomName];
    return mem && mem.step && mem.step.phase === 'evacuate' ? mem.step.id : undefined;
}

module.exports = { chooseStep, runRoom, evacuationTarget, progress, moveFlags, COST, MOVABLE };
