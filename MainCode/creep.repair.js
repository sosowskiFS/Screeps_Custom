var creep_repair = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'repairNearDeath') {
            creep.memory.priority = 'repairNearDeath';
        }

        if (!creep.memory.hasBoosted && creep.room.controller.level >= 6 && Memory.labList[creep.room.name].length >= 3 && !creep.memory.previousPriority) {
            var mineralCost = creep.getActiveBodyparts(WORK) * LAB_BOOST_MINERAL;
            var energyCost = creep.getActiveBodyparts(WORK) * LAB_BOOST_ENERGY;
            var repairLab = creep.room.find(FIND_MY_STRUCTURES, {
                filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_LEMERGIUM_ACID)
            });
            if (repairLab.length && repairLab[0].mineralAmount >= mineralCost && repairLab[0].energy >= energyCost) {
                creep.travelTo(repairLab[0]);
                if (repairLab[0].boostCreep(creep) == OK) {
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

            if (creep.carryCapacity > 0) {
                findNewTarget(creep, _.sum(creep.carry));
            }
        }
    }
};

function findNewTarget(creep, creepEnergy) {
    if (creepEnergy <= 0) {
        creep.memory.structureTarget = undefined;
        if (creep.memory.previousPriority && creep.memory.previousPriority == 'mule') {
            creep.memory.priority = "mule";
        } else {
            //Get from storage
            var storageTarget = creep.room.storage;
            if (storageTarget) {
                if (storageTarget.store[RESOURCE_ENERGY] >= 200) {
                    var withdrawResult = creep.withdraw(storageTarget, RESOURCE_ENERGY);
                    if (withdrawResult == ERR_NOT_IN_RANGE) {
                        creep.travelTo(storageTarget, {
                            maxRooms: 1
                        });
                    } else if (withdrawResult == OK) {
                        moveToNewTarget(creep);
                    }
                } else {
                    var spawnTarget = Game.getObjectById(creep.memory.fromSpawn);
                    if (spawnTarget) {
                        if (!creep.pos.isNearTo(spawnTarget)) {
                            creep.travelTo(spawnTarget, {
                                maxRooms: 1
                            });
                        }
                    }
                }
            }
        }
    } else if (creep.memory.structureTarget) {
        var doRepair = true;
        if (creep.memory.previousPriority == 'mule' && creep.carry.energy > 300 && Memory.linkList[creep.room.name].length > 1) {
            var upgraderLink = Game.getObjectById(Memory.linkList[creep.room.name][1]);
            if (upgraderLink && upgraderLink.energy < 100) {
                doRepair = false;
                creep.memory.priority = 'mule';
                creep.memory.structureTarget = upgraderLink.id;
                if (creep.transfer(upgraderLink, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.travelTo(upgraderLink);
                }
            }
        }

        if (doRepair) {
            var thisStructure = Game.getObjectById(creep.memory.structureTarget);
            if (thisStructure) {
                if (thisStructure.hits == thisStructure.hitsMax) {
                    creep.memory.structureTarget = undefined;
                    findNewTarget(creep, _.sum(creep.carry));
                } else {
                    //If using last bit of energy this tick, find new target
                    var repairResult = creep.repair(thisStructure);
                    if (repairResult == ERR_NOT_IN_RANGE && Memory.warMode) {
                        creep.travelTo(thisStructure, {
                            maxRooms: 1
                        });
                    } else if (!Memory.warMode) {
                        creep.travelTo(thisStructure, {
                            maxRooms: 1,
                            range: 1
                        });
                    }

                    if (repairResult == OK && creepEnergy <= creep.getActiveBodyparts(WORK)) {
                        //Used all energy, travel to storage
                        findNewTarget(creep, 0);
                    }
                }
            } else {
                creep.memory.structureTarget = undefined;
                findNewTarget(creep, _.sum(creep.carry));
            }
        }
    } else {
        var closestDamagedStructure = [];
        closestDamagedStructure = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => (structure.structureType != STRUCTURE_ROAD) && (structure.hitsMax - structure.hits >= 200)
        });

        if (closestDamagedStructure.length > 0) {
            closestDamagedStructure.sort(repairCompare);
            creep.memory.structureTarget = closestDamagedStructure[0].id;
            if (creep.repair(closestDamagedStructure[0]) == ERR_NOT_IN_RANGE) {
                if (!Memory.warMode) {
                    creep.travelTo(closestDamagedStructure[0], {
                        maxRooms: 1,
                        range: 1
                    });
                } else {
                    creep.travelTo(closestDamagedStructure[0], {
                        maxRooms: 1
                    });
                }
            }
        }
    }
}

function moveToNewTarget(creep) {
    var closestDamagedStructure = [];
    closestDamagedStructure = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => (structure.structureType != STRUCTURE_ROAD) && (structure.hitsMax - structure.hits >= 200)
    });

    if (closestDamagedStructure.length > 0) {
        closestDamagedStructure.sort(repairCompare);
        creep.memory.structureTarget = closestDamagedStructure[0].id;
        if (!Memory.warMode) {
            creep.travelTo(closestDamagedStructure[0], {
                maxRooms: 1,
                range: 1
            });
        } else {
            creep.travelTo(closestDamagedStructure[0], {
                maxRooms: 1
            });
        }
    }
}

function repairCompare(a, b) {
    if (a.hits < b.hits)
        return -1;
    if (a.hits > b.hits)
        return 1;
    return 0;
}

module.exports = creep_repair;