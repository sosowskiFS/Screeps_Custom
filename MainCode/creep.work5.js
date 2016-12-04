var creep_work5 = {

    /** @param {Creep} creep **/
    run: function(creep, thisSpawn) {

        //wew lad
        /*if (!creep.room.controller.sign) {
            if(creep.pos.isNearTo(creep.room.controller)) {
                creep.signController(creep.room.controller, 'This is, by far, the most kupo room I\'ve ever seen!');
            }
        }*/

        if (creep.memory.priority == 'miner') {
            //React at 120 so that the creep doesn't drop any resources on the ground
            if (_.sum(creep.carry) < 120) {
                var savedTarget = Game.getObjectById(creep.memory.mineSource);
                if (savedTarget) {
                    if (creep.harvest(savedTarget) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(savedTarget, {
                            reusePath: 20
                        });
                    } else if (creep.harvest(savedTarget, RESOURCE_ENERGY) == ERR_NOT_ENOUGH_RESOURCES && _.sum(creep.carry) > 0) {
                        //Source is dry, store what you have.
                        var savedTarget2 = Game.getObjectById(creep.memory.linkSource);
                        if (savedTarget2) {
                            if (creep.transfer(savedTarget2, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.moveTo(targets, {
                                    reusePath: 20
                                });
                            }
                        }
                    }
                }
            } else if (_.sum(creep.carry) >= 120) {
                var savedTarget = Game.getObjectById(creep.memory.linkSource);
                if (savedTarget) {
                    if (creep.transfer(savedTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        //This should never actually fire, if ideal.
                        creep.moveTo(savedTarget);
                    }
                }
            }
        } else if (creep.memory.priority == 'upgrader') {
            if (_.sum(creep.carry) == 0) {
                var linkTarget = Game.getObjectById(creep.memory.linkSource);
                if (linkTarget) {
                    if (linkTarget.energy > 0) {
                        if (creep.withdraw(linkTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(linkTarget, {
                                reusePath: 20
                            });
                        }
                    } else {
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
                } else {
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
            } else if (_.sum(creep.carry) > 0) {
                if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller, {
                        reusePath: 20
                    });
                }
            }
        } else if (creep.memory.priority == 'mule') {
            if (_.sum(creep.carry) == 0) {
                creep.memory.structureTarget = undefined;
                var storageTarget = Game.getObjectById(creep.memory.storageSource);
                if (storageTarget) {
                    if (storageTarget.store[RESOURCE_ENERGY] > 0) {
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
                        if (savedTarget.structureType != STRUCTURE_CONTAINER && savedTarget.structureType != STRUCTURE_STORAGE && savedTarget.structureType != STRUCTURE_CONTROLLER) {
                            //Storing in spawn/extension/tower
                            if (creep.transfer(savedTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.moveTo(savedTarget, {
                                    reusePath: 20
                                });
                            }
                            if (savedTarget.energy == savedTarget.energyCapacity) {
                                creep.memory.structureTarget = undefined;
                            }
                        } else {
                            //Upgrading controller
                            if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                                creep.moveTo(creep.room.controller, {
                                    reusePath: 20
                                });
                            }
                        }
                    } else {
                        if (creep.build(savedTarget) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(savedTarget, {
                                reusePath: 20
                            });
                        }
                    }
                } else {
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
                        }
                        if (targets.energy == targets.energyCapacity) {
                            //If container fills up on this tick, forget it.
                            creep.memory.structureTarget = undefined;
                        }
                    } else {
                        targets3 = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                            filter: (structure) => {
                                return (structure.structureType == STRUCTURE_TOWER) && ((structure.energyCapacity - structure.energy) >= 300);
                            }
                        });
                        if (targets3) {
                            creep.memory.structureTarget = targets3.id;
                            if (creep.transfer(targets3, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.moveTo(targets3);
                            }
                            if (targets3.energy == targets3.energyCapacity) {
                                //If container fills up on this tick, forget it.
                                creep.memory.structureTarget = undefined;
                            }
                        } else {
                            //Store in terminal
                            terminalTarget = Game.getObjectById(creep.memory.terminalID)
                            if (terminalTarget) {
                                if (terminalTarget.store[RESOURCE_ENERGY] < 50000) {
                                    creep.memory.structureTarget = terminalTarget;
                                    if (creep.transfer(terminalTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                        creep.moveTo(terminalTarget, {
                                            reusePath: 20
                                        });
                                    }
                                }
                            } else {
                                //Build
                                var targets2 = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
                                if (targets2) {
                                    creep.memory.structureTarget = targets2.id;
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
        } else if (creep.memory.priority == 'repair') {
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
            } else if (_.sum(creep.carry) >= 40) {
                //Store in terminal
                var savedTarget = Game.getObjectById(creep.memory.terminalID);
                if (savedTarget) {
                    if (creep.transfer(savedTarget, thisMineral.mineralType) == ERR_NOT_IN_RANGE) {
                        //This should never actually fire, if ideal.
                        creep.moveTo(savedTarget);
                    }
                }
            } else {
                //Mine
                var thisExtractor = Game.getObjectById(creep.memory.extractorID);
                if (thisExtractor.cooldown == 0) {
                    if (creep.harvest(thisMineral) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(thisMineral, {
                            reusePath: 20
                        });
                    }
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