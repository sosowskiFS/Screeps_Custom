const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

function setup() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    const finds = {};
    const room = { name: 'A', find: type => finds[type] || [] };
    return { h, g, room, finds, spawns: h.load('spawn.BuildCreeps5') };
}

test('a second mule is staffed only while there is something to build', () => {
    const { g, room, finds, spawns } = setup();
    const storage = { room, store: { energy: 300000 } };
    let config = { muleMax: 1, upgraderMax: 2, repairMax: 1 };
    spawns.configureStorageRoom(config, storage);
    assert.equal(config.muleMax, 1, 'no construction: no second mule');
    assert.equal(config.upgraderMax, 4, 'upgrader tiers unchanged');

    g.Game.time++;
    finds[g.FIND_CONSTRUCTION_SITES] = [{ id: 'site' }];
    config = { muleMax: 1, upgraderMax: 2, repairMax: 1 };
    spawns.configureStorageRoom(config, storage);
    assert.equal(config.muleMax, 2, 'building: second mule');
});

test('salvagers spawn only when there is something to salvage', () => {
    const { g, room, finds, spawns } = setup();
    assert.equal(spawns.hasSalvage(room), false, 'clean room');

    finds[g.FIND_DROPPED_RESOURCES] = [{ amount: 400 }, { amount: 700 }];
    g.Game.time++;
    assert.equal(spawns.hasSalvage(room), true, 'over 1000 dropped');

    const quiet = setup();
    quiet.finds[quiet.g.FIND_TOMBSTONES] = [{ store: { getUsedCapacity: () => 250 } }];
    assert.equal(quiet.spawns.hasSalvage(quiet.room), true, 'a loaded tombstone');

    const prepping = setup();
    prepping.g.Memory.roomsPrepSalvager = ['A'];
    assert.equal(prepping.spawns.hasSalvage(prepping.room), true, 'weak attack: drops are coming');
});

test('supplier and distributor bodies scale with room energy at 2 CARRY per MOVE', () => {
    const { g, spawns } = setup();
    const count = (body, part) => body.filter(p => p === part).length;
    const small = spawns.supplierBody(300);
    assert.deepEqual([count(small, g.CARRY), count(small, g.MOVE)], [4, 2]);
    const big = spawns.supplierBody(12900);
    assert.deepEqual([count(big, g.CARRY), count(big, g.MOVE)], [8, 4], 'capped at 400 capacity');
    const dist = spawns.distributorBody(12900);
    assert.deepEqual([count(dist, g.CARRY), count(dist, g.MOVE)], [32, 16]);
    assert.ok(dist.length <= 50);
});

test('operator rooms with a full storage staff 3 full-size repairers instead of 4', () => {
    const { g, spawns } = setup();
    g.Game.rooms.A = { name: 'A', find: () => [] };
    g.Game.powerCreeps = { op: { room: { name: 'A' }, memory: { homeRoom: 'A' }, ticksToLive: 3000,
        powers: { PWR_OPERATE_EXTENSION: { level: 5 } } } };
    const config = { muleMax: 1, upgraderMax: 1, repairMax: 1, upSupplierMax: 1, supplierMax: 1, distributorMax: 1 };
    spawns.configurePowerCreepRoom(config, 'A', { store: { energy: 800000 } });
    assert.equal(config.repairMax, 3);
});

// Tower supplier during base migration: the spawn beside the Supply flag may be gone (moved) or
// not built yet; the room must still get a supplier.
function supplyRoom({ spawnTiles, flag = [25, 25], autoBuild = true }) {
    const { h, g, spawns } = setup();
    const near = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) <= 1;
    const mk = ([x, y], id) => ({ id, structureType: g.STRUCTURE_SPAWN, isActive: () => true, pos: { x, y,
        isNearTo: o => near([x, y], [o.pos ? o.pos.x : o.x, o.pos ? o.pos.y : o.y]),
        getDirectionTo: () => g.TOP } });
    const list = spawnTiles.map((t, n) => mk(t, 's' + n));
    const room = { name: 'A', find: () => list };
    g.Game.rooms.A = room;
    if (flag) g.Game.flags.ASupply = { pos: { x: flag[0], y: flag[1], isNearTo: o => near(flag, [o.pos.x, o.pos.y]) } };
    g.Memory.autoBuildRooms = autoBuild ? ['A'] : [];
    return { g, room, list, spawns };
}

test('supplier: the Supply spawn makes it while it exists; otherwise any spawn does', () => {
    // Settled layout: only the spawn beside the flag, straight onto it.
    let r = supplyRoom({ spawnTiles: [[25, 24], [10, 10], [12, 12]] });
    assert.deepEqual([...r.spawns.supplierDirections(r.room, r.list[0]).supplierDirection], [r.g.TOP]);
    assert.equal(r.spawns.supplierDirections(r.room, r.list[0]).buildDirections.includes(r.g.TOP), false, 'kept clear for it');
    assert.equal(r.spawns.supplierDirections(r.room, r.list[1]).supplierDirection.length, 0);

    // Mid-migration: none of the 3 spawns touches the Supply flag (old one moved, new not built).
    r = supplyRoom({ spawnTiles: [[10, 10], [12, 12], [40, 40]] });
    for (const spawn of r.list) assert.equal(r.spawns.supplierDirections(r.room, spawn).supplierDirection.length, 8);

    // No Supply flag at all: still a supplier.
    r = supplyRoom({ spawnTiles: [[10, 10]], flag: null });
    assert.equal(r.spawns.supplierDirections(r.room, r.list[0]).supplierDirection.length, 8);
});

test('supplier role: fills towers on foot while its Supply tile is blocked, follows the flag when it moves', () => {
    const { h, g } = setup();
    const calls = [];
    const blocked = { value: true };
    const flagPos = { x: 25, y: 25, lookFor: () => (blocked.value ? [{ structureType: g.STRUCTURE_EXTENSION }] : []) };
    g.Game.flags.ASupply = { pos: flagPos };
    const tower = { id: 'tower' };
    g.Game.getObjectById = id => ({ tower })[id];
    g.Memory.towerNeedEnergy = { A: ['tower'] };
    const creep = { room: { name: 'A', storage: { id: 'storage' } }, pos: { x: 10, y: 10 }, memory: { priority: 'supplier', deathWarn: 0 },
        ticksToLive: 1000, body: [], carry: { energy: 100 },
        travelTo: t => calls.push(['travelTo', t.id || 'flag']),
        transfer: (t) => { calls.push(['transfer', t.id]); return g.OK; },
        withdraw: (t) => { calls.push(['withdraw', t.id]); return g.OK; } };
    const supplier = h.load('creep.supplier');
    supplier.run(creep);
    assert.deepEqual(calls, [['transfer', 'tower']], 'tile blocked: feeds the tower instead of walking at it');

    // Tile cleared (migration moved the old structure): it walks to it and settles there.
    calls.length = 0;
    blocked.value = false;
    g.Game.time += 60;
    supplier.run(creep);
    assert.deepEqual(calls, [['travelTo', 'flag']]);
    creep.pos = { x: 25, y: 25 };
    calls.length = 0;
    supplier.run(creep);
    assert.deepEqual(calls, [['transfer', 'tower']]);

    // Flag moved to the new core: it goes again.
    flagPos.x = 30;
    calls.length = 0;
    supplier.run(creep);
    assert.deepEqual(calls, [['travelTo', 'flag']]);
});
