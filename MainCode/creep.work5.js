var creep_work5 = {

    /** @param {Creep} creep **/
    run: function(creep) {

        if (creep.carry.energy > 0 && creep.memory.priority != 'miner' && creep.memory.priority != 'minerNearDeath') {
            //All creeps check for road under them and repair if needed.
            var someStructure = creep.pos.lookFor(LOOK_STRUCTURES);
            if (someStructure.length && (someStructure[0].hitsMax - someStructure[0].hits >= 600) && someStructure[0].structureType == STRUCTURE_ROAD) {
                creep.repair(someStructure[0]);
            }
        }

        switch (creep.memory.priority) {
            case 'miner':
            case 'minerNearDeath':
                if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'minerNearDeath') {
                    creep.memory.priority = 'minerNearDeath';
                    creep.memory.jobSpecific = creep.memory.jobSpecific + 'NearDeath';
                }

                //Creep will immediately harvest and store mined materials
                var storageTarget = Game.getObjectById(creep.memory.linkSource);
                var mineTarget = Game.getObjectById(creep.memory.mineSource);
                if (mineTarget && storageTarget) {
                    if (storageTarget.structureType == STRUCTURE_LINK) {
                        if (storageTarget.energy == storageTarget.energyCapacity) {
                            return;
                        }
                    }

                    if (mineTarget.energy > 0) {
                        if (creep.harvest(mineTarget) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(mineTarget, {
                                reusePath: 5
                            });
                        }
                    }

                    if (creep.carry.energy >= 48) {
                        if (creep.transfer(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(storageTarget, {
                                reusePath: 5
                            });
                        }
                    }

                    /*if (creep.transfer(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    	if (creep.carry.energy > 0) {
                    		creep.moveTo(storageTarget, {
                    			reusePath: 5
                    		});
                    	} else {
                    		if (creep.harvest(mineTarget) == ERR_NOT_IN_RANGE) {
                    			creep.moveTo(mineTarget, {
                    				reusePath: 5
                    			});
                    		}
                    	}
                    } else if (creep.harvest(mineTarget) == ERR_NOT_IN_RANGE) {
                    	creep.moveTo(mineTarget, {
                    		reusePath: 5
                    	});
                    }*/
                }
                break;
            case 'upgrader':
            case 'upgraderNearDeath':
                if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'upgraderNearDeath') {
                    creep.memory.priority = 'upgraderNearDeath';
                }

                if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    if (Game.flags[creep.room.name + "Controller"]) {
                        creep.moveTo(Game.flags[creep.room.name + "Controller"], {
                            reusePath: 25
                        });
                    } else {
                        creep.moveTo(creep.room.controller, {
                            reusePath: 25
                        });
                    }
                } else {
                    if (Game.time % 2 == 0) {
                        creep.say("\u261D\uD83D\uDE3C", true);
                    } else {
                        creep.say("\uD83D\uDC4C\uD83D\uDE39", true);
                    }
                }

                var linkTarget = Game.getObjectById(creep.memory.linkSource);
                if (linkTarget) {
                    if (creep.withdraw(linkTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(linkTarget, {
                            reusePath: 25
                        });
                    }
                }

                if (!creep.memory.hasBoosted && creep.room.controller.level >= 7 && Memory.labList[creep.room.name].length >= 6 && !creep.memory.previousPriority) {
                    var mineralCost = creep.getActiveBodyparts(WORK) * LAB_BOOST_MINERAL;
                    var energyCost = creep.getActiveBodyparts(WORK) * LAB_BOOST_ENERGY;
                    var upgradeLab = Game.getObjectById(Memory.labList[creep.room.name][4]);
                    if (upgradeLab && upgradeLab.mineralAmount >= mineralCost && upgradeLab.energy >= energyCost) {
                        creep.moveTo(upgradeLab);
                        if (upgradeLab.boostCreep(creep) == OK) {
                            creep.memory.hasBoosted = true;
                        } else {
                            creep.memory.hasBoosted = false;
                        }
                    } else {
                        creep.memory.hasBoosted = true;
                    }
                } else {
                    creep.memory.hasBoosted = true;
                }
                break;
            case 'mule':
            case 'muleNearDeath':
                if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'muleNearDeath') {
                    creep.memory.priority = 'muleNearDeath';
                }
                if (_.sum(creep.carry) == 0) {
                    creep.memory.structureTarget = undefined;
                    var storageTarget = creep.room.storage;
                    if (storageTarget) {
                        if (storageTarget.store[RESOURCE_ENERGY] >= 50) {
                            //Get from container
                            if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.moveTo(storageTarget, {
                                    reusePath: 5
                                });
                            }
                        } else {
                            var spawnTarget = Game.getObjectById(creep.memory.fromSpawn);
                            if (spawnTarget) {
                                if (!creep.pos.isNearTo(spawnTarget)) {
                                    creep.moveTo(spawnTarget, {
                                        reusePath: 5
                                    });
                                }
                            }
                        }
                    }
                } else if (_.sum(creep.carry) > 0) {
                    if (creep.carry[RESOURCE_ENERGY] == 0) {
                        if (creep.room.terminal) {
                            var currentlyCarrying = _.findKey(creep.carry);
                            if (creep.transfer(creep.room.terminal, currentlyCarrying) == ERR_NOT_IN_RANGE) {
                                creep.moveTo(creep.room.terminal, {
                                    reusePath: 5
                                });
                            }
                        } else if (!creep.room.terminal && creep.room.storage) {
                            var currentlyCarrying = _.findKey(creep.carry);
                            if (creep.transfer(creep.room.storage, currentlyCarrying) == ERR_NOT_IN_RANGE) {
                                creep.moveTo(creep.room.storage, {
                                    reusePath: 5
                                });
                            }
                        }
                    } else {
                        var savedTarget = Game.getObjectById(creep.memory.structureTarget)
                        var getNewStructure = false;
                        if (savedTarget) {
                            if (creep.build(savedTarget) == ERR_INVALID_TARGET) {
                                //Only other blocker is build.
                                creep.repair(savedTarget);

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
                                                reusePath: 5
                                            });
                                        }
                                    }
                                } else if (savedTarget.structureType != STRUCTURE_CONTAINER && savedTarget.structureType != STRUCTURE_STORAGE && savedTarget.structureType != STRUCTURE_CONTROLLER) {
                                    //Storing in spawn/extension/tower/link
                                    if (creep.transfer(savedTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE && savedTarget.energy < savedTarget.energyCapacity) {
                                        creep.moveTo(savedTarget, {
                                            reusePath: 5
                                        });
                                    } else {
                                        //assumed OK, drop target
                                        creep.memory.structureTarget = undefined;
                                        getNewStructure = true;
                                    }
                                } else {
                                    //Upgrading controller
                                    if (creep.upgradeController(savedTarget) == ERR_NOT_IN_RANGE) {
                                        if (Game.flags[creep.room.name + "Controller"]) {
                                            creep.moveTo(Game.flags[creep.room.name + "Controller"], {
                                                reusePath: 20
                                            });
                                        } else {
                                            creep.moveTo(savedTarget, {
                                                reusePath: 20
                                            });
                                        }
                                    } else {
                                        //Check for nearby link and fill it if possible.
                                        if (Memory.linkList[creep.room.name].length > 1) {
                                            var upgraderLink = Game.getObjectById(Memory.linkList[creep.room.name][1]);
                                            if (upgraderLink && upgraderLink.energy < 100) {
                                                if (creep.transfer(upgraderLink, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                                    creep.moveTo(upgraderLink);
                                                }
                                            }
                                        }
                                    }
                                    //Do repair for new ramparts
                                    creep.repair(savedTarget);
                                }
                            } else {
                                if (creep.build(savedTarget) == ERR_NOT_IN_RANGE) {
                                    creep.moveTo(savedTarget, {
                                        reusePath: 5
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
                            var targets = undefined;
                            if (Memory.warMode) {
                                if (getNewStructure) {
                                    targets = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                                        filter: (structure) => {
                                            return (structure.structureType == STRUCTURE_EXTENSION ||
                                                structure.structureType == STRUCTURE_SPAWN ||
                                                structure.structureType == STRUCTURE_LAB ||
                                                structure.structureType == STRUCTURE_TOWER) && structure.energy < structure.energyCapacity && structure.id != savedTarget.id;
                                        }
                                    });
                                } else {
                                    targets = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                                        filter: (structure) => {
                                            return (structure.structureType == STRUCTURE_EXTENSION ||
                                                structure.structureType == STRUCTURE_SPAWN ||
                                                structure.structureType == STRUCTURE_LAB ||
                                                structure.structureType == STRUCTURE_TOWER) && structure.energy < structure.energyCapacity;
                                        }
                                    });
                                }
                            } else {
                                if (getNewStructure) {
                                    targets = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                                        filter: (structure) => {
                                            return (structure.structureType == STRUCTURE_EXTENSION ||
                                                structure.structureType == STRUCTURE_SPAWN ||
                                                structure.structureType == STRUCTURE_LAB) && structure.energy < structure.energyCapacity && structure.id != savedTarget.id;
                                        }
                                    });
                                } else {
                                    targets = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                                        filter: (structure) => {
                                            return (structure.structureType == STRUCTURE_EXTENSION ||
                                                structure.structureType == STRUCTURE_SPAWN ||
                                                structure.structureType == STRUCTURE_LAB) && structure.energy < structure.energyCapacity;
                                        }
                                    });
                                }
                            }

                            if (targets) {
                                creep.memory.structureTarget = targets.id;
                                if (creep.transfer(targets, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                    creep.moveTo(targets);
                                } else {
                                    creep.memory.structureTarget = undefined;
                                }
                            } else {
                                //Level8 Structures
                                var targets2;
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
                                        creep.moveTo(targets2);
                                    } else {
                                        creep.memory.structureTarget = undefined;
                                    }
                                } else {
                                    //Build
                                    targets2 = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
                                    if (targets2) {
                                        creep.memory.structureTarget = targets2.id;
                                        if (targets2.structureType == STRUCTURE_RAMPART) {
                                            creep.memory.lookForNewRampart = true;
                                        }

                                        if (creep.build(targets2) == ERR_NOT_IN_RANGE) {
                                            creep.moveTo(targets2, {
                                                reusePath: 20
                                            });
                                        } else if (creep.build(targets2) == ERR_NO_BODYPART) {
                                            creep.suicide();
                                        }
                                    } else {
                                        //Store in terminal
                                        var terminalTarget = Game.getObjectById(creep.memory.terminalID)
                                        if (terminalTarget) {
                                            if (terminalTarget.store[RESOURCE_ENERGY] < 50000 && creep.room.storage && creep.room.storage.store[RESOURCE_ENERGY] >= 50000) {
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
                                            //Upgrade
                                            if (creep.room.controller.level == 8) {
                                                //Check for nearby link and fill it if possible.
                                                if (Memory.linkList[creep.room.name].length > 1) {
                                                    var upgraderLink = Game.getObjectById(Memory.linkList[creep.room.name][1]);
                                                    if (upgraderLink && upgraderLink.energy < 200) {
                                                        creep.memory.structureTarget = upgraderLink.id;
                                                        if (creep.transfer(upgraderLink, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                                            creep.moveTo(upgraderLink);
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
                                                        creep.moveTo(Game.flags[creep.room.name + "Controller"], {
                                                            reusePath: 20
                                                        });
                                                    } else {
                                                        creep.moveTo(creep.room.controller, {
                                                            reusePath: 20
                                                        });
                                                    }
                                                } else if (creep.upgradeController(creep.room.controller) == ERR_NO_BODYPART) {
                                                    creep.suicide();
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                break;
            case 'repair':
            case 'repairNearDeath':
                if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'repairNearDeath') {
                    creep.memory.priority = 'repairNearDeath';
                }

                if (_.sum(creep.carry) == 0) {
                    creep.memory.structureTarget = undefined;
                    if (creep.memory.previousPriority && creep.memory.previousPriority == 'mule') {
                        creep.memory.priority = "mule";
                    } else {
                        //Get from storage
                        var storageTarget = creep.room.storage;
                        if (storageTarget) {
                            if (storageTarget.store[RESOURCE_ENERGY] >= 200) {
                                if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                    creep.moveTo(storageTarget, {
                                        reusePath: 25,
                                        maxRooms: 1
                                    });
                                }
                            } else {
                                var spawnTarget = Game.getObjectById(creep.memory.fromSpawn);
                                if (spawnTarget) {
                                    if (!creep.pos.isNearTo(spawnTarget)) {
                                        creep.moveTo(spawnTarget, {
                                            reusePath: 25,
                                            maxRooms: 1
                                        });
                                    }
                                }
                            }
                        }
                    }
                } else if (creep.memory.structureTarget) {
                    if (creep.memory.previousPriority == 'mule' && creep.carry.energy > 300 && Memory.linkList[creep.room.name].length > 1) {
                        var upgraderLink = Game.getObjectById(Memory.linkList[creep.room.name][1]);
                        if (upgraderLink && upgraderLink.energy < 100) {
                            creep.memory.priority = 'mule';
                            creep.memory.structureTarget = upgraderLink.id;
                            if (creep.transfer(upgraderLink, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.moveTo(upgraderLink);
                            }
                        }
                    } else {
                        var thisStructure = Game.getObjectById(creep.memory.structureTarget);
                        if (thisStructure) {
                            if (thisStructure.hits == thisStructure.hitsMax) {
                                creep.memory.structureTarget = undefined;
                            } else {
                                if (creep.repair(thisStructure) == ERR_NOT_IN_RANGE && Memory.warMode) {
                                    creep.moveTo(thisStructure, {
                                        reusePath: 25,
                                        maxRooms: 1
                                    });
                                } else if (!Memory.warMode) {
                                    if (!creep.pos.isNearTo(thisStructure)) {
                                        creep.moveTo(thisStructure, {
                                            reusePath: 25,
                                            maxRooms: 1
                                        });
                                    }
                                }
                            }
                        } else {
                            creep.memory.structureTarget = undefined;
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
                            creep.moveTo(closestDamagedStructure[0], {
                                reusePath: 25,
                                maxRooms: 1
                            });
                        }
                    }
                }

                if (!creep.memory.hasBoosted && creep.room.controller.level >= 7 && Memory.labList[creep.room.name].length >= 6 && !creep.memory.previousPriority) {
                    var mineralCost = creep.getActiveBodyparts(WORK) * LAB_BOOST_MINERAL;
                    var energyCost = creep.getActiveBodyparts(WORK) * LAB_BOOST_ENERGY;
                    var repairLab = Game.getObjectById(Memory.labList[creep.room.name][5]);
                    if (repairLab && repairLab.mineralAmount >= mineralCost && repairLab.energy >= energyCost) {
                        creep.moveTo(repairLab);
                        if (repairLab.boostCreep(creep) == OK) {
                            creep.memory.hasBoosted = true;
                        } else {
                            creep.memory.hasBoosted = false;
                        }
                    } else {
                        creep.memory.hasBoosted = true;
                    }
                } else {
                    creep.memory.hasBoosted = true;
                }
                break;
            case 'supplier':
            case 'supplierNearDeath':
                if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'supplierNearDeath') {
                    creep.memory.priority = 'supplierNearDeath';
                }

                if (Game.flags[creep.room.name + "Supply"] && (creep.pos.x != Game.flags[creep.room.name + "Supply"].pos.x || creep.pos.y != Game.flags[creep.room.name + "Supply"].pos.y)) {
                    creep.moveTo(Game.flags[creep.room.name + "Supply"]);
                } else if (_.sum(creep.carry) == 0) {
                    //Get from storage
                    var storageTarget = creep.room.storage;
                    if (storageTarget) {
                        if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(storageTarget, {
                                reusePath: 2
                            });
                        }
                    }
                } else {
                    if (Memory.towerNeedEnergy[creep.room.name].length) {
                        var target = Game.getObjectById(Memory.towerNeedEnergy[creep.room.name][0]);
                        if (target) {
                            if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.moveTo(target);
                            }
                        }
                    }
                }

                break;
            case 'distributor':
            case 'distributorNearDeath':
                if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'distributorNearDeath') {
                    creep.memory.priority = 'distributorNearDeath';
                }

                if (_.sum(creep.carry) == 0) {
                    //Get from storage
                    var storageTarget = creep.room.storage;
                    if (storageTarget) {
                        if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(storageTarget, {
                                reusePath: 2
                            });
                        }
                    }
                } else if (creep.room.energyAvailable < creep.room.energyCapacityAvailable) {
                    var savedTarget = Game.getObjectById(creep.memory.structureTarget);
                    var getNewStructure = false;
                    if (savedTarget && savedTarget.energy < savedTarget.energyCapacity) {
                        if (creep.transfer(savedTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(savedTarget);
                        } else {
                            getNewStructure = true;
                            creep.memory.structureTarget = undefined;
                        }
                    } else if (savedTarget) {
                        getNewStructure = true;
                        creep.memory.structureTarget = undefined;
                    }
                    if (!creep.memory.structureTarget) {
                        var target = undefined;
                        if (getNewStructure) {
                            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                                filter: (structure) => {
                                    return (structure.structureType == STRUCTURE_EXTENSION ||
                                        structure.structureType == STRUCTURE_SPAWN) && structure.energy < structure.energyCapacity && structure.id != savedTarget.id;
                                }
                            });
                        } else {
                            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                                filter: (structure) => {
                                    return (structure.structureType == STRUCTURE_EXTENSION ||
                                        structure.structureType == STRUCTURE_SPAWN) && structure.energy < structure.energyCapacity;
                                }
                            });
                        }

                        if (target) {
                            if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.moveTo(target);
                                creep.memory.structureTarget = target.id;
                            }
                        }
                    }
                } else if (_.sum(creep.carry) < creep.carryCapacity) {
                    //Get from storage
                    var storageTarget = creep.room.storage;
                    if (storageTarget) {
                        if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(storageTarget, {
                                reusePath: 2
                            });
                        }
                    }
                } else {
                    var homeSpawn = Game.getObjectById(creep.memory.fromSpawn)
                    if (homeSpawn && !creep.pos.isNearTo(homeSpawn)) {
                        creep.moveTo(homeSpawn);
                    }
                }
                break;
            case 'mineralMiner':
                var thisMineral = Game.getObjectById(creep.memory.mineralID);
                if (thisMineral.mineralAmount == 0 && _.sum(creep.carry) == 0) {
                    //Nothing left to do
                    creep.suicide();
                } else {
                    //Creep will immediately harvest and store mined materials
                    var storageTarget = creep.room.terminal;
                    if (!creep.pos.isNearTo(thisMineral)) {
                        creep.moveTo(thisMineral, {
                            reusePath: 25
                        });
                    } else if (storageTarget && Game.time % 6 == 0) {
                        if (creep.harvest(thisMineral) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(thisMineral, {
                                reusePath: 25
                            });
                        }
                    }
                    if (_.sum(creep.carry) > 0) {
                        if (creep.transfer(storageTarget, thisMineral.mineralType) == ERR_NOT_IN_RANGE) {
                            //This should never actually fire, if ideal.
                            creep.moveTo(storageTarget);
                        }
                    }
                }
                break;
            case 'salvager':
                var sources = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
                if (!sources && _.sum(creep.carry) == 0) {
                    //There's nothing left to do
                    //creep.suicide();
                } else if (sources && _.sum(creep.carry) < creep.carryCapacity) {
                    if (creep.pickup(sources) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(sources, {
                            reusePath: 25
                        });
                    }
                }
                if (!sources && _.sum(creep.carry) > 0 || _.sum(creep.carry) > 100) {
                    var storageTarget = creep.room.storage;
                    if (Object.keys(creep.carry).length > 1) {
                        if (creep.transfer(storageTarget, Object.keys(creep.carry)[1]) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(storageTarget, {
                                reusePath: 25
                            });
                        }
                    } else if (creep.transfer(storageTarget, Object.keys(creep.carry)[0]) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(storageTarget, {
                            reusePath: 25
                        });
                    }
                }
                break;
            case 'labWorker':
            case 'labWorkerNearDeath':
                if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'labWorkerNearDeath') {
                    creep.memory.priority = 'labWorkerNearDeath';
                }

                if (Game.time % 50 == 0 && Game.flags[creep.memory.primaryFlag]) {
                    if (creep.memory.resourceChecks < 28) {
                        var lab1 = Game.getObjectById(creep.memory.lab1);
                        var lab2 = Game.getObjectById(creep.memory.lab2);
                        if (creep.room.terminal.store[creep.memory.mineral3] >= 40000) {
                            //Immediately swap flags
                            creep.memory.resourceChecks = 28;
                            Game.notify('PRODUCTION MAXED: ' + creep.room.name + ' has swapped off ' + creep.memory.primaryFlag + ' New Target : ' + creep.memory.backupFlag);
                        } else if (lab1 && lab2 && (lab1.mineralAmount < 250 || lab2.mineralAmount < 250) && _.sum(creep.carry) == 0) {
                            //tick up, but don't swap yet
                            creep.memory.resourceChecks = creep.memory.resourceChecks + 1;
                            if (creep.memory.resourceChecks >= 28) {
                                Game.notify('NO MATERIALS:' + creep.room.name + ' has swapped off ' + creep.memory.primaryFlag + ' New Target : ' + creep.memory.backupFlag);
                            }
                        }
                    } else {
                        //Still can't find resources, switch flags
                        if (!Game.flags[creep.memory.backupFlag] && Game.flags[creep.memory.primaryFlag]) {
                            creep.room.createFlag(Game.flags[creep.memory.primaryFlag].pos, creep.memory.backupFlag, COLOR_CYAN);
                            Game.flags[creep.memory.primaryFlag].remove();
                        } else if (Game.flags[creep.memory.backupFlag] && Game.flags[creep.memory.primaryFlag]) {
                            //Just in case
                            Game.flags[creep.memory.primaryFlag].remove();
                        }
                    }
                } else if (Game.flags[creep.memory.backupFlag] && Game.flags[creep.memory.primaryFlag]) {
                    //Just in case
                    Game.flags[creep.memory.primaryFlag].remove();
                }

                if (!creep.memory.offlineUntil || (creep.memory.offlineUntil && creep.memory.offlineUntil <= Game.time)) {
                    if (creep.memory.mineral4 == creep.memory.mineral3 || creep.memory.mineral5 == creep.memory.mineral3 || creep.memory.mineral6 == creep.memory.mineral3) {
                        creep.memory.storeProduced = true;
                    } else {
                        creep.memory.storeProduced = false;
                    }

                    var labArray = [];
                    var mineralArray = [];
                    var lab1 = Game.getObjectById(creep.memory.lab1);
                    var lab2 = Game.getObjectById(creep.memory.lab2);
                    var lab3 = Game.getObjectById(creep.memory.lab3);
                    var lab4 = undefined;
                    var lab5 = undefined;
                    var lab6 = undefined;
                    var lab7 = undefined;
                    var lab8 = undefined;
                    var lab9 = undefined;
                    if (creep.memory.lab4) {
                        lab4 = Game.getObjectById(creep.memory.lab4);
                        lab5 = Game.getObjectById(creep.memory.lab5);
                        lab6 = Game.getObjectById(creep.memory.lab6);
                    } else {
                        creep.memory.lab4 = 'XXX';
                        creep.memory.lab5 = 'XXX';
                        creep.memory.lab6 = 'XXX';
                    }

                    if (creep.memory.lab7) {
                        lab7 = Game.getObjectById(creep.memory.lab7);
                        lab8 = Game.getObjectById(creep.memory.lab8);
                        lab9 = Game.getObjectById(creep.memory.lab9);
                    } else {
                        creep.memory.lab7 = 'XXX';
                        creep.memory.lab8 = 'XXX';
                        creep.memory.lab9 = 'XXX';
                    }

                    var alreadyAddedFlag = false;
                    if (lab1 && lab2 && lab3) {
                        if (lab7 && lab8 && lab9) {
                            if (lab7.mineralAmount < lab1.mineralAmount || lab8.mineralAmount < lab2.mineralAmount) {
                                labArray.push(lab7);
                                labArray.push(lab8);
                                labArray.push(lab9);
                                mineralArray.push(creep.memory.mineral7);
                                mineralArray.push(creep.memory.mineral8);
                                mineralArray.push(creep.memory.mineral9);
                                labArray.push(lab1);
                                labArray.push(lab2);
                                labArray.push(lab3);
                                mineralArray.push(creep.memory.mineral1);
                                mineralArray.push(creep.memory.mineral2);
                                mineralArray.push(creep.memory.mineral3);
                                alreadyAddedFlag = true;
                            } else {
                                labArray.push(lab1);
                                labArray.push(lab2);
                                labArray.push(lab3);
                                mineralArray.push(creep.memory.mineral1);
                                mineralArray.push(creep.memory.mineral2);
                                mineralArray.push(creep.memory.mineral3);
                                labArray.push(lab7);
                                labArray.push(lab8);
                                labArray.push(lab9);
                                mineralArray.push(creep.memory.mineral7);
                                mineralArray.push(creep.memory.mineral8);
                                mineralArray.push(creep.memory.mineral9);
                                alreadyAddedFlag = true;
                            }
                        } else {
                            labArray.push(lab1);
                            labArray.push(lab2);
                            labArray.push(lab3);
                            mineralArray.push(creep.memory.mineral1);
                            mineralArray.push(creep.memory.mineral2);
                            mineralArray.push(creep.memory.mineral3);
                        }
                    }
                    if (lab4 && lab5 && lab6) {
                        labArray.push(lab4);
                        labArray.push(lab5);
                        labArray.push(lab6);
                        mineralArray.push(creep.memory.mineral4);
                        mineralArray.push(creep.memory.mineral5);
                        mineralArray.push(creep.memory.mineral6);
                    }
                    if (!alreadyAddedFlag && lab7 && lab8 && lab9) {
                        labArray.push(lab7);
                        labArray.push(lab8);
                        labArray.push(lab9);
                        mineralArray.push(creep.memory.mineral7);
                        mineralArray.push(creep.memory.mineral8);
                        mineralArray.push(creep.memory.mineral9);
                    }
                    var checkForMoreWork = false;
                    var foundWork = false;

                    var thisTarget = undefined;
                    if (creep.memory.structureTarget) {
                        thisTarget = Game.getObjectById(creep.memory.structureTarget);
                    }

                    if (thisTarget) {
                        if (creep.memory.direction == 'Withdraw' && creep.memory.priority != 'labWorkerNearDeath') {
                            foundWork = true;
                            var withdrawResult = creep.withdraw(thisTarget, creep.memory.mineralToMove);
                            if (withdrawResult == ERR_NOT_IN_RANGE) {
                                creep.moveTo(thisTarget, {
                                    reusePath: 25,
                                    maxRooms: 1
                                });
                            } else if (withdrawResult != ERR_NOT_IN_RANGE) {
                                creep.memory.structureTarget = undefined;
                                creep.memory.direction = undefined;
                                creep.memory.mineralToMove = undefined;
                            }
                        } else {
                            foundWork = true;
                            var transferResult = creep.transfer(thisTarget, creep.memory.mineralToMove)
                            if (transferResult == ERR_NOT_IN_RANGE) {
                                creep.moveTo(thisTarget, {
                                    reusePath: 25,
                                    maxRooms: 1
                                });
                            } else if (transferResult != ERR_NOT_IN_RANGE) {
                                creep.memory.structureTarget = undefined;
                                creep.memory.direction = undefined;
                                creep.memory.mineralToMove = undefined;
                            }
                        }
                    } else if (_.sum(creep.carry) == 0) {
                        for (var i in labArray) {
                            if (labArray[i].mineralAmount > 0 && labArray[i].mineralType != mineralArray[i]) {
                                foundWork = true;
                                creep.memory.movingOtherMineral = true;
                                var withdrawResult = creep.withdraw(labArray[i], labArray[i].mineralType)
                                if (withdrawResult == ERR_NOT_IN_RANGE) {
                                    creep.moveTo(labArray[i], {
                                        reusePath: 25,
                                        maxRooms: 1
                                    });
                                }
                            }
                        }
                    } else if (creep.memory.movingOtherMineral) {
                        //Drop off "unknown" mineral in terminal
                        foundWork = true;
                        var currentlyCarrying = _.findKey(creep.carry);
                        var transferResult = creep.transfer(creep.room.terminal, currentlyCarrying)
                        if (transferResult == ERR_NOT_IN_RANGE) {
                            creep.moveTo(creep.room.terminal, {
                                reusePath: 25,
                                maxRooms: 1
                            });
                        } else if (transferResult == OK) {
                            creep.memory.movingOtherMineral = false;
                        }
                    } else if (!thisTarget) {
                        creep.memory.structureTarget = undefined;
                        creep.memory.direction = undefined;
                        creep.memory.mineralToMove = undefined;
                    }

                    if (!foundWork) {
                        for (var i in labArray) {
                            //Write a different switch for the war flag
                            switch (labArray[i].id) {
                                case creep.memory.lab1:
                                case creep.memory.lab2:
                                case creep.memory.lab7:
                                case creep.memory.lab8:
                                    //Reagent labs
                                    if (_.sum(creep.carry) == 0 && creep.memory.priority != 'labWorkerNearDeath') {
                                        if (creep.room.terminal.store[creep.memory.mineral3] < 40000 || !creep.room.terminal.store[creep.memory.mineral3]) {
                                            var mineralAmount = mineralArray[i] in creep.room.terminal.store;
                                            if (mineralAmount > 0 && labArray[i].mineralAmount < labArray[i].mineralCapacity - 250) {
                                                creep.memory.structureTarget = creep.room.terminal.id;
                                                creep.memory.direction = 'Withdraw';
                                                creep.memory.mineralToMove = mineralArray[i];
                                                var withdrawResult = creep.withdraw(creep.room.terminal, mineralArray[i])
                                                if (withdrawResult == ERR_NOT_IN_RANGE) {
                                                    creep.moveTo(creep.room.terminal, {
                                                        reusePath: 25,
                                                        maxRooms: 1
                                                    });
                                                }
                                                foundWork = true;
                                            }
                                        }
                                    } else if (creep.carry[mineralArray[i]] && labArray[i].mineralAmount < labArray[i].mineralCapacity - 250) {
                                        creep.memory.structureTarget = labArray[i].id;
                                        creep.memory.direction = 'Transfer';
                                        creep.memory.mineralToMove = mineralArray[i];
                                        var transferResult = creep.transfer(labArray[i], mineralArray[i])
                                        if (transferResult == ERR_NOT_IN_RANGE) {
                                            creep.moveTo(labArray[i], {
                                                reusePath: 25,
                                                maxRooms: 1
                                            });
                                        }
                                        foundWork = true;
                                    }
                                    break;
                                case creep.memory.lab3:
                                case creep.memory.lab9:
                                    if (_.sum(creep.carry) == 0 && creep.memory.priority != 'labWorkerNearDeath') {
                                        var mineralAmount = labArray[i].mineralAmount;
                                        if (mineralAmount >= 250) {
                                            creep.memory.structureTarget = labArray[i].id;
                                            creep.memory.direction = 'Withdraw';
                                            creep.memory.mineralToMove = mineralArray[i];
                                            var withdrawResult = creep.withdraw(labArray[i], labArray[i].mineralType)
                                            if (withdrawResult == ERR_NOT_IN_RANGE) {
                                                creep.moveTo(labArray[i], {
                                                    reusePath: 25,
                                                    maxRooms: 1
                                                });
                                            }
                                            foundWork = true;
                                        }
                                    } else if (creep.carry[mineralArray[i]]) {
                                        if (creep.memory.storeProduced) {
                                            var labAmount = 9999;
                                            if (mineralArray[i] == creep.memory.mineral4) {
                                                labAmount = lab4.mineralAmount;
                                            } else if (mineralArray[i] == creep.memory.mineral5) {
                                                labAmount = lab5.mineralAmount;
                                            } else if (mineralArray[i] == creep.memory.mineral6) {
                                                labAmount = lab6.mineralAmount;
                                            }
                                            if (labAmount <= 2500) {
                                                continue;
                                            }
                                        }

                                        if (mineralArray[i] == RESOURCE_GHODIUM && creep.room.controller.level == 8 && Memory.nukerList[creep.room.name].length) {
                                            var thisNuker = Game.getObjectById(Memory.nukerList[creep.room.name][0]);
                                            if (thisNuker && thisNuker.ghodiumCapacity > thisNuker.ghodium) {
                                                creep.memory.structureTarget = thisNuker.id;
                                                creep.memory.direction = 'Transfer';
                                                creep.memory.mineralToMove = RESOURCE_GHODIUM;
                                                if (creep.transfer(thisNuker, mineralArray[i]) == ERR_NOT_IN_RANGE) {
                                                    creep.moveTo(thisNuker, {
                                                        reusePath: 25,
                                                        maxRooms: 1
                                                    });
                                                }
                                                foundWork = true;
                                                continue;
                                            }
                                        }

                                        creep.memory.structureTarget = creep.room.terminal.id;
                                        creep.memory.direction = 'Transfer';
                                        creep.memory.mineralToMove = mineralArray[i];
                                        if (creep.transfer(creep.room.terminal, mineralArray[i]) == ERR_NOT_IN_RANGE) {
                                            creep.moveTo(creep.room.terminal, {
                                                reusePath: 25,
                                                maxRooms: 1
                                            });
                                        }
                                        foundWork = true;
                                    }
                                    //Result labs
                                    break;
                                case creep.memory.lab4:
                                case creep.memory.lab5:
                                case creep.memory.lab6:
                                    //Boost labs
                                    if (_.sum(creep.carry) == 0 && creep.memory.priority != 'labWorkerNearDeath') {
                                        var minAmount = mineralArray[i] in creep.room.terminal.store;
                                        var minLab = labArray[i].mineralAmount;
                                        if (minLab <= 2500 && minAmount > 0) {
                                            creep.memory.structureTarget = creep.room.terminal.id;
                                            creep.memory.direction = 'Withdraw';
                                            creep.memory.mineralToMove = mineralArray[i];
                                            var withdrawResult = creep.withdraw(creep.room.terminal, mineralArray[i]);
                                            if (withdrawResult == ERR_NOT_IN_RANGE) {
                                                creep.moveTo(creep.room.terminal, {
                                                    reusePath: 25,
                                                    maxRooms: 1
                                                });
                                            }
                                            foundWork = true;
                                        }
                                    } else {
                                        var carryAmount = mineralArray[i] in creep.carry;
                                        if (carryAmount > 0) {
                                            creep.memory.structureTarget = labArray[i].id;
                                            creep.memory.direction = 'Transfer';
                                            creep.memory.mineralToMove = mineralArray[i];
                                            var transferResult = creep.transfer(labArray[i], mineralArray[i]);
                                            if (transferResult == ERR_NOT_IN_RANGE) {
                                                creep.moveTo(labArray[i], {
                                                    reusePath: 25,
                                                    maxRooms: 1
                                                });
                                            }
                                            foundWork = true;
                                        }
                                    }
                                    break;
                            }
                            if (foundWork) {
                                break;
                            }
                        }
                    }

                    if (!foundWork && creep.room.storage && _.sum(creep.room.storage.store) != creep.room.storage.store[RESOURCE_ENERGY]) {
                        if (Object.keys(creep.room.storage.store).length > 1 && Object.keys(creep.room.storage.store)[1] != RESOURCE_ENERGY) {
                            var withdrawResult = creep.withdraw(creep.room.storage, Object.keys(creep.room.storage.store)[1]);
                            if (withdrawResult == ERR_NOT_IN_RANGE) {
                                creep.moveTo(creep.room.storage);
                            } else if (withdrawResult != ERR_NOT_IN_RANGE) {
                                creep.moveTo(creep.room.terminal);
                                creep.memory.movingOtherMineral = true;
                            }
                        }
                    } else if (!foundWork && creep.room.controller.level == 8 && Memory.nukerList[creep.room.name].length) {
                        //creep.room.terminal.store[creep.memory.mineral3]
                        var thisNuker = Game.getObjectById(Memory.nukerList[creep.room.name][0])
                        if (thisNuker && thisNuker.ghodiumCapacity > thisNuker.ghodium && !creep.carry[RESOURCE_GHODIUM] && creep.room.terminal.store[RESOURCE_GHODIUM]) {
                            creep.memory.structureTarget = creep.room.terminal.id;
                            creep.memory.direction = 'Withdraw';
                            creep.memory.mineralToMove = RESOURCE_GHODIUM;
                        } else if (thisNuker && thisNuker.ghodiumCapacity > thisNuker.ghodium && creep.carry[RESOURCE_GHODIUM]) {
                            creep.memory.structureTarget = thisNuker.id;
                            creep.memory.direction = 'Transfer';
                            creep.memory.mineralToMove = RESOURCE_GHODIUM;
                        } else if (thisNuker && thisNuker.ghodiumCapacity == thisNuker.ghodium && creep.carry[RESOURCE_GHODIUM]) {
                            creep.memory.structureTarget = creep.room.terminal.id;
                            creep.memory.direction = 'Transfer';
                            creep.memory.mineralToMove = RESOURCE_GHODIUM;
                        } else {
                            creep.memory.offlineUntil = Game.time + 10;
                        }
                    } else if (!foundWork) {
                        creep.memory.offlineUntil = Game.time + 10;
                    }
                }

                break;
        }

        if (Memory.roomsUnderAttack.indexOf(creep.room.name) > -1 && creep.memory.priority != 'repair' && creep.memory.priority != 'distributor') {
            var Foe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 7, {
                filter: (eCreep) => ((eCreep.getActiveBodyparts(ATTACK) > 0 || eCreep.getActiveBodyparts(RANGED_ATTACK) > 0) && !Memory.whiteList.includes(eCreep.owner.username))
            });

            if (Foe.length) {
                if (creep.memory.fromSpawn) {
                    var thisSpawn = Game.getObjectById(creep.memory.fromSpawn);
                    if (thisSpawn) {
                        creep.moveTo(spawnTarget);
                    }
                } else {
                    var spawnTarget = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: (structure) => {
                            return structure.structureType == STRUCTURE_SPAWN;
                        }
                    });
                    if (spawnTarget) {
                        creep.moveTo(spawnTarget);
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