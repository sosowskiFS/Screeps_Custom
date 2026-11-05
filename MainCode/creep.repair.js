const runtimeCache = require('runtime.cache');
const BOOST_MIN_LIFE = 750;
const NPC = new Set(['Invader', 'Source Keeper']);
// Hostile creeps of another player (not NPCs, not whitelisted) in the room.
function playerAttack(room) {
    const white = Memory.whiteList || [];
    return runtimeCache.find(room, FIND_HOSTILE_CREEPS).some(c => c.owner && !NPC.has(c.owner.username) && !white.includes(c.owner.username));
}
var creep_repair = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'repairNearDeath') {
            creep.memory.priority = 'repairNearDeath';
        }
        // Under attack: repairs only from tiles no attacker can hit (combat.tactics.guardRepairs).
        if (require('combat.tactics').guardRepairs(creep)) return;   // stepped out of an attacker's reach

        // Repair boosts (XLH2O) only while the room is under attack by a player (not NPC invaders),
        // and only for a repairer with BOOST_MIN_LIFE ticks or more left to use them: they used to be
        // spent on every repairer the moment a lab held them. An unboosted repairer still boosts if
        // such an attack starts during its life.
        const attacked = Memory.roomsUnderAttack.indexOf(creep.room.name) != -1;
        if (attacked && !creep.memory.hasBoosted && (creep.ticksToLive || 0) >= BOOST_MIN_LIFE && playerAttack(creep.room) && creep.room.controller.level >= 6 && Memory.labList[creep.room.name].length >= 3 && !creep.memory.previousPriority) {
            var mineralCost = creep.getActiveBodyparts(WORK) * LAB_BOOST_MINERAL;
            var energyCost = creep.getActiveBodyparts(WORK) * LAB_BOOST_ENERGY;
            var repairLab = runtimeCache.find(creep.room, FIND_MY_STRUCTURES, {
                filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_LEMERGIUM_ACID)
            });
            if (repairLab.length && repairLab[0].mineralAmount >= mineralCost && repairLab[0].energy >= energyCost) {
                const result = repairLab[0].boostCreep(creep);
                if (result == ERR_NOT_IN_RANGE) {
                    creep.travelTo(repairLab[0]);
                    return;
                }
                creep.memory.hasBoosted = true;   // boosted, or it cannot be: work
                if (result == OK) return;
            }
        }
        {
            let repairRange = 2;
            if (attacked) {
                repairRange = 3;
            }

            if (creep.carryCapacity > 0) {
                findNewTarget(creep, getUsedCarry(creep), repairRange);
            } else {
                creep.suicide();
            }
        }
    }
};

function findNewTarget(creep, creepEnergy, repairRange) {
    if (creepEnergy <= 0) {
        creep.memory.structureTarget = undefined;
        if (creep.memory.previousPriority && creep.memory.previousPriority == 'mule') {
            creep.memory.priority = "mule";
        } else {
            //Get from storage
            var storageTarget = creep.room.storage;
            const overflow = require('creep.logistics').overflowSource(creep);   // the upgrade miner's overflow link first
            const home = require('creep.logistics').homeEnergy(creep.room, 200);   // the terminal first under attack
            if (overflow) {
                storageTarget = overflow;
            } else if (home && home === creep.room.terminal) {
                storageTarget = home;
            } else if (creep.room.terminal && storageTarget && storageTarget.store[RESOURCE_ENERGY] < 250000 && creep.room.terminal.store[RESOURCE_ENERGY] > require('system.siegeWatch').terminalEnergyGoal(creep.room) + 1000) {
                storageTarget = creep.room.terminal;
            }
            if (storageTarget && storageTarget.store[RESOURCE_ENERGY] >= 200 && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                var withdrawResult = creep.withdraw(storageTarget, RESOURCE_ENERGY);
                if (withdrawResult == ERR_NOT_IN_RANGE) {
                    creep.travelTo(storageTarget, {
                        maxRooms: 1
                    });
                } else if (withdrawResult == OK) {
                    assignRepairTargetAndAct(creep, repairRange);
                }
            } else if (storageTarget) {
                var spawnTarget = Game.getObjectById(creep.memory.fromSpawn);
                if (spawnTarget && !creep.pos.inRangeTo(spawnTarget, 3)) {
                    creep.travelTo(spawnTarget, {
                        maxRooms: 1,
                        range: 3
                    });
                }
            }
        }
    } else if (creep.memory.structureTarget) {
        let doRepair = true;
        if (creep.memory.previousPriority == 'mule' && getEnergyCarry(creep) > 300 && require('system.links').upgradeLink(creep.room)) {
            let upgraderLink = require('system.links').upgradeLink(creep.room);
            if (upgraderLink && upgraderLink.energy < 100 && getEnergyCarry(creep) > 0 && upgraderLink.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                doRepair = false;
                creep.memory.priority = 'mule';
                creep.memory.structureTarget = upgraderLink.id;
                if (creep.transfer(upgraderLink, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.travelTo(upgraderLink);
                }
            }
        }
        if (doRepair) {
            let thisStructure = Game.getObjectById(creep.memory.structureTarget);
            if (thisStructure) {
                if (thisStructure.hits == thisStructure.hitsMax) {
                    //No repair needed, clear for reassignment
                    Memory.repairTarget[creep.room.name] = undefined;
                    creep.memory.structureTarget = undefined;
                } else {
                    //If using last bit of energy this tick, find new target
                    if (thisStructure.hits < thisStructure.hitsMax && getEnergyCarry(creep) > 0) {
                        let repairResult = creep.repair(thisStructure);
                        if (repairResult == ERR_NOT_IN_RANGE) {
                            creep.travelTo(thisStructure, {
                                maxRooms: 1,
                                range: repairRange
                            });
                        } else if (repairResult == OK) {
                            if (Game.time % 5 == 0 && !nudgeBlockingUnits(creep, true)) {
                                creep.travelTo(thisStructure, {
                                    maxRooms: 1,
                                    range: repairRange
                                });
                            }
                        }
                        if (repairResult == OK && creepEnergy <= creep.getActiveBodyparts(WORK)) {
                            creep.memory.structureTarget = undefined;
                        }
                    }
                }
            } else {
                Memory.repairTarget[creep.room.name] = undefined;
                creep.memory.structureTarget = undefined;
            }
        }
    } else {
        assignRepairTargetAndAct(creep, repairRange);
    }

    if (!creep.memory.structureTarget && creepEnergy > 0) {
        assignRepairTargetAndAct(creep, repairRange);
    }
}

function assignRepairTargetAndAct(creep, repairRange) {
    if (Memory.repairTarget[creep.room.name]) {
        let closestDamagedStructure = Game.getObjectById(Memory.repairTarget[creep.room.name]);
        if (closestDamagedStructure && closestDamagedStructure.hits < closestDamagedStructure.hitsMax && getEnergyCarry(creep) > 0) {
            creep.memory.structureTarget = Memory.repairTarget[creep.room.name];
            if (creep.repair(closestDamagedStructure) == ERR_NOT_IN_RANGE) {
                creep.travelTo(closestDamagedStructure, {
                    maxRooms: 1,
                    range: repairRange || 1
                });
            }
        } else if (!closestDamagedStructure || closestDamagedStructure.hits == closestDamagedStructure.hitsMax) {
            Memory.repairTarget[creep.room.name] = undefined;
        }
    } else {
        // No repair target found, listen for other creeps needing to move
        if (Game.time % 5 == 0) {
            nudgeBlockingUnits(creep, false);
        }
    }
}

function nudgeBlockingUnits(creep, includePowerCreeps) {
    let talkingCreeps = creep.pos.findInRange(FIND_MY_CREEPS, 1, {
        filter: (thisCreep) => (creep.id != thisCreep.id && thisCreep.saying)
    });
    if (talkingCreeps.length) {
        let coords = talkingCreeps[0].saying.split(";");
        if (talkingCreeps[0].memory.priority != 'repair' && coords.length == 2 && creep.pos.x == parseInt(coords[0]) && creep.pos.y == parseInt(coords[1])) {
            let thisDirection = creep.pos.getDirectionTo(talkingCreeps[0].pos);
            creep.move(thisDirection);
            creep.say("\uD83D\uDCA6", true);
            return true;
        }
    }

    if (includePowerCreeps && Game.flags[creep.room.name + "RoomOperator"]) {
        talkingCreeps = creep.pos.findInRange(FIND_MY_POWER_CREEPS, 1, {
            filter: (thisCreep) => (creep.id != thisCreep.id && thisCreep.saying)
        });
        if (talkingCreeps.length) {
            let powerCoords = talkingCreeps[0].saying.split(";");
            if (powerCoords.length == 2 && creep.pos.x == parseInt(powerCoords[0]) && creep.pos.y == parseInt(powerCoords[1])) {
                let powerDirection = creep.pos.getDirectionTo(talkingCreeps[0].pos);
                creep.move(powerDirection);
                creep.say("\uD83D\uDCA6", true);
                return true;
            }
        }
    }

    return false;
}

function getUsedCarry(creep) {
    if (creep.store && creep.store.getUsedCapacity) {
        return creep.store.getUsedCapacity();
    }
    return _.sum(creep.carry);
}

function getEnergyCarry(creep) {
    if (creep.store && creep.store.getUsedCapacity) {
        return creep.store.getUsedCapacity(RESOURCE_ENERGY) || 0;
    }
    return creep.carry[RESOURCE_ENERGY] || 0;
}

creep_repair.playerAttack = playerAttack;
creep_repair.BOOST_MIN_LIFE = BOOST_MIN_LIFE;
module.exports = creep_repair;
