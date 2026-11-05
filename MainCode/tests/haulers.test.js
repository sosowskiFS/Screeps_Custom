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

// A mule beside a spawn it is filling; another extension further on still needs energy.
function setup(energy) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    const structure = (id, type, free) => ({ id, structureType: type, hits: 1, hitsMax: 1,
        store: storeOf({ energy: 300 - free }, 300), energy: 300 - free, energyCapacity: 300 });
    const spawn = structure('spawn', g.STRUCTURE_SPAWN, 300);
    const extension = structure('ext', g.STRUCTURE_EXTENSION, 50);
    const storage = { id: 'storage', store: storeOf({ energy: 500000 }, 1000000) };
    const room = { name: 'R', storage, terminal: null, find: () => [spawn, extension] };
    g.Game.getObjectById = id => ({ spawn, ext: extension, storage })[id] || null;
    const calls = [];
    const creep = {
        name: 'm', room, ticksToLive: 1000, memory: { priority: 'mule', deathWarn: 0, structureTarget: 'spawn' },
        carry: { energy }, store: storeOf({ energy }, 300),
        pos: { isNearTo: t => t.id === 'spawn', findClosestByRange: list => list[0] },
        build: () => g.ERR_INVALID_TARGET,
        transfer: t => { calls.push(['transfer', t.id]); return t.id === 'spawn' ? g.OK : g.ERR_NOT_IN_RANGE; },
        travelTo: t => calls.push(['travelTo', t.id]),
    };
    return { calls, run: () => h.load('creep.mule').run(creep) };
}

test('a hauler that hands over the last of its energy turns back for more on the same tick', () => {
    const { calls, run } = setup(150);
    run();
    assert.deepEqual(plain(calls), [['transfer', 'spawn'], ['travelTo', 'storage']]);
});

test('with energy left after the transfer it carries on to the next sink', () => {
    const { calls, run } = setup(400);   // the spawn takes 300 of 400
    run();
    assert.deepEqual(plain(calls), [['transfer', 'spawn'], ['travelTo', 'ext']]);
});

// shardX W1N9: haulers took from the hub (storage) link only at 600+, the source links sent to it only
// under 400: it sat at 589, the source links filled up and the upgrade miner dropped its energy.
test('the hub link (the storage receiver) is the first energy pickup for home collectors, whatever it holds', () => {
    const { harness } = require('./harness');
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    const hub = { id: 'hub', structureType: g.STRUCTURE_LINK, store: { energy: 589 } };
    const room = { name: 'R', find: () => [] };
    g.Memory.linkRoles = { R: { up: 'ctrl', store: 'hub', senders: ['src1', 'src2'] } };
    g.Game.getObjectById = id => (id === 'hub' ? hub : null);
    const free = { n: 1000 };
    const creep = { room, memory: { homeRoom: 'R' }, store: { getFreeCapacity: () => free.n } };
    const logistics = h.load('creep.logistics');
    assert.equal(logistics.overflowSource(creep), hub, '589 in it: first');
    hub.store.energy = 50;
    assert.equal(logistics.overflowSource(creep), hub, 'any amount');
    hub.store.energy = 0;
    assert.equal(logistics.overflowSource(creep), null, 'empty: elsewhere');
    hub.store.energy = 500; free.n = 0;
    assert.equal(logistics.overflowSource(creep), null, 'a full creep takes nothing');
    g.Memory.linkRoles.R = { up: 'ctrl', store: null, senders: ['src1'] };
    assert.equal(logistics.overflowSource(creep), null, 'no storage receiver: none');
});

test('links by role: any sender to the upgrade receiver first, then the storage one, with room worth a transfer; a full sender sends less', () => {
    const { harness } = require('./harness');
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    const sent = [];
    const link = (id, energy) => ({ id, energy, cooldown: 0, store: { getFreeCapacity: () => 800 - L[id].energy, energy },
        transferEnergy: (t, n) => { sent.push(id + '>' + t.id + ':' + n); return g.OK; } });
    const L = {};
    const make = (id, e) => { L[id] = { energy: e }; Object.assign(L[id], link(id, e)); L[id].store[g.RESOURCE_ENERGY] = e; };
    g.Game.getObjectById = id => L[id];
    g.Memory.linkRoles = { R: { up: 'up', store: 'hub', senders: ['a', 'b'] } };
    const run = () => { sent.length = 0; return h.load('system.links').runLinks({ name: 'R', controller: { level: 7 } }); };
    // Upgrade link with room: both miner links send there (the second only what is left of its room).
    make('a', 800); make('b', 500); make('up', 0); make('hub', 600);
    run();
    assert.ok(sent.includes('a>up:800'), sent.join());
    assert.ok(!sent.some(x => x.startsWith('b>up')), 'nothing left in the upgrade link for b');
    // Upgrade link full: the storage receiver (with room enough).
    make('a', 800); make('b', 0); make('up', 800); make('hub', 0);
    run();
    assert.ok(sent.includes('a>hub:800'), sent.join());
    // Only 211 free (the hub at 589) and the sender full: a smaller load, so the miner does not drop.
    make('a', 800); make('up', 800); make('hub', 589);
    run();
    assert.ok(sent.includes('a>hub:211'), sent.join());
    // Not full and too little room anywhere: no transfer (not worth its cost).
    make('a', 500); make('up', 700); make('hub', 589);
    run();
    assert.deepEqual(sent, []);
});

// shardX E23N31: storage at 99.9-100.1k, terminal 1.9k, nothing to fill or build. The mule topped the
// terminal up from 50k of storage: it took the terminal's own energy (the terminal first under 100k)
// and put it back, over and over.
test('a mule with nothing to fill does not top the terminal up from a storage under 100k', () => {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    const storage = { id: 'storage', store: storeOf({ energy: 99907 }, 1000000) };
    const terminal = { id: 'terminal', store: storeOf({ energy: 1902 }, 300000) };
    const controller = { id: 'ctrl', my: true, level: 7 };
    const room = { name: 'R', storage, terminal, controller, find: () => [] };
    g.Game.getObjectById = id => ({ storage, terminal, ctrl: controller })[id] || null;
    const calls = [];
    const creep = {
        name: 'm', room, ticksToLive: 1000, memory: { priority: 'mule', deathWarn: 0, terminalID: 'terminal' },
        carry: { energy: 200 }, store: storeOf({ energy: 200 }, 200),
        pos: { findClosestByRange: () => null, findInRange: () => [] },
        build: () => g.ERR_INVALID_TARGET,
        transfer: t => { calls.push(['transfer', t.id]); return g.OK; },
        upgradeController: t => { calls.push(['upgrade', t.id]); return g.OK; },
        travelTo: t => calls.push(['travelTo', t.id]),
    };
    h.load('creep.mule').run(creep);
    assert.ok(!plain(calls).some(c => c[1] === 'terminal'), JSON.stringify(plain(calls)));
    // From a storage of 100k+ it does top the terminal up.
    storage.store.energy = 150000;
    calls.length = 0;
    creep.memory = { priority: 'mule', deathWarn: 0, terminalID: 'terminal' };
    g.Game.time++;
    h.load('creep.mule').run(creep);
    assert.deepEqual(plain(calls)[0], ['transfer', 'terminal']);
});
