var creep_farMule = {
    run: function(creep, doExcessWork) {
        if ((creep.ticksToLive <= creep.memory.deathWarn || creep.getActiveBodyparts(CARRY) <= 2) && creep.memory.priority != 'farMuleNearDeath') {
            creep.memory.priority = 'farMuleNearDeath';
        }

        if (creep.memory.storing == null) {
            creep.memory.storing = false;
        }

        if (creep.memory.didRoadSearch == null) {
            creep.memory.didRoadSearch = true;
        }

        if (creep.memory.doNotRoadSearch == null) {
            creep.memory.doNotRoadSearch = false;
        }

        var roadSearchTarget;

        if (!creep.memory.lastRoom || creep.memory.lastRoom != creep.room.name) {
            creep.memory.didRoadSearch = false;
            creep.memory.lastRoom = creep.room.name;
            //Autogenerate roads
            var someSites = creep.room.find(FIND_CONSTRUCTION_SITES);
            if (someSites.length) {
                creep.memory.lookForSites = true;
            } else {
                creep.memory.lookForSites = false;
            }
        }

        var roadIgnore = false;

        if (creep.carry.energy > 0 && doExcessWork) {
            //All creeps check for road under them and repair if needed.
            var someSite = [];
            if (creep.memory.lookForSites) {
                someSite = creep.pos.findInRange(FIND_CONSTRUCTION_SITES, 3);
            }
            if (someSite.length) {
                creep.build(someSite[0]);
            } else {
                var someStructure = [];
                if (creep.room.name == creep.memory.homeRoom) {
                    someStructure = creep.pos.findInRange(FIND_STRUCTURES, 3, {
                        filter: (structure) => (structure.hitsMax - structure.hits >= 100)
                    });
                } else {
                    someStructure = creep.pos.lookFor(LOOK_STRUCTURES);
                }
                if (someStructure.length && (someStructure[0].hitsMax - someStructure[0].hits >= 100)) {
                    someStructure.sort(repairCompare);
                    creep.repair(someStructure[0]);
                }
            }
        } else if (creep.carry.energy == 0) {
            roadIgnore = true;
        }

        if (((_.sum(creep.carry) > creep.carryCapacity - 300) || (_.sum(creep.carry) > 0 && creep.ticksToLive <= 120)) && !creep.memory.storing && creep.carryCapacity >= 300) {
            creep.memory.storing = true;
        } else if (_.sum(creep.carry) == 0 && creep.memory.storing) {
            creep.memory.storing = false;
        }

        if (creep.memory.evadingUntil && creep.memory.evadingUntil > Game.time) {
            creep.memory.didRoadSearch = true;
            creep.memory.doNotRoadSearch = true;
            evadeAttacker(creep, 4);
        } else {
            if (!creep.memory.storing) {
                //in farRoom, pick up container contents
                if (creep.room.name != creep.memory.destination && creep.memory.containerPosition) {
                    creep.travelTo(new RoomPosition(creep.memory.containerPosition.x, creep.memory.containerPosition.y, creep.memory.containerPosition.roomName), {
                        ignoreRoads: roadIgnore
                    });
                    if (creep.memory.didRoadSearch == false) {
                        if (creep.memory.storageSource) {
                            var storageUnit = Game.getObjectById(creep.memory.storageSource)
                            if ((storageUnit && creep.pos.isNearTo(storageUnit)) || creep.pos.x == 0 || creep.pos.x == 49 || creep.pos.y == 0 || creep.pos.y == 49) {
                                roadSearchTarget = creep.memory.containerPosition;
                            } else {
                                creep.memory.didRoadSearch = true;
                            }
                        } else {
                            creep.memory.didRoadSearch = true;
                        }
                    }
                } else if (creep.memory.containerTarget) {
                    //doReservationCheck(creep);
                    var thisContainer = Game.getObjectById(creep.memory.containerTarget);
                    if (thisContainer) {
                        if (!creep.memory.containerPosition) {
                            creep.memory.containerPosition = thisContainer.pos;
                        }
                        if (Object.keys(thisContainer.store).length > 1) {
                            if (creep.withdraw(thisContainer, Object.keys(thisContainer.store)[1]) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(thisContainer, {
                                    ignoreRoads: roadIgnore
                                });
                            }
                        } else if (Object.keys(thisContainer.store).length && creep.withdraw(thisContainer, Object.keys(thisContainer.store)[0]) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(thisContainer, {
                                ignoreRoads: roadIgnore
                            });
                        } else {
                            //Assume ok, do road search back to home
                            if (creep.memory.didRoadSearch == false && creep.memory.storageSource) {
                                var storageUnit = Game.getObjectById(creep.memory.storageSource)
                                if ((thisContainer && creep.pos.isNearTo(thisContainer)) || creep.pos.x == 0 || creep.pos.x == 49 || creep.pos.y == 0 || creep.pos.y == 49) {
                                    roadSearchTarget = storageUnit.pos;
                                } else {
                                    creep.memory.didRoadSearch = true;
                                }
                            } else {
                                creep.memory.didRoadSearch = true;
                            }

                            if (creep.memory.storagePosition) {
                                //Do not know the creep's carry at this tick, calculate to determine if creep is full
                                if ((_.sum(creep.carry) + _.sum(thisContainer.store)) > creep.carryCapacity - 300) {
                                    creep.travelTo(new RoomPosition(creep.memory.storagePosition.x, creep.memory.storagePosition.y, creep.memory.storagePosition.roomName));
                                }
                            }
                        }
                    } else {
                        //Can't see container, travel to room
                        creep.travelTo(new RoomPosition(25, 25, creep.memory.destination), {
                            ignoreRoads: roadIgnore
                        });
                    }
                } else {
                    //No container yet, move to be near source
                    if (!creep.memory.mineSource) {
                        var markedSources = [];
                        if (Game.flags[creep.memory.targetFlag] && Game.flags[creep.memory.targetFlag].room) {
                            markedSources = Game.flags[creep.memory.targetFlag].pos.lookFor(LOOK_SOURCES);
                        }
                        if (markedSources.length) {
                            creep.memory.mineSource = markedSources[0].id;
                        }
                    }

                    var thisSource = Game.getObjectById(creep.memory.mineSource);
                    if (thisSource) {
                        //doReservationCheck(creep);
                        if (creep.pos.inRangeTo(thisSource, 2)) {
                            //Check for a miner that's working with the same source
                            let myMiner = creep.room.find(FIND_MY_CREEPS, {
                                filter: (thisCreep) => thisCreep.memory.mineSource == creep.memory.mineSource && thisCreep.memory.storageUnit != null
                            })
                            if (myMiner.length) {
                                creep.memory.containerTarget = myMiner[0].memory.storageUnit;
                                let thisUnit = Game.getObjectById(creep.memory.containerTarget);
                                if (thisUnit) {
                                    creep.travelTo(thisUnit);
                                } else {
                                    creep.travelTo(myMiner[0]);
                                }                        
                            } else {
                                creep.travelTo(thisSource, {
                                    ignoreRoads: roadIgnore
                                })
                            }
                        } else {
                            creep.travelTo(thisSource, {
                                ignoreRoads: roadIgnore
                            })
                        }
                    } else {
                        //Can't see source, travel to room.
                        if (Game.flags[creep.memory.targetFlag] && Game.flags[creep.memory.targetFlag].pos) {
                            creep.travelTo(new RoomPosition(Game.flags[creep.memory.targetFlag].pos.x, Game.flags[creep.memory.targetFlag].pos.y, Game.flags[creep.memory.targetFlag].pos.roomName), {
                                ignoreRoads: roadIgnore
                            });
                        } else {
                            creep.travelTo(new RoomPosition(25, 25, creep.memory.destination), {
                                ignoreRoads: roadIgnore
                            });
                        }
                    }
                }
            } else {
                //Drop off energy
                if (creep.room.name != creep.memory.homeRoom && creep.memory.storagePosition) {
                    //doReservationCheck(creep);
                    creep.travelTo(new RoomPosition(creep.memory.storagePosition.x, creep.memory.storagePosition.y, creep.memory.storagePosition.roomName));
                    if (creep.memory.didRoadSearch == false) {
                        if (creep.memory.containerTarget) {
                            var thisContainer = Game.getObjectById(creep.memory.containerTarget);
                            if ((thisContainer && creep.pos.isNearTo(thisContainer)) || creep.pos.x == 0 || creep.pos.x == 49 || creep.pos.y == 0 || creep.pos.y == 49) {
                                roadSearchTarget = creep.memory.storagePosition;
                            } else {
                                creep.memory.didRoadSearch = true;
                            }
                        } else {
                            creep.memory.didRoadSearch = true;
                        }
                    }
                } else if (creep.memory.storageSource) {
                    var storageUnit = Game.getObjectById(creep.memory.storageSource);
                    if (storageUnit) {
                        if (!creep.memory.storagePosition) {
                            creep.memory.storagePosition = storageUnit.pos
                        }
                        if (Object.keys(creep.carry).length > 1) {
                            if (creep.transfer(storageUnit, Object.keys(creep.carry)[1]) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(storageUnit);
                            }
                        } else if (Object.keys(creep.carry).length) {
                            var transferResult = creep.transfer(storageUnit, Object.keys(creep.carry)[0])
                            if (transferResult == ERR_NOT_IN_RANGE) {
                                creep.travelTo(storageUnit);
                                //If room energy not full, check adjacent extentions and transfer into them
                                if (creep.room.energyAvailable < creep.room.energyCapacityAvailable) {
                                    let structList = creep.pos.findInRange(FIND_MY_STRUCTURES, 1, {
                                        filter: (thisStruct) => ((thisStruct.structureType == STRUCTURE_EXTENSION || thisStruct.structureType == STRUCTURE_SPAWN || thisStruct.structureType == STRUCTURE_POWER_SPAWN) && thisStruct.energy < thisStruct.energyCapacity)
                                    });
                                    if (structList.length) {
                                        creep.transfer(structList[0], RESOURCE_ENERGY);
                                    }
                                }
                            } else if (transferResult == OK) {
                                creep.memory.doNotRoadSearch = false;
                                if (creep.memory.containerPosition) {
                                    creep.travelTo(new RoomPosition(creep.memory.containerPosition.x, creep.memory.containerPosition.y, creep.memory.containerPosition.roomName), {
                                        ignoreRoads: roadIgnore
                                    });
                                }
                            }
                        }
                        if (creep.memory.didRoadSearch == false) {
                            if (creep.memory.containerTarget) {
                                var thisContainer = Game.getObjectById(creep.memory.containerTarget);
                                if ((thisContainer && creep.pos.isNearTo(thisContainer)) || creep.pos.x == 0 || creep.pos.x == 49 || creep.pos.y == 0 || creep.pos.y == 49) {
                                    roadSearchTarget = storageUnit.pos;
                                } else {
                                    creep.memory.didRoadSearch = true;
                                }
                            } else {
                                creep.memory.didRoadSearch = true;
                            }
                        }
                    }
                } else {
                    //Can't see storage, travel to home
                    creep.travelTo(new RoomPosition(25, 25, creep.memory.homeRoom));
                }
            }

            if (_.sum(creep.carry) < creep.carryCapacity - 100) {
                if (Game.flags[creep.room.name + "SKRoom"]) {
                    var sources = creep.pos.findInRange(FIND_TOMBSTONES, 5, {
                        filter: (thisTombstone) => (_.sum(thisTombstone.store) > 0)
                    });
                    if (sources.length && Object.keys(sources[0].store).length > 1) {
                        if (creep.withdraw(sources[0], Object.keys(sources[0].store)[1]) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(sources[0], {
                                ignoreRoads: roadIgnore,
                                ignoreCreeps: false
                            });
                        }
                    } else if (sources.length && Object.keys(sources[0].store).length && creep.withdraw(sources[0], Object.keys(sources[0].store)[0]) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(sources[0], {
                            ignoreRoads: roadIgnore,
                            ignoreCreeps: false
                        });
                    }
                } else {
                    var someEnergy = creep.pos.lookFor(LOOK_TOMBSTONES);
                    if (someEnergy.length && _.sum(someEnergy[0].store) > 0) {
                        if (Object.keys(someEnergy[0].store).length > 1) {
                            creep.withdraw(someEnergy[0], Object.keys(someEnergy[0].store)[1]);
                        } else {
                            creep.withdraw(someEnergy[0], Object.keys(someEnergy[0].store)[0])
                        }
                    }
                }
            }
            //}

            if (_.sum(creep.carry) > creep.carryCapacity - 300 && !creep.memory.didRoadSearch && !creep.memory.doNotRoadSearch && roadSearchTarget) {
                creep.memory.didRoadSearch = true;
                //Autogenerate roads
                //.dest.x, .dest.y, .dest.room
                var thisPath = creep.room.findPath(creep.pos, roadSearchTarget, {
                    ignoreCreeps: true
                });
                for (var thisPos in thisPath) {
                    if (creep.room.createConstructionSite(thisPath[thisPos].x, thisPath[thisPos].y, STRUCTURE_ROAD) == ERR_FULL) {
                        break;
                    }
                    if (thisPath[thisPos].x == 0 || thisPath[thisPos].x == 49 || thisPath[thisPos].y == 0 || thisPath[thisPos].y == 49) {
                        break;
                    }
                }
            }
            evadeAttacker(creep, 4);
        }
    }
};

function evadeAttacker(creep, evadeRange) {
    var Foe = undefined;
    var closeFoe = undefined;
    var didRanged = false;

    Foe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, evadeRange, {
        filter: (eCreep) => ((eCreep.getActiveBodyparts(ATTACK) > 0 || eCreep.getActiveBodyparts(RANGED_ATTACK) > 0) && !Memory.whiteList.includes(eCreep.owner.username))
    });

    if (Foe.length) {
        if (Memory.FarRoomsUnderAttack.indexOf(creep.room.name) == -1) {
            Memory.FarRoomsUnderAttack.push(creep.room.name);
        }
        creep.memory.evadingUntil = Game.time + 10;
        closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
            filter: (eCreep) => ((eCreep.getActiveBodyparts(ATTACK) > 0 || eCreep.getActiveBodyparts(RANGED_ATTACK) > 0) && !Memory.whiteList.includes(eCreep.owner.username))
        });
        var foeDirection = creep.pos.getDirectionTo(closeFoe);
        var y = 0;
        var x = 0;
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
    } else if (Memory.FarRoomsUnderAttack.indexOf(creep.room.name) != -1) {
        var UnderAttackPos = Memory.FarRoomsUnderAttack.indexOf(creep.room.name);
        if (UnderAttackPos >= 0) {
            Memory.FarRoomsUnderAttack.splice(UnderAttackPos, 1);
        }
    }
}

function doReservationCheck(creep) {
    if (creep.room.name == creep.memory.destination) {
        if (creep.room.controller && creep.room.controller.reservation) {
            if (creep.room.controller.reservation.ticksToEnd <= 1000 && !Memory.FarClaimerNeeded[creep.room.name]) {
                Memory.FarClaimerNeeded[creep.room.name] = true;
            } else if (Memory.FarClaimerNeeded[creep.room.name]) {
                Memory.FarClaimerNeeded[creep.room.name] = false;
            }
        } else if (creep.room.controller && !Memory.FarClaimerNeeded[creep.room.name]) {
            Memory.FarClaimerNeeded[creep.room.name] = true;
        } else if (!creep.room.controller && Memory.FarClaimerNeeded[creep.room.name]) {
            Memory.FarClaimerNeeded[creep.room.name] = false;
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

function storageCompare(a, b) {
    if (_.sum(a.store) < _.sum(b.store))
        return 1;
    if (_.sum(a.store) > _.sum(b.store))
        return -1;
    return 0;
}


module.exports = creep_farMule;