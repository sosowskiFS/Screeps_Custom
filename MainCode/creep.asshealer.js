var creep_asshealer = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'asshealerNearDeath') {
            creep.memory.priority = 'asshealerNearDeath';
        }

        let unboostedTough = 0;
        let unboostedHeal = 0;
        let unboostedMove = 0;

        creep.body.forEach(function(thisPart) {
            if (thisPart.type == HEAL && !thisPart.boost) {
                unboostedHeal = unboostedHeal + 1;
            }else if (thisPart.type == TOUGH && !thisPart.boost) {
                unboostedTough = unboostedTough + 1;
            }else if (thisPart.type == MOVE && !thisPart.boost) {
                unboostedMove = unboostedMove + 1;
            }
        });

        if (!creep.memory.UnassignDelay) {
            creep.memory.UnassignDelay = 0;
        }

        if (Game.flags[creep.memory.homeRoom + "DoBoost"] && Game.flags[creep.memory.homeRoom + "RunningAssault"] && (unboostedMove > 0 || unboostedTough > 0 || unboostedHeal > 0)) {
            let MoveLab = creep.room.find(FIND_MY_STRUCTURES, {
                filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE)
            });
            let ToughLab = creep.room.find(FIND_MY_STRUCTURES, {
                filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_GHODIUM_ALKALIDE)
            });
            let HealLab = creep.room.find(FIND_MY_STRUCTURES, {
                filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE)
            });
            let hasTraveled = false;
            let result;
            if (MoveLab.length && unboostedMove > 0) {
                result = MoveLab[0].boostCreep(creep);
                creep.travelTo(MoveLab[0]);
                hasTraveled = true;
                if (result == ERR_NOT_ENOUGH_RESOURCES && MoveLab[0].energy >= 1000) {
                    if (Game.flags[creep.memory.homeRoom + "RunningAssault"]) {
                        Game.flags[creep.memory.homeRoom + "RunningAssault"].remove();
                        console.log(creep.memory.homeRoom + " Labs are dry");
                    }
                }
            }
            if (ToughLab.length && unboostedTough > 0) {
                if (!hasTraveled) {
                    creep.travelTo(ToughLab[0], {
                        ignoreRoads: true
                    });
                    hasTraveled = true;
                }
                result = ToughLab[0].boostCreep(creep);
                if (result == ERR_NOT_ENOUGH_RESOURCES && ToughLab[0].energy >= 1000) {
                    if (Game.flags[creep.memory.homeRoom + "RunningAssault"]) {
                        Game.flags[creep.memory.homeRoom + "RunningAssault"].remove();
                        console.log(creep.memory.homeRoom + " Labs are dry");
                    }
                }
            }
            if (HealLab.length && unboostedHeal > 0) {
                if (!hasTraveled) {
                    creep.travelTo(HealLab[0], {
                        ignoreRoads: true
                    });
                    hasTraveled = true;
                }
                result = HealLab[0].boostCreep(creep);
                if (result == ERR_NOT_ENOUGH_RESOURCES && HealLab[0].energy >= 1000) {
                    if (Game.flags[creep.memory.homeRoom + "RunningAssault"]) {
                        Game.flags[creep.memory.homeRoom + "RunningAssault"].remove();
                        console.log(creep.memory.homeRoom + " Labs are dry");
                    }
                }
            }
            let talkingCreeps = creep.pos.findInRange(FIND_MY_CREEPS, 1, {
                filter: (thisCreep) => (creep.id != thisCreep.id && thisCreep.saying)
            })
            if (talkingCreeps.length) {
                let coords = talkingCreeps[0].saying.split(";");
                if (creep.fatigue <= 0 && coords.length == 2 && creep.pos.x == parseInt(coords[0]) && creep.pos.y == parseInt(coords[1])) {
                    //Standing in the way of a creep
                    let thisDirection = creep.pos.getDirectionTo(talkingCreeps[0].pos);
                    creep.move(thisDirection);
                    creep.say("\uD83D\uDCA6", true);
                }
            }
        } else {
            let targetAttacker = Game.getObjectById(creep.memory.attackerID);
            if (targetAttacker) {
                if (targetAttacker.memory.priority == 'assattackerNearDeath' && creep.memory.priority != 'asshealerNearDeath') {
                    creep.memory.priority = 'asshealerNearDeath';
                }
                let thisPortal = undefined;
                if (Game.flags["TakePortal"] && Game.flags["TakePortal"].pos.roomName == creep.pos.roomName) {
                    let thisPortal = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: (structure) => (structure.structureType == STRUCTURE_PORTAL)
                    });
                }
                if (thisPortal) {
                    creep.travelTo(thisPortal, {
                        ignoreRoads: true
                    });
                } else if ((creep.pos.x == 0 || creep.pos.x == 49 || creep.pos.y == 0 || creep.pos.y == 49) && targetAttacker.room.name == creep.room.name) {
                    /*let xTarget = 0;
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

                    creep.moveTo(xTarget, yTarget);*/
                    creep.moveTo(targetAttacker.pos);
                } else {
                    /*if (creep.pos.inRangeTo(targetAttacker, 2)) {
                        creep.move(creep.pos.getDirectionTo(targetAttacker));
                    } else {*/
                    if (targetAttacker.room.name == creep.room.name) {
                        creep.travelTo(targetAttacker, {
                            maxRooms: 1,
                            ignoreRoads: true,
                            stuckValue: 1,
                            movingTarget: true
                        });
                    } else {
                        creep.travelTo(targetAttacker, {
                            ignoreRoads: true,
                            stuckValue: 1,
                            movingTarget: true
                        });
                    }
                    //}
                }
                //Determine if closest to tower, if so heal self if other targets hits are full
                let closeTower = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                    filter: {
                        structureType: STRUCTURE_TOWER
                    }
                });
                let tCloseTower = targetAttacker.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                    filter: {
                        structureType: STRUCTURE_TOWER
                    }
                });
                let IAmInDanger = false;
                if (closeTower && creep.pos.getRangeTo(closeTower) < targetAttacker.pos.getRangeTo(closeTower)) {
                    IAmInDanger = true;
                }
                if ((IAmInDanger && targetAttacker.hits == targetAttacker.hitsMax) || creep.hits < targetAttacker.hits) {
                    creep.heal(creep);
                    creep.say("(=\u2716\u11BD\u2716=)", true);
                } else {
                    if (Game.time % 2 == 0) {
                        creep.say("(=\u25D5\u11BD\u25D5\u0E3A=)", true);
                    } else {
                        creep.say("(=\u229D\u11BD\u229D=)", true);
                    }

                    let hurtAlly = creep.pos.findInRange(FIND_CREEPS, 3, {
                        filter: (thisCreep) => thisCreep.hits < targetAttacker.hits - 500 && thisCreep.id != targetAttacker.id && (thisCreep.owner.username == "Montblanc" || Memory.whiteList.includes(thisCreep.owner.username) || thisCreep.owner.username == "KamiKatze")
                    });
                    let healedAlly = false
                    if (hurtAlly.length > 0) {
                        hurtAlly.sort(healCompare);
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
                        let thisRange = creep.pos.getRangeTo(targetAttacker);
                        if (thisRange >= 3) {
                            creep.heal(creep);
                        } else if (thisRange > 1) {
                            creep.rangedHeal(targetAttacker);
                        } else {
                            creep.heal(targetAttacker);
                        }
                    }
                }
            } else {
                creep.memory.UnassignDelay++;
                if (creep.memory.UnassignDelay > 50) {
                    creep.memory.priority = 'targetlessHealer';
                }
                creep.heal(creep);
                let targetFlag = Game.flags[creep.memory.homeRoom + "Assault"];
                if (!targetFlag) {
                    for (j = 2; j < 6; j++) {
                        targetFlag = Game.flags[creep.memory.homeRoom + "Assault" + j]
                        if (targetFlag) {
                            break;
                        }
                    }
                }
                if (targetFlag) {
                    creep.travelTo(targetFlag, {
                        ignoreRoads: true,
                        stuckValue: 1
                    });
                }
                let newTarget = creep.pos.findInRange(FIND_MY_CREEPS, 10, {
                    filter: (mCreep) => (mCreep.memory.priority == "assattacker" || mCreep.memory.priority == "assranger")
                });
                if (newTarget.length) {
                    if (creep.ticksToLive <= 1300) {
                        creep.memory.priority = 'targetlessHealer';
                    }
                    creep.memory.attackerID = newTarget[0].id;
                }
            }
        }
    }

};

function healCompare(a, b) {
    if (a.hits < b.hits)
        return -1;
    if (a.hits > b.hits)
        return 1;
    return 0;
}

module.exports = creep_asshealer;