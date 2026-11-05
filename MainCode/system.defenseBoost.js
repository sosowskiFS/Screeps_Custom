// system.defenseBoost — XKHO2 (T3 ranged attack, x4 damage) on hand in rooms still building up.
//
// Rooms with a full lab set make and stock boosts (system.labs, the lab worker). A room with a
// terminal below RCL8 had no lab at all (base.builder kept labs back for the controller), so its
// defenders always fought unboosted: shardX W1N9 against healer quads its towers and defenders could
// not out-damage. Now such a room builds one boost lab (base.builder, EARLY_LABS) and:
//   - supply(), with the market every 100 ticks: tops its XKHO2 up to READY (terminal, storage, lab).
//     From another room of ours on the shard that keeps READY itself after sending; when none can,
//     bought: the cheapest asks within FAIR_CEILING x the market's volume-weighted average, with at
//     least MIN_HISTORY_VOLUME traded (system.mineralBuy.history), a deal per run.
//   - loadLab(creep): its distributors keep the lab at LAB_FILL XKHO2 and LAB_ENERGY energy (no lab
//     worker for one lab), emptying any other mineral first. creep.combat boosts from it.
// Memory.mineralBuys logs the purchases with the base mineral ones.
const runtimeCache = require('runtime.cache');

const READY = 3000;             // enough for five 20-ranged defenders (30 a part)
const LAB_FILL = 1500;
const LAB_ENERGY = 1000;
const MAX_LABS = 2;             // with 3+ labs the lab worker runs them (spawn.BuildCreeps5 labWorkerMax)
const FAIR_CEILING = 1.2;
const MIN_HISTORY_VOLUME = 2000;
const MIN_LOT = 100;
const TERMINAL_ENERGY_RESERVE = 2000;
const BOOST = () => RESOURCE_CATALYZED_KEANIUM_ALKALIDE;

function stockOf(room, res) {
    let n = 0;
    for (const s of [room.storage, room.terminal]) if (s && s.store) n += s.store[res] || 0;
    for (const lab of labs(room)) n += (lab.store && lab.store[res]) || 0;
    return n;
}
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
    const res = BOOST();
    const rooms = ownRooms();
    const sent = new Set();
    let bought = false;
    for (const room of rooms.filter(wantsBoost)) {
        const need = READY - stockOf(room, res);
        if (need < MIN_LOT) continue;
        // A room of ours that keeps READY after sending (lab rooms make it).
        const donor = rooms.find(r => r !== room && !sent.has(r.name) && !r.terminal.cooldown &&
            (r.terminal.store[res] || 0) >= need && stockOf(r, res) - need >= READY);
        if (donor) {
            if (donor.terminal.send(res, need, room.name, 'XKHO2 for ' + room.name + ' defenders') === OK) sent.add(donor.name);
            continue;
        }
        if (bought || !require('runtime.world').market()) continue;
        bought = buy(room, res, need);
    }
}

// Buy for one room within the fair ceiling. True when a deal went through.
function buy(room, res, need) {
    const h = require('system.mineralBuy').history(res);
    if (!h.avg || h.volume < MIN_HISTORY_VOLUME) return false;
    const ceiling = h.avg * FAIR_CEILING;
    const t = room.terminal;
    if (t.cooldown) return false;
    const asks = require('system.market').competitors(res, ORDER_SELL, 1).filter(o => o.price <= ceiling).sort((a, b) => a.price - b.price);
    for (const ask of asks) {
        let qty = Math.min(need, ask.amount, Math.floor((Game.market.credits - 5000) / ask.price), t.store.getFreeCapacity());
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
    const res = BOOST();
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

module.exports = { supply, loadLab, boostLab, wantsBoost, READY, LAB_FILL, MAX_LABS };
