const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

function setup() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Game.time = 200000;
    g.Game.spawns = { s: { room: { name: 'E10N10' } } };
    g.Game.map.getRoomLinearDistance = (a, b) => Math.abs(parseInt(a.slice(1, 3), 10) - parseInt(b.slice(1, 3), 10)) +
        Math.abs(parseInt(a.slice(4, 6), 10) - parseInt(b.slice(4, 6), 10));
    return { h, g, cleanup: h.load('runtime.memoryCleanup') };
}

test('obsolete keys, dead creep fields and idle travel data go; essential creep memory stays', () => {
    const { g, cleanup } = setup();
    Object.assign(g.Memory, { genBestSourceID: {}, rampartQueue: {}, averageUsedCPU: 1, energyCap: [1], ClosedrampartList: [],
        flagCount: { NeedFlag: [] } });
    g.Memory.creeps = {
        lw: { priority: 'labWorker', homeRoom: 'E10N10', isMoving: false, resourceChecks: 3, movingOtherMineral2: false,
            mineral4: 'X', lab4: 'id', _trav: { path: '', state: [1, 2, 0, 0, 3, 4, 'E10N10'] } },
        mule: { priority: 'farMule', targetFlag: 'E10N10FarMining', _trav: { path: '3333', state: [1, 2, 0, 0, 3, 4, 'E11N10'] } },
    };
    cleanup.clean();
    for (const key of ['genBestSourceID', 'rampartQueue', 'averageUsedCPU', 'energyCap', 'ClosedrampartList']) assert.ok(!(key in g.Memory), key);
    assert.ok(!('flagCount' in g.Memory), 'the old flag counts fed nothing');
    assert.deepEqual(plain(g.Memory.creeps.lw), { priority: 'labWorker', homeRoom: 'E10N10' }, 'lab ids/minerals are derived each tick now');
    assert.equal(g.Memory.creeps.mule._trav.path, '3333', 'a creep still travelling keeps its path');
});

test('expired remote records and far-away or ancient intel are pruned; current ones stay', () => {
    const { g, cleanup } = setup();
    const now = g.Game.time;
    g.Memory.remoteThreat = { E11N10: { t: now - 100 }, E12N10: { t: now - 5000 } };
    g.Memory.FarRoomsOutmatched = { E11N10: now + 10, E12N10: now - 1 };
    g.Memory.remoteTrips = { E10N10: { fresh: { t: now - 10, trip: 50 }, old: { t: now - 60000, trip: 80 } }, W1N1: { x: { t: now, trip: 1 } } };
    g.Memory.remoteIntel = { E11N10: { t: now - 10 }, E20N20: { t: now - 10 }, E12N11: { t: now - 150000 } };
    g.Memory.rooms = { E10N10: {}, E11N10: { avoid: 1 } };
    cleanup.clean();
    assert.deepEqual(Object.keys(g.Memory.remoteThreat), ['E11N10']);
    assert.deepEqual(Object.keys(g.Memory.FarRoomsOutmatched), ['E11N10']);
    assert.deepEqual(plain(g.Memory.remoteTrips), { E10N10: { fresh: { t: now - 10, trip: 50 } } }, 'lost home dropped');
    assert.deepEqual(Object.keys(g.Memory.remoteIntel), ['E11N10'], 'out of range and ancient intel dropped');
    assert.deepEqual(Object.keys(g.Memory.rooms), ['E11N10']);
});

test('memCreeps(): creep memory size by field and by role', () => {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    const lines = [];
    g.console = { log: t => lines.push(String(t)) };
    g.Memory.creeps = { a: { priority: 'farMule', _trav: { path: '1'.repeat(300) } }, b: { priority: 'miner', homeRoom: 'E1N1' } };
    h.load('runtime.console');
    g.memCreeps();
    const out = lines.join('\n');
    assert.match(out, /Creep memory: 2 creeps/);
    assert.match(out, /By field:\n {2}_trav: \d+/, 'largest field first');
    assert.match(out, /farMule: 1 creeps/);
});

test('fields only some roles read are dropped from the others, at spawn and in the cleanup', () => {
    const { h } = setup();
    const { slimCreep } = h.load('runtime.memoryCleanup');
    const farMule = { priority: 'farMule', fromSpawn: 'id', terminalID: 't', homeRoom: 'R' };
    slimCreep(farMule);
    assert.deepEqual(plain(farMule), { priority: 'farMule', homeRoom: 'R' });
    const mule = { priority: 'mule', fromSpawn: 'id', terminalID: 't' };
    slimCreep(mule);
    assert.deepEqual(plain(mule), { priority: 'mule', fromSpawn: 'id', terminalID: 't' }, 'mules read both');
    const lw = { priority: 'labWorker', fromSpawn: 'id', terminalID: 't', lab1: 'a', mineral6: 'X', factory: 'f' };
    slimCreep(lw);
    assert.deepEqual(plain(lw), { priority: 'labWorker', fromSpawn: 'id', factory: 'f' }, 'fills in as distributor: keeps fromSpawn');
    const switched = { priority: 'repair', previousPriority: 'mule', fromSpawn: 'id' };
    slimCreep(switched);
    assert.equal(switched.fromSpawn, 'id');
});

test('new creeps are spawned with only the memory their role reads', () => {
    const h = harness(), g = h.context;
    const orders = [];
    g.StructureSpawn = class { spawnCreep(body, name, opts) { orders.push(opts.memory); return g.OK; } };
    h.load('runtime.memory').ensureInitialized();
    h.load('spawn.state');
    const spawn = Object.assign(new g.StructureSpawn(), { room: { name: 'R' }, pos: {} });
    spawn.spawnCreep([], 'x', { memory: { priority: 'harasser', fromSpawn: 'id', homeRoom: 'R' } });
    assert.deepEqual(plain(orders[0]), { priority: 'harasser', homeRoom: 'R' });
});

test('heap-only keys: on Memory during the tick, never serialized, replacements kept, rebuilt after a reset', () => {
    const h = harness(), g = h.context;
    const heapMemory = h.load('runtime.heapMemory');
    g.Memory.labList = { R: ['a', 'b'] };           // first tick: adopted from Memory
    heapMemory.attach();
    assert.deepEqual(plain(g.Memory.labList), { R: ['a', 'b'] });
    g.Memory.mineralTotals = { H: 5 };              // code may replace a whole key
    heapMemory.detach();
    assert.ok(!('labList' in g.Memory) && !('mineralTotals' in g.Memory), 'not saved with Memory');
    heapMemory.attach();                            // next tick
    assert.deepEqual(plain(g.Memory.labList), { R: ['a', 'b'] });
    assert.deepEqual(plain(g.Memory.mineralTotals), { H: 5 });
    // A global reset loses the heap: keys start missing and their owners rebuild them.
    const fresh = harness();
    fresh.load('runtime.heapMemory').attach();
    assert.equal(fresh.context.Memory.labList, undefined);
});
