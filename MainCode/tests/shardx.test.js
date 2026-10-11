const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

function setup(shard = 'shard2', remote = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    h.context.Memory.settings = Object.assign({}, h.context.Memory.settings, { shardX: true });   // these tests exercise shardX switched on
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

test('bait rooms: shardX reports them with its free GCL slots; once done, the target\'s sponsor still orders their creeps', () => {
    const { g, x, local } = setup('shard1', {
        shard2: { mode: 'done', targets: [{ r: 'E36N36', h: 'shard1:E28N48', e: 'E40N40', t: 300 }] },
        shardX: { progress: {}, bt: [{ r: 'E37N36', t: 'E36N36', h: 'shard1:E28N48', e: 'E40N40', cl: 0, k: 350, n: 0 }], bf: 1 },
    });
    g.Game.rooms = { E28N48: owned(g, 'E28N48') };
    g.Game.creeps = {};
    g.Game.time = 5025;
    x.run();
    const order = g.Memory.xs.queue.E28N48;
    assert.equal(order.kind, 'xBait');
    assert.equal(order.memory.destination, 'E37N36');
    assert.equal(order.memory.claim, 1);
    assert.equal(x.spawnOrder('E28N48').body[0], g.CLAIM);
    // Home shards publish their room count for shardX's GCL sum.
    g.Memory.xs.dirty = 1;
    x.run();
    assert.equal(JSON.parse(local.value).xs.rc, 1);
});

test('shardX publishes the bait rooms and free GCL slots with its progress', () => {
    const { g, x, local } = setup('shardX', {
        shard2: { mode: 'claim', targets: [{ r: 'E36N36', h: 'shard1:E28N48', e: 'E40N40', t: 300 }], rc: 4 },
        shard1: { rc: 2 }, shard3: { rc: 0 },
    });
    g.Game.gcl = { level: 9 };
    g.CREEP_CLAIM_LIFE_TIME = 600;
    g.Game.map.getRoomStatus = () => ({ status: 'normal' });
    g.Game.rooms = {};
    g.Game.creeps = {};
    g.Memory.expandIntel = { E37N36: { n: 1, t: 1 } };
    g.Game.time = 5100;
    x.run();
    const out = JSON.parse(local.value).xs;
    assert.equal(out.bt.map(b => b.r).join(), 'E37N36');
    assert.equal(out.bf, 2, '9 levels - 6 rooms - the target not held yet');
});

test('shardX("focus"): one target stays, the others become bait centres; their quads still here go to it, their travellers go home', () => {
    const { g, x, h, local } = setup('shard2');
    const targets = [{ r: 'E22N32', h: 'shard2:E18N26', e: 'E20N30', t: 412 }, { r: 'W1N22', h: 'shard2:E1N16', e: 'W0N20', t: 353 },
        { r: 'W1N9', h: 'shard2:E3N12', e: 'E0N10', t: 481 }];
    g.Memory.xs = { mode: 'claim', targets: targets.slice(), manual: 1 };
    g.Game.rooms = { E3N12: owned(g, 'E3N12'), E1N16: owned(g, 'E1N16') };
    // A W1N22 quad still boosting at E1N16, and one with a member already over the portal.
    const squads = h.load('system.guardSquads');
    const st = squads.state();
    const member = (name, extra = {}) => ({ name, memory: Object.assign({ priority: 'roomGuard', homeRoom: 'E1N16', destination: 'W1N22',
        guardTargetShard: 'shardX', guardSquad: 'q1', xTarget: 1, xShard: { c: 'W0N20' }, guardStaging: { room: 'W0N22' } }, extra) });
    g.Game.creeps = { a: member('a'), b: member('b'), c: member('c', { guardSquad: 'q2' }) };
    st.targets['shardX:W1N22'] = { shard: 'shardX', room: 'W1N22', home: 'E1N16', corner: 'W0N20', squads: [
        { id: 'q1', home: 'E1N16', created: 1, slots: [{ slot: 0, name: 'a' }, { slot: 1, name: 'b' }, { slot: 2 }, { slot: 3 }] },
        { id: 'q2', home: 'E1N16', created: 1, slots: [{ slot: 0, name: 'c' }, { slot: 1, name: 'gone' }, { slot: 2 }, { slot: 3 }] }], samples: {} };
    const text = x.command('focus', ['W1N9']);
    assert.match(text, /2 quad member/);
    assert.equal(g.Memory.xs.targets.map(t => t.r).join(), 'W1N9');
    assert.equal(g.Memory.xs.baitCenters.map(c => c.r + '@' + c.h).join(), 'E22N32@shard2:E18N26,W1N22@shard2:E1N16');
    assert.equal(g.Game.creeps.a.memory.destination, 'W1N9');
    assert.equal(g.Game.creeps.a.memory.xShard.c, 'E0N10');
    assert.equal(g.Game.creeps.a.memory.guardStaging, undefined);
    assert.equal(st.targets['shardX:W1N9'].squads.map(q => q.id).join(), 'q1');
    assert.equal(g.Game.creeps.c.memory.destination, 'W1N22', 'half over the portal: stays with its room');
    assert.equal(x.focused(), true);
    // Published for shardX and the other home shards.
    x.run();
    assert.equal(JSON.parse(local.value).xs.baitCenters.length, 2);
});


test('while focused, a claimer or helper still on its way to a bait centre goes home; bait creeps still head for the corner', () => {
    const { g, x } = setup('shard1', { shard2: { mode: 'claim', targets: [{ r: 'W1N9', h: 'shard2:E3N12', e: 'E0N10' }],
        baitCenters: [{ r: 'W1N22', h: 'shard2:E1N16', e: 'W0N20' }] } });
    g.Memory.xs = {};
    g.RoomPosition = function (x, y, roomName) { Object.assign(this, { x, y, roomName }); };
    const calls = [];
    const traveller = memory => ({ name: memory.priority, memory, room: { name: 'E1N16' },
        travelTo: target => calls.push([memory.priority, 'travel', target.roomName]), suicide: () => calls.push([memory.priority, 'suicide']) });
    // Its home is not a room here any more (this fixture): recall retires it on the spot.
    assert.equal(x.portalStep(traveller({ priority: 'helper', destination: 'W1N22', xTarget: 1, xShard: { c: 'W0N20' }, homeRoom: 'E1N16' })), true);
    assert.equal(JSON.stringify(calls), JSON.stringify([['helper', 'suicide']]), 'recalled, not sent to the corner');
    calls.length = 0;
    x.portalStep(traveller({ priority: 'xBait', destination: 'W1N22', xShard: { c: 'W0N20' }, homeRoom: 'E1N16' }));
    assert.equal(JSON.stringify(calls), JSON.stringify([['xBait', 'travel', 'W0N20']]));
    calls.length = 0;
    x.portalStep(traveller({ priority: 'helper', destination: 'W1N9', xTarget: 1, xShard: { c: 'E0N10' }, homeRoom: 'E3N12', loaded: 1 }));
    assert.equal(calls[0] && calls[0][2], 'E0N10', 'a W1N9 helper goes on');
});

test('focus shift: the focus room under an upgrade block hands over to the held bait room furthest along; quads (even those over the portal) follow', () => {
    const { g, x, h } = setup('shard2');
    g.Game.notify = () => {};
    const w1n9 = { r: 'W1N9', h: 'shard2:E3N12', e: 'E0N10', t: 481 };
    g.Memory.xs = { mode: 'claim', manual: 1, targets: [w1n9], baitCenters: [{ r: 'W1N22', h: 'shard2:E1N16', e: 'W0N20', t: 353 }] };
    g.Game.rooms = { E3N12: owned(g, 'E3N12'), E1N16: owned(g, 'E1N16') };
    const st = h.load('system.guardSquads').state();
    st.targets['shardX:W1N9'] = { shard: 'shardX', room: 'W1N9', home: 'E3N12', corner: 'E0N10', samples: {}, squads: [
        { id: 'q', home: 'E3N12', created: 1, slots: [0, 1, 2, 3].map(i => ({ slot: i, name: 'm' + i,
            memory: { priority: 'roomGuard', destination: 'W1N9', guardSquad: 'q', guardTargetShard: 'shardX' } })) }] };
    g.Game.creeps = {};      // all four are posted on shardX
    const bt = [
        { r: 'W2N9', h: 'shard2:E3N12', e: 'E0N10', cl: 1, lv: 2, pg: 9000, k: 450, ns: 2 },
        { r: 'E4N15', h: 'shard2:E1N16', e: 'E0N10', cl: 1, lv: 5, pg: 0, k: 300, ns: 1 },     // 1 source: never the focus
        { r: 'E5N15', h: 'shard2:E1N16', e: 'E0N10', cl: 1, lv: 3, pg: 100, k: 300, ns: 2 },
        { r: 'E6N15', h: 'shard2:E1N16', e: 'E0N10', cl: 1, lv: 4, pg: 0, k: 300, ub: 300, ns: 2 },   // attacked too
        { r: 'E7N15', h: 'shard2:E1N16', e: 'E0N10', cl: 0, k: 300 },
    ];
    // Not attacked: nothing happens.
    assert.equal(x.shiftFocus({ progress: { W1N9: { cl: 1 } }, bt }), null);
    const shift = x.shiftFocus({ progress: { W1N9: { cl: 1, ub: 900 } }, bt });
    assert.equal(shift.to, 'E5N15', 'RCL3 beats RCL2; a blocked room and a 1-source room are skipped');
    assert.equal(JSON.stringify(g.Memory.xs.targets.map(t => [t.r, t.h, t.e])), JSON.stringify([['E5N15', 'shard2:E1N16', 'E0N10']]));
    assert.equal(g.Memory.xs.baitCenters.map(c => c.r).join(), 'W1N22,W1N9', 'the old focus is a decoy now');
    assert.equal(st.targets['shardX:E5N15'].squads.map(q => q.id).join(), 'q', 'its quads move along');
    assert.equal(st.targets['shardX:E5N15'].squads[0].slots[0].memory.destination, 'E5N15', 'manifests rewritten for the members over the portal');
    // Until shardX reports it, the new focus counts as held: no claimer for a room that is ours.
    g.Game.time = 5025;
    x.run();
    assert.notEqual((g.Memory.xs.queue.E1N16 || {}).kind, 'claimer');
    // The next attack shifts again.
    assert.equal(x.shiftFocus({ progress: { E5N15: { cl: 1, ub: 50 } }, bt: [{ r: 'W1N9', h: 'shard2:E3N12', e: 'E0N10', cl: 1, lv: 4, pg: 0, k: 481, ns: 2 }] }).to, 'W1N9');
    assert.equal(g.Memory.xs.shifts.length, 2);
});

test('on shardX the promoted room leaves the bait rooms and is built fortified', () => {
    const { g, x, local } = setup('shardX', { shard2: { mode: 'claim', targets: [{ r: 'E5N15', h: 'shard2:E1N16', e: 'E0N10', t: 300 }] } });
    g.Game.gcl = { level: 9 };
    g.CREEP_CLAIM_LIFE_TIME = 600;
    g.Game.map.getRoomStatus = () => ({ status: 'normal' });
    g.Game.creeps = {};
    g.Game.rooms = { E5N15: { name: 'E5N15', controller: { my: true, level: 3 }, find: () => [] } };
    g.Memory.bait = { rooms: { E5N15: { t: 'W1N9' } }, block: {} };
    g.Game.time = 5100;
    x.run();
    assert.equal(g.Memory.bait.rooms.E5N15, undefined);
    assert.ok(g.Memory.xs.fortify.E5N15);
    assert.ok(JSON.parse(local.value).xs.progress.E5N15);
});

test('a home orders a CARRY+MOVE pest for a Harabi-reserved room it scouted', () => {
    const { g, x } = setup('shard1', {
        shard2: { mode: 'done', targets: [{ r: 'E36N36', h: 'shard1:E28N48', e: 'E40N40', t: 300 }] },
        shardX: { progress: {}, bt: [], bf: 0, nz: [{ r: 'E35N38', h: 'shard1:E28N48', e: 'E40N40', k: 200, n: 0 }] },
    });
    g.Game.rooms = { E28N48: owned(g, 'E28N48') };
    g.Game.creeps = {};
    g.Game.time = 5025;
    x.run();
    const order = g.Memory.xs.queue.E28N48;
    assert.equal(order.kind, 'xNuisance');
    assert.equal(order.memory.destination, 'E35N38');
    assert.equal(x.spawnOrder('E28N48').body.join(), [g.CARRY, g.MOVE].join());
});
