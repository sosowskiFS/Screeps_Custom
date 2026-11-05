const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

function base() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    return { h, g };
}
const near = (x, y) => ({ x, y, inRangeTo: (o, r) => Math.max(Math.abs((o.pos || o).x - x), Math.abs((o.pos || o).y - y)) <= r,
    isNearTo: o => Math.max(Math.abs((o.pos || o).x - x), Math.abs((o.pos || o).y - y)) <= 1 });
const link = (id, x, y, energy) => ({ id, structureType: 'STRUCTURE_LINK', pos: near(x, y), store: { energy, getFreeCapacity: () => 800 - energy } });

test('roles: the two receivers by purpose, every other link a sender', () => {
    const { h } = base();
    const r = h.load('system.links').classify([{ id: 'a' }, { id: 'up' }, { id: 'b' }, { id: 'hub' }], 'hub', 'up');
    assert.equal(r.up, 'up');
    assert.equal(r.store, 'hub');
    assert.deepEqual([...r.senders], ['a', 'b']);
});

test('the upgrade miner stores in whichever link beside it has most room', () => {
    const { h, g } = base();
    const full = link('full', 10, 11, 800), half = link('half', 11, 10, 400), far = link('far', 20, 20, 0);
    g.Game.getObjectById = id => ({ full, half, far })[id];
    const creep = { pos: near(10, 10), room: { find: () => [full, half, far] }, memory: { atSpot: true } };
    const miner = h.load('creep.miner');
    const adj = miner.adjacentLinks(creep).map(l => l.id);
    assert.deepEqual([...adj].sort(), ['full', 'half'], 'only those beside it');
});

test('the upgrade supplier fills the upgrade link only when it and the miner links are low; it upgrades otherwise', () => {
    const { h, g } = base();
    const up = link('up', 30, 30, 100), minerLink = link('m', 10, 11, 600);
    g.Memory.sourceList = { R: ['s0', 's1'] };
    g.Memory.linkRoles = { R: { up: 'up', store: 'hub', senders: ['m'] } };
    const source = { id: 's1', pos: near(10, 10) };
    g.Game.getObjectById = id => ({ up, m: minerLink, s1: source })[id];
    const room = { name: 'R', controller: { my: true, level: 7 } };
    const sup = h.load('creep.upsupplier');
    assert.equal(sup.linkLow(room, up), false, 'the miner link holds 600: energy is coming');
    minerLink.store.energy = 50;
    assert.equal(sup.linkLow(room, up), true, 'both low: fill it');
    up.store.energy = 300;
    assert.equal(sup.linkLow(room, up), false, 'the upgrade link holds 300');
});

test('the upgrade supplier body: 8 CARRY, the WORK asked for (at most 10), MOVE for road speed', () => {
    const { h, g } = base();
    const s5 = h.load('spawn.BuildCreeps5');
    const count = (b, t) => b.filter(p => p === t).length;
    g.BODYPART_COST = { [g.WORK]: 100, [g.CARRY]: 50, [g.MOVE]: 50 };
    const parts = b => [count(b, g.WORK), count(b, g.CARRY), count(b, g.MOVE)];
    assert.deepEqual(parts(s5.upSupplierBody(5600, 3)), [3, 8, 6]);
    assert.deepEqual(parts(s5.upSupplierBody(5600, 25)), [10, 8, 9], 'capped at 10 WORK');
    assert.deepEqual(parts(s5.upSupplierBody(5600, 0)), [0, 8, 4], 'nothing to spare: a hauler');
    assert.deepEqual(parts(s5.upSupplierBody(800, 10)), [1, 8, 5], 'what the room can pay for');
});

test('the upgrade supplier WORK comes from the budget left after upgraders and repairers', () => {
    const { h } = base();
    const s5 = h.load('spawn.BuildCreeps5');
    assert.equal(s5.upSupplierWork(null), 2, 'no trusted budget: the default');
    assert.equal(s5.upSupplierWork({ spare: 2.6 }), 3);
    assert.equal(s5.upSupplierWork({ spare: 0 }), 0);
    assert.equal(s5.upSupplierWork({ spare: 40 }), 10);
});

test('a scraper only while 500+ energy lies dropped by the sender links', () => {
    const { h, g } = base();
    const m = link('m', 10, 10, 800);
    g.Memory.linkRoles = { R: { up: 'up', store: 'hub', senders: ['m'] } };
    g.Game.getObjectById = id => (id === 'm' ? m : null);
    const piles = [];
    const room = { name: 'R', find: t => (t === g.FIND_DROPPED_RESOURCES ? piles : []) };
    const s5 = h.load('spawn.BuildCreeps5');
    assert.equal(s5.scraperWanted(room), false);
    piles.push({ resourceType: 'energy', amount: 400, pos: { x: 11, y: 11 } }, { resourceType: 'energy', amount: 300, pos: { x: 30, y: 30 } });
    g.Game.time++;
    assert.equal(s5.scraperWanted(room), false, '400 near, 300 far away');
    piles.push({ resourceType: 'energy', amount: 200, pos: { x: 12, y: 9 } });
    g.Game.time++;
    assert.equal(s5.scraperWanted(room), true, '600 near');
});

test('the upgrade link dry and an upgrader beside it out of energy: the supplier puts its load in the link, whatever the miner links hold', () => {
    const { h, g } = base();
    const up = link('up', 30, 30, 20), minerLink = link('m', 10, 11, 350);   // under 400: sends nothing yet
    g.Memory.sourceList = { R: ['s0', 's1'] };
    g.Memory.linkRoles = { R: { up: 'up', store: 'hub', senders: ['m'] } };
    const source = { id: 's1', pos: near(10, 10) };
    g.Game.getObjectById = id => ({ up, m: minerLink, s1: source })[id];
    const upgrader = { memory: { priority: 'upgrader' }, store: { energy: 0 }, pos: near(31, 31) };
    const room = { name: 'R', controller: { my: true, level: 7 }, find: type => (type === g.FIND_MY_CREEPS ? [upgrader] : []) };
    const creep = { room };
    const sup = h.load('creep.upsupplier');
    assert.equal(sup.energyTarget(creep, up, null), up, 'upgraders idle: the link first');
    // The upgrader still has energy: it upgrades on, and the supplier with it.
    upgrader.store.energy = 50;
    g.Game.time++;
    assert.equal(sup.energyTarget(creep, up, null), null);
    upgrader.store.energy = 0;
    // The link not dry: the upgrader is about to draw from it.
    up.store.energy = 150;
    g.Game.time++;
    assert.equal(sup.energyTarget(creep, up, null), null);
    up.store.energy = 20;
    // Under attack upgraders hold on purpose.
    g.Memory.roomsUnderAttack = ['R'];
    room.controller.ticksToDowngrade = 140000;
    g.CONTROLLER_DOWNGRADE = { 7: 150000 };
    g.Game.time++;
    assert.equal(sup.energyTarget(creep, up, null), null);
});
