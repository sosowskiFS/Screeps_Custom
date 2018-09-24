var creep_powerAttack = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (!Game.flags[creep.memory.homeRoom + "PowerGather"]) {
            //You are not required
            creep.suicide();
        } else {
            if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'powerAttackNearDeath') {
                creep.memory.priority = 'powerAttackNearDeath';
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
                if (!creep.memory.targetBank) {
                    try {
                        var powerBanks = Game.flags[creep.memory.homeRoom + "PowerGather"].pos.lookFor(LOOK_STRUCTURES);
                        if (powerBanks.length) {
                            creep.memory.targetBank = powerBanks[0].id
                            creep.travelTo(powerBanks[0]);
                        } else {
                            //No bank located, delete flag
                            Game.flags[creep.memory.homeRoom + "PowerGather"].remove();
                            if (Game.flags[creep.memory.homeRoom + "PowerGuard"]) {
                                Game.flags[creep.memory.homeRoom + "PowerGuard"].remove();
                            }
                            //Game.notify('Power flag deleted - Cannot find bank. Initial look |' + creep.room.name);
                        }
                    } catch (e) {
                        creep.travelTo(Game.flags[creep.memory.homeRoom + "PowerGather"])
                    }

                } else if (creep.hits >= 2500) {
                    var thisBank = Game.getObjectById(creep.memory.targetBank);
                    if (thisBank) {
                        if (creep.attack(thisBank) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(thisBank);
                        }
                        if (thisBank.hits <= 468000 && !Game.flags[creep.memory.homeRoom + "PowerCollect"]) {
                            //Set flag to signal mule creation
                            Game.rooms[creep.room.name].createFlag(25, 25, creep.memory.homeRoom + "PowerCollect");
                        }
                    } else {
                        //Cannot find bank, abort
                        Game.flags[creep.memory.homeRoom + "PowerGather"].remove();
                        if (Game.flags[creep.memory.homeRoom + "PowerGuard"]) {
                            Game.flags[creep.memory.homeRoom + "PowerGuard"].remove();
                        }
                        //Game.notify('Power flag deleted - Cannot find bank. |' + creep.room.name);
                    }
                }
            }
        }

        let inRangeEnemy = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 1, {
            filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
        });
        if (inRangeEnemy.length) {
            creep.attack(inRangeEnemy[0]);
        }
    }

};

module.exports = creep_powerAttack;