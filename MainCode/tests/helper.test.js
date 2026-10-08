const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

function storeOf(contents, capacity) {
    const store = Object.assign({}, contents);
    const used = () => Object.values(store).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
    Object.defineProperties(store, {
        getFreeCapacity: { value: () => capacity - used() },
        getUsedCapacity: { value: () => used() },
    });
    return store;
}

const range = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

// The room being built: source A at 10,10 is near but walled in to a single harvesting tile
// (11,10); source B at 40,40 is far with open ground around it.
function setup({ carry = {}, others = [] } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    g.Game.time = 100;
    const walls = new Set();
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if ((dx || dy) && !(dx === 1 && dy === 0)) walls.add((10 + dx) + ',' + (10 + dy));
    const room = { name: 'NEW', controller: { my: true, level: 2, pos: { x: 25, y: 25 } }, energyAvailable: 300, energyCapacityAvailable: 300,
        getTerrain: () => ({ get: (x, y) => (walls.has(x + ',' + y) ? 1 : 0) }), lookForAtArea: () => [] };
    const source = (id, x, y) => ({ id, energy: 3000, room, pos: { x, y, roomName: 'NEW' } });
    const A = source('A', 10, 10), B = source('B', 40, 40);
    const calls = [];
    const { Traveler } = h.load('traveler');
    const creep = {
        name: 'me', room, carryCapacity: 400, store: storeOf(carry, 400), carry: Object.assign({}, carry),
        memory: { priority: 'helper', destination: 'NEW', homeRoom: 'HOME', loaded: 1, currentState: 1 },
        getActiveBodyparts: () => 4,
        pos: { x: 15, y: 15, roomName: 'NEW', isNearTo: t => range(creep.pos, t.pos || t) <= 1, inRangeTo: (t, r) => range(creep.pos, t.pos || t) <= r,
            findInRange: () => [], findClosestByRange: list => list.slice().sort((a, b) => range(creep.pos, a.pos) - range(creep.pos, b.pos))[0], lookFor: () => [] },
        harvest: t => { calls.push(['harvest', t.id]); return creep.pos.isNearTo(t) ? g.OK : g.ERR_NOT_IN_RANGE; },
        build: () => g.ERR_NOT_IN_RANGE, upgradeController: () => g.ERR_NOT_IN_RANGE, transfer: () => g.ERR_NOT_IN_RANGE, repair: () => g.OK,
        travelTo: (t, opts) => { calls.push(['travelTo', t.id || t.roomName || 'pos', opts && opts.range]); Traveler.markMoved(creep); return g.OK; },
    };
    room.find = type => (type === g.FIND_SOURCES ? [A, B] : type === g.FIND_MY_CREEPS ? [creep, ...others] : []);
    return { g, creep, calls, run: () => h.load('creep.helper').run(creep) };
}

test('a helper takes the nearest source that still has a free harvesting tile', () => {
    let s = setup();
    s.run();
    assert.equal(s.creep.memory.targetSource, 'A', 'A is nearest and its one tile is free');
    s = setup({ others: [{ memory: { targetSource: 'A' } }] });
    s.run();
    assert.equal(s.creep.memory.targetSource, 'B', 'A\'s only tile is taken: B, not a queue at A');
    assert.deepEqual(plain(s.calls).filter(c => c[0] === 'travelTo')[0], ['travelTo', 'B', 1]);
});

test('with every tile taken it spends what it carries, or waits out of the way', () => {
    const busy = [{ memory: { targetSource: 'A' } }, ...Array.from({ length: 8 }, () => ({ memory: { targetSource: 'B' } }))];
    let s = setup({ carry: { energy: 100 }, others: busy });
    s.run();
    assert.equal(s.creep.memory.currentState, 2, 'off to build with the 100 it has');
    s = setup({ others: busy });
    s.run();
    assert.equal(s.creep.memory.currentState, 1);
    assert.deepEqual(plain(s.calls).pop(), ['travelTo', 'A', 3], 'waits 3 tiles from the nearest source');
});

test('a helper working in place is parked (not pushed or pathed through); one on the move is not', () => {
    const s = setup();
    s.creep.pos.x = 11; s.creep.pos.y = 10;   // on A's harvesting tile
    s.run();
    assert.equal(s.creep.memory.onPoint, 1);
    s.creep.pos.x = 15; s.creep.pos.y = 15;
    s.creep.memory.targetSource = 'B';
    s.g.Game.time++;
    s.run();
    assert.equal(s.creep.memory.onPoint, undefined);
});

test('builders and upgraders work from range 3 instead of crowding the target', () => {
    const s = setup({ carry: { energy: 400 } });
    s.creep.memory.currentState = 2;
    s.creep.pos.findClosestByRange = list => (Array.isArray(list) ? list[0] : { id: 'site', pos: { x: 30, y: 30 } });
    s.run();
    assert.deepEqual(plain(s.calls).find(c => c[0] === 'travelTo'), ['travelTo', 'site', 3]);
});
