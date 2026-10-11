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

test('the reach of an armed hostile (ranged 3, plus the step it can take) is marked as danger', () => {
    const s = setup();
    const m = s.tactics.markDanger('R', new Matrix(), 255);
    assert.equal(m.get(24, 20), 255, '4 tiles away: still in reach next tick');
    assert.equal(m.get(25, 20), 0, '5 tiles away: safe');
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
    assert.equal(m.get(20, 3), 0);
    // Far enough in: it stops fleeing and works.
    const t = setup({ hostiles: [] });
    t.g.Game.rooms.N = s.g.Game.rooms.N; t.g.Game.map.describeExits = s.g.Game.map.describeExits;
    t.creep.pos = at(20, 8);
    assert.equal(t.tactics.escape(t.creep), false);
});
