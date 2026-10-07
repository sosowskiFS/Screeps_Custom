const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

function storeOf(contents, capacity) {
    const store = Object.assign({}, contents);
    const used = () => Object.values(store).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
    Object.defineProperties(store, {
        getFreeCapacity: { value: r => typeof capacity === 'object' ? (capacity[r] || 0) - (store[r] || 0) : capacity - used() },
        getUsedCapacity: { value: () => used() },
    });
    return store;
}

// A full room with a power spawn and power in storage; a distributor with nothing to do.
function setup({ carry = {}, roomEnergy = 300, operator = false, powerSpawn = {} } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    g.RESOURCE_POWER = 'power';
    const ps = { id: 'ps', store: storeOf(Object.assign({ energy: 5000, power: 0 }, powerSpawn), { energy: 5000, power: 100 }) };
    const storage = { id: 'storage', store: storeOf({ energy: 300000, power: 2000 }, 1000000) };
    const room = { name: 'R', storage, terminal: null, energyAvailable: roomEnergy, energyCapacityAvailable: 300, controller: { level: 8 } };
    g.Game.rooms.R = room;
    g.Game.getObjectById = id => ({ ps, storage })[id] || null;
    g.Memory.powerSpawnList = { R: ['ps'] };
    if (operator) g.Game.powerCreeps = { op: { room, memory: { homeRoom: 'R' }, ticksToLive: 3000 } };
    const calls = [];
    const creep = {
        name: 'd', room, carryCapacity: 800, memory: { priority: 'distributor' },
        store: storeOf(carry, 800),
        withdraw: (t, r, n) => { calls.push(['withdraw', t.id, r, n]); return g.ERR_NOT_IN_RANGE; },
        transfer: (t, r) => { calls.push(['transfer', t.id, r]); return g.ERR_NOT_IN_RANGE; },
        travelTo: t => calls.push(['travelTo', t.id]),
        drop: r => calls.push(['drop', r]),
    };
    const { servicePowerSpawn } = h.load('creep.distributor');
    return { creep, calls, ps, act: () => servicePowerSpawn(creep) };
}

test('no operator: an idle distributor fetches power from storage for the power spawn', () => {
    const { calls, act } = setup();
    assert.equal(act(), true);
    assert.deepEqual(plain(calls), [['withdraw', 'storage', 'power', 100], ['travelTo', 'storage']]);
});

test('carried power goes into the power spawn, or back to storage when it is full', () => {
    let s = setup({ carry: { power: 100 } });
    s.act();
    assert.deepEqual(plain(s.calls)[0], ['transfer', 'ps', 'power']);
    s = setup({ carry: { power: 100 }, powerSpawn: { power: 100 } });
    s.act();
    assert.deepEqual(plain(s.calls)[0], ['transfer', 'storage', 'power']);
});

test('refilling the room comes first, and an operator in the room does the power itself', () => {
    assert.equal(setup({ roomEnergy: 100 }).act(), false);
    assert.equal(setup({ operator: true }).act(), false);
});

test('a low power spawn is topped up with energy while it has power to process', () => {
    const { calls, act } = setup({ carry: { energy: 800 }, powerSpawn: { energy: 1000, power: 50 } });
    assert.equal(act(), true);
    assert.deepEqual(plain(calls)[0], ['transfer', 'ps', 'energy']);
    assert.equal(setup({ carry: { energy: 800 }, powerSpawn: { energy: 1000, power: 0 } }).act(), false, 'no power: nothing to burn');
});

// The upgrader link is full (no upgrader at RCL8) and the power spawn is empty.
function upSetup({ carry = {}, linkFree = 0 } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    g.RESOURCE_POWER = 'power';
    const ps = { id: 'ps', store: storeOf({ energy: 5000, power: 0 }, { energy: 5000, power: 100 }) };
    const link = { id: 'link', structureType: g.STRUCTURE_LINK, store: storeOf({ energy: 800 - linkFree }, { energy: 800 }) };
    const storage = { id: 'storage', store: storeOf({ energy: 300000, power: 0 }, 1000000) };
    const terminal = { id: 'terminal', store: storeOf({ energy: 10000, power: 500 }, 300000) };
    const room = { name: 'R', storage, terminal };
    g.Game.getObjectById = id => ({ ps, link, storage, terminal })[id] || null;
    g.Memory.powerSpawnList = { R: ['ps'] };
    const calls = [];
    const creep = {
        name: 'u', room, ticksToLive: 1000, memory: { priority: 'upSupplier', linkTarget: 'link', deathWarn: 0 },
        carry: Object.assign({}, carry), store: storeOf(carry, 1000),
        pos: { findInRange: () => [] },
        withdraw: (t, r, n) => { calls.push(['withdraw', t.id, r, n]); return g.ERR_NOT_IN_RANGE; },
        transfer: (t, r) => { calls.push(['transfer', t.id, r]); return g.ERR_NOT_IN_RANGE; },
        travelTo: t => calls.push(['travelTo', t.id]),
    };
    return { calls, run: () => h.load('creep.upsupplier').run(creep) };
}

test('upSupplier: power from the terminal when storage has none', () => {
    const { calls, run } = upSetup();
    run();
    assert.deepEqual(plain(calls)[0], ['withdraw', 'terminal', 'power', 100]);
});

test('upSupplier: energy it cannot put in a full upgrader link goes back to storage instead of blocking power runs', () => {
    const { calls, run } = upSetup({ carry: { energy: 1000 } });
    run();
    assert.deepEqual(plain(calls)[0], ['transfer', 'storage', 'energy']);
});
