const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

// Two lab rooms with 6 labs each; `stores` gives each room's terminal contents.
function world(stores) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    const objects = {};
    for (const [name, contents] of Object.entries(stores)) {
        const store = Object.assign({}, contents);
        Object.defineProperty(store, 'getFreeCapacity', { value: () => 300000 - Object.values(contents).reduce((a, b) => a + b, 0) });
        g.Game.rooms[name] = { name, controller: { my: true, level: 8 }, terminal: { store } };
        g.Memory.labList[name] = [1, 2, 3, 4, 5, 6].map(i => name + 'lab' + i);
        for (const id of g.Memory.labList[name]) objects[id] = { id, mineralType: undefined, mineralAmount: 0 };
    }
    g.Game.getObjectById = id => objects[id];
    return { h, g, labs: h.load('system.labs'), objects };
}
const R = name => 'RESOURCE_' + name;

test('planner walks recipe trees and gives each room a reaction it can run, preferring local reagents', () => {
    const { g, labs } = world({
        A: { [R('HYDROGEN')]: 10000, [R('OXYGEN')]: 10000 },
        B: { [R('LEMERGIUM')]: 10000, [R('HYDROGEN')]: 10000, [R('CATALYST')]: 10000 },
    });
    const jobs = plain(labs.plan());
    assert.deepEqual(jobs.A, { p: R('HYDROXIDE'), a: R('HYDROGEN'), b: R('OXYGEN'), since: 1 }, 'OH feeds every acid/alkalide');
    assert.equal(jobs.B.p, R('LEMERGIUM_HYDRIDE'), 'B already holds L and H: makes LH towards XLH2O');

    // Next plan keeps the same reactions (no lab flush), even though OH is still first in line.
    g.Game.time = 100;
    assert.deepEqual(plain(labs.plan()), jobs);
});

test('intermediates on hand move production up the chain; met targets free the labs', () => {
    const { g, labs } = world({
        A: { [R('LEMERGIUM_HYDRIDE')]: 6000, [R('HYDROXIDE')]: 6000 },
        B: { [R('LEMERGIUM_ACID')]: 6000, [R('CATALYST')]: 6000 },
    });
    let jobs = plain(labs.plan());
    assert.equal(jobs.A.p, R('LEMERGIUM_ACID'));
    assert.equal(jobs.B.p, R('CATALYZED_LEMERGIUM_ACID'));

    // Every target met twice over: nothing to make, nothing to make for sale either.
    for (const res of Object.keys(labs.TARGET_PER_ROOM)) g.Game.rooms.A.terminal.store[res] = labs.TARGET_PER_ROOM[res] * 2 * 2;
    g.Game.time = 100;
    jobs = plain(labs.plan());
    assert.deepEqual(jobs, {});
    assert.ok(labs.surplus(R('CATALYZED_LEMERGIUM_ACID')) > 0, 'the excess above 1.5x target is for sale');
});

test('a room keeps finishing a loaded batch after the empire runs out, and overrides pin a reaction', () => {
    const { g, labs, objects } = world({ A: { [R('HYDROGEN')]: 5000, [R('OXYGEN')]: 5000 }, B: {} });
    assert.equal(plain(labs.plan()).A.p, R('HYDROXIDE'));
    // Terminal emptied into the labs: no longer a candidate, but the labs still hold a batch.
    g.Game.rooms.A.terminal.store[R('HYDROGEN')] = 0;
    g.Game.rooms.A.terminal.store[R('OXYGEN')] = 0;
    Object.assign(objects.Alab4, { mineralType: R('HYDROGEN'), mineralAmount: 500 });
    Object.assign(objects.Alab5, { mineralType: R('OXYGEN'), mineralAmount: 500 });
    g.Game.time = 100;
    assert.equal(plain(labs.plan()).A.p, R('HYDROXIDE'));

    g.Memory.labOverride = { B: R('GHODIUM') };
    g.Game.time = 200;
    assert.deepEqual(plain(labs.plan()).B, { p: R('GHODIUM'), a: R('ZYNTHIUM_KEANITE'), b: R('UTRIUM_LEMERGITE'), since: 200 });
});

test('lab reactions follow the plan; terminal logistics request its reagents and drop stale requests', () => {
    const { h, g } = world({ A: {} });
    g.Memory.labJobs = { A: { p: R('HYDROXIDE'), a: R('HYDROGEN'), b: R('OXYGEN') } };
    g.Memory.mineralNeed[R('CATALYST')] = ['A'];
    const terminal = g.Game.rooms.A.terminal;
    terminal.store.energy = 0;
    h.load('market.FindBuyers').run(Object.assign(g.Game.rooms.A, { controller: { level: 5 } }), terminal, []);
    assert.deepEqual(plain(g.Memory.mineralNeed[R('HYDROGEN')]), ['A']);
    assert.deepEqual(plain(g.Memory.mineralNeed[R('OXYGEN')]), ['A']);
    assert.deepEqual(plain(g.Memory.mineralNeed[R('CATALYST')]), [], 'previous reaction\'s reagent no longer requested');
});
