const { withdrawEnergy, getStorageTarget, findEnergySink, handleMovementCoordination } = require('creep.logistics');

module.exports = {
    run: function(creep) {
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'muleNearDeath') {
            creep.memory.priority = 'muleNearDeath';
        }
        if (_.sum(creep.carry) <= 15) {
            creep.memory.structureTarget = undefined;
            let linkTarget = creep.memory.linkSource ? Game.getObjectById(creep.memory.linkSource) : undefined;
            if (!withdrawEnergy(creep, linkTarget, { ignoreRoads: true })) {
                let storageTarget = getStorageTarget(creep);
                if (storageTarget && storageTarget.store[RESOURCE_ENERGY] >= 50) {
                    withdrawEnergy(creep, storageTarget, { maxRooms: 1 });
                } else {
                    var spawnTarget = Game.getObjectById(creep.memory.fromSpawn);
                    if (spawnTarget && !creep.pos.inRangeTo(spawnTarget, 3)) {
                        creep.travelTo(spawnTarget, { maxRooms: 1, range: 3 });
                    } else {
                        // Listen for other creeps needing to move when idle
                        handleMovementCoordination(creep);
                    }
                }
            }
        } else {
            if (creep.carry[RESOURCE_ENERGY] == 0) {
                var currentlyCarrying = _.findKey(creep.carry);
                var target = creep.room.terminal || creep.room.storage;
                if (target && currentlyCarrying) {
                    if (creep.transfer(target, currentlyCarrying) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(target, { maxRooms: 1 });
                    }
                }
            } else {
                var savedTarget = Game.getObjectById(creep.memory.structureTarget)
                var getNewStructure = false;
                if (savedTarget) {
                    if (creep.build(savedTarget) == ERR_INVALID_TARGET) {
                        //Only other blocker is build.
                        // repair() returns OK (and is billed) even on full-hit targets in range.
                        if (savedTarget.hits < savedTarget.hitsMax) {
                            creep.repair(savedTarget);
                        }

                        if (savedTarget.structureType != STRUCTURE_CONTAINER && savedTarget.structureType != STRUCTURE_STORAGE && savedTarget.structureType != STRUCTURE_CONTROLLER) {
                            //Storing in spawn/extension/tower/link
                            if (creep.transfer(savedTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE && savedTarget.energy < savedTarget.energyCapacity) {
                                creep.travelTo(savedTarget, {
                                    maxRooms: 1
                                });
                            } else {
                                //assumed OK, drop target
                                creep.memory.structureTarget = undefined;
                                getNewStructure = true;
                            }
                        } else {
                            //Upgrading controller
                            if (Memory.linkList[creep.room.name].length > 1) {
                                var upgraderLink = Game.getObjectById(Memory.linkList[creep.room.name][1]);
                                if (upgraderLink && upgraderLink.energy < 100) {
                                    if (creep.transfer(upgraderLink, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                        creep.travelTo(upgraderLink, {
                                            maxRooms: 1
                                        });
                                    }
                                } else if (creep.upgradeController(savedTarget) == ERR_NOT_IN_RANGE) {
                                    if (Game.flags[creep.room.name + "Controller"]) {
                                        creep.travelTo(Game.flags[creep.room.name + "Controller"], {
                                            maxRooms: 1
                                        });
                                    } else {
                                        creep.travelTo(savedTarget, {
                                            maxRooms: 1
                                        });
                                    }
                                }
                            }
                        }
                    } else {
                        let bResult = creep.build(savedTarget);
                        if (bResult == ERR_NOT_IN_RANGE) {
                            creep.travelTo(savedTarget, {
                                maxRooms: 1
                            });
                        } else if (bResult != OK) {
                            creep.memory.structureTarget = undefined;
                        } else if (savedTarget.structureType == STRUCTURE_RAMPART) {
                            //Become a repair drone
                            creep.memory.priority = 'repair';
                            creep.memory.previousPriority = 'mule';
                            Memory.repairTarget[creep.room.name] = undefined;
                        }
                    }
                } else {
                    creep.memory.structureTarget = undefined;
                }
                //Immediately find a new target if previous transfer worked
                if (!creep.memory.structureTarget) {
                    // Same target set in war and peace; skip the structure just filled.
                    var targets = findEnergySink(creep, undefined, getNewStructure ? savedTarget.id : undefined);

                    if (targets) {
                        creep.memory.structureTarget = targets.id;
                        if (getNewStructure) {
                            creep.travelTo(targets, {
                                maxRooms: 1
                            });
                        } else if (creep.transfer(targets, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(targets, {
                                maxRooms: 1
                            });
                        } else {
                            creep.memory.structureTarget = undefined;
                        }
                    } else {
                        //Build construction sites (moved up in priority)
                        var targets2 = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
                        if (targets2) {
                            creep.memory.structureTarget = targets2.id;
                            let buildResult = creep.build(targets2)
                            if (buildResult == ERR_NOT_IN_RANGE) {
                                creep.travelTo(targets2, {
                                    maxRooms: 1
                                });
                            } else if (buildResult == ERR_NO_BODYPART) {
                                creep.suicide();
                            } else if (targets2.structureType == STRUCTURE_RAMPART && buildResult == OK) {
                                //Change job to repair, reset room repair target.
                                creep.memory.priority = 'repair';
                                creep.memory.previousPriority = 'mule';
                                Memory.repairTarget[creep.room.name] = undefined;
                            }
                        } else {
                            //Store in terminal
                            let terminalTarget = Game.getObjectById(creep.memory.terminalID)
                            if (terminalTarget) {
                                let targetEnergy = 0;
                                if (creep.room.storage) {
                                    if (creep.room.storage.store[RESOURCE_ENERGY] >= 275000) {
                                        targetEnergy = 60000;
                                    } else if (creep.room.storage.store[RESOURCE_ENERGY] >= 50000) {
                                        targetEnergy = 30000;
                                    }
                                }
                                if (terminalTarget.store[RESOURCE_ENERGY] < targetEnergy && terminalTarget.store.getFreeCapacity() > 5000) {
                                    creep.memory.structureTarget = terminalTarget.id;
                                    if (creep.transfer(terminalTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                        creep.travelTo(terminalTarget, {
                                            maxRooms: 1
                                        });
                                    }
                                } else {
                                    terminalTarget = undefined;
                                }
                            }

                            if (!terminalTarget) {
                                //Store in factory
                                let factoryTarget = undefined;
                                if (Memory.factoryList[creep.room.name]) {
                                    factoryTarget = Game.getObjectById(Memory.factoryList[creep.room.name][0]);
                                }
                                if (factoryTarget && factoryTarget.store[RESOURCE_ENERGY] < 10000 && factoryTarget.store.getFreeCapacity() >= creep.store[RESOURCE_ENERGY]) {
                                    creep.memory.structureTarget = Memory.factoryList[creep.room.name][0];
                                    if (creep.transfer(factoryTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                        creep.travelTo(factoryTarget, {
                                            maxRooms: 1
                                        });
                                    }
                                } else {
                                    factoryTarget = undefined;
                                }

                                if (!factoryTarget) {
                                    targets2 = undefined;
                                    if (creep.room.controller.level == 8) {
                                        targets2 = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                                            filter: (structure) => {
                                                return (structure.structureType == STRUCTURE_POWER_SPAWN ||
                                                    structure.structureType == STRUCTURE_NUKER) && structure.energy < structure.energyCapacity;
                                            }
                                        });
                                    }
                                    if (targets2) {
                                        creep.memory.structureTarget = targets2.id;
                                        if (creep.transfer(targets2, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                            creep.travelTo(targets2, {
                                                maxRooms: 1
                                            });
                                        } else {
                                            creep.memory.structureTarget = undefined;
                                        }
                                    } else {
                                        //Upgrade
                                        if (creep.room.controller.level == 8) {
                                            //Check for nearby link and fill it if possible.
                                            if (Memory.linkList[creep.room.name].length > 1) {
                                                var upgraderLink = Game.getObjectById(Memory.linkList[creep.room.name][1]);
                                                if (upgraderLink && upgraderLink.energy < 200) {
                                                    creep.memory.structureTarget = upgraderLink.id;
                                                    if (creep.transfer(upgraderLink, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                                        creep.travelTo(upgraderLink, {
                                                            maxRooms: 1
                                                        });
                                                    }
                                                } else {
                                                    //Turn into a repair worker temporarily
                                                    creep.memory.priority = 'repair';
                                                    creep.memory.previousPriority = 'mule';
                                                }
                                            }
                                        } else {
                                            creep.memory.structureTarget = creep.room.controller.id;
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
                                            } else if (creep.upgradeController(creep.room.controller) == ERR_NO_BODYPART) {
                                                creep.suicide();
                                            }
                                        }
                                    } //targets2
                                } //FactoryTarget
                            } //TerminalTarget
                        } //targets
                    } //structureTarget
                } //carry energy check
            } //storage target check
        } //carry check

    }
};
