const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

// Room A: storage at 25,25, one extension at 30,30 with a road beside it (core), a stray road
// far away at 10,40, and a route that the mocked pathfinder returns from storage to the controller.
function setup() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.TERRAIN_MASK_WALL = 1;
    const walls = new Set(['27,25']);
    g.Game.map.getRoomTerrain = () => ({ get: (x, y) => walls.has(x + ',' + y) ? 1 : 0 });
    g.PathFinder = {
        CostMatrix: function () { const cells = {}; this.get = (x, y) => cells[x + ',' + y] || 0; this.set = (x, y, v) => { cells[x + ',' + y] = v; }; },
        search: (origin, goal) => {
            // Straight line along y=25 toward the goal's x (enough to test packing/merging).
            const path = [];
            const step = goal.pos.x > origin.x ? 1 : -1;
            for (let x = origin.x + step; x !== goal.pos.x; x += step) path.push({ x, y: 25, roomName: 'A' });
            return { path, cost: path.length, incomplete: false };
        },
    };
    const pos = (x, y) => ({ x, y, roomName: 'A', findInRange: () => [] });
    const storage = { id: 'storage', structureType: g.STRUCTURE_STORAGE, my: true, pos: pos(25, 25) };
    const extension = { id: 'ext', structureType: g.STRUCTURE_EXTENSION, my: true, pos: Object.assign(pos(30, 30), { findInRange: () => [coreRoad] }) };
    const coreRoad = { id: 'r1', structureType: g.STRUCTURE_ROAD, pos: pos(31, 30), destroy: () => g.OK };
    let strayDestroyed = 0;
    const strayRoad = { id: 'r2', structureType: g.STRUCTURE_ROAD, pos: pos(10, 40), destroy: () => { strayDestroyed++; return g.OK; } };
    const structures = [storage, extension, coreRoad, strayRoad];
    const sites = [];
    const room = { name: 'A', storage, controller: { my: true, pos: pos(30, 25) },
        find: type => type === g.FIND_STRUCTURES ? structures
            : type === g.FIND_MY_STRUCTURES ? structures.filter(s => s.my)
            : (type === g.FIND_CONSTRUCTION_SITES || type === g.FIND_MY_CONSTRUCTION_SITES) ? sites : [],
        createConstructionSite: (x, y, type) => { sites.push({ pos: pos(x, y), structureType: type }); return g.OK; } };
    g.Game.rooms.A = room;
    g.Game.spawns = { S: { room } };
    g.Game.constructionSites = {};
    return { h, g, room, sites, strayDestroyed: () => strayDestroyed, roads: h.load('system.roads') };
}

test('the plan keeps base-layout roads and routes, not stray roads', () => {
    const { room, roads } = setup();
    roads.planRoom(room);
    assert.equal(roads.isPriority('A', 31, 30), true, 'road beside an extension (base layout)');
    assert.equal(roads.isPriority('A', 28, 25), true, 'route from storage to the controller');
    assert.equal(roads.isPriority('A', 10, 40), false, 'stray road: left to decay');
    assert.equal(roads.isPriority('B', 10, 40), true, 'rooms without a plan keep everything');
});

test('only missing route tiles get road sites, never on walls, and stray roads are kept unless cleanup is on', () => {
    const { g, room, sites, strayDestroyed, roads } = setup();
    roads.planRoom(room);
    roads.buildMissing(room);
    const placed = sites.map(s => s.pos.x + ',' + s.pos.y).sort();
    assert.deepEqual(placed, ['26,25', '28,25', '29,25'], 'route tiles 26..29 except the wall at 27');

    assert.equal(roads.cleanup(room), 0, 'off by default: unused roads just decay');
    g.Memory.settings = { roadCleanup: true };
    assert.equal(roads.cleanup(room), 1);
    assert.equal(strayDestroyed(), 1);
});

test('tower road repair skips unplanned roads; walking creeps stop placing roads in planned rooms', () => {
    const { h, g, room, roads } = setup();
    roads.planRoom(room);
    const { placeRoadOnPath } = h.load('creep.movement');
    let lookups = 0;
    const creep = { room, memory: { _trav: { path: '33' } },
        pos: { x: 20, y: 20, roomName: 'A', lookFor: () => { lookups++; return []; }, createConstructionSite() {} } };
    placeRoadOnPath(creep);
    assert.equal(lookups, 0, 'planned room: no reactive road placement');
    assert.ok(g.Memory.roadPlan.A.s.length > 0);
});

test('tile sets round-trip through the compact string format', () => {
    const { roads } = setup();
    const tiles = [0, 51, 1225, 2499];
    assert.deepEqual([...roads.unpack(roads.pack(tiles))].sort((a, b) => a - b), tiles);
});
