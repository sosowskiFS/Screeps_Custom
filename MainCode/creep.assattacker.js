var creep_assattacker = {

    /** @param {Creep} creep **/
    run: function(creep) {

        var unboostedTough = 0;
        var unboostedAttack = 0;

        creep.body.forEach(function(thisPart) {
            if (thisPart.type == ATTACK && !thisPart.boost) {
                unboostedAttack = unboostedAttack + 1;
            }

            if (thisPart.type == TOUGH && !thisPart.boost) {
                unboostedTough = unboostedTough + 1;
            }
        });

        var squadSearchRange = 2;

        var healerSquad = creep.pos.findInRange(FIND_MY_CREEPS, squadSearchRange, {
            filter: (mCreep) => (mCreep.memory.priority == "asshealer")
        });
        var closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
            filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
        });

        if (unboostedTough > 0 && Game.flags["ToughLab"] && Game.flags["Assault"] && Game.flags["DoBoost"]) {
            var thisLab = Game.flags["ToughLab"].pos.lookFor(LOOK_STRUCTURES);
            if (thisLab.length && thisLab[0].mineralAmount > 0) {
                creep.moveTo(thisLab[0]);
                thisLab[0].boostCreep(creep);
            }
        } else if (unboostedAttack > 0 && Game.flags["AttackLab"] && Game.flags["Assault"] && Game.flags["DoBoost"]) {
            var thisLab = Game.flags["AttackLab"].pos.lookFor(LOOK_STRUCTURES);
            if (thisLab.length && thisLab[0].mineralAmount > 0) {
                creep.moveTo(thisLab[0]);
                thisLab[0].boostCreep(creep);
            }
        } else {
            if (healerSquad.length < 2) {
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
            } else if (healerSquad.length == 2) {
                creep.memory.getOutOfStartRoom = true;

                if (Game.flags["Assault"] && Game.flags["Assault"].pos.roomName != creep.pos.roomName) {
                    creep.moveTo(new RoomPosition(25, 25, Game.flags["Assault"].pos.roomName));
                } else {
                    //In target room
                    var eTowers = creep.room.find(FIND_HOSTILE_STRUCTURES, {
                        filter: (structure) => (structure.structureType == STRUCTURE_TOWER && structure.energy > 0)
                    });
                    if (eTowers.length) {
                        creep.moveTo(eTowers[0], {
                            ignoreDestructibleStructures: true
                        });
                        creep.attack(eTowers[0]);
                    } else {
                        var eSpawns = creep.room.find(FIND_HOSTILE_SPAWNS)
                        if (eSpawns.length) {
                            creep.moveTo(eSpawns[0], {
                                ignoreDestructibleStructures: true
                            });
                            creep.attack(eSpawns[0]);
                        } else {
                            var eStructures = creep.room.find(FIND_HOSTILE_STRUCTURES)
                            if (eStructures.length) {
                                creep.moveTo(eStructures[0], {
                                    ignoreDestructibleStructures: true
                                });
                                creep.attack(eStructures[0]);
                            } else if (closeFoe) {
                                creep.moveTo(closeFoe);
                            } else if (Game.flags["Assault"]) {
                                creep.moveTo(Game.flags["Assault"]);
                            }
                        }
                    }
                }
            } else {
                if (Game.flags["RallyHere"] && !creep.memory.getOutOfStartRoom) {
                    creep.moveTo(Game.flags["RallyHere"]);
                } else {
                    //creep.moveTo(Game.flags["Assault"]);
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