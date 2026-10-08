const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

function setup(shard = 'shard2', remote = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Game.time = 5000;
    g.Game.shard = { name: shard };
    g.console = { log: () => {} };
    const local = { value: '' };
    g.InterShardMemory = {
        getLocal: () => local.value, setLocal: v => { local.value = v; },
        getRemote: s => (remote[s] ? JSON.stringify({ xs: remote[s] }) : null),
    };
    const x = h.load('system.shardX');
    g.Game.map.getRoomLinearDistance = (a, b) => h.load('system.expansion').linear(a, b);
    return { h, g, local, remote, x };
}

function owned(g, name) {
    return { name, controller: { my: true }, storage: {}, find: t => (t === g.FIND_MY_SPAWNS ? [{}] : []) };
}

test('room names: highway corners and source-keeper rooms', () => {
    const { x } = setup();
    for (const r of ['E40N40', 'W0N10', 'E10S0']) assert.equal(x.isCorner(r), true, r);
    for (const r of ['E41N40', 'E45N45']) assert.equal(x.isCorner(r), false, r);
    assert.equal(x.isSourceKeeper('E44N46'), true);
    assert.equal(x.isSourceKeeper('E45N45'), false, 'the centre room has no keepers');
});

test('each home goes to its own nearest corner', () => {
    const { x } = setup();
    const corners = plain(x.nearCorners(['E12N15', 'E38N44']));
    assert.deepEqual(corners.map(c => [c.corner, c.home, c.distance]), [['E40N40', 'E38N44', 4], ['E10N20', 'E12N15', 5]]);
});

test('home shards send one scout per 100 ticks, rotating corners, and pause while shardX has enough', () => {
    const { g, x } = setup();
    g.Game.rooms = { E38N44: owned(g, 'E38N44'), E12N15: owned(g, 'E12N15') };
    g.Memory.xs = {};
    x.scheduleScout({ sc: 3 });
    assert.deepEqual(Object.keys(g.Memory.xs.queue), ['E38N44']);
    assert.deepEqual(plain(g.Memory.xs.queue.E38N44.memory.xShard), { c: 'E40N40' });
    g.Memory.xs.queue = {};
    x.scheduleScout({ sc: 3 });
    assert.deepEqual(Object.keys(g.Memory.xs.queue), ['E12N15'], 'next corner in the rotation');
    g.Memory.xs.queue = {};
    assert.equal(x.scheduleScout({ sc: 15 }), null);
    assert.deepEqual(plain(g.Memory.xs.queue), {});
});

test('shard1 and shard3 follow the mode set on shard2', () => {
    const { g, x } = setup('shard1', { shard2: { mode: 'scout', targets: [] } });
    g.Game.rooms = { E28N48: owned(g, 'E28N48') };
    g.Game.time = 5100;
    x.run();
    assert.ok(g.Memory.xs.queue.E28N48, 'a scout queued on shard1');
});

function cornerCreep(g, { portal = true } = {}) {
    const moves = [];
    const portalObj = { structureType: g.STRUCTURE_PORTAL, destination: { shard: 'shardX', room: 'E40N40' }, pos: { x: 25, y: 25 } };
    const creep = {
        name: 'abc12345', memory: { priority: 'claimer', destination: 'E43N41', homeRoom: 'E38N44', xShard: { c: 'E40N40' } },
        room: { name: 'E40N40', find: () => (portal ? [portalObj] : []) },
        pos: { isNearTo: () => true, getDirectionTo: () => 3, findClosestByRange: list => list[0] },
        move: d => { moves.push(d); return g.OK; }, travelTo: () => g.OK, suicide: () => moves.push('suicide'),
    };
    return { creep, moves };
}

test('at the corner a creep publishes its memory (with its shard), then steps into the shardX portal', () => {
    const { g, x } = setup('shard1');
    g.Memory.xs = {};
    const { creep, moves } = cornerCreep(g);
    assert.equal(x.portalStep(creep), true);
    assert.deepEqual(moves, [3]);
    assert.deepEqual(plain(g.Memory.xs.travellers.abc12345.m), { priority: 'claimer', destination: 'E43N41', homeRoom: 'E38N44', hs: 'shard1' });
});

test('a corner without a shardX portal is noted and the scout retires', () => {
    const { g, x } = setup();
    g.Memory.xs = {};
    const { creep, moves } = cornerCreep(g, { portal: false });
    x.portalStep(creep);
    assert.deepEqual(moves, ['suicide']);
    assert.ok(g.Memory.xs.noPortal.E40N40);
});

test('shardX: arrivals take their memory from any home shard; without it the role comes from the body', () => {
    const remote = {
        shard1: { travellers: { scout1: { m: { priority: 'xScout', homeRoom: 'E28N48', hs: 'shard1' } } } },
        shard2: { mode: 'claim', targets: [{ r: 'E43N41', h: 'shard2:E38N44', e: 'E40N40', t: 400 }], travellers: {} },
    };
    const { g, x } = setup('shardX', remote);
    const creep = (name, parts) => ({ name, memory: {}, room: { name: 'E40N40' }, getActiveBodyparts: p => (parts.includes(p) ? 1 : 0) });
    g.Game.creeps = { scout1: creep('scout1', []), lost: creep('lost', [g.CLAIM]) };
    g.Memory.creeps = {};
    x.adopt();
    assert.deepEqual(plain(g.Memory.creeps.scout1), { priority: 'xScout', homeRoom: 'E28N48', hs: 'shard1', entry: 'E40N40' });
    assert.deepEqual(plain(g.Memory.creeps.lost), { priority: 'claimer', destination: 'E43N41', homeRoom: 'E38N44', xTarget: 1 });
});

function scoutedRoom(g, name, owner) {
    return { name, controller: { my: false, owner: owner ? { username: owner } : undefined, pos: { x: 20, y: 20 } },
        find: type => (type === g.FIND_SOURCES ? [{ id: 's1', pos: { x: 10, y: 10 } }, { id: 's2', pos: { x: 30, y: 30 } }] : []) };
}

test('shardX: a scouted room feeds intel and bad rooms, tagged with the fastest trip to its controller', () => {
    const { g, x } = setup('shardX');
    const pos = { getRangeTo: () => 20 };
    x.recordRoom(scoutedRoom(g, 'E42N41'), { h: 'shard2:E38N44', e: 'E40N40', t: 300, pos });
    x.recordRoom(scoutedRoom(g, 'E42N41'), { h: 'shard1:E28N48', e: 'E40N40', t: 450, pos });
    x.recordRoom(scoutedRoom(g, 'E41N42', 'someoneElse'), { h: 'shard2:E38N44', e: 'E40N40', t: 200, pos });
    assert.equal(g.Memory.expandIntel.E42N41.n, 2);
    assert.ok(g.Memory.remoteIntel.E42N41);
    assert.ok(g.Memory.badRooms.E41N42, 'claimed by another player: never routed through');
    assert.deepEqual(plain(g.Memory.xs.tag.E42N41), { h: 'shard2:E38N44', e: 'E40N40', t: 320 }, 'the faster trip is kept');
});

test('shardX candidates: the controller must be reachable within 500 ticks; neighbours that are highways or keeper rooms count as known', () => {
    const { g, x, h } = setup('shardX');
    g.Game.map.getRoomTerrain = () => ({ get: (x2, y) => (x2 === 0 || y === 0 || x2 === 49 || y === 49 ? 1 : 0) });
    g.Game.map.describeExits = () => ({});
    const expansion = h.load('system.expansion');
    g.Memory.expandIntel = {};
    for (const name of expansion.around('E42N41', 1)) g.Memory.expandIntel[name] = { t: g.Game.time };
    const room = { t: g.Game.time, n: 2, c: [25, 10], s: [[10, 30], [40, 30]], m: [20, 40] };
    g.Memory.expandIntel.E42N41 = Object.assign({}, room);
    g.Memory.expandIntel.E43N48 = Object.assign({}, room);
    g.Memory.xs = { seen: {}, tag: { E42N41: { h: 'shard2:E38N44', e: 'E40N40', t: 480 }, E43N48: { h: 'shard2:E38N44', e: 'E40N40', t: 520 } } };
    const cands = plain(x.candidates(5));
    assert.deepEqual(cands.map(c => c.r), ['E42N41'], 'E43N48 is 520 ticks away');
});

test('picks: best candidates, each from a different home on any shard, spaced apart, within 500 ticks', () => {
    const { x } = setup();
    const cands = [{ r: 'E43N41', h: 'shard2:E38N44', e: 'E40N40', t: 300, s: 9 },
        { r: 'E47N47', h: 'shard2:E38N44', e: 'E50N50', t: 350, s: 8 },
        { r: 'E44N41', h: 'shard1:E28N48', e: 'E40N40', t: 300, s: 7 },
        { r: 'E33N33', h: 'shard3:E29N43', e: 'E30N30', t: 400, s: 6 },
        { r: 'E36N36', h: 'shard1:E28N48', e: 'E40N40', t: 499, s: 5 }];
    const picks = plain(x.pick(cands));
    assert.deepEqual(picks.map(p => p.r), ['E43N41', 'E33N33', 'E36N36'], 'one per home; E44N41 is too close to E43N41');
    assert.equal(new Set(picks.map(p => p.h)).size, 3);
});

test('claim support is sent by the shard that owns the target\'s home', () => {
    const { g, x } = setup('shard1', {
        shard2: { mode: 'claim', targets: [{ r: 'E43N41', h: 'shard2:E38N44', e: 'E40N40' }, { r: 'E36N36', h: 'shard1:E28N48', e: 'E40N40' }] },
        shardX: { progress: {} },
    });
    g.Game.rooms = { E28N48: owned(g, 'E28N48') };
    g.Game.creeps = {};
    g.Game.time = 5025;
    x.run();
    assert.deepEqual(Object.keys(g.Memory.xs.queue), ['E28N48']);
    assert.equal(g.Memory.xs.queue.E28N48.kind, 'claimer');
    assert.deepEqual(plain(g.Memory.xs.queue.E28N48.memory.xShard), { c: 'E40N40' });
});

test('closed / out-of-borders rooms are never scout targets, routes or candidates (shardX checkerboard)', () => {
    const { g, h, x } = setup('shardX');
    // Every other 10x10 sector is out of borders, as on shardX: E41N41 closed, E39N41 open.
    const closed = name => /^E4[1-9]N4[1-9]$/.test(name);
    g.Game.map.getRoomStatus = name => ({ status: closed(name) ? 'out of borders' : 'normal' });
    const status = h.load('room.status');
    assert.equal(status.open('E41N41'), false);
    assert.equal(status.open('E39N41'), true);
    const { Traveler } = h.load('traveler');
    assert.equal(Traveler.checkAvoid('E41N41'), true, 'never routed through');
    g.Memory.xs = { seen: {}, tag: {} };
    for (const name of h.load('system.expansion').around('E40N40', 9)) {
        if (!closed(name) && name !== 'E39N41') g.Memory.xs.seen[name] = g.Game.time;   // only E39N41 left open and unseen
    }
    const scout = { name: 's', memory: { priority: 'xScout' }, room: { name: 'E40N40' }, ticksToLive: 1400 };
    g.Game.creeps = { s: scout };
    assert.equal(x.nextRoom(scout), 'E39N41', 'the closed rooms next door are skipped');
    const expansion = h.load('system.expansion');
    assert.match(expansion.invalidReason('E41N41', { t: g.Game.time, c: [1, 1], n: 2 }, { mine: [], bad: {} }), /closed/);
});
