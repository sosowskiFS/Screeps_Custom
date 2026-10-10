// system.swampRoads — roads on the swamp tiles that actually slow a young room down.
//
// Young rooms (no terminal yet, room.stage) build no roads: the energy goes into structures and the
// controller (base.builder, system.roads). But a swamp tile on a busy path costs every creep that
// crosses it five times the fatigue of plain ground (10 per WORK or loaded CARRY instead of 2), and
// in a young room most creeps cross the same few tiles between sources, spawn and controller.
//
// Measured, not guessed: every tick, each of our creeps standing on a swamp tile (no road) with
// fatigue left is a creep-tick lost to that tile. Every WINDOW ticks, tiles that cost at least
// THRESHOLD creep-ticks get a road site (a few per pass); a swamp road costs 1500 energy to build,
// so only the worst tiles qualify. Not before the room has a tower: until then only its spawn and
// tower are built. These sites are exempt from the young-room rule that removes road sites.
//
// Memory.swampHeat[room] = { t: window start, h: { tile: lost ticks }, r: [tiles given a road] }
const runtimeCache = require('runtime.cache');
const stage = require('room.stage');

const WINDOW = 1500;          // ticks per measuring window (one creep life)
const THRESHOLD = 100;        // lost creep-ticks in a window that make a tile worth a road
const SITES_PER_PASS = 3;
const SITE_HEADROOM = 90;     // leave room under the 100-site cap for everything else

function state() {
    return Memory.swampHeat || (Memory.swampHeat = {});
}

function young(room) {
    return !!(room.controller && room.controller.my && !stage.established(room));
}

// One tick of measuring: creeps held by fatigue on a swamp tile without a road.
function record(room, entry) {
    let terrain;
    for (const creep of runtimeCache.find(room, FIND_MY_CREEPS)) {
        if (!(creep.fatigue > 0)) continue;
        terrain = terrain || Game.map.getRoomTerrain(room.name);
        if (terrain.get(creep.pos.x, creep.pos.y) !== TERRAIN_MASK_SWAMP) continue;
        const tile = creep.pos.x * 50 + creep.pos.y;
        entry.h[tile] = (entry.h[tile] || 0) + 1;
    }
}

// End of a window: road sites on the costliest swamp tiles, then a fresh count.
function place(room, entry) {
    const towers = runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });
    const tiles = Object.keys(entry.h).map(Number).filter(tile => entry.h[tile] >= THRESHOLD)
        .sort((a, b) => entry.h[b] - entry.h[a]);
    let placed = 0;
    if (towers.length && tiles.length) {
        const taken = new Set();
        for (const s of runtimeCache.find(room, FIND_STRUCTURES)) {
            // A road already, or a structure a road cannot share the tile with.
            if (s.structureType !== STRUCTURE_CONTAINER && s.structureType !== STRUCTURE_RAMPART) taken.add(s.pos.x * 50 + s.pos.y);
        }
        for (const s of runtimeCache.find(room, FIND_CONSTRUCTION_SITES)) taken.add(s.pos.x * 50 + s.pos.y);
        for (const tile of tiles) {
            if (placed >= SITES_PER_PASS || Object.keys(Game.constructionSites).length + placed >= SITE_HEADROOM) break;
            if (taken.has(tile)) continue;
            if (room.createConstructionSite(Math.floor(tile / 50), tile % 50, STRUCTURE_ROAD) === OK) {
                placed++;
                if (!entry.r.includes(tile)) entry.r.push(tile);
            }
        }
    }
    entry.t = Game.time;
    entry.h = {};
    return placed;
}

function run() {
    const all = state();
    for (const name of Object.keys(all)) {
        const room = Game.rooms[name];
        if (!room || !young(room)) delete all[name];   // grown up (system.roads takes over) or gone
    }
    for (const name in Game.rooms) {
        const room = Game.rooms[name];
        if (!young(room)) continue;
        const entry = all[name] || (all[name] = { t: Game.time, h: {}, r: [] });
        record(room, entry);
        if (Game.time - entry.t >= WINDOW) place(room, entry);
    }
}

// A road (site) this system placed: base.builder keeps it in a young room.
function wanted(roomName, x, y) {
    const entry = Memory.swampHeat && Memory.swampHeat[roomName];
    return !!(entry && entry.r && entry.r.includes(x * 50 + y));
}

module.exports = { run, record, place, wanted, WINDOW, THRESHOLD };
