const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

function storeOf(contents, capacity) {
    const store = Object.assign({}, contents);
    const used = () => Object.values(contents).reduce((a, b) => a + b, 0);
    Object.defineProperties(store, {
        getUsedCapacity: { value: type => type ? (contents[type] || 0) : used() },
        getFreeCapacity: { value: () => capacity - used() },
        getCapacity: { value: () => capacity },
    });
    return store;
}

function setup() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    const pos = (x, y, roomName = 'R') => ({ x, y, roomName,
        getRangeTo: o => { const p = o.pos || o; return Math.max(Math.abs(p.x - x), Math.abs(p.y - y)); },
        isNearTo(o) { return this.getRangeTo(o) <= 1; }, inRangeTo(o, r) { return this.getRangeTo(o) <= r; },
        findClosestByRange: list => list.slice().sort((a, b) => Math.max(Math.abs(a.pos.x - x), Math.abs(a.pos.y - y)) - Math.max(Math.abs(b.pos.x - x), Math.abs(b.pos.y - y)))[0],
        findInRange: () => [], lookFor: () => [] });
    return { h, g, pos, storeOf };
}

test('remote mules collect spilled energy and tombstones in their mining room before the container', () => {
    const { h, g, pos } = setup();
    const finds = {};
    const room = { name: 'R', find: type => finds[type] || [] };
    finds[g.FIND_DROPPED_RESOURCES] = [{ id: 'spill', resourceType: 'energy', amount: 600, pos: pos(11, 10) }, { id: 'crumb', resourceType: 'energy', amount: 50, pos: pos(20, 20) }];
    finds[g.FIND_TOMBSTONES] = [{ id: 'grave', store: { energy: 900 }, pos: pos(30, 30) }];
    g.Game.rooms.R = room;
    g.Game.flags.HFarMining = { pos: pos(10, 10) };
    const intents = [];
    const mule = { name: 'm', room, pos: pos(12, 10), ticksToLive: 1000, memory: { targetFlag: 'HFarMining', storing: false, homeRoom: 'H', deathWarn: 0 },
        store: storeOf({}, 1000), getActiveBodyparts: () => 20 };
    mule.store.getCapacity = () => 1000;
    for (const m of ['pickup', 'withdraw', 'travelTo', 'move']) mule[m] = (t, ...rest) => { intents.push([m, t && t.id]); return m === 'pickup' ? g.OK : g.ERR_NOT_IN_RANGE; };
    h.load('creep.farMule').run(mule, true);
    assert.deepEqual(plain(intents)[0], ['pickup', 'spill'], 'nearest worthwhile pile first; 50-energy crumbs ignored');
});

test('home haulers bank their load in their last ticks if they can reach storage', () => {
    const { h, g, pos, storeOf } = setup();
    const { depositBeforeDeath } = h.load('creep.logistics');
    const storage = { id: 'storage', pos: pos(25, 25, 'H'), store: storeOf({ energy: 100000 }, 1000000) };
    const room = { name: 'H', storage };
    const intents = [];
    const creep = (ttl, x, carried) => ({ room, ticksToLive: ttl, pos: pos(x, 25, 'H'), memory: { homeRoom: 'H' }, store: storeOf(carried, 1600),
        transfer: (t, r) => { intents.push(['transfer', t.id, r]); return g.ERR_NOT_IN_RANGE; }, travelTo: t => intents.push(['travelTo', t.id]) });

    assert.equal(depositBeforeDeath(creep(500, 20, { energy: 1600 })), false, 'plenty of life left');
    assert.equal(depositBeforeDeath(creep(20, 20, {})), false, 'nothing carried');
    assert.equal(depositBeforeDeath(creep(3, 10, { energy: 1600 })), false, 'too far to make it');
    assert.equal(depositBeforeDeath(creep(20, 20, { XGH2O: 400 })), true);
    assert.deepEqual(plain(intents), [['transfer', 'storage', 'XGH2O'], ['travelTo', 'storage']], 'minerals and power too, not just energy');
});

test('RCL8 rooms can get an on-demand salvager, which retires after 100 idle ticks', () => {
    const { h, g } = setup();
    const spawns = h.load('spawn.BuildCreeps5');
    const config = { muleMax: 1, upgraderMax: 1, repairMax: 1, upSupplierMax: 1, supplierMax: 1, distributorMax: 1, salvagerMax: 0 };
    spawns.configureLevel8Room(config, 'H', { store: { energy: 300000 } });
    assert.equal(config.salvagerMax, 1, 'allowed; hasSalvage() decides whether it is actually spawned');

    const salvager = h.load('creep.salvager');
    let died = false;
    const room = { name: 'H', controller: { pos: { x: 25, y: 25 } }, find: () => [] };
    const creep = { room, hits: 1000, ticksToLive: 1000, memory: { deathWarn: 0, priority: 'salvager' }, carry: {}, carryCapacity: 300,
        store: { getUsedCapacity: () => 0 }, pos: { isNearTo: () => true, findInRange: () => [], findClosestByRange: () => null },
        suicide: () => { died = true; }, travelTo() {}, move() {}, say() {} };
    g.Game.time = 100;
    salvager.run(creep);
    assert.equal(died, false);
    g.Game.time = 200;
    salvager.run(creep);
    assert.equal(died, true);
});
