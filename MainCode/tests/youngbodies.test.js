const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

function load() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.BODYPART_COST = { move: 50, work: 100, carry: 50, MOVE: 50, WORK: 100, CARRY: 50 };
    return { h, g, build: h.load('spawn.BuildCreeps') };
}
const count = (body, type) => body.filter(p => p === type).length;
const cost = body => body.reduce((n, p) => n + ({ move: 50, work: 100, carry: 50 })[p], 0);

test('young workers never trade MOVE away to fit (800 energy used to give 5 WORK, 5 CARRY, 1 MOVE)', () => {
    const { g, build } = load();
    for (let energy = 200; energy <= 1800; energy += 50) {
        for (const role of ['upgrader', 'builder', 'repair']) {
            const body = plain(build.getWorkerConfig(energy, role));
            const work = count(body, g.WORK), carry = count(body, g.CARRY), move = count(body, g.MOVE);
            assert.ok(cost(body) <= energy || energy < 200, role + ' ' + energy);
            assert.ok(work >= 1 && carry >= 1, role + ' ' + energy);
            // Full speed empty on plains, at least half loaded.
            assert.ok(move >= work && 2 * move >= work + carry, role + ' ' + energy + ': ' + body.join(','));
        }
    }
    assert.deepEqual(plain(build.getWorkerConfig(800, 'upgrader')).map(p => p[0]).join(''), 'wwwwccccmmmm');
    assert.deepEqual(plain(build.getWorkerConfig(800, 'builder')).map(p => p[0]).join(''), 'wwccccmmmm');
});

test('young distributors are CARRY/MOVE 1:1 sized to the energy, up to 8 pairs', () => {
    const { g, build } = load();
    const at = e => plain(build.getDistributorConfig(e, 5, 2));
    assert.deepEqual([count(at(300), g.CARRY), count(at(300), g.MOVE)], [3, 3]);
    assert.deepEqual([count(at(800), g.CARRY), count(at(800), g.MOVE)], [8, 8]);
    assert.deepEqual([count(at(1300), g.CARRY), count(at(1300), g.MOVE)], [8, 8]);
    assert.deepEqual(at(150), [g.CARRY, g.MOVE]);
});

test('harvesters carry one CARRY (they harvest straight into their container)', () => {
    const { g, build } = load();
    for (const e of [300, 550, 800, 1300]) assert.equal(count(plain(build.getMinerConfig(e, 5, 0)), g.CARRY), 1, String(e));
    assert.equal(count(plain(build.getMinerConfig(800, 5, 0)), g.WORK), 5);
});

test('bootstrap harvester: picks up dropped energy, harvests, fills the spawn, then builds the source container', () => {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    const calls = [];
    const at = (x, y) => ({ x, y, inRangeTo: (p, r) => Math.max(Math.abs((p.pos || p).x - x), Math.abs((p.pos || p).y - y)) <= r,
        findInRange: () => [], findClosestByRange: list => (Array.isArray(list) ? list[0] : undefined) });
    const room = { name: 'NEW', controller: { pos: at(40, 40) }, find: () => [], createConstructionSite: () => calls.push('site') };
    const source = { id: 's1', room, pos: Object.assign(at(10, 10), { findInRange: () => [] }) };
    const spawn = { structureType: g.STRUCTURE_SPAWN, store: { getFreeCapacity: () => 100 } };
    const drop = { resourceType: g.RESOURCE_ENERGY, amount: 500, pos: at(11, 12) };
    g.Game.getObjectById = id => (id === 's1' ? source : undefined);
    const store = { [g.RESOURCE_ENERGY]: 0, getFreeCapacity: () => 100 };
    const creep = { room, memory: { priority: 'harvester', sourceLocation: 's1', homeRoom: 'NEW' }, store, carry: store,
        getActiveBodyparts: t => (t === g.CARRY ? 2 : 1),
        pos: Object.assign(at(11, 11), { lookFor: () => [], findClosestByRange: (type, opts) => { const list = Array.isArray(type) ? type : type === g.FIND_DROPPED_RESOURCES ? [drop] : type === g.FIND_MY_STRUCTURES ? [spawn] : []; return list.filter(o => !opts || !opts.filter || opts.filter(o))[0]; } }),
        pickup: () => { calls.push('pickup'); return g.OK; }, harvest: () => { calls.push('harvest'); return g.OK; },
        transfer: () => { calls.push('transfer'); return g.OK; }, build: () => { calls.push('build'); return g.OK; },
        upgradeController: () => { calls.push('upgrade'); return g.OK; }, travelTo: () => calls.push('travel') };
    const work = h.load('creep.workV2');
    assert.equal(work.bootstrapping(creep), true);
    work.run(creep, 25);
    assert.deepEqual(calls, ['pickup'], 'energy lying within 5 first');
    calls.length = 0; store[g.RESOURCE_ENERGY] = 100; store.getFreeCapacity = () => 0;
    work.run(creep, 25);
    assert.deepEqual(calls, ['transfer'], 'full: the spawn');
    calls.length = 0; spawn.store.getFreeCapacity = () => 0;
    const site = { structureType: g.STRUCTURE_CONTAINER, pos: at(11, 11) };
    room.find = type => (type === g.FIND_MY_CONSTRUCTION_SITES ? [site] : []);
    work.run(creep, 25);
    assert.deepEqual(calls, ['build'], 'spawn full: the container at its source');
});
