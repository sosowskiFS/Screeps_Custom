const { placeRoadOnPath, clearTravelMemory } = require('creep.movement');
const { withdrawEnergy, transferEnergy, getStorageTarget, findEnergySink, findAndMoveToDistributionTarget, returnIfEmptied } = require('creep.logistics');
const { operatorPresent } = require('creep.baseOp');

const IDLE_RANGE = 3;              // idle wait distance from the home spawn
const POWER_SPAWN_ENERGY_LOW = 4000;

function powerSpawnOf(room) {
    const list = Memory.powerSpawnList && Memory.powerSpawnList[room.name];
    return list && list.length ? Game.getObjectById(list[0]) : null;
}

// Keep the power spawn stocked when no operator is here to do it (the operator is otherwise
// the only creep that loads power). Only uses spare time: the room's spawns and extensions
// come first. Returns true when it acted this tick.
function servicePowerSpawn(creep) {
    const room = creep.room;
    const carriedPower = creep.store[RESOURCE_POWER] || 0;
    const powerSpawn = carriedPower || room.energyAvailable >= room.energyCapacityAvailable ? powerSpawnOf(room) : null;
    if (carriedPower) {
        // Deliver it; if the power spawn is gone or full, put it back.
        let target = powerSpawn && powerSpawn.store.getFreeCapacity(RESOURCE_POWER) > 0 ? powerSpawn : null;
        if (!target) target = room.storage && room.storage.store.getFreeCapacity() > 0 ? room.storage : room.terminal;
        if (!target) {
            creep.drop(RESOURCE_POWER);
            return true;
        }
        if (creep.transfer(target, RESOURCE_POWER) === ERR_NOT_IN_RANGE) creep.travelTo(target);
        return true;
    }
    if (!powerSpawn || operatorPresent(room.name) || Memory.roomsUnderAttack.indexOf(room.name) !== -1) return false;
    const used = creep.store.getUsedCapacity();
    if (used === 0) {
        const free = powerSpawn.store.getFreeCapacity(RESOURCE_POWER);
        if (free < 50) return false;
        const source = [room.storage, room.terminal].find(s => s && (s.store[RESOURCE_POWER] || 0) > 0);
        if (!source) return false;
        const amount = Math.min(free, creep.store.getFreeCapacity(), source.store[RESOURCE_POWER]);
        if (creep.withdraw(source, RESOURCE_POWER, amount) === ERR_NOT_IN_RANGE) creep.travelTo(source);
        return true;
    }
    if (creep.store[RESOURCE_ENERGY] === used && powerSpawn.store[RESOURCE_ENERGY] < POWER_SPAWN_ENERGY_LOW &&
        (powerSpawn.store[RESOURCE_POWER] || 0) > 0) {
        if (creep.transfer(powerSpawn, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.travelTo(powerSpawn);
        return true;
    }
    return false;
}

module.exports = {
    servicePowerSpawn,
    run: function(creep) {
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'distributorNearDeath') {
            creep.memory.priority = 'distributorNearDeath';
        }
        // A lab worker on loan, needed back for boosting: put the load away and go back at once.
        const boosts = require('system.guardBoosts');
        if (creep.memory.previousPriority == 'labWorker' && boosts.mineralsUrgent(creep.room)) {
            const carried = Object.keys(creep.store).find(r => creep.store[r] > 0);
            if (!carried) {
                creep.memory.priority = 'labWorker';
                return;
            }
            const home = [creep.room.storage, creep.room.terminal].find(s => s && s.store.getFreeCapacity(carried) > 0);
            if (home && creep.transfer(home, carried) === ERR_NOT_IN_RANGE) creep.travelTo(home);
            return;
        }
        if (servicePowerSpawn(creep)) return;

        if (_.sum(creep.carry) <= 0) {
            if (creep.memory.previousPriority == 'labWorker' && creep.memory.hasDistributed) {
                creep.memory.priority = 'labWorker';
                return;
            }
            creep.memory.structureTarget = undefined;
            //Get from storage
            //Look for dropped energy to use
            let locatedTarget = false;
            if (creep.memory.groundEnergy) {
                let groundTarget = Game.getObjectById(creep.memory.groundEnergy)
                if (groundTarget) {
                    if (creep.pickup(groundTarget) == ERR_NOT_IN_RANGE && groundTarget.amount >= 100) {
                        creep.travelTo(groundTarget, {
                            ignoreRoads: true
                        });
                        locatedTarget = true;
                    } else {
                        creep.memory.groundEnergy = undefined;
                    }
                } else {
                    creep.memory.groundEnergy = undefined;
                }
            }
            if (!locatedTarget && Memory.roomsUnderAttack.indexOf(creep.room.name) === -1) {
                let groundItems = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 10, {
                    filter: (thisResource) => {
                        return (thisResource.resourceType == RESOURCE_ENERGY && thisResource.amount >= 100);
                    }
                });
                if (groundItems.length > 0) {
                    if (creep.pickup(groundItems[0]) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(groundItems[0], {
                            ignoreRoads: true
                        });
                        creep.memory.groundEnergy = groundItems[0].id;
                        locatedTarget = true;
                    }
                }
            }
            if (!locatedTarget) {
                //Check 4th link first just in case
                var linkTarget = undefined;
                if (creep.memory.linkSource) {
                    linkTarget = Game.getObjectById(creep.memory.linkSource)
                }
                if (linkTarget && linkTarget.energy >= 600) {
                    const withdrawResult = creep.withdraw(linkTarget, RESOURCE_ENERGY);
                    if (withdrawResult == ERR_NOT_IN_RANGE) {
                        creep.travelTo(linkTarget, {
                            ignoreRoads: true
                        });
                    } else if (withdrawResult == OK) {
                        // Immediately start moving to distribution target
                        findAndMoveToDistributionTarget(creep);
                    }
                } else {
                    var storageTarget = creep.room.storage;
                    if (creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 100000 && creep.room.terminal.store[RESOURCE_ENERGY] > 0) {
                        storageTarget = creep.room.terminal;
                    } else if (creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 250000 && creep.room.terminal.store[RESOURCE_ENERGY] > 31000) {
                        storageTarget = creep.room.terminal;
                    }
                    if (storageTarget) {
                        const withdrawResult = creep.withdraw(storageTarget, RESOURCE_ENERGY);
                        if (withdrawResult == ERR_NOT_IN_RANGE) {
                            creep.travelTo(storageTarget, {
                                ignoreRoads: true
                            });
                        } else if (withdrawResult == OK) {
                            // Immediately start moving to distribution target
                            findAndMoveToDistributionTarget(creep);
                        }
                    }
                }
            }
        } else if (creep.room.energyAvailable < creep.room.energyCapacityAvailable) {
            if (creep.memory.previousPriority == 'labWorker' && !creep.memory.hasDistributed) {
                creep.memory.hasDistributed = true;
            }
            var savedTarget = Game.getObjectById(creep.memory.structureTarget);
            var getNewStructure = false;
            if (savedTarget && savedTarget.energy < savedTarget.energyCapacity) {
                const transferResult = creep.transfer(savedTarget, RESOURCE_ENERGY);
                if (transferResult == ERR_NOT_IN_RANGE) {
                    creep.travelTo(savedTarget);
                    placeRoadOnPath(creep);
                } else {
                    if (transferResult == OK) {
                        clearTravelMemory(creep);
                    }
                    creep.memory.structureTarget = undefined;
                    // Emptied by this transfer: head straight back to the energy source.
                    if (transferResult != OK || !returnIfEmptied(creep, savedTarget, { ignoreRoads: true })) {
                        getNewStructure = true;
                    }
                }
            } else if (savedTarget) {
                getNewStructure = true;
                creep.memory.structureTarget = undefined;
            }
            if (!creep.memory.structureTarget) {
                // Skip the structure just filled; its store does not update until next tick.
                var target = findEnergySink(creep, undefined, getNewStructure ? savedTarget.id : undefined);

                if (target) {
                    if (getNewStructure) {
                        creep.travelTo(target);
                        placeRoadOnPath(creep);
                        creep.memory.structureTarget = target.id;
                    } else {
                        const transferResult = creep.transfer(target, RESOURCE_ENERGY);
                        if (transferResult == ERR_NOT_IN_RANGE) {
                            creep.travelTo(target);
                            placeRoadOnPath(creep);
                            creep.memory.structureTarget = target.id;
                        } else if (transferResult == OK) {
                            clearTravelMemory(creep);
                            returnIfEmptied(creep, target, { ignoreRoads: true });
                        }
                    }
                }
            }
        } else if (creep.store[RESOURCE_ENERGY] > 0 && boosts.labNeedingEnergy(creep)) {
            // Spawns and extensions full: the energy the leased boost labs need (the lab worker
            // stays on the compounds).
            const lab = boosts.labNeedingEnergy(creep);
            if (creep.transfer(lab, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.travelTo(lab);
        } else if (Memory.roomsUnderAttack.indexOf(creep.room.name) == -1 && creep.room.terminal && creep.room.storage && creep.room.storage.store[RESOURCE_ENERGY] < 250000 && creep.room.terminal.store[RESOURCE_ENERGY] > 31000) {
            if (creep.memory.previousPriority == 'labWorker' && !creep.memory.hasDistributed) {
                creep.memory.hasDistributed = true;
            }
            transferEnergy(creep, creep.room.storage);
        } else if (creep.room.controller.level != 8 && Memory.linkList[creep.room.name].length > 1) {
            if (creep.memory.previousPriority == 'labWorker' && !creep.memory.hasDistributed) {
                creep.memory.hasDistributed = true;
            }
            var upLink = Game.getObjectById(Memory.linkList[creep.room.name][1]);
            transferEnergy(creep, upLink);
        } else if (_.sum(creep.carry) < creep.carryCapacity) {
            if (creep.memory.previousPriority == 'labWorker' && !creep.memory.hasDistributed) {
                creep.memory.hasDistributed = true;
            }
            let linkTarget = creep.memory.linkSource ? Game.getObjectById(creep.memory.linkSource) : undefined;
            if (!withdrawEnergy(creep, linkTarget)) {
                let storageTarget = getStorageTarget(creep);
                if (storageTarget) {
                    withdrawEnergy(creep, storageTarget);
                }
            }
        } else {
            if (creep.memory.previousPriority == 'labWorker' && !creep.memory.hasDistributed) {
                creep.memory.hasDistributed = true;
            }
            var homeSpawn = Game.getObjectById(creep.memory.fromSpawn)
            if (homeSpawn) {
                if (!creep.pos.inRangeTo(homeSpawn, IDLE_RANGE)) {
                    // Wait nearby, not on the tiles next to the spawn: other idle creeps (the mule)
                    // want those too, and two creeps swapping over one tile never settle.
                    creep.travelTo(homeSpawn, { range: IDLE_RANGE });
                } else {
                    //Make sure you're not in the way
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
        }

    }
};
