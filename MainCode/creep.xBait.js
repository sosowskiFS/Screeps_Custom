// creep.xBait — the one creep of a shardX decoy room (system.bait).
//
// Flees armed hostiles (combat.tactics.escape) and waits outside its room while they are there.
// In the room: claims the controller (a CLAIM body), then harvests and upgrades. From RCL2 it walls
// the free tiles next to the controller and keeps those walls at WALL_HITS (light: a lone declaimer
// can't reach the controller, the attacker has to bring something to break a wall). At RCL3 it
// places one tower, builds it, and keeps it filled to TOWER_FILL before upgrading again. From the
// claim on it also keeps a spawn site in the room, built to SPAWN_BAIT only (spawnBait).
// A controller it can do nothing with (owned or reserved by someone else, upgrade-blocked) is noted
// for system.bait (not sent to again until the block ends) and the creep is recycled.
const combat = require('combat.tactics');
const bait = require('system.bait');

const TOWER_FILL = 0.5;
const WALL_HITS = 2000;
const WALL_CHECK = 100;          // ticks between checks for missing wall sites
const SPAWN_BAIT = 200;          // energy put into the spawn site, no more
const SPAWN_RETRY = 1500;        // a spawn site destroyed (stomped) is placed again after this long
const BLOCK_RETRY = 1500;        // owned/reserved by someone else: look again after this long

function give(creep, until) {
    bait.noteBlock(creep.memory.destination, until);
    creep.suicide();
}

// A tile for the tower: open, off the edges, 2-4 from the controller, nearest the closest source.
function towerSpot(room) {
    const c = room.controller;
    const terrain = room.getTerrain();
    const busy = new Set(room.find(FIND_STRUCTURES).concat(room.find(FIND_CONSTRUCTION_SITES)).map(s => s.pos.x * 50 + s.pos.y));
    const source = c.pos.findClosestByRange(FIND_SOURCES);
    let best = null, score = Infinity;
    for (let x = Math.max(2, c.pos.x - 4); x <= Math.min(47, c.pos.x + 4); x++) {
        for (let y = Math.max(2, c.pos.y - 4); y <= Math.min(47, c.pos.y + 4); y++) {
            const r = Math.max(Math.abs(x - c.pos.x), Math.abs(y - c.pos.y));
            if (r < 2 || terrain.get(x, y) === TERRAIN_MASK_WALL || busy.has(x * 50 + y)) continue;
            const s = source ? Math.max(Math.abs(x - source.pos.x), Math.abs(y - source.pos.y)) : r;
            if (s < 2) continue;                       // not on the harvesting tiles
            if (s < score) { best = { x, y }; score = s; }
        }
    }
    return best;
}

// The free tiles next to the controller to wall: none next to a source (harvesting tiles), and none
// at all if the ring would cut off any part of the room (a source, the upgrading tiles, an exit).
function wallSpots(room) {
    const c = room.controller, terrain = room.getTerrain();
    const sources = room.find(FIND_SOURCES);
    const near = (x, y, p, r) => Math.max(Math.abs(x - p.x), Math.abs(y - p.y)) <= r;
    const spots = [];
    for (let x = c.pos.x - 1; x <= c.pos.x + 1; x++) {
        for (let y = c.pos.y - 1; y <= c.pos.y + 1; y++) {
            if (x < 1 || y < 1 || x > 48 || y > 48 || (x === c.pos.x && y === c.pos.y)) continue;
            if (terrain.get(x, y) === TERRAIN_MASK_WALL || sources.some(s => near(x, y, s.pos, 1))) continue;
            spots.push({ x, y });
        }
    }
    // The ring must not cut off any part of the room (a source, the upgrading tiles, an exit the
    // creep arrives by): everything reachable from a harvesting tile without it stays reachable.
    const ring = new Set(spots.map(p => p.x * 50 + p.y));
    const fixed = (x, y) => (x === c.pos.x && y === c.pos.y) || sources.some(s => s.pos.x === x && s.pos.y === y);
    const area = walled => {
        const open = (x, y) => x >= 0 && y >= 0 && x <= 49 && y <= 49 && terrain.get(x, y) !== TERRAIN_MASK_WALL &&
            !fixed(x, y) && !(walled && ring.has(x * 50 + y));
        let start = null;
        for (const s of sources) {
            for (let dx = -1; dx <= 1 && !start; dx++) for (let dy = -1; dy <= 1 && !start; dy++) {
                if (open(s.pos.x + dx, s.pos.y + dy)) start = { x: s.pos.x + dx, y: s.pos.y + dy };
            }
            if (start) break;
        }
        if (!start) return null;
        const seen = new Set([start.x * 50 + start.y]), queue = [start];
        for (let i = 0; i < queue.length; i++) {
            const p = queue[i];
            for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
                const x = p.x + dx, y = p.y + dy, k = x * 50 + y;
                if (!seen.has(k) && open(x, y)) { seen.add(k); queue.push({ x, y }); }
            }
        }
        return seen;
    };
    const before = area(false), after = area(true);
    if (!before || !after) return [];
    for (const k of before) if (!ring.has(k) && !after.has(k)) return [];
    return spots;
}

// Controller walls at RCL2+: sites placed (every WALL_CHECK ticks), built, and kept at WALL_HITS.
// Returns true when it used the tick.
function walls(creep) {
    const room = creep.room, c = room.controller;
    if (!(CONTROLLER_STRUCTURES[STRUCTURE_WALL][c.level] > 0)) return false;
    if (Game.time >= (creep.memory.wallCheck || 0)) {
        creep.memory.wallCheck = Game.time + WALL_CHECK;
        const taken = new Set(room.find(FIND_STRUCTURES).concat(room.find(FIND_CONSTRUCTION_SITES)).filter(s => s.pos)
            .map(s => s.pos.x * 50 + s.pos.y));
        for (const p of wallSpots(room)) if (!taken.has(p.x * 50 + p.y)) room.createConstructionSite(p.x, p.y, STRUCTURE_WALL);
    }
    const site = room.find(FIND_MY_CONSTRUCTION_SITES, { filter: { structureType: STRUCTURE_WALL } })[0];
    if (site) {
        if (creep.build(site) === ERR_NOT_IN_RANGE) creep.travelTo(site, { range: 3 });
        return true;
    }
    const weak = require('system.claimDefense').controllerWalls(room).filter(w => w.hits < WALL_HITS).sort((a, b) => a.hits - b.hits)[0];
    if (!weak) return false;
    if (creep.repair(weak) === ERR_NOT_IN_RANGE) creep.travelTo(weak, { range: 3 });
    return true;
}

function harvest(creep) {
    const sources = creep.room.find(FIND_SOURCES_ACTIVE);
    const source = creep.pos.findClosestByRange(sources.length ? sources : creep.room.find(FIND_SOURCES));
    if (!source) return;
    if (creep.harvest(source) === ERR_NOT_IN_RANGE) creep.travelTo(source, { range: 1 });
}

// Tower work at RCL3+: a site placed, built, the tower filled. Returns true when it used the tick.
function tower(creep) {
    const room = creep.room, c = room.controller;
    if (!(CONTROLLER_STRUCTURES[STRUCTURE_TOWER][c.level] > 0)) return false;
    const towers = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });
    if (towers.length) {
        const low = towers.find(t => t.store[RESOURCE_ENERGY] < t.store.getCapacity(RESOURCE_ENERGY) * TOWER_FILL);
        if (!low) return false;
        if (creep.transfer(low, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.travelTo(low, { range: 1 });
        return true;
    }
    const site = room.find(FIND_MY_CONSTRUCTION_SITES, { filter: { structureType: STRUCTURE_TOWER } })[0];
    if (!site) {
        const spot = towerSpot(room);
        if (!spot) return false;
        room.createConstructionSite(spot.x, spot.y, STRUCTURE_TOWER);
        return false;
    }
    if (creep.build(site) === ERR_NOT_IN_RANGE) creep.travelTo(site, { range: 3 });
    return true;
}

// A spawn construction site, built to SPAWN_BAIT and left there: the attacker ignores rooms without
// a spawn, tower or worker, and a spawn going up draws him in for 200 energy. In bait rooms only
// (marked on claim); one placed again at most every SPAWN_RETRY ticks. Returns true when it used the tick.
function spawnBait(creep) {
    const room = creep.room, mark = bait.state().rooms[room.name];
    if (!mark) return false;
    const site = room.find(FIND_MY_CONSTRUCTION_SITES, { filter: { structureType: STRUCTURE_SPAWN } })[0];
    if (site) {
        if (site.progress >= SPAWN_BAIT) return false;
        if (creep.build(site) === ERR_NOT_IN_RANGE) creep.travelTo(site, { range: 3 });
        return true;
    }
    if (room.find(FIND_MY_SPAWNS).length || (mark.spawnAt !== undefined && Game.time < mark.spawnAt + SPAWN_RETRY)) return false;
    const spot = towerSpot(room);
    if (spot && room.createConstructionSite(spot.x, spot.y, STRUCTURE_SPAWN) === OK) mark.spawnAt = Game.time;
    return false;
}

function work(creep) {
    const c = creep.room.controller;
    if (creep.memory.full && !creep.store[RESOURCE_ENERGY]) creep.memory.full = false;
    if (!creep.memory.full && !creep.store.getFreeCapacity(RESOURCE_ENERGY)) creep.memory.full = true;
    if (!creep.memory.full) return harvest(creep);
    if (walls(creep)) return;
    if (spawnBait(creep)) return;
    if (tower(creep)) return;
    if (creep.upgradeController(c) === ERR_NOT_IN_RANGE) creep.travelTo(c, { range: 3 });
}

function run(creep) {
    const dest = creep.memory.destination;
    if (Game.shard.name !== 'shardX' || !dest) {
        creep.suicide();      // portalStep takes it to shardX; anything else is a stray
        return;
    }
    if (combat.escape(creep)) return;
    // While armed hostiles are in this room, every move keeps out of their reach.
    if (combat.armedThreats(creep.room).length) {
        const travelTo = creep.travelTo;
        creep.travelTo = (target, options = {}) => travelTo.call(creep, target, Object.assign({}, options, {
            roomCallback: (name, matrix) => combat.avoidReach(name, options.roomCallback ? options.roomCallback(name, matrix) || matrix : matrix),
        }));
    }
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
    if (!c) return give(creep, Game.time + 100000);
    if (c.my) return work(creep);
    const user = creep.owner.username;
    if (c.owner || (c.reservation && c.reservation.username !== user)) return give(creep, Game.time + BLOCK_RETRY);
    if (c.upgradeBlocked > 0) return give(creep, Game.time + c.upgradeBlocked);
    if (!creep.getActiveBodyparts(CLAIM)) return give(creep, Game.time + 1);
    const result = creep.claimController(c);
    if (result === ERR_NOT_IN_RANGE) {
        // Our own walls from before the room was lost (or anyone's) closing the controller off:
        // break through the weakest with the WORK part.
        const terrain = creep.room.getTerrain();
        const walls = require('system.claimDefense').controllerWalls(creep.room);
        let free = false;
        for (let dx = -1; dx <= 1 && !free; dx++) for (let dy = -1; dy <= 1 && !free; dy++) {
            const x = c.pos.x + dx, y = c.pos.y + dy;
            if ((dx || dy) && terrain.get(x, y) !== TERRAIN_MASK_WALL && !walls.some(w => w.pos.x === x && w.pos.y === y)) free = true;
        }
        const weakest = !free && walls.slice().sort((a, b) => a.hits - b.hits)[0];
        if (weakest) {
            if (creep.dismantle(weakest) === ERR_NOT_IN_RANGE) creep.travelTo(weakest, { range: 1 });
        } else creep.travelTo(c, { range: 1 });
    }
    else if (result === OK) bait.claimed(dest, creep.memory.baitFor);
    else if (result === ERR_GCL_NOT_ENOUGH) {
        bait.noteGcl();
        creep.suicide();
    } else if (result !== ERR_TIRED) give(creep, Game.time + BLOCK_RETRY);
}

module.exports = { run, towerSpot, wallSpots, WALL_HITS, SPAWN_BAIT };
