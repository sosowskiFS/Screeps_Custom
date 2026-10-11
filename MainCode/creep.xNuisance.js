// creep.xNuisance — a CARRY+MOVE pest in a room Harabi reserves on shardX (system.nuisance).
//
// Flees anything that can damage it (combat.tactics.escape) and waits outside its room while armed
// hostiles are in it. In the room: takes energy out of the fullest container and drops it on a tile
// next to that container, preferring one 2+ tiles from the source (HarabiBot's haulers pick up
// dropped energy only within 1 of a source; elsewhere it just decays). Retires once the room is no
// longer reserved by that player.
const combat = require('combat.tactics');
const nuisance = require('system.nuisance');

// The tile to drop on: next to the container, not a wall, preferably 2+ from every source.
function dropSpot(room, container) {
    const terrain = room.getTerrain();
    const sources = room.find(FIND_SOURCES);
    let best = null, score = Infinity;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const x = container.pos.x + dx, y = container.pos.y + dy;
            if ((!dx && !dy) || x < 1 || y < 1 || x > 48 || y > 48 || terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
            const nearSource = sources.some(s => Math.max(Math.abs(s.pos.x - x), Math.abs(s.pos.y - y)) <= 1);
            const s = nearSource ? 1 : 0;
            if (s < score) { best = { x, y }; score = s; }
        }
    }
    return best;
}

function run(creep) {
    const dest = creep.memory.destination;
    if (Game.shard.name !== 'shardX' || !dest) {
        creep.suicide();
        return;
    }
    if (combat.escape(creep)) return;
    if (creep.room.name !== dest) {
        if (combat.unsafeToEnter(dest)) {
            const { x, y } = creep.pos;
            if (x <= 1 || y <= 1 || x >= 48 || y >= 48) creep.travelTo(new RoomPosition(25, 25, creep.room.name), { range: 20, maxRooms: 1 });
            return;
        }
        creep.travelTo(new RoomPosition(25, 25, dest), { range: 20 });
        return;
    }
    const c = creep.room.controller;
    if (!c || c.owner || !(c.reservation && c.reservation.username === nuisance.PLAYER)) {
        creep.suicide();      // not that player's reservation any more
        return;
    }
    // Carrying: drop it beside the container it came from.
    if (creep.store[RESOURCE_ENERGY] > 0) {
        const from = creep.memory.from && Game.getObjectById(creep.memory.from);
        const spot = from && dropSpot(creep.room, from);
        if (!spot || (creep.pos.x === spot.x && creep.pos.y === spot.y)) {
            creep.drop(RESOURCE_ENERGY);
            delete creep.memory.from;
        } else creep.travelTo(new RoomPosition(spot.x, spot.y, creep.room.name), { range: 0, maxRooms: 1 });
        return;
    }
    const containers = creep.room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0 });
    if (!containers.length) {
        // Nothing to take: wait near the controller.
        if (!creep.pos.inRangeTo(c, 3)) creep.travelTo(c, { range: 3, maxRooms: 1 });
        return;
    }
    const full = containers.sort((a, b) => b.store[RESOURCE_ENERGY] - a.store[RESOURCE_ENERGY])[0];
    if (creep.withdraw(full, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.travelTo(full, { range: 1, maxRooms: 1 });
    else creep.memory.from = full.id;
}

module.exports = { run, dropSpot };
