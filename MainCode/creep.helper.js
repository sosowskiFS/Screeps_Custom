var creep_Helper = {
    run: function(creep) {

        /*let closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
            filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username) && eCreep.owner.username != "Nemah")
        });*/

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
                    let somethingNearby = creep.pos.findClosestByRange(FIND_STRUCTURES, {
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
                if (creep.room.storage && creep.room.storage.store[RESOURCE_ENERGY] >= 400) {
                    if (creep.withdraw(creep.room.storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(creep.room.storage, {
                            ignoreRoads: true
                        });
                    }
                } else if (creep.room.terminal && creep.room.terminal.store[RESOURCE_ENERGY] >= 400) {
                    if (creep.withdraw(creep.room.terminal, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(creep.room.terminal, {
                            ignoreRoads: true
                        });
                    }
                } else if (creep.memory.targetSource) {
                    let thisSource = Game.getObjectById(creep.memory.targetSource);
                    if (thisSource) {
                        if (creep.harvest(thisSource) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(thisSource, {
                                ignoreRoads: true
                            });
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
                            creep.travelTo(roomSources[targetIndex], {
                                ignoreRoads: true
                            });
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
                            creep.travelTo(thisStructure, {
                                ignoreRoads: true
                            });
                        } else if (buildResult == ERR_INVALID_TARGET && thisStructure.energy < thisStructure.energyCapacity) {
                            if (creep.transfer(thisStructure, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(thisStructure, {
                                    ignoreRoads: true
                                });
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
                            creep.travelTo(target, {
                                ignoreRoads: true
                            });
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
                                creep.travelTo(target, {
                                    ignoreRoads: true
                                });
                            }
                        } else if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                            if (Game.flags[creep.room.name + "Controller"]) {
                                creep.travelTo(Game.flags[creep.room.name + "Controller"], {
                                    maxRooms: 1,
                                    ignoreRoads: true
                                });
                            } else {
                                creep.travelTo(creep.room.controller, {
                                    maxRooms: 1,
                                    ignoreRoads: true
                                });
                            }
                        } else {
                            if (creep.room.controller.sign && creep.room.controller.sign.username != "Montblanc") {
                                creep.travelTo(creep.room.controller, {
                                    maxRooms: 1,
                                    ignoreRoads: true
                                });
                                creep.signController(creep.room.controller, '\u300C\u8F1D\u304F\u732B\u300D(\uFF90\u24DB\u11BD\u24DB\uFF90)\u2727');
                            } else if (!creep.room.controller.sign) {
                                creep.travelTo(creep.room.controller, {
                                    maxRooms: 1,
                                    ignoreRoads: true
                                });
                                creep.signController(creep.room.controller, '\u300C\u8F1D\u304F\u732B\u300D(\uFF90\u24DB\u11BD\u24DB\uFF90)\u2727');
                            }
                        }
                    }
                }

                if (_.sum(creep.carry) <= 0) {
                    creep.memory.currentState = 1;
                } else {
                    let someStructure = creep.pos.lookFor(LOOK_STRUCTURES);
                    if (someStructure.length && (someStructure[0].hitsMax - someStructure[0].hits >= 800)) {
                        creep.repair(someStructure[0]);
                    }
                }
            }
        }

        /*if (closeFoe) {
            let closeRange = creep.pos.getRangeTo(closeFoe);
            if (closeRange <= 7) {
                //Dodge away from foe
                let foeDirection = creep.pos.getDirectionTo(closeFoe);
                let y = 0;
                let x = 0;
                switch (foeDirection) {
                    case TOP:
                        y = 5;
                        break;
                    case TOP_RIGHT:
                        y = 5;
                        x = -5;
                        break;
                    case RIGHT:
                        x = -5;
                        break;
                    case BOTTOM_RIGHT:
                        y = -5;
                        x = -5;
                        break;
                    case BOTTOM:
                        y = -5;
                        break;
                    case BOTTOM_LEFT:
                        y = -5;
                        x = 5;
                        break;
                    case LEFT:
                        x = 5;
                        break;
                    case TOP_LEFT:
                        y = 5;
                        x = 5;
                        break;
                }
                x = creep.pos.x + x;
                y = creep.pos.y + y;
                if (x < 0) {
                    x = 0;
                    if (y < 25 && y > 0) {
                        y = y - 1;
                    } else if (y < 49) {
                        y = y + 1;
                    }
                } else if (x > 49) {
                    x = 49;
                    if (y < 25 && y > 0) {
                        y = y - 1;
                    } else if (y < 49) {
                        y = y + 1;
                    }
                }
                if (y < 0) {
                    y = 0;
                    if (x < 25 && x > 0) {
                        x = x - 1;
                    } else if (x < 49) {
                        x = x + 1;
                    }
                } else if (y > 49) {
                    y = 49;
                    if (x < 25 && x > 0) {
                        x = x - 1;
                    } else if (x < 49) {
                        x = x + 1;
                    }
                }

                creep.moveTo(x, y, {
                    ignoreRoads: true
                });
            }
        }*/
    }
};

module.exports = creep_Helper;