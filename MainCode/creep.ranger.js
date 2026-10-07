const speech = require('creep.speech');
const runtimeCache = require('runtime.cache');
const combat = require('combat.tactics');
const combatIntel = require('combat.intel');

const RAID_FILTER = (structure) => (structure.structureType != STRUCTURE_CONTROLLER && structure.structureType != STRUCTURE_WALL && structure.structureType != STRUCTURE_RAMPART && structure.structureType != STRUCTURE_KEEPER_LAIR && structure.structureType != STRUCTURE_EXTRACTOR && structure.structureType != STRUCTURE_TERMINAL && structure.structureType != STRUCTURE_STORAGE);

var creep_ranger = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.memory.previousRoom != creep.room.name) {
            // Track the current room (the path is no longer wiped here: Traveler routes multi-room trips).
            creep.memory.previousRoom = creep.room.name;
        }

        let flagName = 'Ranger';
        if (creep.memory.flagName == 'ranger2') {
            flagName = 'Ranger2';
        } else if (creep.memory.flagName == 'PowerGuard') {
            flagName = 'PowerGuard'
        }

        if (flagName == 'PowerGuard' && !Game.flags[creep.memory.homeRoom + "PowerGather"] && Game.flags[creep.memory.homeRoom + "PowerGuard"]) {
            //Gathering disabled, no need to maintain position
            Game.flags[creep.memory.homeRoom + "PowerGuard"].remove();
        }

        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'rangerNearDeath') {
            creep.memory.priority = 'rangerNearDeath';
        }

        const inTarget = creep.memory.destination == creep.pos.roomName;
        if (inTarget) {
            speech.say(creep, Game.time % 2 == 0 ? "(=｀ω´=)" : "(=´∇｀=)", true);

            //Cancel this flag if room is in safe mode
            if (creep.room.controller && creep.room.controller.safeMode && creep.room.controller.owner.username != "Montblanc") {
                if (Game.flags[creep.memory.homeRoom + flagName]) {
                    Game.flags[creep.memory.homeRoom + flagName].remove();
                }
                return;
            }
        }

        // Defenders come first: shooting structures while armed enemies shoot back loses the trade.
        // On the way, only fight what comes close (transit) so the ranger still arrives.
        const intel = combatIntel.roomIntel(creep.room);
        if (inTarget ? intel.threats.length && combat.fight(creep) : combat.fight(creep, { transit: true })) {
            return;
        }
        if (combat.regroup(creep)) {
            return;
        }

        if (inTarget) {
            raid(creep, flagName, intel);
        } else {
            travel(creep);
        }

        // Out of combat: heal only when damaged (heal would cancel a melee hit on a structure).
        if (creep.hits < creep.hitsMax) {
            creep.heal(creep);
        }
    }

};

// Target room with no armed defenders: spawns, then construction sites, then unarmed
// creeps, then any unprotected structure.
function raid(creep, flagName, intel) {
    const hostileRoom = creep.room.controller && creep.room.controller.owner && creep.room.controller.owner.username != "Montblanc";
    if (hostileRoom) {
        let somethingNearby = creep.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (structure) => (structure.structureType != STRUCTURE_ROAD && structure.structureType != STRUCTURE_POWER_BANK && structure.structureType != STRUCTURE_TERMINAL && structure.structureType != STRUCTURE_STORAGE)
        });
        if (somethingNearby) {
            creep.attack(somethingNearby);
            creep.rangedAttack(somethingNearby);
        }
    }

    let eSpawns = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
        filter: { structureType: STRUCTURE_SPAWN }
    });
    let eSites = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, {
        filter: (site) => (site.progress > 0)
    });
    if (eSpawns) {
        creep.travelTo(eSpawns, {
            ignoreRoads: true,
            maxRooms: 1,
            stuckValue: 2,
            allowSK: true
        });
        creep.attack(eSpawns);
        creep.rangedAttack(eSpawns);
    } else if (eSites && hostileRoom) {
        creep.travelTo(eSites, {
            ignoreRoads: true,
            maxRooms: 1,
            stuckValue: 2
        })
    } else if (intel.hostiles.length && combat.fight(creep)) {
        // Unarmed creeps (haulers, scouts, claimers): hunt them with the shared logic.
    } else {
        //Find structures that don't have a rampart on them
        let allStruct = runtimeCache.find(creep.room, FIND_HOSTILE_STRUCTURES, { filter: RAID_FILTER });
        let target = undefined;
        if (allStruct.length) {
            //Sort based on distance.
            allStruct.sort(distCompare(creep));
            target = allStruct.find(structure => !structure.pos.lookFor(LOOK_STRUCTURES).some(s => s.structureType == STRUCTURE_RAMPART));
        }
        if (!target) {
            target = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: RAID_FILTER });
        }
        if (target) {
            creep.travelTo(target, {
                ignoreRoads: true,
                maxRooms: 1,
                stuckValue: 2,
                allowSK: true
            });
            creep.dismantle(target);
            creep.attack(target);
            creep.rangedAttack(target);
        } else if (Game.flags[creep.memory.homeRoom + flagName]) {
            creep.travelTo(Game.flags[creep.memory.homeRoom + flagName]);
        }
    }
}

function travel(creep) {
    if (creep.memory.path && creep.memory.path[0] == creep.room.name) {
        creep.memory.path.splice(0, 1);
    }
    if (creep.memory.path && creep.memory.path.length) {
        creep.travelTo(new RoomPosition(25, 25, creep.memory.path[0]), {
            stuckValue: 2,
            allowSK: true
        });
    } else {
        creep.travelTo(new RoomPosition(25, 25, creep.memory.destination), {
            stuckValue: 2,
            allowSK: true
        });
    }

    if (!creep.memory.travelDistance && creep.memory._trav && creep.memory._trav.path) {
        creep.memory.travelDistance = creep.memory._trav.path.length;
        creep.memory.deathWarn = (creep.memory.travelDistance + _.size(creep.body) * 3) + 15;
    }
}

function distCompare(creep) {
    return function(a, b) {
        return a.pos.getRangeTo(creep) - b.pos.getRangeTo(creep);
    }
}

module.exports = creep_ranger;
