const { placeRoadOnPath, clearTravelMemory } = require('creep.movement');
const { withdrawEnergy, transferEnergy, getStorageTarget, findEnergySink, findAndMoveToDistributionTarget } = require('creep.logistics');

module.exports = {
    run: function(creep) {
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'distributorNearDeath') {
            creep.memory.priority = 'distributorNearDeath';
        }

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
                    // Calculate remaining energy after transfer since creep.carry doesn't update immediately
                    let transferAmount = Math.min(creep.carry[RESOURCE_ENERGY], savedTarget.energyCapacity - savedTarget.energy);
                    let remainingEnergy = creep.carry[RESOURCE_ENERGY] - transferAmount;
                    // If creep will be empty after transfer, immediately start moving back to energy source
                    if (remainingEnergy <= 0) {
                        // Immediately start moving back to energy source
                        let linkTarget = creep.memory.linkSource ? Game.getObjectById(creep.memory.linkSource) : undefined;
                        if (linkTarget && linkTarget.energy >= 600) {
                            creep.travelTo(linkTarget, { ignoreRoads: true });
                        } else {
                            var storageTarget = creep.room.storage;
                            if (creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 100000 && creep.room.terminal.store[RESOURCE_ENERGY] > 0) {
                                storageTarget = creep.room.terminal;
                            } else if (creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 250000 && creep.room.terminal.store[RESOURCE_ENERGY] > 31000) {
                                storageTarget = creep.room.terminal;
                            }
                            if (storageTarget) {
                                creep.travelTo(storageTarget, { ignoreRoads: true });
                            }
                        }
                    } else {
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
                        }
                    }
                }
            }
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
                if (!creep.pos.isNearTo(homeSpawn)) {
                    creep.travelTo(homeSpawn);
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
