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
    g.Game.rooms.W2N22 = { name: 'W2N22', controller: { my: true, upgradeBlocked: 400 }, find: () => [{}, {}] };
    g.Memory.expandIntel.W1N21 = { n: 2, t: 1 };
    const list = bait.report([target]);
    assert.equal(list[0].r, 'W2N22');
    assert.equal(list[0].cl, 1);
    assert.equal(list[0].ub, 400);
    assert.equal(list[0].ns, 2, 'its sources, for a focus shift');
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
    assert.equal(c3t.calls[c3t.calls.length - 1], 'transfer', '900 of 1000: filled up, not left at half');
    tower.store.energy = 1000;
    role.run(c3t);
    assert.equal(c3t.calls[c3t.calls.length - 1], 'upgrade', 'full: upgrade');
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
    assert.equal(r.sites.length, 1, 'one wall site at a time: the sites are the main rooms\'');
    assert.equal(c.calls[c.calls.length - 1], 'build');
    // Each finished, the next: the 8 controller neighbours minus 26,26 (next to the source).
    const walls = [], spots = [];
    const roomFind = r.find;
    r.find = t => (t === g.FIND_STRUCTURES ? walls : roomFind(t));
    for (let i = 0; i < 12 && r.sites.length; i++) {
        const done = r.sites.pop();
        spots.push(done.pos.x + ',' + done.pos.y);
        walls.push({ id: 'w' + i, structureType: g.STRUCTURE_WALL, pos: done.pos, hits: 5000 });
        g.Game.time += 101;
        role.run(c);
    }
    assert.equal(spots.length, 7, spots.join(' '));
    assert.ok(!spots.includes('26,26'));
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
    const { g, h, role } = creepSetup();
    const r = room(g, 0);
    const walls = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (dx || dy) walls.push({ id: 'w' + dx + dy, structureType: g.STRUCTURE_WALL, pos: pos(g, 25 + dx, 25 + dy), hits: dx === 1 && dy === 1 ? 300 : 2000 });
    }
    r.find = t => (t === g.FIND_STRUCTURES ? walls : t === g.FIND_SOURCES ? [{ pos: pos(g, 30, 25) }] : []);
    g.Game.rooms.W2N22 = r;
    // PathFinder (creep.breach): walls crossable at a cost, the weakest cheapest; the path goes
    // through it.
    g.PathFinder = { CostMatrix: function () { const m = {}; this.get = (x, y) => m[x * 50 + y] || 0; this.set = (x, y, v) => { m[x * 50 + y] = v; }; },
        search: (from, goal, opts) => {
            const m = opts.roomCallback('W2N22');
            const cheapest = walls.slice().sort((a, b) => m.get(a.pos.x, a.pos.y) - m.get(b.pos.x, b.pos.y))[0];
            return { incomplete: false, path: [{ x: cheapest.pos.x, y: cheapest.pos.y }] };
        } };
    const c = creep(g, r, 0, { claim: true, claimResult: g.ERR_NOT_IN_RANGE });
    c.dismantle = w => { c.calls.push('dismantle:' + w.id); return g.OK; };
    c.getActiveBodyparts = t => (t === g.WORK || t === g.ATTACK || t === g.CLAIM ? 1 : 0);
    c.pos.inRangeTo = () => false;
    c.pos.isNearTo = () => true;
    g.Game.getObjectById = id => walls.find(w => w.id === id) || null;
    g.Game.time = 5000;
    role.run(c);
    assert.equal(c.calls[c.calls.length - 1], 'dismantle:w11', JSON.stringify(c.calls));
    assert.equal(c.memory.breachId, 'w11', 'kept until it is gone');
    assert.ok(h.load('system.bait').body(true).includes(g.ATTACK), 'the claimer carries an ATTACK part');
});

test('a bait centre (dropped target): the room itself and the rooms within 3 of it, ordered by its old sponsor', () => {
    const { g, bait } = setup();
    const focus = { r: 'W1N9', h: 'shard2:E3N12', e: 'E0N10', t: 481 };
    const centre = { r: 'W1N22', h: 'shard2:E1N16', e: 'W0N20', t: 353 };
    g.Game.rooms.W1N22 = { name: 'W1N22', controller: { my: true }, find: () => [{}, {}] };
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

test('a bait creep that finds the room reserved by someone else records it before leaving (it may become a pest room)', () => {
    const { g, role } = creepSetup();
    const r = room(g, 0);
    r.controller.reservation = { username: 'Harabi' };
    g.Game.rooms.W2N22 = r;
    g.Memory.expandIntel = {};
    const c = creep(g, r, 0, { claim: true });
    role.run(c);
    const recorded = g.Memory.expandIntel.W2N22;
    assert.ok(recorded, 'recorded');
    assert.equal(recorded.r, 'Harabi');
    assert.equal(c.calls[c.calls.length - 1], 'suicide');
});

// Decoy bases: the plan built by the room's creep, one site at a time.
function decoyRoom(level, { sources = [[10, 10]], structures = [], sites = [] } = {}) {
    const { harness } = require('./harness');
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Game.shard = { name: 'shardX' };
    g.RESOURCE_ENERGY = 'energy';
    g.CONTROLLER_STRUCTURES = {
        [g.STRUCTURE_TOWER]: { 1: 0, 2: 0, 3: 1, 4: 1 }, [g.STRUCTURE_WALL]: { 1: 0, 2: 0, 3: 0, 4: 0 },
        [g.STRUCTURE_SPAWN]: { 1: 1, 2: 1, 3: 1, 4: 1 }, [g.STRUCTURE_EXTENSION]: { 1: 0, 2: 5, 3: 10, 4: 20 },
    };
    g.CONTROLLER_DOWNGRADE = { 1: 20000, 2: 10000, 3: 20000, 4: 40000 };
    const posAt = (x, y) => ({ x, y, roomName: 'D', lookFor: () => [],
        findClosestByRange: list => (Array.isArray(list) ? list[0] : null) });
    g.Game.map.getRoomTerrain = () => ({ get: (x, y) => (x === 0 || y === 0 || x === 49 || y === 49 ? 1 : 0) });
    g.Game.constructionSites = {};
    const room = { name: 'D', controller: { my: true, level, pos: posAt(25, 40), ticksToDowngrade: 19000 },
        getTerrain: () => g.Game.map.getRoomTerrain('D'),
        find: t => (t === g.FIND_SOURCES || t === g.FIND_SOURCES_ACTIVE ? sources.map(([x, y]) => ({ pos: posAt(x, y) })) :
            t === g.FIND_MINERALS ? [] : t === g.FIND_STRUCTURES || t === g.FIND_MY_STRUCTURES ? structures :
            t === g.FIND_MY_CONSTRUCTION_SITES || t === g.FIND_CONSTRUCTION_SITES ? sites : []),
        createConstructionSite: (x, y, type) => { sites.push({ pos: posAt(x, y), structureType: type, progress: 0 }); return g.OK; } };
    g.Game.rooms = { D: room };
    g.Memory.bait = { rooms: { D: { t: 'T', since: 1, spawnAt: 1 } }, block: {} };
    const builder = h.load('base.builder');
    const calls = [];
    const creep = { name: 'b', room, pos: posAt(25, 30), owner: { username: 'me' },
        memory: { priority: 'xBait', destination: 'D', full: true }, store: { energy: 100, getFreeCapacity: () => 0 },
        getActiveBodyparts: () => 0, upgradeController: () => { calls.push('upgrade'); return g.OK; },
        build: t => { calls.push('build:' + t.structureType); return g.OK; }, travelTo: () => calls.push('travel') };
    h.load('combat.tactics').escape = () => false;
    return { h, g, room, sites, structures, builder, creep, calls, role: h.load('creep.xBait'), posAt };
}

test('a one-source decoy gets a normal base plan, and its creep builds it one site at a time, tower first', () => {
    const s = decoyRoom(3);
    assert.ok(s.builder.planRoom(s.room), 'the plan fits with one source');
    const plan = s.builder.planOf('D');
    assert.ok(plan.structures.spawn.length === 3 && plan.structures.extension.length === 60);
    assert.equal(plan.flags.upgradeMiner, undefined, 'no second source to work');
    const X = t => (t / 50) | 0, Y = t => t % 50;
    s.role.run(s.creep);
    assert.equal(s.sites.length, 1);
    assert.equal(s.sites[0].structureType, s.g.STRUCTURE_TOWER, 'the tower first');
    s.role.run(s.creep);
    assert.equal(s.sites.length, 1, 'no second site while one is open');
    assert.equal(s.calls[s.calls.length - 1], 'build:' + s.g.STRUCTURE_TOWER);
    // The tower stands (full): the next site is the planned spawn.
    const towerSite = s.sites.pop();
    s.structures.push({ structureType: s.g.STRUCTURE_TOWER, my: true, pos: towerSite.pos, store: { energy: 1000, getCapacity: () => 1000 } });
    s.g.Game.time++;
    s.role.run(s.creep);
    assert.equal(s.sites[0].structureType, s.g.STRUCTURE_SPAWN);
    assert.ok(plan.structures.spawn.some(t => X(t) === s.sites[0].pos.x && Y(t) === s.sites[0].pos.y), 'on its planned tile');
    assert.equal(s.calls[s.calls.length - 1], 'upgrade', 'placed this tick; building starts on the next');
});

test('a decoy leaves the construction sites to the main rooms: none placed from 50 on the shard', () => {
    const s = decoyRoom(3);
    s.builder.planRoom(s.room);
    for (let i = 0; i < 50; i++) s.g.Game.constructionSites['x' + i] = {};
    s.structures.push({ structureType: s.g.STRUCTURE_TOWER, my: true, pos: s.posAt(30, 30), store: { energy: 1000, getCapacity: () => 1000 } });
    s.role.run(s.creep);
    assert.equal(s.sites.length, 0);
    assert.equal(s.calls[s.calls.length - 1], 'upgrade');
});

test('a decoy creep drops building to upgrade when the controller timer runs low, and with all its level allows built', () => {
    const s = decoyRoom(3);
    s.builder.planRoom(s.room);
    s.sites.push({ pos: s.posAt(30, 30), structureType: s.g.STRUCTURE_EXTENSION, progress: 0 });
    s.room.controller.ticksToDowngrade = 5000;     // under 30% of 20,000
    s.role.run(s.creep);
    assert.equal(s.calls[s.calls.length - 1], 'upgrade');
    s.room.controller.ticksToDowngrade = 8000;     // still under 50%: it finishes the job
    s.role.run(s.creep);
    assert.equal(s.calls[s.calls.length - 1], 'upgrade');
    s.room.controller.ticksToDowngrade = 11000;
    s.role.run(s.creep);
    assert.equal(s.calls[s.calls.length - 1], 'build:' + s.g.STRUCTURE_EXTENSION);
    // Below RCL3 the controller comes first: the tower is the point.
    const r2 = decoyRoom(2);
    r2.sites.push({ pos: r2.posAt(30, 30), structureType: r2.g.STRUCTURE_SPAWN, progress: 200 });
    r2.room.controller.ticksToDowngrade = 9000;
    r2.role.run(r2.creep);
    assert.equal(r2.calls[r2.calls.length - 1], 'upgrade');
});

test('a decoy runs no room upkeep; the room is nobody\'s home', () => {
    const s = decoyRoom(3);
    const spawning = s.h.load('system.spawning');
    let touched = 0;
    const roomGuard = new Proxy({}, { get: () => { touched++; return undefined; } });
    s.g.Game.time = 1001;     // between looks at its spawn
    s.g.Game.spawns = { Spawn1: { name: 'Spawn1', room: { name: 'D', get controller() { touched++; return roomGuard; } } } };
    s.g.Memory.settings = s.g.Memory.settings || {};
    spawning.handleSpawning();
    assert.equal(touched, 0, 'skipped before anything reads the room');
    const room = s.room;
    s.g.Game.spawns.Spawn1.room = room;
    room.storage = { store: { energy: 50000 } };
    s.g.Game.rooms.D = room;
    assert.equal(s.h.load('system.energyFlow').budget(room), null);
    assert.equal(s.h.load('system.bait').isBait('D'), true);
});

const { plain } = require('./harness');
// A decoy's own spawn keeps one creep of its own going.
function localSpawn(energy = 300, { threats = [] } = {}) {
    const s = decoyRoom(3);
    const { g } = s;
    s.h.load('combat.tactics').armedThreats = () => threats;
    g.Game.time = 1000;
    g.Game.cpu.bucket = 5000;
    g.Game.creeps = {};
    s.room.energyAvailable = energy;
    const orders = [];
    const spawn = { name: 'S', room: s.room, spawning: null, isActive: () => true,
        spawnCreep: (body, name, opts) => { orders.push({ body, name, memory: opts.memory }); return g.OK; } };
    return Object.assign(s, { spawn, orders, keep: s.h.load('system.bait').keepLocal });
}

test('a decoy spawn orders one creep with the bait job for its room', () => {
    const s = localSpawn();
    assert.equal(s.keep(s.spawn), true);
    assert.equal(s.orders.length, 1);
    const m = s.orders[0].memory;
    assert.deepEqual([m.priority, m.destination, m.baitFor, m.homeRoom, m.baitLocal], ['xBait', 'D', 'T', 'D', 1]);
    assert.equal(m.xShard, undefined, 'it is already there');
    assert.deepEqual(plain(s.orders[0].body), plain(s.h.load('system.bait').localBody(300)));
    assert.equal(s.keep(s.spawn), false, 'a second spawn the same tick orders none');
    assert.equal(s.orders.length, 1);
});

test('only one of its own at a time; a creep from the sponsor does not count', () => {
    const s = localSpawn();
    s.g.Game.creeps = { ext: { memory: { priority: 'xBait', destination: 'D', xShard: { c: 'X' } } } };
    assert.equal(s.keep(s.spawn), true, 'works alongside the sponsor creep');
    s.g.Game.time += 10;
    s.g.Game.creeps.own = { memory: { priority: 'xBait', destination: 'D', baitLocal: 1 } };
    assert.equal(s.keep(s.spawn), false);
    delete s.g.Game.creeps.own;
    assert.equal(s.keep(s.spawn), true, 'the next once it is gone');
});

test('no order short of energy, between looks, spawning, inactive, on a low bucket or with armed hostiles in the room', () => {
    let s = localSpawn(299);
    assert.equal(s.keep(s.spawn), false, 'under 300');
    s = localSpawn(1250);
    assert.equal(s.keep(s.spawn), true);
    assert.equal(plain(s.orders[0].body).filter(p => p === s.g.WORK).length, 5, 'the largest body when the room has it');
    s = localSpawn();
    s.g.Game.time = 1003;
    assert.equal(s.keep(s.spawn), false, 'between looks');
    s = localSpawn();
    s.spawn.spawning = { name: 'x' };
    assert.equal(s.keep(s.spawn), false, 'busy');
    s = localSpawn();
    s.spawn.isActive = () => false;
    assert.equal(s.keep(s.spawn), false, 'over its level allows');
    s = localSpawn();
    s.g.Game.cpu.bucket = 500;
    assert.equal(s.keep(s.spawn), false, 'low bucket');
    s = localSpawn(300, { threats: [{}] });
    assert.equal(s.keep(s.spawn), false, 'it would be shot');
});

test('the next decoy worker is as large as the room\'s energy pays for, up to 5 WORK', () => {
    const { g, h } = localSpawn();
    const { localBody } = h.load('system.bait');
    const cost = parts => parts.reduce((n, p) => n + (p === g.WORK ? 100 : 50), 0);
    const works = e => plain(localBody(e)).filter(p => p === g.WORK).length;
    assert.equal(works(300), 1);
    assert.equal(works(550), 2);
    assert.equal(works(800), 3);
    assert.equal(works(1250), 5);
    assert.equal(works(5000), 5, 'more would be wasted on one source');
    for (const e of [300, 350, 449, 550, 800, 1249, 1250, 5000]) {
        assert.ok(cost(plain(localBody(e))) <= e, 'affordable at ' + e);
        assert.ok(plain(localBody(e)).includes(g.CARRY) && plain(localBody(e)).includes(g.MOVE));
    }
});

function fillCase({ energyAvailable = 300, ext = [], builtTower = true } = {}) {
    const s = decoyRoom(5);
    const { g, room, creep, structures } = s;
    g.CONTROLLER_STRUCTURES[g.STRUCTURE_TOWER][5] = 2;
    g.CONTROLLER_STRUCTURES[g.STRUCTURE_WALL][5] = 0;
    g.CONTROLLER_DOWNGRADE[5] = 80000;
    g.RESOURCE_ENERGY = 'energy';
    room.energyAvailable = energyAvailable;
    room.controller.ticksToDowngrade = 79000;
    if (builtTower) structures.push({ structureType: g.STRUCTURE_TOWER, my: true, pos: s.posAt(40, 40), store: { energy: 1000, getCapacity: () => 1000 } });
    const list = ext.map(([x, y, free, active = true]) => ({ id: 'e' + x, structureType: g.STRUCTURE_EXTENSION, my: true, pos: s.posAt(x, y), store: { getFreeCapacity: () => free }, isActive: () => active }));
    structures.push(...list);
    const realFind = room.find;
    room.find = (type, opts) => {
        const all = realFind(type);
        if (!opts) return all;
        return all.filter(typeof opts.filter === 'function' ? opts.filter : o => o.structureType === opts.filter.structureType);
    };
    const gave = [];
    creep.transfer = t => { gave.push(t.id); return g.OK; };
    creep.pos.findClosestByRange = l => l[0] || null;
    s.g.Game.time += 101;
    return Object.assign(s, { gave, list });
}

test('a decoy worker fills built extensions before building on; none left or the room full, it builds', () => {
    let c = fillCase({ ext: [[30, 30, 50], [31, 30, 0]] });
    c.role.run(c.creep);
    assert.deepEqual(c.gave, ['e30'], 'the one with room');
    c = fillCase({ ext: [[31, 30, 0]] });
    c.role.run(c.creep);
    assert.deepEqual(c.gave, [], 'all full');
    c = fillCase({ energyAvailable: 1250, ext: [[30, 30, 50]] });
    c.role.run(c.creep);
    assert.deepEqual(c.gave, [], 'enough for the largest next worker');
    c = fillCase({ ext: [[30, 30, 50, false]] });
    c.role.run(c.creep);
    assert.deepEqual(c.gave, [], 'not an inactive one: it would never count');
});

test('a low controller timer still comes first', () => {
    const c = fillCase({ ext: [[30, 30, 50]] });
    c.room.controller.ticksToDowngrade = 100;
    c.role.run(c.creep);
    assert.deepEqual(c.gave, []);
    assert.equal(c.calls[c.calls.length - 1], 'upgrade');
});
