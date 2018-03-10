var creep_assattacker = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (Game.flags[creep.memory.homeRoom + "RunningAssault"]) {



            var unboostedTough = 0;
            var unboostedAttack = 0;
            var unboostedMove = 0;
            var unboostedWork = 0;
            var unboostedRanged = 0;

            creep.body.forEach(function(thisPart) {
                if (thisPart.type == ATTACK && !thisPart.boost) {
                    unboostedAttack = unboostedAttack + 1;
                } else if (thisPart.type == TOUGH && !thisPart.boost) {
                    unboostedTough = unboostedTough + 1;
                } else if (thisPart.type == MOVE && !thisPart.boost) {
                    unboostedMove = unboostedMove + 1;
                } else if (thisPart.type == WORK && !thisPart.boost) {
                    unboostedWork = unboostedWork + 1;
                } else if (thisPart.type == RANGED_ATTACK && !thisPart.boost) {
                    unboostedRanged = unboostedRanged + 1;
                }
            });

            var targetFlag = Game.flags[creep.memory.homeRoom + "Assault"];
            if (!targetFlag) {
                for (i = 2; i < 6; i++) {
                    targetFlag = Game.flags[creep.memory.homeRoom + "Assault" + i]
                    if (targetFlag) {
                        break;
                    }
                }
                if (!targetFlag) {
                    //Abort Assault
                    Game.flags[creep.memory.homeRoom + "RunningAssault"].remove();
                    console.log(creep.memory.homeRoom + " unable to find any more marks.");
                }
            }

            var wallFlag = Game.flags[creep.memory.homeRoom + "WallFlag"];
            if (!wallFlag) {
                for (i = 2; i < 6; i++) {
                    wallFlag = Game.flags[creep.memory.homeRoom + "WallFlag" + i]
                    if (wallFlag) {
                        break;
                    }
                }
            }

            if (!creep.memory.healerID && !creep.spawning) {
                var nearbyHealer = creep.pos.findInRange(FIND_MY_CREEPS, 2, {
                    filter: (mCreep) => (mCreep.memory.priority == "asshealer" && mCreep.memory.attackerID == creep.id)
                });
                if (nearbyHealer.length) {
                    creep.memory.healerID = nearbyHealer[0].id;
                }
            }

            var closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
                filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username) && eCreep.owner.username != 'Eiskalt')
            });

            var thisHealer = Game.getObjectById(creep.memory.healerID);
            var healerIsNear = false;
            if (thisHealer) {
                healerIsNear = creep.pos.isNearTo(thisHealer);
            }

            if (Game.flags[creep.memory.homeRoom + "DoBoost"] && unboostedMove > 0 && Game.flags[creep.memory.homeRoom + "RunningAssault"]) {
                var MoveLab = creep.room.find(FIND_MY_STRUCTURES, {
                    filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE)
                });
                if (MoveLab.length && MoveLab[0].mineralAmount > 0) {
                    creep.travelTo(MoveLab[0]);
                    MoveLab[0].boostCreep(creep);
                }
            } else if (Game.flags[creep.memory.homeRoom + "DoBoost"] && unboostedTough > 0 && Game.flags[creep.memory.homeRoom + "RunningAssault"]) {
                var ToughLab = creep.room.find(FIND_MY_STRUCTURES, {
                    filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_GHODIUM_ALKALIDE)
                });
                if (ToughLab.length && ToughLab[0].mineralAmount > 0) {
                    creep.travelTo(ToughLab[0], {
                        ignoreRoads: true
                    });
                    ToughLab[0].boostCreep(creep);
                }
            } else if (Game.flags[creep.memory.homeRoom + "DoBoost"] && unboostedAttack > 0 && Game.flags[creep.memory.homeRoom + "RunningAssault"]) {
                var AttackLab = creep.room.find(FIND_MY_STRUCTURES, {
                    filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_UTRIUM_ACID)
                });
                if (AttackLab.length && AttackLab[0].mineralAmount > 0) {
                    creep.travelTo(AttackLab[0], {
                        ignoreRoads: true
                    });
                    AttackLab[0].boostCreep(creep);
                }
            } else if (Game.flags[creep.memory.homeRoom + "DoBoost"] && unboostedWork > 0 && Game.flags[creep.memory.homeRoom + "RunningAssault"]) {
                var WorkLab = creep.room.find(FIND_MY_STRUCTURES, {
                    filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_ZYNTHIUM_ACID)
                });
                if (WorkLab.length && WorkLab[0].mineralAmount > 0) {
                    creep.travelTo(WorkLab[0], {
                        ignoreRoads: true
                    });
                    WorkLab[0].boostCreep(creep);
                }
            } else if (Game.flags[creep.memory.homeRoom + "DoBoost"] && unboostedRanged > 0 && Game.flags[creep.memory.homeRoom + "RunningAssault"]) {
                var RangedLab = creep.room.find(FIND_MY_STRUCTURES, {
                    filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_KEANIUM_ALKALIDE)
                });
                if (RangedLab.length && RangedLab[0].mineralAmount > 0) {
                    creep.travelTo(RangedLab[0], {
                        ignoreRoads: true
                    });
                    RangedLab[0].boostCreep(creep);
                }
            } else {
                if (targetFlag.pos.roomName == creep.pos.roomName) {
                    //In target room
                    var somethingNearby = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: (structure) => (structure.structureType != STRUCTURE_ROAD)
                    });
                    if (somethingNearby) {
                        creep.dismantle(somethingNearby);
                        creep.attack(somethingNearby)
                    }

                    creep.rangedMassAttack();
                    if (creep.hits < creep.hitsMax - 1700 && Game.flags[creep.memory.homeRoom + "FallBack"] && Game.flags[creep.memory.homeRoom + "FallBack"].pos) {
                        //Fall back
                        creep.travelTo(Game.flags[creep.memory.homeRoom + "FallBack"], {
                            ignoreRoads: true
                        });
                    } else if (!healerIsNear) {
                        if (creep.pos.x == 0 || creep.pos.x == 49 || creep.pos.y == 0 || creep.pos.y == 49) {
                            var xTarget = 0;
                            var yTarget = 0;
                            if (creep.pos.x == 0) {
                                xTarget = 2;
                                yTarget = creep.pos.y;
                            } else if (creep.pos.x == 49) {
                                xTarget = 47;
                                yTarget = creep.pos.y;
                            }
                            if (creep.pos.y == 0) {
                                yTarget = 2;
                                xTarget = creep.pos.x;
                            } else if (creep.pos.y == 49) {
                                yTarget = 47;
                                xTarget = creep.pos.x;
                            }
                            creep.moveTo(xTarget, yTarget);
                        }
                    } else if (healerIsNear) {
                        if (wallFlag && wallFlag.pos.roomName == creep.pos.roomName) {
                            var thisWall = wallFlag.pos.lookFor(LOOK_STRUCTURES);
                            if (thisWall.length) {
                                creep.travelTo(thisWall[0], {
                                    maxRooms: 1
                                });
                                creep.dismantle(thisWall[0]);
                                creep.attack(thisWall[0]);
                            } else {
                                wallFlag.remove();
                            }
                        } else {
                            var eTowers = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                                filter: (structure) => (structure.structureType == STRUCTURE_TOWER)
                            });
                            if (eTowers) {
                                creep.travelTo(eStructures, {
                                    ignoreRoads: true,
                                    maxRooms: 1
                                });
                                creep.dismantle(eStructures);
                                creep.attack(eStructures);
                            } else {
                                var eStructures = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                                    filter: (structure) => (structure.structureType != STRUCTURE_CONTROLLER && structure.structureType != STRUCTURE_WALL && structure.structureType != STRUCTURE_RAMPART && structure.structureType != STRUCTURE_KEEPER_LAIR && structure.structureType != STRUCTURE_EXTRACTOR)
                                });
                                if (eStructures) {
                                    creep.travelTo(eStructures, {
                                        ignoreRoads: true,
                                        maxRooms: 1
                                    });
                                    creep.dismantle(eStructures);
                                    creep.attack(eStructures);
                                } else if (closeFoe) {
                                    creep.moveTo(closeFoe, {
                                        ignoreRoads: true,
                                        maxRooms: 1
                                    });
                                } else if (targetFlag) {
                                    targetFlag.remove();
                                }
                            }

                        }
                    }
                } else if (!healerIsNear) {
                    if (creep.memory.getOutOfStartRoom) {
                        var thisPortal = undefined;
                        if (Game.flags["TakePortal"] && Game.flags["TakePortal"].pos.roomName == creep.pos.roomName) {
                            var thisPortal = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                                filter: (structure) => (structure.structureType == STRUCTURE_PORTAL)
                            });
                        }
                        if (thisPortal) {
                            creep.memory.destination = undefined;
                            creep.memory.usedPortal = true;
                            creep.travelTo(thisPortal);
                        } else if (creep.pos.x == 0 || creep.pos.x == 49 || creep.pos.y == 0 || creep.pos.y == 49) {
                            var xTarget = 0;
                            var yTarget = 0;
                            if (creep.pos.x == 0) {
                                xTarget = 2;
                                yTarget = creep.pos.y;
                            } else if (creep.pos.x == 49) {
                                xTarget = 47;
                                yTarget = creep.pos.y;
                            }
                            if (creep.pos.y == 0) {
                                yTarget = 2;
                                xTarget = creep.pos.x;
                            } else if (creep.pos.y == 49) {
                                yTarget = 47;
                                xTarget = creep.pos.x;
                            }
                            creep.moveTo(xTarget, yTarget);
                        }
                    } else if (Game.flags[creep.memory.homeRoom + "RallyHere"] && Game.flags[creep.memory.homeRoom + "RallyHere"].pos) {
                        creep.travelTo(Game.flags[creep.memory.homeRoom + "RallyHere"], {
                            ignoreRoads: true
                        });
                    }
                } else if (healerIsNear) {
                    if (!creep.memory.getOutOfStartRoom) {
                        creep.memory.getOutOfStartRoom = true;
                    }
                    if (creep.memory.usedPortal == undefined) {
                        creep.memory.usedPortal = false
                    }
                    if (Game.flags["TakePortal"] && Game.flags["TakePortal"].pos.roomName != creep.pos.roomName) {
                        creep.memory.destination = Game.flags["TakePortal"].pos.roomName;
                    }

                    var thisPortal = undefined;
                    if (Game.flags["TakePortal"] && Game.flags["TakePortal"].pos.roomName == creep.pos.roomName) {
                        var thisPortal = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                            filter: (structure) => (structure.structureType == STRUCTURE_PORTAL)
                        });
                    }
                    if (thisPortal) {
                        creep.memory.destination = undefined;
                        creep.memory.usedPortal = true;
                        if (creep.memory.path && creep.memory.path.length && creep.memory.path[0] == creep.room.name) {
                            creep.memory.path.splice(0, 1);
                        }
                        creep.travelTo(thisPortal, {
                            ignoreRoads: true
                        });
                    } else if (targetFlag.pos.roomName != creep.pos.roomName) {
                        /*if (creep.memory.destination && !creep.memory.usedPortal) {
                            creep.travelTo(new RoomPosition(25, 25, creep.memory.destination))
                        } else*/
                        if (creep.memory.path && creep.memory.path.length) {
                            if (creep.memory.path[0] == creep.room.name) {
                                creep.memory.path.splice(0, 1);
                            }
                            creep.travelTo(new RoomPosition(25, 25, creep.memory.path[0]), {
                                ignoreRoads: true
                            });
                        } else if (targetFlag.pos) {
                            if (wallFlag && wallFlag.pos && wallFlag.pos.roomName == targetFlag.pos.roomName) {
                                creep.travelTo(wallFlag, {
                                    ignoreRoads: true
                                });
                            } else {
                                creep.travelTo(targetFlag, {
                                    ignoreRoads: true
                                });
                            }
                        } else {
                            creep.travelTo(new RoomPosition(25, 25, targetFlag.pos.roomName), {
                                ignoreRoads: true
                            });
                        }
                    }
                }
            }

            if (closeFoe) {
                creep.rangedMassAttack();
                creep.attack(closeFoe);
                //prioritize foebashing
                /*var found = closeFoe.pos.lookFor(LOOK_STRUCTURES);
                var hasRampart = false;
                for (var building in found) {
                    if (found[building].structureType == STRUCTURE_RAMPART) {
                        hasRampart = true;
                        break;
                    }
                }
                if (!hasRampart) {
                    creep.attack(closeFoe);
                }*/
            }
        }

    }

};

module.exports = creep_assattacker;