// system.energyAid — emergency terminal energy for a room under attack that is running dry.
//
// The energy request queue (Memory.energyNeedRooms, system.rooms) is only served by a room holding
// 250k in storage and 50k in its terminal, every 50 ticks. shardX W1N9 under attack sat at 80
// storage and an empty terminal while E23N31 held 128k: no room on the shard met that bar. A room
// is in an emergency while another player attacks it (Memory.roomsUnderAttack and player creeps in
// it) and its storage + terminal hold under CRITICAL. Every room not itself attacked, with a
// terminal off cooldown, then sends to the driest such room every CHECK_EVERY ticks, keeping
// DONOR_FLOOR for itself and sending up to BATCH (the transfer cost counted). The emergency room
// also goes to the front of the normal queue.
const runtimeCache = require('runtime.cache');

const CRITICAL = 30000;
const DONOR_FLOOR = 50000;
const BATCH = 20000;
const MIN_SEND = 2000;
const CHECK_EVERY = 10;
const NPC = new Set(['Invader', 'Source Keeper']);

function energy(room) {
    let n = 0;
    for (const s of [room.storage, room.terminal]) if (s && s.store) n += s.store[RESOURCE_ENERGY] || 0;
    return n;
}

function playerAttack(room) {
    if (!(Memory.roomsUnderAttack || []).includes(room.name)) return false;
    const white = Memory.whiteList || [];
    return runtimeCache.find(room, FIND_HOSTILE_CREEPS).some(c => c.owner && !NPC.has(c.owner.username) && !white.includes(c.owner.username));
}

// Owned rooms with a terminal under a player attack and short of energy, driest first.
let cache = { t: -1, rooms: [] };
function emergencies() {
    if (cache.t === Game.time) return cache.rooms;
    const out = [];
    for (const name in Game.rooms) {
        const room = Game.rooms[name];
        if (room.controller && room.controller.my && room.terminal && energy(room) < CRITICAL && playerAttack(room)) out.push(room);
    }
    out.sort((a, b) => energy(a) - energy(b));
    cache = { t: Game.time, rooms: out, sent: {} };
    return out;
}
function emergency(room) {
    return emergencies().includes(room);
}

// The watched room (system.siegeWatch: in safe mode or its cooldown) is sent energy before the next
// attack, every WATCH_EVERY ticks once no emergency needs it, until its storage + terminal hold
// WATCH_STOCK; donors keep their usual reserve (system.energyFlow.RESERVE), giving what their watch
// stockpile adds above it.
const WATCH_EVERY = 100;
function watchTargets(room) {
    const watch = require('system.siegeWatch');
    return watch.watchedRooms().map(name => Game.rooms[name])
        .filter(r => r && r.name !== room.name && r.terminal && energy(r) < watch.WATCH_STOCK)
        .sort((a, b) => energy(a) - energy(b));
}

// One send from this room to the driest emergency room (else watched room), if it can spare it.
// Returns what was sent.
function aid(room) {
    if (Game.time % CHECK_EVERY !== 0) return 0;
    const terminal = room.terminal;
    if (!terminal || terminal.cooldown || !room.controller || !room.controller.my) return 0;
    let targets = emergencies().filter(r => r.name !== room.name);
    let goal = CRITICAL, floor = DONOR_FLOOR, why = ' energy aid under attack';
    if (!targets.length && Game.time % WATCH_EVERY === 0) {
        targets = watchTargets(room);
        goal = require('system.siegeWatch').WATCH_STOCK;
        floor = Math.max(DONOR_FLOOR, require('system.energyFlow').RESERVE(room.controller.level || 0));
        why = ' energy for the defence after safe mode';
    }
    if (!targets.length || playerAttack(room) || require('system.retire').retiring(room.name) ||
        require('system.siegeWatch').watched(room.name)) return 0;
    for (const target of targets) {
        // What is already on its way this tick counts toward the target's batch.
        const sent = cache.sent[target.name] || 0;
        const need = Math.min(BATCH, goal - energy(target)) - sent;
        const space = target.terminal.store.getFreeCapacity(RESOURCE_ENERGY);
        const have = terminal.store[RESOURCE_ENERGY] || 0;
        const spare = energy(room) - floor;
        let amount = Math.min(need, space, have, spare);
        if (amount < MIN_SEND) continue;
        // The transfer cost comes out of the same terminal and the same spare.
        const cost = n => Game.market.calcTransactionCost(n, room.name, target.name);
        while (amount >= MIN_SEND && (amount + cost(amount) > have || amount + cost(amount) > spare)) amount = Math.floor(amount * 0.8);
        if (amount < MIN_SEND) continue;
        if (terminal.send(RESOURCE_ENERGY, amount, target.name, room.name + why) === OK) {
            cache.sent[target.name] = sent + amount;
            return amount;
        }
    }
    return 0;
}

module.exports = { aid, emergency, emergencies, energy, watchTargets, CRITICAL, DONOR_FLOOR, BATCH, CHECK_EVERY, WATCH_EVERY };
