const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

// shard2 E26N32: Supply flag left on 14,38 under a planned tower; the plan's Supply tile is 15,38.
function setup() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    const structures = [];
    const room = { name: 'R', controller: { my: true, level: 8 }, find: (type, opts) => (type === g.FIND_STRUCTURES || type === g.FIND_MY_STRUCTURES ? structures : []) };
    g.Game.rooms.R = room;
    g.RoomPosition = function (x, y, roomName) { this.x = x; this.y = y; this.roomName = roomName; };
    const moved = [];
    const flag = { pos: { x: 14, y: 38, roomName: 'R', lookFor: () => [] }, setPosition(p) { moved.push([p.x, p.y]); return g.OK; } };
    g.Game.flags = { RSupply: flag };
    return { h, g, room, structures, flag, moved, builder: h.load('base.builder') };
}
const T = (x, y) => x * 50 + y;
const planned = { flags: { Supply: T(15, 38) }, structures: {}, roads: [], paths: [] };

test('the Supply flag goes to its planned tile as soon as it is clear, whatever the migration is doing', () => {
    const { g, structures, moved, room, builder } = setup();
    structures.push({ structureType: g.STRUCTURE_TOWER, pos: { x: 14, y: 38 } }, { structureType: g.STRUCTURE_TOWER, pos: { x: 15, y: 38 } });
    builder.syncFlags(room, planned);
    assert.deepEqual(moved, [], 'a tower still on the planned tile');
    structures.pop();
    g.Game.time++;
    builder.syncFlags(room, planned);
    assert.deepEqual(plain(moved), [[15, 38]]);
});

test('a flag already on its tile costs nothing', () => {
    const { g, flag, moved, room, builder } = setup();
    flag.pos.x = 15;
    room.find = () => { throw new Error('no room scan'); };
    builder.syncFlags(room, planned);
    assert.deepEqual(moved, []);
});

test('a finished creep a spawn cannot let out may leave any way; one still spawning is left alone', () => {
    const { g, structures, room, builder } = setup();
    const set = [];
    const job = remainingTime => ({ remainingTime, setDirections(d) { set.push(d.length); return g.OK; } });
    const done = { structureType: g.STRUCTURE_SPAWN, spawning: job(0), pos: { x: 14, y: 37 } };
    const busy = { structureType: g.STRUCTURE_SPAWN, spawning: job(20), pos: { x: 14, y: 36 } };
    const idle = { structureType: g.STRUCTURE_SPAWN, spawning: null, pos: { x: 14, y: 35 } };
    structures.push(done, busy, idle);
    assert.equal(builder.unstickSpawns(room), 1);
    assert.deepEqual(set, [8]);
});

test('a supplier is not ordered only onto a Supply tile with a structure on it', () => {
    const { h, g, room, flag } = setup();
    g.Memory.autoBuildRooms = ['R'];
    const dirs = [g.TOP, g.TOP_RIGHT, g.RIGHT, g.BOTTOM_RIGHT, g.BOTTOM, g.BOTTOM_LEFT, g.LEFT, g.TOP_LEFT];
    const spawn = { pos: { getDirectionTo: () => g.BOTTOM }, isActive: () => true };
    spawn.pos.isNearTo = () => true;
    const spawns = [0, 1, 2].map(() => Object.assign({ structureType: g.STRUCTURE_SPAWN }, spawn));
    room.find = () => spawns;
    flag.pos.isNearTo = () => true;
    let onTile = [{ structureType: g.STRUCTURE_TOWER }];
    flag.pos.lookFor = () => onTile;
    const build = h.load('spawn.BuildCreeps5');
    let got = build.supplierDirections(room, spawns[0]);
    assert.equal(got.supplierDirection.length, dirs.length, 'tower on the tile: any way out');
    onTile = [{ structureType: g.STRUCTURE_ROAD }];
    g.Game.time++;
    got = build.supplierDirections(room, spawns[0]);
    assert.deepEqual(plain(got.supplierDirection), [g.BOTTOM], 'clear: straight onto it');
    assert.ok(!plain(got.buildDirections).includes(g.BOTTOM));
});

const noWall = () => false;
const ringPlan = () => ({
    flags: { Supply: T(15, 38), storageMiner: T(15, 35) }, roads: [T(16, 37), T(20, 20)], paths: [],
    structures: { storage: [T(15, 37)], spawn: [T(14, 37), T(30, 30)], tower: [T(14, 38), T(14, 39), T(15, 39), T(14, 35), T(16, 38), T(16, 39)], extension: [T(16, 37), T(40, 40)], lab: [] },
});

test('a tower planned off the core comes back; what was planned on that core tile takes its place', () => {
    const { builder } = setup();
    const r = builder.coreRepair(ringPlan(), noWall);
    assert.ok(r);
    assert.ok(plain(r.structures.tower).includes(T(16, 37)));
    assert.ok(!plain(r.structures.tower).includes(T(14, 35)));
    assert.deepEqual(plain(r.structures.extension), [T(14, 35), T(40, 40)], 'the extension takes the tile the tower left');
    assert.ok(!plain(r.roads).includes(T(16, 37)), 'no road on the core tile');
    assert.ok(plain(r.roads).includes(T(20, 20)));
});

test('a first spawn off the core: another planned spawn beside it takes first place, else it comes back', () => {
    const { builder } = setup();
    let p = ringPlan();
    p.structures.tower = [T(14, 38), T(14, 39), T(15, 39), T(16, 37), T(16, 38), T(16, 39)];
    p.structures.extension = [];
    p.structures.spawn = [T(30, 30), T(14, 37)];
    let r = builder.coreRepair(p, noWall);
    assert.deepEqual(plain(r.structures.spawn), [T(14, 37), T(30, 30)]);
    p = ringPlan();
    p.structures.tower = [T(14, 38), T(14, 39), T(15, 39), T(16, 37), T(16, 38), T(16, 39)];
    p.structures.spawn = [T(30, 30)];
    r = builder.coreRepair(p, noWall);
    assert.deepEqual(plain(r.structures.spawn), [T(14, 37)]);
});

test('a plan with its core in place is left alone', () => {
    const { builder } = setup();
    const p = ringPlan();
    p.structures.tower = [T(14, 38), T(14, 39), T(15, 39), T(16, 37), T(16, 38), T(16, 39)];
    p.structures.extension = [];
    assert.equal(builder.coreRepair(p, noWall), null);
});

test('a tower with no site after the grace ends its step, so what holds its tile up can move; with a site it waits', () => {
    const { h, g } = setup();
    const migrate = h.load('base.migrate');
    const kindOf = { [g.STRUCTURE_TOWER]: 'tower' };
    const towers = [{ structureType: g.STRUCTURE_TOWER }];
    let sites = [];
    const room = { name: 'R', find: type => (type === g.FIND_MY_CONSTRUCTION_SITES ? sites : towers) };
    g.Game.getObjectById = () => null;
    g.Game.time = 1000;
    const mem = { step: { id: 'x', kind: 'tower', tile: 1, phase: 'rebuild', t: 1000, before: 6, fast: 1 } };
    migrate.progress(room, mem, kindOf, () => {});
    assert.ok(mem.step, 'build passes still to come');
    sites = [{ structureType: g.STRUCTURE_TOWER }];
    g.Game.time = 1200;
    migrate.progress(room, mem, kindOf, () => {});
    assert.ok(mem.step, 'being built');
    sites = [];
    g.Game.time = 1201;
    migrate.progress(room, mem, kindOf, () => {});
    assert.equal(mem.step, undefined);
});

test('a supplier out on foot goes back to its tile while a tower beside it needs energy; with only strays left it serves them', () => {
    const { h, g } = setup();
    const supplier = h.load('creep.supplier');
    const flagPos = { x: 15, y: 38, lookFor: () => [] };
    g.Game.flags = { RSupply: { pos: flagPos } };
    const core = { id: 'core', pos: { x: 14, y: 38 } }, stray = { id: 'stray', pos: { x: 13, y: 37 } };
    g.Game.getObjectById = id => ({ core, stray })[id];
    const went = [], gave = [];
    const creep = { name: 's', room: { name: 'R', storage: {} }, memory: { priority: 'supplier', spot: '15,38', atSpot: true }, ticksToLive: 500, carry: { energy: 100 },
        pos: { x: 12, y: 36, lookFor: () => [], isNearTo: () => false }, store: { getFreeCapacity: () => 0 },
        travelTo: t => went.push(t), transfer: t => { gave.push(t); return g.ERR_NOT_IN_RANGE; } };
    g.Memory.towerNeedEnergy = { R: ['stray', 'core'] };
    supplier.run(creep);
    assert.equal(went[0].pos, flagPos, 'back to the tile, past the stray first in the list');
    assert.equal(gave.length, 0);
    went.length = 0;
    g.Memory.towerNeedEnergy = { R: ['stray'] };
    supplier.run(creep);
    assert.equal(gave[0], stray);
});
