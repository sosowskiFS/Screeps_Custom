var creep_asshealer = {

    /** @param {Creep} creep **/
    run: function(creep) {
        var unboostedTough = 0;
        var unboostedHeal = 0;

        creep.body.forEach(function(thisPart) {
            if (thisPart.type == HEAL && !thisPart.boost) {
                unboostedHeal = unboostedHeal + 1;
            }

            if (thisPart.type == TOUGH && !thisPart.boost) {
                unboostedTough = unboostedTough + 1;
            }
        });

        //console.log("unboosted heal : " + unboostedHeal + "| unboosted Tough : " + unboostedTough);
        if (unboostedTough > 0 && Game.flags["ToughLab"] && Game.flags["Assault"] && Game.flags["DoBoost"]) {
            var thisLab = Game.flags["ToughLab"].pos.lookFor(LOOK_STRUCTURES);
            if (thisLab.length && thisLab[0].mineralAmount > 0) {
                creep.moveTo(thisLab[0]);
                thisLab[0].boostCreep(creep);
            }
        } else if (unboostedHeal > 0 && Game.flags["HealLab"] && Game.flags["Assault"] && Game.flags["DoBoost"]) {
            var thisLab = Game.flags["HealLab"].pos.lookFor(LOOK_STRUCTURES);
            if (thisLab.length && thisLab[0].mineralAmount > 0) {
                creep.moveTo(thisLab[0]);
                thisLab[0].boostCreep(creep);
            }
        } else {
            var targetAttacker = _.filter(Game.creeps, (tCreep) => tCreep.name == creep.memory.attackerName);
            if (targetAttacker.length) {

                creep.memory._move = targetAttacker[0].memory._move;

                creep.moveTo(targetAttacker[0], {
                    noPathFinding: true;
                })
                /*if ((creep.pos.x == 0 || creep.pos.x == 49 || creep.pos.y == 0 || creep.pos.y == 49) && targetAttacker[0].room.name == creep.room.name) {
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
                    if (creep.room.controller && creep.room.controller.owner == "Montblanc") {
                        if (targetAttacker[0].room.name == creep.room.name) {
                            creep.moveTo(targetAttacker[0], {
                                reusePath: 2,
                                maxRooms: 1
                            });
                        } else {
                            creep.moveTo(targetAttacker[0], {
                                reusePath: 0
                            });
                        }
                    } else {
                        if (targetAttacker[0].room.name == creep.room.name) {
                            creep.moveTo(targetAttacker[0], {
                                ignoreCreeps: true,
                                reusePath: 0,
                                maxRooms: 1
                            });
                        } else {
                            creep.moveTo(targetAttacker[0], {
                                ignoreCreeps: true,
                                reusePath: 0
                            });
                        }
                    }
                }*/

                if (creep.hits < creep.hitsMax - 99) {
                    creep.heal(creep);
                } else if (targetAttacker[0].hits < targetAttacker[0].hitsMax) {
                    if (creep.pos.getRangeTo(targetAttacker[0]) > 1) {
                        creep.rangedHeal(targetAttacker[0]);
                    } else {
                        creep.heal(targetAttacker[0]);
                    }
                } else {
                    var hurtAlly = creep.pos.findInRange(FIND_MY_CREEPS, 3, {
                        filter: (thisCreep) => thisCreep.hits < thisCreep.hitsMax
                    });
                    if (hurtAlly.length > 0) {
                        if (creep.pos.getRangeTo(hurtAlly[0]) > 1) {
                            creep.rangedHeal(hurtAlly[0]);
                        } else {
                            creep.heal(hurtAlly[0]);
                        }
                    }
                }
            } else {
                if (Game.flags["RallyHere"]) {
                    creep.moveTo(Game.flags["RallyHere"]);
                }
                var newTarget = creep.pos.findInRange(FIND_MY_CREEPS, 2, {
                    filter: (mCreep) => (mCreep.memory.priority == "assattacker")
                });
                if (newTarget.length) {
                    creep.memory.attackerName = newTarget[0].name;
                }
            }
        }
    }

};

module.exports = creep_asshealer;