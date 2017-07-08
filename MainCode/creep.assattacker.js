var creep_assattacker = {

    /** @param {Creep} creep **/
    run: function(creep) {

        var unboostedTough = 0;
        var unboostedAttack = 0;
        var unboostedMove = 0;

        creep.body.forEach(function(thisPart) {
            if (thisPart.type == ATTACK && !thisPart.boost) {
                unboostedAttack = unboostedAttack + 1;
            }

            if (thisPart.type == TOUGH && !thisPart.boost) {
                unboostedTough = unboostedTough + 1;
            }

            if (thisPart.type == MOVE && !thisPart.boost) {
                unboostedMove = unboostedMove + 1;
            }
        });

        if (!creep.memory.healerID && !creep.spawning) {
            var nearbyHealer = creep.pos.findInRange(FIND_MY_CREEPS, 2, {
                filter: (mCreep) => (mCreep.memory.priority == "asshealer" && mCreep.memory.attackerID == creep.id)
            });
            if (nearbyHealer.length) {
                creep.memory.healerID = nearbyHealer[0].id;
            }
        }

        var closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
            filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
        });

        var thisHealer = Game.getObjectById(creep.memory.healerID);
        var healerIsNear = false;
        if (thisHealer) {
            healerIsNear = creep.pos.isNearTo(thisHealer);
        }

        if (Game.flags["DoBoost"] && unboostedMove > 0 && Game.flags[creep.memory.homeRoom + "Assault"]) {
            var MoveLab = creep.room.find(FIND_MY_STRUCTURES, {
                filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE)
            });
            if (MoveLab.length && MoveLab.mineralAmount > 0) {
                creep.travelTo(MoveLab);
                MoveLab.boostCreep(creep);
            }
        } else if (Game.flags["DoBoost"] && unboostedTough > 0 && Game.flags[creep.memory.homeRoom + "Assault"]) {
            var ToughLab = creep.room.find(FIND_MY_STRUCTURES, {
                filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_GHODIUM_ALKALIDE)
            });
            if (ToughLab.length && ToughLab.mineralAmount > 0) {
                creep.travelTo(ToughLab, {
                    ignoreRoads: true
                });
                ToughLab.boostCreep(creep);
            }
        } else if (Game.flags["DoBoost"] && unboostedAttack > 0 && Game.flags[creep.memory.homeRoom + "Assault"]) {
            var AttackLab = creep.room.find(FIND_MY_STRUCTURES, {
                filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_UTRIUM_ACID)
            });
            if (AttackLab.length && AttackLab.mineralAmount > 0) {
                creep.travelTo(AttackLab, {
                    ignoreRoads: true
                });
                AttackLab.boostCreep(creep);
            }
        } else {
            if (Game.flags[creep.memory.homeRoom + "Assault"] && Game.flags[creep.memory.homeRoom + "Assault"].pos && Game.flags[creep.memory.homeRoom + "Assault"].pos.roomName == creep.pos.roomName) {
                //In target room
                var somethingNearby = creep.pos.findClosestByRange(FIND_STRUCTURES);
                if (somethingNearby) {
                    creep.attack(somethingNearby);
                }

                var eTowers = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                    filter: (structure) => (structure.structureType == STRUCTURE_TOWER && structure.energy > 0)
                });
                if (eTowers) {
                    creep.travelTo(eTowers, {
                        ignoreDestructibleStructures: true,
                        stuckValue: 500,
                        ignoreRoads: true
                    });
                    creep.attack(eTowers);
                } else {
                    var eSpawns = creep.room.find(FIND_HOSTILE_SPAWNS)
                    if (eSpawns.length) {
                        creep.travelTo(eSpawns[0], {
                            ignoreDestructibleStructures: true,
                            stuckValue: 500,
                            ignoreRoads: true
                        });
                        creep.attack(eSpawns[0]);
                    } else {
                        var eStructures = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                            filter: (structure) => (structure.structureType != STRUCTURE_CONTROLLER && structure.structureType != STRUCTURE_WALL && structure.structureType != STRUCTURE_RAMPART)
                        });
                        if (eStructures) {
                            creep.travelTo(eStructures, {
                                ignoreDestructibleStructures: true,
                                stuckValue: 500,
                                ignoreRoads: true
                            });
                            creep.attack(eStructures);
                        } else if (closeFoe) {
                            creep.travelTo(closeFoe, {
                                ignoreRoads: true
                            });
                        } else if (Game.flags[creep.memory.homeRoom + "Assault"]) {
                            Game.flags[creep.memory.homeRoom + "Assault"].remove();
                        }
                    }
                }
            } else if (!healerIsNear) {
                if (creep.memory.getOutOfStartRoom) {
                    //Probably in a new room, hold.
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
                } else if (Game.flags["RallyHere"] && Game.flags["RallyHere"].pos) {
                    creep.travelTo(Game.flags["RallyHere"], {
                        ignoreRoads: true
                    });
                }
            } else if (healerIsNear) {
                if (!creep.memory.getOutOfStartRoom) {
                    creep.memory.getOutOfStartRoom = true;
                }
                var thisPortal = undefined;
                if (Game.flags["TakePortal"] && Game.flags["TakePortal"].pos.roomName == creep.pos.roomName) {
                    var thisPortal = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: (structure) => (structure.structureType == STRUCTURE_PORTAL)
                    });
                }
                if (thisPortal) {
                    creep.travelTo(thisPortal);
                } else if (Game.flags[creep.memory.homeRoom + "Assault"] && Game.flags[creep.memory.homeRoom + "Assault"].pos.roomName != creep.pos.roomName) {
                    if (Game.flags[creep.memory.homeRoom + "Assault"].pos) {
                        creep.travelTo(Game.flags[creep.memory.homeRoom + "Assault"], {
                            ignoreRoads: true
                        });
                    } else {
                        creep.travelTo(new RoomPosition(25, 25, Game.flags[creep.memory.homeRoom + "Assault"].pos.roomName), {
                            ignoreRoads: true
                        });
                    }
                }
            }
        }

        if (closeFoe) {
            //prioritize foebashing
            creep.attack(closeFoe);
        }

    }

};

module.exports = creep_assattacker;
