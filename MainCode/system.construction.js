const runtimeCache = require('runtime.cache');
// system.construction — Screeps tick subsystem.
const baseBuilder = require('base.builder');

// Every owned room gets the automatic base layout (base.builder): plans one room per tick at
// most when the CPU governor allows, builds one room per tick at most (CPU charged to the room).
function handleAutoBuildRoomsRegeneration() {
    baseBuilder.run();
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
