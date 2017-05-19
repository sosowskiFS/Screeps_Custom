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
                filter: (mCreep) => (mCreep.memory.priority == "asshealer" && mCreep.memory.homeRoom == creep.memory.homeRoom)
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

        if (Game.flags["DoBoost"] && unboostedTough > 0 && Game.flags["Assault"]) {
            var ToughLab = creep.room.find(FIND_MY_STRUCTURES, {
                filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_GHODIUM_ALKALIDE)
            });
            if (ToughLab.length && ToughLab.mineralAmount > 0) {
                creep.moveTo(ToughLab);
                ToughLab.boostCreep(creep);
            }
        } else if (Game.flags["DoBoost"] && unboostedAttack > 0 && Game.flags["Assault"]) {
            var AttackLab = creep.room.find(FIND_MY_STRUCTURES, {
                filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_UTRIUM_ACID)
            });
            if (AttackLab.length && AttackLab.mineralAmount > 0) {
                creep.moveTo(AttackLab);
                AttackLab.boostCreep(creep);
            }
        } else if (Game.flags["DoBoost"] && unboostedMove > 0 && Game.flags["Assault"]) {
            var MoveLab = creep.room.find(FIND_MY_STRUCTURES, {
                filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE)
            });
            if (MoveLab.length && MoveLab.mineralAmount > 0) {
                creep.moveTo(MoveLab);
                MoveLab.boostCreep(creep);
            }
        } else {
            if (!healerIsNear) {
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
                } else {
                    creep.moveTo(Game.flags["RallyHere"]);
                }
            } else if (healerIsNear) {
                creep.memory.getOutOfStartRoom = true;

                if (Game.flags["Assault"] && Game.flags["Assault"].pos.roomName != creep.pos.roomName) {
                    creep.moveTo(new RoomPosition(25, 25, Game.flags["Assault"].pos.roomName));
                } else {
                    //In target room
                    var eTowers = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                        filter: (structure) => (structure.structureType == STRUCTURE_TOWER && structure.energy > 0)
                    });
                    if (eTowers) {
                        creep.moveTo(eTowers, {
                            ignoreDestructibleStructures: true
                        });
                        creep.attack(eTowers);
                    } else {
                        var eSpawns = creep.room.find(FIND_HOSTILE_SPAWNS)
                        if (eSpawns.length) {
                            creep.moveTo(eSpawns[0], {
                                ignoreDestructibleStructures: true
                            });
                            creep.attack(eSpawns[0]);
                        } else {
                            var eStructures = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                                filter: (structure) => (structure.structureType != STRUCTURE_CONTROLLER)
                            });
                            if (eStructures) {
                                creep.moveTo(eStructures, {
                                    ignoreDestructibleStructures: true
                                });
                                creep.attack(eStructures);
                            } else if (closeFoe) {
                                creep.moveTo(closeFoe);
                            } else if (Game.flags["Assault"]) {
                                creep.moveTo(Game.flags["Assault"]);
                            }
                        }
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