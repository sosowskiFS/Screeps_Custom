// room.status — can our creeps enter a room at all?
//
// Some rooms exist on the map but cannot be entered: closed, "out of borders" (shardX is a
// checkerboard of open and closed 10x10 sectors), or novice/respawn zones we are not part of.
// Game.map.getRoomStatus is cached in heap for STATUS_TTL ticks per room. Without the API
// (private servers, tests) every room counts as open.
//
// Border walls: a wall on an exit tile can only be the game's (players cannot build there), and marks
// the edge of a novice or respawn zone. Which side matters: shard2 E49N34 has them on its north only and
// is mined from E49N33, and E49N33 itself on its west. They also tell before the status cache does that
// a zone has appeared. Memory.borderWalls[room] = { s: sides ('NESW'), t: tick last seen }, walled rooms only.
// getRoomStatus remains the main test: E48N34, in the same zone, has none of its own.
const STATUS_TTL = 10000;
const WALL_TTL = 30000;          // not seen this long: the zone may have ended
const REACH_TTL = 1000;
const REACH_RANGE = 4;           // rooms from home searched; further: the status alone decides
const EXIT_SIDE = { 1: 'N', 3: 'E', 5: 'S', 7: 'W' };
const OPPOSITE = { N: 'S', E: 'W', S: 'N', W: 'E' };
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

function walledSides(roomName) {
    const table = Memory.borderWalls;
    const entry = table && table[roomName];
    if (!entry) return '';
    if (Game.time - entry.t > WALL_TTL) {
        delete table[roomName];
        reachVersion++;
        return '';
    }
    return entry.s;
}

// Note a visible room's border walls. A side new to us drops the cached status of the rooms it touches.
let reachVersion = 0;
function noteBorderWalls(room) {
    const sides = new Set();
    for (const s of room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_WALL } })) {
        if (s.pos.x === 0) sides.add('W');
        else if (s.pos.x === 49) sides.add('E');
        else if (s.pos.y === 0) sides.add('N');
        else if (s.pos.y === 49) sides.add('S');
    }
    const text = ['N', 'E', 'S', 'W'].filter(side => sides.has(side)).join('');
    const known = Memory.borderWalls && Memory.borderWalls[room.name];
    if (!text) {
        if (known) {
            delete Memory.borderWalls[room.name];
            reachVersion++;
        }
        return;
    }
    if (!Memory.borderWalls) Memory.borderWalls = {};
    Memory.borderWalls[room.name] = { s: text, t: Game.time };
    if (known && known.s === text) return;
    reachVersion++;
    delete cache[room.name];
    const exits = (Game.map.describeExits && Game.map.describeExits(room.name)) || {};
    for (const dir in exits) if (text.includes(EXIT_SIDE[dir])) delete cache[exits[dir]];
}

// Rooms a creep from home can walk to within REACH_RANGE, around closed rooms and border walls.
const reachCache = Object.create(null);
function reachableRooms(home) {
    const hit = reachCache[home];
    if (hit && hit.v === reachVersion && Game.time - hit.t < REACH_TTL) return hit.rooms;
    const own = status(home);
    const rooms = new Set([home]), queue = [home];
    for (let head = 0; head < queue.length; head++) {
        const here = queue[head];
        const exits = Game.map.describeExits(here) || {};
        const walled = walledSides(here);
        for (const dir in exits) {
            const next = exits[dir], side = EXIT_SIDE[dir];
            if (rooms.has(next) || walled.includes(side) || walledSides(next).includes(OPPOSITE[side])) continue;
            if (Game.map.getRoomLinearDistance(home, next) > REACH_RANGE || status(next) !== own) continue;
            rooms.add(next);
            queue.push(next);
        }
    }
    reachCache[home] = { v: reachVersion, t: Game.time, rooms };
    return rooms;
}

// Can a creep from this home get to this room? (Its own status, then the way there.)
function accessible(home, roomName) {
    if (home === roomName) return true;
    if (status(roomName) !== status(home)) return false;
    if (!Memory.borderWalls || !Game.map.describeExits || !Object.keys(Memory.borderWalls).length) return true;
    if (Game.map.getRoomLinearDistance(home, roomName) > REACH_RANGE) return true;
    return reachableRooms(home).has(roomName);
}

module.exports = { status, open, accessible, noteBorderWalls, walledSides };
