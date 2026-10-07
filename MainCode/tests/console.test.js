const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

function setup() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    g.CONTROLLER_STRUCTURES = { spawn: { 8: 3 }, extension: { 8: 60 }, tower: { 8: 6 }, storage: { 8: 1 }, terminal: { 8: 1 } };
    for (const [k, v] of Object.entries({ STRUCTURE_SPAWN: 'spawn', STRUCTURE_EXTENSION: 'extension', STRUCTURE_TOWER: 'tower',
        STRUCTURE_STORAGE: 'storage', STRUCTURE_TERMINAL: 'terminal', STRUCTURE_RAMPART: 'rampart' })) g[k] = v;
    const lines = [];
    g.console = { log: text => lines.push(String(text)) };
    h.load('runtime.console');
    return { h, g, lines, out: () => lines.join('\n') };
}

const store = (energy, used, free) => ({ energy, getUsedCapacity: () => used, getFreeCapacity: () => free });

test('mem(): key sizes, one path in full, long output split into console-sized lines', () => {
    const { g, lines, out } = setup();
    g.Memory.basePlan = { E14N18: { v: 1, s: { extension: 'x'.repeat(3000) } } };
    g.mem();
    assert.match(out(), /basePlan: \d+/);
    lines.length = 0;
    g.mem('basePlan.E14N18');
    assert.ok(lines.length >= 3, 'split');
    assert.ok(lines.every(l => l.length <= 1000));
    assert.ok(out().includes('"v": 1'));
    assert.equal(g.mem('nope.missing'), 'Memory.nope.missing is undefined');
});

test('roomReport(): live state, maintenance blockers, Memory mentions, creeps and flags', () => {
    const { g, out } = setup();
    const spawn = { structureType: 'spawn', name: 'Spawn20', pos: { x: 30, y: 10 }, isActive: () => true, spawning: null };
    const ramparts = [{ structureType: 'rampart', hits: 1000 }, { structureType: 'rampart', hits: 30000000 }];
    const sites = [{ structureType: 'extension' }, { structureType: 'extension' }, { structureType: 'tower' }];
    const finds = {
        [g.FIND_MY_STRUCTURES]: [spawn, ...ramparts], [g.FIND_MY_CONSTRUCTION_SITES]: sites,
        [g.FIND_HOSTILE_CREEPS]: [], [g.FIND_MY_CREEPS]: [{ memory: { priority: 'supplier' } }], [g.FIND_NUKES]: [],
    };
    g.Game.rooms.E14N18 = { name: 'E14N18', energyAvailable: 300, energyCapacityAvailable: 12900,
        controller: { my: true, level: 8, progress: 0, progressTotal: 0, ticksToDowngrade: 190000 },
        storage: { store: store(120000, 500000, 500000) },
        find: (type, opts) => {
            const list = finds[type] || [];
            const f = opts && opts.filter;
            return f && f.structureType ? list.filter(s => s.structureType === f.structureType) : list;
        } };
    g.Memory.roomMode = { E14N18: { m: 0, e: 0, t: 5 } };
    g.Memory.energyNeedRooms = ['W1N1', 'E14N18'];
    g.Memory.creepInQue = ['E14N18', 'mule', '', 'Spawn20'];
    g.Memory.creeps.sup = { priority: 'supplier', homeRoom: 'E14N18' };
    g.Game.flags.E14N18Supply = { pos: { roomName: 'E14N18', x: 29, y: 11 } };

    g.roomReport('E14N18');
    const text = out();
    for (const expected of ['"level": 8', 'Spawn20 @30,10', '3 construction sites', 'extension 0/60 built', 'tower 0/6 built',
        '1/2 ramparts under 25000000 hits (lowest 1000)', 'storage energy 120000 (needs 300000)',
        '"roomMode"', 'listed at index 1 of 2', '"mule"', 'sup: supplier', 'E14N18Supply @E14N18 29,11']) {
        assert.ok(text.includes(expected), 'missing: ' + expected + '\n' + text);
    }
});
