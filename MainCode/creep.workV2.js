var creep_work = {

    /** @param {Creep} creep **/
    run: function(creep, moveRecalc) {
        switch (creep.memory.priority) {
            case 'harvester':
            case 'harvesterNearDeath':
                if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'harvesterNearDeath') {
                    creep.memory.priority = 'harvesterNearDeath';
                }
                let mineTarget = undefined;
                let thisUnit = undefined;

                if (creep.memory.sourceLocation) {
                    mineTarget = Game.getObjectById(creep.memory.sourceLocation);
                    if (mineTarget) {
                        if (creep.harvest(mineTarget) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(Game.flags[creep.memory.targetFlag]);
                        }
                    }
                }
                if (creep.memory.storageUnit && Game.time % 4 == 0) {
                    thisUnit = Game.getObjectById(creep.memory.storageUnit);
                }

                if (thisUnit) {
                    if (thisUnit.structureType == STRUCTURE_CONTAINER) {
                        if (thisUnit.hits < thisUnit.hitsMax) {
                            creep.repair(thisUnit);
                        }
                        if (creep.pos != thisUnit.pos) {
                            creep.travelTo(thisUnit);
                        }
                    } else {
                        //This is a storage Unit
                        creep.transfer(thisUnit, RESOURCE_ENERGY);
                    }
                } else if (!creep.memory.storageUnit && mineTarget && creep.pos.inRangeTo(mineTarget, 1)) {
                    let containers = mineTarget.pos.findInRange(FIND_STRUCTURES, 2, {
                        filter: (structure) => structure.structureType == STRUCTURE_STORAGE
                    });
                    if (!containers.length) {
                        let containers = mineTarget.pos.findInRange(FIND_STRUCTURES, 2, {
                            filter: (structure) => structure.structureType == STRUCTURE_CONTAINER
                        });
                    }
                    if (containers.length) {
                        if (creep.pos != containers[0].pos && containers[0].structureType == STRUCTURE_CONTAINER) {
                            creep.travelTo(containers[0]);
                        }
                        creep.memory.storageUnit = containers[0].id;
                    } else {
                        if (creep.carry[RESOURCE_ENERGY] >= 36) {
                            let sites = mineTarget.pos.findInRange(FIND_CONSTRUCTION_SITES, 2)
                            if (sites.length) {
                                if (creep.build(sites[0]) == ERR_NOT_IN_RANGE) {
                                    creep.travelTo(sites[0]);
                                }
                            } else if (!sites.length) {
                                //Create new container
                                if (creep.pos.isNearTo(mineTarget)) {
                                    creep.room.createConstructionSite(creep.pos.x, creep.pos.y, STRUCTURE_CONTAINER);
                                }
                            }
                        }
                    }
                }
                break;
            case 'supplier':
            case 'supplierNearDeath':
                if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'supplierNearDeath') {
                    creep.memory.priority = 'supplierNearDeath';
                }

                if (!creep.memory.atSpot && Game.flags[creep.room.name + "Supply"] && (creep.pos.x != Game.flags[creep.room.name + "Supply"].pos.x || creep.pos.y != Game.flags[creep.room.name + "Supply"].pos.y)) {
                    creep.travelTo(Game.flags[creep.room.name + "Supply"]);
                } else if (_.sum(creep.carry) == 0) {
                    creep.memory.atSpot = true;
                    //Get from storage
                    var storageTarget = creep.room.storage;
                    if (storageTarget) {
                        if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(storageTarget);
                        }
                    }
                } else if (Memory.towerNeedEnergy[creep.room.name].length) {
                    var target = Game.getObjectById(Memory.towerNeedEnergy[creep.room.name][0]);
                    if (target) {
                        if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(target);
                        }
                    }
                }
                break;
            case 'upgrader':
            case 'upgraderNearDeath':
                if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'upgraderNearDeath') {
                    creep.memory.priority = 'upgraderNearDeath';
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
                } else if (creep.memory.storageTarget) {
                    let thisTarget = Game.getObjectById(creep.memory.storageTarget);
                    if (_.sum(thisTarget.store) > 0) {
                        if (creep.withdraw(thisTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(thisTarget);
                        }
                    } else {
                        creep.memory.storageTarget = findContainerWithEnergy(creep);
                        if (creep.memory.storageTarget) {
                            let thisTarget = Game.getObjectById(creep.memory.storageTarget);
                            if (creep.withdraw(thisTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(thisTarget);
                            }
                        }
                    }
                } else {
                    creep.memory.storageTarget = findContainerWithEnergy(creep);
                    if (creep.memory.storageTarget) {
                        let thisTarget = Game.getObjectById(creep.memory.storageTarget);
                        if (creep.withdraw(thisTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(thisTarget);
                        }
                    }
                }
                break;
            case 'builder':
            case 'builderNearDeath':
                if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'builderNearDeath') {
                    creep.memory.priority = 'builderNearDeath';
                }

                if (_.sum(creep.carry) > 0) {
                    let needSearch = true;
                    if (creep.memory.structureTarget) {
                        let thisStructure = Game.getObjectById(creep.memory.structureTarget);
                        if (thisStructure) {
                            needSearch = false;
                            if (creep.build(targets2) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(targets2);
                            }
                        } else {
                            creep.memory.structureTarget = undefined;
                        }
                    }

                    if (needSearch) {
                        target = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
                        if (target) {
                            creep.memory.structureTarget = target.id;
                            if (creep.build(target) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(target);
                            } else if (creep.build(target) == ERR_NO_BODYPART) {
                                creep.suicide();
                            }
                        } else if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                            if (Game.flags[creep.room.name + "Controller"]) {
                                creep.travelTo(Game.flags[creep.room.name + "Controller"], {
                                    maxRooms: 1
                                });
                            } else {
                                creep.travelTo(creep.room.controller, {
                                    maxRooms: 1
                                });
                            }
                        }
                    }
                } else if (creep.memory.storageTarget) {
                    creep.memory.structureTarget = undefined;

                    let thisTarget = Game.getObjectById(creep.memory.storageTarget);
                    if (_.sum(thisTarget.store) > 0) {
                        if (creep.withdraw(thisTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(thisTarget);
                        }
                    } else {
                        creep.memory.storageTarget = findContainerWithEnergy(creep);
                        if (creep.memory.storageTarget) {
                            let thisTarget = Game.getObjectById(creep.memory.storageTarget);
                            if (creep.withdraw(thisTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(thisTarget);
                            }
                        }
                    }
                } else {
                    creep.memory.structureTarget = undefined;

                    creep.memory.storageTarget = findContainerWithEnergy(creep);
                    if (creep.memory.storageTarget) {
                        let thisTarget = Game.getObjectById(creep.memory.storageTarget);
                        if (creep.withdraw(thisTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(thisTarget);
                        }
                    }
                }
                break;
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

function findContainerWithEnergy(thisCreep) {
    let storageContainers = thisCreep.room.find(FIND_STRUCTURES, {
        filter: (structure) => (structure.structureType == STRUCTURE_STORAGE || structure.structureType == STRUCTURE_CONTAINER) && _.sum(structure.store) >= thisCreep.carryCapacity
    });
    if (storageContainers.length) {
        return storageContainers[0].id;
    } else {
        return undefined;
    }
}

module.exports = creep_work;