var creep_upgrader = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'upgraderNearDeath') {
            creep.memory.priority = 'upgraderNearDeath';
        }

        if (!creep.memory.hasBoosted && creep.room.controller.level >= 6 && Memory.labList[creep.room.name].length >= 3 && !creep.memory.previousPriority) {
            var mineralCost = creep.getActiveBodyparts(WORK) * LAB_BOOST_MINERAL;
            var energyCost = creep.getActiveBodyparts(WORK) * LAB_BOOST_ENERGY;
            var upgradeLab = creep.room.find(FIND_MY_STRUCTURES, {
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
        } else {
            if (!creep.memory.hasBoosted) {
                creep.memory.hasBoosted = true;
            }

            if (_.sum(creep.carry) > 0) {
                if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    if (Game.flags[creep.room.name + "Controller"]) {
                        creep.travelTo(Game.flags[creep.room.name + "Controller"], {
                            maxRooms: 1
                        });
                    } else {
                        creep.travelTo(creep.room.controller, {
                            maxRooms: 1
                        });
                    }
                } else {
                    if (Game.time % 2 == 0) {
                        creep.say("\u261D\uD83D\uDE3C", true);
                    } else {
                        creep.say("\uD83D\uDC4C\uD83D\uDE39", true);
                    }
                }
            }

            if (_.sum(creep.carry) <= creep.getActiveBodyparts(WORK)) {
                var linkTarget = Game.getObjectById(creep.memory.linkSource);
                if (linkTarget && creep.withdraw(linkTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.travelTo(linkTarget, {
                        maxRooms: 1
                    });
                }
            }
        }
    }
};

module.exports = creep_upgrader;