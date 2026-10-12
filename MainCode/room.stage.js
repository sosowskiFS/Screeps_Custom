// room.stage — is a room of ours past its young stage?
//
// A room of ours is young until it has its own terminal. Young rooms (new expansions, shardX)
// spend their energy on building and upgrading: no roads or ramparts are placed in them (or by
// creeps working for them), since both need constant upkeep. Rooms that are not ours (remotes,
// highways) are judged by the home room the work is for.
function established(roomOrName) {
    const room = typeof roomOrName === 'string' ? Game.rooms[roomOrName] : roomOrName;
    if (!room || !room.controller || !room.controller.my) return true;
    // RCL7+ with a storage has long had a terminal: a base migration rebuilding it does not make
    // the room young again.
    if (room.storage && room.controller.level >= 7) return true;
    return !!(room.terminal && room.terminal.my);
}

// Does someone else carry this young room: an auto-expansion target (sponsor helpers), any shardX
// room (sponsored from the home shards), or sponsor helpers working in it? A room on its own
// (a fresh start, the Seasonal World) has to build everything itself.
function supported(roomOrName) {
    const room = typeof roomOrName === 'string' ? Game.rooms[roomOrName] : roomOrName;
    if (!room) return false;
    if (Memory.expansion && Memory.expansion.t === room.name) return true;
    if (Game.shard && Game.shard.name === 'shardX') return true;
    return Object.values(Game.creeps).some(c => c.memory && c.memory.priority === 'helper' && c.memory.destination === room.name);
}

// May roads/ramparts be placed in `roomName` for work done on behalf of `homeName`?
function upkeepAllowed(roomName, homeName) {
    return established(roomName) && (!homeName || established(homeName));
}

// Everything RCL5 allows is built (spawn, extensions, towers, storage, links; sites don't count).
// From here the room's own miners take a source's full 3,000 per 300 ticks (5 WORK: 700 energy of its
// 1,800), so a sponsor's helpers are no longer needed (system.expansion, system.shardX).
// What RCL5 allows (CONTROLLER_STRUCTURES[type][5]).
const RCL5 = () => ({ [STRUCTURE_SPAWN]: 1, [STRUCTURE_EXTENSION]: 30, [STRUCTURE_TOWER]: 2, [STRUCTURE_STORAGE]: 1, [STRUCTURE_LINK]: 2 });
function rcl5Built(roomOrName) {
    const room = typeof roomOrName === 'string' ? Game.rooms[roomOrName] : roomOrName;
    if (!room || !room.controller || !room.controller.my || room.controller.level < 5) return false;
    const mine = require('runtime.cache').find(room, FIND_MY_STRUCTURES);
    const want = RCL5();
    return Object.keys(want).every(type => mine.filter(s => s.structureType === type).length >= want[type]);
}

module.exports = { established, upkeepAllowed, supported, rcl5Built };
