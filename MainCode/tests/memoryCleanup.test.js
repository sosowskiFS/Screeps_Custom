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
    assert.ok('flagCount' in g.Memory, 'kept: the Nightmare branch reads it without a guard');
    assert.deepEqual(plain(g.Memory.creeps.lw), { priority: 'labWorker', homeRoom: 'E10N10', mineral4: 'X', lab4: 'id' });
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
