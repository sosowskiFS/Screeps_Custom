const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

const COST = { MOVE: 50, WORK: 100, CARRY: 50, move: 50, work: 100, carry: 50 };

function load() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.BODYPART_COST = COST;
    return { h, g, build: h.load('spawn.BuildCreeps') };
}

test('harvester bodies never cost more than the energy they are sized for (they used to cost 50 more)', () => {
    const { build } = load();
    const cost = body => body.reduce((n, p) => n + COST[p], 0);
    for (let energy = 200; energy <= 1300; energy += 50) {
        const body = build.getMinerConfig(energy, 5, 0);
        assert.ok(cost(body) <= energy, energy + ': ' + body.join(',') + ' costs ' + cost(body));
    }
    assert.deepEqual(plain(build.getMinerConfig(400, 5, 0)), ['work', 'work', 'work', 'carry', 'move'], '400 exactly (it used to ask for 450)');
});

test('a young room with only visiting helpers and 400 energy spawns its harvester (shardX E29N36)', () => {
    const { g, build } = load();
    const spawned = [];
    g.Memory.sourceList = { NEW: ['s1', 's2'] };
    g.Memory.CurrentRoomEnergy = ['NEW', 400];
    g.Memory.autoBuildRooms = [];
    g.setSpawnBusy = () => {};
    const room = { name: 'NEW', energyAvailable: 400, energyCapacityAvailable: 400, controller: { level: 2 }, find: () => [] };
    const spawn = { name: 'S', pos: { isNearTo: () => false },
        spawnCreep: (body, name, opts) => { spawned.push([body.reduce((n, p) => n + COST[p], 0), opts.memory.priority]); return g.OK; } };
    // The room's creeps: two helpers and a guard from elsewhere, none of its own.
    const visitors = [{ memory: { priority: 'helper', homeRoom: 'E32N39' } }, { memory: { priority: 'helper', homeRoom: 'E32N39' } },
        { memory: { priority: 'roomGuard', homeRoom: 'E32N39' } }];
    build.run(spawn, [], room, visitors, 1);
    assert.equal(spawned.length, 1);
    assert.equal(spawned[0][1], 'harvester');
    assert.ok(spawned[0][0] <= 400, 'within the 400 on hand');
});

test('with less energy on hand than full capacity, it spawns a smaller body now instead of waiting', () => {
    const { g, build } = load();
    const spawned = [];
    g.Memory.sourceList = { NEW: ['s1', 's2'] };
    g.Memory.CurrentRoomEnergy = ['NEW', 250];
    g.Memory.autoBuildRooms = [];
    g.setSpawnBusy = () => {};
    const room = { name: 'NEW', energyAvailable: 250, energyCapacityAvailable: 550, controller: { level: 2 }, find: () => [] };
    const spawn = { name: 'S', pos: { isNearTo: () => false },
        spawnCreep: (body) => { spawned.push(body.reduce((n, p) => n + COST[p], 0)); return g.OK; } };
    build.run(spawn, [], room, [{ memory: { priority: 'harvester', homeRoom: 'NEW', sourceLocation: 's1' } }], 1);
    assert.equal(spawned.length, 1, 'not waiting for the 550 capacity');
    assert.ok(spawned[0] <= 250);
});
