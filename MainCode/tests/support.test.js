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

function world({ homeEnergy = 300000, newStorage = 20000 } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    const home = { name: 'HOME', energyCapacityAvailable: 2300, storage: { id: 'hs', my: true, store: storeOf({ energy: homeEnergy }, 1000000) } };
    const young = { name: 'NEW', storage: newStorage === null ? undefined : { id: 'ns', my: true, store: storeOf({ energy: newStorage }, 1000000) } };
    g.Game.rooms = { HOME: home, NEW: young };
    const calls = [];
    const creep = (memory, carry, roomName = 'HOME', capacity = 400) => ({
        name: 'c', memory, room: g.Game.rooms[roomName], ticksToLive: 1400, store: storeOf(carry, capacity),
        withdraw: (t, r) => { calls.push(['withdraw', t.id, r]); return g.ERR_NOT_IN_RANGE; },
        transfer: (t, r) => { calls.push(['transfer', t.id, r]); return g.ERR_NOT_IN_RANGE; },
        travelTo: t => calls.push(['travelTo', t.id || t.roomName]), suicide: () => calls.push(['suicide']),
    });
    return { h, g, calls, creep };
}

test('a helper leaves home with a full load of energy', () => {
    const { h, calls, creep } = world();
    const { loadForTrip } = h.load('creep.logistics');
    const helper = creep({ priority: 'helper', homeRoom: 'HOME', destination: 'NEW' }, {});
    assert.equal(loadForTrip(helper), true);
    assert.deepEqual(plain(calls), [['withdraw', 'hs', 'energy'], ['travelTo', 'hs']]);
    const full = creep({ priority: 'helper', homeRoom: 'HOME', destination: 'NEW' }, { energy: 400 });
    assert.equal(loadForTrip(full), false);
    assert.equal(full.memory.loaded, 1);
    const away = creep({ priority: 'helper', homeRoom: 'HOME', destination: 'NEW' }, {}, 'NEW');
    assert.equal(loadForTrip(away), false, 'already left: no turning back');
});

test('support haulers are ordered once the crew is full and the new room\'s storage is built and short', () => {
    const { h, g } = world();
    const expansion = h.load('system.expansion');
    g.Memory.expansion = { t: 'NEW', sp: 'HOME', st: 'develop', since: 1, bad: {} };
    g.Game.creeps = { guard: { memory: { priority: 'roomGuard', destination: 'NEW' }, ticksToLive: 1400 } };
    assert.equal(expansion.spawnOrder('HOME').type, 'helper', 'builders first');
    for (let i = 0; i < expansion.HELPERS; i++) g.Game.creeps['h' + i] = { memory: { priority: 'helper', destination: 'NEW' } };
    assert.equal(expansion.spawnOrder('HOME').type, 'supportHauler');
    for (let i = 0; i < expansion.HAULERS; i++) g.Game.creeps['t' + i] = { memory: { priority: 'supportHauler', destination: 'NEW' } };
    assert.equal(expansion.spawnOrder('HOME').type, 'helper', 'enough trucks');
});

test('no trucking without the new storage, once it holds 100k, or while the sponsor is low', () => {
    let w = world({ newStorage: null });
    assert.equal(w.h.load('system.expansion').supplyWanted('NEW', 'HOME'), false);
    w = world({ newStorage: 100000 });
    assert.equal(w.h.load('system.expansion').supplyWanted('NEW', 'HOME'), false);
    w = world({ homeEnergy: 70000 });
    assert.equal(w.h.load('system.expansion').supplyWanted('NEW', 'HOME'), false);
    w = world();
    assert.equal(w.h.load('system.expansion').supplyWanted('NEW', 'HOME'), true);
});

test('a support hauler fills at the sponsor, empties into the new storage, and retires when no longer needed', () => {
    let w = world();
    const run = c => w.h.load('creep.supportHauler').run(c);
    run(w.creep({ priority: 'supportHauler', homeRoom: 'HOME', destination: 'NEW' }, {}));
    assert.deepEqual(plain(w.calls)[0], ['withdraw', 'hs', 'energy']);
    w.calls.length = 0;
    run(w.creep({ priority: 'supportHauler', homeRoom: 'HOME', destination: 'NEW' }, { energy: 400 }));
    assert.deepEqual(plain(w.calls)[0], ['transfer', 'ns', 'energy']);
    w = world({ newStorage: 150000 });
    w.h.load('creep.supportHauler').run(w.creep({ priority: 'supportHauler', homeRoom: 'HOME', destination: 'NEW' }, {}));
    assert.deepEqual(plain(w.calls), [['suicide']]);
});
