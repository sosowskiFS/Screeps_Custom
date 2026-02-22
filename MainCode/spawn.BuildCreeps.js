var spawn_BuildCreeps = {
    run: function(spawn, bestWorker, thisRoom, RoomCreeps, energyIndex) {

        const roomName = thisRoom.name;
        const strSources = Memory.sourceList[roomName] || [];
        const firstSource = strSources[0];
        const secondSource = strSources[1];

        let harvesterCount = 0;
        let builderCount = 0;
        let upgraderCount = 0;
        let repairerCount = 0;
        let supplierCount = 0;
        let distributorCount = 0;
        let defenderCount = 0;
        let assignedSlot1Count = 0;
        let assignedSlot2Count = 0;

        for (let i = 0; i < RoomCreeps.length; i++) {
            const creep = RoomCreeps[i];
            if (!creep || !creep.memory) {
                continue;
            }

            const priority = creep.memory.priority;
            if (priority == 'harvester') {
                harvesterCount++;
                if (firstSource && creep.memory.sourceLocation == firstSource) {
                    assignedSlot1Count++;
                } else if (secondSource && creep.memory.sourceLocation == secondSource) {
                    assignedSlot2Count++;
                }
            } else if (priority == 'builder') {
                builderCount++;
            } else if (priority == 'upgrader') {
                upgraderCount++;
            } else if (priority == 'repair') {
                repairerCount++;
            } else if (priority == 'supplier') {
                supplierCount++;
            } else if (priority == 'distributor') {
                distributorCount++;
            } else if (priority == 'defender') {
                defenderCount++;
            }
        }

        // Dynamic creep limits based on room level and available energy
        let harvesterMax = Math.min(2, strSources.length);
        let builderMax = thisRoom.find(FIND_CONSTRUCTION_SITES).length > 0 ? 1 : 0;
        let upgraderMax = getUpgraderMax(thisRoom);
        let repairMax = getRepairMax(thisRoom);
        let supplierMax = 0;
        let distributorMax = getDistributorMax(thisRoom);

        let bareMinConfig = [MOVE, MOVE, WORK, CARRY, CARRY];
        let buildDirections = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
        let supplierDirection = [];
        
        // Allow suppliers to spawn from any direction if Supply flag exists (no proximity requirement for low level rooms)
        if (Game.flags[thisRoom.name + "Supply"]) {
            // For autobuild rooms with spawn next to Supply flag, prefer the direction towards the flag
            if (Memory.autoBuildRooms.indexOf(thisRoom.name) > -1 && Game.flags[thisRoom.name + "Supply"].pos.isNearTo(spawn)) {
                let targetDir = spawn.pos.getDirectionTo(Game.flags[thisRoom.name + "Supply"]);
                buildDirections.splice(buildDirections.indexOf(targetDir), 1);
                supplierDirection.push(targetDir);
            } else {
                // For all other cases (non-autobuild rooms or spawn not next to flag), use all directions
                supplierDirection = buildDirections; // Use all available directions
            }
        }

        if (strSources.length == 1) {
            harvesterMax = 1;
            // Don't reduce other limits for single source rooms - they still need workers
        }

        //For Level 4+ with storage
        if (thisRoom.storage) {
            supplierMax = 1; // Always have at least 1 supplier when storage exists
            
            // Scale upgraders based on energy availability and room level
            if (thisRoom.storage.store[RESOURCE_ENERGY] >= 50000) {
                upgraderMax = Math.min(upgraderMax + 1, 4);
            }
            if (thisRoom.storage.store[RESOURCE_ENERGY] >= 100000) {
                upgraderMax = Math.min(upgraderMax + 1, 5);
            }
        }
        
        // Ensure suppliers are enabled if Supply flag exists
        if (Game.flags[thisRoom.name + "Supply"] && supplierMax === 0) {
            supplierMax = 1;
        }

        if (Game.flags[thisRoom.name + "upFocus"]) {
            //Laser focus on upgrading
            upgraderMax = upgraderMax + repairMax;
            repairMax = 0;
        }

        let defenderEnergyLim = 780;
        if (thisRoom.controller.level == 4) {
            defenderEnergyLim = 1170;
        }

        if (RoomCreeps.length == 0 && spawn.canCreateCreep(bareMinConfig) == OK) {
            //In case of complete destruction, make a minimum viable worker
            let configCost = calculateConfigCost(bareMinConfig);
            if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                spawn.spawnCreep(bareMinConfig, 'harvester_' + spawn.name + '_' + Game.time, {
                    memory: {
                        priority: 'harvester',
                        sourceLocation: strSources[0],
                        homeRoom: thisRoom.name
                    },
					directions: buildDirections
                });
            }

            global.setSpawnBusy(spawn);
        } else if (Memory.roomsUnderAttack.indexOf(thisRoom.name) != -1 && Memory.roomsPrepSalvager.indexOf(thisRoom.name) == -1 && thisRoom.energyCapacityAvailable >= defenderEnergyLim && defenderCount < 2 && harvesterCount >= harvesterMax) {
            //Try to produce millitary units
                 var ToughCount = 0;
                var MoveCount = 0;
                var AttackCount = 0;
                var RangedCount = 0;
                var HealCount = 0;
                var totalParts = 0;

                var remainingEnergy = Memory.CurrentRoomEnergy[energyIndex];
                var thisBuildAmount = 500;
                while ((remainingEnergy / thisBuildAmount) >= 1) {
                    //switch (ChosenPriority) {
                    //case 'melee':
                    //ToughCount = ToughCount + 1;
                    MoveCount = MoveCount + 2;
                    RangedCount = RangedCount + 3;
                    remainingEnergy = remainingEnergy - 500;
                    //RangedCount = RangedCount + 1;
                    totalParts = totalParts + 5;
                    //break;
                    //case 'ranged':
                    //MoveCount = MoveCount + 2;
                    //RangedCount = RangedCount + 2;
                    //totalParts = totalParts + 4;
                    //remainingEnergy = remainingEnergy - 400;
                    //break;
                    //}

                    if (totalParts >= 50) {
                        break;
                    }
                }

                var ChosenCreepSet = [];
                while (ToughCount > 0) {
                    ChosenCreepSet.push(TOUGH);
                    ToughCount--;
                }
                while (AttackCount > 0) {
                    ChosenCreepSet.push(ATTACK);
                    AttackCount--;
                }
                while (RangedCount > 0) {
                    ChosenCreepSet.push(RANGED_ATTACK);
                    RangedCount--;
                }
                while (MoveCount > 0) {
                    ChosenCreepSet.push(MOVE);
                    MoveCount--;
                }

                if (ChosenCreepSet.length > 50) {
                    while (ChosenCreepSet.length > 50) {
                        ChosenCreepSet.splice(0, 1)
                    }
                }

                Memory.CurrentRoomEnergy[energyIndex] = remainingEnergy;

                spawn.spawnCreep(ChosenCreepSet, 'defender_' + spawn.name + '_' + Game.time, {
                    memory: {
                        priority: 'defender',
                        fromSpawn: spawn.id,
                        homeRoom: thisRoom.name
                    },
					directions: buildDirections
                });
                global.setSpawnBusy(spawn);
        } else if ((harvesterCount < harvesterMax || builderCount < builderMax || upgraderCount < upgraderMax || repairerCount < repairMax || supplierCount < supplierMax || distributorCount < distributorMax)) {
            var prioritizedRole = 'harvester';
            var creepSourceID = '';
            
            // Prioritize essential roles first, then support roles
            if (harvesterCount < harvesterMax) {
                prioritizedRole = 'harvester';
                if (assignedSlot1Count > 0) {
                    //Assign slot 2
                    creepSourceID = strSources[1];
                } else {
                    //Assign slot 1
                    creepSourceID = strSources[0];
                }
                bestWorker = getMinerConfig(thisRoom.energyCapacityAvailable, RoomCreeps.length, harvesterCount);
            } else if (distributorCount < distributorMax && thisRoom.energyCapacityAvailable >= 150) {
                prioritizedRole = 'distributor';
                bestWorker = getDistributorConfig(thisRoom.energyCapacityAvailable, RoomCreeps.length, harvesterCount);
            } else if (supplierCount < supplierMax && supplierDirection.length > 0 && thisRoom.energyCapacityAvailable >= 200) {
                prioritizedRole = 'supplier';
                bestWorker = getSupplierConfig(thisRoom.energyCapacityAvailable);
            } else if (upgraderCount < upgraderMax && thisRoom.energyCapacityAvailable >= 200) {
                prioritizedRole = 'upgrader';
                bestWorker = getWorkerConfig(thisRoom.energyCapacityAvailable, 'upgrader');
            } else if (builderCount < builderMax && thisRoom.energyCapacityAvailable >= 200) {
                prioritizedRole = 'builder';
                bestWorker = getWorkerConfig(thisRoom.energyCapacityAvailable, 'builder');
            } else if (repairerCount < repairMax && thisRoom.energyCapacityAvailable >= 200) {
                prioritizedRole = 'repair';
                bestWorker = getWorkerConfig(thisRoom.energyCapacityAvailable, 'repair');
            } else {
                // No valid role to spawn
                return;
            }

            let configCost = calculateConfigCost(bestWorker);
            
            if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
				if (prioritizedRole == 'supplier') {
					spawn.spawnCreep(bestWorker, prioritizedRole + '_' + spawn.name + '_' + Game.time, {
						memory: {
							priority: prioritizedRole,
							fromSpawn: spawn.id,
							sourceLocation: creepSourceID,
							homeRoom: thisRoom.name,
							deathWarn: _.size(bestWorker) * 6,
							structureTarget: undefined
						},
						directions: supplierDirection
					});
				} else {
					spawn.spawnCreep(bestWorker, prioritizedRole + '_' + spawn.name + '_' + Game.time, {
						memory: {
							priority: prioritizedRole,
							fromSpawn: spawn.id,
							sourceLocation: creepSourceID,
							homeRoom: thisRoom.name,
							deathWarn: _.size(bestWorker) * 6,
							structureTarget: undefined
						},
						directions: buildDirections
					});
				}
                
            }
            global.setSpawnBusy(spawn);
        }
    }
};

function calculateConfigCost(bodyConfig) {
    var totalCost = 0;
    for (let thisPart of bodyConfig) {
        totalCost = totalCost + BODYPART_COST[thisPart];
    }
    return totalCost;
}

function getUpgraderMax(room) {
    // Base upgraders on room level and energy availability
    if (room.controller.level < 3) return 2;
    if (room.controller.level < 5) return 3;
    if (room.controller.level < 8) return 2;
    return 1; // RCL 8 needs fewer upgraders
}

function getRepairMax(room) {
    // Only spawn repairers when there are damaged structures
    const damagedStructures = room.find(FIND_STRUCTURES, {
        filter: (structure) => structure.hits < structure.hitsMax && structure.structureType != STRUCTURE_WALL && structure.structureType != STRUCTURE_RAMPART
    });
    return damagedStructures.length > 0 ? 1 : 0;
}

function getDistributorMax(room) {
    return 1;
}

function getWorkerConfig(energyCap, role) {
    // Generic worker configuration for upgraders, builders, and repairers
    let config = [];
    let remainingEnergy = energyCap;
    
    // Minimum viable config
    if (remainingEnergy < 200) return [MOVE, WORK, CARRY];
    
    // Calculate optimal WORK/CARRY/MOVE ratio
    let workParts = 0;
    let carryParts = 0;
    let moveParts = 0;
    
    // For workers, prioritize WORK parts for efficiency
    while (remainingEnergy >= 150 && workParts < 6) { // WORK(100) + CARRY(50) = 150
        workParts++;
        carryParts++;
        remainingEnergy -= 150;
    }
    
    // Add additional CARRY for builders/repairers who need to transport more
    if ((role === 'builder' || role === 'repair') && remainingEnergy >= 50 && carryParts < workParts * 2) {
        let additionalCarry = Math.min(Math.floor(remainingEnergy / 50), workParts);
        carryParts += additionalCarry;
        remainingEnergy -= additionalCarry * 50;
    }
    
    // Calculate MOVE parts (1 MOVE per 2 other parts, minimum 1)
    moveParts = Math.max(1, Math.ceil((workParts + carryParts) / 2));
    
    // Adjust if we don't have enough energy for moves
    while (moveParts * 50 > remainingEnergy && moveParts > 1) {
        moveParts--;
    }
    
    // Build the config
    for (let i = 0; i < workParts; i++) config.push(WORK);
    for (let i = 0; i < carryParts; i++) config.push(CARRY);
    for (let i = 0; i < moveParts; i++) config.push(MOVE);
    
    return config;
}

function getSupplierConfig(energyCap) {
    // Suppliers focus on CARRY and MOVE for transportation
    let config = [];
    let remainingEnergy = energyCap;
    
    if (remainingEnergy < 100) return [MOVE, CARRY];
    
    let carryParts = 0;
    let moveParts = 0;
    
    // Add CARRY parts up to a reasonable limit
    while (remainingEnergy >= 100 && carryParts < 8) { // CARRY(50) + MOVE(50) = 100
        carryParts++;
        moveParts++;
        remainingEnergy -= 100;
    }
    
    // Add extra CARRY if we have energy left
    while (remainingEnergy >= 50 && carryParts < 12) {
        carryParts++;
        remainingEnergy -= 50;
    }
    
    // Build the config
    for (let i = 0; i < carryParts; i++) config.push(CARRY);
    for (let i = 0; i < moveParts; i++) config.push(MOVE);
    
    return config;
}

function getMinerConfig(energyCap, numRoomCreeps, numHarvesters) {
    // Miners should be optimized for energy extraction
    // A source generates 10 energy/tick, so we need 5 WORK parts to harvest it all (5 * 2 = 10)
    if (energyCap < 300 || numRoomCreeps <= 1) {
        return [MOVE, WORK, WORK, CARRY]; // Emergency minimum viable miner
    }
    
    let config = [];
    let workParts = 0;
    let carryParts = 1; // Start with 1 CARRY for basic functionality
    let moveParts = 0;
    
    // Target 5 WORK parts for optimal harvesting (5 * 2 = 10 energy/tick = source output)
    const optimalWorkParts = 5;
    const workCost = 100;
    const carryCost = 50;
    const moveCost = 50;
    
    // Calculate how many WORK parts we can afford, up to optimal
    let maxAffordableWork = Math.min(optimalWorkParts, Math.floor((energyCap - carryCost - moveCost) / workCost));
    workParts = Math.max(2, maxAffordableWork); // At least 2 WORK parts
    
    // Calculate remaining energy after WORK parts
    let remainingEnergy = energyCap - (workParts * workCost);
    
    // Add extra CARRY if we have room and energy (miners don't need much CARRY, but some is useful)
    if (remainingEnergy >= carryCost * 2) {
        carryParts = 2; // 2 CARRY parts is usually sufficient for miners
        remainingEnergy -= carryCost;
    }
    
    // Calculate MOVE parts - we want enough to move at normal speed
    // Rule: 1 MOVE per 2 other parts for normal speed on roads, more for off-road
    let totalOtherParts = workParts + carryParts;
    let desiredMoveParts = Math.ceil(totalOtherParts / 2);
    
    // Use remaining energy for MOVE parts
    moveParts = Math.min(desiredMoveParts, Math.floor(remainingEnergy / moveCost));
    moveParts = Math.max(1, moveParts); // At least 1 MOVE part
    
    // Build the config with optimal part ordering (WORK first for efficiency)
    for (let i = 0; i < workParts; i++) config.push(WORK);
    for (let i = 0; i < carryParts; i++) config.push(CARRY);
    for (let i = 0; i < moveParts; i++) config.push(MOVE);
    
    return config;
}

function getDistributorConfig(energyCap, numRoomCreeps, numHarvesters) {
    // Distributors focus on moving energy efficiently
    // Lower energy requirement for early game rooms
    if (energyCap < 150) {
        return [MOVE, CARRY, CARRY]; // Very minimal distributor for RCL 1-2
    }
    
    return [MOVE, MOVE, CARRY, CARRY, CARRY]; // Early game distributor
    
    //rest is whatever
    let config = [];
    let remainingEnergy = energyCap;
    let carryParts = 0;
    let moveParts = 0;
    
    // Add CARRY and MOVE parts in 2:1 ratio for efficiency
    while (remainingEnergy >= 100 && carryParts < 10) { // CARRY(50) + MOVE(50) = 100
        carryParts += 2;
        moveParts += 1;
        remainingEnergy -= 100;
        
        if (remainingEnergy >= 50 && carryParts < 12) {
            carryParts++;
            remainingEnergy -= 50;
        }
    }
    
    // Ensure minimum configuration
    if (carryParts < 3) {
        carryParts = 3;
        moveParts = 2;
    }
    
    // Build the config
    for (let i = 0; i < carryParts; i++) config.push(CARRY);
    for (let i = 0; i < moveParts; i++) config.push(MOVE);
    
    return config;
    
}

module.exports = spawn_BuildCreeps;
