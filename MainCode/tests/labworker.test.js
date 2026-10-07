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

// A lab worker beside the storage. Range is 1 to the storage only: the terminal is 2 tiles away.
function setup({ carry = {}, memory = {}, storage = { XGHO2: 20000 }, terminalFree = 50000 } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    g.RESOURCE_POWER = 'power';
    const terminal = { id: 'terminal', store: storeOf({}, terminalFree) };
    const storageObj = { id: 'storage', store: storeOf(Object.assign({ energy: 100000 }, storage), 1000000) };
    const room = { name: 'R', terminal, storage: storageObj, controller: { level: 7 } };
    g.Game.rooms.R = room;
    g.Game.getObjectById = id => ({ terminal, storage: storageObj })[id] || null;
    g.Memory.mineralList.R = [];
    const calls = [];
    const near = { storage: true };
    const creep = {
        name: 'lw', room, ticksToLive: 1000, carryCapacity: 500,
        memory: Object.assign({ priority: 'labWorker', deathWarn: 0, lab1: 'XXX', lab2: 'XXX', lab3: 'XXX', lab4: 'XXX' }, memory),
        carry: Object.assign({}, carry), store: Object.assign({}, carry),
        pos: { x: 25, y: 25, findInRange: () => [], lookFor: () => [] },
        withdraw: (t, r) => {
            calls.push(['withdraw', t.id, r]);
            if (_sum(creep.carry) >= 500) return g.ERR_FULL;
            return near[t.id] ? g.OK : g.ERR_NOT_IN_RANGE;
        },
        transfer: (t, r) => { calls.push(['transfer', t.id, r]); return near[t.id] ? g.OK : g.ERR_NOT_IN_RANGE; },
        travelTo: t => { calls.push(['travelTo', t.id]); },
        drop: r => calls.push(['drop', r]), say: () => {}, move: () => {},
    };
    const _sum = o => Object.values(o).reduce((a, b) => a + b, 0);
    return { h, g, creep, calls, near, terminal, run: () => h.load('creep.labWorker').run(creep) };
}

test('a loaded lab worker heading for the terminal is not pulled back to the storage every tick', () => {
    // The reported loop: carrying KHO2 to the terminal while the storage holds minerals.
    const { creep, calls, near, run } = setup({ carry: { KHO2: 500 },
        memory: { structureTarget: 'terminal', direction: 'Transfer', mineralToMove: 'KHO2' } });
    for (let tick = 0; tick < 3; tick++) run();
    assert.ok(!calls.some(c => c[0] === 'withdraw'), 'no storage withdraws while loaded: ' + JSON.stringify(plain(calls)));
    assert.deepEqual(plain(calls).filter(c => c[0] === 'travelTo').map(c => c[1]), ['terminal', 'terminal', 'terminal'], 'heads one way');
    near.terminal = true;
    run();
    assert.deepEqual(plain(calls).pop(), ['transfer', 'terminal', 'KHO2']);
});

test('storage -> terminal hauling: withdraw empty-handed, then head for the terminal', () => {
    const { creep, calls, run } = setup();
    run();
    assert.deepEqual(plain(calls)[0], ['withdraw', 'storage', 'XGHO2']);
    creep.carry = { XGHO2: 500 };
    calls.length = 0;
    run();
    run();
    assert.ok(!calls.some(c => c[0] === 'withdraw'), 'loaded: no more withdraws');
    assert.deepEqual(plain(calls).filter(c => c[0] === 'travelTo').map(c => c[1]), ['terminal', 'terminal']);
});

test('watchdog: a load held 100+ ticks is put away whatever else is going on', () => {
    const { g, creep, calls, near, run } = setup({ carry: { KHO2: 500 }, memory: { carrySince: 1 } });
    g.Game.time = 200;
    near.terminal = true;
    run();
    assert.deepEqual(plain(calls)[0], ['transfer', 'terminal', 'KHO2']);
});

test('a full terminal sends the load to the storage instead of retrying forever', () => {
    const { calls, run } = setup({ carry: { KHO2: 500 }, terminalFree: 0, storage: {}, memory: { movingOtherMineral: true } });
    run();
    run();
    assert.deepEqual(plain(calls).filter(c => c[0] === 'transfer').map(c => c[1]), ['storage', 'storage']);
});
