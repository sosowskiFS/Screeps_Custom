const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

// shard2 with E32N39 sponsoring a quad target on shardX E29N36 (a claim attempt), plus one queued
// quad member at home.
function setup() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Memory.settings = Object.assign({}, g.Memory.settings, { shardX: true });
    g.Game.shard.name = 'shard2';
    g.console = { log: () => {} };
    g.Date = { now: () => 1000000 };
    const messages = {};
    g.InterShardMemory = { getLocal: () => messages[g.Game.shard.name] || '', setLocal: v => { messages[g.Game.shard.name] = v; },
        getRemote: s => messages[s] || '' };
    g.Game.rooms.E32N39 = { name: 'E32N39', energyCapacityAvailable: 12900, controller: { my: true, level: 8 }, find: () => [] };
    g.Memory.xs = { mode: 'claim', queue: {}, portals: { E30N40: 'E30N40' },
        targets: [{ r: 'E29N36', h: 'shard2:E32N39', e: 'E30N40', t: 369 }] };
    const sys = h.load('system.guardSquads');
    sys.state().targets['shardX:E29N36'] = { shard: 'shardX', room: 'E29N36', home: 'E32N39', corner: 'E30N40',
        distance: 369, samples: {}, desired: 2, squads: [{ id: 'shard2/E29N36/27', created: 1,
            slots: [0, 1, 2, 3].map(slot => ({ slot, phase: slot ? 'missing' : 'spawning', name: slot ? undefined : 'q0' })) }] };
    g.Game.creeps.q0 = { name: 'q0', room: g.Game.rooms.E32N39, memory: { priority: 'roomGuard', homeRoom: 'E32N39',
        destination: 'E29N36', guardTargetShard: 'shardX', guardSquad: 'shard2/E29N36/27', guardSlot: 0 }, body: [] };
    return { h, g, sys, messages };
}

test('scout mode keeps no shardX quad target: the squad is recalled and nothing more is spawned', () => {
    const s = setup();
    s.g.Memory.xs.mode = 'scout';
    s.sys.run();
    assert.equal(s.g.Game.creeps.q0.memory.guardRecall, 1, 'the member at home goes home, unboosts and recycles');
    assert.deepEqual(Object.keys(s.sys.state().targets), [], 'target dropped');
    assert.equal(s.sys.spawnOrder('E32N39'), null);
});

test('claim mode with the room still a target keeps the quad target', () => {
    const s = setup();
    s.sys.run();
    assert.ok(s.sys.state().targets['shardX:E29N36']);
    assert.equal(s.g.Game.creeps.q0.memory.guardRecall, undefined);
});

test("shardX('reset') works while switched off: no mode, targets, orders or quad targets; map data kept", () => {
    const s = setup();
    delete s.g.Memory.settings.shardX;   // switched off
    s.g.Memory.xs.queue = { E32N39: { kind: 'helper', memory: {} } };
    s.g.Memory.xs.travellers = { a: { m: {}, t: 1 } };
    const x = s.h.load('system.shardX');
    assert.match(x.command('reset'), /reset on shard2/);
    const xs = plain(s.g.Memory.xs);
    assert.equal(xs.mode, undefined);
    assert.equal(xs.targets, undefined);
    assert.equal(xs.travellers, undefined);
    assert.deepEqual(xs.queue, {});
    assert.deepEqual(xs.portals, { E30N40: 'E30N40' }, 'scouted portals kept');
    assert.deepEqual(Object.keys(s.sys.state().targets), []);
    assert.equal(s.g.Game.creeps.q0.memory.guardRecall, 1);
    // Switched back on in scout mode afterwards: still no quads.
    s.g.Memory.settings.shardX = true;
    assert.match(x.command('scout'), /scouting/);
    s.sys.run();
    assert.equal(s.sys.spawnOrder('E32N39'), null);
    assert.deepEqual(Object.keys(s.sys.state().targets), []);
});

test('an attacked-room latch is dropped once the room is no longer ours', () => {
    const s = setup();
    s.g.Game.shard.name = 'shardX';
    s.sys.state().rooms.E29N36 = { since: 1, reason: 'safe mode observed' };
    s.sys.state().rooms.MINE = { since: 1, reason: 'safe mode observed' };
    s.g.Game.rooms.MINE = { name: 'MINE', controller: { my: true, level: 3 }, find: () => [] };
    s.sys.run();
    assert.equal(s.sys.escalated('shardX', 'E29N36'), false);
    assert.equal(s.sys.escalated('shardX', 'MINE'), true);
});
