// system.mineralBuy — buy base minerals the boost labs need when stocks run critically low.
//
// Runs with the market (system.market, every 100 ticks; not on the Seasonal World), per shard: a
// shard's labs only use what its own terminals hold.
//   Demand: every boost short of its lab target (system.labs targets: combat boosts, and the
//     repair/upgrade ones once every combat boost is met) is expanded down its recipe tree, drawing
//     on what is in stock at each step (T3, T2, T1 compounds first). What is left at the bottom is
//     the base minerals still missing (H, O, U, L, K, Z, X; every reaction is 1:1:1).
//   Buy: a base mineral that is missing AND below CRITICAL_PER_ROOM x lab rooms is bought up to
//     REFILL_PER_ROOM x lab rooms (never more than is missing).
//   Fair price: never above FAIR_CEILING x the volume-weighted average of the market history (the
//     last ~14 days), and only with MIN_HISTORY_VOLUME traded in that window, so a thin or
//     spoofed market is left alone. Cheapest asks first, up to MAX_DEALS deals and SPEND_SHARE of
//     the credits above CREDIT_RESERVE per run.
// Memory.mineralBuys: the last 20 purchases { t, r, n, p, room }.
const CRITICAL_PER_ROOM = 3000;
const REFILL_PER_ROOM = 10000;
const FAIR_CEILING = 1.1;
const MIN_HISTORY_VOLUME = 20000;
const MIN_LOT = 500;
const MAX_DEALS = 3;
const SPEND_SHARE = 0.25;
const CREDIT_RESERVE = 5000;
const TERMINAL_ENERGY_RESERVE = 10000;
const HISTORY_TTL = 1000;

const BASE = () => [RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM, RESOURCE_LEMERGIUM,
    RESOURCE_KEANIUM, RESOURCE_ZYNTHIUM, RESOURCE_CATALYST];

const historyCache = {};   // heap: resource -> { at, avg, volume }

// Volume-weighted average price and total volume of the market history.
function history(resource) {
    const cached = historyCache[resource];
    if (cached && Game.time - cached.at < HISTORY_TTL) return cached;
    let volume = 0, value = 0;
    try {
        for (const day of Game.market.getHistory(resource) || []) {
            volume += day.volume;
            value += day.avgPrice * day.volume;
        }
    } catch (e) { volume = 0; }
    return (historyCache[resource] = { at: Game.time, avg: volume > 0 ? value / volume : undefined, volume });
}

// Highest price we pay now, or undefined (no reliable history).
function fairCeiling(resource) {
    const h = history(resource);
    if (!h.avg || h.volume < MIN_HISTORY_VOLUME) return undefined;
    return h.avg * FAIR_CEILING;
}

// Base minerals missing to make every boost short of its target: { mineral: amount }.
function missingBase(stock, goal) {
    const labs = require('system.labs');
    const left = Object.assign({}, stock);
    const need = {};
    const base = new Set(BASE());
    const expand = (product, qty) => {
        const have = Math.min(left[product] || 0, qty);
        left[product] = (left[product] || 0) - have;
        qty -= have;
        if (qty <= 0) return;
        if (base.has(product)) { need[product] = (need[product] || 0) + qty; return; }
        const recipe = labs.recipeOf(product);
        if (!recipe) return;
        expand(recipe[0], qty);
        expand(recipe[1], qty);
    };
    const short = res => (goal[res] || 0) > (stock[res] || 0);
    const combat = [...labs.COMBAT];
    const order = combat.concat(combat.some(short) ? [] : [...labs.AFTER_COMBAT]);
    // The whole target: expand() draws the boost's own stock first (once).
    for (const res of order) if (short(res)) expand(res, goal[res]);
    return need;
}

// What to buy now: [{ resource, amount }], most missing first.
function wants(stock, goal, labRooms) {
    const need = missingBase(stock, goal);
    const out = [];
    for (const res of BASE()) {
        const have = stock[res] || 0;
        if (!need[res] || have >= CRITICAL_PER_ROOM * labRooms) continue;
        const amount = Math.min(need[res], REFILL_PER_ROOM * labRooms - have);
        if (amount >= MIN_LOT) out.push({ resource: res, amount });
    }
    return out.sort((a, b) => b.amount - a.amount);
}

// The terminal that receives a purchase: a lab room's, off cooldown, with room and energy.
function receiver(rooms, amount) {
    let best;
    for (const room of rooms) {
        const t = room.terminal;
        if (!t || t.cooldown || (t.store[RESOURCE_ENERGY] || 0) < TERMINAL_ENERGY_RESERVE) continue;
        if (t.store.getFreeCapacity() < Math.min(amount, MIN_LOT)) continue;
        if (!best || t.store.getFreeCapacity() > best.terminal.store.getFreeCapacity()) best = room;
    }
    return best;
}

function log(entry) {
    const list = Memory.mineralBuys || (Memory.mineralBuys = []);
    list.push(entry);
    if (list.length > 20) list.splice(0, list.length - 20);
}

function run() {
    if (!require('runtime.world').market()) return 0;
    const labs = require('system.labs');
    const market = require('system.market');
    const rooms = labs.labRooms();
    if (!rooms.length) return 0;
    const stock = labs.empireStock();
    const goal = labs.targets(rooms.length);
    let budget = Math.max(0, (Game.market.credits - CREDIT_RESERVE) * SPEND_SHARE);
    let deals = 0;
    const used = new Set();
    for (const want of wants(stock, goal, rooms.length)) {
        if (deals >= MAX_DEALS || budget <= 0) break;
        const ceiling = fairCeiling(want.resource);
        if (ceiling === undefined) continue;
        const asks = market.competitors(want.resource, ORDER_SELL, 1).filter(o => o.price <= ceiling)
            .sort((a, b) => a.price - b.price);
        let remaining = want.amount;
        for (const ask of asks) {
            if (deals >= MAX_DEALS || remaining < MIN_LOT || budget <= 0) break;
            const room = receiver(rooms.filter(r => !used.has(r.name)), remaining);
            if (!room) break;
            let qty = Math.min(remaining, ask.amount, Math.floor(budget / ask.price), room.terminal.store.getFreeCapacity());
            const energy = (room.terminal.store[RESOURCE_ENERGY] || 0) - TERMINAL_ENERGY_RESERVE;
            const cost = require('runtime.world').transactionCost(qty, room.name, ask.roomName);
            if (cost > energy) qty = Math.floor(qty * Math.max(0, energy) / cost);
            if (qty < Math.min(MIN_LOT, ask.amount)) continue;
            if (Game.market.deal(ask.id, qty, room.name) !== OK) continue;
            deals++;
            used.add(room.name);   // one deal per terminal per run (cooldown)
            remaining -= qty;
            budget -= qty * ask.price;
            log({ t: Game.time, r: want.resource, n: qty, p: ask.price, room: room.name });
            console.log('[market] bought ' + qty + ' ' + want.resource + ' at ' + ask.price + ' (fair up to ' +
                ceiling.toFixed(3) + ') into ' + room.name + ' for the boost labs');
        }
    }
    return deals;
}

module.exports = { run, wants, missingBase, fairCeiling, receiver, history, CRITICAL_PER_ROOM, REFILL_PER_ROOM, FAIR_CEILING, MIN_HISTORY_VOLUME };
