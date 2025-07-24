var creep_powerHeal = {

    /** @param {Creep} creep **/
    run: function(creep) {
        // Cache frequently used values
        const homeRoom = creep.memory.homeRoom;
        const powerGatherFlagName = homeRoom + "PowerGather";
        const powerGatherFlag = Game.flags[powerGatherFlagName];
        
        if (!powerGatherFlag) {
            //You are not required
            creep.suicide();
            return;
        }
        
        if (!creep.memory.disabledNotify) {
            creep.notifyWhenAttacked(false);
            creep.memory.disabledNotify = true;
        }
        
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'powerHealNearDeath') {
            creep.memory.priority = 'powerHealNearDeath';
        }
        
        //Flag active
        if (creep.room.name != creep.memory.destination) {
            //Travel to room - removed redundant condition check
            creep.travelTo(powerGatherFlag);
        } else {
            //Main loop
            if (!creep.memory.targetAttacker) {
                const attackers = creep.room.find(FIND_MY_CREEPS, {
                    filter: (roomCreep) => roomCreep.getActiveBodyparts(ATTACK) >= 1
                });
                if (attackers.length) {
                    creep.memory.targetAttacker = attackers[0].id;
                    creep.travelTo(attackers[0], {
                        movingTarget: true
                    });
                } else {
                    creep.travelTo(powerGatherFlag, {
                        range: 5
                    });
                }
            } else {
                const thisAttacker = Game.getObjectById(creep.memory.targetAttacker);
                if (thisAttacker) {
                    if (creep.heal(thisAttacker) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(thisAttacker, {
                            movingTarget: true
                        });
                    }
                    // Update death warning every 10 ticks to reduce CPU
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
                    creep.travelTo(powerGatherFlag, {
                        range: 5
                    });
                }
            }
        }

        // Handle opportunistic healing (moved outside main logic for better organization)
        this.handleOpportunisticHealing(creep);
    },
    
    // Optimized method for handling healing of nearby allies and self-healing
    handleOpportunisticHealing: function(creep) {
        const hurtAlly = creep.pos.findInRange(FIND_CREEPS, 1, {
            filter: (thisCreep) => {
                return thisCreep.hits < thisCreep.hitsMax - 500 && 
                       thisCreep.id != creep.memory.targetAttacker && 
                       (thisCreep.owner.username == "Montblanc" || 
                        Memory.whiteList.includes(thisCreep.owner.username) || 
                        thisCreep.owner.username == "Digital");
            }
        });
        
        if (hurtAlly.length > 0) {
            creep.heal(hurtAlly[0]);
        } else if (creep.hits < creep.hitsMax - 300) {
            creep.heal(creep);
        }
    }

};

module.exports = creep_powerHeal;