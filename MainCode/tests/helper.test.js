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
function setup({ carry = {}, others = [], sites = [], dropped = [], aEnergy = 3000 } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    g.Game.time = 101;
    const walls = new Set();
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if ((dx || dy) && !(dx === 1 && dy === 0)) walls.add((10 + dx) + ',' + (10 + dy));
    const room = { name: 'NEW', controller: { my: true, level: 2, ticksToDowngrade: 20000, pos: { x: 25, y: 25 }, sign: { username: 'me' } },
        energyAvailable: 300, energyCapacityAvailable: 300,
        getTerrain: () => ({ get: (x, y) => (walls.has(x + ',' + y) ? 1 : 0) }), lookForAtArea: () => [] };
    const source = (id, x, y, energy) => ({ id, energy, ticksToRegeneration: 200, room, pos: { x, y, roomName: 'NEW' } });
    const A = source('A', 10, 10, aEnergy), B = source('B', 40, 40, 3000);
    const objects = { A, B };
    for (const o of sites.concat(dropped)) objects[o.id] = o;
    const calls = [];
    const { Traveler } = h.load('traveler');
    const at = t => t.pos || t;
    const creep = {
        name: 'me', room, owner: { username: 'me' }, carryCapacity: 400, store: storeOf(carry, 400),
        memory: { priority: 'helper', destination: 'NEW', homeRoom: 'HOME', loaded: 1 },
        getActiveBodyparts: () => 4,
        pos: { x: 15, y: 15, roomName: 'NEW', isNearTo: t => range(creep.pos, at(t)) <= 1, inRangeTo: (t, r) => range(creep.pos, at(t)) <= r,
            getRangeTo: t => range(creep.pos, at(t)), findInRange: () => [], lookFor: () => [],
            findClosestByRange: list => list.slice().sort((a, b) => range(creep.pos, at(a)) - range(creep.pos, at(b)))[0] },
        harvest: t => { calls.push(['harvest', t.id]); return creep.pos.isNearTo(t) ? (t.energy ? g.OK : g.ERR_NOT_ENOUGH_RESOURCES) : g.ERR_NOT_IN_RANGE; },
        pickup: t => { calls.push(['pickup', t.id]); return g.ERR_NOT_IN_RANGE; },
        build: t => { calls.push(['build', t.id]); return creep.pos.inRangeTo(t, 3) ? g.OK : g.ERR_NOT_IN_RANGE; },
        upgradeController: () => { calls.push(['upgrade']); return g.ERR_NOT_IN_RANGE; },
        transfer: () => g.ERR_NOT_IN_RANGE, signController: () => g.OK,
        travelTo: (t, opts) => { calls.push(['travelTo', t.id || 'pos', opts && opts.range]); Traveler.markMoved(creep); return g.OK; },
    };
    g.Game.getObjectById = id => objects[id] || null;
    room.find = type => {
        if (type === g.FIND_SOURCES) return [A, B];
        if (type === g.FIND_MY_CREEPS) return [creep, ...others];
        if (type === g.FIND_MY_CONSTRUCTION_SITES) return sites;
        if (type === g.FIND_DROPPED_RESOURCES) return dropped;
        return [];
    };
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

test('beside a source that ran dry with some energy carried, it goes to build instead of standing there', () => {
    const site = { id: 'site', structureType: 'extension', progress: 0, progressTotal: 3000, pos: { x: 13, y: 12 } };
    const s = setup({ carry: { energy: 150 }, sites: [site], aEnergy: 0, others: Array.from({ length: 8 }, () => ({ memory: { targetSource: 'B' } })) });
    s.creep.pos.x = 11; s.creep.pos.y = 10;
    s.creep.memory.targetSource = 'A';
    s.creep.memory.currentState = 1;
    s.run();
    assert.equal(s.creep.memory.currentState, 2);
    assert.deepEqual(plain(s.calls).filter(c => c[0] !== 'travelTo'), [['build', 'site']]);
    assert.equal(s.creep.memory.targetSource, undefined, 'its tile is released');
});

test('loose energy lying in the room comes before harvesting', () => {
    const drop = { id: 'drop', resourceType: 'energy', amount: 300, pos: { x: 20, y: 20 } };
    const s = setup({ dropped: [drop] });
    s.run();
    assert.deepEqual(plain(s.calls).slice(0, 2), [['pickup', 'drop'], ['travelTo', 'drop', 1]]);
});

test('all helpers pour into one site: spawn/tower/extension first, then the furthest along', () => {
    const site = (id, type, progress, x) => ({ id, structureType: type, progress, progressTotal: 1000, pos: { x, y: 15 } });
    const s0 = setup();
    const T = s0.g;
    const sites = [site('road', T.STRUCTURE_ROAD, 900, 16), site('ext1', T.STRUCTURE_EXTENSION, 100, 17), site('ext2', T.STRUCTURE_EXTENSION, 600, 30), site('lab', T.STRUCTURE_LAB, 0, 18)];
    const s = setup({ carry: { energy: 400 }, sites });
    s.run();
    assert.equal(s.creep.memory.siteTarget, 'ext2', 'an extension, the one closest to done, even though further away');
    assert.deepEqual(plain(s.calls).find(c => c[0] === 'travelTo'), ['travelTo', 'ext2', 3], 'worked from range 3');
});

test('with every tile taken it spends what it carries, or waits out of the way', () => {
    const busy = [{ memory: { targetSource: 'A' } }, ...Array.from({ length: 8 }, () => ({ memory: { targetSource: 'B' } }))];
    let s = setup({ carry: { energy: 100 }, others: busy });
    s.run();
    assert.equal(s.creep.memory.currentState, 2, 'off to work with the 100 it has');
    s = setup({ others: busy });
    s.run();
    assert.notEqual(s.creep.memory.currentState, 2);
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
