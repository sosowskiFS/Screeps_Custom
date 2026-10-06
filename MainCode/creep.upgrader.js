const runtimeCache = require('runtime.cache');
const speech = require('creep.speech');
const { placeRoadOnPath, clearTravelMemory } = require('creep.movement');
const maintenance = require('system.maintenance');

const IDLE_SAYINGS = ["☝😼", "👌😹"];

var creep_upgrader = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'upgraderNearDeath') {
            creep.memory.priority = 'upgraderNearDeath';
        }

        // RCL8 upkeep upgrader: retire once the downgrade timer is topped up.
        if (creep.memory.upkeep && maintenance.upkeepDone(creep.room.controller)) {
            creep.suicide();
            return;
        }

        if (!creep.memory.hasBoosted && creep.room.controller.level >= 6 && Memory.labList[creep.room.name].length >= 3 && !creep.memory.previousPriority) {
            var mineralCost = creep.getActiveBodyparts(WORK) * LAB_BOOST_MINERAL;
            var energyCost = creep.getActiveBodyparts(WORK) * LAB_BOOST_ENERGY;
            var upgradeLab = runtimeCache.find(creep.room, FIND_MY_STRUCTURES, {
                filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_GHODIUM_ACID)
            });
            if (upgradeLab.length && upgradeLab[0].mineralAmount >= mineralCost && upgradeLab[0].energy >= energyCost) {
                creep.travelTo(upgradeLab[0]);
                if (upgradeLab[0].boostCreep(creep) == OK) {
                    creep.memory.hasBoosted = true;
                } else {
                    creep.memory.hasBoosted = false;
                }
            } else {
                creep.memory.hasBoosted = true;
            }
            return;
        }
        if (!creep.memory.hasBoosted) {
            creep.memory.hasBoosted = true;
        }

        const carriedEnergy = creep.store[RESOURCE_ENERGY];
        const workParts = creep.memory.workParts || (creep.memory.workParts = creep.getActiveBodyparts(WORK));

        let attemptedTravel = false;
        if (carriedEnergy > 0) {
            if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                attemptedTravel = true;
                creep.travelTo(Game.flags[creep.room.name + "Controller"] || creep.room.controller, {
                    maxRooms: 1,
                    stuckValue: 4
                });
            } else {
                speech.say(creep, IDLE_SAYINGS[Game.time % 2], true);
                clearTravelMemory(creep);
            }
        }

        if (carriedEnergy <= workParts && !attemptedTravel) {
            var linkTarget = Game.getObjectById(creep.memory.linkSource);
            if (linkTarget && linkTarget.store[RESOURCE_ENERGY] > 0 && creep.withdraw(linkTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                creep.travelTo(linkTarget, {
                    maxRooms: 1,
                    stuckValue: 4
                });
            }

            if (!creep.memory.travelDistance && creep.memory._trav && creep.memory._trav.path) {
                creep.memory.travelDistance = creep.memory._trav.path.length;
                creep.memory.deathWarn = (creep.memory.travelDistance + _.size(creep.body) * 3) + 15;
            }
        }

        // Only creeps standing still next to others can be in someone's way.
        if (Game.time % 5 == 0 && !attemptedTravel) {
            let talkingCreeps = creep.pos.findInRange(FIND_MY_CREEPS, 1, {
                filter: (thisCreep) => (creep.id != thisCreep.id && thisCreep.saying && thisCreep.saying.indexOf(";") > 0)
            });
            if (talkingCreeps.length) {
                let coords = talkingCreeps[0].saying.split(";");
                if (coords.length == 2 && creep.pos.x == parseInt(coords[0]) && creep.pos.y == parseInt(coords[1])) {
                    //Standing in the way of a creep
                    creep.move(creep.pos.getDirectionTo(talkingCreeps[0].pos));
                    creep.say("💦", true);
                }
            }
        }

        // placeRoadOnPath is a no-op without an active path, so idle upgraders skip it.
        if (Game.time % 3 == 0) {
            placeRoadOnPath(creep);
        }
    }
};

module.exports = creep_upgrader;
