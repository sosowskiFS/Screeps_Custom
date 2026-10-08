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

function load() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    g.EVENT_HARVEST = 5;
    g.Game.shard = { name: 'shard1' };
    g.Game.time = 1000;
    return { h, g, retire: h.load('system.retire') };
}

// shard1 as seen live: 4 H rooms, 2 O, one each of Z U K L X.
const SHARD1 = [['W35S28', 'H'], ['E28N48', 'O'], ['E32N46', 'H'], ['E36N43', 'O'], ['E38N46', 'Z'], ['E38N44', 'U'],
    ['E44N41', 'H'], ['E19N59', 'K'], ['E21N58', 'L'], ['E24N58', 'X'], ['E28N56', 'H']];

test('shard1: keeping 7 retires only duplicate-mineral rooms, the worst ones, and keeps all 7 base minerals', () => {
    const { retire } = load();
    // Single-mineral rooms are the worst performers here: they must still be kept.
    const rooms = SHARD1.map(([room, mineral], i) => ({ room, mineral, eff: ['Z', 'U', 'K', 'L', 'X'].includes(mineral) ? i : 100 + i }));
    const out = retire.choose(rooms, 7);
    assert.deepEqual(plain(out).sort(), ['E28N48', 'E32N46', 'E44N41', 'W35S28'], 'the 3 worst H rooms and the worse O room');
    const kept = rooms.filter(r => !out.includes(r.room));
    assert.equal(kept.length, 7);
    assert.deepEqual(plain(retire.missingMinerals(kept)), []);
});

test('rooms without data and protected rooms are never retired; it stops at the keep count', () => {
    const { retire } = load();
    const rooms = [{ room: 'A', mineral: 'H', eff: null }, { room: 'B', mineral: 'H', eff: 1 }, { room: 'C', mineral: 'H', eff: 2 },
        { room: 'D', mineral: 'H', eff: 3 }];
    assert.deepEqual(plain(retire.choose(rooms, 2)), ['B', 'C']);
    assert.deepEqual(plain(retire.choose(rooms, 2, ['B'])), ['C', 'D']);
    assert.deepEqual(plain(retire.choose(rooms, 10)), []);
});

test('measurement credits source harvests to the harvester\'s home room, remote rooms included; minerals do not count', () => {
    const { g, retire } = load();
    const room = (name, log, mine) => ({ name, controller: { my: mine }, getEventLog: () => log,
        find: type => (type === g.FIND_MY_SPAWNS && mine ? [{}] : []) });
    g.Game.rooms = {
        HOME: room('HOME', [{ event: 5, objectId: 'm1', data: { targetId: 'src1', amount: 10 } },
            { event: 5, objectId: 'mm', data: { targetId: 'min', amount: 5 } }], true),
        REMOTE: room('REMOTE', [{ event: 5, objectId: 'fm', data: { targetId: 'src2', amount: 12 } }], false),
    };
    const objects = { src1: {}, src2: {}, min: { mineralType: 'H' }, m1: { memory: { homeRoom: 'HOME' } },
        mm: { memory: { homeRoom: 'HOME' } }, fm: { memory: { homeRoom: 'HOME' } } };
    g.Game.getObjectById = id => objects[id] || null;
    g.Memory.roomCPU = { HOME: { a: 2, n: 500, l: 1 } };
    retire.sample();
    assert.equal(g.Memory.retire.e.HOME, 22, 'local source + remote source, not the mineral');
    assert.equal(g.Memory.retire.c.HOME, 2);
    assert.equal(g.Memory.retire.n, 1);
    g.Game.time += 3;   // between samples: nothing recorded
    retire.sample();
    assert.equal(g.Memory.retire.n, 1);
});

test('draining: goods ship first; energy only once storage and factory hold no more goods', () => {
    const { g, retire } = load();
    const sends = [];
    const terminal = (contents, my = true) => ({ my, cooldown: 0, store: storeOf(contents, 300000),
        send: (r, a, to) => { sends.push([r, a, to]); return g.OK; } });
    const kept = { name: 'KEEP', controller: { my: true }, terminal: terminal({}), find: t => (t === g.FIND_MY_SPAWNS ? [{}] : []) };
    const old = { name: 'OLD', controller: { my: true }, terminal: terminal({ energy: 50000, H: 30000 }),
        storage: { store: storeOf({ energy: 1000, O: 500 }, 1000000) }, find: t => (t === g.FIND_MY_SPAWNS ? [{}] : []) };
    g.Game.rooms = { KEEP: kept, OLD: old };
    g.Game.map.getRoomLinearDistance = () => 3;
    g.Game.market.calcTransactionCost = amount => Math.ceil(amount * 0.1);
    g.Memory.retire = { start: 0, n: 0, e: {}, c: {}, rooms: { OLD: { st: 'drain', t: 0 } } };
    assert.equal(retire.drainTerminal(old), true);
    assert.deepEqual(sends.pop(), ['H', 30000, 'KEEP']);
    old.terminal.store.H = 0;
    assert.equal(retire.drainTerminal(old), false, 'O still in storage: keep the energy for it');
    old.storage.store.O = 0;
    assert.equal(retire.drainTerminal(old), true);
    const [resource, amount] = sends.pop();
    assert.equal(resource, 'energy');
    assert.ok(amount + Math.ceil(amount * 0.1) <= 50000, 'leaves enough for the transfer cost');
});

test('retireRooms(\'confirm\') refuses to start before the measurement is complete', () => {
    const { g, retire } = load();
    g.Game.rooms = {};
    g.console = { log: () => {} };
    g.Memory.retire = { start: g.Game.time - 10, n: 1, e: {}, c: {}, rooms: {} };
    retire.report('confirm');
    assert.deepEqual(plain(g.Memory.retire.rooms), {});
});

test('unclaiming a retired room unassigns its operator so it can be given another room', () => {
    const { g, retire } = load();
    g.Game.market.orders = {};
    g.Game.creeps = {};
    g.Game.flags = {};
    g.Memory.retire = { start: 0, n: 0, e: {}, c: {}, rooms: { OLD: { st: 'drain', t: 0 } } };
    g.Memory.powerCreeps = { op: { homeRoom: 'OLD', priority: 'baseOp' }, other: { homeRoom: 'KEEP' } };
    const room = { name: 'OLD', controller: { unclaim: () => g.OK } };
    assert.equal(retire.finish(room), true);
    assert.equal(g.Memory.powerCreeps.op.homeRoom, undefined);
    assert.equal(g.Memory.powerCreeps.other.homeRoom, 'KEEP');
});

test('retireRooms(\'now\') unclaims every draining room at once', () => {
    const { g, retire } = load();
    g.Game.market.orders = {};
    g.Game.creeps = {};
    g.Game.flags = {};
    g.console = { log: () => {} };
    const unclaimed = [];
    const room = name => ({ name, controller: { my: true, unclaim: () => { unclaimed.push(name); return g.OK; } },
        find: () => [], storage: { store: { getUsedCapacity: () => 1000 } } });
    g.Game.rooms = { A: room('A'), B: room('B'), KEEP: room('KEEP') };
    g.Memory.retire = { start: 0, n: 500, e: {}, c: {}, rooms: { A: { st: 'drain', t: 0 }, B: { st: 'drain', t: 0 }, OLD: { st: 'done', t: 0 } } };
    assert.equal(retire.report('now'), '2 rooms unclaimed');
    assert.deepEqual(unclaimed, ['A', 'B']);
    assert.equal(g.Memory.retire.rooms.A.st, 'done');
});
