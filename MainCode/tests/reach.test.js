const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

// shard1 E19N59: energy at 38,43 under the parked supplier, ringed by towers, a link, a power spawn
// and the storage. A distributor and a salvager waited for it on the storage's only free tiles.
function room({ openTile } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.TERRAIN_MASK_WALL = 1;
    const at = {};
    const put = (x, y, list) => { at[x * 50 + y] = list; };
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (dx || dy) put(38 + dx, 43 + dy, { s: [{ structureType: g.STRUCTURE_TOWER }], c: [] });
    }
    put(38, 43, { s: [{ structureType: g.STRUCTURE_RAMPART, my: true }], c: [{ my: true, memory: { priority: 'supplier', atSpot: true } }] });
    if (openTile) put(openTile[0], openTile[1], { s: [{ structureType: g.STRUCTURE_ROAD }], c: [] });
    g.RoomPosition = function (x, y, roomName) {
        Object.assign(this, { x, y, roomName });
        this.lookFor = type => { const e = at[x * 50 + y] || { s: [], c: [] }; return type === g.LOOK_STRUCTURES ? e.s : e.c; };
    };
    g.Game.rooms.R = { name: 'R', getTerrain: () => ({ get: () => 0 }) };
    const creep = { pos: { roomName: 'R', inRangeTo: () => false } };
    return { reach: h.load('room.reach'), pile: { pos: { x: 38, y: 43, roomName: 'R' } }, creep };
}

test('a pile nobody can stand next to is unreachable; one free tile beside it makes it reachable', () => {
    let r = room();
    assert.equal(r.reach.reachable(r.pile, r.creep), false, 'structures all round, a parked supplier on it');
    r = room({ openTile: [39, 42] });
    assert.equal(r.reach.reachable(r.pile, r.creep), true, 'a road tile beside it');
    r = room();
    r.creep.pos.inRangeTo = () => true;
    assert.equal(r.reach.reachable(r.pile, r.creep), true, 'already beside it');
});
