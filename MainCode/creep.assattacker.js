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

            if (creep.memory.previousRoom != creep.room.name) {
                creep.memory.previousRoom = creep.room.name;
                creep.memory._trav = undefined;
            }

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
                    creep.memory.isReserved = true;
                }
            }

            var closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
                filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
            });

            var thisHealer = Game.getObjectById(creep.memory.healerID);
            var otherHealers = creep.pos.findInRange(FIND_MY_CREEPS, 1, {
                filter: (mCreep) => (mCreep.memory.priority == "asshealer" && mCreep.memory.attackerID != creep.id)
            });
            var healerIsNear = false;
            let healerIsGood = false;
            if (thisHealer) {
                healerIsNear = creep.pos.isNearTo(thisHealer);
                if (thisHealer.fatigue <= 0) {
                    healerIsGood = true;
                }
            } else if (thisHealer && otherHealers.length) {
                healerIsNear = true;
            } else if (!thisHealer) {
                creep.memory.healerID = undefined;
            }

            if (Game.flags[creep.memory.homeRoom + "DoBoost"] && (unboostedMove > 0 || unboostedTough > 0 || unboostedAttack > 0 || unboostedWork > 0 || unboostedRanged > 0)) {
                let MoveLab = creep.room.find(FIND_MY_STRUCTURES, {
                    filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE)
                });
                let ToughLab = creep.room.find(FIND_MY_STRUCTURES, {
                    filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_GHODIUM_ALKALIDE)
                });
                let AttackLab = creep.room.find(FIND_MY_STRUCTURES, {
                    filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_UTRIUM_ACID)
                });
                let WorkLab = creep.room.find(FIND_MY_STRUCTURES, {
                    filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_ZYNTHIUM_ACID)
                });
                let RangedLab = creep.room.find(FIND_MY_STRUCTURES, {
                    filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_KEANIUM_ALKALIDE)
                });
                let hasTraveled = false;
                if (MoveLab.length && unboostedMove > 0) {
                    MoveLab[0].boostCreep(creep);
                    creep.travelTo(MoveLab[0]);
                    hasTraveled = true;
                }
                if (ToughLab.length && unboostedTough > 0) {
                    if (!hasTraveled) {
                        creep.travelTo(ToughLab[0], {
                            ignoreRoads: true
                        });
                        hasTraveled = true;
                    }
                    ToughLab[0].boostCreep(creep);
                }
                if (RangedLab.length && unboostedRanged > 0) {
                    if (!hasTraveled) {
                        creep.travelTo(RangedLab[0], {
                            ignoreRoads: true
                        });
                        hasTraveled = true;
                    }
                    RangedLab[0].boostCreep(creep);
                }
                if (AttackLab.length && unboostedAttack > 0) {
                    if (!hasTraveled) {
                        creep.travelTo(AttackLab[0], {
                            ignoreRoads: true
                        });
                        hasTraveled = true;
                    }
                    AttackLab[0].boostCreep(creep);
                }
                if (WorkLab.length && unboostedWork > 0) {
                    if (!hasTraveled) {
                        creep.travelTo(WorkLab[0], {
                            ignoreRoads: true
                        });
                        hasTraveled = true;
                    }
                    WorkLab[0].boostCreep(creep);
                }
            } else {
                if (targetFlag.pos.roomName == creep.pos.roomName) {
                    //In target room

                    if (Game.time % 2 == 0) {
                        creep.say("(=\uFF40\u03C9\u00B4=)", true);
                    } else {
                        creep.say("(=\u00B4\u2207\uFF40=)", true);
                    }

                    //Cancel this flag if room is in safe mode
                    if (creep.room.controller.safeMode) {
                        targetFlag.remove();
                        return;
                    }

                    var didDismantle = false;
                    if (wallFlag && wallFlag.pos.roomName == creep.pos.roomName) {
                        var thisWall = wallFlag.pos.lookFor(LOOK_STRUCTURES);
                        if (thisWall.length && creep.pos.isNearTo(thisWall[0])) {
                            creep.dismantle(thisWall[0]);
                            creep.attack(thisWall[0]);
                            creep.rangedAttack(thisWall[0]);
                            didDismantle = true;
                        }
                    }

                    if (!didDismantle) {
                        var somethingNearby = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                            filter: (structure) => (structure.structureType != STRUCTURE_ROAD)
                        });
                        if (somethingNearby) {
                            creep.dismantle(somethingNearby);
                            creep.attack(somethingNearby);
                            creep.rangedAttack(somethingNearby);
                        }
                    }

                    //creep.rangedMassAttack();
                    if (creep.hits < creep.hitsMax - 900 && Game.flags[creep.memory.homeRoom + "FallBack"] && Game.flags[creep.memory.homeRoom + "FallBack"].pos) {
                        //Fall back
                        creep.travelTo(Game.flags[creep.memory.homeRoom + "FallBack"], {
                            ignoreRoads: true,
                            stuckValue: 2,
                            allowSK: true
                        });
                    } else if (!healerIsNear) {
                        if (creep.pos.x == 0 || creep.pos.x == 49 || creep.pos.y == 0 || creep.pos.y == 49) {
                            let xTarget = 0;
                            let yTarget = 0;
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
                            let thisWall = wallFlag.pos.lookFor(LOOK_STRUCTURES);
                            if (thisWall.length) {
                                if (healerIsGood) {
                                    creep.travelTo(thisWall[0], {
                                        maxRooms: 1,
                                        stuckValue: 2,
                                        allowSK: true
                                    });
                                }
                                creep.dismantle(thisWall[0]);
                                creep.attack(thisWall[0]);
                                creep.rangedAttack(thisWall[0]);
                            } else {
                                wallFlag.remove();
                            }
                        } else {
                            let eSpawns = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                                filter: (structure) => (structure.structureType == STRUCTURE_SPAWN)
                            });
                            if (eSpawns) {
                                if (healerIsGood) {
                                    creep.travelTo(eSpawns, {
                                        ignoreRoads: true,
                                        maxRooms: 1,
                                        stuckValue: 2,
                                        allowSK: true
                                    });
                                }
                                creep.dismantle(eSpawns);
                                creep.attack(eSpawns);
                                creep.rangedAttack(eSpawns);
                            } else {
                                let eStructures = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                                    filter: (structure) => (structure.structureType != STRUCTURE_CONTROLLER && structure.structureType != STRUCTURE_WALL && structure.structureType != STRUCTURE_RAMPART && structure.structureType != STRUCTURE_KEEPER_LAIR && structure.structureType != STRUCTURE_EXTRACTOR)
                                });
                                if (eStructures) {
                                    if (healerIsGood) {
                                        creep.travelTo(eStructures, {
                                            ignoreRoads: true,
                                            maxRooms: 1,
                                            stuckValue: 2,
                                            allowSK: true
                                        });
                                    }
                                    creep.dismantle(eStructures);
                                    creep.attack(eStructures);
                                    creep.rangedAttack(eStructures);
                                } else if (closeFoe) {
                                    creep.moveTo(closeFoe, {
                                        ignoreRoads: true,
                                        maxRooms: 1,
                                        allowSK: true
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
                        if (healerIsGood) {
                            creep.travelTo(thisPortal, {
                                ignoreRoads: true
                            });
                        }
                    } else if (targetFlag.pos.roomName != creep.pos.roomName) {
                        /*if (creep.memory.destination && !creep.memory.usedPortal) {
                            creep.travelTo(new RoomPosition(25, 25, creep.memory.destination))
                        } else*/
                        if (creep.memory.path && creep.memory.path.length) {
                            if (creep.memory.path[0] == creep.room.name) {
                                creep.memory.path.splice(0, 1);
                            }
                            if (healerIsGood) {
                                creep.travelTo(new RoomPosition(25, 25, creep.memory.path[0]), {
                                    stuckValue: 2,
                                    allowSK: true
                                });
                            }
                        } else if (targetFlag.pos) {
                            if (wallFlag && wallFlag.pos && wallFlag.pos.roomName == targetFlag.pos.roomName) {
                                if (healerIsGood) {
                                    creep.travelTo(wallFlag, {
                                        stuckValue: 2,
                                        allowSK: true
                                    });
                                }
                            } else {
                                if (healerIsGood) {
                                    creep.travelTo(targetFlag, {
                                        stuckValue: 2,
                                        allowSK: true
                                    });
                                }
                            }
                        } else {
                            if (healerIsGood) {
                                creep.travelTo(new RoomPosition(25, 25, targetFlag.pos.roomName), {
                                    stuckValue: 2,
                                    allowSK: true
                                });
                            }
                        }
                    }
                }
            }

            if (closeFoe) {
                var lookResult = closeFoe.pos.lookFor(LOOK_STRUCTURES);
                let inRampart = false;
                if (lookResult.length) {
                    for (let d = 0; d < lookResult.length; d++) {
                        if (lookResult[d].structureType == STRUCTURE_RAMPART) {
                            inRampart = true;
                            break;
                        }
                    }
                    if (inRampart) {
                        creep.rangedMassAttack();
                    } else {
                        creep.rangedAttack(closeFoe);
                    }
                } else {
                    creep.rangedAttack(closeFoe)
                }
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