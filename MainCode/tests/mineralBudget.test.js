const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

const R = name => 'RESOURCE_' + name;

function storeOf(contents, capacity) {
    const store = Object.assign({}, contents);
    const used = () => Object.keys(store).reduce((a, k) => a + store[k], 0);
    Object.defineProperties(store, {
        getFreeCapacity: { value: () => capacity - used() },
        getUsedCapacity: { value: () => used() },
    });
    return store;
}

// The reported room (E27N43): storage 1M full (247k energy, the rest minerals), terminal nearly full.
function clogged({ storageGoods, terminalGoods = { [R('OXYGEN')]: 200000, [R('CATALYZED_GHODIUM_ACID')]: 50000 }, terminalEnergy = 36763, carry = {} } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    const goods = storageGoods || { [R('HYDROGEN')]: 400000, [R('UTRIUM_HYDRIDE')]: 200000, [R('CATALYZED_UTRIUM_ACID')]: 153027 };
    const storage = { id: 'storage', store: storeOf(Object.assign({ energy: 246973 }, goods), 1000000) };
    const terminal = { id: 'terminal', store: storeOf(Object.assign({ energy: terminalEnergy }, terminalGoods), 300000) };
    const room = { name: 'R', storage, terminal, controller: { level: 8 } };
    g.Game.rooms.R = room;
    g.Game.getObjectById = id => ({ storage, terminal })[id] || null;
    g.Memory.mineralList.R = [];
    const calls = [];
    const creep = { name: 'lw', room, ticksToLive: 1000, carryCapacity: 500,
        memory: { priority: 'labWorker', deathWarn: 0, lab1: 'XXX', lab2: 'XXX', lab3: 'XXX', lab4: 'XXX' },
        carry: Object.assign({}, carry), store: storeOf(Object.assign({}, carry), 500),
        pos: { x: 25, y: 25, findInRange: () => [], lookFor: () => [] },
        withdraw: (t, r, n) => { calls.push(['withdraw', t.id, r, n]); return g.OK; },
        transfer: (t, r) => { calls.push(['transfer', t.id, r]); return g.OK; },
        drop: r => { calls.push(['drop', r]); return g.OK; },
        travelTo: t => calls.push(['travelTo', t.id]), say: () => {}, move: () => {} };
    return { h, g, room, storage, terminal, creep, calls, budget: h.load('system.mineralBudget') };
}

test('budget: a full storage sheds base minerals first, compounds later, T3 boosts last', () => {
    const { budget, room } = clogged();
    const first = budget.pick(room);
    assert.equal(first.from.id, 'storage');
    assert.equal(first.resource, R('HYDROGEN'), 'base mineral before UH and XUH2O');
    assert.ok(budget.tier(R('HYDROGEN')) < budget.tier(R('UTRIUM_HYDRIDE')));
    assert.ok(budget.tier(R('UTRIUM_HYDRIDE')) < budget.tier(R('UTRIUM_ACID')));
    assert.ok(budget.tier(R('UTRIUM_ACID')) < budget.tier(R('CATALYZED_UTRIUM_ACID')));
    assert.ok(budget.tier(R('UTRIUM_BAR')) < budget.tier(R('UTRIUM_HYDRIDE')), 'factory goods before compounds');
});

test('budget: floors are kept (reaction inputs, boost minerals), and a room within budget dumps nothing', () => {
    const only = clogged({ storageGoods: { [R('HYDROGEN')]: 12000, [R('OXYGEN')]: 700000 } });
    only.g.Memory.labJobs = { R: { p: R('HYDROXIDE'), a: R('HYDROGEN'), b: R('OXYGEN') } };
    // Oxygen is a reaction input (floor 30k) but there is plenty above it; hydrogen (12k) is below its floor.
    assert.equal(only.budget.pick(only.room).resource, R('OXYGEN'));
    const fine = clogged({ storageGoods: { [R('HYDROGEN')]: 100000 }, terminalGoods: {} });
    assert.equal(fine.budget.pick(fine.room), null);
});

test('lab worker dumps excess: withdraw a load of the cheapest excess, drop it, mark the pile', () => {
    const { g, creep, calls, h } = clogged();
    const lw = h.load('creep.labWorker');
    lw.run(creep);
    assert.deepEqual(plain(calls)[0], ['withdraw', 'storage', R('HYDROGEN'), 500]);
    creep.carry = { [R('HYDROGEN')]: 500 };
    calls.length = 0;
    lw.run(creep);
    assert.deepEqual(plain(calls), [['drop', R('HYDROGEN')]]);
    assert.equal(h.load('system.mineralBudget').isDumped('R', R('HYDROGEN')), true);
});

test('terminal overflow cleanup never puts the load back into the terminal it is clearing', () => {
    const { creep, calls, h } = clogged({ carry: { [R('OXYGEN')]: 500 } });
    creep.memory.cleaningOverflow = true;
    creep.memory.trimCheck = Infinity;   // isolate the overflow path
    h.load('creep.labWorker').run(creep);
    assert.ok(!calls.some(c => c[0] === 'transfer' && c[1] === 'terminal'), JSON.stringify(plain(calls)));
    assert.ok(calls.some(c => c[0] === 'drop'), 'storage full: dumped');
});

test('salvager: full storage -> terminal, nowhere -> drop goods; dumped piles are not salvage', () => {
    const { g, room, storage, terminal, h } = clogged();
    const piles = [{ id: 'p1', resourceType: R('HYDROGEN'), amount: 5000, pos: {} }];
    h.load('system.mineralBudget').markDumped('R', R('HYDROGEN'));
    const calls = [];
    const creep = { room, carry: { [R('OXYGEN')]: 400 }, carryCapacity: 1000, memory: {}, hits: 1000,
        pos: { findClosestByRange: (type, opts) => (type === g.FIND_DROPPED_RESOURCES ? piles.filter(opts.filter)[0] : undefined),
            isNearTo: () => true, findInRange: () => [] },
        transfer: (t, r) => { calls.push(['transfer', t.id, r]); return g.OK; },
        drop: r => { calls.push(['drop', r]); return g.OK; },
        travelTo: t => calls.push(['travelTo', t && t.id]), suicide: () => {} };
    h.load('creep.salvager').run(creep);
    assert.ok(calls.some(c => c[0] === 'transfer' && c[1] === 'terminal'), 'storage full: into the terminal ' + JSON.stringify(calls));
    assert.ok(!calls.some(c => c[1] === 'p1'), 'the dumped hydrogen pile is left alone');

    // Terminal full too (300k): nowhere to put it, so it is dumped.
    const full = clogged({ terminalGoods: { [R('OXYGEN')]: 300000 - 36763 } });
    full.budget.markDumped('R', R('HYDROGEN'));
    const dropped = [];
    const creep2 = Object.assign({}, creep, { room: full.room, memory: {},
        drop: r => { dropped.push(r); return g.OK; }, transfer: () => g.ERR_FULL });
    full.h.load('creep.salvager').run(creep2);
    assert.deepEqual(dropped, [R('OXYGEN')]);
});

test('reaction and boost labs are fed from the storage when the terminal lacks the mineral', () => {
    const { g, creep, calls, h, storage } = clogged({ storageGoods: { [R('ZYNTHIUM_OXIDE')]: 20000 }, terminalGoods: {} });
    const lab = { id: 'lab4', mineralType: undefined, mineralAmount: 0, mineralCapacity: 3000, store: {} };
    g.Game.getObjectById = id => ({ storage, lab4: lab })[id] || null;
    Object.assign(creep.memory, { lab4: 'lab4', mineral4: R('ZYNTHIUM_OXIDE'), lab5: 'XXX', lab6: 'XXX', trimCheck: Infinity });
    g.Memory.labJobs = { R: { p: R('ZYNTHIUM_ALKALIDE'), a: R('ZYNTHIUM_OXIDE'), b: R('HYDROXIDE') } };
    h.load('creep.labWorker').run(creep);
    assert.ok(calls.some(c => c[0] === 'withdraw' && c[1] === 'storage' && c[2] === R('ZYNTHIUM_OXIDE')), JSON.stringify(plain(calls)));
});
