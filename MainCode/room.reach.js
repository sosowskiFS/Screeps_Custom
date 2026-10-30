// room.reach — can a creep get within range 1 of a position (to pick up, withdraw, transfer)?
//
// True when the position itself or a tile next to it is one a creep can stand on: not a terrain
// wall, no structure that blocks movement (roads, containers and our or public ramparts don't),
// and no creep of ours parked there (atSpot/onPoint: they never move aside). A pile under a parked
// supplier ringed by towers, link and storage (shard1 E19N59) held a distributor and a salvager
// on the storage's only two free tiles for good, and its repairers could not refill.
const runtimeCache = require('runtime.cache');

const PASSABLE = () => new Set([STRUCTURE_ROAD, STRUCTURE_CONTAINER, STRUCTURE_RAMPART]);

function parked(creep) {
    const m = creep.my && creep.memory;
    return !!(m && (m.atSpot || m.onPoint));
}

function standable(room, x, y, terrain, self) {
    if (x < 0 || y < 0 || x > 49 || y > 49) return false;
    if (terrain.get(x, y) & TERRAIN_MASK_WALL) return false;
    const pos = new RoomPosition(x, y, room.name);
    const passable = PASSABLE();
    if (pos.lookFor(LOOK_STRUCTURES).some(s => !passable.has(s.structureType) ||
        (s.structureType === STRUCTURE_RAMPART && !s.my && !s.isPublic))) return false;
    return !pos.lookFor(LOOK_CREEPS).some(c => c !== self && parked(c));
}

// creep: the one asking (its own tile counts as free to it).
function reachable(target, creep) {
    const pos = target && (target.pos || target);
    const room = pos && Game.rooms[pos.roomName];
    if (!room) return true;   // no vision: assume so
    const cache = runtimeCache.current();
    const memo = cache.reach || (cache.reach = Object.create(null));
    const key = pos.roomName + ':' + pos.x + ':' + pos.y;
    if (memo[key] !== undefined && !(creep && creep.pos.inRangeTo(pos, 1))) return memo[key];
    if (creep && creep.pos.roomName === pos.roomName && creep.pos.inRangeTo(pos, 1)) return true;
    const terrain = room.getTerrain();
    let ok = false;
    for (let dx = -1; dx <= 1 && !ok; dx++) {
        for (let dy = -1; dy <= 1 && !ok; dy++) ok = standable(room, pos.x + dx, pos.y + dy, terrain, creep);
    }
    memo[key] = ok;
    return ok;
}

module.exports = { reachable, standable };
