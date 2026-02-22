let creep_farMule = {
    run: function(creep, doExcessWork) {
        const targetFlag = Game.flags[creep.memory.targetFlag];
        const carryUsed = getUsedCarry(creep);
        const carryCapacity = getCarryCapacity(creep);

        // Check if creep is near death
        if ((creep.ticksToLive <= creep.memory.deathWarn || creep.getActiveBodyparts(CARRY) <= 2) && creep.memory.priority != 'farMuleNearDeath') {
            creep.memory.priority = 'farMuleNearDeath';
        }

        // Initialize storing state
        if (creep.memory.storing == null) {
            creep.memory.storing = false;
        }

        // Determine if we should switch to storing mode (when carry is nearly full or when dying with resources)
        // Note: State switching also happens immediately after successful withdraw/transfer
        if (!creep.memory.storing && (carryUsed >= carryCapacity * 0.9 || (carryUsed > 0 && creep.ticksToLive <= 120))) {
            creep.memory.storing = true;
        } else if (creep.memory.storing && carryUsed == 0) {
            creep.memory.storing = false;
        }

        if (!creep.memory.storing) {
            // Mode: Go to remote room and collect energy
            
            // Find container target if not already set
            if (!creep.memory.containerTarget) {
                // Look for container near the flag
                const canDoScan = doExcessWork || (Game.time % 5 == 0);
                if (canDoScan && targetFlag && targetFlag.room) {
                    let containers = targetFlag.pos.findInRange(FIND_STRUCTURES, 3, {
                        filter: (structure) => structure.structureType == STRUCTURE_CONTAINER
                    });
                    if (containers.length > 0) {
                        creep.memory.containerTarget = containers[0].id;
                    }
                }
            }

            let targetContainer = Game.getObjectById(creep.memory.containerTarget);
            if (targetContainer) {
                // Withdraw from container
                let withdrawResult = creep.withdraw(targetContainer, RESOURCE_ENERGY);
                if (withdrawResult == ERR_NOT_IN_RANGE) {
                    creep.travelTo(targetContainer);
                } else if (withdrawResult == OK) {
                    // Successfully withdrew - check if we should switch to storing mode and start moving home immediately
                    if (getUsedCarry(creep) >= carryCapacity * 0.9) {
                        creep.memory.storing = true;
                        let storageUnit = Game.getObjectById(creep.memory.storageSource);
                        if (storageUnit) {
                            creep.travelTo(storageUnit);
                        } else {
                            creep.travelTo(new RoomPosition(25, 25, creep.memory.homeRoom));
                        }
                    }
                }
            } else {
                // Travel to flag position to find container
                if (targetFlag) {
                    creep.travelTo(targetFlag);
                } else {
                    // Fallback: travel to destination room center
                    creep.travelTo(new RoomPosition(25, 25, creep.memory.destination));
                }
            }
        } else {
            // Mode: Return to home room and deposit energy
            
            let storageUnit = Game.getObjectById(creep.memory.storageSource);
            if (storageUnit) {
                // Transfer to storage
                let transferResult = creep.transfer(storageUnit, RESOURCE_ENERGY);
                if (transferResult == ERR_NOT_IN_RANGE) {
                    creep.travelTo(storageUnit);
                } else if (transferResult == OK) {
                    // Successfully transferred - check if we emptied our carry and start moving back to container immediately
                    if (getUsedCarry(creep) == 0) {
                        creep.memory.storing = false;
                        let targetContainer = Game.getObjectById(creep.memory.containerTarget);
                        if (targetContainer) {
                            creep.travelTo(targetContainer);
                        } else if (targetFlag) {
                            creep.travelTo(targetFlag);
                        } else {
                            creep.travelTo(new RoomPosition(25, 25, creep.memory.destination));
                        }
                    }
                }
            } else {
                // Travel to home room center to find storage
                creep.travelTo(new RoomPosition(25, 25, creep.memory.homeRoom));
            }
        }
    }
};

function getUsedCarry(creep) {
    if (creep.store && creep.store.getUsedCapacity) {
        return creep.store.getUsedCapacity();
    }
    return _.sum(creep.carry);
}

function getCarryCapacity(creep) {
    if (creep.store && creep.store.getCapacity) {
        return creep.store.getCapacity();
    }
    return creep.carryCapacity;
}

module.exports = creep_farMule;