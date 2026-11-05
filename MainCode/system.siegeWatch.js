// system.siegeWatch — a shard on watch after one of its rooms went into safe mode.
//
// Safe mode ends the attack only for now: shardX W1N9's attackers came back each time it ran out,
// and the room had spent its energy. While a room of ours is in safe mode or its safe mode cooldown
// (it was attacked: every automatic safe mode is a response to one, system.safeMode), the shard is
// on watch:
//   - the other rooms there stockpile: their energy reserve (system.energyFlow.budget) is raised
//     by EXTRA_RESERVE, so less goes into upgrading and repairs, and their terminals keep
//     TERMINAL_WATCH energy ready to send instead of TERMINAL_NORMAL (system.mineralBudget,
//     creep.distributor);
//   - the watched room is sent energy now, before the next attack, until its storage + terminal
//     hold WATCH_STOCK (system.energyAid, after any emergency).
// The watch ends with the cooldown; if no attack came, the economy goes back to normal. A room with no
// terminal (never built, or lost) cannot be sent energy, so it puts no shard on watch; and one with no
// terminal cannot send any, so it keeps no extra reserve.
const EXTRA_RESERVE = level => (level >= 6 ? 100000 : level >= 4 ? 50000 : 0);
const TERMINAL_NORMAL = 30000;
const TERMINAL_WATCH = 60000;
const WATCH_STOCK = 200000;

let cache = { t: -1, rooms: [] };
// Our rooms on this shard in safe mode or its cooldown, with a terminal to receive energy (bait rooms
// never take safe mode).
function watchedRooms() {
    if (cache.t === Game.time) return cache.rooms;
    const rooms = [];
    for (const name in Game.rooms) {
        const c = Game.rooms[name].controller;
        if (!c || !c.my || !Game.rooms[name].terminal) continue;
        if ((c.safeMode || 0) > 0 || (c.safeModeCooldown || 0) > 0) rooms.push(name);
    }
    cache = { t: Game.time, rooms };
    return rooms;
}
function watched(roomName) {
    return watchedRooms().includes(roomName);
}
function onWatch() {
    return watchedRooms().length > 0;
}

// Extra energy a room keeps in reserve while the shard is on watch (not the watched room itself).
function extraReserve(room) {
    if (!room || !room.controller || !room.terminal || !onWatch() || watched(room.name)) return 0;
    return EXTRA_RESERVE(room.controller.level || 0);
}

// Energy the terminal keeps ready to send.
function terminalEnergyGoal(room) {
    return onWatch() && room && !watched(room.name) ? TERMINAL_WATCH : TERMINAL_NORMAL;
}

module.exports = { watchedRooms, watched, onWatch, extraReserve, terminalEnergyGoal, TERMINAL_NORMAL, TERMINAL_WATCH, WATCH_STOCK, EXTRA_RESERVE };
