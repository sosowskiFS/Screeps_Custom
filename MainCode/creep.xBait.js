// creep.xBait — the one creep of a shardX decoy room (system.bait).
//
// Flees armed hostiles (combat.tactics.escape) and waits outside its room while they are there.
// In the room: claims the controller (a CLAIM body), then harvests and upgrades. At RCL3 it places
// one tower, builds it, and keeps it filled to TOWER_FILL before upgrading again.
// A controller it can do nothing with (owned or reserved by someone else, upgrade-blocked) is noted
// for system.bait (not sent to again until the block ends) and the creep is recycled.
const combat = require('combat.tactics');
const bait = require('system.bait');

const TOWER_FILL = 0.5;
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

function work(creep) {
    const c = creep.room.controller;
    if (creep.memory.full && !creep.store[RESOURCE_ENERGY]) creep.memory.full = false;
    if (!creep.memory.full && !creep.store.getFreeCapacity(RESOURCE_ENERGY)) creep.memory.full = true;
    if (!creep.memory.full) return harvest(creep);
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
    if (result === ERR_NOT_IN_RANGE) creep.travelTo(c, { range: 1 });
    else if (result === OK) bait.claimed(dest, creep.memory.baitFor);
    else if (result === ERR_GCL_NOT_ENOUGH) {
        bait.noteGcl();
        creep.suicide();
    } else if (result !== ERR_TIRED) give(creep, Game.time + BLOCK_RETRY);
}

module.exports = { run, towerSpot };
