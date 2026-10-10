// Heap-only tick data. Never retain Game objects across tick boundaries.
let tick;
let state;
function current() {
    if (tick !== Game.time || !state) {
        tick = Game.time;
        state = { rooms: Object.create(null), roomCreeps: Object.create(null), homes: null, orders: Object.create(null), pending: [] };
    }
    return state;
}
// Independent arrays allow callers to sort/splice. Predicates always run again:
// creep memory and other script-owned properties can change during a tick.
function find(room, type, options) {
    // Site membership can change during planning; keep these reads native.
    if (type === FIND_CONSTRUCTION_SITES || type === FIND_MY_CONSTRUCTION_SITES) return room.find(type, options);
    const rooms = current().rooms;
    const queries = rooms[room.name] || (rooms[room.name] = Object.create(null));
    let entry = queries[type];
    if (!entry) entry = queries[type] = { values: room.find(type), types: null };
    const filter = options && options.filter;
    if (!filter) return entry.values.slice();
    if (typeof filter === 'object' && Object.keys(filter).length === 1 && filter.structureType !== undefined) {
        if (!entry.types) {
            entry.types = Object.create(null);
            for (const value of entry.values) {
                const key = value.structureType;
                (entry.types[key] || (entry.types[key] = [])).push(value);
            }
        }
        return (entry.types[filter.structureType] || []).slice();
    }
    return _.filter(entry.values, filter);
}
// Used during spawning, before roles can reassign homeRoom.
function homeCreeps(roomName) {
    const data = current();
    if (!data.homes) {
        data.homes = Object.create(null);
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            const home = creep.memory.homeRoom;
            (data.homes[home] || (data.homes[home] = [])).push(creep);
        }
        for (const ghost of data.pending) {
            const home = ghost.memory.homeRoom;
            (data.homes[home] || (data.homes[home] = [])).push(ghost);
        }
    }
    return data.homes[roomName] || [];
}
function marketOrders(resourceType, type, predicate) {
    if (!require('runtime.world').market()) return [];   // Seasonal World: no orders to trade with
    const orders = current().orders;
    const key = type + ':' + resourceType;
    if (!orders[key]) orders[key] = Game.market.getAllOrders({ resourceType, type });
    return predicate ? orders[key].filter(predicate) : orders[key].slice();
}
// A creep ordered with spawnCreep this tick is not in Game.creeps until next tick. Every spawn
// in a room runs its census on the same tick, so without this each one sees the job unfilled
// and orders its own creep. Placeholders join every census for the rest of the tick: home
// creeps, the room creep list used by the room spawners and the per-role counts.
function notePending(spawn, name, memory) {
    const data = current();
    const ghost = { name, id: '', memory, pending: true, spawning: true, my: true, room: spawn.room, pos: spawn.pos,
        hits: 1, hitsMax: 1, ticksToLive: 1500, body: [], getActiveBodyparts: () => 0 };
    data.pending.push(ghost);
    const home = memory.homeRoom;
    if (data.homes && home) (data.homes[home] || (data.homes[home] = [])).push(ghost);
    const roomList = data.roomCreeps[spawn.room.name];
    if (roomList) roomList.push(ghost);
    const roles = data.spawnRoles && data.spawnRoles.roleByRoom;
    if (roles && home && memory.priority) {
        const counts = roles[home] || (roles[home] = {});
        counts[memory.priority] = (counts[memory.priority] || 0) + 1;
    }
    return ghost;
}
// Creeps ordered this tick, optionally only those spawning in one room.
function pendingCreeps(roomName) {
    const pending = current().pending;
    return roomName ? pending.filter(g => g.room && g.room.name === roomName) : pending.slice();
}
function invalidateRoom(roomName) {
    delete current().rooms[roomName];
    delete current().roomCreeps[roomName];
}
module.exports = { current, find, homeCreeps, marketOrders, invalidateRoom, notePending, pendingCreeps };
