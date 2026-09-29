// Heap-only tick data. Never retain Game objects across tick boundaries.
let tick;
let state;
function current() {
    if (tick !== Game.time || !state) {
        tick = Game.time;
        state = { rooms: Object.create(null), roomCreeps: Object.create(null), homes: null, orders: Object.create(null) };
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
    }
    return data.homes[roomName] || [];
}
function marketOrders(resourceType, type, predicate) {
    const orders = current().orders;
    const key = type + ':' + resourceType;
    if (!orders[key]) orders[key] = Game.market.getAllOrders({ resourceType, type });
    return predicate ? orders[key].filter(predicate) : orders[key].slice();
}
function invalidateRoom(roomName) {
    delete current().rooms[roomName];
    delete current().roomCreeps[roomName];
}
module.exports = { current, find, homeCreeps, marketOrders, invalidateRoom };
