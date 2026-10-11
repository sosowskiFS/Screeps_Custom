const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

function setup() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Game.shard = { name: 'shardX' };
    g.Game.time = 20000;
    g.Game.cpu.bucket = 9000;
    g.RESOURCE_ENERGY = 'energy';
    g.Memory.expandIntel = {};
    g.Memory.xs = { tag: {} };
    return { h, g, nz: h.load('system.nuisance') };
}

test('pests: every room recently seen reserved by Harabi alone, sent from the home that scouted it', () => {
    const { g, nz } = setup();
    const intel = g.Memory.expandIntel, tag = g.Memory.xs.tag;
    intel.A = { t: 19000, r: 'Harabi' }; tag.A = { h: 'shard2:E3N12', e: 'E0N10', t: 300 };
    intel.B = { t: 19000, r: 'Someone' }; tag.B = { h: 'shard2:E3N12', e: 'E0N10', t: 300 };      // another player's
    intel.C = { t: 1000, r: 'Harabi' }; tag.C = { h: 'shard2:E3N12', e: 'E0N10', t: 300 };        // seen too long ago
    intel.D = { t: 19000, r: 'Harabi', o: 'Harabi' }; tag.D = { h: 'shard2:E3N12', e: 'E0N10', t: 300 };   // owned, not reserved
    intel.E = { t: 19000, r: 'Harabi' }; tag.E = { h: 'shard1:E28N48', e: 'E30N40', t: 120 };
    intel.F = { t: 19000, r: 'Harabi' };                                                         // nobody scouted it
    const list = nz.report();
    assert.equal(list.map(z => z.r + '@' + z.h).join(), 'E@shard1:E28N48,A@shard2:E3N12');
    // Seen now without Harabi's reservation: dropped.
    g.Game.rooms.A = { name: 'A', controller: { reservation: { username: 'Other' } } };
    assert.equal(nz.report().map(z => z.r).join(), 'E');
    // Short of CPU: none.
    g.Game.cpu.bucket = 1000;
    assert.equal(nz.report().length, 0);
});

test('pest orders: one per room and per home at a time, from the scouting home on its own shard', () => {
    const { nz } = setup();
    const list = [{ r: 'A', h: 'shard2:E3N12', e: 'E0N10' }, { r: 'B', h: 'shard2:E3N12', e: 'E0N10' },
        { r: 'C', h: 'shard2:E1N16', e: 'W0N20', n: 1 }, { r: 'D', h: 'shard1:E28N48', e: 'E30N40' }];
    const last = {};
    const out = nz.due(list, 'shard2', ['E3N12', 'E1N16'], [], [], last);
    assert.equal(out.map(o => o.memory.destination).join(), 'A', 'B waits for E3N12\'s next turn; C has one; D is shard1\'s');
    assert.equal(JSON.stringify(out[0].memory), JSON.stringify({ priority: 'xNuisance', destination: 'A', homeRoom: 'E3N12', xShard: { c: 'E0N10' } }));
    assert.equal(nz.due(list, 'shard2', ['E3N12', 'E1N16'], [], ['A'], last).map(o => o.memory.destination).join(), 'B');
});

function room(g, extra = {}) {
    const container = { id: 'cont', structureType: g.STRUCTURE_CONTAINER, pos: { x: 10, y: 10 }, store: { energy: 800 } };
    return Object.assign({ name: 'A', container,
        controller: { pos: { x: 25, y: 25 }, reservation: { username: 'Harabi' } },
        getTerrain: () => ({ get: () => 0 }),
        find: t => (t === g.FIND_SOURCES ? [{ pos: { x: 11, y: 11 } }] : t === g.FIND_STRUCTURES ? [container].filter(c => c.store.energy > 0) : []) }, extra);
}
function creep(g, r, carry = 0, at = { x: 9, y: 10 }) {
    const calls = [];
    g.RoomPosition = function (x, y, roomName) { Object.assign(this, { x, y, roomName }); };
    return { name: 'p', room: r, calls, memory: { priority: 'xNuisance', destination: 'A' },
        pos: Object.assign({ roomName: 'A', inRangeTo: () => false }, at), store: { energy: carry },
        withdraw: () => { calls.push('withdraw'); return g.OK; }, drop: () => { calls.push('drop'); return g.OK; },
        travelTo: p => { calls.push('travel:' + (p.x !== undefined ? p.x + ',' + p.y : 'x')); return g.OK; }, suicide: () => calls.push('suicide') };
}

test('the pest empties the fullest container onto the ground beside it, away from the source', () => {
    const { g, h } = setup();
    h.load('combat.tactics').escape = () => false;
    const role = h.load('creep.xNuisance');
    const r = room(g);
    g.Game.rooms.A = r;
    g.Game.getObjectById = id => (id === 'cont' ? r.container : null);
    const c = creep(g, r);
    role.run(c);
    assert.equal(c.calls.join(), 'withdraw');
    assert.equal(c.memory.from, 'cont');
    // Loaded: to a tile next to the container but 2+ from the source (11,11), then drop.
    const spot = role.dropSpot(r, r.container);
    assert.ok(Math.max(Math.abs(spot.x - 10), Math.abs(spot.y - 10)) === 1);
    assert.ok(Math.max(Math.abs(spot.x - 11), Math.abs(spot.y - 11)) >= 2);
    const loaded = creep(g, r, 50, { x: 12, y: 12 });
    loaded.memory.from = 'cont';
    role.run(loaded);
    assert.equal(loaded.calls.join(), 'travel:' + spot.x + ',' + spot.y);
    const there = creep(g, r, 50, spot);
    there.memory.from = 'cont';
    role.run(there);
    assert.equal(there.calls.join(), 'drop');
});

test('the pest flees armed hostiles first, and retires once the room is no longer Harabi\'s reservation', () => {
    const { g, h } = setup();
    const tactics = h.load('combat.tactics');
    let fled = 0;
    tactics.escape = () => { fled++; return true; };
    const role = h.load('creep.xNuisance');
    const r = room(g);
    g.Game.rooms.A = r;
    const c = creep(g, r);
    role.run(c);
    assert.equal(fled, 1);
    assert.equal(c.calls.length, 0, 'fleeing is all it does that tick');
    tactics.escape = () => false;
    const free = room(g, { controller: { pos: { x: 25, y: 25 } } });
    const d = creep(g, free);
    role.run(d);
    assert.equal(d.calls.join(), 'suicide');
});
