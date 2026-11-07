const test = require('node:test');
const assert = require('node:assert/strict');
const { corePass, measure } = require('../base.corePass');

const I = (x, y) => x * 50 + y;
const cheb = (a, b) => Math.max(Math.abs(((a / 50) | 0) - ((b / 50) | 0)), Math.abs(a % 50 - b % 50));

// Shard2 E39N37's shape: a wall down x=20 with a gap 3 tiles high at y=24..26, the core filling it, and the
// long way round through a gap at y=47. The base on the far side of the core.
function room({ gapOpen = false } = {}) {
    const walls = new Uint8Array(2500);
    for (let i = 0; i < 50; i++) { walls[I(i, 0)] = walls[I(i, 49)] = walls[I(0, i)] = walls[I(49, i)] = 1; }
    for (let y = 1; y < 49; y++) if (!(y >= 24 && y <= 26) && y !== 47) { walls[I(19, y)] = walls[I(20, y)] = walls[I(21, y)] = 1; }
    if (gapOpen) for (let y = 1; y < 48; y++) walls[I(19, y)] = walls[I(20, y)] = walls[I(21, y)] = 0;
    const Supply = I(20, 25);
    const structures = {
        storage: [I(21, 25)], spawn: [I(19, 24), I(11, 30), I(11, 32)],
        tower: [I(20, 24), I(21, 24), I(19, 25), I(19, 26), I(20, 26), I(21, 26)],
        extension: [], link: [], lab: [], terminal: [I(30, 25)], factory: [I(30, 27)], powerSpawn: [I(30, 29)], nuker: [], observer: [],
    };
    for (let x = 4; x <= 14; x += 2) for (let y = 8; y <= 40; y += 4) structures.extension.push(I(x, y));
    return { walls, structures, roads: [], paths: [], flags: { Supply }, sources: [I(40, 10)], mineral: I(40, 40), controller: I(45, 25) };
}

test('a core filling a gap gets a lane: the far side comes close, the first spawn stays beside the Supply tile', () => {
    const s = room();
    const r = corePass(s);
    assert.ok(r, 'a lane');
    assert.ok(r.before.mean > 20 && r.after.mean < r.before.mean * 0.6, r.before.mean + ' -> ' + r.after.mean);
    assert.equal(cheb(r.structures.spawn[0], s.flags.Supply), 1);
    assert.ok(r.lane.length >= 3);
    const solid = new Set(Object.values(r.structures).flat());
    for (const t of r.lane) assert.ok(!solid.has(t), 'nothing planned on the lane: ' + t);
    assert.ok(!r.lane.includes(s.flags.Supply) && !r.lane.includes(s.structures.storage[0]));
});

test('nothing is lost: every kind keeps its count on distinct tiles, none on walls', () => {
    const s = room();
    const r = corePass(s);
    for (const kind in s.structures) assert.equal(r.structures[kind].length, s.structures[kind].length, kind);
    const all = Object.values(r.structures).flat();
    assert.equal(new Set(all).size, all.length);
    for (const t of all) assert.equal(s.walls[t], 0);
    for (const [kind, from, to] of r.moved) assert.ok(kind && from !== to);
});

test('displaced towers stay close to the Supply tile', () => {
    const s = room();
    const r = corePass(s);
    for (const t of r.structures.tower) assert.ok(cheb(t, s.flags.Supply) <= 6, 'tower at range ' + cheb(t, s.flags.Supply));
});

test('open ground: no detour, no lane, the plan untouched', () => {
    assert.equal(corePass(room({ gapOpen: true })), null);
});

test('a room whose detours are mild keeps its full core', () => {
    const s = room();
    // Only a handful beyond the block: the mean stays low.
    s.structures.extension = [I(30, 10), I(30, 12), I(30, 14), I(30, 16), I(30, 18), I(30, 20), I(32, 10), I(32, 12), I(32, 14), I(32, 16), I(32, 18), I(32, 20), I(34, 10), I(34, 12), I(34, 14), I(34, 16)];
    s.structures.spawn = [I(19, 24), I(30, 31), I(30, 33)];
    assert.equal(corePass(s), null);
});

test('a plan with no storage or no spawn yet is left alone', () => {
    const s = room();
    s.structures.storage = [];
    assert.equal(corePass(s), null);
    const t = room();
    t.structures.spawn = [];
    assert.equal(corePass(t), null);
});

test('a lane structure in the migration order: what stands on it moves with the towers', () => {
    const { harness } = require('./harness');
    const h = harness();
    const migrate = h.load('base.migrate');
    const s = { plan: { structures: { tower: [10], lab: [30], extension: [] }, paths: [], flags: {}, lane: [50] },
        built: [{ id: 'extOnLane', kind: 'extension', tile: 50, used: 0 }, { id: 'e2', kind: 'extension', tile: 51, used: 0 }, { id: 'strayLab', kind: 'lab', tile: 60, used: 0 }],
        siteTiles: new Set(), roomSites: 0, globalSites: 0, energy: 500000, storageFree: 500000, hostiles: false, labsFirst: true };
    assert.equal(migrate.chooseStep(s).id, 'extOnLane', 'before the lab, with nowhere to go yet');
});

test('supplier: parked on its tile, not on foot', () => {
    const { harness } = require('./harness');
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    const supplier = h.load('creep.supplier');
    const flagPos = { x: 15, y: 38, lookFor: () => [] };
    g.Game.flags = { RSupply: { pos: flagPos } };
    g.Memory.towerNeedEnergy = {};
    const creep = { name: 's', room: { name: 'R', storage: {}, find: () => [] }, memory: { priority: 'supplier', spot: '15,38', atSpot: true }, ticksToLive: 500, carry: { energy: 100 },
        pos: { x: 12, y: 36, lookFor: () => [], isNearTo: () => false, inRangeTo: () => false }, store: { getFreeCapacity: () => 0 }, travelTo: () => {}, transfer: () => g.OK };
    supplier.run(creep);
    assert.equal(creep.memory.atSpot, false);
    creep.pos.x = 15; creep.pos.y = 38;
    supplier.run(creep);
    assert.equal(creep.memory.atSpot, true);
});
