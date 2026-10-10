// system.tempGuards — temporary guards for a room we don't own, such as a portal room where
// travellers to shardX are being picked off (console: tempGuard()).
//
// Memory.tempGuards[room] = { home, count, until, trip }: `home` keeps `count` room guards
// (creep.roomGuard) in `room` until tick `until`, ordering each replacement early enough (spawn
// time + trip) that there is no gap. A group starting from nothing gathers at home and sets out
// together: a guard arriving alone would face the whole threat by itself.
const guard = require('creep.roomGuard');

const GATHER_MAX = 150;   // ticks the first group waits at home for its last member

function orders() {
    return Memory.tempGuards || (Memory.tempGuards = {});
}

function members(room) {
    return Object.values(Game.creeps).filter(c => c.memory.tempGuard === room);
}

// Spawning hook (system.spawning): { body, name, memory } for this home, or null.
function spawnOrder(home) {
    const all = orders();
    for (const room of Object.keys(all)) {
        const o = all[room];
        if (Game.time >= o.until) {
            delete all[room];
            continue;
        }
        if (o.home !== home || o.ordered === Game.time) continue;   // one order per tick: a creep spawned this tick is not yet in Game.creeps
        const body = guard.body(Game.rooms[home].energyCapacityAvailable);
        const lead = guard.leadTime(body.length, o.trip, Game.map.getRoomLinearDistance(home, room));
        const list = members(room);
        const covering = list.filter(c => c.spawning || c.ticksToLive === undefined || c.ticksToLive > lead);
        if (covering.length >= o.count) continue;
        o.ordered = Game.time;
        const memory = { priority: 'roomGuard', homeRoom: home, destination: room, tempGuard: room };
        // Nobody there or on the way yet: this group gathers before leaving.
        if (!list.some(c => !c.memory.gather)) {
            if (!list.length) o.wave = Game.time;
            memory.wave = o.wave;
            memory.gather = Game.time + GATHER_MAX;
        }
        return { body, name: 'tg' + Game.time.toString(36) + room, memory };
    }
    return null;
}

// A gathering guard (creep.roomGuard): true while it should still wait at home for the rest of its
// group. It steps away from the spawns meanwhile.
function waiting(creep) {
    const m = creep.memory, o = orders()[m.tempGuard];
    if (!m.gather) return false;
    const ready = members(m.tempGuard).filter(c => c.memory.wave === m.wave && !c.spawning).length;
    if (!o || Game.time >= m.gather || ready >= o.count || creep.room.name !== m.homeRoom) {
        delete m.gather;
        return false;
    }
    creep.travelTo(new RoomPosition(25, 25, m.homeRoom), { range: 6, maxRooms: 1 });
    return true;
}

// The measured trip (spawn to arrival), so replacements are ordered in time.
function arrived(creep) {
    const o = orders()[creep.memory.tempGuard];
    if (o && creep.memory.trip !== undefined) o.trip = creep.memory.trip;
}

// Console: tempGuard('W0N20', 'E1N16', 3, 5000) guards W0N20 from E1N16 with 3 guards for 5000
// ticks; tempGuard('W0N20') cancels it (guards there live out their time); tempGuard() lists.
function command(room, home, count = 3, ticks = 5000) {
    const all = orders();
    if (!room) {
        const lines = Object.keys(all).map(r => r + ': ' + all[r].count + ' from ' + all[r].home + ', ' +
            (all[r].until - Game.time) + ' ticks left, ' + members(r).length + ' alive');
        return lines.length ? lines.join('\n') : 'no temporary guards';
    }
    if (!home) {
        delete all[room];
        return 'temporary guard for ' + room + ' cancelled';
    }
    const h = Game.rooms[home];
    if (!h || !h.controller || !h.controller.my) return home + ' is not one of our rooms on this shard';
    all[room] = { home, count: Math.max(1, Number(count) || 1), until: Game.time + (Number(ticks) || 5000) };
    return room + ': ' + all[room].count + ' guards from ' + home + ' until tick ' + all[room].until +
        ' (body ' + guard.body(h.energyCapacityAvailable).length + ' parts)';
}

module.exports = { spawnOrder, waiting, arrived, command, members, GATHER_MAX };
