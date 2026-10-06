const { buildExtensionRoads } = require('system.construction');
const runtimeCache = require('runtime.cache');
// system.rooms — Screeps tick subsystem.
const { handleRoomOperations } = require('system.observers');
const { updateRoomStructureLists, manageLinkOperations, manageLabOperations, managePowerSpawnOperations, manageFactoryOperations, manageNukerOperations } = require('system.industry');
const { displayRoomInfo } = require('system.visuals');
const { leastHits } = require('util.common');
const market_buyers = require('market.FindBuyers');

function processRoomManagement(thisRoom) {
    displayRoomInfo(thisRoom);
    manageRoomStructures(thisRoom);
    handleRoomFlags(thisRoom);
    handleRoomOperations(thisRoom);
}

function manageRoomStructures(thisRoom) {
    const roomName = thisRoom.name;

    // Empty lists are valid cached results, not a request to rescan every tick.
    const needsStructureRefresh = !Memory.linkList[roomName] ||
        !Memory.structureScanTick || Memory.structureScanTick[roomName] === undefined;
    // Initialize room structure lists if they don't exist
    if (!Memory.linkList[roomName]) {
        Memory.linkList[roomName] = [];
    }
    if (!Memory.labList[roomName]) {
        Memory.labList[roomName] = [];
    }
    if (!Memory.powerSpawnList[roomName]) {
        Memory.powerSpawnList[roomName] = [];
    }
    if (!Memory.factoryList[roomName]) {
        Memory.factoryList[roomName] = [];
    }

    // Manage energy need rooms - check if room needs energy assistance
    if (Game.time % 50 == 0 && thisRoom.terminal && thisRoom.storage) {
        if (Memory.energyNeedRooms.indexOf(thisRoom.name) === -1 && thisRoom.storage.store[RESOURCE_ENERGY] < 250000 && thisRoom.terminal.store[RESOURCE_ENERGY] < 50000) {
            if (thisRoom.storage.store[RESOURCE_ENERGY] < 100000) {
                Memory.energyNeedRooms.unshift(thisRoom.name);
            } else {
                Memory.energyNeedRooms.push(thisRoom.name);
            }
        } else if (Memory.energyNeedRooms.indexOf(thisRoom.name) != -1 && (thisRoom.storage.store[RESOURCE_ENERGY] >= 255000 || thisRoom.terminal.store[RESOURCE_ENERGY] >= 50000)) {
            let tempIndex = Memory.energyNeedRooms.indexOf(thisRoom.name);
            Memory.energyNeedRooms.splice(tempIndex, 1);
        }
    }

    // Review market data, sell to buy orders, and catalog mineral stockpiles
    if (Game.time % 50 == 0 && thisRoom.terminal) {
        market_buyers.run(thisRoom, thisRoom.terminal, Memory.mineralList[thisRoom.name]);

        if (thisRoom.terminal.store.getFreeCapacity() < 5000) {
            Memory.LastNotification = Game.time.toString() + ' : ' + thisRoom.name + " terminal is overloaded!"
        }

        var roomMinerals = _.keys(thisRoom.terminal.store);
        for (let p = 0; p < roomMinerals.length; p++) {
            if (roomMinerals[p] == RESOURCE_ENERGY || roomMinerals[p] == RESOURCE_POWER) {
                //Not caring about this
                continue;
            }
            Memory.mineralTotals[roomMinerals[p]] += thisRoom.terminal.store[roomMinerals[p]]
        }
    }

    // Update structure lists every 50 ticks or if lists are empty
    if (Game.time % 50 == 0 || needsStructureRefresh) {
        updateRoomStructureLists(thisRoom);
    }

    // Manage links
    manageLinkOperations(thisRoom);

    // Manage labs
    manageLabOperations(thisRoom);

    // Manage power spawn
    managePowerSpawnOperations(thisRoom);

    // Manage factory
    manageFactoryOperations(thisRoom);

    // Manage nuker
    manageNukerOperations(thisRoom);

    // Find repair target for room
    // An empty result is stored as "" (falsy), which used to force a full structure scan
    // every tick in rooms with nothing to repair. Retry those rooms every 50 ticks instead.
    // Repair creeps clear the target with `undefined`, which still rescans immediately.
    if (Game.time % 1000 == 0 || Memory.repairTarget[thisRoom.name] === undefined ||
        (Memory.repairTarget[thisRoom.name] === "" && Game.time % 50 == 0)) {
        Memory.repairTarget[thisRoom.name] = "";
        const repairTarget = leastHits(runtimeCache.find(thisRoom, FIND_STRUCTURES, {
            filter: (structure) => (structure.structureType != STRUCTURE_ROAD && structure.structureType != STRUCTURE_CONTAINER && structure.hitsMax - structure.hits >= 200) || (structure.structureType == STRUCTURE_CONTAINER && structure.hitsMax - structure.hits >= 50000)
        }));
        if (repairTarget) {
            Memory.repairTarget[thisRoom.name] = repairTarget.id;
            //Cap energy harvesting if room meets certain minimums
            if (repairTarget.structureType == STRUCTURE_RAMPART) {
                if (repairTarget.hits >= 50000000 && !Game.flags[thisRoom.name + "50mCap"]) {
                    if (Game.flags[thisRoom.name + "25mCap"]) {
                        Game.flags[thisRoom.name + "25mCap"].remove();
                    }
                    Game.rooms[thisRoom.name].createFlag(47, 4, thisRoom.name + "50mCap");
                } else if (repairTarget.hits >= 25000000 && !Game.flags[thisRoom.name + "25mCap"] && !Game.flags[thisRoom.name + "50mCap"]) {
                    Game.rooms[thisRoom.name].createFlag(47, 4, thisRoom.name + "25mCap");
                }
                if (repairTarget.hits < 25000000) {
                    if (Game.flags[thisRoom.name + "25mCap"]) {
                        Game.flags[thisRoom.name + "25mCap"].remove();
                    }
                    if (Game.flags[thisRoom.name + "50mCap"]) {
                        Game.flags[thisRoom.name + "50mCap"].remove();
                    }
                }
            }
        }
    }

    // Clear road construction sites every 1000 ticks if at construction site cap
    if ((Game.time + 1) % 1000 == 0 && !Game.flags["DoNotClear"]) {
        const siteCount = Object.keys(Game.constructionSites).length;
        if (siteCount >= MAX_CONSTRUCTION_SITES) {
            const roadSites = runtimeCache.find(thisRoom, FIND_CONSTRUCTION_SITES, {
                filter: (site) => site.structureType === STRUCTURE_ROAD && site.progress === 0
            });
            roadSites.forEach(site => site.remove());
        }
    }

    // Check all structures for ramparts, add if missing
    if (Game.time % 10000 == 0) {
        let constructionLimitReached = false;

        // Find structures that need rampart protection based on room level
        const excludedTypes = thisRoom.controller.level == 8
            ? [STRUCTURE_RAMPART, STRUCTURE_WALL, STRUCTURE_CONTROLLER, STRUCTURE_EXTRACTOR, STRUCTURE_CONTAINER]
            : [STRUCTURE_RAMPART, STRUCTURE_WALL, STRUCTURE_CONTROLLER, STRUCTURE_EXTRACTOR, STRUCTURE_CONTAINER, STRUCTURE_EXTENSION];

        const structuresNeedingRamparts = runtimeCache.find(thisRoom, FIND_MY_STRUCTURES, {
            filter: (structure) => !excludedTypes.includes(structure.structureType)
        });

        // Check each structure for rampart coverage
        for (const structure of structuresNeedingRamparts) {
            const structuresAtPos = structure.pos.lookFor(LOOK_STRUCTURES);
            const hasRampart = structuresAtPos.some(s => s.structureType === STRUCTURE_RAMPART);

            if (!hasRampart) {
                const result = thisRoom.createConstructionSite(structure.pos.x, structure.pos.y, STRUCTURE_RAMPART);
                if (result === ERR_FULL) {
                    constructionLimitReached = true;
                    break; // Stop if construction site limit reached
                } else if (result === OK) {
                    Memory.LastNotification = `${Game.time} : Rampart generated in ${thisRoom.name}.`;
                }
            }
        }

        // Generate ramparts around controller (8 adjacent tiles)
        if (!constructionLimitReached) {
            const controllerPos = thisRoom.controller.pos;
            outer: for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue; // Skip controller position itself

                    const x = controllerPos.x + dx;
                    const y = controllerPos.y + dy;

                    // Check if position is within room bounds
                    if (x >= 1 && x <= 48 && y >= 1 && y <= 48) {
                        const pos = new RoomPosition(x, y, thisRoom.name);
                        const structuresAtPos = pos.lookFor(LOOK_STRUCTURES);
                        const hasRampart = structuresAtPos.some(s => s.structureType === STRUCTURE_RAMPART);
                        const isWall = structuresAtPos.some(s => s.structureType === STRUCTURE_WALL);

                        if (!hasRampart && !isWall) {
                            const result = thisRoom.createConstructionSite(x, y, STRUCTURE_RAMPART);
                            if (result === ERR_FULL) {
                                constructionLimitReached = true;
                                break outer; // Stop if construction site limit reached
                            }
                        }
                    }
                }
            }
        }

        // Generate roads in empty tiles surrounded by at least 2 extensions
        if (!constructionLimitReached) {
            buildExtensionRoads(thisRoom);
        }
    }
}

function handleRoomFlags(thisRoom) {
    // This would contain room-specific flag handling
    // For now, keeping this as a placeholder to maintain functionality
}

module.exports = { processRoomManagement, manageRoomStructures, handleRoomFlags };
