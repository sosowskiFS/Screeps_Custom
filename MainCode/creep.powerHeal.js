var creep_powerHeal = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (!Game.flags[creep.memory.homeRoom + "PowerGather"]) {
            //You are not required
            creep.suicide();
        } else {
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
                        creep.travelTo(attackers[0]);
                    } else {
                        creep.travelTo(Game.flags[creep.memory.homeRoom + "PowerGather"], {
                            range: 5
                        });
                    }
                } else {
                    var thisAttacker = Game.getObjectById(creep.memory.targetAttacker);
                    if (thisAttacker) {
                        if (creep.heal(thisAttacker) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(thisAttacker);
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

        let inRangeEnemy = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3, {
            filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
        });

        if (inRangeEnemy.length) {
            if (!Game.flags[creep.memory.homeRoom + "PowerGuard"]) {
                creep.room.createFlag(25, 25, creep.memory.homeRoom + "PowerGuard");
            }
        }

        let hurtAlly = creep.pos.findInRange(FIND_CREEPS, 1, {
            filter: (thisCreep) => thisCreep.hits < thisCreep.hitsMax - 500 && thisCreep.id != creep.memory.targetAttacker && (thisCreep.owner.username == "Montblanc" || Memory.whiteList.includes(thisCreep.owner.username))
        });

        if (hurtAlly.length > 0) {
            creep.heal(hurtAlly[0];
        } else if (creep.hits < creep.hitsMax - 300) {
            creep.heal(creep);
        }
    }
};

module.exports = creep_powerHeal;