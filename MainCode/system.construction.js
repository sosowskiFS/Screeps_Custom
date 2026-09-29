const runtimeCache = require('runtime.cache');
// system.construction — Screeps tick subsystem.
const tool_generateBase = require('tool.generateBase');

function handleAutoBuildRoomsRegeneration() {
    // Initialize memory objects if they don't exist
    if (!Memory.autoBuildRooms) {
        Memory.autoBuildRooms = [];
    }
    if (!Memory.autoBuildRegenIndex) {
        Memory.autoBuildRegenIndex = 0;
    }
    if (!Memory.lastAutoBuildRegen) {
        Memory.lastAutoBuildRegen = 0;
    }

    // Early return if no autoBuildRooms exist
    if (Memory.autoBuildRooms.length === 0) {
        return;
    }

    // Run regeneration every 5000 ticks (offset from the main rampart/road generation)
    if (Game.time - Memory.lastAutoBuildRegen >= 5000) {
        // Get the current room to process
        const roomName = Memory.autoBuildRooms[Memory.autoBuildRegenIndex];
        const room = Game.rooms[roomName];

        // Only process if we have vision of the room
        if (room && room.controller && room.controller.my) {
            console.log(`AutoBuild regeneration: Processing ${roomName} (${Memory.autoBuildRegenIndex + 1}/${Memory.autoBuildRooms.length})`);

            // Clear existing road construction sites before regenerating
            const roadSites = runtimeCache.find(room, FIND_CONSTRUCTION_SITES, {
                filter: { structureType: STRUCTURE_ROAD }
            });
            roadSites.forEach(site => site.remove());

            // Run the base generation tool
            tool_generateBase.run(room);
        } else if (room) {
            console.log(`AutoBuild regeneration: Skipping ${roomName} - no controller ownership`);
        } else {
            console.log(`AutoBuild regeneration: Skipping ${roomName} - no room vision`);
        }

        // Move to next room index
        Memory.autoBuildRegenIndex++;

        // Reset index if we've processed all rooms
        if (Memory.autoBuildRegenIndex >= Memory.autoBuildRooms.length) {
            Memory.autoBuildRegenIndex = 0;
            Memory.lastAutoBuildRegen = Game.time;
            console.log(`AutoBuild regeneration cycle completed. Next cycle in ${50000} ticks.`);
        }
    }
}

// O(structures + sites + room area), instead of thousands of position lookups.
// Keep x/y iteration order and ERR_FULL early exit to preserve site priority.
function buildExtensionRoads(room) {
    const occupied = new Uint8Array(2500);
    const neighbors = new Uint8Array(2500);
    for (const structure of runtimeCache.find(room, FIND_STRUCTURES)) {
        const { x, y } = structure.pos;
        occupied[x * 50 + y] = 1;
        if (structure.structureType !== STRUCTURE_EXTENSION || x < 1 || x > 48 || y < 1 || y > 48) continue;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if ((dx || dy) && x + dx >= 1 && x + dx <= 48 && y + dy >= 1 && y + dy <= 48) {
                    neighbors[(x + dx) * 50 + y + dy]++;
                }
            }
        }
    }
    for (const site of room.find(FIND_CONSTRUCTION_SITES)) occupied[site.pos.x * 50 + site.pos.y] = 1;
    const terrain = Game.map.getRoomTerrain(room.name);
    for (let x = 1; x <= 48; x++) {
        for (let y = 1; y <= 48; y++) {
            const index = x * 50 + y;
            if (neighbors[index] < 2 || occupied[index] || terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
            if (room.createConstructionSite(x, y, STRUCTURE_ROAD) === ERR_FULL) return;
        }
    }
}
module.exports = { handleAutoBuildRoomsRegeneration, buildExtensionRoads };
