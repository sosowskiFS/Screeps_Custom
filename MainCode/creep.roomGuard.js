// Room guard: a ranger a sponsor sends to a room it is building up (system.expansion, system.shardX).
// On the way it does not fight: it steps away from armed hostiles that come close and keeps going.
// In the room it fights hostiles with the shared combat logic when it would not have to retreat;
// outmatched or badly hurt it holds its post instead (backs away from armed hostiles inside the
// room, picks off claimers and dismantlers), never leaving the room. Otherwise it parks within
// range 3 of the controller. On arrival it records its trip (ticks from spawn to arrival):
// the sponsor uses it to send the next guard early enough that there is never a gap.
const combat = require('combat.tactics');
const combatIntel = require('combat.intel');

const PARK_RANGE = 3;
const LOW_HEALTH = 0.35;         // as combat.tactics: below this a fighter would retreat

// The guard body (combat.bodies.roomGuard): a full-speed kiter, ranged parts in front, MOVE behind
// them and HEAL last. The old RCL7/8 body had its 25 MOVE in front (every hit cost speed, so a
// kiter got away) and 2 ATTACK parts whose swings cancelled that tick's heal.
function body(energyCapacity) {
    return require('combat.bodies').roomGuard(energyCapacity);
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

function reach(stats) {
    return stats.ranged > 0 ? 3 : 1;
}

// Armed hostiles that could hit the creep next tick (their reach + 2 for a step each way).
function armedNear(creep, intel) {
    return intel.threats.filter(t => {
        const stats = combatIntel.assess(t);
        return stats.dps > 0 && creep.pos.inRangeTo(t, reach(stats) + 2);
    });
}

function shootNearest(creep, hostiles) {
    const inRange = hostiles.filter(h => creep.pos.inRangeTo(h, 3));
    if (!inRange.length) return;
    const target = creep.pos.findClosestByRange(inRange);
    if (creep.pos.isNearTo(target) && creep.getActiveBodyparts(ATTACK)) creep.attack(target);
    else if (creep.getActiveBodyparts(RANGED_ATTACK)) creep.rangedAttack(target);
}

// Outmatched (or badly hurt): never leave the room. Back away from armed hostiles inside the
// room, shooting what is in range; otherwise pick off hostiles that cannot fight back (claimers,
// dismantlers) while staying out of the armed ones' reach; otherwise park.
function holdPost(creep, intel) {
    const near = armedNear(creep, intel);
    shootNearest(creep, intel.hostiles);
    if (near.length && combat.flee(creep, near)) return;
    const harmless = intel.hostiles.filter(h => combatIntel.assess(h).dps === 0);
    const prey = creep.pos.findClosestByRange(harmless);
    if (prey) {
        creep.travelTo(prey, { range: 1, maxRooms: 1, movingTarget: true });
        return;
    }
    park(creep);
}

function park(creep) {
    const controller = creep.room.controller;
    if (controller && !creep.pos.inRangeTo(controller, PARK_RANGE)) creep.travelTo(controller, { range: PARK_RANGE, maxRooms: 1 });
}

module.exports = {
    body, leadTime, covered,
    run: function(creep) {
        if (creep.memory.guardRecall) return require('creep.recall').recall(creep);   // mission cancelled
        if (creep.memory.guardAwaitManifest) return;
        if (creep.memory.guardSquad) return require('creep.guardQuad').run(creep);
        if (creep.memory.tempGuard && require('system.tempGuards').waiting(creep)) return;   // gathering at home
        const dest = creep.memory.destination;
        delete creep.memory.regroupUntil;   // a guard never falls back home
        if (creep.room.name !== dest) {
            // On the way: no fighting (a lost fight sends a creep home, away from its post). Step
            // away from armed hostiles that come close, otherwise keep going.
            const near = armedNear(creep, combatIntel.roomIntel(creep.room));
            if (!(near.length && combat.flee(creep, near))) creep.travelTo(new RoomPosition(25, 25, dest), { range: 20 });
            healSelf(creep);
            return;
        }
        if (creep.memory.trip === undefined) {
            creep.memory.trip = CREEP_LIFE_TIME - creep.ticksToLive;
            if (Memory.expansion && Memory.expansion.t === dest) Memory.expansion.guardTrip = creep.memory.trip;
            if (creep.memory.tempGuard) require('system.tempGuards').arrived(creep);
        }
        // The shared fight logic only when it would not retreat: a lost fight sends a creep home,
        // and the guard then walked straight back in, bouncing on the room border (shardX E29N36).
        const intel = combatIntel.roomIntel(creep.room);
        if (intel.hostiles.length) {
            const outmatched = intel.verdict === 'lose' || creep.hits < creep.hitsMax * LOW_HEALTH ||
                combat.incomingDamage(creep, intel.threats) >= creep.hits;
            if (outmatched) holdPost(creep, intel);
            else combat.fight(creep);
            healSelf(creep);
            return;
        }
        park(creep);
        healSelf(creep);
    }
};
