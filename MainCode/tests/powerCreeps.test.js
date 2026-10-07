const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

const EARLY = [0, 2, 7, 14, 22];
const LATE = [10, 11, 12, 14, 22];

function setup({ shard = 'shard2', remote = {}, gpl = 0 } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Game.time = 1000;
    g.Game.shard = { name: shard };
    g.Game.gpl = { level: gpl };
    g.POWER_CLASS = { OPERATOR: 'operator' };
    g.POWER_INFO = {
        PWR_GENERATE_OPS: { level: EARLY }, PWR_OPERATE_TOWER: { level: EARLY }, PWR_OPERATE_LAB: { level: EARLY },
        PWR_OPERATE_EXTENSION: { level: EARLY }, PWR_REGEN_SOURCE: { level: LATE }, PWR_OPERATE_POWER: { level: LATE },
    };
    const local = { value: '' };
    g.InterShardMemory = {
        getLocal: () => local.value, setLocal: v => { local.value = v; },
        getRemote: s => (remote[s] ? JSON.stringify({ pc: Object.assign({ t: Date.now() }, remote[s]) }) : null),
    };
    const spawns = [];
    const rooms = {};
    const addRoom = (name, withPs = true) => {
        const ps = withPs ? { id: 'ps' + name, room: { name } } : null;
        rooms[name] = { name, controller: { my: true }, find: (type, opts) => (type === g.FIND_MY_STRUCTURES && ps ? [ps] : []) };
    };
    const pcs = {};
    const addPc = (name, extra = {}) => {
        pcs[name] = Object.assign({ name, className: 'operator', level: 25, shard: undefined, powers: {},
            spawn: ps => { spawns.push([name, ps.room.name]); pcs[name].shard = shard; return g.OK; },
            suicide: () => { spawns.push([name, 'suicide']); return g.OK; } }, extra);
    };
    g.Game.rooms = rooms;
    g.Game.powerCreeps = pcs;
    g.Memory.powerCreeps = {};
    g.console = { log: () => {} };
    const pc = h.load('system.powerCreeps');
    return { g, pc, spawns, addRoom, addPc, local, run: () => pc.assignmentPass() };
}

test('upgrade order reaches the full build (GENERATE_OPS 4, TOWER 3, LAB 5, EXTENSION 5, REGEN_SOURCE 5, OPERATE_POWER 3)', () => {
    const { pc } = setup();
    const powers = {};
    let level = 0;
    for (let step = 0; step < 30; step++) {
        const next = pc.nextUpgrade(powers, level);
        if (next === null) break;
        powers[next] = { level: (powers[next] ? powers[next].level : 0) + 1 };
        level++;
    }
    assert.equal(level, 25);
    assert.deepEqual(plain(Object.fromEntries(Object.entries(powers).map(([k, v]) => [k, v.level]))), {
        PWR_GENERATE_OPS: 4, PWR_OPERATE_TOWER: 3, PWR_OPERATE_LAB: 5, PWR_OPERATE_EXTENSION: 5, PWR_REGEN_SOURCE: 5, PWR_OPERATE_POWER: 3 });
});

test('a free operator spawns in the first room with a power spawn but no operator', () => {
    const { g, spawns, addRoom, addPc, run } = setup();
    addRoom('A'); addRoom('B'); addRoom('C', false);
    addPc('home', { shard: 'shard2' });
    g.Memory.powerCreeps.home = { homeRoom: 'A', priority: 'baseOp' };
    addPc('free');
    run();
    assert.deepEqual(plain(spawns), [['free', 'B']]);
    assert.equal(g.Memory.powerCreeps.free.homeRoom, 'B');
});

test('shard priority: shardX\'s waiting rooms get free operators before shard2', () => {
    const s = setup({ remote: { shardX: { need: 1, reserved: [], assigned: 0 } } });
    s.addRoom('A');
    s.addPc('free');
    s.run();
    assert.deepEqual(plain(s.spawns), [], 'left for shardX');
});

test('operators reserved by another shard, spawned elsewhere, or not fully built are not free', () => {
    const s = setup({ remote: { shard1: { need: 0, reserved: ['theirs'], assigned: 1 } } });
    s.addRoom('A');
    s.addPc('theirs');
    s.addPc('away', { shard: 'shard3' });
    s.addPc('young', { level: 10 });
    s.run();
    assert.deepEqual(plain(s.spawns), []);
});

test('shardX waiting with no free operators: shard1 releases one (suicide, unassigned)', () => {
    const s = setup({ shard: 'shard1', remote: { shardX: { need: 1, reserved: [], assigned: 0 } } });
    s.addRoom('A');
    s.addPc('op', { shard: 'shard1' });
    s.g.Memory.powerCreeps.op = { homeRoom: 'A', priority: 'baseOp' };
    s.run();
    assert.deepEqual(plain(s.spawns), [['op', 'suicide']]);
    assert.equal(s.g.Memory.powerCreeps.op.homeRoom, undefined);
    assert.equal(JSON.parse(s.local.value).pc.assigned, 0);
});

test('shard2 only releases once shard1 has none assigned', () => {
    const s = setup({ remote: { shardX: { need: 1, reserved: [], assigned: 0 }, shard1: { need: 0, reserved: [], assigned: 2 } } });
    s.addRoom('A');
    s.addPc('op', { shard: 'shard2' });
    s.g.Memory.powerCreeps.op = { homeRoom: 'A', priority: 'baseOp' };
    s.run();
    assert.deepEqual(plain(s.spawns), []);
});

test('a home without a power spawn (or retired) is dropped; a power spawn being rebuilt keeps it', () => {
    const s = setup();
    s.addRoom('A', false);
    s.addPc('op', { shard: 'shard2' });
    s.g.Memory.powerCreeps.op = { homeRoom: 'A', priority: 'baseOp' };
    s.run();
    assert.equal(s.g.Memory.powerCreeps.op.homeRoom, undefined);
    const t = setup();
    t.addRoom('A', false);
    t.g.Game.rooms.A.find = type => (type === t.g.FIND_MY_CONSTRUCTION_SITES ? [{}] : []);
    t.addPc('op', { shard: 'shard2' });
    t.g.Memory.powerCreeps.op = { homeRoom: 'A', priority: 'baseOp' };
    t.run();
    assert.equal(t.g.Memory.powerCreeps.op.homeRoom, 'A');
});

test('a new operator is created only with enough free power levels for a complete one', () => {
    let created = [];
    let s = setup({ gpl: 26 * 2 + 25 });   // two existing level-25 creeps use 52; 25 free: not enough
    s.addPc('a'); s.addPc('b');
    s.g.PowerCreep = { create: (name, cls) => { created.push(name); return s.g.OK; } };
    assert.equal(s.pc.createIfAffordable(), false);
    s = setup({ gpl: 26 * 3 });
    s.addPc('a'); s.addPc('b');
    s.g.PowerCreep = { create: (name) => { created.push(name); return s.g.OK; } };
    assert.equal(s.pc.createIfAffordable(), true);
    assert.equal(created.length, 1);
    assert.equal(s.g.Memory.pcBuild, created[0]);
});
