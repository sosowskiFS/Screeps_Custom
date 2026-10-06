// system.maintenance — low-CPU "maintenance mode" for finished RCL8 rooms.
//
// Established room: RCL8, nothing under construction, every spawn/extension/tower/storage/terminal
// the controller allows, and every rampart at MIN_RAMPART hits or more (survives two nukes landing
// on the same tile: 10M each at the centre).
//
// Maintenance mode = established + storage energy above ENTER_ENERGY (stays until EXIT_ENERGY)
// + not under attack + no nukes inbound. Attacks and nukes end it at once (checked every tick /
// every NUKE_CHECK ticks); everything else is re-evaluated every CHECK_EVERY ticks.
//
// In maintenance the spawner keeps only what the room needs to stay safe and keep producing:
// no miners (storage pays until EXIT_ENERGY), no repairers, one hauler, supplier for towers,
// lab worker and mineral miner (mineral production keeps running), the controller upkeep
// upgrader when due, and the controller supplier only when there is power to process.
// Spawn checks, tower maintenance repair and remote mining/planning are throttled too.
//
// Memory.roomMode[room] = { m: 1 if in maintenance, e: 1 if established, t: last evaluation }
// Opt out: Memory.settings.maintenanceMode = false, or a <room>NoMaintenance flag.
const runtimeCache = require('runtime.cache');

const ENTER_ENERGY = 300000;
const EXIT_ENERGY = 150000;
const MIN_RAMPART = 25000000;
const CHECK_EVERY = 100;
const NUKE_CHECK = 10;
// Established rooms remote-mine only when storage falls this low (local sources are cheaper).
const REMOTE_MINING_BELOW = 100000;
// RCL8 controller upkeep (GCL growth is not a goal): top the downgrade timer up from below
// UPKEEP_START; each upgrade tick restores CONTROLLER_DOWNGRADE_RESTORE (100) ticks. Staying
// well above half keeps safe mode available.
const UPKEEP_START = 150000;
const UPKEEP_DONE_MARGIN = 1000;
const REQUIRED = ['spawn', 'extension', 'tower', 'storage', 'terminal'];

function enabled(roomName) {
    if (Memory.settings && Memory.settings.maintenanceMode === false) return false;
    return !Game.flags[roomName + 'NoMaintenance'];
}

// Whole-empire switch: GCL growth not needed, RCL8 rooms only keep their controller timer up.
function gclFocus() {
    return !!(Memory.settings && Memory.settings.gclFocus);
}

function record(roomName) {
    if (!Memory.roomMode) Memory.roomMode = {};
    return Memory.roomMode[roomName] || (Memory.roomMode[roomName] = { m: 0, e: 0, t: 0 });
}

function structuresComplete(room) {
    if (runtimeCache.find(room, FIND_MY_CONSTRUCTION_SITES).length) return false;
    for (const type of REQUIRED) {
        const allowed = CONTROLLER_STRUCTURES[type][8];
        const built = runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: type } }).length;
        if (built < allowed) return false;
    }
    return true;
}

function rampartsReady(room) {
    const ramparts = runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_RAMPART } });
    if (!ramparts.length) return false;
    for (const rampart of ramparts) {
        if (rampart.hits < MIN_RAMPART) return false;
    }
    return true;
}

function safe(room, entry) {
    if (Memory.roomsUnderAttack && Memory.roomsUnderAttack.indexOf(room.name) !== -1) return false;
    if (Game.time % NUKE_CHECK === 0 || entry.n === undefined) {
        entry.n = runtimeCache.find(room, FIND_NUKES).length ? 1 : 0;
    }
    return !entry.n;
}

// Called once per tick per owned room (room management). Cheap except every CHECK_EVERY ticks.
function update(room) {
    if (!room.controller || !room.controller.my) return;
    const entry = record(room.name);
    if (!enabled(room.name) || room.controller.level < 8) {
        entry.m = 0;
        entry.e = 0;
        return;
    }
    if (!safe(room, entry)) {
        entry.m = 0; // attack or nuke inbound: full staffing (repairers, haulers) immediately
        return;
    }
    if (entry.t && Game.time - entry.t < CHECK_EVERY) return;
    entry.t = Game.time;
    entry.e = structuresComplete(room) && rampartsReady(room) ? 1 : 0;
    const energy = room.storage ? room.storage.store[RESOURCE_ENERGY] : 0;
    entry.m = entry.e && energy >= (entry.m ? EXIT_ENERGY : ENTER_ENERGY) ? 1 : 0;
}

function inMaintenance(roomName) {
    const entry = Memory.roomMode && Memory.roomMode[roomName];
    return !!(entry && entry.m);
}

function isEstablished(roomName) {
    const entry = Memory.roomMode && Memory.roomMode[roomName];
    return !!(entry && entry.e);
}

// Remote mining for this home: established rooms only when energy is actually short.
function remoteMiningWanted(room) {
    if (!isEstablished(room.name)) return true;
    return !!room.storage && room.storage.store[RESOURCE_ENERGY] < REMOTE_MINING_BELOW;
}

// RCL8 controller upkeep: is an upgrader due, and when is it done?
function upkeepDue(controller) {
    return controller.ticksToDowngrade < UPKEEP_START;
}
function upkeepDone(controller) {
    const max = typeof CONTROLLER_DOWNGRADE !== 'undefined' ? CONTROLLER_DOWNGRADE[controller.level] : 200000;
    return controller.ticksToDowngrade >= max - UPKEEP_DONE_MARGIN;
}

// Small upgrader that refills the downgrade timer from storage: 1 WORK (the timer restore is
// per upgrade tick, not per WORK part), 500 energy carried per trip, full speed on roads.
function upkeepBody() {
    return [WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
}

module.exports = {
    update, inMaintenance, isEstablished, remoteMiningWanted, gclFocus,
    upkeepDue, upkeepDone, upkeepBody, ENTER_ENERGY, EXIT_ENERGY, MIN_RAMPART,
};
