// system.badRooms — rooms claimed by players we are not friends with.
//
// A room whose controller is owned by another player who is not on Memory.whiteList is "bad":
// its towers and defenders kill passing creeps, so the Traveler never plans a multi-room path
// through one (only the trip's own start or destination room may be bad). Reserved rooms are
// not bad: a reservation has no towers.
//
// Every visible room is checked every UPDATE_EVERY ticks: a newly claimed room is added, a room
// that is no longer claimed (or was claimed by a friend) is dropped. A bad room nobody has seen
// for RECHECK ticks is looked at again: by an observer in range when there is one, otherwise by
// a 1-MOVE scout from the nearest home (system.spawning), so the designation does not go stale.
//
// Memory.badRooms[room] = { o: owner, t: tick last seen claimed }
const UPDATE_EVERY = 5;
const RECHECK = 20000;          // ticks without vision before a bad room is looked at again
const OBSERVER_RANGE = 10;
const SCOUT_RANGE = 6;          // rooms from home a re-check scout may be sent

let version = 0;                // bumped on every change; Traveler's route cache keys on it

function table() {
    return Memory.badRooms || (Memory.badRooms = {});
}

function friendly(username) {
    return !!(Memory.whiteList && Memory.whiteList.includes(username));
}

// Record what a visible room is right now.
function record(room) {
    const bad = table();
    const controller = room.controller;
    const owner = controller && controller.owner && !controller.my && !friendly(controller.owner.username)
        ? controller.owner.username : undefined;
    if (owner) {
        if (!bad[room.name] || bad[room.name].o !== owner) version++;
        bad[room.name] = { o: owner, t: Game.time };
    } else if (bad[room.name]) {
        delete bad[room.name];
        version++;
    }
}

function update() {
    if (Game.time % UPDATE_EVERY !== 0) return;
    for (const name in Game.rooms) record(Game.rooms[name]);
}

function isBad(roomName) {
    return !!(Memory.badRooms && Memory.badRooms[roomName]);
}

function stale(entry) {
    return Game.time - entry.t >= RECHECK;
}

// Bad rooms nobody has seen for a while, nearest first, within `range` of the home.
function staleNear(homeName, range) {
    const out = [];
    for (const roomName in table()) {
        if (!stale(table()[roomName])) continue;
        const distance = Game.map.getRoomLinearDistance(homeName, roomName);
        if (distance <= range) out.push({ roomName, distance });
    }
    out.sort((a, b) => a.distance - b.distance);
    return out.map(e => e.roomName);
}

// Observer homes: a stale bad room in observer range, else undefined.
function observeRequest(homeName) {
    return staleNear(homeName, OBSERVER_RANGE)[0];
}

function observerCovers(roomName) {
    for (const home in Memory.observerList || {}) {
        if (Memory.observerList[home] && Memory.observerList[home].length &&
            Game.map.getRoomLinearDistance(home, roomName) <= OBSERVER_RANGE) return true;
    }
    return false;
}

// The owned home nearest a room (one scout per stale room, not one per nearby home).
function nearestHome(roomName) {
    let best, bestDistance = Infinity;
    for (const name in Game.spawns) {
        const home = Game.spawns[name].room.name;
        const distance = Game.map.getRoomLinearDistance(home, roomName);
        if (distance < bestDistance) { bestDistance = distance; best = home; }
    }
    return best;
}

// Rooms a re-check scout from this home should visit: stale, no observer in range, and this
// is the nearest home.
function scoutTargets(homeName) {
    return staleNear(homeName, SCOUT_RANGE).filter(roomName => !observerCovers(roomName) && nearestHome(roomName) === homeName);
}

module.exports = { update, record, isBad, observeRequest, scoutTargets, version: () => version, RECHECK };
