// system.retire — one-time retirement of the least energy-efficient rooms (frees CPU for shardX).
//
// 1. Measure (automatic on shards listed in KEEP): every SAMPLE_EVERY ticks for MEASURE_TICKS,
//    each visible room's event log is read; energy harvested from sources is credited to the
//    harvesting creep's home room (remote mining included), and each home's CPU average
//    (runtime.roomCpu) is sampled. Efficiency = energy per tick / CPU per tick.
// 2. retireRooms() in the console: progress, then the plan (dry run). Worst rooms first until
//    KEEP[shard] remain, but never the last room on the shard holding one of the 7 base
//    minerals, so every compound can still be made and sold. Rooms without data are kept.
// 3. retireRooms('confirm') starts it; retireRooms('cancel') stops rooms not yet unclaimed.
//    A retiring room:
//      - spawns only its essentials (refill/supplier/miner) plus one drain hauler, which moves
//        storage and factory contents into the terminal; no remote mining, no flag commands, no
//        expansion sponsorship, no terminal requests or sales
//      - its terminal ships everything to the nearest kept room on the shard (minerals and other
//        goods first, energy last, transfer costs paid from the energy)
//      - once storage, terminal and factory are (nearly) empty, or after DRAIN_TIMEOUT: its
//        market orders are cancelled, the controller is unclaimed, its creeps and flags removed
//        and its Memory entries cleaned up. Structures stay standing.
//
// Memory.retire = { start, n: samples, e: { room: energy }, c: { room: cpu },
//                   rooms: { room: { st: 'drain'|'done', t } } }
const roomCpu = require('runtime.roomCpu');

const KEEP = { shard1: 7, shard2: 25 };
const BASE_MINERALS = ['H', 'O', 'U', 'L', 'K', 'Z', 'X'];
const SAMPLE_EVERY = 10;
const MEASURE_TICKS = 5000;
const MIN_SAMPLES = 100;            // per room, before it can be ranked
const LEFTOVER = 5000;              // storage + terminal + factory below this: drained
const DRAIN_TIMEOUT = 30000;
const TARGET_FREE = 20000;          // a receiving terminal needs this much room
const MIN_SEND = 100;

function state() {
    return Memory.retire;
}

function keepCount() {
    return KEEP[Game.shard.name];
}

function retiring(roomName) {
    const s = Memory.retire;
    return !!(s && s.rooms && s.rooms[roomName] && s.rooms[roomName].st === 'drain');
}

function ownedRooms() {
    const out = [];
    for (const name in Game.rooms) {
        const room = Game.rooms[name];
        if (room.controller && room.controller.my && room.find(FIND_MY_SPAWNS).length) out.push(room);
    }
    return out;
}

// ---------------------------------------------------------------- measurement

function measuring() {
    const s = state();
    return !!(s && s.start !== undefined && Game.time - s.start < MEASURE_TICKS);
}

function sample() {
    if (!keepCount()) return;
    if (!Memory.retire) Memory.retire = { start: Game.time, n: 0, e: {}, c: {}, rooms: {} };
    const s = state();
    if (!measuring() || (Game.time - s.start) % SAMPLE_EVERY !== 0) return;
    const homes = new Set(ownedRooms().map(r => r.name));
    for (const name in Game.rooms) {
        let log;
        try {
            log = Game.rooms[name].getEventLog();
        } catch (e) {
            continue;
        }
        for (const entry of log) {
            if (entry.event !== EVENT_HARVEST || !entry.data) continue;
            const target = Game.getObjectById(entry.data.targetId);
            if (!target || target.mineralType || target.depositType) continue;   // sources only
            const creep = Game.getObjectById(entry.objectId);
            const home = creep && creep.memory && creep.memory.homeRoom;
            if (home && homes.has(home)) s.e[home] = (s.e[home] || 0) + entry.data.amount;
        }
    }
    for (const home of homes) s.c[home] = (s.c[home] || 0) + roomCpu.average(home);
    s.n++;
}

// Ranked rooms of this shard, worst first: { room, mineral, energy (per tick), cpu, eff }.
function ranking() {
    const s = state() || { n: 0, e: {}, c: {} };
    return ownedRooms().map(room => {
        const mineral = room.find(FIND_MINERALS)[0];
        const energy = s.n ? (s.e[room.name] || 0) / (s.n) : 0;    // per sampled tick
        const cpu = s.n ? (s.c[room.name] || 0) / s.n : 0;
        return {
            room: room.name, mineral: mineral ? mineral.mineralType : undefined,
            energy: round(energy), cpu: round(cpu), eff: cpu > 0.1 && s.n >= MIN_SAMPLES ? round(energy / cpu) : null,
        };
    }).sort((a, b) => (a.eff === null) - (b.eff === null) || a.eff - b.eff);
}

function round(n) {
    return Math.round(n * 100) / 100;
}

// Which rooms to retire: worst efficiency first until `keep` remain, never the last room of a
// base mineral; rooms without data (eff null) and protected rooms are never picked. Pure.
function choose(rooms, keep, protectedRooms = []) {
    const remaining = {};
    for (const r of rooms) if (r.mineral) remaining[r.mineral] = (remaining[r.mineral] || 0) + 1;
    let count = rooms.length;
    const out = [];
    const ordered = rooms.filter(r => r.eff !== null && !protectedRooms.includes(r.room)).sort((a, b) => a.eff - b.eff);
    for (const r of ordered) {
        if (count <= keep) break;
        if (BASE_MINERALS.includes(r.mineral) && remaining[r.mineral] <= 1) continue;
        out.push(r.room);
        if (r.mineral) remaining[r.mineral]--;
        count--;
    }
    return out;
}

function missingMinerals(rooms) {
    const have = new Set(rooms.map(r => r.mineral));
    return BASE_MINERALS.filter(m => !have.has(m));
}

function plan() {
    const rooms = ranking();
    const protectedRooms = [];
    if (Memory.expansion && Memory.expansion.t) protectedRooms.push(Memory.expansion.t);
    const retire = choose(rooms, keepCount(), protectedRooms);
    return { rooms, retire, keep: rooms.filter(r => !retire.includes(r.room)) };
}

// ---------------------------------------------------------------- draining

function nearestKept(roomName) {
    let best, bestDistance = Infinity;
    for (const room of ownedRooms()) {
        if (room.name === roomName || retiring(room.name) || !room.terminal || !room.terminal.my) continue;
        if (room.terminal.store.getFreeCapacity() < TARGET_FREE) continue;
        const distance = Game.map.getRoomLinearDistance(roomName, room.name, true);
        if (distance < bestDistance) { bestDistance = distance; best = room.name; }
    }
    return best;
}

function goodsIn(structure) {
    if (!structure || !structure.store) return [];
    return Object.keys(structure.store).filter(r => r !== RESOURCE_ENERGY && structure.store[r] > 0);
}

function leftover(room) {
    let total = 0;
    for (const s of [room.storage, room.terminal, factoryOf(room)]) {
        if (s && s.store) total += s.store.getUsedCapacity();
    }
    return total;
}

function factoryOf(room) {
    return room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_FACTORY } })[0];
}

// One terminal send per cooldown: goods first, energy once nothing else is left to move.
function drainTerminal(room) {
    const terminal = room.terminal;
    if (!terminal || terminal.cooldown > 0) return false;
    const to = nearestKept(room.name);
    if (!to) return false;
    const free = Game.rooms[to].terminal.store.getFreeCapacity() - 1000;
    const energy = terminal.store[RESOURCE_ENERGY] || 0;
    const goods = goodsIn(terminal).sort((a, b) => terminal.store[b] - terminal.store[a]);
    if (goods.length) {
        const resource = goods[0];
        let amount = Math.min(terminal.store[resource], free);
        const cost = Game.market.calcTransactionCost(amount, room.name, to);
        if (cost > energy) amount = Math.floor(amount * energy / cost);
        return amount >= MIN_SEND && terminal.send(resource, amount, to, 'retiring ' + room.name) === OK;
    }
    const waiting = goodsIn(room.storage).length + goodsIn(factoryOf(room)).length;
    if (waiting) return false;   // keep the energy to ship the goods still on their way
    const ratio = Game.market.calcTransactionCost(10000, room.name, to) / 10000;
    const amount = Math.min(Math.floor(energy / (1 + ratio)), free);
    return amount >= 1000 && terminal.send(RESOURCE_ENERGY, amount, to, 'retiring ' + room.name) === OK;
}

// The drain hauler (creep.retireHauler) and the spawn that makes it.
const DRAINER_BODY = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
    MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];

function spawnDrainer(spawn) {
    const room = spawn.room;
    if (!room.terminal || !room.storage) return false;
    const exists = _.some(Game.creeps, c => c.memory.priority === 'retireHauler' && c.memory.homeRoom === room.name);
    if (exists || spawn.spawning) return false;
    return spawn.spawnCreep(DRAINER_BODY, 'x', { memory: { priority: 'retireHauler', homeRoom: room.name } }) === OK;
}

// What the drain hauler should move next: { from, resource } or null.
function nextHaul(room) {
    const terminal = room.terminal;
    if (!terminal || terminal.store.getFreeCapacity() < 1000) return null;
    for (const from of [factoryOf(room), room.storage]) {
        const goods = goodsIn(from).sort((a, b) => from.store[b] - from.store[a]);
        if (goods.length) return { from, resource: goods[0] };
    }
    if (room.storage && room.storage.store[RESOURCE_ENERGY] > 0) return { from: room.storage, resource: RESOURCE_ENERGY };
    const factory = factoryOf(room);
    if (factory && factory.store[RESOURCE_ENERGY] > 0) return { from: factory, resource: RESOURCE_ENERGY };
    return null;
}

function finish(room) {
    const name = room.name;
    for (const id in Game.market.orders) {
        if (Game.market.orders[id].roomName === name) Game.market.cancelOrder(id);
    }
    const result = room.controller.unclaim();
    if (result !== OK) {
        console.log('[retire] ' + name + ': unclaim failed (' + result + ')');
        return false;
    }
    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        if (creep.memory.homeRoom === name) creep.suicide();
    }
    for (const flagName in Game.flags) {
        const flag = Game.flags[flagName];
        if (flagName.indexOf(name) === 0 || flag.pos.roomName === name) flag.remove();
    }
    for (const key of ['basePlan', 'baseBuild', 'baseMigrate', 'labJobs', 'remoteTrips', 'remoteThreat', 'roadPlan', 'rooms']) {
        if (Memory[key] && Memory[key][name] !== undefined) delete Memory[key][name];
    }
    for (const key of ['autoBuildRooms', 'RoomsAt5', 'energyNeedRooms']) {
        const list = Memory[key];
        if (Array.isArray(list) && list.indexOf(name) !== -1) list.splice(list.indexOf(name), 1);
    }
    state().rooms[name] = { st: 'done', t: Game.time };
    console.log('[retire] ' + name + ' unclaimed');
    return true;
}

// Retiring rooms are never asked to receive anything.
function dropRequests() {
    const s = state();
    const names = Object.keys(s.rooms).filter(retiring);
    if (!names.length) return;
    if (Array.isArray(Memory.energyNeedRooms)) Memory.energyNeedRooms = Memory.energyNeedRooms.filter(r => names.indexOf(r) === -1);
    for (const mineral in Memory.mineralNeed || {}) {
        Memory.mineralNeed[mineral] = Memory.mineralNeed[mineral].filter(r => names.indexOf(r) === -1);
    }
}

function run() {
    sample();
    const s = state();
    if (!s || !s.rooms) return;
    if (Game.time % 50 === 0) dropRequests();
    for (const name in s.rooms) {
        const entry = s.rooms[name];
        if (entry.st !== 'drain') continue;
        const room = Game.rooms[name];
        if (!room || !room.controller || !room.controller.my) {
            entry.st = 'done';
            continue;
        }
        drainTerminal(room);
        if (Game.time % 20 === 0 && (leftover(room) <= LEFTOVER || Game.time - entry.t > DRAIN_TIMEOUT)) finish(room);
    }
}

// ---------------------------------------------------------------- console

function report(arg) {
    const keep = keepCount();
    if (!keep) return 'Room retirement is not configured for ' + Game.shard.name;
    const s = state();
    if (arg === 'cancel') {
        let n = 0;
        for (const name in (s && s.rooms) || {}) {
            if (s.rooms[name].st === 'drain') { delete s.rooms[name]; n++; }
        }
        return 'cancelled ' + n + ' rooms still draining';
    }
    const active = s && s.rooms ? Object.keys(s.rooms) : [];
    if (active.length) {
        const lines = ['Retirement on ' + Game.shard.name + ':'];
        for (const name of active) {
            const room = Game.rooms[name];
            lines.push('  ' + name + ': ' + s.rooms[name].st + (s.rooms[name].st === 'drain' && room ? ', ' + leftover(room) + ' left in storage/terminal/factory' : ''));
        }
        console.log(lines.join('\n'));
        return active.length + ' rooms';
    }
    const p = plan();
    const samples = s ? s.n : 0;
    const done = !measuring() && samples >= MIN_SAMPLES;
    const lines = ['Room efficiency on ' + Game.shard.name + ' (energy harvested per tick / CPU per tick), ' + samples + ' samples' +
        (measuring() ? ', measuring until tick ' + (s.start + MEASURE_TICKS) : '') + ':'];
    for (const r of p.rooms) {
        lines.push('  ' + (p.retire.includes(r.room) ? 'RETIRE ' : '       ') + r.room + ' ' + (r.mineral || '?') + '  ' + r.energy + ' energy/t, ' +
            r.cpu + ' cpu/t, efficiency ' + (r.eff === null ? 'no data (kept)' : r.eff));
    }
    lines.push('Keeping ' + p.keep.length + ' of ' + p.rooms.length + ' (target ' + keep + '); minerals still covered: ' +
        (missingMinerals(p.keep).length ? 'MISSING ' + missingMinerals(p.keep).join(',') : 'all 7'));
    for (const name in Game.powerCreeps) {
        const pc = Game.powerCreeps[name];
        if (pc.memory && p.retire.includes(pc.memory.homeRoom)) lines.push('Note: power creep ' + name + ' is homed in ' + pc.memory.homeRoom + ' (re-home it after).');
    }
    if (arg === 'confirm') {
        if (!done) {
            lines.push('Not started: measurement is not finished yet.');
        } else {
            s.rooms = s.rooms || {};
            for (const name of p.retire) s.rooms[name] = { st: 'drain', t: Game.time };
            dropRequests();
            lines.push('Started: ' + p.retire.length + ' rooms are draining; they unclaim once empty. retireRooms() shows progress, retireRooms(\'cancel\') stops it.');
        }
    } else {
        lines.push(done ? "Dry run. retireRooms('confirm') starts it." : 'Measurement still running: this ranking is provisional.');
    }
    console.log(lines.join('\n'));
    return p.retire.length + ' rooms to retire';
}

module.exports = { run, sample, ranking, choose, plan, retiring, spawnDrainer, nextHaul, drainTerminal, finish, report, missingMinerals, KEEP };
