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

// May roads/ramparts be placed in `roomName` for work done on behalf of `homeName`?
function upkeepAllowed(roomName, homeName) {
    return established(roomName) && (!homeName || established(homeName));
}

module.exports = { established, upkeepAllowed };
