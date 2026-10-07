// spawn.exit — keep a spawn able to release the creep it is finishing.
//
// A finished creep needs a free tile next to the spawn (in its allowed directions); with every
// such tile taken it waits, even when the creeps standing there are idle (an idle lab worker
// beside its spawn, haulers queued for the storage). In the tick before the creep is done, if
// every exit is taken, one of our creeps standing on an exit is moved one step outward.
// Parked workers (atSpot/onPoint: miners, the tower supplier) are never moved.
const { Traveler } = require('traveler');

const OFFSETS = { 1: [0, -1], 2: [1, -1], 3: [1, 0], 4: [1, 1], 5: [0, 1], 6: [-1, 1], 7: [-1, 0], 8: [-1, -1] };
const ALL = [1, 2, 3, 4, 5, 6, 7, 8];
const PASSABLE = new Set([STRUCTURE_ROAD, STRUCTURE_CONTAINER, STRUCTURE_RAMPART]);

function inside(x, y) {
    return x >= 1 && x <= 48 && y >= 1 && y <= 48;
}

// Can nothing but creeps stand here? (walls, obstacle structures and sites excluded)
function open(room, terrain, x, y) {
    if (!inside(x, y) || terrain.get(x, y) & TERRAIN_MASK_WALL) return false;
    for (const s of room.lookForAt(LOOK_STRUCTURES, x, y)) {
        if (!PASSABLE.has(s.structureType) || (s.structureType === STRUCTURE_RAMPART && !s.my)) return false;
    }
    for (const site of room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y)) {
        if (!PASSABLE.has(site.structureType)) return false;
    }
    return true;
}

function movable(creep) {
    return creep && creep.my && !creep.spawning && creep.fatigue === 0 && !(creep.memory && (creep.memory.atSpot || creep.memory.onPoint));
}

// Returns the creep moved, or null.
function clearExit(spawn) {
    if (!spawn.spawning || spawn.spawning.remainingTime > 1) return null;
    const room = spawn.room;
    const terrain = room.getTerrain();
    const directions = spawn.spawning.directions && spawn.spawning.directions.length ? spawn.spawning.directions : ALL;
    const blockers = [];
    for (const dir of directions) {
        const x = spawn.pos.x + OFFSETS[dir][0], y = spawn.pos.y + OFFSETS[dir][1];
        if (!open(room, terrain, x, y)) continue;
        const creep = room.lookForAt(LOOK_CREEPS, x, y)[0] || room.lookForAt(LOOK_POWER_CREEPS, x, y)[0];
        if (!creep) return null;   // a free exit: nothing to do
        if (movable(creep)) blockers.push({ creep, dir });
    }
    // Step outward (the spawn's direction to it), or to either side of that.
    for (const { creep, dir } of blockers) {
        for (const step of [dir, (dir % 8) + 1, ((dir + 6) % 8) + 1]) {
            const x = creep.pos.x + OFFSETS[step][0], y = creep.pos.y + OFFSETS[step][1];
            if (Math.max(Math.abs(x - spawn.pos.x), Math.abs(y - spawn.pos.y)) <= 1) continue;
            if (!open(room, terrain, x, y) || room.lookForAt(LOOK_CREEPS, x, y).length || room.lookForAt(LOOK_POWER_CREEPS, x, y).length) continue;
            if (creep.move(step) === OK) {
                Traveler.markMoved(creep);
                return creep;
            }
        }
    }
    return null;
}

module.exports = { clearExit };
