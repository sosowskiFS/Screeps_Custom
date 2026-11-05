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
        'creep.registry': { roles: { work: creep => { ran.push(creep.name); advance(creep.cost); } }, fallback() {}, tierOf: () => 'essential' },
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

test('a base room panel shows its Room CPU and its share of the shard', () => {
    const { g, h } = setup();
    g.Memory.settings = { visuals: true };
    g.Memory.roomCPU = { A: { a: 3.456, n: 500, l: 1 } };
    g.Game.cpu.limit = 20;
    const texts = [];
    g.RoomVisual = function () {
        return { getSize: () => 0, circle() {}, poly() {}, rect() {}, text: (value, x, y) => texts.push([String(value), x, y]) };
    };
    g.Game.map.visual = { text() {}, rect() {} };
    g.RoomPosition = function (x, y, roomName) { Object.assign(this, { x, y, roomName }); };
    g.Memory.CPUAverages = { TotalCPU: { CPU: 10 } };
    g.Memory.repairTarget = {};
    h.load('system.visuals').displayRoomInfo({ name: 'A', controller: { level: 8 }, storage: undefined, find: () => [] });
    assert.ok(texts.some(([value]) => value === 'Room CPU'), 'a Room CPU row');
    assert.ok(texts.some(([value]) => value === '3.5 (35%)'), 'the rounded room average and its share of the shard (10)');
});

test('map cards for rooms we know of: other players first, then our remotes (off when disabled), reserved, keeper, scouted', () => {
    const { g, h } = setup();
    g.Memory.settings = { visuals: true };
    g.Game.time = 100000;
    g.Game.rooms = { HOME: { name: 'HOME', controller: { my: true } } };
    g.Memory.badRooms = { RIVAL: { o: 'Harabi', t: 99000 } };
    g.Memory.remoteIntel = {
        RIVAL: { t: 99500, s: [[1, 1, 1]], o: 'Harabi', tw: 3 },
        MINE: { t: 99900, s: [['a', 1, 1], ['b', 2, 2]] },
        DOWN: { t: 99900, s: [['c', 1, 1]] },
        RES: { t: 90000, s: [['d', 1, 1]], r: 'Someone' },
        SK: { t: 90000, s: [['e', 1, 1]], k: 1 },
        HOME: { t: 1, s: [] },
    };
    g.Memory.expandIntel = { FAR: { t: 50000, n: 2 } };
    g.Memory.remotePlan = { HOME: { list: [{ r: 'MINE', id: 'a' }, { r: 'MINE', id: 'b' }, { r: 'DOWN', id: 'c' }] } };
    g.Memory.remoteStatus = { DOWN: { strikes: 2, until: 100500 } };
    g.Memory.FarRoomsUnderAttack = ['DOWN'];
    const cards = h.load('system.visuals').intelCards();
    const by = Object.fromEntries(cards.map(c => [c.name, c]));
    assert.equal(cards[0].name, 'RIVAL', 'other players first');
    assert.ok(by.RIVAL.main.includes('Harabi') && by.RIVAL.side.includes('3'));
    assert.ok(by.MINE.main.includes('2/2') && by.MINE.main.includes('HOME'));
    assert.ok(by.DOWN.side.includes('OFF') && by.DOWN.alarm, 'disabled and attacked');
    assert.ok(by.RES.main.includes('Someone'));
    assert.equal(by.SK.main, 'SK');
    assert.ok(by.FAR.faint && by.FAR.main === '2 src' && by.FAR.age === '50k ago');
    assert.equal(by.HOME, undefined, 'owned rooms keep their own card');
});
