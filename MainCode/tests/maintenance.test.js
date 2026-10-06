const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

// A finished RCL8 room: full structure counts, ramparts at 30M, storage energy configurable.
function setup({ energy = 400000, rampartHits = 30000000, sites = 0, towers = 6 } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy'; g.RESOURCE_POWER = 'power';
    g.CONTROLLER_STRUCTURES = { spawn: { 8: 3 }, extension: { 8: 60 }, tower: { 8: 6 }, storage: { 8: 1 }, terminal: { 8: 1 } };
    g.CONTROLLER_DOWNGRADE = { 8: 200000 };
    g.STRUCTURE_RAMPART = 'rampart';
    const structures = [];
    const add = (type, count, extra = {}) => { for (let i = 0; i < count; i++) structures.push(Object.assign({ structureType: type }, extra)); };
    add('spawn', 3); add('extension', 60); add('tower', towers); add('storage', 1); add('terminal', 1);
    add('rampart', 20, { hits: rampartHits });
    const nukes = [];
    const room = { name: 'A', controller: { my: true, level: 8, ticksToDowngrade: 190000 },
        storage: { id: 'storage', store: { energy, power: 0 } },
        find: type => type === g.FIND_MY_STRUCTURES ? structures : type === g.FIND_MY_CONSTRUCTION_SITES ? new Array(sites).fill({}) : type === g.FIND_NUKES ? nukes : [] };
    g.Game.rooms.A = room;
    return { h, g, room, nukes, maintenance: h.load('system.maintenance') };
}

function tick(g, maintenance, room, ticks = 1) {
    for (let i = 0; i < ticks; i++) {
        g.Game.time++;
        maintenance.update(room);
    }
}

test('a finished, well-protected RCL8 room with a full storage enters maintenance', () => {
    const { g, room, maintenance } = setup();
    tick(g, maintenance, room);
    assert.equal(maintenance.isEstablished('A'), true);
    assert.equal(maintenance.inMaintenance('A'), true);
});

test('unfinished rooms, weak ramparts or low energy stay in normal mode', () => {
    for (const [options, why] of [[{ sites: 1 }, 'construction site'], [{ towers: 5 }, 'missing tower'],
        [{ rampartHits: 10000000 }, 'ramparts below the nuke threshold'], [{ energy: 200000 }, 'not enough energy to enter']]) {
        const { g, room, maintenance } = setup(options);
        tick(g, maintenance, room);
        assert.equal(maintenance.inMaintenance('A'), false, why);
    }
});

test('energy hysteresis: enter at 300k, stay down to 150k, then miners come back', () => {
    const { g, room, maintenance } = setup();
    tick(g, maintenance, room);
    room.storage.store.energy = 200000;
    tick(g, maintenance, room, 100);
    assert.equal(maintenance.inMaintenance('A'), true, 'still above the exit level');
    room.storage.store.energy = 140000;
    tick(g, maintenance, room, 100);
    assert.equal(maintenance.inMaintenance('A'), false);
    room.storage.store.energy = 250000;
    tick(g, maintenance, room, 100);
    assert.equal(maintenance.inMaintenance('A'), false, 'needs 300k to re-enter');
});

test('an attack or an incoming nuke ends maintenance immediately', () => {
    const { g, room, nukes, maintenance } = setup();
    tick(g, maintenance, room);
    g.Memory.roomsUnderAttack = ['A'];
    tick(g, maintenance, room);
    assert.equal(maintenance.inMaintenance('A'), false, 'attack');

    g.Memory.roomsUnderAttack = [];
    tick(g, maintenance, room, 100);
    assert.equal(maintenance.inMaintenance('A'), true);
    nukes.push({ id: 'nuke' });
    g.Game.time = Math.ceil(g.Game.time / 10) * 10 - 1;
    tick(g, maintenance, room);
    assert.equal(maintenance.inMaintenance('A'), false, 'nuke inbound');
});

test('maintenance can be switched off globally or per room', () => {
    const { g, room, maintenance } = setup();
    g.Memory.settings = { maintenanceMode: false };
    tick(g, maintenance, room);
    assert.equal(maintenance.inMaintenance('A'), false);
    g.Memory.settings = {};
    g.Game.flags.ANoMaintenance = {};
    tick(g, maintenance, room, 100);
    assert.equal(maintenance.inMaintenance('A'), false);
});

test('maintenance staffing: no miners or repairers, one hauler, minerals and towers untouched', () => {
    const { h, g, room, maintenance } = setup();
    tick(g, maintenance, room);
    const spawns = h.load('spawn.BuildCreeps5');
    g.Memory.powerSpawnList = { A: [] };
    const limits = { upgraderMax: 1, upgraderConfig: [], upSupplierMax: 1, minerMax: 2, repairMax: 2,
        salvagerMax: 0, muleMax: 1, distributorMax: 1, pNeedDist: false };
    const out = spawns.lowCpuStaffing(room, limits);
    assert.equal(out.minerMax, 0);
    assert.equal(out.repairMax, 0);
    assert.equal(out.muleMax, 1);
    assert.equal(out.distributorMax, 0, 'the mule fills extensions');
    assert.equal(out.upgraderMax, 0, 'downgrade timer is high');
    assert.equal(out.upSupplierMax, 0, 'no power to process');
});

test('RCL8 controller upkeep: a 1-WORK upgrader only when the timer runs low, kept for power otherwise', () => {
    const { h, g, room, maintenance } = setup({ energy: 100000 }); // normal mode
    tick(g, maintenance, room);
    const spawns = h.load('spawn.BuildCreeps5');
    g.Memory.powerSpawnList = { A: ['ps'] };
    room.storage.store.power = 5000;
    room.controller.ticksToDowngrade = 140000;
    const out = spawns.lowCpuStaffing(room, { upgraderMax: 1, upgraderConfig: [], upSupplierMax: 1, minerMax: 2, repairMax: 1,
        salvagerMax: 0, muleMax: 1, distributorMax: 1 });
    assert.equal(out.upgraderMax, 1);
    assert.equal(out.upgraderConfig.filter(p => p === g.WORK).length, 1);
    assert.equal(out.upSupplierMax, 1, 'power to feed');
    assert.equal(out.minerMax, 2, 'normal mode keeps miners');
    assert.equal(maintenance.upkeepDone({ level: 8, ticksToDowngrade: 199500 }), true);

    g.Memory.settings = { gclFocus: true };
    const focused = spawns.lowCpuStaffing(room, { upgraderMax: 1, upgraderConfig: ['big'], upSupplierMax: 1 });
    assert.deepEqual([focused.upgraderMax, focused.upgraderConfig[0]], [1, 'big'], 'gclFocus restores the full upgrader');
});

test('established rooms remote-mine only when energy is short', () => {
    const { g, room, maintenance } = setup();
    tick(g, maintenance, room);
    assert.equal(maintenance.remoteMiningWanted(room), false);
    room.storage.store.energy = 90000;
    assert.equal(maintenance.remoteMiningWanted(room), true);
});
