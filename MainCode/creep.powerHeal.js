var creep_powerHeal = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (!Game.flags[creep.memory.homeRoom + "PowerGather"]) {
            //You are not required
            creep.suicide();
        } else {
            if (!creep.memory.disabledNotify) {
                    creep.notifyWhenAttacked(false);
                    creep.memory.disabledNotify = true;
                }
            if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'powerHealNearDeath') {
                creep.memory.priority = 'powerHealNearDeath';
            }
            //Flag active
            if (creep.room.name != creep.memory.destination) {
                //Travel to room
                if (Game.flags[creep.memory.homeRoom + "PowerGather"] && Game.flags[creep.memory.homeRoom + "PowerGather"]) {
                    creep.travelTo(Game.flags[creep.memory.homeRoom + "PowerGather"]);
                } else {
                    creep.travelTo(new RoomPosition(25, 25, creep.memory.destination));
                }
            } else {
                //Main loop
                if (!creep.memory.targetAttacker) {
                    var attackers = Game.rooms[creep.room.name].find(FIND_MY_CREEPS, {
                        filter: (creep) => (creep.getActiveBodyparts(ATTACK) >= 1)
                    });
                    if (attackers.length) {
                        creep.memory.targetAttacker = attackers[0].id;
                        creep.travelTo(attackers[0], {
                            movingTarget: true
                        });
                    } else {
                        creep.travelTo(Game.flags[creep.memory.homeRoom + "PowerGather"], {
                            range: 5
                        });
                    }
                } else {
                    var thisAttacker = Game.getObjectById(creep.memory.targetAttacker);
                    if (thisAttacker) {
                        if (creep.heal(thisAttacker) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(thisAttacker, {
                                movingTarget: true
                            });
                        }
                        if (Game.time % 10 == 0) {
                            creep.memory.deathWarn = thisAttacker.memory.deathWarn;
                            if (creep.memory.deathWarn > 0) {
                                //Account for difference in body
                                creep.memory.deathWarn = creep.memory.deathWarn - 54;
                            }
                        }
                    } else {
                        //Cannot find attacker, clear memory
                        creep.memory.targetAttacker = undefined;
                        creep.travelTo(Game.flags[creep.memory.homeRoom + "PowerGather"], {
                            range: 5
                        });
                    }
                }
            }
        }

        let hurtAlly = creep.pos.findInRange(FIND_CREEPS, 1, {
            filter: (thisCreep) => thisCreep.hits < thisCreep.hitsMax - 500 && thisCreep.id != creep.memory.targetAttacker && (thisCreep.owner.username == "Montblanc" || Memory.whiteList.includes(thisCreep.owner.username) || thisCreep.owner.username == "Digital")
        });
        if (hurtAlly.length > 0) {
            creep.heal(hurtAlly[0]);
        } else if (creep.hits < creep.hitsMax - 300) {
            creep.heal(creep);
        }
    }

};

module.exports = creep_powerHeal;