const combatIntel = require('combat.intel');
const runtimeCache = require('runtime.cache');
var creep_powerAttack = {

    /** @param {Creep} creep **/
    run: function(creep) {
        // Cache frequently used values
        const homeRoom = creep.memory.homeRoom;
        const powerAttackFlagName = homeRoom + "PowerAttack";
        const powerAttackFlag = Game.flags[powerAttackFlagName];
        
        if (!powerAttackFlag) {
            //You are not required
            creep.suicide();
            return;
        }
        
        if (!creep.memory.disabledNotify) {
            creep.notifyWhenAttacked(false);
            creep.memory.disabledNotify = true;
        }
        
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'powerAttackNearDeath') {
            creep.memory.priority = 'powerAttackNearDeath';
        }
        
        //Flag active
        if (creep.room.name != creep.memory.destination) {
            //Travel to room - removed redundant condition check
            creep.travelTo(powerAttackFlag);
        } else {
                //Main loop
                if (!creep.memory.targetBank) {
                    const powerAttackFlag = Game.flags[powerAttackFlagName];
                    if (powerAttackFlag && powerAttackFlag.room) {
                        var powerBanks = powerAttackFlag.pos.lookFor(LOOK_STRUCTURES);
                        if (powerBanks.length) {
                            creep.memory.targetBank = powerBanks[0].id
                            creep.travelTo(powerBanks[0]);
                            if (!creep.memory.travelDistance && creep.memory._trav && creep.memory._trav.path) {
                                creep.memory.travelDistance = creep.memory._trav.path.length;
                                creep.memory.deathWarn = (creep.memory.travelDistance + _.size(creep.body) * 3) + 15;
                            }
                        } else {
                            //No bank located, delete flags
                            powerAttackFlag.remove();
                            const powerGuardFlag = Game.flags[homeRoom + "PowerGuard"];
                            if (powerGuardFlag) {
                                powerGuardFlag.remove();
                            }
                        }
                    } else {
                        // Travel to flag position if we don't have room vision
                        creep.travelTo(powerAttackFlag);
                        if (!creep.memory.travelDistance && creep.memory._trav && creep.memory._trav.path) {
                            creep.memory.travelDistance = creep.memory._trav.path.length;
                            creep.memory.deathWarn = (creep.memory.travelDistance + _.size(creep.body) * 3) + 15;
                        }
                    }

                } else if (creep.hits >= 2500) {
                    var thisBank = Game.getObjectById(creep.memory.targetBank);
                    if (thisBank) {
                        const contest = assessContest(creep, homeRoom, thisBank);
                        if (contest.abort) {
                            // Rivals here would win the fight: stop feeding them power and creeps.
                            const message = Game.time + ' : ' + creep.room.name + ' power bank abandoned, outmatched by ' + contest.owner;
                            console.log(message);
                            Memory.LastNotification = message;
                            powerAttackFlag.remove();
                            const powerGuardFlag = Game.flags[homeRoom + "PowerGuard"];
                            if (powerGuardFlag) {
                                powerGuardFlag.remove();
                            }
                            return;
                        }
                        let attackResult = ERR_BUSY;
                        if (!contest.holdKill) {
                            attackResult = creep.attack(thisBank);
                        } else if (!creep.pos.isNearTo(thisBank)) {
                            attackResult = ERR_NOT_IN_RANGE;
                        }
                        if (attackResult == ERR_NOT_IN_RANGE) {
                            creep.travelTo(thisBank);
                        } else if (attackResult == OK && thisBank.hits >= 1500000) {
                            creep.memory.checkForOwnership = true;
                        }
                        if (thisBank.hits <= 468000 && !Game.flags[homeRoom + "PowerPickup"]) {
                            //Set flag to signal mule creation
                            Game.rooms[creep.room.name].createFlag(25, 25, homeRoom + "PowerPickup");
                        }
                    } else {
                        //Cannot find bank, abort
                        powerAttackFlag.remove();
                        const powerGuardFlag = Game.flags[homeRoom + "PowerGuard"];
                        if (powerGuardFlag) {
                            powerGuardFlag.remove();
                        }
                    }
                }
            }
        
        // Handle enemy interactions (moved outside main logic for better performance)
        if (creep.memory.checkForOwnership) {
            var AgreementList = AGREEMENT_LIST;

            let inRangeEnemy = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 2, {
                filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username) && eCreep.getActiveBodyparts(ATTACK) > 0)
            });
            
            if (inRangeEnemy.length) {
                const enemy = inRangeEnemy[0];
                if (!creep.memory.isOwner) {
                    if (AgreementList.includes(enemy.owner.username)) {
                        //They were here first, cancel flag.
                        powerAttackFlag.remove();        
                        const powerGuardFlag = Game.flags[homeRoom + "PowerGuard"];
                        if (powerGuardFlag) {
                            powerGuardFlag.remove();
                        }
                        console.log(Game.time.toString() + " | " + creep.room.name + " gave ownership of power bank to " + enemy.owner.username);
                        Memory.LastNotification = Game.time.toString() + " : " + creep.room.name + " gave ownership of power bank to " + enemy.owner.username
                    } else {
                        if (!Game.flags[homeRoom + "PowerGuard"] && creep.room.name == creep.memory.destination) {
                            creep.room.createFlag(25, 25, homeRoom + "PowerGuard");
                        }
                        if (creep.pos.isNearTo(enemy)) {
                            creep.attack(enemy);
                        }                 
                        creep.memory.isOwner = true;
                    }
                } else if (!AgreementList.includes(enemy.owner.username)) {
                    if (creep.pos.isNearTo(enemy)) {
                        creep.attack(enemy);
                    }
                    if (!Game.flags[homeRoom + "PowerGuard"] && creep.room.name == creep.memory.destination) {
                        creep.room.createFlag(25, 25, homeRoom + "PowerGuard");
                    }
                }        
            } else if (!creep.memory.isOwner) {
                creep.memory.isOwner = true;
            }
        }
    }

};

// Players we have agreements with: they keep banks they reached first.
const AGREEMENT_LIST = ["slowmotionghost", "Digital"];

// Rival players at the bank: call the escort, remember the room is contested, and decide
// whether to give up (losing fight) or hold the final hit (bank would drop power for them).
function assessContest(creep, homeRoom, bank) {
    const intel = combatIntel.roomIntel(creep.room);
    const rivals = intel.threats.filter(c => c.owner.username !== 'Invader' && !AGREEMENT_LIST.includes(c.owner.username));
    if (!rivals.length) {
        return {};
    }
    if (!Memory.powerContested) Memory.powerContested = {};
    Memory.powerContested[homeRoom] = Game.time;
    if (!Game.flags[homeRoom + "PowerGuard"]) {
        creep.room.createFlag(25, 25, homeRoom + "PowerGuard");
    }
    if (intel.verdict === 'lose') {
        return { abort: true, owner: rivals[0].owner.username };
    }
    // Breaking the bank drops the power on the ground for whoever is standing there.
    let bankDps = 0;
    for (const friend of intel.friends) {
        if (friend.memory.priority === 'powerAttack' || friend.memory.priority === 'powerAttackNearDeath') {
            bankDps += combatIntel.assess(friend).melee;
        }
    }
    const collectorsHere = runtimeCache.find(creep.room, FIND_MY_CREEPS, {
        filter: c => c.memory.priority === 'powerCollector'
    }).length > 0;
    const holdKill = !collectorsHere && bank.hits <= bankDps * 3 && bank.ticksToDecay > 50;
    return { holdKill };
}

module.exports = creep_powerAttack;