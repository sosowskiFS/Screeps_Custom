const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

function setup({ at = { x: 20, y: 20 }, energy = 50, link = { x: 21, y: 20, energy: 400 }, upgrade = 'OK' } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    g.Game.time = 1001;
    const range = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    const controller = { pos: { x: 22, y: 22 }, level: 4 };
    const room = { name: 'R', controller };
    const linkObj = link && { id: 'link', pos: link, store: { energy: link.energy } };
    g.Game.getObjectById = id => (id === 'link' ? linkObj : null);
    const calls = [];
    const creep = {
        name: 'u', room, ticksToLive: 1000, store: { energy }, body: [],
        memory: { priority: 'upgrader', hasBoosted: true, workParts: 10, linkSource: linkObj ? 'link' : undefined, deathWarn: 1 },
        pos: Object.assign({ isNearTo: o => range(at, o.pos || o) <= 1, inRangeTo: (o, r) => range(at, o.pos || o) <= r,
            findInRange: () => [] }, at),
        upgradeController: () => { calls.push('upgrade'); return upgrade === 'OK' ? g.OK : g[upgrade]; },
        withdraw: () => { calls.push('withdraw'); return g.OK; },
        travelTo: () => { calls.push('travel'); return g.OK; },
        say: () => {}, move: d => calls.push('move:' + d),
    };
    return { h, g, creep, calls, run: () => h.load('creep.upgrader').run(creep) };
}

test('an upgrader in position by its link is parked: it cannot be pushed aside, also while the link refills', () => {
    const s = setup();
    s.run();
    assert.equal(s.creep.memory.onPoint, true);
    const empty = setup({ energy: 0, link: { x: 21, y: 20, energy: 0 } });
    empty.run();
    assert.equal(empty.creep.memory.onPoint, true, 'waiting by the link for energy: still in position');
    // Parked creeps are never swapped aside (Traveler.pushBlocker).
    const { Traveler } = s.h.load('traveler');
    const pusher = { name: 'p', pos: { x: 19, y: 20, roomName: 'R' } };
    s.g.RoomPosition = function (x, y, roomName) { Object.assign(this, { x, y, roomName }); this.lookFor = () => [Object.assign(s.creep, { my: true, fatigue: 0, spawning: false })]; };
    assert.equal(Traveler.pushBlocker(pusher, s.g.RIGHT), false);
});

test('an upgrader on its way (out of range, or to its link) is not parked', () => {
    const far = setup({ at: { x: 10, y: 10 }, upgrade: 'ERR_NOT_IN_RANGE' });
    far.run();
    assert.equal(far.creep.memory.onPoint, undefined);
    const off = setup({ at: { x: 22, y: 25 } });            // upgrading, but not by its link
    off.creep.memory.onPoint = true;
    off.run();
    assert.equal(off.creep.memory.onPoint, undefined);
});
