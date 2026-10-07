// system.mineralBudget — keep storage, terminal and factory from filling up with minerals.
//
// A room whose storage is full of assorted minerals cannot bank energy, and its haulers end up
// shuffling goods between full containers (the terminal-overflow cleanup moved minerals to a full
// storage and back). Each room therefore keeps:
//   storage   at least STORAGE_FREE_MIN free, and at most STORAGE_GOODS_CAP of non-energy goods
//   terminal  at least TERMINAL_FREE_MIN free, unless the storage can take the overflow
//   factory   at least FACTORY_FREE_MIN free, unless the storage or terminal can take it
// Anything above that with no use is excess. The lab worker dumps it on the floor next to where
// it stands, a load at a time, and the pile decays. Cheapest first: base minerals, then factory
// goods, then compounds by reaction depth, T3 boosts last. Per resource it never goes below a
// floor (room total, storage + terminal): KEEP_EACH, more for this room's reaction inputs, its
// boost lab minerals and ghodium (nuker). Power, ops and energy are never dumped.
//
// Dumped resource types are remembered per room for DUMP_TTL ticks so salvagers/scrapers leave
// those piles alone (and salvagers aren't spawned for them).
const labPlanner = require('system.labs');

const STORAGE_FREE_MIN = 100000;
const STORAGE_GOODS_CAP = 300000;
const TERMINAL_FREE_MIN = 30000;
const FACTORY_FREE_MIN = 5000;
const KEEP_EACH = 10000;
const KEEP_USEFUL = 30000;     // this room's reaction inputs, boost lab minerals, ghodium
const DUMP_TTL = 3000;
const BASE = new Set([RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM, RESOURCE_LEMERGIUM,
    RESOURCE_KEANIUM, RESOURCE_ZYNTHIUM, RESOURCE_CATALYST]);
const NEVER = new Set([RESOURCE_ENERGY, RESOURCE_POWER, RESOURCE_OPS]);

function goods(store) {
    if (!store) return 0;
    let total = 0;
    for (const res in store) if (res !== RESOURCE_ENERGY) total += store[res] || 0;
    return total;
}

// Reaction depth: 0 base minerals, 1 factory goods and anything else, 2+ compounds (T3 highest).
const tiers = Object.create(null);
function tier(resource) {
    if (tiers[resource] !== undefined) return tiers[resource];
    let t;
    if (BASE.has(resource)) {
        t = 0;
    } else {
        const recipe = labPlanner.recipeOf(resource);
        t = recipe ? 1 + Math.max(tier(recipe[0]), tier(recipe[1])) : 1;
        if (recipe && t < 2) t = 2;
    }
    tiers[resource] = t;
    return t;
}

function keepFloor(room, resource) {
    const job = labPlanner.jobFor(room.name);
    if (job && (job.a === resource || job.b === resource)) return KEEP_USEFUL;
    const config = Memory.roomConfigs && Memory.roomConfigs[room.name] && Memory.roomConfigs[room.name].mineralConfig;
    if (config && (config.min1 === resource || config.min2 === resource || config.min3 === resource)) return KEEP_USEFUL;
    if (resource === RESOURCE_GHODIUM) return KEEP_USEFUL;
    return KEEP_EACH;
}

function free(structure) {
    return structure ? structure.store.getFreeCapacity() : 0;
}

// Over budget? Which structure to take excess from, or null.
function overflowing(room) {
    const storage = room.storage;
    const terminal = room.terminal;
    const factory = factoryOf(room);
    const storageOver = !!storage && (free(storage) < STORAGE_FREE_MIN || goods(storage.store) > STORAGE_GOODS_CAP);
    // A full terminal/factory is only a problem when the storage cannot absorb it.
    if (storageOver) return storage;
    if (terminal && free(terminal) < TERMINAL_FREE_MIN && (!storage || free(storage) < STORAGE_FREE_MIN)) return terminal;
    if (factory && free(factory) < FACTORY_FREE_MIN && (!storage || free(storage) < STORAGE_FREE_MIN) &&
        (!terminal || free(terminal) < TERMINAL_FREE_MIN)) return factory;
    return null;
}

function factoryOf(room) {
    const ids = Memory.factoryList && Memory.factoryList[room.name];
    return ids && ids.length ? Game.getObjectById(ids[0]) : null;
}

// Excess to dump next: { from, resource, amount } or null.
function pick(room) {
    const from = overflowing(room);
    if (!from) return null;
    const totals = {};
    for (const s of [room.storage, room.terminal]) {
        if (!s) continue;
        for (const res in s.store) totals[res] = (totals[res] || 0) + (s.store[res] || 0);
    }
    let best = null;
    for (const resource in from.store) {
        const here = from.store[resource] || 0;
        if (NEVER.has(resource) || here <= 0) continue;
        const spare = Math.min(here, (totals[resource] || here) - keepFloor(room, resource));
        if (spare <= 0) continue;
        const t = tier(resource);
        if (!best || t < best.tier || (t === best.tier && spare > best.amount)) best = { from, resource, amount: spare, tier: t };
    }
    return best;
}

function markDumped(roomName, resource) {
    if (!Memory.mineralDump) Memory.mineralDump = {};
    if (!Memory.mineralDump[roomName]) Memory.mineralDump[roomName] = {};
    Memory.mineralDump[roomName][resource] = Game.time + DUMP_TTL;
}

// Was this resource type dumped here recently? (Piles to leave alone.)
function isDumped(roomName, resource) {
    const marks = Memory.mineralDump && Memory.mineralDump[roomName];
    if (!marks || !marks[resource]) return false;
    if (marks[resource] < Game.time) {
        delete marks[resource];
        return false;
    }
    return true;
}

// Room total of a resource across storage and terminal.
function roomAmount(room, resource) {
    return ((room.storage && room.storage.store[resource]) || 0) + ((room.terminal && room.terminal.store[resource]) || 0);
}

module.exports = { pick, overflowing, markDumped, isDumped, tier, keepFloor, roomAmount, goods,
    STORAGE_FREE_MIN, STORAGE_GOODS_CAP, TERMINAL_FREE_MIN, KEEP_EACH };
