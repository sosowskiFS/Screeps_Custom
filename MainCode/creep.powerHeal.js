const runtimeCache = require('runtime.cache');
const combat = require('combat.tactics');
// While the attacker has at least this much left, a healer may heal someone else (a damaged
// collector) instead of pre-healing the attacker. Self-limiting: once the reflected damage eats
// into this buffer, the attacker gets every heal again.
const SPARE_BUFFER = 1000;

var creep_powerHeal = {

    /** @param {Creep} creep **/
    run: function(creep) {
        // Cache frequently used values
        const homeRoom = creep.memory.homeRoom;
        const powerAttackFlagName = homeRoom + "PowerAttack";
        const powerAttackFlag = Game.flags[powerAttackFlagName];
        
        if (!powerAttackFlag) {
            // Bank is down: the collectors are coming in now. Patch up any damaged ones in this
            // room before leaving.
            if (creep.room.name != creep.memory.destination || !this.healPatient(creep)) {
                //You are not required
                creep.suicide();
            }
            return;
        }
        
        if (!creep.memory.disabledNotify) {
            creep.notifyWhenAttacked(false);
            creep.memory.disabledNotify = true;
        }
        
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'powerHealNearDeath') {
            creep.memory.priority = 'powerHealNearDeath';
        }

        // Every HEAL part disabled (MOVE goes first, so it cannot walk either): unless another
        // healer is beside it, it only blocks the replacement healer from spawning.
        if (combat.crippled(creep, HEAL)) {
            if (!combat.healerNear(creep, 1)) {
                creep.suicide();
            }
            return;
        }

        let attacker;
        
        //Flag active
        if (creep.room.name != creep.memory.destination) {
            //Travel to room - removed redundant condition check
            creep.travelTo(powerAttackFlag);
        } else {
            //Main loop
            if (!creep.memory.targetAttacker) {
                const attackers = runtimeCache.find(creep.room, FIND_MY_CREEPS, {
                    filter: (roomCreep) => roomCreep.memory.priority === 'powerAttack' && roomCreep.memory.homeRoom === homeRoom
                });
                if (attackers.length) {
                    creep.memory.targetAttacker = attackers[0].id;
                    attacker = attackers[0];
                    creep.travelTo(attackers[0]);
                } else {
                    creep.travelTo(powerAttackFlag, {
                        range: 5
                    });
                }
            } else {
                const thisAttacker = Game.getObjectById(creep.memory.targetAttacker);
                if (thisAttacker) {
                    attacker = thisAttacker;
                    if (!creep.pos.isNearTo(thisAttacker)) {
                        creep.travelTo(thisAttacker);
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
                    creep.travelTo(powerAttackFlag, {
                        range: 5
                    });
                }
            }
        }

        this.chooseHeal(creep, attacker);
    },

    // One heal intent per tick (heal and rangedHeal share a pipeline, the last call wins), so
    // pick exactly one target instead of letting a later self-heal cancel the attacker's.
    //   1. itself when below half (a dead healer heals nobody)
    //   2. its attacker: always when adjacent (pre-heals the bank's reflected damage), ranged
    //      when 2-3 tiles away and hurt
    //   3. the most damaged friend in range 3, e.g. a crippled healer or collector that cannot
    //      walk anywhere to be healed
    //   4. itself
    //   (an attacker with SPARE_BUFFER hits to spare lets a damaged friend go first)
    chooseHeal: function(creep, attacker) {
        if (creep.hits < creep.hitsMax * 0.5) {
            return creep.heal(creep);
        }
        const attackerRange = attacker ? creep.pos.getRangeTo(attacker) : Infinity;
        const spare = attacker && attacker.hits >= attacker.hitsMax - SPARE_BUFFER;
        if (attacker && !spare) {
            if (attackerRange <= 1) {
                return creep.heal(attacker);
            }
            if (attackerRange <= 3) {
                return creep.rangedHeal(attacker);
            }
        }
        const target = this.mostDamagedNear(creep, 3);
        if (target) {
            return creep.pos.isNearTo(target) ? creep.heal(target) : creep.rangedHeal(target);
        }
        if (attackerRange <= 1) {
            return creep.heal(attacker);
        }
        if (creep.hits < creep.hitsMax) {
            return creep.heal(creep);
        }
    },

    mostDamagedNear: function(creep, range) {
        const hurt = creep.pos.findInRange(FIND_CREEPS, range, {
            filter: (thisCreep) => thisCreep.hits < thisCreep.hitsMax && thisCreep.id != creep.id &&
                (thisCreep.my || Memory.whiteList.includes(thisCreep.owner.username) || thisCreep.owner.username == "Digital")
        });
        let target = hurt[0];
        for (const other of hurt) {
            if (other.hitsMax - other.hits > target.hitsMax - target.hits) target = other;
        }
        return target;
    },

    // After the bank: walk to and heal the most damaged of our creeps in the room (collectors
    // come to us too). False when nobody needs healing.
    healPatient: function(creep) {
        let patient;
        for (const other of runtimeCache.find(creep.room, FIND_MY_CREEPS)) {
            if (other.id == creep.id || other.hits >= other.hitsMax) continue;
            if (!patient || other.hitsMax - other.hits > patient.hitsMax - patient.hits) patient = other;
        }
        if (!patient) {
            if (creep.hits < creep.hitsMax) {
                creep.heal(creep);
                return true;
            }
            return false;
        }
        if (!creep.pos.isNearTo(patient)) {
            creep.travelTo(patient, { maxRooms: 1, range: 1 });
        }
        this.chooseHeal(creep, null);
        return true;
    }

};

module.exports = creep_powerHeal;
