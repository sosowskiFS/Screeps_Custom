// system.reactors — Seasonal World only: take the sector-centre reactors for a while for score.
//
// A reactor burns 1 Thorium a tick and pays its owner 1 + floor(log10(ticks since it started))
// score for it (screeps/mod-season5 reactor.roomObject). A claim (Creep.claimReactor: a CLAIM part,
// adjacent) only changes the owner: the run time stays. So a reactor another player keeps fuelled
// pays us at their rate (W25N5 and W25N15: running 260k-690k ticks, 6 a tick) with their Thorium
// until they claim it back.
//
// Every RESEND ticks per target, the nearest home that reaches it within a claimer's life sends one
// [CLAIM, MOVE] creep (creep.reactorClaimer): it walks to the reactor, claims it, and claims it back
// whenever it is taken while it lives. Skipped while the reactor is ours and fuelled, or known to
// hold too little Thorium to be worth it. Memory.reactors[room] = { t, x, y, T, my, owner, sent }.
const TARGETS = ['W25N5', 'W25N15'];
const RESEND = 2000;               // ticks between claimers per reactor
const MIN_THORIUM = 100;           // worth a trip: at least this much fuel in it (when known)
const MAX_ROUTE = 9;               // rooms: a claimer lives 600 ticks, about 50 a room
const BODY = () => [CLAIM, MOVE];
const ROLE = 'reactorClaimer';

function enabled() {
    return require('runtime.world').isSeason() && !(Memory.settings && Memory.settings.reactors === false);
}

function state() {
    return Memory.reactors || (Memory.reactors = {});
}

function findReactors(room) {
    return typeof FIND_REACTORS === 'undefined' ? [] : room.find(FIND_REACTORS);
}

// What we know of a target's reactor, refreshed whenever the room is visible.
function observe() {
    for (const name of TARGETS) {
        const room = Game.rooms[name];
        if (!room) continue;
        const reactor = findReactors(room)[0];
        if (!reactor) continue;
        const entry = state()[name] || (state()[name] = {});
        entry.t = Game.time;
        entry.x = reactor.pos.x;
        entry.y = reactor.pos.y;
        entry.T = (reactor.store && reactor.store[RESOURCE_THORIUM_KEY()]) || 0;
        entry.my = !!reactor.my;
        entry.owner = reactor.owner ? reactor.owner.username : undefined;
    }
}

function RESOURCE_THORIUM_KEY() {
    return typeof RESOURCE_THORIUM !== 'undefined' ? RESOURCE_THORIUM : 'T';
}

function claimers(target) {
    const live = Object.values(Game.creeps).filter(c => c.memory && c.memory.priority === ROLE && c.memory.destination === target).length;
    const pending = require('runtime.cache').pendingCreeps().filter(c => c.memory && c.memory.priority === ROLE && c.memory.destination === target).length;
    return live + pending;
}

// Is a claimer due for this target now?
function due(target) {
    const entry = state()[target] || {};
    if (Game.time - (entry.sent || -Infinity) < RESEND) return false;
    if (entry.t !== undefined) {
        if (entry.my && entry.T > 0) return false;           // ours and running
        if (entry.T < MIN_THORIUM) return false;              // nothing much to burn
    }
    return claimers(target) === 0;
}

function routeLength(from, to) {
    const route = Game.map.findRoute(from, to);
    return route === ERR_NO_PATH || !Array.isArray(route) ? Infinity : route.length;
}

// The home that sends a target's claimer: the nearest by route within MAX_ROUTE, able to afford it.
function homeFor(target, homes) {
    let best, bestLength = Infinity;
    for (const name of homes) {
        const room = Game.rooms[name];
        if (!room || room.energyCapacityAvailable < cost(BODY())) continue;
        if (Game.map.getRoomLinearDistance(name, target) > MAX_ROUTE) continue;
        const length = routeLength(name, target);
        if (length <= MAX_ROUTE && length < bestLength) { best = name; bestLength = length; }
    }
    return best;
}

function cost(body) {
    return body.reduce((n, p) => n + BODYPART_COST[p], 0);
}

function homes() {
    const out = [];
    for (const name in Game.rooms) {
        const room = Game.rooms[name];
        if (room.controller && room.controller.my && room.find(FIND_MY_SPAWNS).length) out.push(name);
    }
    return out;
}

// Spawning hook (system.spawning, after the room's own creeps): true when this spawn sent one.
function spawn(spawnObj, room, energyIndex) {
    if (!enabled()) return false;
    for (const target of TARGETS) {
        if (!due(target) || homeFor(target, homes()) !== room.name) continue;
        const body = BODY();
        if (cost(body) > (Memory.CurrentRoomEnergy[energyIndex] || 0)) return false;
        const result = spawnObj.spawnCreep(body, ROLE + '_' + spawnObj.name + '_' + Game.time, {
            memory: { priority: ROLE, destination: target, homeRoom: room.name },
        });
        if (result !== OK) return false;
        Memory.CurrentRoomEnergy[energyIndex] -= cost(body);
        (state()[target] || (state()[target] = {})).sent = Game.time;
        global.setSpawnBusy(spawnObj);
        console.log('[reactors] ' + room.name + ' sends a claimer to the reactor in ' + target);
        return true;
    }
    return false;
}

function run() {
    if (!enabled() || Game.time % 10 !== 0) return;
    observe();
}

module.exports = { run, spawn, due, homeFor, observe, state, TARGETS, RESEND, MIN_THORIUM, MAX_ROUTE, BODY, ROLE };
