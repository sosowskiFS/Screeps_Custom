const { placeRoadOnPath } = require('creep.movement');

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

function findAndMoveToDistributionTarget(creep) {
    // Find the nearest structure that needs energy
    let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: (structure) => {
            return (structure.structureType == STRUCTURE_EXTENSION ||
                structure.structureType == STRUCTURE_SPAWN ||
                structure.structureType == STRUCTURE_LAB) &&
                structure.energy < structure.energyCapacity;
        }
    });

    if (!target) {
        // Fallback to range if path finding fails
        target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_EXTENSION ||
                    structure.structureType == STRUCTURE_SPAWN ||
                    structure.structureType == STRUCTURE_LAB) &&
                    structure.energy < structure.energyCapacity;
            }
        });
    }

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

module.exports = { withdrawEnergy, transferEnergy, getStorageTarget, findAndMoveToDistributionTarget, handleMovementCoordination };
