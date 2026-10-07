const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

function storeOf(contents, capacity) {
    const store = Object.assign({}, contents);
    const used = () => Object.values(store).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
    Object.defineProperties(store, {
        getFreeCapacity: { value: () => capacity - used() },
        getUsedCapacity: { value: () => used() },
    });
    return store;
}

// A mule beside a spawn it is filling; another extension further on still needs energy.
function setup(energy) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    const structure = (id, type, free) => ({ id, structureType: type, hits: 1, hitsMax: 1,
        store: storeOf({ energy: 300 - free }, 300), energy: 300 - free, energyCapacity: 300 });
    const spawn = structure('spawn', g.STRUCTURE_SPAWN, 300);
    const extension = structure('ext', g.STRUCTURE_EXTENSION, 50);
    const storage = { id: 'storage', store: storeOf({ energy: 500000 }, 1000000) };
    const room = { name: 'R', storage, terminal: null, find: () => [spawn, extension] };
    g.Game.getObjectById = id => ({ spawn, ext: extension, storage })[id] || null;
    const calls = [];
    const creep = {
        name: 'm', room, ticksToLive: 1000, memory: { priority: 'mule', deathWarn: 0, structureTarget: 'spawn' },
        carry: { energy }, store: storeOf({ energy }, 300),
        pos: { isNearTo: t => t.id === 'spawn', findClosestByRange: list => list[0] },
        build: () => g.ERR_INVALID_TARGET,
        transfer: t => { calls.push(['transfer', t.id]); return t.id === 'spawn' ? g.OK : g.ERR_NOT_IN_RANGE; },
        travelTo: t => calls.push(['travelTo', t.id]),
    };
    return { calls, run: () => h.load('creep.mule').run(creep) };
}

test('a hauler that hands over the last of its energy turns back for more on the same tick', () => {
    const { calls, run } = setup(150);
    run();
    assert.deepEqual(plain(calls), [['transfer', 'spawn'], ['travelTo', 'storage']]);
});

test('with energy left after the transfer it carries on to the next sink', () => {
    const { calls, run } = setup(400);   // the spawn takes 300 of 400
    run();
    assert.deepEqual(plain(calls), [['transfer', 'spawn'], ['travelTo', 'ext']]);
});
