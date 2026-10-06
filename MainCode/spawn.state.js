const runtimeCache = require('runtime.cache');
// spawn.state — Screeps tick subsystem.

// Record every successful spawn order in this tick's census (runtime.cache notePending), whichever
// module issued it, so a second spawn in the same room cannot order a duplicate. Installed once
// per global; the wrapper only adds bookkeeping after a successful, non-dry-run order.
function trackSpawnOrders() {
    if (typeof StructureSpawn === 'undefined' || !StructureSpawn.prototype.spawnCreep) return;
    const proto = StructureSpawn.prototype;
    if (proto.spawnCreep.tracksPending) return;
    const original = proto.spawnCreep;
    const tracked = function (body, name, opts) {
        const result = original.call(this, body, name, opts);
        if (result === OK && !(opts && opts.dryRun)) {
            runtimeCache.notePending(this, name, (opts && opts.memory) || {});
        }
        return result;
    };
    tracked.tracksPending = true;
    proto.spawnCreep = tracked;
}
trackSpawnOrders();


function initializeSpawnTracking() {
    if (!Memory.isSpawning || typeof Memory.isSpawning !== 'object' || Array.isArray(Memory.isSpawning)) {
        Memory.isSpawning = {};
    }
}

function setSpawnStatus(spawn, isSpawning) {
    initializeSpawnTracking();
    const roomName = spawn.room.name;
    if (!Memory.isSpawning[roomName]) {
        Memory.isSpawning[roomName] = {};
    }
    Memory.isSpawning[roomName][spawn.id] = isSpawning;
}

function isSpawnBusy(spawn) {
    // Check if spawn is actually spawning or marked as busy in memory
    if (spawn.spawning) return true;

    initializeSpawnTracking();
    const roomName = spawn.room.name;
    return Memory.isSpawning[roomName] && Memory.isSpawning[roomName][spawn.id];
}

function isAnySpawnBusyInRoom(roomName) {
    initializeSpawnTracking();
    if (!Memory.isSpawning[roomName]) return false;
    return Object.values(Memory.isSpawning[roomName]).some(busy => busy);
}

function getAvailableSpawnsInRoom(roomName) {
    const room = Game.rooms[roomName];
    if (!room) return [];

    const spawns = runtimeCache.find(room, FIND_MY_SPAWNS);
    return spawns.filter(spawn => spawn.isActive() && !spawn.spawning && !isSpawnBusy(spawn));
}

function cleanupSpawnTracking() {
    // Initialize spawn tracking if needed
    initializeSpawnTracking();

    // Clean up spawn tracking for dead spawns and rooms we no longer control
    for (const roomName in Memory.isSpawning) {
        const room = Game.rooms[roomName];
        if (!room || !room.controller || !room.controller.my) {
            delete Memory.isSpawning[roomName];
            continue;
        }

        for (const spawnId in Memory.isSpawning[roomName]) {
            const spawn = Game.getObjectById(spawnId);
            if (!spawn) {
                // Spawn no longer exists
                delete Memory.isSpawning[roomName][spawnId];
            } else if (!spawn.spawning && Memory.isSpawning[roomName][spawnId]) {
                // Spawn is no longer actually spawning, clear the memory flag
                delete Memory.isSpawning[roomName][spawnId];
            }
        }

        // Remove empty room entries
        if (Object.keys(Memory.isSpawning[roomName]).length === 0) {
            delete Memory.isSpawning[roomName];
        }
    }
}

function handleSpawnEnergyTracking(thisRoom) {
    //build routines that perform on the same tick assume the same energy level even after the first spawn used the energy
    //Set energy level into memory per room, wipe memory when done with tick.
    //Have build rountines check memory to get the current room energy level after builds
    var energyIndex = Memory.CurrentRoomEnergy.indexOf(thisRoom.name);
    if (energyIndex < 0) {
        Memory.CurrentRoomEnergy.push(thisRoom.name);
        Memory.CurrentRoomEnergy.push(thisRoom.energyAvailable);
    }
}

function getEnergyIndex(thisRoom) {
    var energyIndex = Memory.CurrentRoomEnergy.indexOf(thisRoom.name);
    if (energyIndex < 0) {
        Memory.CurrentRoomEnergy.push(thisRoom.name);
        Memory.CurrentRoomEnergy.push(thisRoom.energyAvailable);
        energyIndex = Memory.CurrentRoomEnergy.indexOf(thisRoom.name) + 1;
    } else {
        energyIndex++;
    }
    return energyIndex;
}

global.setSpawnBusy = spawn => setSpawnStatus(spawn, true);
global.isSpawnBusy = isSpawnBusy;

module.exports = { initializeSpawnTracking, setSpawnStatus, isSpawnBusy, isAnySpawnBusyInRoom, getAvailableSpawnsInRoom, cleanupSpawnTracking, handleSpawnEnergyTracking, getEnergyIndex };
