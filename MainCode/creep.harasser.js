const combat = require('combat.tactics');
const combatIntel = require('combat.intel');

// Harasser: a fast melee raider sent (by observers) to rooms another player is reserving.
// It can't touch the reservation itself (that needs CLAIM), so it attacks what keeps the
// remote running: reservers first, then haulers carrying energy, then miners and other
// unarmed creeps.
//  * Armed defenders present: the shared fight logic decides. It engages only when the
//    numbers say we win, otherwise it retreats, regroups for 50 ticks and comes back.
//  * No prey: wait by the controller, where their reserver will show up.
var creep_harasser = {

    run: function(creep) {
        // Track the current room. The path used to be wiped here on every room change; Traveler
        // now routes multi-room trips, and replanning from an exit tile sent creeps back.
        if (creep.memory.previousRoom != creep.room.name) {
            creep.memory.previousRoom = creep.room.name;
        }

        // Set NearDeath flag if creep is about to die
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'harasserNearDeath') {
            creep.memory.priority = 'harasserNearDeath';
        }

        if (combat.regroup(creep)) {
            return;
        }

        if (creep.room.name !== creep.memory.destination) {
            // On the way: only fight what comes close, keep moving otherwise.
            if (!combat.fight(creep, { transit: true })) {
                creep.travelTo(new RoomPosition(25, 25, creep.memory.destination), {
                    stuckValue: 2,
                    allowSK: true
                });
                selfHeal(creep);
            }
            if (!creep.memory.travelDistance && creep.memory._trav && creep.memory._trav.path) {
                creep.memory.travelDistance = creep.memory._trav.path.length;
                creep.memory.deathWarn = (creep.memory.travelDistance + _.size(creep.body) * 3) + 15;
            }
            return;
        }

        const intel = combatIntel.roomIntel(creep.room);
        const armed = intel.threats.some(threat => combatIntel.assess(threat).dps > 0);
        if (armed) {
            combat.fight(creep);
            return;
        }

        const prey = pickPrey(creep, intel.hostiles);
        if (prey) {
            if (creep.pos.isNearTo(prey)) {
                creep.attack(prey); // attack and heal share an action slot: attack wins here
            } else {
                creep.travelTo(prey, { maxRooms: 1, range: 1, movingTarget: true, ignoreCreeps: false });
                selfHeal(creep);
            }
            return;
        }

        selfHeal(creep);
        if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
            creep.travelTo(new RoomPosition(25, 25, creep.room.name), { maxRooms: 1, range: 20 });
        } else if (creep.room.controller && creep.pos.getRangeTo(creep.room.controller) > 2) {
            creep.travelTo(creep.room.controller, { maxRooms: 1, range: 2 });
        }
    }
};

// Reservers keep the reservation alive, haulers carry the income, miners produce it.
function preyValue(hostile) {
    let value = 0;
    for (const part of hostile.body) {
        if (part.hits <= 0) continue;
        if (part.type === CLAIM) value += 40;
        else if (part.type === WORK) value += 2;
        else if (part.type === CARRY) value += 1;
    }
    if (hostile.store && hostile.store.getUsedCapacity && hostile.store.getUsedCapacity() > 0) value += 20;
    return value;
}

function pickPrey(creep, hostiles) {
    let best = null, bestScore = -Infinity;
    for (const hostile of hostiles) {
        const score = preyValue(hostile) - creep.pos.getRangeTo(hostile);
        if (score > bestScore) {
            best = hostile;
            bestScore = score;
        }
    }
    return best;
}

function selfHeal(creep) {
    if (creep.hits < creep.hitsMax && creep.getActiveBodyparts(HEAL) > 0) {
        creep.heal(creep);
    }
}

creep_harasser.pickPrey = pickPrey; // exposed for tests
module.exports = creep_harasser;
