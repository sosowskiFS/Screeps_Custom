var creep_work5 = {

    /** @param {Creep} creep **/
    run: function(creep, thisSpawn) {

        //wew lad
        /*if (!creep.room.controller.sign) {
            if(creep.pos.isNearTo(creep.room.controller)) {
                creep.signController(creep.room.controller, 'This is, by far, the most kupo room I\'ve ever seen!');
            }
        }*/
        if (creep.carry.energy > 0 && creep.memory.priority != 'miner' && creep.memory.priority != 'minerNearDeath') {
            //All creeps check for road under them and repair if needed.
            var someStructure = creep.pos.lookFor(LOOK_STRUCTURES);
            if (someStructure.length && (someStructure[0].hitsMax - someStructure[0].hits >= 600)) {
                creep.repair(someStructure[0]);
            }
        }

        if (creep.memory.priority == 'miner' || creep.memory.priority == 'minerNearDeath') {
            if (creep.ticksToLive <= 60) {
                creep.memory.priority = 'minerNearDeath';
                creep.memory.jobSpecific = creep.memory.jobSpecific + 'NearDeath';
            }
            //Creep will immediately harvest and store mined materials
            var storageTarget = Game.getObjectById(creep.memory.linkSource);
            var mineTarget = Game.getObjectById(creep.memory.mineSource);
            if (mineTarget && storageTarget) {
                if (creep.harvest(mineTarget) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(mineTarget, {
                        reusePath: 20
                    });
                } else if (creep.transfer(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(storageTarget, {
                        reusePath: 20
                    });
                }

            }
        } else if (creep.memory.priority == 'upgrader' || creep.memory.priority == 'upgraderNearDeath') {
            if (creep.ticksToLive <= 60) {
                creep.memory.priority = 'upgraderNearDeath';
            }

            if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, {
                    reusePath: 20
                });
            }

            var linkTarget = Game.getObjectById(creep.memory.linkSource);
            if (linkTarget) {
                if (linkTarget.energy > 0) {
                    if (creep.withdraw(linkTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(linkTarget, {
                            reusePath: 20
                        });
                    }
                } else if (creep.carry.energy == 0) {
                    //Get from storage instead
                    var storageTarget = Game.getObjectById(creep.memory.storageSource);
                    if (storageTarget) {
                        if (storageTarget.store[RESOURCE_ENERGY] >= 150) {
                            if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.moveTo(storageTarget, {
                                    reusePath: 20
                                });
                            }
                        }
                    }
                }
            } else if (creep.carry.energy == 0) {
                var storageTarget = Game.getObjectById(creep.memory.storageSource);
                if (storageTarget) {
                    if (storageTarget.store[RESOURCE_ENERGY] >= 150) {
                        if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(storageTarget, {
                                reusePath: 20
                            });
                        }
                    }
                }
            }
        } else if (creep.memory.priority == 'mule' || creep.memory.priority == 'muleNearDeath') {
            if (creep.ticksToLive <= 60) {
                creep.memory.priority = 'muleNearDeath';
            }
            if (_.sum(creep.carry) == 0) {
                creep.memory.structureTarget = undefined;
                var storageTarget = Game.getObjectById(creep.memory.storageSource);
                if (storageTarget) {
                    if (storageTarget.store[RESOURCE_ENERGY] >= 50) {
                        //Get from container
                        if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(storageTarget, {
                                reusePath: 20
                            });
                        }
                    } else {
                        if (!creep.pos.isNearTo(storageTarget)) {
                            creep.moveTo(storageTarget, {
                                reusePath: 20
                            });
                        }

                    }
                }
            } else if (_.sum(creep.carry) > 0) {
                var savedTarget = Game.getObjectById(creep.memory.structureTarget)

                if (savedTarget) {
                    if (creep.build(savedTarget) == ERR_INVALID_TARGET) {
                        if (creep.memory.lookForNewRampart) {
                            creep.memory.structureTarget = undefined;
                            creep.memory.lookForNewRampart = undefined;
                            var newRampart = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                                filter: (structure) => (structure.structureType == STRUCTURE_RAMPART) && (structure.hits == 1)
                            });
                            if (newRampart) {
                                creep.memory.structureTarget = newRampart.id;
                                if (creep.repair(newRampart) == ERR_NOT_IN_RANGE) {
                                    creep.moveTo(newRampart, {
                                        reusePath: 20
                                    });
                                }
                            }
                        } else if (savedTarget.structureType != STRUCTURE_CONTAINER && savedTarget.structureType != STRUCTURE_STORAGE && savedTarget.structureType != STRUCTURE_CONTROLLER) {
                            //Storing in spawn/extension/tower
                            if (creep.transfer(savedTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.moveTo(savedTarget, {
                                    reusePath: 20
                                });
                            } else {
                                //assumed OK, drop target
                                creep.memory.structureTarget = undefined;
                            }
                        } else {
                            //Upgrading controller
                            if (creep.upgradeController(savedTarget) == ERR_NOT_IN_RANGE) {
                                creep.moveTo(savedTarget, {
                                    reusePath: 20
                                });
                            }
                            //Do repair for new ramparts
                            creep.repair(savedTarget);
                        }
                    } else {
                        if (creep.build(savedTarget) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(savedTarget, {
                                reusePath: 20
                            });
                        } else if (creep.build(savedTarget) != OK) {
                            creep.memory.structureTarget = undefined;
                        }
                    }
                } else {
                    creep.memory.structureTarget = undefined;
                }
                //Immediately find a new target if previous transfer worked
                if (!creep.memory.structureTarget) {
                    var targets = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: (structure) => {
                            return (structure.structureType == STRUCTURE_EXTENSION ||
                                structure.structureType == STRUCTURE_SPAWN) && structure.energy < structure.energyCapacity;
                        }
                    });
                    if (targets) {
                        creep.memory.structureTarget = targets.id;
                        if (creep.transfer(targets, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(targets);
                        } else {
                            creep.memory.structureTarget = undefined;
                        }
                    } else {
                        targets3 = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                            filter: (structure) => {
                                return (structure.structureType == STRUCTURE_TOWER) && (structure.energy < structure.energyCapacity);
                            }
                        });
                        if (targets3) {
                            creep.memory.structureTarget = targets3.id;
                            if (creep.transfer(targets3, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.moveTo(targets3);
                            } else {
                                creep.memory.structureTarget = undefined;
                            }
                        } else {
                            //Store in terminal
                            terminalTarget = Game.getObjectById(creep.memory.terminalID)
                            if (terminalTarget) {
                                if (terminalTarget.store[RESOURCE_ENERGY] < 50000) {
                                    creep.memory.structureTarget = terminalTarget.id;
                                    if (creep.transfer(terminalTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                        creep.moveTo(terminalTarget, {
                                            reusePath: 20
                                        });
                                    }
                                } else {
                                    terminalTarget = undefined;
                                }
                            }
                            if (!terminalTarget) {
                                //Build
                                var targets2 = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
                                if (targets2) {
                                    creep.memory.structureTarget = targets2.id;
                                    if (targets2.structureType == STRUCTURE_RAMPART) {
                                        creep.memory.lookForNewRampart = true;
                                    }

                                    if (creep.build(targets2) == ERR_NOT_IN_RANGE) {
                                        creep.moveTo(targets2, {
                                            reusePath: 20
                                        });
                                    }
                                } else {
                                    //Upgrade
                                    creep.memory.structureTarget = creep.room.controller.id;
                                    if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                                        creep.moveTo(creep.room.controller, {
                                            reusePath: 20
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } else if (creep.memory.priority == 'repair' || creep.memory.priority == 'repairNearDeath') {
            if (creep.ticksToLive <= 60) {
                creep.memory.priority = 'repairNearDeath';
            }

            if (_.sum(creep.carry) == 0) {
                creep.memory.structureTarget = undefined;
                //Get from storage
                var storageTarget = Game.getObjectById(creep.memory.storageSource);
                if (storageTarget) {
                    if (storageTarget.store[RESOURCE_ENERGY] >= 120) {
                        if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(storageTarget, {
                                reusePath: 20
                            });
                        }
                    } else {
                        if (!creep.pos.isNearTo(storageTarget)) {
                            creep.moveTo(storageTarget, {
                                reusePath: 20
                            });
                        }
                    }
                }
            } else if (creep.memory.structureTarget) {
                var thisStructure = Game.getObjectById(creep.memory.structureTarget);
                if (thisStructure) {
                    if (thisStructure.hits == thisStructure.hitsMax) {
                        creep.memory.structureTarget = undefined;
                    } else {
                        if (creep.repair(thisStructure) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(thisStructure, {
                                reusePath: 20
                            });
                        }
                    }
                }
            } else {
                var closestDamagedStructure = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => (structure.structureType != STRUCTURE_ROAD) && (structure.hitsMax - structure.hits >= 200)
                });
                if (closestDamagedStructure.length > 0) {
                    closestDamagedStructure.sort(repairCompare);
                    creep.memory.structureTarget = closestDamagedStructure[0].id;
                    if (creep.repair(closestDamagedStructure[0]) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(closestDamagedStructure[0], {
                            reusePath: 20
                        });
                    }
                }
            }

        } else if (creep.memory.priority == 'mineralMiner') {
            var thisMineral = Game.getObjectById(creep.memory.mineralID);
            if (thisMineral.mineralAmount == 0) {
                //Nothing left to do
                creep.suicide();
            } else {
                //Creep will immediately harvest and store mined materials
                var storageTarget = Game.getObjectById(creep.memory.terminalID);
                var thisExtractor = Game.getObjectById(creep.memory.extractorID);
                if (thisExtractor.cooldown == 0) {
                    if (creep.harvest(thisMineral) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(thisMineral, {
                            reusePath: 20
                        });
                    }
                }
                if (creep.transfer(storageTarget, thisMineral.mineralType) == ERR_NOT_IN_RANGE) {
                    //This should never actually fire, if ideal.
                    creep.moveTo(storageTarget);
                }
            }
        } else if (creep.memory.priority == 'salvager') {
            var sources = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
            if (!sources && _.sum(creep.carry) == 0) {
                //There's nothing left to do
                creep.suicide();
            } else if (sources && _.sum(creep.carry) < creep.carryCapacity) {
                if (creep.pickup(sources) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(sources);
                }
            }
            if (!sources && _.sum(creep.carry) > 0 || _.sum(creep.carry) == creep.carryCapacity) {
                var storageTarget = Game.getObjectById(creep.memory.storageTarget);
                if (creep.transfer(storageTarget, Object.keys(creep.carry)[0]) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(storageTarget);
                }
            }
        }
    }
};

module.exports = creep_work5;

function repairCompare(a, b) {
    if (a.hits < b.hits)
        return -1;
    if (a.hits > b.hits)
        return 1;
    return 0;
}