const { placeRoadOnPath } = require('creep.movement');
const runtimeCache = require('runtime.cache');

function withdrawEnergy(creep, source, opts = {}) {
    if (source && source.store[RESOURCE_ENERGY] >= 600 && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        if (creep.withdraw(source, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.travelTo(source, opts);
        }
        return true;
    }
    return false;
}

function transferEnergy(creep, target, opts = {}) {
    if (target && target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && creep.carry[RESOURCE_ENERGY] > 0) {
        if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.travelTo(target, opts);
        }
        return true;
    }
    return false;
}

function getStorageTarget(creep) {
    let storageTarget = creep.room.storage;
    if (creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 100000 && creep.room.terminal.store[RESOURCE_ENERGY] > 0) {
        storageTarget = creep.room.terminal;
    } else if (creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 250000 && creep.room.terminal.store[RESOURCE_ENERGY] > 31000) {
        storageTarget = creep.room.terminal;
    }
    return storageTarget;
}

const SPAWN_ENERGY_SINKS = [STRUCTURE_EXTENSION, STRUCTURE_SPAWN, STRUCTURE_LAB];

// Nearest (by range) structure of the given types that still has room for energy.
// Haulers call this after nearly every delivery. findClosestByPath ran a pathfinder
// search here and travelTo then searched again; range plus Traveler's cached path is
// much cheaper and picks the same target in open base layouts.
function findEnergySink(creep, types = SPAWN_ENERGY_SINKS, excludeId) {
    const candidates = [];
    for (const type of types) {
        for (const structure of runtimeCache.find(creep.room, FIND_MY_STRUCTURES, { filter: { structureType: type } })) {
            if (structure.id !== excludeId && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                candidates.push(structure);
            }
        }
    }
    return candidates.length ? creep.pos.findClosestByRange(candidates) : null;
}

function findAndMoveToDistributionTarget(creep) {
    // Find the nearest structure that needs energy
    const target = findEnergySink(creep);

    if (target) {
        creep.memory.structureTarget = target.id;
        // Immediately start moving to the target
        creep.travelTo(target);
        placeRoadOnPath(creep);
        return true;
    }

    return false;
}

function handleMovementCoordination(creep) {
    // Listen for other creeps needing to move
    let talkingCreeps = creep.pos.findInRange(FIND_MY_CREEPS, 1, {
        filter: (thisCreep) => (creep.id != thisCreep.id && thisCreep.saying &&
                              thisCreep.saying != "\u261D\uD83D\uDE3C" &&
                              thisCreep.saying != "\uD83D\uDC4C\uD83D\uDE39")
    });

    if (talkingCreeps.length) {
        let coords = talkingCreeps[0].saying.split(";");
        if (coords.length == 2 &&
            creep.pos.x == parseInt(coords[0]) &&
            creep.pos.y == parseInt(coords[1])) {
            // Standing in the way of a creep
            let thisDirection = creep.pos.getDirectionTo(talkingCreeps[0].pos);
            creep.move(thisDirection);
            creep.say("\uD83D\uDCA6", true);
        }
    }

    // Also listen for power creeps if there's a room operator
    if (Game.flags[creep.room.name + "RoomOperator"]) {
        talkingCreeps = creep.pos.findInRange(FIND_MY_POWER_CREEPS, 1, {
            filter: (thisCreep) => (creep.id != thisCreep.id && thisCreep.saying)
        });

        if (talkingCreeps.length) {
            let coords = talkingCreeps[0].saying.split(";");
            if (coords.length == 2 &&
                creep.pos.x == parseInt(coords[0]) &&
                creep.pos.y == parseInt(coords[1])) {
                // Standing in the way of a power creep
                let thisDirection = creep.pos.getDirectionTo(talkingCreeps[0].pos);
                creep.move(thisDirection);
                creep.say("\uD83D\uDCA6", true);
            }
        }
    }
}

// Last ~30 ticks of life: carry the load into storage (or terminal) instead of dying with it
// mid-task. Only when the creep is home and can still reach the target in time.
const DEPOSIT_TTL = 30;
function depositBeforeDeath(creep) {
    if (!(creep.ticksToLive <= DEPOSIT_TTL) || !creep.store.getUsedCapacity()) return false;
    if (creep.memory.homeRoom && creep.room.name !== creep.memory.homeRoom) return false;
    let target = creep.room.storage;
    if (!target || target.store.getFreeCapacity() < creep.store.getUsedCapacity()) target = creep.room.terminal;
    if (!target || target.store.getFreeCapacity() < creep.store.getUsedCapacity()) return false;
    if (creep.pos.getRangeTo(target) > creep.ticksToLive) return false; // can't make it
    const resource = Object.keys(creep.store).find(type => creep.store[type] > 0);
    if (creep.transfer(target, resource) === ERR_NOT_IN_RANGE) {
        creep.travelTo(target, { maxRooms: 1 });
    }
    return true;
}

module.exports = { depositBeforeDeath, withdrawEnergy, transferEnergy, getStorageTarget, findEnergySink, findAndMoveToDistributionTarget, handleMovementCoordination };
