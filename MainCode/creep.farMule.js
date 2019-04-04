let creep_farMule = {
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

        let roadSearchTarget;

        if (!creep.memory.lastRoom || creep.memory.lastRoom != creep.room.name) {
            creep.memory.didRoadSearch = false;
            creep.memory.lastRoom = creep.room.name;
            //Autogenerate roads
            let someSites = creep.room.find(FIND_CONSTRUCTION_SITES);
            if (someSites.length) {
                creep.memory.lookForSites = true;
            } else {
                creep.memory.lookForSites = false;
            }
        }

        let roadIgnore = false;

        if (creep.carry.energy > 0 && doExcessWork) {
            //All creeps check for road under them and repair if needed.
            let someSite = [];
            if (creep.memory.lookForSites) {
                someSite = creep.pos.findInRange(FIND_CONSTRUCTION_SITES, 3);
            }
            if (someSite.length) {
                creep.build(someSite[0]);
            } else {
                let someStructure = creep.pos.lookFor(LOOK_STRUCTURES);
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
            creep.memory.lookNearby = false;
        }

        if (creep.memory.evadingUntil && creep.memory.evadingUntil > Game.time) {
            creep.memory.didRoadSearch = true;
            creep.memory.doNotRoadSearch = true;
            evadeAttacker(creep, 4, roadIgnore);
        } else {
            if (!creep.memory.storing) {
                //in farRoom, pick up container contents
                if (creep.room.name != creep.memory.destination && creep.memory.containerPosition) {
                    creep.travelTo(new RoomPosition(creep.memory.containerPosition.x, creep.memory.containerPosition.y, creep.memory.containerPosition.roomName), {
                        ignoreRoads: roadIgnore
                    });
                    if (creep.memory.didRoadSearch == false) {
                        if (creep.memory.storageSource) {
                            let storageUnit = Game.getObjectById(creep.memory.storageSource)
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
                    let thisContainer = Game.getObjectById(creep.memory.containerTarget);
                    if (thisContainer) {
                        if (!creep.memory.containerPosition) {
                            creep.memory.containerPosition = thisContainer.pos;
                        }
                        if (_.sum(thisContainer.store) < (creep.carryCapacity - 300) - _.sum(creep.carry)) {
                            creep.travelTo(thisContainer, {
                                ignoreRoads: roadIgnore,
                                range: 1
                            });
                        } else if (Object.keys(thisContainer.store).length > 1) {
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
                                let storageUnit = Game.getObjectById(creep.memory.storageSource)
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
                                    if (creep.memory._storData && creep.pos.x == creep.memory._storData.state[0] && creep.pos.y == creep.memory._storData.state[1]) {
                                        creep.memory._trav.path = creep.memory._storData.path;
                                        creep.memory._trav.state = creep.memory._storData.state;
                                        creep.travelTo(new RoomPosition(creep.memory.storagePosition.x, creep.memory.storagePosition.y, creep.memory.storagePosition.roomName));
                                    } else {
                                        if (!creep.memory._storData) {
                                            creep.memory._storData = {};
                                            creep.travelTo(new RoomPosition(creep.memory.storagePosition.x, creep.memory.storagePosition.y, creep.memory.storagePosition.roomName), {
                                                returnData: creep.memory._storData
                                            });
                                        }
                                    }

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
                        let markedSources = [];
                        if (Game.flags[creep.memory.targetFlag] && Game.flags[creep.memory.targetFlag].room) {
                            markedSources = Game.flags[creep.memory.targetFlag].pos.lookFor(LOOK_SOURCES);
                        }
                        if (markedSources.length) {
                            creep.memory.mineSource = markedSources[0].id;
                        }
                    }

                    let thisSource = Game.getObjectById(creep.memory.mineSource);
                    if (thisSource) {
                        //doReservationCheck(creep);
                        if (creep.pos.inRangeTo(thisSource, 3)) {
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
                                    creep.travelTo(myMiner[0], {
                                        range: 3
                                    });
                                }
                            } else {
                                creep.travelTo(thisSource, {
                                    ignoreRoads: roadIgnore,
                                    range: 3
                                })
                            }
                        } else {
                            creep.travelTo(thisSource, {
                                ignoreRoads: roadIgnore,
                                range: 3
                            })
                        }

                        if (!creep.memory.travelDistance && creep.memory._trav && creep.memory._trav.path) {
                            creep.memory.travelDistance = creep.memory._trav.path.length;
                            creep.memory.deathWarn = (creep.memory.travelDistance + _.size(creep.body) * 3) + 15;
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

                        if (!creep.memory.travelDistance && creep.memory._trav && creep.memory._trav.path) {
                            creep.memory.travelDistance = creep.memory._trav.path.length;
                            creep.memory.deathWarn = (creep.memory.travelDistance + _.size(creep.body) * 3) + 15;
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
                            let thisContainer = Game.getObjectById(creep.memory.containerTarget);
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
                    let didTransfer = false;
                    let storageUnit = Game.getObjectById(creep.memory.storageSource);
                    if (storageUnit) {
                        if (!creep.memory.storagePosition) {
                            creep.memory.storagePosition = storageUnit.pos
                        }
                        if (Object.keys(creep.carry).length > 1) {
                            if (creep.transfer(storageUnit, Object.keys(creep.carry)[1]) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(storageUnit);
                            } else {
                                didTransfer = true;
                            }
                        } else if (Object.keys(creep.carry).length) {
                            let transferResult = creep.transfer(storageUnit, Object.keys(creep.carry)[0])
                            if (transferResult == ERR_NOT_IN_RANGE) {
                                creep.travelTo(storageUnit);
                            } else if (transferResult == OK) {
                                didTransfer = true;
                                creep.memory.doNotRoadSearch = false;
                                if (creep.memory.containerPosition) {
                                    if (creep.memory._contData && creep.memory._contData.state && creep.pos.x == creep.memory._contData.state[0] && creep.pos.y == creep.memory._contData.state[1]) {
                                        creep.memory._trav.path = creep.memory._contData.path;
                                        creep.memory._trav.state = creep.memory._contData.state;
                                        creep.travelTo(new RoomPosition(creep.memory.containerPosition.x, creep.memory.containerPosition.y, creep.memory.containerPosition.roomName), {
                                            ignoreRoads: roadIgnore
                                        });
                                    } else {
                                        if (!creep.memory._contData) {
                                            creep.memory._contData = {};
                                        }
                                        creep.travelTo(new RoomPosition(creep.memory.containerPosition.x, creep.memory.containerPosition.y, creep.memory.containerPosition.roomName), {
                                            ignoreRoads: roadIgnore,
                                            returnData: creep.memory._contData
                                        });
                                    }

                                }
                            }
                        }
                        if (creep.memory.didRoadSearch == false) {
                            if (creep.memory.containerTarget) {
                                let thisContainer = Game.getObjectById(creep.memory.containerTarget);
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
                    if (!didTransfer) {
                        //Distribute into nearby structures
                        if (!creep.memory.lookNearby) {
                            //Don't search for structures until you pass a rampart
                            //This check is cheaper than searching for structures
                            let lookResult = creep.pos.lookFor(LOOK_STRUCTURES);
                            if (lookResult.length) {
                                for (let y = 0; y < lookResult.length; y++) {
                                    if (lookResult[y].structureType == STRUCTURE_RAMPART) {
                                        creep.memory.lookNearby = true;
                                        break;
                                    }
                                }
                            } 
                        } else {
                            let NeedyStructures = creep.pos.findInRange(FIND_MY_STRUCTURES, 1, {
                                filter: (structure) => {
                                    return (structure.structureType == STRUCTURE_EXTENSION ||
                                        structure.structureType == STRUCTURE_SPAWN ||
                                        structure.structureType == STRUCTURE_LAB ||
                                        structure.structureType == STRUCTURE_POWER_SPAWN) && structure.energy < structure.energyCapacity;
                                    }
                            });
                            if (NeedyStructures.length > 0) {
                                creep.transfer(NeedyStructures[0], RESOURCE_ENERGY);
                            }
                        }
                    }
                } else {
                    //Can't see storage, travel to home
                    creep.travelTo(new RoomPosition(25, 25, creep.memory.homeRoom));
                }
            }

            if (_.sum(creep.carry) > creep.carryCapacity - 300 && !creep.memory.didRoadSearch && !creep.memory.doNotRoadSearch && roadSearchTarget) {
                creep.memory.didRoadSearch = true;
                //Autogenerate roads
                //.dest.x, .dest.y, .dest.room
                let thisPath = creep.room.findPath(creep.pos, roadSearchTarget, {
                    ignoreCreeps: true
                });
                for (let thisPos in thisPath) {
                    if (creep.room.createConstructionSite(thisPath[thisPos].x, thisPath[thisPos].y, STRUCTURE_ROAD) == ERR_FULL) {
                        break;
                    }
                    if (thisPath[thisPos].x == 0 || thisPath[thisPos].x == 49 || thisPath[thisPos].y == 0 || thisPath[thisPos].y == 49) {
                        break;
                    }
                }
            }

            if (creep.hits <= (creep.hitsMax - 500)) {
                evadeAttacker(creep, 4, roadIgnore);
            }
        }
    }
};

function evadeAttacker(creep, evadeRange, roadIgnore) {
    let Foe = undefined;
    let closeFoe = undefined;
    let didRanged = false;

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

        creep.travelTo(closeFoe, {
            ignoreRoads: roadIgnore,
            range: 8
        }, true);
    } else if (Memory.FarRoomsUnderAttack.indexOf(creep.room.name) != -1) {
        let UnderAttackPos = Memory.FarRoomsUnderAttack.indexOf(creep.room.name);
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