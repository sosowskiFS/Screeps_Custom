const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { harness, plain } = require('./harness');
function legacy(h, name) {
    const module = { exports: {} };
    const source = fs.readFileSync(path.join(__dirname, 'fixtures', name + '.js.txt'), 'utf8');
    vm.runInContext('(function(require,module){' + source + '\n})', h.context)(h.load, module);
    return module.exports;
}

test('all role aliases match legacy dispatch across bucket, war, RCL, HEAL and spawning states', () => {
    function setup(old) {
        const calls = [];
        const overrides = new Proxy({}, {
            getOwnPropertyDescriptor: (_, id) => id.startsWith('creep.') && id !== 'creep.registry' ? { configurable: true, enumerable: true } : undefined,
            get: (_, id) => ({ run(creep, arg) { calls.push([id, arg]); } }),
        });
        const h = harness(overrides);
        const run = old ? legacy(h, 'legacy-dispatch').handleCreepOperations : h.load('system.creeps').handleCreepOperations;
        return { ...h, calls, run };
    }
    const before = setup(true), after = setup(false);
    const roleNames = Object.keys(after.load('creep.registry').roles).concat(['mule', 'builder', 'harvester', 'distributor', 'mineralMiner', 'unknown', undefined]);
    let scenarios = 0;
    for (const role of roleNames) for (const bucket of [400, 749, 750, 999, 1000, 9000])
    for (const time of [1, 2]) for (const war of [false, true]) for (const at5 of [false, true])
    for (const heal of [0, 1]) for (const spawning of [false, true]) {
        const results = [];
        for (const h of [before, after]) {
            h.calls.length = 0;
            h.context.Game.time = time;
            h.context.Game.cpu.bucket = bucket;
            h.context.Memory = { RoomsAt5: at5 ? ['A'] : [], warMode: war };
            const creep = { memory: { priority: role }, room: { name: 'A' }, spawning,
                getActiveBodyparts: () => heal, say: (...args) => h.calls.push(['say', ...args]) };
            h.context.Game.creeps = { unit: creep };
            h.run();
            results.push(plain({ calls: h.calls, memory: creep.memory }));
        }
        assert.deepEqual(results[1], results[0], JSON.stringify({ role, bucket, time, war, at5, heal, spawning }));
        scenarios++;
    }
    console.log(`Compared ${scenarios} legacy dispatch scenarios.`);
});

test('industry link priorities and lab recipes produce legacy intents', () => {
    function run(old, controllerEnergy, storageEnergy, recipe) {
        const h = harness(), g = h.context, calls = [];
        h.load('runtime.memory').ensureInitialized();
        const energy = g.RESOURCE_ENERGY;
        const objects = {};
        const room = { name: 'A', storage: { store: { [energy]: 300000 } } };
        const positions = { getRangeTo: () => 1 };
        for (const [id, amount] of [['s1', 800], ['c', controllerEnergy], ['s2', 600], ['store', storageEnergy]]) {
            objects[id] = { id, energy: amount, cooldown: 0, transferEnergy: target => { calls.push(['link', id, target.id]); return 0; } };
        }
        g.LAB_REACTION_AMOUNT = 5;
        for (const id of ['l1', 'l2', 'l3', 'l4', 'l5', 'l6']) objects[id] = { id, pos: positions, cooldown: 0,
            mineralType: recipe === 'OH' ? (id === 'l4' ? g.RESOURCE_HYDROGEN : g.RESOURCE_OXYGEN) : g.RESOURCE_CATALYST,
            store: { [g.RESOURCE_HYDROGEN]: 100, [g.RESOURCE_OXYGEN]: 100, [g.RESOURCE_CATALYST]: 100 },
            mineralAmount: 100, mineralCapacity: 3000,
            runReaction: (a, b) => { calls.push(['reaction', id, a.id, b.id]); return 0; } };
        g.Memory.linkList.A = ['s1', 'c', 's2', 'store'];
        g.Memory.labList.A = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'];
        g.Game.getObjectById = id => objects[id];
        if (recipe) g.Game.flags['A' + recipe + (recipe === 'OH' ? 'Producer(3)' : 'Producer')] = {};
        const industry = old ? legacy(h, 'legacy-industry') : h.load('system.industry');
        industry.manageLinkOperations(room);
        industry.manageLabOperations(room);
        return calls;
    }
    assert.ok(run(false, 0, 0, 'OH').some(call => call[0] === 'reaction'));
    for (const c of [0, 399, 400, 800]) for (const s of [0, 400, 800]) for (const recipe of ['', 'OH', 'XGH2O']) {
        assert.deepEqual(run(false, c, s, recipe), run(true, c, s, recipe));
    }
});

test('extension road grid preserves legacy tile order, obstructions and site-cap exit', () => {
    for (const cap of [0, 2, 100]) {
        const { context: g, load } = harness();
        const structs = [[10, 10], [10, 12], [12, 10], [12, 12], [1, 1], [1, 3]].map(([x, y]) => ({ structureType: g.STRUCTURE_EXTENSION, pos: { x, y } }));
        structs.push({ structureType: g.STRUCTURE_ROAD, pos: { x: 11, y: 11 } });
        const sites = [{ pos: { x: 11, y: 10 } }];
        const walls = new Set(['10,11']);
        const expected = [];
        outer: for (let x = 1; x <= 48; x++) for (let y = 1; y <= 48; y++) {
            if (walls.has(`${x},${y}`) || structs.concat(sites).some(s => s.pos.x === x && s.pos.y === y)) continue;
            const count = structs.filter(s => s.structureType === g.STRUCTURE_EXTENSION && Math.max(Math.abs(s.pos.x - x), Math.abs(s.pos.y - y)) === 1).length;
            if (count >= 2) { expected.push([x, y]); if (expected.length > cap) break outer; }
        }
        const calls = [];
        let terrainReads = 0;
        const room = { name: 'A', find: type => type === g.FIND_STRUCTURES ? structs : sites,
            createConstructionSite: (x, y) => { calls.push([x, y]); return calls.length > cap ? g.ERR_FULL : g.OK; } };
        g.Game.map.getRoomTerrain = () => { terrainReads++; return { get: (x, y) => walls.has(`${x},${y}`) ? g.TERRAIN_MASK_WALL : 0 }; };
        load('system.construction').buildExtensionRoads(room);
        assert.deepEqual(calls, expected);
        assert.equal(terrainReads, 1);
    }
});

test('Traveler reuses topology but invalidates structures, rampart access and sites', () => {
    const { context: g, load } = harness();
    let allocations = 0;
    class Matrix {
        constructor() { allocations++; this.values = new Map(); }
        set(x, y, cost) { this.values.set(x * 50 + y, cost); }
        get(x, y) { return this.values.get(x * 50 + y) || 0; }
        clone() { const clone = new Matrix(); clone.values = new Map(this.values); return clone; }
    }
    g.PathFinder = { CostMatrix: Matrix };
    const road = Object.assign(new g.StructureRoad(), { structureType: g.STRUCTURE_ROAD, pos: { x: 10, y: 10 } });
    const rampart = Object.assign(new g.StructureRampart(), { structureType: g.STRUCTURE_RAMPART, pos: { x: 11, y: 10 }, my: false, isPublic: false });
    let structures = [road, rampart], sites = [], creeps = [];
    const room = { name: 'A', find: type => type === g.FIND_STRUCTURES ? structures : type === g.FIND_CREEPS ? creeps : sites };
    const Traveler = load('traveler').Traveler;
    const first = Traveler.getStructureMatrix(room);
    assert.equal(first.get(10, 10), 1); assert.equal(first.get(11, 10), 255);
    for (let i = 0; i < 10; i++) { g.Game.time++; assert.equal(Traveler.getStructureMatrix(room), first); }
    assert.equal(allocations, 1);
    g.Game.time++; rampart.isPublic = true;
    const opened = Traveler.getStructureMatrix(room);
    assert.notEqual(opened, first); assert.equal(opened.get(11, 10), 0);
    g.Game.time++; sites = [{ structureType: g.STRUCTURE_SPAWN, pos: { x: 20, y: 20 } }];
    assert.equal(Traveler.getStructureMatrix(room).get(20, 20), 255);
    g.Game.time++; structures = [rampart]; sites = [];
    const removed = Traveler.getStructureMatrix(room);
    assert.equal(removed.get(10, 10), 0); assert.equal(removed.get(20, 20), 0);
    creeps = [{ pos: { x: 15, y: 15 } }];
    const withCreeps = Traveler.getCreepMatrix(room);
    assert.equal(withCreeps.get(15, 15), 255); assert.equal(removed.get(15, 15), 0);
    g.Game.time++; creeps = [];
    assert.equal(Traveler.getCreepMatrix(room).get(15, 15), 0);
});


test('extracted mature-room roles preserve legacy actions and memory transitions', () => {
    function run(old, role, carried, stored, nearDeath, outOfRange, returnToLabs) {
        const h = harness(), g = h.context, calls = [];
        h.load('runtime.memory').ensureInitialized();
        const energy = g.RESOURCE_ENERGY;
        const position = { x: 25, y: 25, roomName: 'A', lookFor: () => [], findInRange: () => [],
            findClosestByPath: () => null, findClosestByRange: () => null, getRangeTo: () => 2 };
        const storage = { id: 'storage', store: { [energy]: stored, getFreeCapacity: () => 10000 }, pos: position };
        const mineral = { id: 'mineral', mineralAmount: stored, pos: position };
        g.Game.getObjectById = id => ({ storage, mineral })[id];
        const room = { name: 'A', storage, controller: { level: 8 }, energyAvailable: 300, energyCapacityAvailable: 500,
            find: () => [], createConstructionSite: (...args) => calls.push(['site', ...args]) };
        g.Game.rooms.A = room;
        g.Memory.linkList.A = [];
        const creep = { id: 'unit', room, pos: position, ticksToLive: nearDeath ? 10 : 1000, body: [],
            memory: { priority: role, deathWarn: 50, mineralID: 'mineral', nextMine: 0, onPoint: true,
                previousPriority: returnToLabs ? 'labWorker' : undefined, hasDistributed: returnToLabs },
            carry: { [energy]: carried, energy: carried }, carryCapacity: 100,
            store: { getFreeCapacity: () => 100 - carried }, getActiveBodyparts: () => 1 };
        // In-game energy constant is 'energy'; use both keys without double-counting.
        delete creep.carry[energy]; creep.carry.energy = carried; g.RESOURCE_ENERGY = 'energy'; storage.store.energy = stored;
        for (const method of ['withdraw', 'transfer', 'harvest', 'pickup', 'upgradeController', 'suicide', 'say', 'move', 'travelTo']) {
            creep[method] = (...args) => { calls.push([method, ...args.map(a => a && a.id || a)]); return outOfRange ? g.ERR_NOT_IN_RANGE : g.OK; };
        }
        (old ? legacy(h, 'legacy-work5') : h.load('creep.work5')).run(creep);
        return plain({ calls, memory: creep.memory });
    }
    let scenarios = 0;
    for (const role of ['mule', 'muleNearDeath', 'distributor', 'distributorNearDeath', 'mineralMiner', 'mineralMinerNearDeath'])
    for (const carried of [0, 10, 100]) for (const stored of [0, 49, 50, 599, 600, 1000])
    for (const nearDeath of [false, true]) for (const outOfRange of [false, true]) for (const returnToLabs of [false, true]) {
        assert.deepEqual(run(false, role, carried, stored, nearDeath, outOfRange, returnToLabs), run(true, role, carried, stored, nearDeath, outOfRange, returnToLabs),
            JSON.stringify({ role, carried, stored, nearDeath, outOfRange, returnToLabs }));
        scenarios++;
    }
    console.log(`Compared ${scenarios} legacy logistics scenarios.`);
});
