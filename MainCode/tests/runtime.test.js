const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

test('full module graph: fresh memory, interval boundaries, global reset', () => {
    const h = harness();
    const main = h.load('main');
    for (const time of [1, 2, 50, 500, 1000, 5000, 10000]) {
        h.context.Game.time = time;
        main.loop();
        assert.ok(h.context.Memory.CPUAverages.TotalCPU.ticks > 0);
        // Rebuildable caches stay in heap: never serialized with Memory.
        assert.ok(!('roomCreeps' in h.context.Memory) && !('labList' in h.context.Memory) && !('structureScanTick' in h.context.Memory));
    }
    const next = harness();
    next.context.Memory = plain(h.context.Memory);
    next.context.Memory.observationPointers.W1N1 = [1, 2, 'W0N0'];
    next.load('main').loop();
    assert.deepEqual(plain(next.context.Memory.observationPointers.W1N1), [1, 2, 'W0N0']);
});
test('queries share scans, isolate array mutation, rerun predicates and expire', () => {
    const { context: g, load } = harness();
    const cache = load('runtime.cache');
    let scans = 0;
    const a = { structureType: 'tower', energy: 1 }, b = { structureType: 'road', energy: 0 };
    const room = { name: 'W1N1', find: () => { scans++; return [a, b]; } };
    const query = () => cache.find(room, g.FIND_STRUCTURES, { filter: { structureType: 'tower' } });
    query().pop();
    assert.deepEqual(plain(query()), [a]);
    assert.equal(scans, 1);
    a.energy = 0;
    assert.equal(cache.find(room, g.FIND_STRUCTURES, { filter: s => s.energy > 0 }).length, 0);
    g.Game.time++; query(); assert.equal(scans, 2);
    cache.invalidateRoom(room.name); query(); assert.equal(scans, 3);
});
test('construction membership stays live; market queries use resource/type index', () => {
    const { context: g, load } = harness();
    const cache = load('runtime.cache');
    let sites = [];
    const room = { name: 'W1N1', find: () => sites.slice() };
    assert.equal(cache.find(room, g.FIND_CONSTRUCTION_SITES).length, 0);
    sites.push({ id: 'new' });
    assert.equal(cache.find(room, g.FIND_CONSTRUCTION_SITES).length, 1);
    const calls = [];
    g.Game.market.getAllOrders = filter => { calls.push(plain(filter)); return [{ id: 'a', price: 1 }, { id: 'b', price: 2 }]; };
    cache.marketOrders('energy', 'buy').reverse();
    assert.equal(cache.marketOrders('energy', 'buy')[0].id, 'a');
    assert.equal(cache.marketOrders('energy', 'buy', o => o.price >= 2).length, 1);
    assert.equal(cache.marketOrders('energy', 'buy', o => o.price >= 3).length, 0);
    assert.deepEqual(calls, [{ resourceType: 'energy', type: 'buy' }]);
    g.Game.time++; cache.marketOrders('energy', 'buy'); assert.equal(calls.length, 2);
});
test('home index includes remote/spawning creeps and refreshes next tick', () => {
    const { context: g, load } = harness();
    const cache = load('runtime.cache');
    g.Game.creeps = { a: { memory: { homeRoom: 'A' }, room: { name: 'B' } }, b: { memory: { homeRoom: 'B' }, spawning: true } };
    assert.equal(cache.homeCreeps('A')[0], g.Game.creeps.a);
    assert.equal(cache.homeCreeps('B')[0], g.Game.creeps.b);
    g.Game.creeps.a.memory.homeRoom = 'B'; g.Game.time++;
    assert.equal(cache.homeCreeps('A').length, 0);
    assert.equal(cache.homeCreeps('B').length, 2);
});
test('multiple spawns share energy with independent busy reservations', () => {
    const { context: g, load } = harness();
    load('runtime.memory').ensureInitialized();
    const state = load('spawn.state');
    const room = { name: 'A', energyAvailable: 1000, controller: { my: true } };
    g.Game.rooms.A = room;
    const a = { id: 'a', room }, b = { id: 'b', room };
    g.Game.getObjectById = id => ({ a, b })[id];
    const index = state.getEnergyIndex(room);
    g.Memory.CurrentRoomEnergy[index] -= 400;
    assert.equal(g.Memory.CurrentRoomEnergy[state.getEnergyIndex(room)], 600);
    g.setSpawnBusy(a);
    assert.equal(state.isSpawnBusy(a), true);
    assert.equal(!!state.isSpawnBusy(b), false);
    state.cleanupSpawnTracking();
    assert.equal(!!state.isSpawnBusy(a), false);
});
test('power-creep-only attacks do not crash room defense', () => {
    const { context: g, load } = harness();
    load('runtime.memory').ensureInitialized();
    load('system.defense').handleHostileDetection({ name: 'A', controller: {} }, [], [{ owner: { username: 'enemy' } }]);
    assert.deepEqual(plain(g.Memory.roomsUnderAttack), ['A']);
});
test('phase profiling adds CPU reads only when enabled', () => {
    const { context: g, load } = harness();
    let reads = 0, runs = 0;
    g.Game.cpu.getUsed = () => ++reads;
    const metrics = load('runtime.metrics');
    metrics.runPhases([['test', () => runs++]]);
    assert.equal(reads, 0);
    g.Memory.settings.profile = true;
    metrics.runPhases([['test', () => runs++]]);
    assert.equal(runs, 2);
    assert.deepEqual(plain(g.Memory.phaseCPU.test), { ticks: 1, average: 1, max: 1 });
});


test('typed room queries avoid repeated full-list predicate work', () => {
    const { context: g, load } = harness();
    let reads = 0;
    const values = Array.from({ length: 200 }, (_, i) => ({ get structureType() { reads++; return i % 2 ? 'road' : 'tower'; } }));
    for (let i = 0; i < 30; i++) values.filter(s => s.structureType === 'tower');
    const legacyReads = reads;
    reads = 0;
    const room = { name: 'A', find: () => values };
    for (let i = 0; i < 30; i++) assert.equal(load('runtime.cache').find(room, g.FIND_STRUCTURES, { filter: { structureType: 'tower' } }).length, 100);
    assert.equal(legacyReads, 6000); assert.equal(reads, 200);
});

test('three-spawn room runs management once, shares budgets and survives interrupted scratch state', () => {
    const calls = [];
    let g;
    const h = harness({
        'spawn.BuildCreeps': { run(spawn, body, room, creeps, index) {
            calls.push([spawn.id, g.Memory.CurrentRoomEnergy[index]]);
            g.Memory.CurrentRoomEnergy[index] -= 100;
            g.setSpawnBusy(spawn);
        } },
        'tower.Operate': { run(tower) { calls.push(['tower', tower.id]); } },
    });
    g = h.context;
    const room = { name: 'A', energyAvailable: 500, energyCapacityAvailable: 500,
        controller: { my: true, level: 4, owner: { username: 'Montblanc' } },
        find: () => [] };
    for (const id of ['one', 'two', 'three']) g.Game.spawns[id] = { id, name: id, room, isActive: () => true };
    g.Game.structures.tower = { id: 'tower', room, structureType: g.STRUCTURE_TOWER };
    g.Game.rooms.A = room;
    g.Game.getObjectById = id => g.Game.spawns[id] || null;
    g.Game.map.getRoomTerrain = () => ({ get: () => 0 });   // every owned room is base-planned now
    const main = h.load('main');
    g.Game.time = 30;
    main.loop();
    assert.deepEqual(calls, [['tower', 'tower'], ['one', 500], ['two', 400], ['three', 300]]);
    assert.equal(h.load('runtime.heapMemory').get('structureScanTick').A, 30);
    calls.length = 0;
    g.Game.time = 31;
    g.Memory.RoomsRun = ['A']; g.Memory.CurrentRoomEnergy = ['A', 0];
    main.loop();
    assert.deepEqual(calls, [['tower', 'tower']]);
    assert.equal(h.load('runtime.cache').current().spawnRoles, undefined);
    assert.equal(h.load('runtime.heapMemory').get('structureScanTick').A, 30, 'valid empty structure lists do not rebuild every tick');
    assert.deepEqual(plain(g.Memory.CurrentRoomEnergy), []);
});
