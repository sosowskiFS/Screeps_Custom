const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

class Matrix {
    constructor() { this.data = new Uint8Array(2500); }
    get(x, y) { return this.data[x * 50 + y]; }
    set(x, y, v) { this.data[x * 50 + y] = v; }
    clone() { const m = new Matrix(); m.data.set(this.data); return m; }
}
const at = (x, y, roomName = 'R') => ({ x, y, roomName,
    inRangeTo: (o, r) => { const p = o.pos || o; return Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) <= r; },
    getRangeTo: o => { const p = o.pos || o; return Math.max(Math.abs(p.x - x), Math.abs(p.y - y)); },
    getDirectionTo: () => 3 });

// Room R with an armed hostile ranger at 20,20 (and whatever else is given).
function setup({ hostiles = [{ x: 20, y: 20 }], towers = [], guards = [] } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    const searches = [];
    g.PathFinder = { CostMatrix: Matrix, search: (from, goals, opts) => { searches.push(opts); return g.__answer(opts); } };
    g.__answer = () => ({ path: [{ x: 1, y: 1 }], incomplete: false });
    const enemy = p => ({ id: 'e' + p.x, owner: { username: 'Harabi' }, pos: at(p.x, p.y), hits: 1000, hitsMax: 1000,
        body: [{ type: g.RANGED_ATTACK, hits: 100 }, { type: g.MOVE, hits: 100 }], getActiveBodyparts: t => (t === g.RANGED_ATTACK ? 1 : 0) });
    const list = hostiles.map(enemy);
    const towerObjs = towers.map(p => ({ structureType: g.STRUCTURE_TOWER, pos: at(p.x, p.y) }));
    const guardObjs = guards.map(p => ({ memory: { priority: 'roomGuard' }, pos: at(p.x, p.y) }));
    const room = { name: 'R', find: type => type === g.FIND_HOSTILE_CREEPS ? list : type === g.FIND_MY_STRUCTURES ? towerObjs :
        type === g.FIND_MY_CREEPS ? guardObjs : [] };
    g.Game.rooms = { R: room };
    h.load('traveler').Traveler.getCreepMatrix = () => new Matrix();
    const moves = [];
    const creep = { name: 'helper', room, pos: at(18, 20), memory: { priority: 'helper' }, move: d => moves.push(d) };
    return { h, g, room, creep, moves, searches, tactics: h.load('combat.tactics') };
}

test('the reach of an armed hostile (ranged 3, plus the step it can take, at least its flee range) is marked as danger', () => {
    const s = setup();
    const m = s.tactics.markDanger('R', new Matrix(), 255);
    assert.equal(m.get(24, 20), 255, '4 tiles away: still in reach next tick');
    assert.equal(m.get(25, 20), 255, '5 tiles away: close enough to set off a flee, so not a path');
    assert.equal(m.get(26, 20), 0, '6 tiles away: safe');
});

test('a worker with an armed hostile close heads for a tower only by a path that stays out of reach', () => {
    const s = setup({ towers: [{ x: 5, y: 20 }] });
    assert.equal(s.tactics.escape(s.creep), true);
    assert.equal(s.searches.length, 1, 'the haven path was safe: no flee needed');
    assert.ok(!s.searches[0].flee);
    const matrix = s.searches[0].roomCallback('R');
    assert.equal(matrix.get(17, 20), 255, 'never steps into the hostile\'s reach');
    // No safe path to the tower: flee, two rooms allowed, hostiles' reach costly but passable.
    const t = setup({ towers: [{ x: 22, y: 20 }] });
    t.g.__answer = opts => (opts.flee ? { path: [{ x: 1, y: 1 }], incomplete: false } : { path: [], incomplete: true });
    assert.equal(t.tactics.escape(t.creep), true);
    const flee = t.searches[1];
    assert.equal(flee.flee, true);
    assert.equal(flee.maxRooms, 2, 'may leave the room');
    assert.equal(flee.roomCallback('R').get(17, 20), 50);
    assert.equal(t.moves.length, 1);
});

test('no armed hostile close: no escape (the worker keeps working)', () => {
    const s = setup({ hostiles: [{ x: 40, y: 40 }] });
    assert.equal(s.tactics.escape(s.creep), false);
    assert.equal(s.moves.length, 0);
});

test('re-entering a room: unsafe while armed hostiles are seen in it, or it was recently marked dangerous', () => {
    const s = setup();
    assert.equal(s.tactics.unsafeToEnter('R'), true, 'seen with an armed hostile');
    const clear = setup({ hostiles: [] });
    assert.equal(clear.tactics.unsafeToEnter('R'), false);
    assert.equal(clear.tactics.unsafeToEnter('OUT_OF_SIGHT'), false, 'never marked');
});

test('a hostile just across the border counts: the worker that fled over it keeps going, and its reach is marked', () => {
    const s = setup({ hostiles: [] });
    const enemy = { id: 'n', owner: { username: 'Harabi' }, pos: at(20, 47, 'N'), hits: 1000, hitsMax: 1000,
        body: [{ type: s.g.RANGED_ATTACK, hits: 100 }], getActiveBodyparts: t => (t === s.g.RANGED_ATTACK ? 1 : 0) };
    s.g.Game.rooms.N = { name: 'N', find: type => (type === s.g.FIND_HOSTILE_CREEPS ? [enemy] : []) };
    s.g.Game.map.describeExits = r => (r === 'R' ? { 1: 'N' } : { 5: 'R' });
    // 2 tiles inside R, the hostile 2 tiles from N's border with R: 4 apart in effect.
    s.creep.pos = at(20, 2);
    assert.equal(s.tactics.escape(s.creep), true);
    const flee = s.searches[s.searches.length - 1];
    assert.equal(flee.flee, true);
    const m = s.tactics.markDanger('R', new Matrix(), 255);
    assert.equal(m.get(20, 2), 255, 'within its reach once it steps over');
    assert.equal(m.get(20, 3), 255, 'within its flee range');
    assert.equal(m.get(20, 4), 0);
    // Far enough in: it stops fleeing and works.
    const t = setup({ hostiles: [] });
    t.g.Game.rooms.N = s.g.Game.rooms.N; t.g.Game.map.describeExits = s.g.Game.map.describeExits;
    t.creep.pos = at(20, 8);
    assert.equal(t.tactics.escape(t.creep), false);
});

test('out of flee range in a room with attackers: no flee, and its travel goes around them, planned afresh (shardX W1N9)', () => {
    const s = setup();
    s.creep.pos = at(10, 20);                       // 10 tiles from the ranger: no flee
    const calls = [];
    s.creep.travelTo = (target, opts) => calls.push(opts);
    s.creep.memory.priority = 'farMule';
    assert.equal(s.tactics.avoidDanger(s.creep, null), false, 'it carries on working');
    assert.deepEqual(s.moves, []);
    s.creep.travelTo({ x: 30, y: 20 }, { range: 1 });
    assert.equal(calls[0].repath, 1);
    assert.equal(calls[0].range, 1, 'its own options kept');
    const m = calls[0].roomCallback('R', new Matrix());
    assert.equal(m.get(25, 20), 255, 'the ranger\'s flee zone is not walked through');
});

test('repairing under fire: never from a tile a ranger can hit; the walk goes to the nearest safe tile in repair range', () => {
    const s = setup();                              // a ranger at 20,20
    s.room.getTerrain = () => ({ get: () => 0 });
    s.g.RoomPosition = function (x, y, roomName) { return { x, y, roomName }; };
    const wall = { id: 'w', structureType: s.g.STRUCTURE_RAMPART, pos: at(22, 20), hits: 1000, hitsMax: 300000000 };
    const calls = [];
    s.creep.pos = at(19, 20);                       // 1 tile from the ranger
    s.creep.memory.priority = 'builder';
    s.creep.repair = t => { calls.push(['repair', t.id]); return s.g.OK; };
    s.creep.travelTo = (dest, opts) => { calls.push(['travel', dest.x, dest.y, opts.range]); return s.g.OK; };
    assert.equal(s.tactics.guardRepairs(s.creep), true, 'in reach: it steps out first, and does nothing else');
    assert.equal(s.moves.length, 1);
    // Out of reach and out of repair range (27,25): repair is the game's to refuse; the walk goes to
    // the nearest tile in repair range that the ranger cannot hit.
    const u = setup();
    u.room.getTerrain = () => ({ get: () => 0 });
    u.g.RoomPosition = function (x, y, roomName) { return { x, y, roomName }; };
    u.creep.pos = at(27, 25);
    u.creep.repair = () => u.g.OK;
    u.creep.travelTo = (dest, opts) => { calls.push(['travel', dest.x, dest.y, opts.range]); return u.g.OK; };
    assert.equal(u.tactics.guardRepairs(u.creep), false);
    u.creep.repair(wall);
    u.creep.travelTo(wall, { range: 3 });
    assert.equal(calls.length, 1);
    const [, x, y, range] = calls[0];
    assert.equal(range, 0);
    assert.ok(Math.max(Math.abs(x - 20), Math.abs(y - 20)) > 3, 'out of reach of the ranger: ' + x + ',' + y);
    assert.ok(Math.max(Math.abs(x - 22), Math.abs(y - 20)) <= 3, 'within repair range of the wall');
    // From a safe tile in range it repairs.
    const t = setup();
    t.room.getTerrain = () => ({ get: () => 0 });
    const done = [];
    t.creep.pos = at(24, 21);
    t.creep.repair = x => { done.push(x.id); return t.g.OK; };
    t.creep.travelTo = () => t.g.OK;
    t.tactics.guardRepairs(t.creep);
    assert.equal(t.creep.repair(wall), t.g.OK);
    assert.deepEqual(done, ['w']);
});

test('a repair target no safe tile reaches is swapped for the weakest barrier that has one', () => {
    // Rangers at 20,20 and 20,26: every tile within 3 of the ring rampart at 20,23 is in reach.
    const s = setup({ hostiles: [{ x: 20, y: 20 }, { x: 20, y: 26 }] });
    s.room.find(s.g.FIND_HOSTILE_CREEPS)[1].id = 'e20b';
    s.room.getTerrain = () => ({ get: () => 0 });
    s.g.RoomPosition = function (x, y, roomName) { return { x, y, roomName }; };
    const inReach = { id: 'A', structureType: s.g.STRUCTURE_RAMPART, my: true, pos: at(20, 23), hits: 1000, hitsMax: 300000000 };
    const elsewhere = { id: 'B', structureType: s.g.STRUCTURE_RAMPART, my: true, pos: at(30, 20), hits: 5000, hitsMax: 300000000 };
    const find = s.room.find;
    s.room.find = type => (type === s.g.FIND_STRUCTURES ? [inReach, elsewhere] : find(type));
    const calls = [];
    s.creep.pos = at(36, 28);
    s.creep.repair = t => { calls.push(['repair', t.id]); return s.g.ERR_NOT_IN_RANGE; };
    s.creep.travelTo = (dest, opts) => { calls.push(['travel', dest.x, dest.y]); return s.g.OK; };
    assert.equal(s.tactics.guardRepairs(s.creep), false);
    assert.equal(s.creep.repair(inReach), s.g.ERR_NOT_IN_RANGE);
    s.creep.travelTo(inReach, { range: 3 });
    assert.deepEqual(calls[0], ['repair', 'B'], 'the reachable rampart instead');
    const [, x, y] = calls[1];
    assert.ok(Math.max(Math.abs(x - 30), Math.abs(y - 20)) <= 3, 'walks to repair range of B: ' + x + ',' + y);
});

test('a hostile that hopped out is still counted for 10 ticks', () => {
    const s = setup();                              // a ranger at 20,20
    s.room.getTerrain = () => ({ get: () => 0 });
    s.g.Game.time = 100;
    s.creep.pos = at(30, 30);
    s.creep.repair = () => s.g.OK;
    s.creep.travelTo = () => s.g.OK;
    s.tactics.guardRepairs(s.creep);
    // It steps over the border: the room looks empty.
    s.room.find = () => [];
    s.g.Game.time = 105;
    const c2 = { name: 'r2', room: s.room, pos: at(19, 20), memory: {}, move: () => {}, repair: () => s.g.OK, travelTo: () => s.g.OK };
    s.tactics.guardRepairs(c2);
    assert.equal(c2.repair({ id: 'w', structureType: s.g.STRUCTURE_RAMPART, pos: at(21, 20) }), s.g.ERR_NOT_IN_RANGE, 'still in its reach');
    s.g.Game.time = 120;
    const c3 = { name: 'r3', room: s.room, pos: at(19, 20), memory: {}, repair: () => s.g.OK, travelTo: () => s.g.OK };
    assert.equal(s.tactics.guardRepairs(c3), false, 'gone 20 ticks: no guard');
});
