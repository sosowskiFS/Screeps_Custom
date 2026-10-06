const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

function storeOf(contents, capacity) {
    const store = Object.assign({}, contents);
    Object.defineProperties(store, {
        getCapacity: { value: () => capacity },
        getUsedCapacity: { value: () => Object.values(contents).reduce((a, b) => a + b, 0) },
        getFreeCapacity: { value: () => capacity - Object.values(contents).reduce((a, b) => a + b, 0) },
    });
    return store;
}

function setup() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy'; g.RESOURCE_OPS = 'ops'; g.RESOURCE_POWER = 'power';
    g.POWER_INFO = { PWR_OPERATE_TOWER: { ops: 10 }, PWR_OPERATE_EXTENSION: { ops: 2 }, PWR_GENERATE_OPS: {},
        PWR_OPERATE_SPAWN: { ops: 100 }, PWR_REGEN_SOURCE: {}, PWR_OPERATE_LAB: { ops: 10 }, PWR_OPERATE_POWER: { ops: 200 } };
    const pos = (x, y) => ({ x, y, roomName: 'A',
        getRangeTo: o => { const p = o.pos || o; return Math.max(Math.abs(p.x - x), Math.abs(p.y - y)); },
        inRangeTo(o, r) { return this.getRangeTo(o) <= r; }, isNearTo(o) { return this.getRangeTo(o) <= 1; },
        findInRange: () => [], findClosestByRange: list => list[0], getDirectionTo: () => 1, lookFor: () => [] });
    const structures = [];
    const hostiles = [];
    const room = { name: 'A', energyAvailable: 12900, energyCapacityAvailable: 12900,
        controller: { my: true, level: 8, isPowerEnabled: true },
        find: type => type === g.FIND_HOSTILE_CREEPS ? hostiles : (type === g.FIND_MY_STRUCTURES || type === g.FIND_STRUCTURES) ? structures : [] };
    room.storage = { id: 'storage', structureType: 'storage', pos: pos(25, 25), store: storeOf({ energy: 500000 }, 1000000) };
    g.Game.rooms.A = room;
    const objects = { storage: room.storage };
    let lookups = 0;
    g.Game.getObjectById = id => { lookups++; return objects[id] || null; };
    g.Memory.powerSpawnList = { A: [] };
    g.Memory.towerNeedEnergy = {};
    const intents = [];
    const op = {
        id: 'op', name: 'op', room, pos: pos(20, 20), ticksToLive: 4000, hits: 3000, hitsMax: 3000,
        memory: { priority: 'baseOp', homeRoom: 'A', initialSetup: true, spawnList: [], towerList: [] },
        store: storeOf({ ops: 300, energy: 0 }, 2000),
        powers: { PWR_GENERATE_OPS: { cooldown: 0, level: 5 }, PWR_OPERATE_EXTENSION: { cooldown: 0, level: 5 }, PWR_OPERATE_TOWER: { cooldown: 0, level: 3 } },
    };
    for (const method of ['usePower', 'transfer', 'withdraw', 'travelTo', 'move', 'say', 'renew', 'enableRoom', 'cancelOrder']) {
        op[method] = (...args) => { intents.push([method, ...args.map(a => a && a.id || a)]); return op.results && op.results[method] !== undefined ? op.results[method] : g.OK; };
    }
    return { h, g, room, op, pos, structures, hostiles, objects, intents, lookups: () => lookups,
        baseOp: h.load('creep.baseOp') };
}

test('only one power per tick: ops generation waits when a job power was used', () => {
    const { g, room, op, intents, baseOp } = setup();
    room.energyAvailable = 5000; // extensions need refilling: OPERATE_EXTENSION job
    baseOp.run(op);
    const powers = intents.filter(i => i[0] === 'usePower').map(i => i[1]);
    assert.deepEqual(powers, ['PWR_OPERATE_EXTENSION'], 'GENERATE_OPS skipped this tick');

    intents.length = 0;
    room.energyAvailable = 12900;
    op.powers.PWR_OPERATE_EXTENSION.cooldown = 40;
    op.memory.nextJobCheck = 0;
    baseOp.run(op);
    assert.ok(intents.some(i => i[0] === 'usePower' && i[1] === 'PWR_GENERATE_OPS'), 'idle tick generates ops');
    assert.ok(g.Game.time >= 0);
});

test('tower boost comes first under attack, and later job checks are not evaluated', () => {
    const { g, room, op, objects, intents, baseOp, lookups } = setup();
    g.Memory.roomsUnderAttack = ['A'];
    objects.t1 = { id: 't1', pos: op.pos };
    op.memory.towerList = ['t1'];
    room.energyAvailable = 5000; // extension job also available, but defence wins
    const before = lookups();
    baseOp.run(op);
    assert.equal(intents.find(i => i[0] === 'usePower')[1], 'PWR_OPERATE_TOWER');
    assert.ok(lookups() - before <= 3, 'stopped at the first matching job');
});

test('spawn filling only runs when spawns (not extensions) need energy', () => {
    const { g, room, op, structures, intents, baseOp } = setup();
    op.powers.PWR_OPERATE_EXTENSION.cooldown = 30;
    room.energyAvailable = 10000; // extensions short, spawns full
    const spawn = { id: 's1', structureType: g.STRUCTURE_SPAWN, pos: op.pos, store: storeOf({ energy: 300 }, 300) };
    structures.push(spawn);
    baseOp.run(op);
    assert.notEqual(op.memory.jobFocus, 'FILL_SPAWNS', 'old version hauled energy for full spawns forever');

    spawn.store = storeOf({ energy: 100 }, 300);
    op.memory.nextJobCheck = 0;
    op.memory.jobFocus = undefined;
    intents.length = 0;
    baseOp.run(op);
    assert.equal(op.memory.jobFocus, 'FILL_SPAWNS');
    assert.ok(intents.some(i => i[0] === 'withdraw' && i[1] === 'storage'), 'fetches energy for the spawn');
});

test('finishing a fill does not issue a second transfer in the same tick', () => {
    const { g, op, structures, intents, baseOp } = setup();
    op.powers.PWR_OPERATE_EXTENSION.cooldown = 30;
    op.store = storeOf({ ops: 300, energy: 400 }, 2000);
    structures.push({ id: 's1', structureType: g.STRUCTURE_SPAWN, pos: op.pos, store: storeOf({ energy: 100 }, 300) });
    structures.push({ id: 's2', structureType: g.STRUCTURE_SPAWN, pos: op.pos, store: storeOf({ energy: 250 }, 300) });
    op.memory.jobFocus = 'FILL_SPAWNS';
    baseOp.run(op);
    assert.equal(intents.filter(i => i[0] === 'transfer').length, 1);
});

test('busywork does not ping-pong energy with a low storage when the terminal is empty', () => {
    const { op, room, intents, baseOp } = setup();
    op.powers.PWR_OPERATE_EXTENSION.cooldown = 30;
    room.storage.store = storeOf({ energy: 20000 }, 1000000);
    room.terminal = { id: 'terminal', pos: op.pos, store: storeOf({ energy: 0 }, 300000) };
    op.store = storeOf({ ops: 300, energy: 1394 }, 2000); // already carrying a full load
    baseOp.run(op);
    assert.equal(intents.filter(i => i[0] === 'transfer').length, 0, 'no transfer back into storage');
    assert.ok(op.memory.busyIdleUntil > 0, 'rests instead of rescanning every tick');
});

test('under fire the operator holds a rampart, moves to a safe one, or flees', () => {
    const { g, h, op, pos, structures, hostiles, intents, baseOp } = setup();
    g.Memory.roomsUnderAttack = ['A'];
    g.PathFinder = { search: () => ({ path: [pos(19, 20)] }) };
    hostiles.push({ id: 'foe', name: 'foe', owner: { username: 'enemy' }, pos: pos(22, 20), hits: 1000, hitsMax: 1000,
        body: [{ type: g.RANGED_ATTACK, hits: 100 }, { type: g.MOVE, hits: 100 }] });
    op.powers.PWR_OPERATE_EXTENSION.cooldown = 30;
    op.powers.PWR_OPERATE_TOWER.cooldown = 30;

    // No ramparts at all: flee.
    baseOp.run(op);
    assert.ok(intents.some(i => i[0] === 'move'), 'flees from the ranged attacker');

    // Standing on a rampart: stay (hits land on the rampart).
    const onRampart = setup();
    onRampart.g.Memory.roomsUnderAttack = ['A'];
    onRampart.g.STRUCTURE_RAMPART = 'rampart';
    onRampart.hostiles.push(Object.assign({}, hostiles[0], { pos: onRampart.pos(22, 20) }));
    onRampart.structures.push({ id: 'r', structureType: 'rampart', my: true, pos: onRampart.pos(20, 20) });
    onRampart.op.powers.PWR_OPERATE_EXTENSION.cooldown = 30;
    onRampart.op.powers.PWR_OPERATE_TOWER.cooldown = 30;
    onRampart.baseOp.run(onRampart.op);
    assert.deepEqual(plain(onRampart.intents.filter(i => i[0] === 'cancelOrder')), [['cancelOrder', 'move']]);
    assert.ok(h);
});

test('room staffing ignores a leftover RoomOperator flag when no operator is present', () => {
    const { h, g, op, room } = setup();
    const spawns = h.load('spawn.BuildCreeps5');
    g.Game.flags.ARoomOperator = { name: 'ARoomOperator' };
    const config = () => ({ muleMax: 0, upgraderMax: 0, repairMax: 0, upSupplierMax: 0, supplierMax: 0, distributorMax: 0 });

    let c = config();
    spawns.configureLevel8Room(c, 'A', room.storage);
    assert.equal(c.distributorMax, 1, 'operator dead/absent: normal staffing');
    assert.equal(c.muleMax, 1);

    g.Game.powerCreeps = { op };
    g.Game.time++; // presence is cached per tick
    c = config();
    spawns.configureLevel8Room(c, 'A', room.storage);
    assert.equal(c.distributorMax, 0, 'operator present (level 5 extensions): no distributor');
    assert.equal(c.muleMax, 0);
});
