const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

// Several spawns in one room run their census on the same tick. A creep ordered by the first
// is not in Game.creeps until next tick, so every census must count it anyway.
function setup() {
    const h = harness(), g = h.context;
    const orders = [];
    g.StructureSpawn = class {
        spawnCreep(body, name, opts) { orders.push({ spawn: this.name, name, memory: opts && opts.memory }); return g.OK; }
    };
    h.load('runtime.memory').ensureInitialized();
    h.load('spawn.state');   // installs the spawn-order tracking
    g.BODYPART_COST = { move: 50, carry: 50, work: 100, attack: 80, ranged_attack: 150, heal: 250, claim: 600, tough: 10 };
    g.CARRY_CAPACITY = 50;
    g.isSpawnBusy = () => false;
    g.setSpawnBusy = () => {};
    g.RESOURCE_ENERGY = 'energy';
    const room = { name: 'H', energyCapacityAvailable: 12900, controller: { my: true, level: 8 },
        storage: { id: 'storage', store: { energy: 200000 } }, find: () => [] };
    g.Game.rooms.H = room;
    const spawns = ['S1', 'S2', 'S3'].map(name => Object.assign(new g.StructureSpawn(), { name, id: name, room, spawning: null,
        pos: { x: 25, y: 25, roomName: 'H', isNearTo: () => false } }));
    g.Memory.CurrentRoomEnergy = [1000000];
    return { h, g, room, spawns, orders };
}

test('three spawns on one tick order one remote miner for one source, not three', () => {
    const { h, g, room, spawns, orders } = setup();
    g.Game.flags.HFarMining = { name: 'HFarMining', pos: { x: 10, y: 10, roomName: 'R1' } };
    const far = h.load('spawn.BuildFarCreeps');
    for (const spawn of spawns) far.run(spawn, room, 0);
    const roles = orders.map(o => o.memory.priority);
    assert.equal(roles.filter(r => r === 'farMiner').length, 1, JSON.stringify(roles));
    assert.ok(roles.filter(r => r === 'farMule').length <= 1, JSON.stringify(roles));
});

test('special spawn commands (power units, scouts) count creeps ordered earlier this tick', () => {
    const { h, g, spawns, orders } = setup();
    const cache = h.load('runtime.cache');
    spawns[0].spawnCreep([], 'powerA_1', { memory: { priority: 'powerAttack', homeRoom: 'H' } });
    assert.equal(cache.homeCreeps('H').filter(c => c.memory.priority === 'powerAttack').length, 1);
    const roles = h.load('system.spawning').buildSpawnRoleCache();
    assert.equal(roles.roleByRoom.H.powerAttack, 1, 'per-role counts used by the power spawn check');
    spawns[1].spawnCreep([], 'dry', { memory: { priority: 'x', homeRoom: 'H' }, dryRun: true });
    assert.equal(cache.pendingCreeps().length, 1, 'dry runs are not orders');

    g.Game.time++;
    assert.equal(cache.pendingCreeps().length, 0, 'next tick the real creep is in Game.creeps instead');
    assert.equal(orders.length, 2);
});

test('spawned creeps get opaque names: no role, no spawn, unique; dry runs untouched', () => {
    const { h, g, spawns, orders } = setup();
    for (let i = 0; i < 200; i++) spawns[i % 3].spawnCreep([], 'harasser_' + spawns[i % 3].name + '_' + g.Game.time, { memory: { priority: 'harasser', homeRoom: 'H' } });
    const names = orders.map(o => o.name);
    assert.equal(new Set(names).size, 200, 'unique, even many per tick');
    for (const name of names) {
        assert.match(name, /^[a-z0-9]{8}$/);
        assert.ok(!/harasser|S1|S2|S3/.test(name));
    }
    assert.equal(orders[0].memory.priority, 'harasser', 'the role is still in memory');
    // A name in use (alive or with memory left) is never handed out again: force the generator
    // onto a taken name first and check it moves on.
    g.Memory.creeps.aaaaaaaa = { priority: 'old' };
    const SandboxMath = require('node:vm').runInContext('Math', g);
    const realRandom = SandboxMath.random;
    let calls = 0;
    SandboxMath.random = () => (calls++ < 8 ? 0 : realRandom());   // first try: 'aaaaaaaa'
    assert.notEqual(h.load('spawn.state').opaqueName(), 'aaaaaaaa');
    SandboxMath.random = realRandom;
    orders.length = 0;
    spawns[0].spawnCreep([], 'probe', { dryRun: true });
    assert.equal(orders[0].name, 'probe', 'dry runs keep their name');
});
