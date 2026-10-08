// system.claimDefense — kill controller attackers in rooms without a tower.
//
// Another player's creep with CLAIM parts can attack our controller, and an attacked controller
// cannot enter safe mode for a while. Such creeps rarely carry weapons. In a room of ours with no
// tower, while one is present and no hunter is out, the room's spawns hold everything else so energy
// pools, then spawn a claimHunter (ATTACK/MOVE pairs) as large as the room's spawn energy allows.
// If it cannot fill up within POOL_TICKS, they spawn the biggest hunter they can afford.
const runtimeCache = require('runtime.cache');

const POOL_TICKS = 300;
const PAIR = 130;               // ATTACK + MOVE
const MAX_PAIRS = 25;

function hostileClaimer(creep) {
    const owner = creep.owner && creep.owner.username;
    if (!owner || owner === 'Invader' || owner === 'Source Keeper') return false;
    if (Memory.whiteList && Memory.whiteList.includes(owner)) return false;
    return creep.getActiveBodyparts(CLAIM) > 0;
}

function claimers(room) {
    return runtimeCache.find(room, FIND_HOSTILE_CREEPS).filter(hostileClaimer);
}

function hunterOut(roomName) {
    for (const name in Game.creeps) {
        const m = Game.creeps[name].memory;
        if (m.priority === 'claimHunter' && m.homeRoom === roomName) return true;
    }
    return false;
}

// Does this room need a hunter now?
function need(room) {
    if (!room.controller || !room.controller.my) return false;
    if (runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } }).length) return false;
    return claimers(room).length > 0 && !hunterOut(room.name);
}

function body(energy) {
    const pairs = Math.max(1, Math.min(MAX_PAIRS, Math.floor(energy / PAIR)));
    const out = [];
    for (let i = 0; i < pairs; i++) out.push(MOVE);
    for (let i = 0; i < pairs; i++) out.push(ATTACK);
    return out;
}

// Spawning hook: 'spawned', 'holding' (pooling energy: spawn nothing else) or null (not needed).
function spawnFor(spawn, room) {
    if (!need(room)) {
        if (Memory.claimDefense) delete Memory.claimDefense[room.name];
        return null;
    }
    if (!Memory.claimDefense) Memory.claimDefense = {};
    const since = Memory.claimDefense[room.name] || (Memory.claimDefense[room.name] = Game.time);
    if (spawn.spawning) return 'holding';
    const want = Math.max(PAIR, Math.floor(Math.min(room.energyCapacityAvailable, MAX_PAIRS * PAIR) / PAIR) * PAIR);
    const full = room.energyAvailable >= want;
    const waited = Game.time - since >= POOL_TICKS;
    if (!full && !(waited && room.energyAvailable >= PAIR)) return 'holding';
    const result = spawn.spawnCreep(body(room.energyAvailable), 'claimHunter', { memory: { priority: 'claimHunter', homeRoom: room.name } });
    if (result !== OK) return 'holding';
    delete Memory.claimDefense[room.name];
    console.log('[claimDefense] ' + room.name + ': hunter spawned against ' + claimers(room).map(c => c.owner.username).join(', '));
    return 'spawned';
}

// Built walls on controller neighbours (the young-room enclosure placed by base.builder).
function controllerWalls(room) {
    const c = room.controller;
    if (!c || !c.pos) return [];
    return runtimeCache.find(room, FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_WALL &&
        s.pos && Math.max(Math.abs(s.pos.x - c.pos.x), Math.abs(s.pos.y - c.pos.y)) <= 1 });
}
module.exports = { need, spawnFor, body, hostileClaimer, claimers, controllerWalls };
