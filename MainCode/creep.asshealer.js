var creep_asshealer = {

    /** @param {Creep} creep **/
    run: function(creep) {
        var unboostedTough = 0;
        var unboostedHeal = 0;
        var unboostedMove = 0;

        creep.body.forEach(function(thisPart) {
            if (thisPart.type == HEAL && !thisPart.boost) {
                unboostedHeal = unboostedHeal + 1;
            }

            if (thisPart.type == TOUGH && !thisPart.boost) {
                unboostedTough = unboostedTough + 1;
            }

            if (thisPart.type == MOVE && !thisPart.boost) {
                unboostedMove = unboostedMove + 1;
            }
        });

        //console.log("unboosted heal : " + unboostedHeal + "| unboosted Tough : " + unboostedTough);
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
        } else if (Game.flags["DoBoost"] && unboostedHeal > 0 && Game.flags[creep.memory.homeRoom + "Assault"]) {
            var HealLab = creep.room.find(FIND_MY_STRUCTURES, {
                filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE)
            });
            if (HealLab.length && HealLab.mineralAmount > 0) {
                creep.travelTo(HealLab, {
                    ignoreRoads: true
                });
                HealLab.boostCreep(creep);
            }
        } else {
            var targetAttacker = Game.getObjectById(creep.memory.attackerID);
            if (targetAttacker) {
                var thisPortal = undefined;
                if (Game.flags["TakePortal"] && Game.flags["TakePortal"].pos.roomName == creep.pos.roomName) {
                    var thisPortal = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: (structure) => (structure.structureType == STRUCTURE_PORTAL)
                    });
                }
                if (thisPortal) {
                    creep.travelTo(thisPortal);
                } else if ((creep.pos.x == 0 || creep.pos.x == 49 || creep.pos.y == 0 || creep.pos.y == 49) && targetAttacker.room.name == creep.room.name) {
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
                } else {
                    /*if (creep.pos.inRangeTo(targetAttacker, 2)) {
                        creep.move(creep.pos.getDirectionTo(targetAttacker));
                    } else {*/
                    if (targetAttacker.room.name == creep.room.name) {
                        creep.travelTo(targetAttacker, {
                            maxRooms: 1,
                            ignoreRoads: true
                        });
                    } else {
                        creep.travelTo(targetAttacker, {
                            ignoreRoads: true
                        });
                    }
                    //}
                }

                if (creep.hits < creep.hitsMax - 300) {
                    creep.heal(creep);
                } else {
                    var hurtAlly = creep.pos.findInRange(FIND_MY_CREEPS, 3, {
                        filter: (thisCreep) => thisCreep.hits < thisCreep.hitsMax && thisCreep.id != targetAttacker.id
                    });
                    var healedAlly = false
                    if (hurtAlly.length > 0) {
                        if (creep.pos.getRangeTo(hurtAlly[0]) > 1) {
                            if (creep.rangedHeal(hurtAlly[0]) == OK) {
                                healedAlly = true;
                            }
                        } else {
                            if (creep.heal(hurtAlly[0]) == OK) {
                                healedAlly = true;
                            }
                        }
                    }

                    if (!healedAlly) {
                        if (creep.pos.getRangeTo(targetAttacker) > 1) {
                            creep.rangedHeal(targetAttacker);
                        } else {
                            creep.heal(targetAttacker);
                        }
                    }
                }
            } else {
                if (Game.flags["RallyHere"] && Game.flags["RallyHere"].pos) {
                    creep.travelTo(Game.flags["RallyHere"], {
                        ignoreRoads: true
                    });
                }
                var newTarget = creep.pos.findInRange(FIND_MY_CREEPS, 2, {
                    filter: (mCreep) => (mCreep.memory.priority == "assattacker")
                });
                if (newTarget.length) {
                    creep.memory.attackerID = newTarget[0].id;
                }
            }
        }
    }

};

module.exports = creep_asshealer;
