// Room guard: a ranger a sponsor sends to a room it is building up (system.expansion, system.shardX).
// On the way it only fights what comes close; in the room it fights any hostile player creep (the
// shared combat logic, which also hunts unarmed intruders such as claimers) and otherwise parks
// within range 3 of the controller. On arrival it records its trip (ticks from spawn to arrival):
// the sponsor uses it to send the next guard early enough that there is never a gap.
const combat = require('combat.tactics');

const PARK_RANGE = 3;

// The guard body: the power-harvest rangers' builds, by the spawning room's energy.
function body(energyCapacity) {
    energyCapacity = Number(energyCapacity) || 0;
    if (energyCapacity >= 4450) {
        return [].concat(Array(25).fill(MOVE), Array(15).fill(RANGED_ATTACK), Array(2).fill(ATTACK), Array(8).fill(HEAL));
    }
    if (energyCapacity >= 2300) return [].concat(Array(10).fill(RANGED_ATTACK), Array(11).fill(MOVE), [HEAL]);
    if (energyCapacity >= 1760) return [].concat([TOUGH], Array(7).fill(RANGED_ATTACK), Array(9).fill(MOVE), [HEAL]);
    const pairs = Math.max(1, Math.min(10, Math.floor(energyCapacity / 200)));   // smaller sponsors
    return [].concat(Array(pairs).fill(RANGED_ATTACK), Array(pairs).fill(MOVE));
}

function healSelf(creep) {
    if (creep.hits < creep.hitsMax && creep.getActiveBodyparts(HEAL)) creep.heal(creep);
}

const SPAWN_TICKS_PER_PART = 3;   // CREEP_SPAWN_TIME
const LEAD_MARGIN = 50;
const TICKS_PER_ROOM = 50;

// Ticks before the current guard dies that its replacement must be ordered: the replacement's spawn
// time plus its trip (measured by an earlier guard, else estimated from the room distance).
function leadTime(bodyLength, trip, roomDistance) {
    const rooms = Number.isFinite(roomDistance) && roomDistance > 0 ? roomDistance : 10;
    const travel = trip !== undefined ? trip : TICKS_PER_ROOM * rooms + TICKS_PER_ROOM;
    return bodyLength * SPAWN_TICKS_PER_PART + travel + LEAD_MARGIN;
}

// Is a guard (or its replacement) covered? ttls: remaining life of each guard for the room
// (Infinity while spawning or not yet out of its home).
function covered(ttls, lead) {
    return ttls.some(ttl => ttl > lead);
}

module.exports = {
    body, leadTime, covered,
    run: function(creep) {
        const dest = creep.memory.destination;
        if (creep.room.name !== dest) {
            if (!combat.fight(creep, { transit: true })) creep.travelTo(new RoomPosition(25, 25, dest), { range: 20 });
            healSelf(creep);
            return;
        }
        if (creep.memory.trip === undefined) {
            creep.memory.trip = CREEP_LIFE_TIME - creep.ticksToLive;
            if (Memory.expansion && Memory.expansion.t === dest) Memory.expansion.guardTrip = creep.memory.trip;
        }
        if (combat.fight(creep)) return;
        const controller = creep.room.controller;
        if (controller && !creep.pos.inRangeTo(controller, PARK_RANGE)) creep.travelTo(controller, { range: PARK_RANGE, maxRooms: 1 });
        healSelf(creep);
    }
};
