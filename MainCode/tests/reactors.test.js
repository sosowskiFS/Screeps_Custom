const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

// Seasonal World: home W24N8 (RCL5, 1350 capacity); the reactors in W25N5 and W25N15.
function world({ shard = 'shardSeason', capacity = 1350, energy = 1350 } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Game.shard = { name: shard };
    g.BODYPART_COST = { claim: 600, move: 50, CLAIM: 600, MOVE: 50 };
    g.Game.time = 10000;
    g.Game.notify = () => {};
    g.console = { log: () => {} };
    const coords = name => { const m = /^([WE])(\d+)([NS])(\d+)$/.exec(name); return [(m[1] === 'W' ? -1 : 1) * +m[2], (m[3] === 'N' ? -1 : 1) * +m[4]]; };
    const distance = (a, b) => { const [ax, ay] = coords(a), [bx, by] = coords(b); return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); };
    g.Game.map = { getRoomLinearDistance: distance, findRoute: (a, b) => new Array(distance(a, b)).fill({}) };
    const home = { name: 'W24N8', energyCapacityAvailable: capacity, controller: { my: true }, find: t => (t === g.FIND_MY_SPAWNS ? [{}] : []) };
    g.Game.rooms = { W24N8: home };
    g.Game.creeps = {};
    g.Memory.CurrentRoomEnergy = ['W24N8', energy];
    g.setSpawnBusy = () => {};
    const orders = [];
    const spawn = { name: 'Spawn1', spawnCreep: (body, name, opts) => { orders.push({ body: body.join(), memory: opts.memory }); return g.OK; } };
    return { h, g, home, spawn, orders, reactors: h.load('system.reactors') };
}

test('a claimer goes out to each reactor, at most every 2000 ticks, from the home in reach', () => {
    const { g, home, spawn, orders, reactors } = world();
    assert.equal(reactors.spawn(spawn, home, 1), true);
    assert.equal(orders[0].body, 'claim,move', 'one CLAIM, one MOVE (650)');
    assert.equal(orders[0].memory.priority, 'reactorClaimer');
    assert.equal(orders[0].memory.destination, 'W25N5', 'the nearer one first');
    // The other on the next free spawn tick; then nothing until RESEND has passed.
    g.Game.time++;
    reactors.spawn(spawn, home, 1);
    assert.equal(orders[1].memory.destination, 'W25N15');
    g.Game.time += 100;
    assert.equal(reactors.spawn(spawn, home, 1), false, 'both sent recently');
    g.Game.time += reactors.RESEND;
    g.Game.creeps.c = { memory: { priority: 'reactorClaimer', destination: 'W25N5' } };
    g.Memory.CurrentRoomEnergy[1] = 1350;   // a new tick's energy
    reactors.spawn(spawn, home, 1);
    assert.equal(orders[2].memory.destination, 'W25N15', 'W25N5 still has a claimer alive');
});

test('no claimer while the reactor is ours and fuelled, or nearly empty; never off the Seasonal World', () => {
    let s = world();
    s.reactors.state().W25N5 = { t: 1, my: true, T: 500 };
    s.reactors.state().W25N15 = { t: 1, my: false, T: 40 };
    assert.equal(s.reactors.spawn(s.spawn, s.home, 1), false);
    s.reactors.state().W25N5.my = false;
    assert.equal(s.reactors.spawn(s.spawn, s.home, 1), true, 'taken from us: go again');
    s = world({ shard: 'shard2' });
    assert.equal(s.reactors.spawn(s.spawn, s.home, 1), false);
    s = world({ energy: 600 });
    assert.equal(s.reactors.spawn(s.spawn, s.home, 1), false, 'waits for 650');
    s = world({ capacity: 550 });
    assert.equal(s.reactors.homeFor('W25N5', ['W24N8']), undefined, 'a home that cannot afford it is no home for it');
});

test('the claimer walks to the reactor, claims it, and claims it back when taken', () => {
    const { h, g, reactors } = world();
    g.FIND_REACTORS = 10051;
    g.RESOURCE_THORIUM = 'T';
    g.RoomPosition = function (x, y, roomName) { Object.assign(this, { x, y, roomName }); };
    h.load('combat.tactics').escape = () => false;
    const reactor = { pos: { x: 12, y: 33 }, my: false, owner: { username: 'rival' } };
    const room = { name: 'W25N5', find: t => (t === g.FIND_REACTORS ? [reactor] : []) };
    const calls = [];
    let near = false;
    const creep = { name: 'r', room: { name: 'W24N8' }, memory: { priority: 'reactorClaimer', destination: 'W25N5' },
        pos: { isNearTo: () => near }, travelTo: t => calls.push('travel:' + (t.roomName || 'reactor')),
        claimReactor: () => { calls.push('claim'); return g.OK; } };
    const run = () => h.load('creep.reactorClaimer').run(creep);
    run();
    assert.deepEqual(calls.splice(0), ['travel:W25N5']);
    creep.room = room;
    run();
    assert.deepEqual(calls.splice(0), ['travel:reactor']);
    near = true;
    run();
    assert.deepEqual(calls.splice(0), ['claim']);
    assert.ok(creep.memory.claimedAt && creep.memory.onPoint);
    reactor.my = true;
    run();
    assert.deepEqual(calls.splice(0), [], 'ours: it waits beside it');
    reactor.my = false;
    run();
    assert.deepEqual(calls.splice(0), ['claim'], 'taken back: claimed again');
    // What it sees is recorded for the spawner.
    g.Game.rooms.W25N5 = room;
    reactor.store = { T: 889 };
    reactors.observe();
    assert.equal(reactors.state().W25N5.T, 889);
});
