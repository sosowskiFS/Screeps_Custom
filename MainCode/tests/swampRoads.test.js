const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

// A young room (no terminal) where creeps keep getting stuck on swamp tile (10,10).
function setup({ tower = true } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Game.time = 1000;
    g.Game.constructionSites = {};
    const swamp = new Set(['10,10', '11,10', '12,12']);
    g.Game.map.getRoomTerrain = () => ({ get: (x, y) => (swamp.has(x + ',' + y) ? g.TERRAIN_MASK_SWAMP : 0) });
    const creeps = [], sites = [];
    const structures = tower ? [{ structureType: g.STRUCTURE_TOWER, pos: { x: 25, y: 25 } }] : [];
    const room = { name: 'NEW', controller: { my: true, level: 3 },
        find: type => type === g.FIND_MY_CREEPS ? creeps : type === g.FIND_MY_STRUCTURES || type === g.FIND_STRUCTURES ? structures :
            type === g.FIND_CONSTRUCTION_SITES ? sites : [],
        createConstructionSite: (x, y, type) => { sites.push({ pos: { x, y }, structureType: type }); return g.OK; } };
    g.Game.rooms = { NEW: room };
    const sys = h.load('system.swampRoads');
    const tick = () => { sys.run(); g.Game.time++; h.load('runtime.cache').current && null; };
    return { h, g, sys, creeps, sites, room, tick };
}

test('a swamp tile that keeps holding creeps gets a road; occasional ones and plain ground do not', () => {
    const s = setup();
    s.creeps.push({ fatigue: 8, pos: { x: 10, y: 10 } }, { fatigue: 0, pos: { x: 11, y: 10 } }, { fatigue: 4, pos: { x: 20, y: 20 } });
    for (let i = 0; i < s.sys.WINDOW; i++) {
        s.creeps[1].fatigue = i % 20 === 0 ? 6 : 0;   // (11,10): held now and then
        s.tick();
    }
    s.sys.run();
    assert.deepEqual(s.sites.map(x => [x.pos.x, x.pos.y]), [[10, 10]]);
    assert.equal(s.sys.wanted('NEW', 10, 10), true, 'base.builder keeps this road site in a young room');
    assert.equal(s.sys.wanted('NEW', 11, 10), false);
});

test('not before the room has a tower (until then only spawn and tower are built)', () => {
    const s = setup({ tower: false });
    s.creeps.push({ fatigue: 8, pos: { x: 10, y: 10 } });
    for (let i = 0; i <= s.sys.WINDOW; i++) s.tick();
    assert.equal(s.sites.length, 0);
});
