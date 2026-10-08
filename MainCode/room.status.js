// room.status — can our creeps enter a room at all?
//
// Some rooms exist on the map but cannot be entered: closed, "out of borders" (shardX is a
// checkerboard of open and closed 10x10 sectors), or novice/respawn zones we are not part of.
// Game.map.getRoomStatus is cached in heap for STATUS_TTL ticks per room. Without the API
// (private servers, tests) every room counts as open.
const STATUS_TTL = 10000;
const cache = Object.create(null);   // room -> { s: status, t: tick }

function status(roomName) {
    if (!Game.map || typeof Game.map.getRoomStatus !== 'function') return 'normal';
    const hit = cache[roomName];
    if (hit && Game.time - hit.t < STATUS_TTL) return hit.s;
    let s = 'normal';
    try {
        const result = Game.map.getRoomStatus(roomName);
        s = result && result.status ? result.status : 'closed';
    } catch (e) {
        s = 'closed';
    }
    cache[roomName] = { s, t: Game.time };
    return s;
}

// Statuses our own rooms have (a novice/respawn zone we are in is open to us), per tick.
let ownTick = -1;
let own = new Set(['normal']);
function ownStatuses() {
    if (ownTick !== Game.time) {
        ownTick = Game.time;
        own = new Set(['normal']);
        for (const name in Game.rooms) {
            const c = Game.rooms[name].controller;
            if (c && c.my) own.add(status(name));
        }
    }
    return own;
}

function open(roomName) {
    const s = status(roomName);
    return s === 'normal' || ownStatuses().has(s);
}

module.exports = { status, open };
