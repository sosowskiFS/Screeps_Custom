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

    // Reset mineral totals periodically
    if (Game.time % 50 == 0) {
        resetMineralTotals();
    }

    // Maintain list of rooms at RCL5+ with storage and >=2 links infrequently
    if (Game.time % 500 == 0) {
        updateRoomsAt5List();
    }
}

function resetMineralTotals() {
    const minerals = [
        RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM, RESOURCE_LEMERGIUM,
        RESOURCE_KEANIUM, RESOURCE_ZYNTHIUM, RESOURCE_CATALYST, RESOURCE_GHODIUM,
        RESOURCE_HYDROXIDE, RESOURCE_ZYNTHIUM_KEANITE, RESOURCE_UTRIUM_LEMERGITE,
        RESOURCE_UTRIUM_HYDRIDE, RESOURCE_UTRIUM_OXIDE, RESOURCE_KEANIUM_HYDRIDE,
        RESOURCE_KEANIUM_OXIDE, RESOURCE_LEMERGIUM_HYDRIDE, RESOURCE_LEMERGIUM_OXIDE,
        RESOURCE_ZYNTHIUM_HYDRIDE, RESOURCE_ZYNTHIUM_OXIDE, RESOURCE_GHODIUM_HYDRIDE,
        RESOURCE_GHODIUM_OXIDE, RESOURCE_UTRIUM_ACID, RESOURCE_UTRIUM_ALKALIDE,
        RESOURCE_KEANIUM_ACID, RESOURCE_KEANIUM_ALKALIDE, RESOURCE_LEMERGIUM_ACID,
        RESOURCE_LEMERGIUM_ALKALIDE, RESOURCE_ZYNTHIUM_ACID, RESOURCE_ZYNTHIUM_ALKALIDE,
        RESOURCE_GHODIUM_ACID, RESOURCE_GHODIUM_ALKALIDE, RESOURCE_CATALYZED_UTRIUM_ACID,
        RESOURCE_CATALYZED_UTRIUM_ALKALIDE, RESOURCE_CATALYZED_KEANIUM_ACID,
        RESOURCE_CATALYZED_KEANIUM_ALKALIDE, RESOURCE_CATALYZED_LEMERGIUM_ACID,
        RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE, RESOURCE_CATALYZED_ZYNTHIUM_ACID,
        RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE, RESOURCE_CATALYZED_GHODIUM_ACID,
        RESOURCE_CATALYZED_GHODIUM_ALKALIDE
    ];

    Memory.mineralTotals = {};
    minerals.forEach(mineral => {
        Memory.mineralTotals[mineral] = 0;
    });
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

module.exports = { initializeGameState, resetMineralTotals, updateRoomsAt5List };
