const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

// Bodies take damage front to back: `disabled` is how many leading parts are at 0 hits.
function body(parts, disabled) {
    return parts.map((type, i) => ({ type, hits: i < disabled ? 0 : 100 }));
}
const repeat = (type, n) => Array(n).fill(type);
const DEPOSIT_MINER = [...repeat('work', 15), ...repeat('carry', 10), ...repeat('move', 25)];

function storeOf(contents, capacity) {
    const store = Object.assign({}, contents);
    const used = () => Object.values(contents).reduce((a, b) => a + b, 0);
    Object.defineProperties(store, {
        getUsedCapacity: { value: () => used() },
        getFreeCapacity: { value: () => capacity - used() },
        getCapacity: { value: () => capacity },
    });
    return store;
}

function setup() {
    let ctx;
    const h = harness({
        'combat.intel': { roomIntel: () => ({ threats: [], friends: [] }), isDangerous: () => false, assess: () => ({}) },
        'system.remoteMining': { isDisabled: () => false, target: creep => ctx.Game.flags[creep.memory.targetFlag] },
        traveler: { Traveler: {} },
    });
    const g = h.context;
    ctx = g;
    h.load('runtime.memory').ensureInitialized();
    g.RoomPosition = function (x, y, roomName) { Object.assign(this, { x, y, roomName }); };
    const pos = (x, y, roomName) => ({ x, y, roomName,
        getRangeTo: o => { const p = o.pos || o; return Math.max(Math.abs(p.x - x), Math.abs(p.y - y)); },
        inRangeTo(o, r) { return this.getRangeTo(o) <= r; }, isNearTo(o) { return this.getRangeTo(o) <= 1; },
        findInRange: () => [] });
    const intents = [];
    function creep(props) {
        const c = Object.assign({ id: 'c', hitsMax: 5000, ticksToLive: 1000, memory: {} }, props);
        c.hits = c.body.reduce((a, p) => a + p.hits, 0);
        c.getActiveBodyparts = type => c.body.filter(p => p.type === type && p.hits > 0).length;
        for (const m of ['travelTo', 'harvest', 'transfer', 'suicide', 'heal', 'rangedHeal', 'move']) {
            c[m] = (target, ...rest) => { intents.push([m, target && (target.id || target.roomName || target)]); return g.OK; };
        }
        return c;
    }
    return { h, g, pos, creep, intents };
}

test('a deposit miner whose WORK parts are all disabled goes home for tower repairs and returns', () => {
    const { h, g, pos, creep, intents } = setup();
    const farMining = h.load('creep.farMining');
    const deposit = { id: 'deposit', lastCooldown: 5, cooldown: 0, pos: pos(10, 10, 'HW') };
    g.Game.getObjectById = id => ({ deposit })[id];
    const farRoom = { name: 'HW', find: () => [] };
    const miner = creep({ body: body(DEPOSIT_MINER, 15), room: farRoom, pos: pos(11, 10, 'HW'), store: storeOf({}, 1000),
        memory: { priority: 'farMineralMiner', destination: 'HW', homeRoom: 'H', mineralTarget: 'deposit', storageSource: 'terminal' } });

    farMining.run(miner);
    assert.equal(miner.memory.repairing, true);
    assert.deepEqual(plain(intents), [['travelTo', 'H']], 'leaves the deposit instead of failing to harvest');

    // Home with a tower: waits by storage.
    intents.length = 0;
    const storage = { id: 'storage', pos: pos(25, 25, 'H') };
    const tower = { id: 'tower', structureType: g.STRUCTURE_TOWER, pos: pos(20, 20, 'H') };
    miner.room = { name: 'H', storage, find: type => type === g.FIND_MY_STRUCTURES ? [tower] : [] };
    miner.pos = pos(40, 25, 'H');
    farMining.run(miner);
    assert.deepEqual(plain(intents), [['travelTo', 'storage']]);

    // Healed by the towers: back to work.
    intents.length = 0;
    miner.body = body(DEPOSIT_MINER, 0);
    miner.hits = miner.hitsMax = 5000;
    farMining.run(miner);
    assert.equal(miner.memory.repairing, false);
    assert.deepEqual(plain(intents)[0], ['travelTo', 'deposit']);
});

test('a crippled deposit miner unloads first, and a full terminal falls back to storage', () => {
    const { h, g, pos, creep, intents } = setup();
    const terminal = { id: 'terminal', store: { getFreeCapacity: () => 0 } };
    const storage = { id: 'storage', store: { getFreeCapacity: () => 100000 }, pos: pos(25, 25, 'H') };
    g.Game.getObjectById = id => ({ terminal })[id];
    const miner = creep({ body: body(DEPOSIT_MINER, 15), room: { name: 'H', storage, find: () => [] }, pos: pos(24, 25, 'H'),
        store: storeOf({ silicon: 300 }, 1000),
        memory: { priority: 'farMineralMiner', destination: 'HW', homeRoom: 'H', storageSource: 'terminal' } });
    h.load('creep.farMining').run(miner);
    assert.equal(miner.memory.storing, true);
    assert.deepEqual(plain(intents), [['transfer', 'storage']]);
});

test('a deposit that decayed while the miner was out: it stops waiting in the room and retires', () => {
    const { h, g, pos, creep, intents } = setup();
    g.Game.getObjectById = () => null;
    const flagRemoved = [];
    g.Game.flags.HFarMineral = { remove: () => flagRemoved.push(true) };
    const miner = creep({ body: body(DEPOSIT_MINER, 0), room: { name: 'HW', find: () => [] }, pos: pos(25, 25, 'HW'),
        store: storeOf({}, 1000), hitsMax: 5000,
        memory: { priority: 'farMineralMiner', destination: 'HW', homeRoom: 'H', mineralTarget: 'gone', targetFlag: 'HFarMineral' } });
    h.load('creep.farMining').run(miner);
    assert.equal(miner.memory.retire, true);
    assert.equal(flagRemoved.length, 1);
    h.load('creep.farMining').run(miner);
    assert.deepEqual(plain(intents).map(i => i[0]), ['suicide'], 'empty and nothing to mine: no loitering');
});

test('power healer: adjacent attacker keeps its heal over a scratched self; HEAL-less healers make room', () => {
    const { h, g, pos, creep, intents } = setup();
    const heal = h.load('creep.powerHeal');
    g.Game.flags.HPowerAttack = { pos: pos(10, 10, 'HW') };
    const attacker = { id: 'attacker', hits: 4000, hitsMax: 5000, pos: pos(10, 11, 'HW'), memory: { deathWarn: 100 } };
    g.Game.getObjectById = id => ({ attacker })[id];
    const room = { name: 'HW', find: () => [] };
    const HEALER = [...repeat('move', 16), ...repeat('heal', 16)];
    const healer = creep({ body: body(HEALER, 3), hitsMax: 3200, room, pos: pos(10, 12, 'HW'),
        memory: { priority: 'powerHeal', homeRoom: 'H', destination: 'HW', targetAttacker: 'attacker', disabledNotify: true } });
    heal.run(healer);
    assert.deepEqual(plain(intents), [['heal', 'attacker']], 'one heal intent, on the attacker');

    intents.length = 0;
    const broken = creep({ body: body(HEALER, 32), hitsMax: 3200, room, pos: pos(30, 30, 'HW'),
        memory: { priority: 'powerHeal', homeRoom: 'H', destination: 'HW', disabledNotify: true } });
    broken.hits = 1;
    heal.run(broken);
    assert.deepEqual(plain(intents), [['suicide', null]]);
});

test('a collector that cannot move waits for a nearby healer, otherwise frees its spawn slot', () => {
    const { h, g, pos, creep, intents } = setup();
    const collect = h.load('creep.powerCollect');
    const COLLECTOR = [...repeat('carry', 33), ...repeat('move', 17)];
    const room = { name: 'HW', find: () => [] };
    const make = () => creep({ body: body(COLLECTOR, 50), hitsMax: 5000, room, pos: pos(20, 20, 'HW'), store: storeOf({}, 0),
        memory: { priority: 'powerCollector', homeRoom: 'H', destination: 'HW', mode: 1 } });
    const alone = make();
    alone.hits = 1;
    collect.run(alone);
    assert.deepEqual(plain(intents), [['suicide', null]]);

    intents.length = 0;
    const helped = make();
    helped.hits = 1;
    helped.pos.findInRange = () => [{ id: 'medic', getActiveBodyparts: () => 10 }];
    collect.run(helped);
    assert.deepEqual(plain(intents), [], 'healer in range: hold still');
});

test('a damaged power collector walks to the nearest working power healer and waits there', () => {
    const { h, pos, creep, intents } = setup();
    const COLLECTOR = [...repeat('carry', 33), ...repeat('move', 17)];
    const near = { id: 'nearMedic', memory: { priority: 'powerHeal' }, pos: pos(15, 20, 'HW'), getActiveBodyparts: () => 16 };
    const far = { id: 'farMedic', memory: { priority: 'powerHeal' }, pos: pos(40, 20, 'HW'), getActiveBodyparts: () => 16 };
    const broken = { id: 'brokenMedic', memory: { priority: 'powerHeal' }, pos: pos(19, 20, 'HW'), getActiveBodyparts: () => 0 };
    const room = { name: 'HW', find: () => [far, broken, near] };
    const collector = creep({ body: body(COLLECTOR, 5), room, pos: pos(20, 20, 'HW'), store: storeOf({}, 2800),
        memory: { priority: 'powerCollector', homeRoom: 'H', destination: 'HW', mode: 0 } });
    const collect = h.load('creep.powerCollect');
    collect.run(collector);
    assert.deepEqual(plain(intents), [['travelTo', 'nearMedic']]);

    // Beside it: hold still until healed, then back to work (bank still up: wait by the flag).
    intents.length = 0;
    collector.pos = pos(16, 20, 'HW');
    collect.run(collector);
    assert.deepEqual(plain(intents), []);
});

test('power healers stay after the bank falls to heal damaged collectors, and use spare heals during it', () => {
    const { h, g, pos, creep, intents } = setup();
    const heal = h.load('creep.powerHeal');
    const HEALER = [...repeat('move', 16), ...repeat('heal', 16)];
    const patient = { id: 'collector', my: true, hits: 3000, hitsMax: 5000, pos: pos(30, 30, 'HW') };
    const room = { name: 'HW', find: () => [patient] };
    const healer = creep({ id: 'healer', body: body(HEALER, 0), hitsMax: 3200, room, pos: pos(10, 10, 'HW'),
        memory: { priority: 'powerHeal', homeRoom: 'H', destination: 'HW', disabledNotify: true } });
    heal.run(healer);   // no PowerAttack flag: the bank is down
    assert.deepEqual(plain(intents)[0], ['travelTo', 'collector'], 'goes to the damaged collector instead of suiciding');

    intents.length = 0;
    patient.hits = 5000;
    heal.run(healer);
    assert.deepEqual(plain(intents), [['suicide', null]], 'nobody left to heal');

    // Bank still up, attacker healthy: the collector beside the healer gets the heal.
    intents.length = 0;
    g.Game.flags.HPowerAttack = { pos: pos(10, 10, 'HW') };
    const attacker = { id: 'attacker', hits: 4800, hitsMax: 5000, pos: pos(10, 11, 'HW'), memory: { deathWarn: 100 } };
    g.Game.getObjectById = id => ({ attacker })[id];
    healer.memory.targetAttacker = 'attacker';
    healer.pos = pos(10, 12, 'HW');
    healer.pos.findInRange = () => [Object.assign(patient, { hits: 2000, pos: pos(11, 12, 'HW') })];
    heal.run(healer);
    assert.deepEqual(plain(intents), [['heal', 'collector']]);
    intents.length = 0;
    attacker.hits = 3500;   // reflected damage ate the buffer: attacker first again
    heal.run(healer);
    assert.deepEqual(plain(intents), [['heal', 'attacker']]);
});
