const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

const I = (x, y) => x * 50 + y;

// E14N18 in miniature: the spawns sit in a pocket (x >= 40) joined to the rest of the room by a
// single tile at 39,20. Everything else (exits, sources, controller) is west of the wall.
function pocketTerrain() {
    const walls = new Uint8Array(2500);
    for (let y = 0; y < 50; y++) if (y !== 20) walls[I(39, y)] = 1;
    // Room border is wall except one exit on the west side (x = 0, y 20..25).
    for (let k = 0; k < 50; k++) {
        walls[I(49, k)] = walls[I(k, 0)] = walls[I(k, 49)] = 1;
        if (k < 20 || k > 25) walls[I(0, k)] = 1;
    }
    return walls;
}

test('connectivity: a site on the only tile out of the spawn pocket blocks; elsewhere it does not', () => {
    const h = harness();
    const c = h.load('base.connectivity');
    const walls = pocketTerrain();
    const walkable = new Uint8Array(2500).map((_, i) => (walls[i] ? 0 : 1));
    const req = c.requirements(walkable, { spawns: [I(45, 10)], storage: I(44, 15), sources: [I(10, 10)], controller: I(20, 30) });
    const before = c.status(walkable, req);
    assert.ok(before.every(Boolean));
    assert.equal(c.blocks(walkable, req, before, I(39, 20)), true, 'the gap');
    assert.equal(c.blocks(walkable, req, before, I(38, 20)), false, 'open ground beside it');
    assert.equal(walkable[I(39, 20)], 1, 'grid restored');
});

function builderRoom({ sites = [] } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.CONTROLLER_STRUCTURES = { link: { 8: 6 } };
    g.CONTROLLER_STRUCTURES[g.STRUCTURE_LINK] = { 8: 6 };
    const walls = pocketTerrain();
    g.Game.map.getRoomTerrain = () => ({ get: (x, y) => walls[I(x, y)] });
    const pos = (x, y) => ({ x, y, roomName: 'R', lookFor: () => [] });
    const removed = [];
    const placed = [];
    const siteObjs = sites.map(([x, y, type]) => ({ structureType: type, my: true, pos: pos(x, y), remove: () => { removed.push([x, y]); return g.OK; } }));
    const structures = [{ structureType: g.STRUCTURE_SPAWN, my: true, pos: pos(45, 10) }, { structureType: g.STRUCTURE_STORAGE, my: true, pos: pos(44, 15) }];
    const room = { name: 'R', terminal: { my: true }, controller: { my: true, level: 8, pos: pos(20, 30) },   // established (room.stage)
        find: type => {
            if (type === g.FIND_STRUCTURES || type === g.FIND_MY_STRUCTURES) return structures;
            if (type === g.FIND_MY_CONSTRUCTION_SITES || type === g.FIND_CONSTRUCTION_SITES) return siteObjs;
            if (type === g.FIND_SOURCES) return [{ pos: pos(10, 10) }];
            return [];
        },
        createConstructionSite: (x, y, type) => { placed.push([x, y, type]); return g.OK; },
        createFlag: () => g.OK };
    g.Game.rooms.R = room;
    g.Game.constructionSites = {};
    return { h, g, room, removed, placed, builder: h.load('base.builder') };
}

test('builder removes an existing site that seals the spawn pocket and never places one there', () => {
    const { g, room, removed, placed, builder } = builderRoom({ sites: [[39, 20, 'STRUCTURE_LINK'], [30, 30, 'STRUCTURE_LINK']] });
    const plan = { mode: 'fresh', flags: {}, roads: [], paths: [], structures: { link: [I(39, 20), I(30, 31)] } };
    builder.buildRoom(room, plan);
    assert.deepEqual(removed, [[39, 20]], 'only the blocking site goes');
    assert.ok(!placed.some(([x, y]) => x === 39 && y === 20), 'and it is not put back');
    assert.ok(placed.some(([x, y]) => x === 30 && y === 31), 'other planned tiles still build');
});

test('migration only moves a structure when its replacement can go down without sealing a path', () => {
    const { builder, room } = builderRoom();
    const plan = { mode: 'fresh', flags: {}, roads: [], paths: [], structures: { link: [I(39, 20)] } };
    assert.equal(builder.replacementTile(room, plan, 'link'), undefined, 'the only planned link tile is the gap');
    plan.structures.link.push(I(30, 31));
    assert.equal(builder.replacementTile(room, plan, 'link'), I(30, 31));

    const h = harness();
    const M = h.load('base.migrate');
    const s = { plan: { structures: { link: [I(39, 20)] }, paths: [], flags: {} },
        built: [{ id: 'old', kind: 'link', tile: I(45, 30), used: 0 }], siteTiles: new Set(), roomSites: 0, globalSites: 0,
        energy: 500000, storageFree: 500000, hostiles: false, canPlace: () => false };
    assert.equal(M.chooseStep(s), null, 'old link stays until its replacement can be placed');
    s.canPlace = () => true;
    assert.equal(M.chooseStep(s).id, 'old');
});
