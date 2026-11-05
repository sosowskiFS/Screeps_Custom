const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

function setup({ storage = 120, terminal = 18203, attacked = true } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    const room = { name: 'W1N9', energyAvailable: 1000, energyCapacityAvailable: 4400,
        storage: { id: 'storage', store: { energy: storage } }, terminal: { id: 'terminal', store: { energy: terminal } } };
    g.Memory.roomsUnderAttack = attacked ? ['W1N9'] : [];
    return { h, g, room, logistics: h.load('creep.logistics') };
}

test('under attack the terminal (energy aid) is drawn on first; quiet with a healthy storage, the storage', () => {
    let { room, logistics } = setup();
    assert.equal(logistics.homeEnergy(room, 100).id, 'terminal', 'W1N9: 120 in storage, 18k aid in the terminal');
    ({ room, logistics } = setup({ storage: 400000, terminal: 20000 }));
    assert.equal(logistics.homeEnergy(room, 100).id, 'terminal', 'under attack even with a full storage');
    ({ room, logistics } = setup({ storage: 400000, terminal: 20000, attacked: false }));
    assert.equal(logistics.homeEnergy(room, 100).id, 'storage');
    ({ room, logistics } = setup({ storage: 50000, terminal: 20000, attacked: false }));
    assert.equal(logistics.homeEnergy(room, 100).id, 'terminal', 'storage low: the terminal first, as the distributors did');
    ({ room, logistics } = setup({ storage: 5000, terminal: 0 }));
    assert.equal(logistics.homeEnergy(room, 100).id, 'storage', 'an empty terminal: the storage');
});

test('a young-room distributor carrying terminal energy stocks the storage first under attack', () => {
    const { h, g, room } = setup();
    const calls = [];
    g.Game.rooms.W1N9 = room;
    g.Game.getObjectById = () => null;
    const creep = { name: 'd', room, ticksToLive: 1000, carryCapacity: 300,
        memory: { priority: 'distributor', homeRoom: 'W1N9', tookFrom: 'terminal', deathWarn: 0 },
        carry: { energy: 300 }, store: { energy: 300, getFreeCapacity: () => 0 },
        pos: { x: 18, y: 7, findClosestByPath: () => null, findClosestByRange: () => null, findInRange: () => [], lookFor: () => [] },
        transfer: (t, r) => { calls.push(['transfer', t.id]); return g.OK; }, travelTo: () => {}, say: () => {} };
    h.load('creep.workV2').run(creep, 25);
    assert.deepEqual(calls[0], ['transfer', 'storage']);
});
