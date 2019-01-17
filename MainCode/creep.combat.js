var creep_combat = {

    /** @param {Creep} creep **/
    run: function(creep) {
        //Defensive-focused attack
        //Only run this code if the room is being invaded, remain offline otherwise.
        //(Saves running excess finds in peacetime)
        if (creep.hits < creep.hitsMax) {
            creep.heal(creep);
        }

        if (Memory.roomsUnderAttack.indexOf(creep.room.name) != -1) {
            //Move towards Foe, stop at rampart
            var lookResult = creep.pos.lookFor(LOOK_STRUCTURES);
            var Foe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 50, {
                filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
            });

            var closeFoe = Game.getObjectById(Memory.towerPickedTarget[creep.room.name]);
            var massAttackFlag = false;
            if (!closeFoe) {
                closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
                    filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
                });
                massAttackFlag = true;
            }

            if (Foe.length) {
                Foe.sort(targetOther);
                var boostFlag = false;
                if ((Foe[0].getActiveBodyparts(ATTACK) > 0 || Foe[0].getActiveBodyparts(RANGED_ATTACK) > 0 || Foe[0].getActiveBodyparts(WORK) > 0) && Foe[0].owner.username != 'Invader') {
                    Foe[0].body.forEach(function(thisPart) {
                        if (thisPart.boost) {
                            boostFlag = true;
                        }
                    });
                }
                if (boostFlag && creep.room.controller.level >= 6) {
                    var attackLab = creep.room.find(FIND_MY_STRUCTURES, {
                        filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_KEANIUM_ALKALIDE)
                    });
                    var mineralCost = creep.getActiveBodyparts(RANGED_ATTACK) * LAB_BOOST_MINERAL;
                    var energyCost = creep.getActiveBodyparts(RANGED_ATTACK) * LAB_BOOST_ENERGY;
                    if (attackLab.length && attackLab[0].mineralAmount >= mineralCost && attackLab[0].energy >= energyCost) {
                        creep.memory.needBoosts = true;
                    } else {
                        creep.memory.needBoosts = false;
                    }
                } else {
                    creep.memory.needBoosts = false;
                }
            }

            var unboostedAttack = 0;
            if (creep.memory.needBoosts && creep.room.controller.level >= 6) {
                creep.body.forEach(function(thisPart) {
                    if (thisPart.type == RANGED_ATTACK && !thisPart.boost) {
                        unboostedAttack = unboostedAttack + 1;
                    }
                });
            }

            if (creep.memory.needBoosts && unboostedAttack > 0) {
                var thisLab = creep.room.find(FIND_MY_STRUCTURES, {
                    filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_KEANIUM_ALKALIDE)
                });
                if (thisLab.length) {
                    creep.travelTo(thisLab[0]);
                    thisLab[0].boostCreep(creep);
                } else {
                    creep.memory.needBoost = false;
                }
            } else if (closeFoe) {
                if (!creep.memory.waitingTimer) {
                    creep.memory.waitingTimer = 0
                }
                var lookResult = creep.pos.lookFor(LOOK_STRUCTURES);
                if (lookResult.length && creep.memory.waitingTimer < 300) {
                    var found = false;
                    for (let y = 0; y < lookResult.length; y++) {
                        if (lookResult[y].structureType == STRUCTURE_RAMPART) {
                            found = true;
                            if (creep.pos.inRangeTo(closeFoe, 3)) {
                                creep.memory.waitingTimer = 0;
                            } else if (lookResult[y].isPublic == true) {
                                creep.memory.waitingTimer = creep.memory.waitingTimer + 150;
                            } else {
                                creep.memory.waitingTimer = creep.memory.waitingTimer + 1;
                            }
                            break;
                        }
                    }
                    if (!found) {
                        creep.travelTo(closeFoe, {
                            maxRooms: 1
                        });
                    }
                } else {
                    creep.memory.waitingTimer = 0;
                    creep.travelTo(closeFoe, {
                        maxRooms: 1
                    });
                }
            }

            if (closeFoe && creep.pos.inRangeTo(closeFoe, 3)) {
                if (massAttackFlag) {
                    creep.rangedMassAttack(closeFoe);
                } else {
                    creep.rangedAttack(closeFoe);
                }
                creep.say("\uFF08\u0E07\u03A6 \u0414 \u03A6\uFF09\u0E07", true);
                creep.memory.waitingTimer = 0;
                creep.travelTo(creep);
            }
        } else {
            //Move out of the way
            let talkingCreeps = creep.pos.findInRange(FIND_MY_CREEPS, 1, {
                filter: (thisCreep) => (creep.id != thisCreep.id && thisCreep.saying)
            })
            if (talkingCreeps.length) {
                let coords = talkingCreeps[0].saying.split(";");
                if (coords.length == 2 && creep.pos.x == parseInt(coords[0]) && creep.pos.y == parseInt(coords[1])) {
                    //Standing in the way of a creep
                    let thisDirection = creep.pos.getDirectionTo(talkingCreeps[0].pos);
                    creep.move(thisDirection);
                    creep.say("\uD83D\uDCA6", true);
                }
            }
        }
    }
};

function targetOther(a, b) {
    if (a.getActiveBodyparts(HEAL) > b.getActiveBodyparts(HEAL))
        return 1;
    if (a.getActiveBodyparts(HEAL) < b.getActiveBodyparts(HEAL))
        return -1;
    return 0;
}

module.exports = creep_combat;