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
