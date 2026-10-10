const runtimeCache = require('runtime.cache');
const defenseWatch = require('defense.watch');
var spawn_BuildCreeps = {
    run: function(spawn, bestWorker, thisRoom, RoomCreeps, energyIndex) {

        const roomName = thisRoom.name;
        const strSources = Memory.sourceList[roomName] || [];
        // Bodies are sized to the energy on hand (this tick's budget), not the room's full capacity:
        // a young room spawns as soon as it can afford a useful body instead of waiting for every
        // extension to fill. Only creeps homed here count as the room's own: visiting helpers and
        // guards used to hide that it had none (shardX E29N36 sat at 400/400 spawning nothing).
        const budget = Memory.CurrentRoomEnergy[energyIndex] || 0;
        const ownCreeps = RoomCreeps.filter(c => c && c.memory && c.memory.homeRoom === roomName).length;
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
            } else if (priority == 'repair' && creep.memory.homeRoom === roomName) {
                repairerCount++;
            } else if (priority == 'supplier') {
                supplierCount++;
            } else if (priority == 'distributor') {
                distributorCount++;
            } else if (priority == 'defender') {
                defenderCount++;
            }
        }

        // Dynamic creep limits based on room level and available energy.
        // Harvesters: every source mined to 5 WORK (its full 10 energy/tick). Early bodies (RCL1-2)
        // are too small for 5 WORK, so a source gets more harvesters until it has 5 WORK or no
        // free tile left; one harvester per source used to leave a third or more unmined.
        const harvestSource = sourceShortOfWork(thisRoom, strSources, RoomCreeps);
        let builderMax = runtimeCache.find(thisRoom, FIND_CONSTRUCTION_SITES).length > 0 ? 1 : 0;
        let upgraderMax = getUpgraderMax(thisRoom);
        // Walls around the controller: one local repairer keeps strengthening them (claim defense).
        const controllerWalls = require('system.claimDefense').controllerWalls(thisRoom);
        let repairMax = controllerWalls.length ? 1 : getRepairMax(thisRoom);
        let supplierMax = 0;
        let distributorMax = getDistributorMax(thisRoom);

        let bareMinConfig = [MOVE, MOVE, WORK, CARRY, CARRY];
        let buildDirections = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
        let supplierDirection = [];
        
        // Suppliers spawn from any direction; with a Supply flag beside this spawn in an auto-build
        // room, straight onto the flag. No flag (e.g. mid base migration): any direction too.
        if (!Game.flags[thisRoom.name + "Supply"]) {
            supplierDirection = buildDirections;
        } else {
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

        //For Level 4+ with storage
        if (thisRoom.storage) {
            // The supplier feeds towers from the storage: only with both. Before the storage the
            // distributor fills the towers (it used to be spawned for any Supply flag, and could
            // not even pick up energy).
            const towers = runtimeCache.find(thisRoom, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });
            supplierMax = towers.length ? 1 : 0;

            // Scale upgraders based on energy availability and room level
            if (thisRoom.storage.store[RESOURCE_ENERGY] >= 50000) {
                upgraderMax = Math.min(upgraderMax + 1, 4);
            }
            if (thisRoom.storage.store[RESOURCE_ENERGY] >= 100000) {
                upgraderMax = Math.min(upgraderMax + 1, 5);
            }
        }

        // Energy piling up in the source containers (nobody spends it fast enough): an extra
        // upgrader per nearly full container, so the harvest is spent instead of overflowing.
        upgraderMax = Math.min(UPGRADER_CAP, upgraderMax + Math.min(2, fullSourceContainers(thisRoom, strSources)));

        // Helpers from a sponsor (creep.helper) build and upgrade here: each one present stands in
        // for the room's own builder, then for an upgrader (one upgrader is always kept).
        let helpers = RoomCreeps.filter(c => c && c.memory && c.memory.priority === 'helper' && c.memory.destination === roomName).length;
        if (helpers) {
            const fromBuilder = Math.min(helpers, builderMax);
            builderMax -= fromBuilder;
            helpers -= fromBuilder;
            upgraderMax = Math.max(1, upgraderMax - helpers);
        }

        if (Game.flags[thisRoom.name + "upFocus"]) {
            //Laser focus on upgrading
            upgraderMax = upgraderMax + (controllerWalls.length ? 0 : repairMax);
            repairMax = controllerWalls.length ? 1 : 0;
        }

        let defenderEnergyLim = 780;
        if (thisRoom.controller.level == 4) {
            defenderEnergyLim = 1170;
        }

        if (ownCreeps == 0 && calculateConfigCost(bareMinConfig) <= budget) {
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
        } else if (Memory.roomsUnderAttack.indexOf(thisRoom.name) != -1 && Memory.roomsPrepSalvager.indexOf(thisRoom.name) == -1 && thisRoom.energyCapacityAvailable >= defenderEnergyLim && defenderCount < 2 && !harvestSource && !defenseWatch.isDraining(thisRoom.name)) {
            //Try to produce millitary units
                // RANGED_ATTACK/MOVE pairs (+ HEAL), ranged parts in front (combat.bodies).
                var ChosenCreepSet = require('combat.bodies').youngDefender(Memory.CurrentRoomEnergy[energyIndex]);
                var remainingEnergy = Memory.CurrentRoomEnergy[energyIndex] - require('combat.bodies').cost(ChosenCreepSet);

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
        } else if ((harvestSource || builderCount < builderMax || upgraderCount < upgraderMax || repairerCount < repairMax || supplierCount < supplierMax || distributorCount < distributorMax)) {
            var prioritizedRole = 'harvester';
            var creepSourceID = '';

            // Prioritize essential roles first, then support roles
            if (harvestSource) {
                prioritizedRole = 'harvester';
                creepSourceID = harvestSource;
                bestWorker = getMinerConfig(budget, ownCreeps, harvesterCount);
            } else if (distributorCount < distributorMax && thisRoom.energyCapacityAvailable >= 150) {
                prioritizedRole = 'distributor';
                bestWorker = getDistributorConfig(budget, ownCreeps, harvesterCount);
            } else if (supplierCount < supplierMax && supplierDirection.length > 0 && thisRoom.energyCapacityAvailable >= 200) {
                prioritizedRole = 'supplier';
                bestWorker = getSupplierConfig(budget);
            } else if (controllerWalls.length && repairerCount < repairMax && upgraderCount >= 1 && budget >= 200) {
                prioritizedRole = 'repair';
                bestWorker = getWorkerConfig(budget, 'repair');
            } else if (upgraderCount < upgraderMax && thisRoom.energyCapacityAvailable >= 200) {
                prioritizedRole = 'upgrader';
                bestWorker = getWorkerConfig(budget, 'upgrader');
            } else if (builderCount < builderMax && thisRoom.energyCapacityAvailable >= 200) {
                prioritizedRole = 'builder';
                bestWorker = getWorkerConfig(budget, 'builder');
            } else if (repairerCount < repairMax && thisRoom.energyCapacityAvailable >= 200) {
                prioritizedRole = 'repair';
                bestWorker = getWorkerConfig(budget, 'repair');
            } else {
                // No valid role to spawn
                return;
            }

            bestWorker = fitBody(bestWorker, budget);
            let configCost = calculateConfigCost(bestWorker);

            if (bestWorker.length && configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
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

// Drop parts from the end until the body costs at most `energy` (empty when nothing useful fits).
function fitBody(body, energy) {
    const out = body.slice();
    while (out.length && calculateConfigCost(out) > energy) out.pop();
    const has = type => out.includes(type);
    return has(MOVE) && (has(WORK) || has(CARRY)) ? out : [];
}

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

// Young-room repair work (creep.workV2) besides the controller walls: what a repairer would
// actually be sent to. Roads are patched by passing creeps; other walls and ramparts are not
// raised here; source containers are kept up by their harvesters, so a container only counts once
// it is below half.
function needsRepair(structure) {
    const type = structure.structureType;
    // The rampart shell (spawn, towers, storage, Supply tile) up to its cap; no other rampart.
    if (type === STRUCTURE_RAMPART) return !!structure.room && require('system.guardSquads').shellRampartDue(structure.room, structure);
    if (type === STRUCTURE_ROAD || type === STRUCTURE_WALL) return false;
    if (type === STRUCTURE_CONTAINER) return structure.hits < structure.hitsMax / 2;
    return structure.hitsMax - structure.hits >= 200;
}

function getRepairMax(room) {
    // Only spawn repairers when there is something a repairer would repair (decaying roads used
    // to keep one alive permanently, and it then worked on walls).
    return runtimeCache.find(room, FIND_STRUCTURES, { filter: needsRepair }).length > 0 ? 1 : 0;
}

const UPGRADER_CAP = 6;
const SOURCE_WORK = 5;            // WORK parts that harvest a source's full output

// Free tiles around a source (harvest positions), cached per source.
const slotCache = {};
function harvestSlots(source) {
    if (slotCache[source.id] !== undefined) return slotCache[source.id];
    const terrain = source.room.getTerrain();
    let n = 0;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if ((dx || dy) && terrain.get(source.pos.x + dx, source.pos.y + dy) !== TERRAIN_MASK_WALL) n++;
        }
    }
    return (slotCache[source.id] = n);
}

// The source that most needs another harvester: below 5 WORK with a free tile left (fewest WORK
// first), or undefined. A creep ordered this tick (no body yet) counts as a full harvester.
function sourceShortOfWork(room, sourceIds, roomCreeps) {
    let best, bestWork = Infinity;
    for (const id of sourceIds) {
        const source = Game.getObjectById(id);
        if (!source) continue;
        const assigned = roomCreeps.filter(c => c && c.memory && c.memory.priority === 'harvester' && c.memory.sourceLocation === id);
        const work = assigned.reduce((n, c) => n + (c.pending || typeof c.getActiveBodyparts !== 'function' ? SOURCE_WORK : c.getActiveBodyparts(WORK)), 0);
        if (work >= SOURCE_WORK || assigned.length >= harvestSlots(source)) continue;
        if (work < bestWork) { best = id; bestWork = work; }
    }
    return best;
}

// Containers beside the sources that are nearly full: harvested energy about to overflow.
function fullSourceContainers(room, sourceIds) {
    const sources = sourceIds.map(id => Game.getObjectById(id)).filter(Boolean);
    return runtimeCache.find(room, FIND_STRUCTURES, { filter: { structureType: STRUCTURE_CONTAINER } })
        .filter(c => c.store[RESOURCE_ENERGY] >= 1500 && sources.some(s => s.pos.inRangeTo(c.pos, 2))).length;
}

function getDistributorMax(room) {
    return 1;
}

// Young rooms have no roads (they come with the terminal, room.stage), so bodies are built for
// unpaved ground. Fatigue per tile is 2 per WORK and per loaded CARRY on plains (10 on swamp),
// and each MOVE removes 2: MOVE = WORK + CARRY keeps a loaded creep at full speed on plains.
// Bodies are whole blocks sized to the energy on hand; the old worker body dropped MOVE parts to
// fit (800 energy: 5 WORK, 5 CARRY, 1 MOVE, one tile per 5-10 ticks off-road).
//   repair    [WORK, CARRY, MOVE]: moves at full speed empty, half loaded; repairs most of the trip
//   upgrader  [WORK, CARRY, MOVE]: stands at the controller most of its life; walks half speed loaded
//   builder   [WORK, CARRY, CARRY, MOVE, MOVE]: walks between sites all day; a load lasts twice as
//             long (a WORK builds 5/tick) and it walks at full speed empty, two-thirds loaded
const WORKER_BLOCKS = {
    repair: { block: [WORK, CARRY, MOVE], max: 6 },
    upgrader: { block: [WORK, CARRY, MOVE], max: 8 },
    builder: { block: [WORK, CARRY, CARRY, MOVE, MOVE], max: 5 },
};
function getWorkerConfig(energyCap, role) {
    let spec = WORKER_BLOCKS[role] || WORKER_BLOCKS.upgrader;
    if (energyCap < calculateConfigCost(spec.block)) spec = WORKER_BLOCKS.upgrader;   // not one block yet: the basic one
    const cost = calculateConfigCost(spec.block);
    const blocks = Math.max(1, Math.min(spec.max, Math.floor(energyCap / cost), Math.floor(50 / spec.block.length)));
    // Same part types together: WORK first, MOVE last.
    const body = [];
    for (const type of [WORK, CARRY, MOVE]) {
        const n = spec.block.filter(p => p === type).length * blocks;
        for (let i = 0; i < n; i++) body.push(type);
    }
    return body;
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
    if (energyCap < 300) return [MOVE, WORK, CARRY];              // 200: the least that can harvest and carry
    if (numRoomCreeps <= 1) return [MOVE, WORK, WORK, CARRY];     // 300: emergency miner
    
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
    
    // Calculate remaining energy after WORK parts and the first CARRY
    let remainingEnergy = energyCap - (workParts * workCost) - carryCost;
    
    // One CARRY only: a harvester stands on its container and harvests straight into it; the CARRY
    // is for building and repairing that container. (A second one was 50 energy for nothing.)

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
    // CARRY/MOVE 1:1: full speed loaded on unpaved ground. Sized to the energy on hand, up to 8 pairs
    // (400 per trip); it used to stay at 150 carried (5 parts) whatever the room could afford, so
    // an RCL3-4 room needed 6-9 slow trips per refill.
    if (energyCap < 200) return [CARRY, MOVE];
    const pairs = Math.min(8, Math.floor(energyCap / 100));
    return Array(pairs).fill(CARRY).concat(Array(pairs).fill(MOVE));
}

spawn_BuildCreeps.getMinerConfig = getMinerConfig;
spawn_BuildCreeps.getWorkerConfig = getWorkerConfig;
spawn_BuildCreeps.getDistributorConfig = getDistributorConfig;
spawn_BuildCreeps.needsRepair = needsRepair;
spawn_BuildCreeps.sourceShortOfWork = sourceShortOfWork;
spawn_BuildCreeps.fitBody = fitBody;
module.exports = spawn_BuildCreeps;
