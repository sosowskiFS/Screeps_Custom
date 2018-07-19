var creep_Helper = {
    run: function(creep) {
        if (creep.room.name != creep.memory.destination) {
            var thisPortal = undefined;
            if (Game.flags["TakePortal"] && Game.flags["TakePortal"].pos.roomName == creep.pos.roomName) {
                var thisPortal = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (structure) => (structure.structureType == STRUCTURE_PORTAL)
                });
            }
            if (thisPortal) {
                if (creep.memory.path.length && creep.memory.path[0] == creep.room.name) {
                    creep.memory.path.splice(0, 1);
                }
                creep.travelTo(thisPortal)
            } else if (creep.memory.path && creep.memory.path.length) {
                if (creep.memory.path[0] == creep.room.name) {
                    creep.memory.path.splice(0, 1);
                }
                creep.travelTo(new RoomPosition(25, 25, creep.memory.path[0]));
                //creep.travelTo(new RoomPosition(25, 25, creep.memory.destination));
            } else {
                creep.travelTo(new RoomPosition(25, 25, creep.memory.destination));
            }

            if (creep.room.controller && !creep.room.controller.my) {
                if (creep.room.controller.reservation && creep.room.controller.reservation.username == "Montblanc") {
                    //Soak
                } else {
                    var somethingNearby = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: (structure) => (structure.structureType != STRUCTURE_ROAD)
                    });
                    if (somethingNearby) {
                        creep.dismantle(somethingNearby);
                    }
                }
            }
        } else {
            if (!creep.memory.currentState) {
                creep.memory.currentState = 1;
            }
            if (!creep.memory.waitingTimer) {
                creep.memory.waitingTimer = 0;
            }

            if (creep.memory.currentState == 1) {
                if (creep.memory.targetSource) {
                    let thisSource = Game.getObjectById(creep.memory.targetSource);
                    if (thisSource) {
                        if (creep.harvest(thisSource) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(thisSource);
                            creep.memory.waitingTimer++;
                        } else {
                            creep.memory.waitingTimer = 0;
                        }
                        if (thisSource.energy <= 25 || creep.memory.waitingTimer >= 30) {
                            creep.memory.targetSource = undefined;
                        }
                    }
                } else {
                    let roomSources = creep.room.find(FIND_SOURCES, {
                        filter: (tSource) => (tSource.energy >= creep.carryCapacity)
                    });
                    if (roomSources.length) {
                        let targetIndex = 0;
                        if (creep.memory.waitingTimer >= 30 && roomSources.length > 1) {
                            creep.memory.targetSource = roomSources[1].id;
                            targetIndex = 1;
                        } else {
                            creep.memory.targetSource = roomSources[0].id;
                        }
                        creep.memory.waitingTimer = 0;
                        if (creep.harvest(roomSources[targetIndex]) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(roomSources[targetIndex]);
                        }
                    }
                }

                if (_.sum(creep.carry) + (creep.getActiveBodyparts(WORK) * 2) >= creep.carryCapacity) {
                    creep.memory.currentState = 2;
                }
            } else {
                let needSearch = true;
                if (creep.memory.structureTarget) {
                    let thisStructure = Game.getObjectById(creep.memory.structureTarget);
                    if (thisStructure) {
                        needSearch = false;
                        let buildResult = creep.build(thisStructure);
                        if (buildResult == ERR_NOT_IN_RANGE) {
                            creep.travelTo(thisStructure);
                        } else if (buildResult == ERR_INVALID_TARGET && target.energy < target.energyCapacity) {
                            if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(target);
                            } else {
                                creep.memory.structureTarget = undefined;
                            }
                        } else {
                            creep.memory.structureTarget = undefined;
                        }
                    } else {
                        creep.memory.structureTarget = undefined;
                    }
                }

                if (needSearch) {
                    target = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
                    if (target) {
                        creep.memory.structureTarget = target.id;
                        let buildResult = creep.build(target);
                        if (buildResult == ERR_NOT_IN_RANGE) {
                            creep.travelTo(target);
                        } else if (buildResult == ERR_NO_BODYPART) {
                            creep.suicide();
                        }
                    } else {
                        target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                            filter: (structure) => {
                                return structure.structureType == STRUCTURE_TOWER && structure.energy < structure.energyCapacity;
                            }
                        });
                        if (target) {
                            creep.memory.structureTarget = target.id;
                            if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(target);
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
                }

                if (_.sum(creep.carry) <= 0) {
                    creep.memory.currentState = 1;
                }
            }
        }
    }
};

module.exports = creep_Helper;