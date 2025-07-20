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
            let repairRange = 2;
            if (Memory.roomsUnderAttack.indexOf(creep.room.name) != -1) {
                repairRange = 3;
            }
            if (!creep.memory.hasBoosted) {
                creep.memory.hasBoosted = true;
            }

            if (creep.carryCapacity > 0) {
                findNewTarget(creep, _.sum(creep.carry), repairRange);
            } else {
                creep.suicide();
            }
        }
    }
};

function findNewTarget(creep, creepEnergy, repairRange) {
    if (creepEnergy <= 0) {
        creep.memory.structureTarget = undefined;
        if (creep.memory.previousPriority && creep.memory.previousPriority == 'mule') {
            creep.memory.priority = "mule";
        } else {
            //Get from storage
            var storageTarget = creep.room.storage;
            if (creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 250000 && creep.room.terminal.store[RESOURCE_ENERGY] > 31000) {
                storageTarget = creep.room.terminal;
            }
            if (storageTarget && storageTarget.store[RESOURCE_ENERGY] >= 200 && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                var withdrawResult = creep.withdraw(storageTarget, RESOURCE_ENERGY);
                if (withdrawResult == ERR_NOT_IN_RANGE) {
                    creep.travelTo(storageTarget, {
                        maxRooms: 1
                    });
                } else if (withdrawResult == OK) {
                    moveToNewTarget(creep);
                }
            } else if (storageTarget) {
                var spawnTarget = Game.getObjectById(creep.memory.fromSpawn);
                if (spawnTarget && !creep.pos.isNearTo(spawnTarget)) {
                    creep.travelTo(spawnTarget, {
                        maxRooms: 1
                    });
                }
            }
        }
    } else if (creep.memory.structureTarget) {
        let doRepair = true;
        if (creep.memory.previousPriority == 'mule' && creep.carry.energy > 300 && Memory.linkList[creep.room.name].length > 1) {
            let upgraderLink = Game.getObjectById(Memory.linkList[creep.room.name][1]);
            if (upgraderLink && upgraderLink.energy < 100 && creep.carry[RESOURCE_ENERGY] > 0 && upgraderLink.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                doRepair = false;
                creep.memory.priority = 'mule';
                creep.memory.structureTarget = upgraderLink.id;
                if (creep.transfer(upgraderLink, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.travelTo(upgraderLink);
                }
            }
        }
        if (doRepair) {
            let thisStructure = Game.getObjectById(creep.memory.structureTarget);
            if (thisStructure) {
                if (thisStructure.hits == thisStructure.hitsMax) {
                    //No repair needed, clear for reassignment
                    Memory.repairTarget[creep.room.name] = undefined;
                    creep.memory.structureTarget = undefined;
                    findNewTarget(creep, _.sum(creep.carry));
                } else {
                    //If using last bit of energy this tick, find new target
                    if (thisStructure.hits < thisStructure.hitsMax && creep.carry[RESOURCE_ENERGY] > 0) {
                        let repairResult = creep.repair(thisStructure);
                        if (repairResult == ERR_NOT_IN_RANGE) {
                            creep.travelTo(thisStructure, {
                                maxRooms: 1,
                                range: repairRange
                            });
                        } else if (repairResult == OK) {
                            //Listen for creeps
                            let talkingCreeps = creep.pos.findInRange(FIND_MY_CREEPS, 1, {
                                filter: (thisCreep) => (creep.id != thisCreep.id && thisCreep.saying)
                            })
                            if (talkingCreeps.length) {
                                let coords = talkingCreeps[0].saying.split(";");
                                if (talkingCreeps[0].memory.priority != 'repair' && coords.length == 2 && creep.pos.x == parseInt(coords[0]) && creep.pos.y == parseInt(coords[1])) {
                                    let thisDirection = creep.pos.getDirectionTo(talkingCreeps[0].pos);
                                    creep.move(thisDirection);
                                    creep.say("\uD83D\uDCA6", true);
                                }
                            } else if (Game.flags[creep.room.name + "RoomOperator"]) {
                                talkingCreeps = creep.pos.findInRange(FIND_MY_POWER_CREEPS, 1, {
                                    filter: (thisCreep) => (creep.id != thisCreep.id && thisCreep.saying)
                                })
                                if (talkingCreeps.length) {
                                    let coords = talkingCreeps[0].saying.split(";");
                                    if (coords.length == 2 && creep.pos.x == parseInt(coords[0]) && creep.pos.y == parseInt(coords[1])) {
                                        let thisDirection = creep.pos.getDirectionTo(talkingCreeps[0].pos);
                                        creep.move(thisDirection);
                                        creep.say("\uD83D\uDCA6", true);
                                    } else {
                                        creep.travelTo(thisStructure, {
                                            maxRooms: 1,
                                            range: repairRange
                                        });
                                    }
                                } else {
                                    creep.travelTo(thisStructure, {
                                        maxRooms: 1,
                                        range: repairRange
                                    });
                                }
                            } else {
                                creep.travelTo(thisStructure, {
                                    maxRooms: 1,
                                    range: repairRange
                                });
                            }
                        }
                        if (repairResult == OK && creepEnergy <= creep.getActiveBodyparts(WORK)) {
                            findNewTarget(creep, 0);
                        }
                    }
                }
            } else {
                Memory.repairTarget[creep.room.name] = undefined;
                creep.memory.structureTarget = undefined;
                findNewTarget(creep, _.sum(creep.carry));
            }
        }
    } else {
        if (Memory.repairTarget[creep.room.name]) {
            let closestDamagedStructure = Game.getObjectById(Memory.repairTarget[creep.room.name]);
            if (closestDamagedStructure && closestDamagedStructure.hits < closestDamagedStructure.hitsMax && creep.carry[RESOURCE_ENERGY] > 0) {
                creep.memory.structureTarget = Memory.repairTarget[creep.room.name];
                if (creep.repair(closestDamagedStructure) == ERR_NOT_IN_RANGE) {
                    if (!Memory.warMode) {
                        creep.travelTo(closestDamagedStructure, {
                            maxRooms: 1,
                            range: 1
                        });
                    } else {
                        creep.travelTo(closestDamagedStructure, {
                            maxRooms: 1
                        });
                    }
                }
            } else if (!closestDamagedStructure || closestDamagedStructure.hits == closestDamagedStructure.hitsMax) {
                Memory.repairTarget[creep.room.name] = undefined;
            }
        }
    }
}

function moveToNewTarget(creep) {
    if (Memory.repairTarget[creep.room.name]) {
        let closestDamagedStructure = Game.getObjectById(Memory.repairTarget[creep.room.name]);
        if (closestDamagedStructure && closestDamagedStructure.hits < closestDamagedStructure.hitsMax && creep.carry[RESOURCE_ENERGY] > 0) {
            creep.memory.structureTarget = Memory.repairTarget[creep.room.name];
            if (creep.repair(closestDamagedStructure) == ERR_NOT_IN_RANGE) {
                if (!Memory.warMode) {
                    creep.travelTo(closestDamagedStructure, {
                        maxRooms: 1,
                        range: 1
                    });
                } else {
                    creep.travelTo(closestDamagedStructure, {
                        maxRooms: 1
                    });
                }
            }
        } else if (!closestDamagedStructure || closestDamagedStructure.hits == closestDamagedStructure.hitsMax) {
            Memory.repairTarget[creep.room.name] = undefined;
        }
    }
}

module.exports = creep_repair;