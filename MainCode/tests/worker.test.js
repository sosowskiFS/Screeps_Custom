const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

// A worker (the 'builder' role, creep.workV2) in a room before links.
function setup({ carry = 0, ticksToDowngrade = 20000, sites = [], piles = [], containers = [] } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    g.CONTROLLER_DOWNGRADE = { 3: 20000 };
    const range = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    const at = (x, y) => ({ x, y, roomName: 'R' });
    const controller = { id: 'ctrl', my: true, level: 3, ticksToDowngrade, pos: at(30, 30), sign: { username: 'Montblanc' } };
    const room = { name: 'R', controller, energyAvailable: 300, energyCapacityAvailable: 800,
        find: type => (type === g.FIND_CONSTRUCTION_SITES ? sites : type === g.FIND_DROPPED_RESOURCES ? piles :
            type === g.FIND_STRUCTURES ? containers : []) };
    const calls = [];
    const pos = Object.assign(at(10, 10), {
        getRangeTo: o => range(at(10, 10), o.pos || o), lookFor: () => [], isNearTo: o => range(at(10, 10), o.pos || o) <= 1,
        findClosestByRange: (list, opts) => {
            if (!Array.isArray(list)) list = room.find(list).filter(opts && opts.filter ? opts.filter : () => true);
            return list.slice().sort((a, b) => range(at(10, 10), a.pos) - range(at(10, 10), b.pos))[0] || null;
        },
    });
    const creep = { name: 'w', room, pos, carryCapacity: 200, carry: { energy: carry },
        store: { energy: carry, getFreeCapacity: () => 200 - carry },
        memory: { priority: 'builder', homeRoom: 'R' },
        upgradeController: () => { calls.push('upgrade'); return g.ERR_NOT_IN_RANGE; },
        build: t => { calls.push('build:' + t.id); return g.OK; }, repair: () => g.ERR_INVALID_TARGET,
        pickup: t => { calls.push('pickup:' + t.id); return g.OK; },
        withdraw: t => { calls.push('withdraw:' + t.id); return g.OK; },
        travelTo: () => { calls.push('travel'); return g.OK; }, say: () => {} };
    g.Game.getObjectById = () => null;
    return { h, g, creep, calls, run: () => h.load('creep.workV2').run(creep, 25) };
}

test('a worker upgrades first when the downgrade timer runs low, else builds, else upgrades', () => {
    const site = { id: 'site', pos: { x: 12, y: 10 } };
    let s = setup({ carry: 100, ticksToDowngrade: 3000, sites: [site] });
    s.run();
    assert.equal(s.calls[0], 'upgrade', 'timer at 3,000 (under 30% of 20,000): the controller first');
    s = setup({ carry: 100, sites: [site] });
    s.run();
    assert.ok(s.calls.includes('build:site'), 'a site: build it');
    s = setup({ carry: 100 });
    s.run();
    assert.ok(s.calls.includes('upgrade'), 'nothing to build: upgrade');
});

test('an empty worker takes dropped energy first when it is as close as a container', () => {
    const pile = { id: 'pile', resourceType: 'energy', amount: 3000, pos: { x: 14, y: 10 } };
    const s0 = setup();
    const container = { id: 'box', structureType: s0.g.STRUCTURE_CONTAINER, store: { energy: 1500 }, pos: { x: 12, y: 10 } };
    const s = setup({ piles: [pile], containers: [container] });
    s.run();
    assert.ok(s.calls.includes('pickup:pile'), JSON.stringify(s.calls));
    const far = setup({ piles: [Object.assign({}, pile, { pos: { x: 40, y: 40 } })], containers: [container] });
    far.run();
    assert.ok(far.calls.includes('withdraw:box'), 'a pile far off: the container ' + JSON.stringify(far.calls));
});
