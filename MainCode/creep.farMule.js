const remoteMining = require('system.remoteMining');
const combat = require('combat.tactics');
const runtimeCache = require('runtime.cache');
let creep_farMule = {
    run: function(creep, doExcessWork) {
        const targetFlag = remoteMining.target(creep);
        const carryUsed = getUsedCarry(creep);
        const carryCapacity = getCarryCapacity(creep);

        // Check if creep is near death
        if ((creep.ticksToLive <= creep.memory.deathWarn || creep.getActiveBodyparts(CARRY) <= 2) && creep.memory.priority != 'farMuleNearDeath') {
            creep.memory.priority = 'farMuleNearDeath';
        }

        // Determine if we should switch to storing mode (when carry is nearly full or when dying with resources)
        // Note: State switching also happens immediately after successful withdraw/transfer
        if (!creep.memory.storing && (carryUsed >= carryCapacity * 0.9 || (carryUsed > 0 && creep.ticksToLive <= 120))) {
            creep.memory.storing = true;
        } else if (creep.memory.storing && carryUsed == 0) {
            creep.memory.storing = false;
        }

        // Stay out of fights our guards are not winning; only the outbound trip targets the remote room.
        const workRoom = targetFlag ? targetFlag.pos.roomName : creep.memory.destination;
        if (combat.avoidDanger(creep, creep.memory.storing ? null : workRoom)) {
            return;
        }

        if (!creep.memory.storing) {
            // Mode: Go to remote room and collect energy

            // Energy lost in the mining room first: spill beside a full container (late or dead
            // mule), tombstones of haulers killed there, ruins. One shared lookup per room per tick.
            if (creep.room.name === workRoom && carryCapacity - carryUsed >= 100 && collectSalvage(creep)) {
                return;
            }
            
            // Find container target if not already set
            if (!creep.memory.containerTarget) {
                // Look for container near the flag
                const canDoScan = doExcessWork || (Game.time % 5 == 0);
                if (canDoScan && targetFlag && targetFlag.room) {
                    let containers = targetFlag.pos.findInRange(FIND_STRUCTURES, 3, {
                        filter: { structureType: STRUCTURE_CONTAINER }
                    });
                    if (containers.length > 0) {
                        creep.memory.containerTarget = containers[0].id;
                    }
                }
            }

            let targetContainer = Game.getObjectById(creep.memory.containerTarget);
            if (targetContainer && creep.pos.isNearTo(targetContainer) && !readyToWithdraw(creep, targetContainer, carryCapacity - carryUsed)) {
                // Parked at a container the miner is still filling: wait instead of
                // paying for a small withdraw every tick.
            } else if (targetContainer) {
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

// One withdraw per useful load. Takes whatever is there once enough has built up to
// fill the mule (or half a container), when the mule has waited 25 ticks, or when it
// must head home soon.
function readyToWithdraw(creep, container, freeCapacity) {
    const energy = container.store[RESOURCE_ENERGY];
    if (energy <= 0) {
        return false;
    }
    if (energy >= freeCapacity || energy >= CONTAINER_CAPACITY / 2 || creep.ticksToLive <= 150) {
        delete creep.memory.waitSince;
        return true;
    }
    if (!creep.memory.waitSince) {
        creep.memory.waitSince = Game.time;
    }
    if (Game.time - creep.memory.waitSince >= 25) {
        delete creep.memory.waitSince;
        return true;
    }
    return false;
}

const SALVAGE_MIN = 200;

function salvageIn(room) {
    const tick = runtimeCache.current();
    const cache = tick.remoteSalvage || (tick.remoteSalvage = Object.create(null));
    if (!cache[room.name]) {
        const list = runtimeCache.find(room, FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount >= SALVAGE_MIN
        });
        for (const type of [FIND_TOMBSTONES, FIND_RUINS]) {
            for (const holder of runtimeCache.find(room, type)) {
                if (holder.store[RESOURCE_ENERGY] >= SALVAGE_MIN) list.push(holder);
            }
        }
        cache[room.name] = list;
    }
    return cache[room.name];
}

function collectSalvage(creep) {
    const list = salvageIn(creep.room);
    if (!list.length) return false;
    const target = creep.pos.findClosestByRange(list);
    if (!target) return false;
    const result = target.amount !== undefined ? creep.pickup(target) : creep.withdraw(target, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
        creep.travelTo(target, { maxRooms: 1 });
    }
    return result === OK || result === ERR_NOT_IN_RANGE;
}

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
