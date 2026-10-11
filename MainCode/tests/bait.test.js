const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

function setup() {
    const h = harness({ 'room.status': { open: () => true }, 'system.badRooms': { isBad: () => false } }), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Game.shard = { name: 'shardX' };
    g.Game.time = 1000;
    g.CREEP_CLAIM_LIFE_TIME = 600;
    g.RESOURCE_ENERGY = 'energy';
    g.Game.gcl = { level: 10 };
    g.Memory.expandIntel = {};
    return { h, g, bait: h.load('system.bait') };
}
const target = { r: 'W1N22', h: 'shard2:E1N16', e: 'W0N20', t: 300 };

test('bait rooms: within 3 of a target, unclaimed and unreserved by others, claimable within a claimer\'s life', () => {
    const { g, bait } = setup();
    const intel = g.Memory.expandIntel;
    intel.W2N22 = { n: 1, t: 1 };                       // 1-source rooms count
    intel.W2N23 = { n: 2, t: 1, o: 'Harabi' };          // owned by someone else
    intel.W1N23 = { n: 2, t: 1, r: 'Harabi' };          // reserved by someone else
    intel.W1N21 = { n: 2, t: 1 };
    intel.W4N22 = { n: 2, t: 1 };                       // 3 away: 300 + 150 + margin fits in 600
    intel.W5N22 = { n: 2, t: 1 };                       // 4 away: outside the radius
    intel.W0N22 = { n: 2, t: 1 };                       // highway
    g.Memory.bait = { block: { W1N21: 5000 } };          // refused a creep until 5000
    const list = bait.report([target]);
    assert.equal(JSON.stringify(list.map(b => b.r).sort()), JSON.stringify(['W2N22', 'W4N22']));
    const near = list.find(b => b.r === 'W2N22');
    assert.equal(near.cl, 0);
    assert.equal(near.k, 350, 'the target\'s trip plus 50 a room');
    assert.equal(near.h, 'shard2:E1N16', 'ordered by the target\'s sponsor');
    // A slower target: the 3-away room can't be claimed in time any more.
    assert.equal(bait.report([Object.assign({}, target, { t: 450 })]).map(b => b.r).includes('W4N22'), false);
});

test('a bait room we hold stays listed first (a keeper creep), with its upgrade block', () => {
    const { g, bait } = setup();
    g.Memory.bait = { rooms: { W2N22: { t: 'W1N22' } } };
    g.Game.rooms.W2N22 = { name: 'W2N22', controller: { my: true, upgradeBlocked: 400 } };
    g.Memory.expandIntel.W1N21 = { n: 2, t: 1 };
    const list = bait.report([target]);
    assert.equal(list[0].r, 'W2N22');
    assert.equal(list[0].cl, 1);
    assert.equal(list[0].ub, 400);
    assert.equal(bait.isBait('W2N22'), true);
    // One of our real rooms is never a bait room.
    g.Game.rooms.W1N21 = { name: 'W1N21', controller: { my: true } };
    assert.equal(bait.report([target]).some(b => b.r === 'W1N21'), false);
});

test('GCL: free slots after every shard\'s rooms, the targets not held, and claimers on the way', () => {
    const { g, bait } = setup();
    g.Game.rooms.A = { controller: { my: true } };
    // 10 levels; 5 + 2 rooms on the home shards, 1 here; one of two targets not held.
    const prog = { W1N22: { cl: 1 } };
    assert.equal(bait.freeSlots([5, 2, undefined], [target, { r: 'W9N9' }], prog), 1);
    g.Game.creeps.c = { memory: { priority: 'xBait', destination: 'W2N22' }, getActiveBodyparts: t => (t === g.CLAIM ? 1 : 0) };
    assert.equal(bait.freeSlots([5, 2], [target, { r: 'W9N9' }], prog), 0);
    delete g.Game.creeps.c;
    bait.noteGcl();
    assert.equal(bait.freeSlots([0], [], {}), 0, 'a claim refused for GCL backs off');
});

test('orders: one creep per room, claims only within free slots, none while blocked past arrival', () => {
    const { bait } = setup();
    const bt = [
        { r: 'A', h: 'shard2:E1N16', e: 'W0N20', cl: 1, k: 350 },
        { r: 'B', h: 'shard2:E1N16', e: 'W0N20', cl: 0, k: 350 },
        { r: 'C', h: 'shard2:E1N16', e: 'W0N20', cl: 0, k: 350 },
        { r: 'D', h: 'shard2:E1N16', e: 'W0N20', cl: 1, k: 350, ub: 500 },
        { r: 'E', h: 'shard2:E1N16', e: 'W0N20', cl: 1, k: 350, n: 1 },
        { r: 'F', h: 'shard1:E9N9', e: 'W0N20', cl: 1, k: 350 },
    ];
    const last = {};
    const first = bait.due(bt, 1, 'shard2', ['E1N16'], [], [], last);
    assert.equal(JSON.stringify(first.map(o => o.memory.destination)), JSON.stringify(['A']), 'one order per home (the spawn queue holds one)');
    assert.equal(first[0].memory.claim, 0, 'held: a keeper body');
    assert.equal(bait.due(bt, 1, 'shard2', ['E1N16'], [], [{ r: 'A' }], last, ['E1N16']).length, 0, 'home busy: nothing more');
    const out = bait.due(bt, 1, 'shard2', ['E1N16'], [], [{ r: 'A' }], last);
    assert.equal(JSON.stringify(out.map(o => o.memory.destination)), JSON.stringify(['B']));
    assert.equal(out[0].memory.claim, 1);
    assert.equal(out[0].memory.xShard.c, 'W0N20');
    // Already ordered (gap), on the way, or queued: nothing more.
    const queued = [{ r: 'A' }, { r: 'B', claim: 1 }];
    assert.equal(bait.due(bt, 1, 'shard2', ['E1N16'], [], queued, {}).length, 0, 'queued: the slot is used');
    const later = {};
    const inFlight = [{ memory: { destination: 'A' } }, { memory: { destination: 'C', claim: 1 } }];
    assert.equal(JSON.stringify(bait.due(bt, 1, 'shard2', ['E1N16'], inFlight, [], later).map(o => o.memory.destination)), JSON.stringify([]),
        'the one free slot is taken by the claimer on its way');
});

function room(g, level, extra = {}) {
    const sites = [], structures = extra.structures || [];
    const r = {
        name: 'W2N22', controller: { my: level > 0, level, pos: pos(g, 25, 25), upgradeBlocked: extra.ub },
        getTerrain: () => ({ get: () => 0 }),
        find: t => (t === g.FIND_SOURCES || t === g.FIND_SOURCES_ACTIVE ? [{ pos: pos(g, 30, 25) }] :
            t === g.FIND_MY_STRUCTURES ? structures : t === g.FIND_MY_CONSTRUCTION_SITES ? sites :
            t === g.FIND_STRUCTURES ? structures : t === g.FIND_CONSTRUCTION_SITES ? sites : t === g.FIND_HOSTILE_CREEPS ? [] : []),
        createConstructionSite: (x, y, type) => { sites.push({ pos: pos(g, x, y), structureType: type }); return g.OK; },
    };
    r.sites = sites;
    return r;
}
function pos(g, x, y) {
    return { x, y, roomName: 'W2N22', findClosestByRange: list => (Array.isArray(list) ? list[0] : { pos: pos(g, 30, 25) }) };
}
function creep(g, r, carry, extra = {}) {
    const calls = [];
    return Object.assign({ name: 'b', room: r, pos: pos(g, 26, 25), owner: { username: 'me' },
        memory: { priority: 'xBait', destination: 'W2N22', baitFor: 'W1N22', full: carry > 0 },
        store: { energy: carry, getFreeCapacity: () => 100 - carry },
        getActiveBodyparts: t => (t === g.CLAIM && extra.claim ? 1 : 0),
        upgradeController: () => { calls.push('upgrade'); return g.OK; },
        build: () => { calls.push('build'); return g.OK; },
        repair: w => { calls.push('repair:' + w.id); return g.OK; },
        transfer: () => { calls.push('transfer'); return g.OK; },
        harvest: () => { calls.push('harvest'); return g.OK; },
        claimController: () => { calls.push('claim'); return extra.claimResult === undefined ? g.OK : extra.claimResult; },
        suicide: () => calls.push('suicide'), travelTo: () => calls.push('travel'), calls }, extra.creep);
}
function creepSetup() {
    const s = setup();
    s.g.CONTROLLER_STRUCTURES = { [s.g.STRUCTURE_TOWER]: { 1: 0, 2: 0, 3: 1 }, [s.g.STRUCTURE_WALL]: { 1: 0, 2: 0, 3: 0 } };
    s.h.load('combat.tactics').escape = () => false;
    return Object.assign(s, { role: s.h.load('creep.xBait') });
}

test('the bait creep upgrades below RCL3; at RCL3 it places, builds and fills one tower first', () => {
    const { g, role } = creepSetup();
    const r2 = room(g, 2);
    g.Game.rooms.W2N22 = r2;
    const c2 = creep(g, r2, 100);
    role.run(c2);
    assert.equal(JSON.stringify(c2.calls), JSON.stringify(['upgrade']));
    const r3 = room(g, 3);
    g.Game.rooms.W2N22 = r3;
    const c3 = creep(g, r3, 100);
    role.run(c3);
    assert.equal(r3.sites.length, 1, 'a tower site placed');
    assert.equal(r3.sites[0].structureType, g.STRUCTURE_TOWER);
    assert.ok(Math.max(Math.abs(r3.sites[0].pos.x - 25), Math.abs(r3.sites[0].pos.y - 25)) >= 2);
    role.run(c3);
    assert.equal(c3.calls[c3.calls.length - 1], 'build');
    const tower = { structureType: g.STRUCTURE_TOWER, pos: pos(g, 23, 23), store: { energy: 100, getCapacity: () => 1000 } };
    const r3t = room(g, 3, { structures: [tower] });
    g.Game.rooms.W2N22 = r3t;
    const c3t = creep(g, r3t, 100);
    role.run(c3t);
    assert.equal(JSON.stringify(c3t.calls), JSON.stringify(['transfer']));
    tower.store.energy = 900;
    role.run(c3t);
    assert.equal(c3t.calls[c3t.calls.length - 1], 'upgrade', 'tower full enough: upgrade');
});

test('the bait creep claims; a blocked or taken controller is noted and the creep recycled; a GCL refusal backs off', () => {
    const { g, role, bait } = creepSetup();
    const free = room(g, 0);
    g.Game.rooms.W2N22 = free;
    const claimer = creep(g, free, 0, { claim: true });
    role.run(claimer);
    assert.equal(JSON.stringify(claimer.calls), JSON.stringify(['claim']));
    assert.equal(bait.isBait('W2N22'), true, 'marked as a bait room once claimed');
    const blocked = room(g, 0, { ub: 700 });
    const c = creep(g, blocked, 0, { claim: true });
    role.run(c);
    assert.equal(JSON.stringify(c.calls), JSON.stringify(['suicide']));
    assert.equal(g.Memory.bait.block.W2N22, 1700);
    const gcl = creep(g, room(g, 0), 0, { claim: true, claimResult: g.ERR_GCL_NOT_ENOUGH });
    role.run(gcl);
    assert.ok(g.Memory.bait.gcl > g.Game.time);
});

test('from RCL2 the bait creep walls the controller (not the harvesting tiles) and keeps the walls at 2,000 hits', () => {
    const { g, role } = creepSetup();
    g.CONTROLLER_STRUCTURES[g.STRUCTURE_WALL] = { 1: 0, 2: 2500, 3: 2500 };
    // A source right by the controller (26,26 next to 25,25): its neighbours stay open.
    const r = room(g, 2);
    const find = r.find;
    r.find = t => (t === g.FIND_SOURCES || t === g.FIND_SOURCES_ACTIVE ? [{ pos: pos(g, 27, 27) }] : find(t));
    g.Game.rooms.W2N22 = r;
    const c = creep(g, r, 100);
    role.run(c);
    const spots = r.sites.filter(s => s.structureType === g.STRUCTURE_WALL).map(s => s.pos.x + ',' + s.pos.y);
    assert.equal(spots.length, 7, 'the 8 controller neighbours minus 26,26 (next to the source)');
    assert.ok(!spots.includes('26,26'));
    assert.equal(c.calls[c.calls.length - 1], 'build');
    // Built: repaired up to 2,000 hits, then back to upgrading.
    const wall = (id, x, y, hits) => ({ id, structureType: g.STRUCTURE_WALL, pos: pos(g, x, y), hits });
    const built = room(g, 2, { structures: [wall('w1', 24, 24, 1500), wall('w2', 25, 24, 400)] });
    built.find = t => (t === g.FIND_SOURCES || t === g.FIND_SOURCES_ACTIVE ? [{ pos: pos(g, 27, 27) }] :
        t === g.FIND_MY_CONSTRUCTION_SITES || t === g.FIND_CONSTRUCTION_SITES ? [] : t === g.FIND_STRUCTURES ? built.walls : []);
    built.walls = [wall('w1', 24, 24, 1500), wall('w2', 25, 24, 400)];
    g.Game.time += 1;
    const c2 = creep(g, built, 100, { creep: { memory: { priority: 'xBait', destination: 'W2N22', full: true, wallCheck: g.Game.time + 50 } } });
    role.run(c2);
    assert.equal(c2.calls[c2.calls.length - 1], 'repair:w2', 'the weakest first');
    built.walls = [wall('w1', 24, 24, 2000), wall('w2', 25, 24, 2100)];
    g.Game.time += 1;
    const c3 = creep(g, built, 100, { creep: { memory: { priority: 'xBait', destination: 'W2N22', full: true, wallCheck: g.Game.time + 50 } } });
    role.run(c3);
    assert.equal(c3.calls[c3.calls.length - 1], 'upgrade');
});

test('no controller walls where the ring would cut a source off from the upgrading tiles', () => {
    const { g, h } = creepSetup();
    // The controller in a 3-wide corridor (x 24-26), a source above it, the room below.
    const r = room(g, 2);
    r.getTerrain = () => ({ get: (x, y) => (x < 24 || x > 26 ? 1 : 0) });
    r.find = t => (t === g.FIND_SOURCES ? [{ pos: pos(g, 25, 10) }] : []);
    assert.equal(h.load('creep.xBait').wallSpots(r).length, 0);
});

test('a bait claimer finding the controller walled in (our walls from before the room was lost) breaks through the weakest', () => {
    const { g, role } = creepSetup();
    const r = room(g, 0);
    const walls = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (dx || dy) walls.push({ id: 'w' + dx + dy, structureType: g.STRUCTURE_WALL, pos: pos(g, 25 + dx, 25 + dy), hits: dx === 1 && dy === 1 ? 300 : 2000 });
    }
    r.find = t => (t === g.FIND_STRUCTURES ? walls : t === g.FIND_SOURCES ? [{ pos: pos(g, 30, 25) }] : []);
    g.Game.rooms.W2N22 = r;
    const c = creep(g, r, 0, { claim: true, claimResult: g.ERR_NOT_IN_RANGE });
    c.dismantle = w => { c.calls.push('dismantle:' + w.id); return g.OK; };
    role.run(c);
    assert.equal(c.calls[c.calls.length - 1], 'dismantle:w11');
});

test('a bait centre (dropped target): the room itself and the rooms within 3 of it, ordered by its old sponsor', () => {
    const { g, bait } = setup();
    const focus = { r: 'W1N9', h: 'shard2:E3N12', e: 'E0N10', t: 481 };
    const centre = { r: 'W1N22', h: 'shard2:E1N16', e: 'W0N20', t: 353 };
    g.Game.rooms.W1N22 = { name: 'W1N22', controller: { my: true } };
    bait.claimed('W1N22', 'W1N22');     // shardX marks an owned centre as a bait room
    g.Memory.expandIntel.W2N23 = { n: 2, t: 1 };
    const list = bait.report([focus], [centre]);
    const own = list.find(b => b.r === 'W1N22');
    assert.ok(own, 'the centre itself');
    assert.equal(own.cl, 1);
    assert.equal(own.h, 'shard2:E1N16');
    assert.equal(list.find(b => b.r === 'W2N23').h, 'shard2:E1N16');
    // The focused target is never a bait room.
    g.Game.rooms.W1N9 = { name: 'W1N9', controller: { my: true } };
    assert.equal(bait.report([focus], [centre]).some(b => b.r === 'W1N9'), false);
});

test('everywhere else scouted: every room a claimer reaches in time is a bait room, sponsored by the home that scouted it fastest, after the rooms around the targets', () => {
    const { g, bait } = setup();
    const intel = g.Memory.expandIntel;
    intel.W2N22 = { n: 2, t: 1 };                                 // next to the target
    intel.E21N33 = { n: 1, t: 1 }; intel.E22N33 = { n: 2, t: 1 }; intel.E23N33 = { n: 2, t: 1, o: 'Harabi' };
    intel.E27N33 = { n: 2, t: 1 };
    g.Memory.xs = { tag: {
        E21N33: { h: 'shard3:E29N43', e: 'E30N40', t: 420 },
        E22N33: { h: 'shard1:E28N48', e: 'E30N40', t: 200 },
        E23N33: { h: 'shard1:E28N48', e: 'E30N40', t: 210 },     // someone else's room
        E27N33: { h: 'shard1:E28N48', e: 'E30N40', t: 560 },     // too far for a claimer
        W2N22: { h: 'shard2:E3N12', e: 'E0N10', t: 400 },        // already listed by the target
    } };
    const list = bait.report([target]);
    assert.equal(list.map(b => b.r).join(), 'W2N22,E22N33,E21N33', 'the target\'s ring first, then the rest by trip');
    const wide = list.find(b => b.r === 'E21N33');
    assert.equal(wide.h, 'shard3:E29N43');
    assert.equal(wide.e, 'E30N40');
    assert.equal(wide.k, 420);
    assert.equal(list.find(b => b.r === 'W2N22').h, 'shard2:E1N16', 'around a target: still its sponsor');
    // Without targets (shardX off or scouting) nothing is reported.
    assert.equal(bait.report([]).length, 0);
});

test('no new bait claims while shardX is short of CPU', () => {
    const { g, h, bait } = setup();
    g.Game.cpu.bucket = 9000;
    assert.equal(bait.freeSlots([0], [], {}), 10);
    g.Game.cpu.bucket = 3000;
    assert.equal(bait.freeSlots([0], [], {}), 0, 'low bucket');
    g.Game.cpu.bucket = 9000;
    h.load('runtime.cpuGovernor');
    g.Memory.cpuGov = { ema: 0, shed: 1, adjusted: 0, pixel: 0 };
    assert.equal(bait.freeSlots([0], [], {}), 0, 'the governor is shedding');
});

test('a bait room gets a spawn site built to about 200 energy and no further; a destroyed one is replaced only after a while', () => {
    const { g, role, bait } = creepSetup();
    const r = room(g, 1);
    g.Game.rooms.W2N22 = r;
    bait.claimed('W2N22', 'W1N22');
    const c = creep(g, r, 100);
    role.run(c);
    const site = r.sites.find(s => s.structureType === g.STRUCTURE_SPAWN);
    assert.ok(site, 'spawn site placed');
    assert.equal(c.calls[c.calls.length - 1], 'upgrade', 'placed this tick, built from the next');
    site.progress = 50;
    role.run(c);
    assert.equal(c.calls[c.calls.length - 1], 'build');
    site.progress = 200;
    role.run(c);
    assert.equal(c.calls[c.calls.length - 1], 'upgrade', '200 in: left as it is');
    // Stomped: not placed again right away.
    r.sites.length = 0;
    role.run(c);
    assert.equal(r.sites.length, 0);
    g.Game.time += 1500;
    role.run(c);
    assert.equal(r.sites.filter(s => s.structureType === g.STRUCTURE_SPAWN).length, 1);
});
