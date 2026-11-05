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
    if (!storageTarget) return creep.room.terminal || null;
    if (homeEnergy(creep.room, 1) === creep.room.terminal) return creep.room.terminal;
    if (creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 250000 && creep.room.terminal.store[RESOURCE_ENERGY] > require('system.siegeWatch').terminalEnergyGoal(creep.room) + 1000) {
        storageTarget = creep.room.terminal;
    }
    return storageTarget;
}

function energyIn(s) {
    return s && s.store ? s.store[RESOURCE_ENERGY] || 0 : 0;
}

// The room's store to draw energy from, holding at least min: the terminal first while the room is
// under attack (what other rooms shipped in, system.energyAid) or its storage runs below
// TERMINAL_FIRST_BELOW; the storage otherwise. Young-room workers only ever looked at the storage:
// shardX W1N9 under attack drained 120 from it with 18k aid untouched in the terminal.
const TERMINAL_FIRST_BELOW = 100000;
function homeEnergy(room, min = 1) {
    const storage = room.storage, terminal = room.terminal;
    const attacked = (Memory.roomsUnderAttack || []).includes(room.name);
    if (energyIn(terminal) >= min && (attacked || !storage || energyIn(storage) < TERMINAL_FIRST_BELOW)) return terminal;
    if (energyIn(storage) >= min) return storage;
    return energyIn(terminal) >= min ? terminal : null;
}

// Energy moved between the storage and the terminal: a move straight back the other way within
// REVERSE_TICKS is refused (reverses), so two rules that disagree cannot ship the same energy back
// and forth. The lab worker topped the terminal up from a storage under 100k, went on loan as a
// distributor, took that energy out of the terminal again (the terminal first below 100k) and put
// it back in the storage, over and over. Heap: room -> { from, to, t }.
const REVERSE_TICKS = 300;
const lastMove = Object.create(null);
function noteEnergyMove(room, from, to) {
    if (from && to) lastMove[room.name] = { from: from.id, to: to.id, t: Game.time };
}
function reverses(room, from, to) {
    const m = lastMove[room.name];
    return !!(m && from && to && m.from === to.id && m.to === from.id && Game.time - m.t < REVERSE_TICKS);
}

// The storage needs topping up from the terminal: the supplier feeds the towers (and its spawn) from
// the storage only, standing out of reach of the terminal (W1N9: Supply at 17,8, terminal 18,6).
const STORAGE_FLOOR = 5000;
function storageShort(room) {
    return !!(room.storage && room.terminal && energyIn(room.storage) < STORAGE_FLOOR && energyIn(room.terminal) >= 1000);
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

// Load left after this tick's energy transfer to target (creep.store only updates next tick).
function loadAfterTransfer(creep, target) {
    const energy = creep.store[RESOURCE_ENERGY] || 0;
    const free = target && target.store ? target.store.getFreeCapacity(RESOURCE_ENERGY) : 0;
    return creep.store.getUsedCapacity() - Math.min(energy, Math.max(0, free));
}

// The hub link (system.links storage receiver, mid-base), where the
// source links send. Every creep that collects energy at home takes from it first, whatever it holds
// (overflowSource). Haulers only took from it at 600+ and the source links only sent to it under
// 400: shardX W1N9's sat at 589 for good, both source links filled up and the upgrade miner dropped
// its energy on the floor.
const OVERFLOW_MIN = 1;
function overflowLink(room) {
    return require('system.links').storageLink(room);   // the storage receiver
}
function overflowSource(creep) {
    const link = creep.room && overflowLink(creep.room);
    const free = creep.store ? creep.store.getFreeCapacity(RESOURCE_ENERGY) : 0;
    const have = link ? link.store[RESOURCE_ENERGY] || 0 : 0;
    return link && free > 0 && have > 0 && have >= Math.min(free, OVERFLOW_MIN) ? link : null;
}
// Withdraw from it (walking there if needed); true when the creep is busy with it.
function takeOverflow(creep, opts = {}) {
    const link = overflowSource(creep);
    if (!link) return false;
    if (creep.withdraw(link, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.travelTo(link, Object.assign({ maxRooms: 1 }, opts));
    return true;
}

// Where a home hauler refills: the hub link, its own link when that holds a load, else
// storage (or terminal).
function refillSource(creep) {
    const overflow = overflowSource(creep);
    if (overflow) return overflow;
    const link = creep.memory.linkSource ? Game.getObjectById(creep.memory.linkSource) : undefined;
    if (link && link.store[RESOURCE_ENERGY] >= 600) return link;
    return getStorageTarget(creep);
}

// Call right after a transfer that returned OK. If it hands over the last of the load (at most
// emptyAt left, the role's refill threshold), start walking back to the refill point on the same
// tick instead of carrying on toward the next sink and then turning around. Returns true when it
// turned back, so the caller does not pick a next target this tick.
function returnIfEmptied(creep, target, opts = {}, emptyAt = 0, source = refillSource(creep)) {
    if (!source || loadAfterTransfer(creep, target) > emptyAt) return false;
    if (!creep.pos.isNearTo(source)) creep.travelTo(source, opts);
    return true;
}

// Builders sent to another room leave home with a full load of energy (storage, else terminal).
// memory.loaded is set once full, once outside the home room, or when home has none to spare.
// Returns true while it is loading.
function loadForTrip(creep) {
    if (creep.memory.loaded) return false;
    const home = creep.memory.homeRoom && Game.rooms[creep.memory.homeRoom];
    const free = creep.store.getFreeCapacity(RESOURCE_ENERGY);
    if (!free || !home || creep.room.name !== home.name || creep.memory.destination === home.name) {
        creep.memory.loaded = 1;
        return false;
    }
    const source = [home.storage, home.terminal].find(s => s && s.my && s.store[RESOURCE_ENERGY] >= free);
    if (!source) {
        creep.memory.loaded = 1;
        return false;
    }
    const result = creep.withdraw(source, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) creep.travelTo(source, { range: 1 });
    else creep.memory.loaded = 1;   // full next tick
    return true;
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

module.exports = { depositBeforeDeath, withdrawEnergy, transferEnergy, getStorageTarget, findEnergySink, findAndMoveToDistributionTarget, handleMovementCoordination,
    loadAfterTransfer, refillSource, returnIfEmptied, loadForTrip, overflowLink, overflowSource, takeOverflow, homeEnergy, storageShort, STORAGE_FLOOR, TERMINAL_FIRST_BELOW, noteEnergyMove, reverses };
