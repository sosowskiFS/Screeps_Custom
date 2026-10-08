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
    return { h, g, local, x: h.load('system.shardX') };
}

test('room names: highway corners and source-keeper rooms', () => {
    const { x } = setup();
    for (const r of ['E40N40', 'W0N10', 'E10S0']) assert.equal(x.isCorner(r), true, r);
    for (const r of ['E41N40', 'E45N45']) assert.equal(x.isCorner(r), false, r);
    assert.equal(x.isSourceKeeper('E44N46'), true);
    assert.equal(x.isSourceKeeper('E45N45'), false, 'the centre room has no keepers');
    assert.equal(x.isSourceKeeper('E42N46'), false);
});

test('the nearest corners are found, each from its nearest home', () => {
    const { x } = setup();
    const corners = x.nearCorners(['E12N15', 'E38N44']);
    assert.equal(corners[0].distance, 4, 'E38N44 is 4 rooms from E40N40 (2 across, 4 down)');
    assert.equal(corners[0].corner, 'E40N40');
    assert.equal(corners[0].home, 'E38N44');
    assert.ok(corners.find(c => c.corner === 'E10N10' && c.home === 'E12N15'));
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

test('shard2: a creep at the corner publishes its memory, then steps into the shardX portal', () => {
    const { g, x } = setup();
    g.Memory.xs = {};
    const { creep, moves } = cornerCreep(g);
    assert.equal(x.portalStep(creep), true);
    assert.deepEqual(moves, [3]);
    assert.equal(g.Memory.xs.portals.E40N40, 'E40N40');
    assert.deepEqual(plain(g.Memory.xs.travellers.abc12345.m), { priority: 'claimer', destination: 'E43N41', homeRoom: 'E38N44' });
});

test('shard2: a corner without a shardX portal is noted and the scout retires', () => {
    const { g, x } = setup();
    g.Memory.xs = {};
    const { creep, moves } = cornerCreep(g, { portal: false });
    x.portalStep(creep);
    assert.deepEqual(moves, ['suicide']);
    assert.ok(g.Memory.xs.noPortal.E40N40);
});

test('shardX: arriving creeps take their memory from shard2; without it the role comes from the body', () => {
    const remote = { shard2: { travellers: { scout1: { m: { priority: 'xScout', homeRoom: 'E38N44' } } },
        targets: [{ r: 'E43N41', h: 'E38N44', c: 'E40N40', e: 'E40N40' }] } };
    const { g, x } = setup('shardX', remote);
    const creep = (name, parts) => ({ name, memory: {}, room: { name: 'E40N40' }, getActiveBodyparts: p => (parts.includes(p) ? 1 : 0) });
    g.Game.creeps = { scout1: creep('scout1', []), lost: creep('lost', [g.CLAIM]) };
    g.Memory.creeps = {};
    x.adopt();
    assert.deepEqual(plain(g.Memory.creeps.scout1), { priority: 'xScout', homeRoom: 'E38N44', entry: 'E40N40' });
    assert.deepEqual(plain(g.Memory.creeps.lost), { priority: 'claimer', destination: 'E43N41', homeRoom: 'E38N44', xTarget: 1 });
});

test('shardX: a scouted room feeds auto-expansion intel, bad rooms and remote intel', () => {
    const { g, x } = setup('shardX');
    const room = (name, owner) => ({ name, controller: { my: false, owner: owner ? { username: owner } : undefined, pos: { x: 20, y: 20 } },
        find: type => (type === g.FIND_SOURCES ? [{ id: 's1', pos: { x: 10, y: 10 } }, { id: 's2', pos: { x: 30, y: 30 } }] : []) });
    x.recordRoom(room('E42N41'), 'E40N40');
    x.recordRoom(room('E41N42', 'someoneElse'), 'E40N40');
    assert.equal(g.Memory.expandIntel.E42N41.n, 2);
    assert.ok(g.Memory.remoteIntel.E42N41);
    assert.ok(g.Memory.badRooms.E41N42, 'claimed by another player: never routed through');
    assert.deepEqual(plain(g.Memory.xs.tag.E42N41), { e: 'E40N40', d: 2 });
});

test('shard2 picks the best candidates, each from a different home, within the trip limit', () => {
    const { h, g, x } = setup();
    const owned = name => ({ name, controller: { my: true }, storage: {}, find: t => (t === g.FIND_MY_SPAWNS ? [{}] : []) });
    g.Game.rooms = { E38N44: owned('E38N44'), E36N43: owned('E36N43') };
    g.Game.map.getRoomLinearDistance = (a, b) => h.load('system.expansion').linear(a, b);
    g.Game.map.findRoute = (from, to) => [{ room: to }, { room: to }];   // route length 2
    g.Memory.xs = { portals: { E40N40: 'E40N40' } };
    const cands = [{ r: 'E43N41', e: 'E40N40', d: 3, s: 8 }, { r: 'E44N41', e: 'E40N40', d: 4, s: 7 },
        { r: 'E47N47', e: 'E40N40', d: 7, s: 6 }, { r: 'E49N49', e: 'E40N40', d: 10, s: 9 }];
    const picks = plain(x.pick(cands));
    assert.equal(picks.length, 2, 'two homes: two rooms');
    assert.deepEqual(picks.map(p => p.r), ['E43N41', 'E47N47'], 'E49N49 is too far, E44N41 is too close to E43N41');
    assert.notEqual(picks[0].h, picks[1].h);
    assert.ok(picks.every(p => p.c === 'E40N40' && p.d <= 11));
});
