const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

// The collapsed room from the field report (E14N18): RCL8, 354k in storage, extensions nearly
// empty (1369/12900), only an emergency distributor and a storage miner left, 6 towers.
function collapsed({ creeps = ['distributor', 'miner'], energy = 1369 } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    g.HARVEST_POWER = 2;
    g.BODYPART_COST = { move: 50, carry: 50, work: 100, attack: 80, ranged_attack: 150, heal: 250, claim: 600, tough: 10 };
    const towers = Array.from({ length: 6 }, (_, i) => ({ id: 't' + i, structureType: g.STRUCTURE_TOWER, my: true }));
    const spawn = { id: 'Spawn16', name: 'Spawn16', structureType: g.STRUCTURE_SPAWN, my: true, spawning: null, isActive: () => true,
        pos: { x: 45, y: 4, isNearTo: () => false, getDirectionTo: () => g.TOP } };
    const room = { name: 'E14N18', energyAvailable: energy, energyCapacityAvailable: 12900,
        controller: { my: true, level: 8, ticksToDowngrade: 181689 },
        storage: { id: 'storage', store: { energy: 354385 } },
        find: (type, opts) => {
            let list = [];
            if (type === g.FIND_MY_STRUCTURES || type === g.FIND_STRUCTURES) list = [...towers, spawn];
            if (type === g.FIND_SOURCES) list = [{ id: 'src1' }, { id: 'src2' }];
            const f = opts && opts.filter;
            return f && f.structureType ? list.filter(s => s.structureType === f.structureType) : list;
        } };
    g.Game.rooms.E14N18 = room;
    spawn.room = room;
    g.Game.spawns.Spawn16 = spawn;
    const roomCreeps = creeps.map((role, n) => {
        const creep = { name: role + n, memory: { priority: role, homeRoom: 'E14N18', jobSpecific: role === 'miner' ? 'storageMiner' : undefined } };
        g.Game.creeps[creep.name] = creep;
        return creep;
    });
    g.Memory.RoomsAt5 = ['E14N18'];
    g.Memory.sourceList.E14N18 = ['src1', 'src2'];
    g.Memory.linkList.E14N18 = ['l0', 'l1', 'l2', 'l3'];
    g.Memory.CurrentRoomEnergy = ['E14N18', energy];
    const orders = [];
    spawn.spawnCreep = (body, name, opts) => { orders.push({ body: plain(body), role: opts.memory.priority }); return g.OK; };
    return { h, g, room, spawn, roomCreeps, orders };
}

const cost = (g, body) => body.reduce((sum, part) => sum + g.BODYPART_COST[part], 0);

test('essentials: refill, tower supplier and storage miner', () => {
    const { h, room } = collapsed({ creeps: [] });
    assert.deepEqual(plain(h.load('spawn.essentials').missing(room)), ['refill', 'supplier', 'miner']);
    const ok = collapsed({ creeps: ['distributor', 'supplier', 'miner'] });
    assert.deepEqual(plain(ok.h.load('spawn.essentials').missing(ok.room)), []);
    const short = collapsed();
    assert.deepEqual(plain(short.h.load('spawn.essentials').missing(short.room)), ['supplier']);
});

test('the collapsed room spawns its tower supplier now, sized to the 1369 energy on hand', () => {
    const { h, g, room, spawn, roomCreeps, orders } = collapsed();
    h.load('spawn.state');
    g.isSpawnBusy = () => false;
    h.load('spawn.BuildCreeps5').run(spawn, room, roomCreeps, 1);
    assert.equal(orders.length, 1, JSON.stringify(orders));
    assert.equal(orders[0].role, 'supplier', 'not the 1600-energy mule it used to wait for');
    assert.ok(cost(g, orders[0].body) <= 1369);
});

test('with no refill creep at all, the distributor comes first and fits the energy on hand', () => {
    const { h, g, room, spawn, roomCreeps, orders } = collapsed({ creeps: ['miner', 'supplier'], energy: 900 });
    h.load('spawn.state');
    g.isSpawnBusy = () => false;
    h.load('spawn.BuildCreeps5').run(spawn, room, roomCreeps, 1);
    assert.equal(orders[0].role, 'distributor');
    assert.ok(cost(g, orders[0].body) <= 900 && orders[0].body.length >= 6);
});

test('while essentials are missing: no flag commands, remote creeps, scouts or harassers', () => {
    const calls = [];
    const stub = name => ({ run: (...args) => calls.push([name, args[1]]) });
    const { h, g, room, spawn } = collapsed();
    const h2 = harness({ 'spawn.BuildInstruction': stub('instruction'), 'spawn.BuildFarCreeps': stub('far'),
        'spawn.BuildCreeps5': stub('room'), 'spawn.BuildCreeps': stub('young') });
    // Share the collapsed room's state with the second harness.
    Object.assign(h2.context.Game, g.Game);
    h2.context.Memory = g.Memory;
    h2.context.RESOURCE_ENERGY = 'energy';
    g.Game.flags.E14N18PowerPickup = { pos: { roomName: 'E15N18' } };
    h2.context.Game.flags = g.Game.flags;
    h2.context.Game.creeps = g.Game.creeps;
    const spawning = h2.load('system.spawning');
    spawning.processSpawnCommands(spawn, room, 1, null);
    assert.deepEqual(calls.map(c => c[0]), ['room'], 'only the room staffing ran');

    // Observer: a reserved neighbour does not pull a harasser out of a collapsing room.
    calls.length = 0;
    const observed = { name: 'E15N18', controller: { reservation: { username: 'rival' } }, find: () => [] };
    h2.context.Memory.whiteList = [];
    h2.load('system.observers').handleHarasserOperations(room, observed, 'E14N18', 'E15N18');
    assert.deepEqual(calls, []);
});
