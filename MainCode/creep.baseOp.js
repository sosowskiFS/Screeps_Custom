var creep_baseOp = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (!creep.memory.initialSetup || Game.time % 10000 == 0) {
            setupCreepMemory(creep);
        }

        // Generate ops if needed
        let totalOps = creep.carry[RESOURCE_OPS] || 0;
        if (totalOps < 600 && creep.powers[PWR_GENERATE_OPS] && creep.powers[PWR_GENERATE_OPS].cooldown <= 0) {
            if (creep.usePower(PWR_GENERATE_OPS) == OK) {
                totalOps += 6;
            }
        }

        // Find work if not focused on a task
        if (!creep.memory.jobFocus) {
            creep.memory.jobFocus = findNeededWork(creep, totalOps);
            if (creep.memory.jobFocus) {
                creep.memory.structureTarget = undefined;
            }
        }

        // Handle renewal first (highest priority)
        if (creep.ticksToLive <= 250 && Memory.powerSpawnList[creep.room.name]) {
            const powerSpawn = Game.getObjectById(Memory.powerSpawnList[creep.room.name][0]);
            if (powerSpawn && handleRenewal(creep, powerSpawn)) return;
        }

        // Execute current job
        let jobCompleted = false;
        switch (creep.memory.jobFocus) {
            case 'OPERATE_EXTENSION':
                if (creep.powers[PWR_OPERATE_EXTENSION].cooldown <= 0) {
                    if (handlePowerUsage(creep, PWR_OPERATE_EXTENSION, creep.room.storage, 2)) {
                        totalOps -= 2;
                        jobCompleted = true;
                    }
                } else {
                    // Power on cooldown, clear job and find new work
                    creep.memory.jobFocus = undefined;
                    jobCompleted = true;
                }
                break;
            case 'OPERATE_SPAWN':
                if (handlePowerUsage(creep, PWR_OPERATE_SPAWN, getNeededSpawn(creep), 2)) {
                    jobCompleted = true;
                }
                break;
            case 'OPERATE_TOWER':
                if (handlePowerUsage(creep, PWR_OPERATE_TOWER, getNeededTower(creep), 2)) {
                    jobCompleted = true;
                }
                break;
            case 'REGEN_SOURCE':
                if (creep.powers[PWR_REGEN_SOURCE].cooldown <= 0) {
                    if (handlePowerUsage(creep, PWR_REGEN_SOURCE, getNeededSource(creep), 2)) {
                        jobCompleted = true;
                    }
                } else {
                    // Power on cooldown, clear job and find new work
                    creep.memory.jobFocus = undefined;
                    jobCompleted = true;
                }
                break;
            case 'OPERATE_LAB':
                if (handlePowerUsage(creep, PWR_OPERATE_LAB, getNeededLab(creep), 2)) {
                    jobCompleted = true;
                }
                break;
            case 'OPERATE_POWER':
                if (handlePowerUsage(creep, PWR_OPERATE_POWER, getNeededPower(creep), 2)) {
                    jobCompleted = true;
                }
                break;
            case 'FILL_SPAWNS':
                jobCompleted = handleEnergyFillJob(creep, 'spawn');
                break;
            case 'FILL_POWER':
                jobCompleted = handlePowerFillJob(creep);
                break;
            default:
                // Busywork - general maintenance tasks
                handleBusyWork(creep);
                break;
        }

        // If job was completed, immediately try to find new work
        if (jobCompleted) {
            creep.memory.jobFocus = findNeededWork(creep, totalOps);
            if (creep.memory.jobFocus) {
                creep.memory.structureTarget = undefined;
                // Execute the new job immediately if it's not a power operation
                switch (creep.memory.jobFocus) {
                    case 'FILL_SPAWNS':
                        handleEnergyFillJob(creep, 'spawn');
                        break;
                    case 'FILL_POWER':
                        handlePowerFillJob(creep);
                        break;
                    default:
                        // Power operations need to wait for next tick due to cooldowns
                        if (!creep.memory.jobFocus.includes('OPERATE') && !creep.memory.jobFocus.includes('REGEN')) {
                            handleBusyWork(creep);
                        }
                        break;
                }
            } else {
                // No specific job found, do busywork
                handleBusyWork(creep);
            }
        }

        // Handle movement coordination and room enabling
        handleMovementCoordination(creep);
        handleRoomPowerEnable(creep);
        handleHostileAvoidance(creep);
    }
};

function setupCreepMemory(creep) {
    // Initialize spawn list
    if (!creep.memory.spawnList || Game.time % 10000 == 0) {
        const roomSpawns = creep.room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_SPAWN }
        });
        creep.memory.spawnList = roomSpawns.map(spawn => spawn.id);
    }

    // Initialize tower list
    if (!creep.memory.towerList || Game.time % 10000 == 0) {
        const roomTowers = creep.room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_TOWER }
        });
        creep.memory.towerList = roomTowers.map(tower => tower.id);
    }

    // Create room operator flag if needed
    if (!Game.flags[creep.room.name + "RoomOperator"]) {
        creep.room.createFlag(46, 2, creep.room.name + "RoomOperator");
    }

    // Set link source if available
    if ((Memory.linkList[creep.room.name] && Memory.linkList[creep.room.name].length >= 4) || 
        (Game.time % 10000 == 0 && Memory.linkList[creep.room.name] && Memory.linkList[creep.room.name].length >= 4)) {
        creep.memory.linkSource = Memory.linkList[creep.room.name][3];
    }

    // Set home room
    if (!creep.memory.homeRoom) {
        creep.memory.homeRoom = creep.pos.roomName;
    }

    // Clear job focus on setup
    creep.memory.jobFocus = undefined;
    creep.memory.initialSetup = true;
}

function findNeededWork(creep, totalOps) {
    const room = creep.room;
    
    // Priority-ordered work checks
    const workChecks = [
        {
            condition: creep.powers[PWR_OPERATE_EXTENSION] && creep.powers[PWR_OPERATE_EXTENSION].cooldown <= 0 && 
                      totalOps >= POWER_INFO[PWR_OPERATE_EXTENSION].ops &&
                      creep.powers[PWR_OPERATE_EXTENSION].cooldown <= 0 && 
                      room.storage && 
                      room.energyAvailable < (room.energyCapacityAvailable - 900),
            job: 'OPERATE_EXTENSION'
        },
        {
            condition: creep.powers[PWR_OPERATE_EXTENSION] && creep.powers[PWR_OPERATE_EXTENSION].level >= 5 && 
                       creep.powers[PWR_OPERATE_EXTENSION].cooldown > 0 && 
                       room.energyAvailable < room.energyCapacityAvailable,
            job: 'FILL_SPAWNS'
        },
        {
            condition: creep.powers[PWR_OPERATE_SPAWN] && creep.powers[PWR_OPERATE_SPAWN].cooldown <= 0 && 
                      (Game.flags[room.name + "RunningAssault"] || totalOps >= 600) && 
                      totalOps >= 100 && 
                      getNeededSpawn(creep),
            job: 'OPERATE_SPAWN'
        },
        {
            condition: creep.powers[PWR_OPERATE_TOWER] && creep.powers[PWR_OPERATE_TOWER].cooldown <= 0 && 
                      Memory.roomsUnderAttack.includes(room.name) && 
                      !Memory.roomsPrepSalvager.includes(room.name) && 
                      totalOps >= POWER_INFO[PWR_OPERATE_TOWER].ops && 
                      getNeededTower(creep),
            job: 'OPERATE_TOWER'
        },
        {
            condition: creep.powers[PWR_REGEN_SOURCE] && creep.powers[PWR_REGEN_SOURCE].cooldown <= 0 && 
                      getNeededSource(creep),
            job: 'REGEN_SOURCE'
        },
        {
            condition: creep.powers[PWR_OPERATE_LAB] && creep.powers[PWR_OPERATE_LAB].cooldown <= 0 && 
                      totalOps >= POWER_INFO[PWR_OPERATE_LAB].ops && 
                      !Game.flags[room.name + "WarBoosts"] && 
                      getNeededLab(creep),
            job: 'OPERATE_LAB'
        },
        {
            condition: creep.powers[PWR_OPERATE_POWER] && creep.powers[PWR_OPERATE_POWER].cooldown <= 0 && 
                      room.storage && room.storage.store[RESOURCE_POWER] >= 100 && 
                      totalOps >= POWER_INFO[PWR_OPERATE_POWER].ops && 
                      getNeededPower(creep),
            job: 'OPERATE_POWER'
        },
        {
            condition: room.storage && room.storage.store[RESOURCE_POWER] >= 100 && 
                      Memory.powerSpawnList[room.name] && 
                      creep.store.getFreeCapacity() >= 100 && 
                      Game.getObjectById(Memory.powerSpawnList[room.name][0]) && 
                      Game.getObjectById(Memory.powerSpawnList[room.name][0]).store[RESOURCE_POWER] <= 5,
            job: 'FILL_POWER'
        }
    ];

    for (const check of workChecks) {
        if (check.condition) return check.job;
    }
    
    return undefined;
}

function getNeededPower(creep) {
    if (!Memory.powerSpawnList[creep.room.name]) return undefined;
    
    const powerSpawn = Game.getObjectById(Memory.powerSpawnList[creep.room.name][0]);
    if (!powerSpawn) return undefined;
    
    return hasEffectActive(powerSpawn, PWR_OPERATE_POWER) ? undefined : powerSpawn;
}

function getNeededSource(creep) {
    let sourceNum = 0;
    for (let sourceID in Memory.sourceList[creep.room.name]) {
        if (sourceNum >= 1 && 
            Memory.roomsUnderAttack.includes(creep.room.name) && 
            !Memory.roomsPrepSalvager.includes(creep.room.name)) {
            continue; // Under attack, do not leave base
        }
        
        const thisSource = Game.getObjectById(Memory.sourceList[creep.room.name][sourceID]);
        if (thisSource && !hasEffectActive(thisSource, PWR_REGEN_SOURCE, 15)) {
            return thisSource;
        }
        sourceNum += 1;
    }
    return undefined;
}

function getNeededTower(creep) {
    for (let towerID in creep.memory.towerList) {
        const thisTower = Game.getObjectById(creep.memory.towerList[towerID]);
        if (thisTower && !hasEffectActive(thisTower, PWR_OPERATE_TOWER)) {
            return thisTower;
        }
    }
    return undefined;
}

function getNeededLab(creep) {
    if (!Memory.labList[creep.room.name]) return undefined;
    
    // Check if reagent labs have materials
    if (Memory.labList[creep.room.name][3] && Memory.labList[creep.room.name][4]) {
        const regLab1 = Game.getObjectById(Memory.labList[creep.room.name][3]);
        const regLab2 = Game.getObjectById(Memory.labList[creep.room.name][4]);
        if (!regLab1 || !regLab2 || !regLab1.mineralType || !regLab2.mineralType) {
            return undefined;
        }
    }
    
    // Check output labs (skip first 5 which are for boosts/reagents)
    for (let i = 5; i < 10; i++) {
        const labID = Memory.labList[creep.room.name][i];
        if (labID) {
            const thisLab = Game.getObjectById(labID);
            if (thisLab && !hasEffectActive(thisLab, PWR_OPERATE_LAB)) {
                return thisLab;
            }
        }
    }
    return undefined;
}

function getNeededSpawn(creep) {
    for (let spawnID in creep.memory.spawnList) {
        const thisSpawn = Game.getObjectById(creep.memory.spawnList[spawnID]);
        if (thisSpawn && !hasEffectActive(thisSpawn, PWR_OPERATE_SPAWN)) {
            return thisSpawn;
        }
    }
    return undefined;
}

// Helper function to check if a structure has an active power effect
function hasEffectActive(structure, powerType, minTimeRemaining = 0) {
    if (!structure.effects) return false;
    
    for (let effect of structure.effects) {
        if (effect.effect === powerType && effect.ticksRemaining > minTimeRemaining) {
            return true;
        }
    }
    return false;
}

// Helper Functions
function handlePowerUsage(creep, powerType, target, range = 2) {
    if (!target) {
        creep.memory.jobFocus = undefined;
        return false;
    }
    
    const useResult = creep.usePower(powerType, target);
    if (useResult == ERR_NOT_IN_RANGE) {
        creep.travelTo(target, {
            range: range,
            ignoreRoads: true,
            maxRooms: 1
        });
        return false;
    } else if (useResult == OK) {
        creep.memory.jobFocus = undefined;
        return true;
    }
    return false;
}

function handleRenewal(creep, powerSpawn) {
    const renewResult = creep.renew(powerSpawn);
    if (renewResult == ERR_NOT_IN_RANGE) {
        creep.travelTo(powerSpawn, {
            ignoreRoads: true,
            maxRooms: 1
        });
        return true; // Still handling renewal
    }
    return renewResult == OK;
}

function handleEnergyFillJob(creep, jobType) {
    // Power only fills extensions, fill spawns manually
    let checkValue = creep.room.energyCapacityAvailable - creep.room.energyAvailable;
    if (checkValue > 900) checkValue = 900;
    
    if (creep.carry[RESOURCE_ENERGY] < checkValue) {
        withdrawEnergyForJob(creep);
        return false; // Still gathering energy
    } else {
        return fillTargetStructures(creep, jobType);
    }
}

function handlePowerFillJob(creep) {
    if (!creep.carry[RESOURCE_POWER]) {
        const withdrawResult = creep.withdraw(creep.room.storage, RESOURCE_POWER, 100);
        if (withdrawResult == ERR_NOT_IN_RANGE) {
            creep.travelTo(creep.room.storage, {
                ignoreRoads: true,
                maxRooms: 1
            });
        } else if (withdrawResult == ERR_FULL) {
            creep.memory.jobFocus = undefined;
            return true; // Job completed (can't carry more)
        }
        return false; // Still gathering power
    } else {
        const pSpawn = Game.getObjectById(Memory.powerSpawnList[creep.room.name][0]);
        if (pSpawn) {
            const transferResult = creep.transfer(pSpawn, RESOURCE_POWER);
            if (transferResult == ERR_NOT_IN_RANGE) {
                creep.travelTo(pSpawn, {
                    maxRooms: 1,
                    ignoreRoads: true
                });
                return false; // Still moving to target
            } else if (transferResult == OK) {
                creep.memory.jobFocus = undefined;
                return true; // Job completed
            }
        } else {
            creep.memory.jobFocus = undefined;
            return true; // No power spawn, job completed
        }
    }
    return false;
}

function handleBusyWork(creep) {
    if (!creep.carry[RESOURCE_ENERGY]) {
        withdrawEnergyForJob(creep);
    } else {
        // Try to find immediate maintenance work
        if (performMaintenanceTasks(creep)) {
            // Found and started a maintenance task
            return;
        }
        // If no maintenance tasks found, continue with energy withdrawal for future tasks
        withdrawEnergyForJob(creep);
    }
}

function withdrawEnergyForJob(creep) {
    const neededAmount = creep.carryCapacity - (_.sum(creep.carry) + 6);
    creep.memory.structureTarget = undefined;
    
    // Check overflow link first
    const linkTarget = creep.memory.linkSource ? Game.getObjectById(creep.memory.linkSource) : undefined;
    
    if (linkTarget && linkTarget.energy >= 400) {
        if (creep.withdraw(linkTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.travelTo(linkTarget, { ignoreRoads: true, maxRooms: 1 });
        }
    } else {
        withdrawFromStorageOrTerminal(creep, neededAmount);
    }
}

function withdrawFromStorageOrTerminal(creep, neededAmount) {
    let storageTarget = creep.room.storage;
    
    // Prefer terminal in certain conditions
    if (creep.room.terminal) {
        const storageEnergy = (storageTarget && storageTarget.store[RESOURCE_ENERGY]) || 0;
        const terminalEnergy = creep.room.terminal.store[RESOURCE_ENERGY] || 0;
        
        if ((storageEnergy < 100000 && terminalEnergy > 0) ||
            (storageEnergy < 250000 && terminalEnergy > 31000)) {
            storageTarget = creep.room.terminal;
        }
    }
    
    if (storageTarget) {
        const withdrawResult = creep.withdraw(storageTarget, RESOURCE_ENERGY, neededAmount);
        if (withdrawResult == ERR_NOT_IN_RANGE) {
            creep.travelTo(storageTarget, { ignoreRoads: true, maxRooms: 1 });
        } else if (withdrawResult == ERR_NOT_ENOUGH_RESOURCES) {
            creep.withdraw(storageTarget, RESOURCE_ENERGY);
        }
    }
}

function fillTargetStructures(creep, jobType) {
    const savedTarget = Game.getObjectById(creep.memory.structureTarget);
    
    if (savedTarget && savedTarget.energy < savedTarget.energyCapacity) {
        if (creep.transfer(savedTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.travelTo(savedTarget, { ignoreRoads: true, maxRooms: 1 });
            return false; // Still moving to target
        } else {
            creep.memory.jobFocus = undefined;
            creep.memory.structureTarget = undefined;
            return true; // Successfully filled target
        }
    }
    
    // Find new target
    creep.memory.structureTarget = undefined;
    const structureType = jobType === 'spawn' ? STRUCTURE_SPAWN : STRUCTURE_EXTENSION;
    
    let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: (structure) => structure.structureType == structureType && structure.energy < structure.energyCapacity
    });
    
    if (!target) {
        target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (structure) => structure.structureType == structureType && structure.energy < structure.energyCapacity
        });
    }
    
    if (target) {
        if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.travelTo(target, { ignoreRoads: true, maxRooms: 1 });
            creep.memory.structureTarget = target.id;
            return false; // Still moving to target
        } else {
            creep.memory.jobFocus = undefined;
            return true; // Successfully filled target
        }
    } else {
        creep.memory.jobFocus = undefined;
        return true; // No targets found, job completed
    }
}

function performMaintenanceTasks(creep) {
    if (creep.memory.structureTarget) {
        const target = Game.getObjectById(creep.memory.structureTarget);
        if (target) {
            const result = creep.transfer(target, RESOURCE_ENERGY);
            if (result == ERR_NOT_IN_RANGE) {
                creep.travelTo(target, { ignoreRoads: true, maxRooms: 1 });
                return true; // Working on existing target
            } else if (result == OK) {
                creep.memory.structureTarget = undefined;
                // Task completed, try to find another immediately
                return performMaintenanceTasks(creep);
            }
        } else {
            creep.memory.structureTarget = undefined;
            // Target no longer exists, try to find another
            return performMaintenanceTasks(creep);
        }
        return true; // Working on target
    }
    
    // Priority order: Terminal -> Labs -> Factory -> PowerSpawn/Nuker -> Storage
    const tasks = [
        () => fillTerminal(creep),
        () => fillStructureType(creep, STRUCTURE_LAB, 'energyCapacity'),
        () => fillStructureType(creep, STRUCTURE_FACTORY, 10000, 'energy'),
        () => fillStorage(creep),
        () => creep.room.controller.level == 8 ? fillHighLevelStructures(creep) : false
    ];
    
    for (const task of tasks) {
        if (task()) return true;
    }
    
    return false; // No maintenance tasks found
}

function fillTerminal(creep) {
    if (!creep.room.terminal) return false;
    
    let targetEnergy = 0;
    if (creep.room.storage) {
        const storageEnergy = creep.room.storage.store[RESOURCE_ENERGY];
        if (storageEnergy >= 275000) targetEnergy = 60000;
        else if (storageEnergy >= 50000) targetEnergy = 30000;
    }
    
    const terminal = creep.room.terminal;
    if (terminal.store[RESOURCE_ENERGY] < targetEnergy && terminal.store.getFreeCapacity() > 5000) {
        creep.memory.structureTarget = terminal.id;
        if (creep.transfer(terminal, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.travelTo(terminal, { ignoreRoads: true, maxRooms: 1 });
        }
        return true;
    }
    return false;
}

function fillStructureType(creep, structureType, maxAmount, resourceType = 'energy') {
    const target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (structure) => {
            if (structure.structureType !== structureType) return false;
            
            if (resourceType === 'energy') {
                return structure.energy < (typeof maxAmount === 'string' ? structure[maxAmount] : maxAmount);
            } else {
                return structure.store[RESOURCE_ENERGY] < maxAmount;
            }
        }
    });
    
    if (target) {
        creep.memory.structureTarget = target.id;
        if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.travelTo(target, { ignoreRoads: true, maxRooms: 1 });
        } else {
            creep.memory.structureTarget = undefined;
        }
        return true;
    }
    return false;
}

function fillHighLevelStructures(creep) {
    const target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (structure) => {
            return (structure.structureType == STRUCTURE_POWER_SPAWN || 
                   structure.structureType == STRUCTURE_NUKER) && 
                   structure.energy < structure.energyCapacity;
        }
    });
    
    if (target) {
        creep.memory.structureTarget = target.id;
        if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.travelTo(target, { ignoreRoads: true, maxRooms: 1 });
        } else {
            creep.memory.structureTarget = undefined;
        }
        return true;
    }
    return false;
}

function fillStorage(creep) {
    if (!creep.room.storage) return false;
    
    const linkTarget = creep.memory.linkSource ? Game.getObjectById(creep.memory.linkSource) : undefined;
    
    if ((linkTarget && linkTarget.energy >= 400) || creep.room.storage.store[RESOURCE_ENERGY] < 50000) {
        if (creep.transfer(creep.room.storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.memory.structureTarget = creep.room.storage.id;
            creep.travelTo(creep.room.storage, { ignoreRoads: true, maxRooms: 1 });
            return true;
        }
    }
    return false;
}

function handleMovementCoordination(creep) {
    const talkingCreeps = creep.pos.findInRange(FIND_MY_CREEPS, 1, {
        filter: (thisCreep) => (creep.id != thisCreep.id && thisCreep.saying && 
                              thisCreep.saying != "\u261D\uD83D\uDE3C" && 
                              thisCreep.saying != "\uD83D\uDC4C\uD83D\uDE39")
    });
    
    if (talkingCreeps.length) {
        const coords = talkingCreeps[0].saying.split(";");
        if (coords.length == 2 && 
            creep.pos.x == parseInt(coords[0]) && 
            creep.pos.y == parseInt(coords[1])) {
            const direction = creep.pos.getDirectionTo(talkingCreeps[0].pos);
            creep.move(direction);
            creep.say("\uD83D\uDCA6", true);
        }
    }
}

function handleRoomPowerEnable(creep) {
    if (creep.room.controller && !creep.room.controller.isPowerEnabled) {
        if (creep.enableRoom(creep.room.controller) == ERR_NOT_IN_RANGE) {
            creep.travelTo(creep.room.controller, {
                ignoreRoads: true,
                maxRooms: 1
            });
        }
    }
}

function handleHostileAvoidance(creep) {
    if (Memory.roomsUnderAttack.indexOf(creep.room.name) == -1) return;
    
    const hostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 4, {
        filter: (eCreep) => ((eCreep.getActiveBodyparts(ATTACK) > 0 || 
                             eCreep.getActiveBodyparts(RANGED_ATTACK) > 0) && 
                            !Memory.whiteList.includes(eCreep.owner.username))
    });
    
    if (hostiles.length) {
        const closestHostile = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
            filter: (eCreep) => ((eCreep.getActiveBodyparts(ATTACK) > 0 || 
                                 eCreep.getActiveBodyparts(RANGED_ATTACK) > 0) && 
                                !Memory.whiteList.includes(eCreep.owner.username))
        });
        
        const powerSpawn = Memory.powerSpawnList[creep.room.name] ? 
                          Game.getObjectById(Memory.powerSpawnList[creep.room.name][0]) : null;
        
        if (powerSpawn) {
            creep.travelTo(powerSpawn, { ignoreRoads: true, maxRooms: 1 });
        } else if (closestHostile) {
            creep.travelTo(closestHostile, { 
                ignoreRoads: true, 
                range: 8, 
                maxRooms: 1 
            }, true);
        }
    }
}

module.exports = creep_baseOp;