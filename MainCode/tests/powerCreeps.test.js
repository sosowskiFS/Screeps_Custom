const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

const EARLY = [0, 2, 7, 14, 22];
const LATE = [10, 11, 12, 14, 22];

const MIN = 60 * 1000;

function setup({ shard = 'shard2', remote = {}, gpl = 0, silentFor = 31 * MIN } = {}) {
    const h = harness(), g = h.context;
    const clock = { now: 1e12 };
    g.Date = { now: () => clock.now };   // the module only reads Date.now()
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
        getRemote: s => (remote[s] ? JSON.stringify({ pc: Object.assign({ t: clock.now }, remote[s]) }) : null),
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
    // Shards without an entry: seen silent this long already (default: long enough to ignore).
    g.Memory.pcSilent = { shardX: clock.now - silentFor, shard1: clock.now - silentFor, shard2: clock.now - silentFor, shard3: clock.now - silentFor };
    g.console = { log: () => {} };
    const pc = h.load('system.powerCreeps');
    // Each pass is a later tick (passes run every 100 ticks; remote reads are cached per tick).
    return { g, pc, spawns, addRoom, addPc, local, clock, remote, run: () => { g.Game.time += 100; return pc.assignmentPass(); } };
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

test('a free operator is claimed for the first room with a power spawn but no operator, then spawned on a later pass', () => {
    const { g, spawns, addRoom, addPc, run, clock, local } = setup();
    addRoom('A'); addRoom('B'); addRoom('C', false);
    addPc('home', { shard: 'shard2' });
    g.Memory.powerCreeps.home = { homeRoom: 'A', priority: 'baseOp' };
    addPc('free');
    run();
    assert.deepEqual(plain(spawns), [], 'claimed, not spawned yet');
    assert.deepEqual(plain(JSON.parse(local.value).pc.claims), ['free'], 'the claim is published');
    clock.now += 11 * MIN;   // shard2 confirms after 2 x 5 min
    run();
    assert.deepEqual(plain(spawns), [['free', 'B']]);
    assert.equal(g.Memory.powerCreeps.free.homeRoom, 'B');
});

test('the WhooDaddy race: shard1 does not take a free operator before shard2 has spoken, and yields to its claim', () => {
    // Just deployed: shard2 has no entry yet. shard1 must wait, not assume shard2 is down.
    const s = setup({ shard: 'shard1', silentFor: 0 });
    s.g.Memory.pcSilent = { shardX: s.clock.now - 31 * MIN };   // shardX long silent: only shard2 is unknown
    s.addRoom('E19N59');
    s.addPc('WhooDaddy');
    s.run();
    assert.deepEqual(plain(s.g.Memory.pcClaims), {}, 'no claim while shard2 is unknown');
    // shard2 reports rooms waiting: the free operator is shard2's, shard1 still claims nothing.
    s.remote.shard2 = { need: 3, reserved: [], claims: [], assigned: 20 };
    s.clock.now += 5 * MIN;
    s.run();
    assert.deepEqual(plain(s.g.Memory.pcClaims), {});
    // Had shard1 claimed first, a later shard2 claim wins: shard1 drops it instead of spawning.
    s.remote.shard2 = { need: 0, reserved: [], claims: [], assigned: 20 };
    s.run();
    assert.ok(s.g.Memory.pcClaims.WhooDaddy);
    s.remote.shard2 = { need: 1, reserved: [], claims: ['WhooDaddy'], assigned: 20 };
    s.clock.now += 20 * MIN;
    s.run();
    assert.deepEqual(plain(s.spawns), []);
    assert.deepEqual(plain(s.g.Memory.pcClaims), {});
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
