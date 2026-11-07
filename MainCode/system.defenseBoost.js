// system.defenseBoost — XKHO2 (T3 ranged attack, x4 damage) on hand in rooms still building up.
//
// Rooms with a full lab set make and stock boosts (system.labs, the lab worker). A room with a
// terminal below RCL8 had no lab at all (base.builder kept labs back for the controller), so its
// defenders always fought unboosted: shardX W1N9 against healer quads its towers and defenders could
// not out-damage. Now such a room builds one boost lab (base.builder, EARLY_LABS) and:
//   - supply(), with the market every 100 ticks: tops its XKHO2 up to READY (terminal, storage, lab).
//     From another room of ours on the shard that keeps READY itself after sending; when none can,
//     bought: the cheapest asks within FAIR_CEILING x the market's volume-weighted average, with at
//     least MIN_HISTORY_VOLUME traded (system.mineralBuy.history), a deal per run, and at most
//     SPEND_SHARE of the credits above the floor (it once spent 27M on shardX, near all there was).
//   - loadLab(creep): its distributors keep the lab at LAB_FILL XKHO2 and LAB_ENERGY energy (no lab
//     worker for one lab), emptying any other mineral first. creep.combat boosts from it.
// Memory.mineralBuys logs the purchases with the base mineral ones.
//
// Any ranged tier counts (defense.rangedBoost): XKHO2, KHO2 (x3), KO (x2, invaders drop it). Stock is
// the tiers together; donors send their best tier first; buying takes the tier whose extra damage is
// cheapest (price / (multiplier - 1)) within its fair ceiling, so dear XKHO2 loses to cheap KHO2 or KO.
//
// rescue(), every 10 ticks: a room of ours under attack by a player (any lab count) and below READY
// gets ranged boosts by terminal from our rooms not under attack, each keeping DONOR_KEEP; with none to
// spare, bought as above. The labs in a full lab room only make XKHO2 over time, and the fight is now.
const runtimeCache = require('runtime.cache');
const rangedBoost = require('defense.rangedBoost');

const READY = 3000;             // enough for five 20-ranged defenders (30 a part)
const LAB_FILL = 1500;
const LAB_ENERGY = 1000;
const MAX_LABS = 2;             // with 3+ labs the lab worker runs them (spawn.BuildCreeps5 labWorkerMax)
const FAIR_CEILING = 1.2;
const MIN_HISTORY_VOLUME = 2000;
const MIN_LOT = 100;
const TERMINAL_ENERGY_RESERVE = 2000;
const SPEND_SHARE = 0.1;         // of the credits above system.market.SPEND_FLOOR, per deal
const DONOR_KEEP = 1000;          // a donor's own reserve, all tiers, when sending to a room under attack

function labs(room) {
    return runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LAB } });
}

// A room that keeps its own XKHO2: ours, a terminal, below a full lab set, not retiring or bait.
function wantsBoost(room) {
    if (!room || !room.controller || !room.controller.my || !room.terminal) return false;
    if (require('system.retire').retiring(room.name) || require('system.bait').isBait(room.name)) return false;
    return labs(room).length <= MAX_LABS;
}

// Its boost lab (the first one), or null.
function boostLab(room) {
    if (!wantsBoost(room)) return null;
    return labs(room)[0] || null;
}

function ownRooms() {
    return Object.values(Game.rooms).filter(r => r.controller && r.controller.my && r.terminal);
}

function supply() {
    fill(ownRooms().filter(wantsBoost), new Set(), () => READY);
}

// A player in the room and the attack flag on it.
function underAttack(room) {
    if (!(Memory.roomsUnderAttack || []).includes(room.name)) return false;
    return !!require('combat.intel').roomIntel(room).players;
}
function rescue() {
    const rooms = ownRooms();
    const hit = rooms.filter(underAttack);
    // Rooms the supply keeps stocked keep READY themselves; full lab rooms make more, DONOR_KEEP.
    if (hit.length) fill(hit, new Set(hit.map(r => r.name)), r => (wantsBoost(r) ? READY : DONOR_KEEP));
}

// Tops each room up to READY (all tiers): from a room of ours first, else bought (one deal a run).
// banned: rooms that never donate (under attack themselves); keepFor(donor): its floor after sending.
function fill(targets, banned, keepFor) {
    const rooms = ownRooms();
    const sent = new Set();
    let bought = false;
    for (const room of targets) {
        const need = READY - rangedBoost.totalStock(room);
        if (need < MIN_LOT) continue;
        if (give(room, need, rooms, sent, banned, keepFor)) continue;
        if (bought || !require('runtime.world').market()) continue;
        bought = buy(room, need);
    }
}

// One send, best tier first, from a room that keeps its floor (keepFor) afterwards.
function give(room, need, rooms, sent, banned, keepFor) {
    for (const t of rangedBoost.tiers()) {
        for (const donor of rooms) {
            if (donor === room || sent.has(donor.name) || banned.has(donor.name) || donor.terminal.cooldown) continue;
            const spare = Math.min(donor.terminal.store[t.res] || 0, rangedBoost.totalStock(donor) - keepFor(donor));
            const n = Math.min(need, spare);
            if (n < MIN_LOT) continue;
            if (donor.terminal.send(t.res, n, room.name, t.res + ' for ' + room.name + ' defenders') !== OK) continue;
            sent.add(donor.name);
            return true;
        }
    }
    return false;
}

// Buy for one room: the tier with the cheapest extra damage, within its fair ceiling. True when a deal
// went through.
function buy(room, need) {
    const t = room.terminal;
    if (t.cooldown) return false;
    const budget = (Game.market.credits - require('system.market').SPEND_FLOOR) * SPEND_SHARE;
    if (budget <= 0) return false;
    const asks = [];
    for (const tier of rangedBoost.tiers()) {
        const h = require('system.mineralBuy').history(tier.res);
        if (!h.avg || h.volume < MIN_HISTORY_VOLUME) continue;
        const ceiling = h.avg * FAIR_CEILING;
        for (const o of require('system.market').competitors(tier.res, ORDER_SELL, 1)) {
            if (o.price <= ceiling) asks.push({ o, res: tier.res, ceiling, per: o.price / (tier.mult - 1) });
        }
    }
    asks.sort((a, b) => a.per - b.per);
    for (const { o: ask, res, ceiling } of asks) {
        let qty = Math.min(need, ask.amount, Math.floor(budget / ask.price), t.store.getFreeCapacity());
        const energy = (t.store[RESOURCE_ENERGY] || 0) - TERMINAL_ENERGY_RESERVE;
        const cost = require('runtime.world').transactionCost(qty, room.name, ask.roomName);
        if (cost > energy) qty = Math.floor(qty * Math.max(0, energy) / Math.max(1, cost));
        if (qty < Math.min(MIN_LOT, ask.amount)) continue;
        if (Game.market.deal(ask.id, qty, room.name) !== OK) continue;
        const list = Memory.mineralBuys || (Memory.mineralBuys = []);
        list.push({ t: Game.time, r: res, n: qty, p: ask.price, room: room.name });
        if (list.length > 20) list.splice(0, list.length - 20);
        console.log('[market] bought ' + qty + ' ' + res + ' at ' + ask.price + ' (fair up to ' + ceiling.toFixed(3) + ') into ' + room.name + ' for its defenders');
        return true;
    }
    return false;
}

// A distributor's turn at the boost lab: true when it acted. Loads (memory.boostLoad) are carried
// to the lab, or back to the terminal when the lab cannot take them.
function loadLab(creep) {
    const room = creep.room;
    if (room.name !== (creep.memory.homeRoom || room.name)) return false;
    const lab = boostLab(room);
    const terminal = room.terminal;
    const res = rangedBoost.forRoom(room);
    const carrying = Object.keys(creep.store).find(r => creep.store[r] > 0);
    const go = (target, act) => { if (act() === ERR_NOT_IN_RANGE) creep.travelTo(target, { range: 1, maxRooms: 1 }); return true; };
    if (creep.memory.boostLoad) {
        if (!carrying) { delete creep.memory.boostLoad; return false; }
        const into = lab && ((carrying === res && (!lab.mineralType || lab.mineralType === res) && lab.store.getFreeCapacity(res) > 0) ||
            (carrying === RESOURCE_ENERGY && lab.store.getFreeCapacity(RESOURCE_ENERGY) > 0)) ? lab : terminal;
        if (!into) { delete creep.memory.boostLoad; return false; }
        return go(into, () => creep.transfer(into, carrying));
    }
    if (!lab || !terminal || carrying) return false;
    const free = creep.store.getFreeCapacity();
    if (lab.mineralType && lab.mineralType !== res) {
        creep.memory.boostLoad = lab.mineralType;
        return go(lab, () => creep.withdraw(lab, lab.mineralType));
    }
    const short = LAB_FILL - ((lab.store && lab.store[res]) || 0);
    if (short >= 100 && (terminal.store[res] || 0) >= 100) {
        creep.memory.boostLoad = res;
        return go(terminal, () => creep.withdraw(terminal, res, Math.min(free, short, terminal.store[res])));
    }
    const energyShort = LAB_ENERGY - ((lab.store && lab.store[RESOURCE_ENERGY]) || 0);
    const source = require('creep.logistics').homeEnergy(room, 100);
    if (energyShort >= 100 && source && room.energyAvailable >= room.energyCapacityAvailable) {
        creep.memory.boostLoad = RESOURCE_ENERGY;
        return go(source, () => creep.withdraw(source, RESOURCE_ENERGY, Math.min(free, energyShort, source.store[RESOURCE_ENERGY])));
    }
    return false;
}

module.exports = { supply, rescue, loadLab, boostLab, wantsBoost, READY, LAB_FILL, MAX_LABS, DONOR_KEEP };
