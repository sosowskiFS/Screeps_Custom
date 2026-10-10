const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

function setup() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Game.time = 1000;
    g.RoomPosition = class { constructor(x, y, roomName) { this.x = x; this.y = y; this.roomName = roomName; } };
    g.Game.map.getRoomLinearDistance = () => 4;
    g.Game.rooms = { E1N16: { name: 'E1N16', energyCapacityAvailable: 12900, controller: { my: true } } };
    g.Game.creeps = {};
    const tg = h.load('system.tempGuards');
    // Spawn whatever is ordered this tick (as system.spawning would), then step a tick.
    const spawnTick = () => {
        const o = tg.spawnOrder('E1N16');
        if (o) g.Game.creeps[o.name] = { name: o.name, memory: o.memory, spawning: true, room: { name: 'E1N16' },
            travelTo: () => {} };
        g.Game.time++;
        return o;
    };
    return { h, g, tg, spawnTick };
}

test('tempGuard() keeps the ordered number of guards, one order per tick, until it expires', () => {
    const s = setup();
    assert.match(s.tg.command('W0N20', 'E1N16', 3, 5000), /3 guards from E1N16/);
    assert.ok(s.tg.spawnOrder('E1N16'));
    assert.equal(s.tg.spawnOrder('E1N16'), null, 'a second spawn in the same tick orders nothing (the first creep is not in Game.creeps yet)');
    s.g.Game.time++;
    const orders = [];
    for (let i = 0; i < 6; i++) { const o = s.spawnTick(); if (o) orders.push(o); }
    assert.equal(orders.length, 3);
    assert.deepEqual(plain(orders[0].memory).destination, 'W0N20');
    assert.equal(orders[0].memory.priority, 'roomGuard');
    assert.ok(orders.every(o => o.body.length === 50), 'the RCL8 guard body');
    // One nearly dead: a replacement is ordered before it dies.
    for (const c of Object.values(s.g.Game.creeps)) { c.spawning = false; c.ticksToLive = 1400; delete c.memory.gather; }
    Object.values(s.g.Game.creeps)[0].ticksToLive = 100;
    assert.ok(s.spawnTick(), 'replacement ordered early');
    assert.equal(s.spawnTick(), null);
    s.g.Game.time += 6000;
    assert.equal(s.tg.spawnOrder('E1N16'), null);
    assert.deepEqual(plain(s.g.Memory.tempGuards), {}, 'expired');
});

test('the first group gathers at home and leaves together; replacements go alone', () => {
    const s = setup();
    s.tg.command('W0N20', 'E1N16', 3, 5000);
    for (let i = 0; i < 3; i++) s.spawnTick();
    const group = Object.values(s.g.Game.creeps);
    assert.ok(group.every(c => c.memory.gather && c.memory.wave === group[0].memory.wave));
    group[0].spawning = false; group[1].spawning = false;
    assert.equal(s.tg.waiting(group[0]), true, 'third still spawning');
    group[2].spawning = false;
    assert.equal(s.tg.waiting(group[0]), false);
    assert.equal(s.tg.waiting(group[1]), false, 'the second sees the whole group too');
    assert.equal(s.tg.waiting(group[2]), false);
    // Later replacement: the others are out, so no gathering.
    for (const c of group) c.ticksToLive = 1400;
    group[0].ticksToLive = 50;
    const o = s.spawnTick();
    assert.ok(o && !o.memory.gather);
});

test('tempGuard console: list and cancel', () => {
    const s = setup();
    assert.equal(s.tg.command(), 'no temporary guards');
    s.tg.command('W0N20', 'E1N16');
    assert.match(s.tg.command(), /W0N20: 3 from E1N16/);
    assert.match(s.tg.command('W0N20'), /cancelled/);
    assert.match(s.tg.command('W0N20', 'E9N9'), /not one of our rooms/);
});
