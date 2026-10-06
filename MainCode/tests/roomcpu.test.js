const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

function setup() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    let clock = 0;
    let reads = 0;
    g.Game.cpu.getUsed = () => { reads++; return clock; };
    return { h, g, advance: n => { clock += n; }, reads: () => reads, roomCpu: h.load('runtime.roomCpu') };
}

test('chained laps charge each item once, to the room it belongs to', () => {
    const { g, advance, roomCpu } = setup();
    const t = roomCpu.timer();
    advance(0.4); t.lap('A');
    advance(0.1); t.lap('B');
    advance(0.5); t.lap('A');
    roomCpu.updateAverages();
    assert.deepEqual(plain(g.Memory.roomCPU), { A: { a: 0.9, n: 1, l: 1 }, B: { a: 0.1, n: 1, l: 1 } });
});

test('averages are a mean at first, then an exponential average; idle ticks count as zero', () => {
    const { g, advance, roomCpu } = setup();
    for (let tick = 1; tick <= 4; tick++) {
        g.Game.time = tick;
        const t = roomCpu.timer();
        advance(tick % 2 ? 2 : 0); // 2, 0, 2, 0
        t.lap('A');
        roomCpu.updateAverages();
    }
    assert.equal(roomCpu.average('A'), 1, 'plain mean of 2,0,2,0');
    g.Memory.roomCPU.A.n = roomCpu.WINDOW; // long-running room
    g.Game.time = 5;
    roomCpu.updateAverages(); // nothing charged this tick
    assert.ok(Math.abs(roomCpu.average('A') - (1 - 1 / roomCpu.WINDOW)) < 1e-3, 'decays slowly toward zero');

    g.Game.time = 5 + 10001;
    roomCpu.updateAverages();
    assert.equal(g.Memory.roomCPU.A, undefined, 'forgotten after 10000 idle ticks');
});

test('tracking can be turned off and then costs no CPU reads', () => {
    const { g, reads, roomCpu } = setup();
    g.Memory.settings = { roomCpu: false };
    const before = reads();
    const t = roomCpu.timer();
    t.lap('A');
    roomCpu.updateAverages();
    assert.equal(reads(), before);
    assert.equal(g.Memory.roomCPU, undefined);
});

test('creeps are charged to their home room, including remote creeps in other rooms', () => {
    const { g, advance } = setup();
    const ran = [];
    const overrides = {
        'creep.registry': { roles: { work: creep => { ran.push(creep.name); advance(creep.cost); } }, fallback() {} },
        'creep.baseOp': { run() {} },
    };
    // Separate module graph with stubbed roles, sharing this test's Game/Memory.
    const local = harness(overrides);
    local.context.Memory = g.Memory;
    local.context.Game = g.Game;
    const creeps = local.load('system.creeps');
    g.Game.creeps = {
        miner: { name: 'miner', cost: 0.3, memory: { priority: 'work', homeRoom: 'BASE' }, room: { name: 'BASE' } },
        remote: { name: 'remote', cost: 0.7, memory: { priority: 'work', homeRoom: 'BASE' }, room: { name: 'FAR' } },
        other: { name: 'other', cost: 0.2, memory: { priority: 'work', homeRoom: 'OTHER' }, room: { name: 'OTHER' } },
        newborn: { name: 'newborn', spawning: true, memory: { priority: 'work', homeRoom: 'BASE' }, room: { name: 'BASE' } },
    };
    creeps.handleCreepOperations();
    local.load('runtime.roomCpu').updateAverages();
    assert.deepEqual(ran, ['miner', 'remote', 'other']);
    assert.equal(g.Memory.roomCPU.BASE.a, 1, 'miner 0.3 + remote 0.7 (mined elsewhere, charged home)');
    assert.equal(g.Memory.roomCPU.OTHER.a, 0.2);
});

test('a base room shows a Room CPU pie next to the shard average', () => {
    const { g, h } = setup();
    g.Memory.settings = { visuals: true };
    g.Memory.roomCPU = { A: { a: 3.456, n: 500, l: 1 } };
    g.Game.cpu.limit = 20;
    const texts = [];
    g.RoomVisual = function () {
        return { getSize: () => 0, circle() {}, poly() {}, text: (value, x, y) => texts.push([String(value), x, y]) };
    };
    g.Game.map.visual = { text() {} };
    g.Memory.repairTarget = {};
    h.load('system.visuals').displayRoomInfo({ name: 'A', controller: { level: 8 }, storage: undefined });
    assert.ok(texts.some(([value, x]) => value === 'Room CPU' && x === 5), 'labelled pie at x=5 (shard Average is at x=2)');
    assert.ok(texts.some(([value]) => value === '3.46'), 'shows the rounded room average');
});
