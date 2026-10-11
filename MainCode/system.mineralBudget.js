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
//
// Trade goods (deposit commodities: silicon, metal, biomass, mist and what factories make from
// them) are used by nothing here: system.market sells them first chance it gets, they are the
// first excess dumped when space is short, and with no market (the Seasonal World) they are
// dumped outright. Ops are used by nothing in storage or terminal (operators make their own) and
// are dumped whenever any lie there. Power and energy are never dumped.
//
// Terminal vs storage (terminalBalance): the terminal is a working buffer, TERMINAL_STOCK of each
// resource (two send batches) and TERMINAL_ENERGY energy for sends; the storage holds the rest,
// as long as that keeps it within its own budget. Terminals used to fill to 300k with the whole
// stockpile (the lab worker moved storage minerals in whenever there was room), and a full
// terminal cannot receive sends.
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
const NEVER = new Set([RESOURCE_ENERGY, RESOURCE_POWER]);
const TERMINAL_STOCK = 10000;
const TERMINAL_ENERGY = 75000;          // more than this goes to the storage
const TERMINAL_ENERGY_LOW = 20000;      // less than this is topped up from the storage
const TERMINAL_FREE_TARGET = 50000;   // top the terminal up from the storage only with this much room
const MIN_MOVE = 500;                 // not worth a trip below this

const RAW_DEPOSITS = () => new Set([RESOURCE_SILICON, RESOURCE_METAL, RESOURCE_BIOMASS, RESOURCE_MIST]);
// Deposit commodities: the raw ones and anything in the commodity chain (COMMODITIES entries with
// a level, and the level-0 ones made from raw deposits).
function tradeGood(resource) {
    if (RAW_DEPOSITS().has(resource)) return true;
    const c = typeof COMMODITIES !== 'undefined' && COMMODITIES[resource];
    if (!c) return false;
    if (c.level !== undefined) return true;
    return Object.keys(c.components || {}).some(r => RAW_DEPOSITS().has(r));
}
function disposable(resource) {
    return resource === RESOURCE_OPS || tradeGood(resource);
}

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
    if (disposable(resource)) {
        t = -1;   // dumped before anything else
    } else if (BASE.has(resource)) {
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
    if (disposable(resource)) return 0;
    const reserved = require('system.guardBoosts').reserved(room.name, resource);
    if (reserved) return Math.max(KEEP_USEFUL, reserved);
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

// Dumped without waiting for space: ops always; trade goods where nothing can sell them.
function disposeNow(resource) {
    if (resource === RESOURCE_OPS) return true;
    return tradeGood(resource) && !require('runtime.world').market();
}

// Excess to dump next: { from, resource, amount } or null.
function pick(room) {
    for (const s of [room.terminal, room.storage]) {
        if (!s) continue;
        for (const resource in s.store) {
            if ((s.store[resource] || 0) > 0 && disposeNow(resource)) return { from: s, resource, amount: s.store[resource], tier: -1 };
        }
    }
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

// Next move between terminal and storage, or null: { from, to, resource, amount }.
//   too much in the terminal (a resource above TERMINAL_STOCK, energy above TERMINAL_ENERGY):
//     the largest excess goes to the storage, within what keeps the storage in its budget
//   the terminal low on something the storage holds, and room in the terminal: top it up to
//     TERMINAL_STOCK (hysteresis: below half), energy to TERMINAL_ENERGY (below half)
// Trade goods stay in the terminal (that is where they are sold from) while there is a market;
// power stays in the storage (the power spawn is fed from there).
function terminalBalance(room) {
    const t = room.terminal, s = room.storage;
    if (!t || !s || t.my === false) return null;
    const market = require('runtime.world').market();
    const keep = res => (res === RESOURCE_ENERGY ? TERMINAL_ENERGY : tradeGood(res) && market ? Infinity : TERMINAL_STOCK);
    const storageRoom = res => res === RESOURCE_ENERGY
        ? free(s) - STORAGE_FREE_MIN
        : Math.min(free(s) - STORAGE_FREE_MIN, STORAGE_GOODS_CAP - goods(s.store));
    let best = null;
    for (const res in t.store) {
        const excess = (t.store[res] || 0) - keep(res);
        if (excess < MIN_MOVE) continue;
        const amount = Math.min(excess, storageRoom(res));
        if (amount >= MIN_MOVE && (!best || amount > best.amount)) best = { from: t, to: s, resource: res, amount };
    }
    if (best) return best;
    if (free(t) < TERMINAL_FREE_TARGET) return null;
    // Minerals first, energy last (and only up to TERMINAL_ENERGY_LOW + 10000: the distributor moves
    // terminal energy above 31k back to a storage under 250k, so a higher top-up would ping-pong).
    const order = Object.keys(s.store).filter(r => r !== RESOURCE_ENERGY).concat([RESOURCE_ENERGY]);
    for (const res of order) {
        if (res === RESOURCE_POWER || (tradeGood(res) && !market)) continue;
        const have = t.store[res] || 0;
        const low = res === RESOURCE_ENERGY ? TERMINAL_ENERGY_LOW : TERMINAL_STOCK / 2;
        const target = res === RESOURCE_ENERGY ? TERMINAL_ENERGY_LOW + 10000 : TERMINAL_STOCK;
        if (have >= low) continue;
        const amount = Math.min(s.store[res] || 0, target - have, free(t) - TERMINAL_FREE_TARGET / 2);
        if (amount >= MIN_MOVE) return { from: s, to: t, resource: res, amount };
    }
    return null;
}

module.exports = { pick, overflowing, markDumped, isDumped, tier, keepFloor, roomAmount, goods, terminalBalance, tradeGood, disposable,
    TERMINAL_STOCK, TERMINAL_ENERGY,
    STORAGE_FREE_MIN, STORAGE_GOODS_CAP, TERMINAL_FREE_MIN, KEEP_EACH };
