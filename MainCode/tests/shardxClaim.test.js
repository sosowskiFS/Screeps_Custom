const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

// shard2 coordinating a claim on shardX E36N36 from E28N48 (via E40N40); shardX reports `progress`.
function setup(progress = {}, targets = [{ r: 'E36N36', h: 'shard2:E28N48', e: 'E40N40', t: 300 }]) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Memory.settings = Object.assign({}, g.Memory.settings, { shardX: true });
    g.BODYPART_COST = { claim: 600, move: 50 }; g.CLAIM = 'claim'; g.MOVE = 'move';
    g.Game.time = 5025;
    g.Game.shard = { name: 'shard2' };
    g.console = { log: () => {} };
    const local = { value: '' };
    const remote = { shardX: { progress, cands: [] } };
    g.InterShardMemory = { getLocal: () => local.value, setLocal: v => { local.value = v; },
        getRemote: s => (remote[s] ? JSON.stringify({ xs: remote[s] }) : null) };
    g.Game.map.getRoomLinearDistance = (a, b) => h.load('system.expansion').linear(a, b);
    g.Game.rooms = { E28N48: { name: 'E28N48', energyCapacityAvailable: 12900, controller: { my: true }, storage: {},
        find: t => (t === g.FIND_MY_SPAWNS ? [{}] : []) } };
    g.Game.creeps = {};
    g.Memory.xs = { mode: 'claim', targets: plain(targets), queue: {} };
    const x = h.load('system.shardX');
    // One queue slot per home: take the order (as the spawner would) and step 25 ticks.
    const cycle = () => { x.run(); const order = g.Memory.xs.queue.E28N48; g.Memory.xs.queue = {}; g.Game.time += 25; return order; };
    return { h, g, x, remote, cycle };
}

test('helpers set out right away alongside the first claimer, not only after the claim', () => {
    const s = setup();
    const first = s.cycle();
    assert.equal(first.kind, 'claimer');
    const kinds = [];
    for (let i = 0; i < 8; i++) { const o = s.cycle(); if (o) kinds.push(o.kind); }
    assert.ok(kinds.includes('helper'), JSON.stringify(kinds));
    assert.ok(!kinds.includes('claimer'), 'no second claimer while the first is on its way');
});

test('claimers keep coming until the room is claimed; a reservation by another player gets a breaker', () => {
    const s = setup();
    assert.equal(s.cycle().kind, 'claimer');
    s.g.Game.time += 500;                        // that claimer had time to arrive and is gone (killed, failed)
    s.remote.shardX.progress = { E36N36: { cl: 0, hp: 4, rs: { u: 'Mufuni', e: 1600 } } };
    const order = s.cycle();
    assert.equal(order.kind, 'claimer');
    assert.equal(order.memory.breaker, 1);
    s.g.Memory.xs.queue.E28N48 = order;
    const built = plain(s.x.spawnOrder('E28N48').body);
    assert.ok(built.filter(p => p === s.g.CLAIM).length >= 15, 'many CLAIM parts: ' + built.length);
    // A claimer still on shardX (reported) holds the next one back.
    s.g.Memory.xs.queue = {};
    s.g.Game.time += 1000;
    s.remote.shardX.progress = { E36N36: { cl: 0, hp: 4, cx: 1 } };
    assert.equal((s.cycle() || {}).kind, undefined, 'a claimer on shardX holds the next one back');
    s.remote.shardX.progress = { E36N36: { cl: 1, hp: 4 } };
    s.g.Game.time += 1000;
    const after = s.cycle();
    assert.ok(!after || after.kind !== 'claimer', 'claimed: no more claimers');
});

test('a target someone else claimed first is dropped and replaced by the next candidate', () => {
    const s = setup({ E36N36: { ow: 'Harabi' } });
    s.remote.shardX.cands = [{ r: 'E36N36', h: 'shard2:E28N48', e: 'E40N40', t: 300, s: 9 },
        { r: 'E37N37', h: 'shard2:E28N48', e: 'E40N40', t: 320, s: 8 },
        { r: 'E33N33', h: 'shard2:E28N48', e: 'E30N30', t: 400, s: 7 }];
    s.x.run();
    const targets = plain(s.g.Memory.xs.targets).map(t => t.r);
    assert.deepEqual(targets, ['E33N33'], 'E36N36 dropped; E37N37 is next to it, so E33N33');
    assert.ok(s.g.Memory.xs.skip.E36N36, 'not picked again for a while');
});

test('pick never takes two neighbouring candidates', () => {
    const s = setup();
    const picks = plain(s.x.pick([{ r: 'E22N31', h: 'shard2:A', t: 300 }, { r: 'E22N32', h: 'shard2:B', t: 300 },
        { r: 'E19N28', h: 'shard2:C', t: 300 }]));
    assert.deepEqual(picks.map(p => p.r), ['E22N31', 'E19N28']);
});

// The claimer on shardX.
function claimerAt(controller) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Game.shard = { name: 'shardX' }; g.COLOR_GREEN = 5; g.COLOR_WHITE = 10;
    const calls = [];
    const room = { name: 'E36N36', controller };
    controller.pos = { createFlag: () => calls.push('flag') };
    const creep = { name: 'c', owner: { username: 'Montblanc' }, room, memory: { priority: 'claimer', destination: 'E36N36', xTarget: 1 },
        pos: { isNearTo: () => true }, travelTo: () => calls.push('travel'), suicide: () => calls.push('suicide'),
        attackController: () => { calls.push('attack'); return g.OK; },
        claimController: () => { calls.push('claim'); return controller.result === undefined ? g.OK : controller.result; } };
    h.load('creep.claimer').run(creep);
    const block = (g.Memory.xs && g.Memory.xs.block || {}).E36N36;
    return { g, calls, block: block ? plain(block) : {} };
}

test('shardX claimer: wears down another reservation, never attacks an owned room, reports failures', () => {
    let r = claimerAt({ reservation: { username: 'Mufuni', ticksToEnd: 900 } });
    assert.deepEqual(r.calls, ['attack']);
    assert.equal(r.block.rs, 'Mufuni');
    r = claimerAt({ owner: { username: 'Harabi' } });
    assert.deepEqual(r.calls, ['suicide'], 'no attack on an owned controller');
    assert.equal(r.block.ow, 'Harabi');
    r = claimerAt({});
    assert.deepEqual(r.calls, ['claim', 'flag', 'suicide']);
    r = claimerAt({ result: -15 });
    assert.deepEqual(r.calls, ['claim', 'suicide']);
    assert.equal(r.block.err, -15);
});

test("hand-picked claim: shardX('claim', [...]) takes the named candidates, sponsors can be overridden and must differ", () => {
    const s = setup({}, []);
    s.g.Memory.xs.mode = 'scout';
    s.g.Game.rooms.E32N33 = { name: 'E32N33', energyCapacityAvailable: 12900, controller: { my: true }, storage: {},
        find: t => (t === s.g.FIND_MY_SPAWNS ? [{}] : []) };
    s.remote.shardX.cands = [
        { r: 'E36N36', h: 'shard2:E28N48', e: 'E40N40', t: 300, s: 9 },
        { r: 'E31N31', h: 'shard2:E28N48', e: 'E30N30', t: 250, s: 8 },
        { r: 'E33N47', h: 'shard3:E29N43', e: 'E30N50', t: 400, s: 7 }];
    assert.match(s.x.command('claim', ['E36N36', 'E31N31']), /both have sponsor shard2:E28N48/);
    assert.match(s.x.command('claim', ['E99N99']), /not one of the 3 candidates/);
    assert.match(s.x.command('claim', ['E31N31@shard3:E29N43']), /can only be the scouted one/);
    const msg = s.x.command('claim', ['E36N36', 'E31N31@E32N33', 'E33N47']);
    assert.match(msg, /^claiming E36N36/);
    const targets = plain(s.g.Memory.xs.targets);
    assert.deepEqual(targets.map(t => t.r + '<' + t.h + '>' + t.e), ['E36N36<shard2:E28N48>E40N40', 'E31N31<shard2:E32N33>E30N30', 'E33N47<shard3:E29N43>E30N50']);
    assert.equal(s.g.Memory.xs.mode, 'claim');
    assert.equal(s.g.Memory.xs.manual, 1);
});

test('hand-picked targets are not topped up automatically when one is lost', () => {
    const s = setup({ E36N36: { ow: 'Harabi' } });
    s.g.Memory.xs.manual = 1;
    s.remote.shardX.cands = [{ r: 'E33N33', h: 'shard2:E28N48', e: 'E30N30', t: 400, s: 7 }];
    s.x.run();
    assert.deepEqual(plain(s.g.Memory.xs.targets), [], 'dropped, nothing picked in its place');
    // Plain shardX('claim') goes back to automatic picks.
    assert.match(s.x.command('claim'), /picking/);
    assert.equal(s.g.Memory.xs.manual, undefined);
});

test('a lost room is reclaimed: claimer and helpers wait while armed players hold it or the controller is blocked', () => {
    const s = setup({ E36N36: { cl: 0, lost: 1, hz: 2, hp: 0 } });
    s.g.Game.notify = () => {};
    const kinds = [];
    for (let i = 0; i < 6; i++) { const o = s.cycle(); if (o) kinds.push(o.kind); }
    assert.deepEqual(kinds, [], 'armed hostiles and no guard of ours: nothing walks in');
    s.remote.shardX.progress = { E36N36: { cl: 0, lost: 1, hz: 2, gq: 4, hp: 0 } };
    assert.equal(s.cycle().kind, 'claimer', 'our quad holds the room: the claimer goes');
    s.g.Game.time += 1000;
    s.remote.shardX.progress = { E36N36: { cl: 0, lost: 1, hz: 0, ub: 900, hp: 0 } };
    assert.equal(s.cycle(), undefined, 'controller blocked longer than the trip (300): wait');
    s.remote.shardX.progress = { E36N36: { cl: 0, lost: 1, hz: 0, ub: 100, hp: 0 } };
    assert.equal(s.cycle().kind, 'claimer');
});

test('rooms all done, then one is lost: back to claim mode, which reclaims it', () => {
    const s = setup({ E36N36: { cl: 0, lost: 1, hz: 0 } });
    const notes = [];
    s.g.Game.notify = t => notes.push(t);
    s.g.Memory.xs.mode = 'done';
    s.g.Game.time = 5050;
    s.x.run();
    assert.equal(s.g.Memory.xs.mode, 'claim');
    assert.match(notes[0], /E36N36 lost/);
});

test('shardX reports a room it held and no longer owns as lost, with armed hostiles and the controller block', () => {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Memory.settings = Object.assign({}, g.Memory.settings, { shardX: true });
    g.Game.shard = { name: 'shardX' };
    g.console = { log: () => {} };
    const written = {};
    g.InterShardMemory = { getLocal: () => written.v || '', setLocal: v => { written.v = v; },
        getRemote: sh => (sh === 'shard2' ? JSON.stringify({ xs: { mode: 'claim', targets: [{ r: 'E36N36', h: 'shard2:E28N48', e: 'E40N40', t: 300 }] } }) : null) };
    g.Game.map.getRoomLinearDistance = () => 3;
    const controller = { my: true, upgradeBlocked: 0 };
    const hostiles = [];
    g.Game.rooms = { E36N36: { name: 'E36N36', controller, find: type => (type === g.FIND_HOSTILE_CREEPS ? hostiles : []) } };
    g.Game.creeps = {};
    g.Memory.xs = { seen: {}, tag: {} };
    const x = h.load('system.shardX');
    const report = () => { h.load('runtime.cache').invalidateRoom && h.load('runtime.cache').invalidateRoom('E36N36'); g.Game.time += 100; x.run(); return JSON.parse(written.v).xs.progress.E36N36; };
    g.Game.time = 0;
    assert.equal(report().lost, undefined, 'ours: not lost');
    controller.my = false; controller.upgradeBlocked = 800;
    hostiles.push({ owner: { username: 'Harabi' }, body: [{ type: g.RANGED_ATTACK }] }, { owner: { username: 'Invader' }, body: [{ type: g.ATTACK }] });
    const p = report();
    assert.equal(p.lost, 1);
    assert.equal(p.hz, 1, 'players only, not NPC invaders');
    assert.equal(p.ub, 800);
});
