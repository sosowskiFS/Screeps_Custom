var creep_work = {

    /** @param {Creep} creep **/
    run: function(creep, moveRecalc) {

        if (creep.carry.energy > 0) {
            //All creeps check for road under them and repair if needed.
            var someStructure = creep.pos.lookFor(LOOK_STRUCTURES);
            if (someStructure.length && (someStructure[0].hitsMax - someStructure[0].hits >= 600) && someStructure[0].structureType == STRUCTURE_ROAD) {
                creep.repair(someStructure[0]);
            }
        }

        if ((creep.memory.building && creep.carry.energy == 0) || (creep.memory.storing && creep.carry.energy == 0) || (creep.memory.upgrading && creep.carry.energy == 0) || (creep.memory.repairing && creep.carry.energy == 0) || (creep.memory.supplying && creep.carry.energy == 0) || (creep.memory.distributing && creep.carry.energy == 0)) {
            creep.memory.building = false;
            creep.memory.storing = false;
            creep.memory.upgrading = false;
            creep.memory.repairing = false;
            creep.memory.supplying = false;
            creep.memory.distributing = false;
            creep.memory.structureTarget = undefined;
        }
        if (!creep.memory.building && !creep.memory.storing && !creep.memory.upgrading && !creep.memory.repairing && !creep.memory.supplying && !creep.memory.distributing && _.sum(creep.carry) == creep.carryCapacity) {
            switch (creep.memory.priority) {
                case 'builder':
                    creep.memory.building = true;
                    creep.memory.structureTarget = undefined;
                    break;
                case 'harvester':
                    creep.memory.storing = true;
                    creep.memory.structureTarget = undefined;
                    break;
                case 'upgrader':
                    creep.memory.upgrading = true;
                    creep.memory.structureTarget = undefined;
                    break;
                case 'repair':
                    creep.memory.repairing = true;
                    creep.memory.structureTarget = undefined;
                    break;
                case 'supplier':
                    creep.memory.supplying = true;
                    creep.memory.structureTarget = undefined;
                    break;
                case 'distributor':
                    creep.memory.distributing = true;
                    creep.memory.structureTarget = undefined;
                    break;
                default:
                    //fucking what
                    creep.memory.repairing = true;
                    creep.memory.structureTarget = undefined;
                    break;
            }

        }

        //wew lad
        /*if (!creep.room.controller.sign) {
            if(creep.pos.isNearTo(creep.room.controller)) {
                creep.signController(creep.room.controller, 'This is, by far, the most kupo room I\'ve ever seen!');
            }
        }*/

        if (creep.memory.building) {
            var savedTarget = Game.getObjectById(creep.memory.structureTarget)
                //site ID changes when construction is complete, simply check if valid.
            if (savedTarget) {
                var buildResult = creep.build(savedTarget)
                if (buildResult == ERR_NOT_IN_RANGE) {
                    creep.travelTo(savedTarget, {
                        maxRooms: 1
                    });
                } else if (buildResult != OK) {
                    creep.memory.structureTarget = undefined;
                } else if (buildResult == OK && savedTarget.structureType == STRUCTURE_RAMPART) {
                    creep.memory.building = false;
                    creep.memory.repairing = true;
                    creep.memory.holdOneTick = true;
                    creep.memory.structureTarget = undefined;
                }
            } else {
                creep.memory.structureTarget = undefined;
                var targets = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
                if (targets) {
                    creep.memory.structureTarget = targets.id;
                    if (creep.build(targets) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(targets, {
                            maxRooms: 1
                        });
                    }
                } else {
                    //Store in container
                    if (creep.memory.priority == 'harvester') {
                        //Already tried to store, upgrade.
                        creep.memory.building = false;
                        creep.memory.upgrading = true;
                    } else {
                        creep.memory.building = false;
                        creep.memory.storing = true;
                    }
                }
            }
        } else if (creep.memory.storing) {
            var savedTarget = Game.getObjectById(creep.memory.structureTarget)
                //If target is destroyed, this will prevent creep from locking up
            var getNewStructure = false;
            if (savedTarget) {
                if (creep.transfer(savedTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE && savedTarget.energy < savedTarget.energyCapacity) {
                    creep.travelTo(savedTarget, {
                        maxRooms: 1
                    });
                } else {
                    getNewStructure = true;
                    creep.memory.structureTarget = undefined;
                }
            }
            if (!creep.memory.structureTarget) {
                var targets = undefined;
                if (getNewStructure) {
                    if (Memory.warMode) {
                        targets = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                            filter: (structure) => {
                                return (structure.structureType == STRUCTURE_EXTENSION ||
                                    structure.structureType == STRUCTURE_SPAWN || structure.structureType == STRUCTURE_TOWER) && structure.energy < structure.energyCapacity && structure.id != savedTarget.id;
                            }
                        });
                    } else {
                        targets = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                            filter: (structure) => {
                                return (structure.structureType == STRUCTURE_EXTENSION ||
                                    structure.structureType == STRUCTURE_SPAWN) && structure.energy < structure.energyCapacity && structure.id != savedTarget.id;
                            }
                        });
                    }

                } else {
                    if (Memory.warMode) {
                        targets = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                            filter: (structure) => {
                                return (structure.structureType == STRUCTURE_EXTENSION ||
                                    structure.structureType == STRUCTURE_SPAWN || structure.structureType == STRUCTURE_TOWER) && structure.energy < structure.energyCapacity;
                            }
                        });
                    } else {
                        targets = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                            filter: (structure) => {
                                return (structure.structureType == STRUCTURE_EXTENSION ||
                                    structure.structureType == STRUCTURE_SPAWN) && structure.energy < structure.energyCapacity;
                            }
                        });
                    }
                }

                if (targets) {
                    if (getNewStructure) {
                        creep.travelTo(targets, {
                            maxRooms: 1
                        });
                    } else if (creep.transfer(targets, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(targets, {
                            maxRooms: 1
                        });
                        creep.memory.structureTarget = targets.id;
                    }
                } else {
                    targets = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: (structure) => {
                            return (structure.structureType == STRUCTURE_TOWER) && structure.energy < structure.energyCapacity;
                        }
                    });
                    if (targets) {
                        if (creep.transfer(targets, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(targets, {
                                maxRooms: 1
                            });
                            creep.memory.structureTarget = targets.id;
                        }
                    } else {
                        //Containers call a different function to check contents
                        //(WHYYYYY)
                        var containers = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                            filter: (structure) => {
                                return (structure.structureType == STRUCTURE_CONTAINER ||
                                    structure.structureType == STRUCTURE_STORAGE) && structure.store.getFreeCapacity() > 0;
                            }
                        });
                        if (containers && creep.memory.priority == 'harvester') {
                            creep.memory.structureTarget = containers.id;
                            if (creep.transfer(containers, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(containers, {
                                    maxRooms: 1
                                });
                            } else {
                                creep.memory.structureTarget = undefined;
                            }
                        } else if (creep.memory.priority == 'harvester') {
                            //Try to build first      
                            creep.memory.storing = false;
                            creep.memory.building = true;
                            creep.memory.structureTarget = undefined;
                        } else {
                            creep.memory.storing = false;
                            creep.memory.upgrading = true;
                            creep.memory.structureTarget = undefined;
                        }
                    }
                }
            }
        } else if (creep.memory.upgrading) {
            if (Game.flags[creep.room.name + "Controller"]) {
                if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    creep.travelTo(Game.flags[creep.room.name + "Controller"], {
                        maxRooms: 1
                    });
                }
            } else if (!creep.pos.isNearTo(creep.room.controller)) {
                creep.upgradeController(creep.room.controller);
                creep.travelTo(creep.room.controller, {
                    maxRooms: 1
                });
            } else {
                creep.upgradeController(creep.room.controller);
                creep.signController(creep.room.controller, '\u300C\u8F1D\u304F\u732B\u300D(\uFF90\u24DB\u11BD\u24DB\uFF90)\u2727')
            }
        } else if (creep.memory.repairing) {
            if (!creep.memory.holdOneTick) {
                if (creep.memory.structureTarget) {
                    var thisStructure = Game.getObjectById(creep.memory.structureTarget);
                    if (thisStructure) {
                        if (thisStructure.hits == thisStructure.hitsMax) {
                            creep.memory.structureTarget = undefined;
                        } else {
                            creep.repair(thisStructure)
                            creep.travelTo(thisStructure, {
                                maxRooms: 1,
                                range: 1
                            });
                        }
                    } else {
                        creep.memory.structureTarget = undefined;
                    }
                } else {
                    var closestDamagedStructure = creep.room.find(FIND_STRUCTURES, {
                        filter: (structure) => (structure.structureType != STRUCTURE_ROAD) && (structure.hitsMax - structure.hits >= 200)
                    });
                    if (closestDamagedStructure.length > 0) {
                        closestDamagedStructure.sort(repairCompare);
                        creep.memory.structureTarget = closestDamagedStructure[0].id;
                        if (creep.repair(closestDamagedStructure[0]) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(closestDamagedStructure[0], {
                                maxRooms: 1
                            });
                        }
                    } else {
                        creep.memory.repairing = false;
                        creep.memory.upgrading = true;
                    }
                }
            } else {
                creep.memory.holdOneTick = false;
            }
        } else if (creep.memory.supplying) {
            var target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_TOWER) && structure.energy < structure.energyCapacity - 150;
                }
            });
            if (target) {
                if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.travelTo(target, {
                        maxRooms: 1
                    });
                }
            } else if (Game.flags[creep.room.name + "Supply"] && creep.pos != Game.flags[creep.room.name + "Supply"].pos) {
                creep.travelTo(Game.flags[creep.room.name + "Supply"], {
                    maxRooms: 1
                });
            }
        } else if (creep.memory.distributing) {
            if (creep.room.energyAvailable < creep.room.energyCapacityAvailable) {
                var savedTarget = Game.getObjectById(creep.memory.structureTarget);
                var getNewStructure = false;
                //If target is destroyed, this will prevent creep from locking up
                if (savedTarget) {
                    if (creep.transfer(savedTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE && savedTarget.energy < savedTarget.energyCapacity) {
                        creep.travelTo(savedTarget, {
                            ignoreRoads: true,
                            maxRooms: 1
                        });
                    } else {
                        getNewStructure = true;
                        creep.memory.structureTarget = undefined;
                    }
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
                        if (getNewStructure) {
                            creep.travelTo(targets, {
                                ignoreRoads: true,
                                maxRooms: 1
                            });
                            creep.memory.structureTarget = target.id;
                        } else if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(target, {
                                ignoreRoads: true,
                                maxRooms: 1
                            });
                            creep.memory.structureTarget = target.id;
                        }
                    }
                }
            } else if (_.sum(creep.carry) < creep.carryCapacity) {
                //Get from storage
                var storageTarget = creep.room.storage;
                if (storageTarget) {
                    if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(storageTarget, {
                            ignoreRoads: true,
                            maxRooms: 1
                        });
                    }
                }
            } else {
                var homeSpawn = Game.getObjectById(creep.memory.fromSpawn)
                if (homeSpawn && !creep.pos.isNearTo(homeSpawn)) {
                    creep.travelTo(homeSpawn, {
                        ignoreRoads: true,
                        maxRooms: 1
                    });
                }
            }

        } else {
            //Harvest
            var savedTarget = Game.getObjectById(creep.memory.structureTarget)
            if (savedTarget) {
                if (creep.memory.waitingTimer >= 75) {
                    creep.memory.structureTarget = undefined;
                }
                if (savedTarget.structureType == STRUCTURE_CONTAINER || savedTarget.structureType == STRUCTURE_STORAGE) {
                    if (savedTarget.store[RESOURCE_ENERGY] > 0) {
                        if (creep.withdraw(savedTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(savedTarget, {
                                maxRooms: 1
                            });
                        }
                    } else {
                        creep.memory.structureTarget = undefined;
                    }
                } else {
                    var harvestResult = creep.harvest(savedTarget);
                    if (harvestResult == ERR_NOT_IN_RANGE) {
                        creep.travelTo(savedTarget, {
                            maxRooms: 1
                        });
                        if (savedTarget.energy == 0) {
                            creep.memory.structureTarget = undefined;
                        }
                        if (!creep.memory.waitingTimer) {
                            creep.memory.waitingTimer = 0;
                        }
                        creep.memory.waitingTimer = creep.memory.waitingTimer + 1;
                    } else if (harvestResult == OK) {
                        creep.memory.waitingTimer = 0;
                    } else if (harvestResult == ERR_INVALID_TARGET) {
                        if (creep.pickup(savedTarget) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(savedTarget, {
                                maxRooms: 1
                            });
                        }
                    } else {
                        creep.memory.structureTarget = undefined;
                    }
                }
            } else {
                creep.memory.waitingTimer = 0;
                creep.memory.structureTarget = undefined;
                var targets = undefined;
                if (creep.memory.priority != 'harvester') {
                    var targets = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: (structure) => {
                            return (structure.structureType == STRUCTURE_CONTAINER ||
                                structure.structureType == STRUCTURE_STORAGE) && structure.store[RESOURCE_ENERGY] > 0;
                        }
                    });
                    if (targets) {
                        creep.memory.structureTarget = targets.id;
                        if (creep.withdraw(targets, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(targets, {
                                maxRooms: 1
                            });
                        }
                    }
                }
                if (!targets && creep.memory.priority != 'supplier' && creep.memory.priority != 'distributor') {
                    //Mine it yourself
                    var sources = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
                        filter: (thisResource) => (thisResource.resourceType == RESOURCE_ENERGY)
                    });
                    if (Memory.warMode) {
                        sources = undefined;
                    }
                    if (sources) {
                        //If it ain't worth pickin' up, fuck it.
                        if (sources.amount < 100) {
                            sources = undefined;
                        } else {
                            creep.memory.structureTarget = sources.id;
                        }
                    }
                    if (!sources) {
                        sources = Game.getObjectById(creep.memory.sourceLocation)
                    }

                    if (sources) {
                        if (sources.energy == 0) {
                            sources = undefined;
                        } else {
                            creep.memory.structureTarget = sources.id;
                        }
                    }
                    if (!sources) {
                        sources = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
                    }
                    if (!sources) {
                        creep.memory.structureTarget = undefined;
                    }
                    if (!sources && creep.carry.energy > 0) {
                        //At this point there is nothing to gather. Start creeps on their jobs.
                        switch (creep.memory.priority) {
                            case 'builder':
                                creep.memory.building = true;
                                break;
                            case 'harvester':
                                creep.memory.storing = true;
                                break;
                            case 'upgrader':
                                creep.memory.upgrading = true;
                                break;
                            case 'repair':
                                creep.memory.repairing = true;
                                break;
                            default:
                                //fucking what
                                creep.memory.repairing = true;
                                break;
                        }
                    } else if (sources) {
                        creep.memory.structureTarget = sources.id;
                    }
                    var harvestResult = creep.harvest(sources);
                    if (harvestResult == ERR_NOT_IN_RANGE) {
                        creep.travelTo(sources, {
                            maxRooms: 1
                        });
                    } else if (harvestResult == ERR_INVALID_TARGET) {
                        if (creep.pickup(sources) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(sources, {
                                maxRooms: 1
                            });
                        }
                    }
                } else {
                    var homeSpawn = Game.getObjectById(creep.memory.fromSpawn)
                    if (homeSpawn && !creep.pos.isNearTo(homeSpawn)) {
                        creep.travelTo(homeSpawn, {
                            maxRooms: 1
                        });
                    }
                }
            }
        }

        if (Memory.roomsUnderAttack.indexOf(creep.room.name) > -1) {
            var Foe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 10, {
                filter: (eCreep) => ((eCreep.getActiveBodyparts(ATTACK) > 0 || eCreep.getActiveBodyparts(RANGED_ATTACK) > 0) && !Memory.whiteList.includes(eCreep.owner.username))
            });

            if (Foe.length) {
                if (creep.memory.fromSpawn) {
                    var thisSpawn = Game.getObjectById(creep.memory.fromSpawn);
                    if (thisSpawn) {
                        creep.travelTo(spawnTarget, {
                            maxRooms: 1
                        });
                    }
                } else {
                    var spawnTarget = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: (structure) => {
                            return structure.structureType == STRUCTURE_SPAWN;
                        }
                    });
                    if (spawnTarget) {
                        creep.travelTo(spawnTarget, {
                            maxRooms: 1
                        });
                    }
                }
            }
        }

        if (creep.memory.homeRoom && creep.room.name != creep.memory.homeRoom) {
            creep.travelTo(new RoomPosition(25, 25, creep.memory.homeRoom))
        }
    }
};

function repairCompare(a, b) {
    if (a.hits < b.hits)
        return -1;
    if (a.hits > b.hits)
        return 1;
    return 0;
}

module.exports = creep_work;