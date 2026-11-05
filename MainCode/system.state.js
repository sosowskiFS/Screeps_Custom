const runtimeCache = require('runtime.cache');
// system.state — Screeps tick subsystem.
const { checkTimedOutFlags } = require('system.flags');
const { displayGeneralPieGraphs } = require('system.visuals');

function initializeGameState() {
    // Mineral timer countdowns
    for (var x in Memory.SKMineralTimers) {
        if (Memory.SKMineralTimers[x] > 0) {
            Memory.SKMineralTimers[x] = Memory.SKMineralTimers[x] - 1;
        }
    }

    // Check for timed out far mining flags
    if (Game.time % 250 == 0) {
        checkTimedOutFlags();
    }

    if (Game.time % 1000 == 0) {
        Memory.ordersFilled = [];
    }

    // Display general pie graphs
    displayGeneralPieGraphs();

    // Reset mineral flag totals before spawning loop
    if (Game.time % 5000 == 0) {
    }

    // Empire mineral stock (terminals, storages, labs): whole, every tick, on every global instance
    // (system.labs.stockCached; it used to be zeroed and recounted room by room every 50 ticks).
    Memory.mineralTotals = require('system.labs').stockCached();

    // Maintain list of rooms at RCL5+ with storage and >=2 links infrequently
    if (Game.time % 500 == 0) {
        updateRoomsAt5List();
    }
}

function updateRoomsAt5List() {
    if (!Memory.RoomsAt5) {
        Memory.RoomsAt5 = [];
    }

    const qualified = [];
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room || !room.controller || !room.controller.my) continue; // only my controlled rooms
        if (room.controller.level < 5) continue;
        if (!room.storage) continue;
        const links = runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LINK } });
        if (links.length >= 2) {
            qualified.push(roomName);
        }
    }

    Memory.RoomsAt5 = qualified;
}

module.exports = { initializeGameState, updateRoomsAt5List };
