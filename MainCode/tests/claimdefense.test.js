const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

const body = (type, n) => Array.from({ length: n }, () => ({ type, hits: 100 }));
const hostile = (g, owner, parts) => ({ id: owner, owner: { username: owner }, body: parts, pos: { x: 20, y: 20, roomName: 'NEW' },
    getActiveBodyparts: type => parts.filter(p => p.type === type).length });

function room(g, { hostiles = [], towers = 0, energy = 300, capacity = 550 } = {}) {
    const towerObjs = Array.from({ length: towers }, (_, i) => ({ id: 't' + i, structureType: g.STRUCTURE_TOWER, store: { [g.RESOURCE_ENERGY]: 1000 } }));
    return { name: 'NEW', energyAvailable: energy, energyCapacityAvailable: capacity, controller: { my: true, level: 2, pos: { x: 25, y: 25, roomName: 'NEW' } },
        find: type => (type === g.FIND_HOSTILE_CREEPS ? hostiles : type === g.FIND_MY_STRUCTURES ? towerObjs : []) };
}

function load() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.console = { log: () => {} };
    g.Game.time = 1000;
    g.Game.creeps = {};
    return { h, g, cd: h.load('system.claimDefense') };
}

test('a controller attacker in a room without a tower: spawns hold their energy, then a full-size hunter', () => {
    const { g, cd } = load();
    const spawned = [];
    const spawn = { spawnCreep: (b, n, o) => { spawned.push([b.length, o.memory.priority]); return g.OK; } };
    const r = room(g, { hostiles: [hostile(g, 'raider', body(g.CLAIM, 1).concat(body(g.MOVE, 1)))], energy: 300, capacity: 550 });
    assert.equal(cd.spawnFor(spawn, r), 'holding', 'pooling: 300 of the 520 a 4-pair hunter needs');
    r.energyAvailable = 520;
    assert.equal(cd.spawnFor(spawn, r), 'spawned');
    assert.deepEqual(plain(spawned), [[8, 'claimHunter']], '4 ATTACK + 4 MOVE');
});

test('after waiting long enough it takes what it has; nothing at all for scouts, towered rooms or Invaders', () => {
    const { g, cd } = load();
    const spawned = [];
    const spawn = { spawnCreep: (b) => { spawned.push(b.length); return g.OK; } };
    const r = room(g, { hostiles: [hostile(g, 'raider', body(g.CLAIM, 1))], energy: 260 });
    assert.equal(cd.spawnFor(spawn, r), 'holding');
    g.Game.time += 300;
    assert.equal(cd.spawnFor(spawn, r), 'spawned');
    assert.deepEqual(spawned, [4], '2 pairs from 260 energy');
    // Each case on its own tick: room lookups are cached per tick by room name.
    g.Game.time++;
    assert.equal(cd.spawnFor(spawn, room(g, { hostiles: [hostile(g, 'scout', body(g.MOVE, 1))] })), null);
    g.Game.time++;
    assert.equal(cd.spawnFor(spawn, room(g, { hostiles: [hostile(g, 'raider', body(g.CLAIM, 1))], towers: 1 })), null);
    g.Game.time++;
    assert.equal(cd.spawnFor(spawn, room(g, { hostiles: [hostile(g, 'Invader', body(g.CLAIM, 1))] })), null);
});

test('safe mode fires when a hostile claimer has an open path to the controller, not when walled off', () => {
    for (const [incomplete, expected] of [[false, ['NEW']], [true, []]]) {
        const { h, g } = load();
        g.Game.notify = () => {};
        g.PathFinder = { search: () => ({ incomplete, path: [] }), CostMatrix: class { set() {} get() { return 0; } clone() { return this; } } };
        const activated = [];
        const r = room(g, { hostiles: [hostile(g, 'raider', body(g.CLAIM, 2))] });
        r.getEventLog = () => [];
        r.controller.safeModeAvailable = 1;
        r.controller.activateSafeMode = () => { activated.push('NEW'); return g.OK; };
        g.Game.rooms = { NEW: r };
        h.load('system.safeMode').run();
        assert.deepEqual(activated, expected, 'incomplete path: ' + incomplete);
    }
});

// The claimer's distance and our ramparts: shard2 E42N31 spent a charge on a claimer nowhere near its controller.
function claimerCase(x, y, ramparts = []) {
    const { h, g } = load();
    g.Game.notify = () => {};
    const blocked = [];
    class Matrix { set(px, py, v) { if (v === 255) blocked.push(px + ',' + py); } get() { return 0; } clone() { return this; } }
    const searches = [];
    g.PathFinder = { CostMatrix: Matrix, search: (from, goal, opts) => {
        searches.push(from);
        opts.roomCallback('NEW');
        return { incomplete: blocked.length >= 8, path: [] };
    } };
    const r = room(g, { hostiles: [Object.assign(hostile(g, 'raider', body(g.CLAIM, 2)), { pos: { x, y, roomName: 'NEW' } })] });
    r.controller.pos = { x: 25, y: 25, roomName: 'NEW' };
    const find = r.find;
    const rampartList = ramparts.map(([px, py], n) => ({ id: 'r' + n, my: true, structureType: g.STRUCTURE_RAMPART, isPublic: true, pos: { x: px, y: py } }));
    r.find = (type, opts) => (type === g.FIND_MY_STRUCTURES ? rampartList : find(type, opts));
    g.Game.rooms = { NEW: r };
    return { room: r, safeMode: h.load('system.safeMode'), searches, blocked };
}
const AROUND = [[24, 24], [25, 24], [26, 24], [24, 25], [26, 25], [24, 26], [25, 26], [26, 26]];

test('a claimer further than 5 tiles from the controller is no reason for safe mode, and no path is searched', () => {
    const c = claimerCase(31, 25);
    assert.equal(c.safeMode.claimerApproaching(c.room), null);
    assert.equal(c.searches.length, 0);
});

test('a claimer within 5 tiles with an open path is', () => {
    const c = claimerCase(30, 25);
    assert.match(c.safeMode.claimerApproaching(c.room), /raider|close/);
    assert.equal(c.searches.length, 1);
});

test('public ramparts round the controller close the path: they shut before it could step on one', () => {
    const c = claimerCase(28, 25, AROUND);
    assert.equal(c.safeMode.claimerApproaching(c.room), null);
    assert.equal(c.blocked.length, 8, 'every rampart closed in the hostile matrix');
});

test('in a built room a lone claimer far from the controller is never a breach', () => {
    const c = claimerCase(45, 45);
    c.room.storage = { pos: { x: 25, y: 20 } };
    c.room.getEventLog = () => [];
    assert.equal(c.safeMode.lastResort(c.room), null);
});
