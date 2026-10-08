const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

function load() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.CREEP_LIFE_TIME = 1500;
    g.console = { log: () => {} };
    return { h, g, guard: h.load('creep.roomGuard') };
}

test('the replacement is due when the guard has less life left than spawn time + trip + margin', () => {
    const { guard } = load();
    assert.equal(guard.leadTime(22, 300), 22 * 3 + 300 + 50);
    assert.equal(guard.leadTime(22, undefined, 4), 22 * 3 + 250 + 50, 'no trip measured yet: 50 per room + 50');
    assert.equal(guard.covered([500], 416), true);
    assert.equal(guard.covered([400], 416), false, 'dies before a replacement could arrive');
    assert.equal(guard.covered([400, Infinity], 416), true, 'replacement already spawning');
});

function expansionSetup(guards) {
    const { h, g } = load();
    g.Game.rooms = { E10N10: { name: 'E10N10', energyCapacityAvailable: 2300 } };
    g.Game.creeps = {};
    guards.forEach((ttl, i) => { g.Game.creeps['g' + i] = { memory: { priority: 'roomGuard', destination: 'E14N10' }, ticksToLive: ttl }; });
    g.Memory.expansion = { t: 'E14N10', sp: 'E10N10', st: 'develop', since: 1, bad: {}, guardTrip: 300 };
    return h.load('system.expansion');
}

test('expansion: a guard is the sponsor\'s first order, and is re-ordered before the last one dies', () => {
    assert.equal(expansionSetup([]).spawnOrder('E10N10').type, 'roomGuard', 'none yet');
    assert.equal(expansionSetup([1200]).spawnOrder('E10N10').type, 'helper', 'covered: builders next');
    assert.equal(expansionSetup([400]).spawnOrder('E10N10').type, 'roomGuard', '400 left < 22x3 + 300 + 50: next one now');
});

test('a guard records its trip on arrival and parks near the controller', () => {
    const { h, g } = load();
    const calls = [];
    g.Memory.expansion = { t: 'NEW' };
    const controller = { pos: { x: 25, y: 25 } };
    const creep = { memory: { priority: 'roomGuard', destination: 'NEW' }, ticksToLive: 1180, hits: 100, hitsMax: 100,
        room: { name: 'NEW', controller, find: () => [] }, pos: { inRangeTo: () => false },
        travelTo: (t, o) => calls.push(['travelTo', o.range]), getActiveBodyparts: () => 1 };
    g.Game.rooms = { NEW: creep.room };
    h.load('creep.roomGuard').run(creep);
    assert.equal(creep.memory.trip, 320);
    assert.equal(g.Memory.expansion.guardTrip, 320);
    assert.deepEqual(plain(calls), [['travelTo', 3]]);
});

test('shardX: the home shard re-orders a guard from shardX\'s report before the last one dies', () => {
    const { h, g } = load();
    g.Game.shard = { name: 'shard2' };
    g.Game.time = 5025;
    const owned = { name: 'E32N39', energyCapacityAvailable: 2300, controller: { my: true }, storage: {}, find: t => (t === g.FIND_MY_SPAWNS ? [{}] : []) };
    g.Game.rooms = { E32N39: owned };
    g.Game.creeps = {};
    const remote = { shardX: { progress: { E29N36: { cl: 1, hp: 4, gd: 300, gt: 400 } } } };
    g.InterShardMemory = { getLocal: () => '', setLocal: () => {}, getRemote: s => (remote[s] ? JSON.stringify({ xs: remote[s] }) : null) };
    g.Memory.xs = { mode: 'claim', targets: [{ r: 'E29N36', h: 'shard2:E32N39', e: 'E30N40', t: 369 }] };
    h.load('system.shardX').run();
    assert.equal(g.Memory.xs.queue.E32N39.kind, 'roomGuard', '300 left < 22x3 + 400 + 50');
});
