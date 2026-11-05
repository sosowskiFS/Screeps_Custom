const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

function lab(id, x, y, store = {}) {
    const mineral = Object.keys(store).find(r => r !== 'energy' && store[r] > 0);
    return { id, pos: { x, y }, store: Object.assign({ energy: 2000 }, store), mineralType: mineral, mineralAmount: mineral ? store[mineral] : 0,
        energy: 2000, mineralCapacity: 3000, cooldown: 0 };
}

function setup(labs, { creeps = [], level = 7, job = { p: 'RESOURCE_HYDROXIDE', a: 'RESOURCE_HYDROGEN', b: 'RESOURCE_OXYGEN' }, terminal = {} } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.CREEP_LIFE_TIME = 1500;
    const byId = Object.fromEntries(labs.map(l => [l.id, l]));
    const room = { name: 'R', controller: { my: true, level }, terminal: { id: 'terminal', store: terminal }, storage: { id: 'storage', store: {} },
        find: type => (type === g.FIND_MY_CREEPS ? creeps : []) };
    g.Game.rooms.R = room;
    g.Game.getObjectById = id => byId[id] || null;
    g.Memory.labList.R = labs.map(l => l.id);
    g.Memory.labJobs = job ? { R: job } : {};
    return { h, g, room, layout: h.load('system.labLayout') };
}

test('arrange: the reagent pair that reaches the most labs; labs out of reach hold the boosts', () => {
    // E18N22-like: two clusters; find order put the reagents in different clusters.
    const labs = [lab('a', 4, 35), lab('b', 6, 31), lab('c', 4, 30), lab('d', 5, 28), lab('e', 8, 40),
        lab('f', 2, 38), lab('g', 9, 38), lab('h', 10, 38), lab('i', 7, 40), lab('j', 10, 40)];
    const { layout } = setup(labs);
    const order = layout.arrange(labs, false).map(l => l.id);
    const at = Object.fromEntries(labs.map(l => [l.id, l.pos]));
    const near = (p, q) => Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)) <= 2;
    const reached = order.slice(5).filter(id => near(at[id], at[order[3]]) && near(at[id], at[order[4]]));
    assert.equal(reached.length, 3, 'three outputs in reach (none with the old pair): ' + order);
    assert.deepEqual(order.slice(5, 8).sort(), reached.sort(), 'outputs in reach first');
    for (const id of order.slice(0, 3)) assert.ok(!(near(at[id], at[order[3]]) && near(at[id], at[order[4]])), 'boost lab out of reach: ' + id);
    assert.equal(new Set(order).size, 10);
});

test('arrange keeps a planned stamp pair when no pair reaches more', () => {
    const stamp = [[10, 10], [11, 10], [12, 10], [10, 11], [12, 11], [10, 12], [11, 12]];
    const labs = [lab('b1', 30, 30), lab('b2', 31, 30), lab('b3', 32, 30), ...stamp.map(([x, y], n) => lab('s' + n, x, y))];
    const { layout } = setup(labs);
    assert.deepEqual(plain(layout.arrange(labs, true).map(l => l.id)), labs.map(l => l.id));
});

// A 10-lab block every lab of which is within 2 of the reagents (labs 3 and 4 at the centre).
function block(stores = {}) {
    const tiles = [[10, 10], [11, 10], [12, 10], [11, 11], [11, 12], [10, 11], [12, 11], [10, 12], [12, 12], [13, 11]];
    return tiles.map(([x, y], n) => lab('L' + n, x, y, stores['L' + n] || {}));
}

test('a boost lab in reach reacts while nobody wants its boost, and switches back for an upgrader', () => {
    const labs = block();
    const upgrader = { memory: { priority: 'upgrader' } };
    const { g, room, layout } = setup(labs, { creeps: [], terminal: { RESOURCE_CATALYZED_GHODIUM_ACID: 3000 } });
    assert.deepEqual([...layout.flexIndices('R')], [0, 1, 2]);
    assert.deepEqual([...layout.reacting('R')].sort(), [0, 1, 2], 'no defenders, repairers or upgraders wanting boosts');
    assert.equal(layout.reactionLabs('R').length, 8, '5 outputs and 3 boost labs');
    // An upgrader is spawning: the XGH2O lab (index 1) goes back to boosting, the others react on.
    room.find = type => (type === g.FIND_MY_CREEPS ? [upgrader] : []);
    g.Game.time++;
    assert.deepEqual([...layout.reacting('R')].sort(), [0, 2]);
    assert.equal(layout.boostPending(room, g.RESOURCE_CATALYZED_GHODIUM_ACID, 450), true, 'not loaded yet');
    // Boosted: it stays a boost lab FLEX_HOLD ticks, then reacts again.
    upgrader.memory.hasBoosted = true;
    g.Game.time++;
    assert.deepEqual([...layout.reacting('R')].sort(), [0, 2], 'held');
    g.Game.time += layout.FLEX_HOLD;
    assert.deepEqual([...layout.reacting('R')].sort(), [0, 1, 2]);
    // Without XGH2O in the room the upgrader cannot be boosted: the lab is not flushed for it.
    upgrader.memory.hasBoosted = false;
    room.terminal.store = {};
    g.Game.time++;
    assert.deepEqual([...layout.reacting('R')].sort(), [0, 1, 2]);
    // War staging: every boost lab holds boosts.
    g.Game.flags.RWarBoosts = {};
    g.Game.time++;
    assert.deepEqual([...layout.reacting('R')], []);
});

test('reactions run in every lab in reach, flex boost labs included; leased labs and labs out of reach do not', () => {
    const labs = block({ L3: { RESOURCE_HYDROGEN: 1000 }, L4: { RESOURCE_OXYGEN: 1000 } });
    labs.push(lab('far', 40, 40));
    const { h, g } = setup(labs);
    const calls = [];
    for (const l of labs) l.runReaction = () => { calls.push(l.id); return 0; };
    h.load('system.industry').manageLabOperations(g.Game.rooms.R);
    assert.deepEqual(plain(calls).sort(), ['L0', 'L1', 'L2', 'L5', 'L6', 'L7', 'L8', 'L9']);
});

test('lab worker: a reacting boost lab is emptied like an output; a switched one gets one trip of its boost', () => {
    const labs = block({ L0: { RESOURCE_HYDROXIDE: 1200 }, L3: { RESOURCE_HYDROGEN: 2500 }, L4: { RESOURCE_OXYGEN: 2500 } });
    const { h, g, room } = setup(labs, { terminal: { RESOURCE_CATALYZED_GHODIUM_ACID: 3000, RESOURCE_HYDROGEN: 0, RESOURCE_OXYGEN: 0 } });
    g.Memory.mineralList.R = [];
    const store = s => Object.assign(s, { getFreeCapacity: () => 100000, getUsedCapacity: () => 0 });
    store(room.terminal.store); store(room.storage.store);
    const calls = [];
    const creep = { name: 'lw', room, ticksToLive: 1000, carryCapacity: 1000, memory: { priority: 'labWorker', deathWarn: 0 },
        carry: {}, store: {}, pos: { x: 11, y: 11, findInRange: () => [], lookFor: () => [], isNearTo: () => true, inRangeTo: () => true },
        withdraw: (t, r, n) => { calls.push(['withdraw', t.id, r, n]); return 0; },
        transfer: (t, r) => { calls.push(['transfer', t.id, r]); return 0; },
        travelTo: () => {}, say: () => {}, move: () => {}, drop: () => {} };
    const worker = h.load('creep.labWorker');
    worker.run(creep);
    assert.deepEqual(plain(calls)[0], ['withdraw', 'L0', 'RESOURCE_HYDROXIDE', null], 'the product out of boost lab 1');

    // An upgrader wants XGH2O: lab index 1 (empty) is loaded with FLEX_FILL, not a full lab.
    room.find = type => (type === g.FIND_MY_CREEPS ? [{ memory: { priority: 'upgrader' } }] : []);
    labs[0].store = { energy: 2000 }; labs[0].mineralType = undefined; labs[0].mineralAmount = 0;
    calls.length = 0;
    creep.memory = { priority: 'labWorker', deathWarn: 0 };
    g.Game.time++;
    worker.run(creep);
    const load = plain(calls).find(c => c[0] === 'withdraw');
    assert.deepEqual(load, ['withdraw', 'terminal', 'RESOURCE_CATALYZED_GHODIUM_ACID', 1000]);
});

test('lab worker tops its load up from the other outputs before the terminal trip', () => {
    const labs = block({ L3: { RESOURCE_HYDROGEN: 2500 }, L4: { RESOURCE_OXYGEN: 2500 }, L6: { RESOURCE_HYDROXIDE: 300 }, L7: { RESOURCE_HYDROXIDE: 250 } });
    // Boost labs hold their boosts (wanted: war staging keeps them out of reactions).
    const { h, g, room } = setup(labs);
    g.Memory.mineralList.R = [];
    const store = s => Object.assign(s, { getFreeCapacity: () => 100000, getUsedCapacity: () => 0 });
    store(room.terminal.store); store(room.storage.store);
    const calls = [];
    const creep = { name: 'lw', room, ticksToLive: 1000, carryCapacity: 1000, memory: { priority: 'labWorker', deathWarn: 0 },
        carry: { RESOURCE_HYDROXIDE: 400 }, store: { RESOURCE_HYDROXIDE: 400 },
        pos: { x: 11, y: 11, findInRange: () => [], lookFor: () => [], isNearTo: () => true, inRangeTo: () => true },
        withdraw: (t, r) => { calls.push(['withdraw', t.id, r]); return 0; },
        transfer: (t, r) => { calls.push(['transfer', t.id, r]); return 0; },
        travelTo: () => {}, say: () => {}, move: () => {}, drop: () => {} };
    h.load('creep.labWorker').run(creep);
    assert.deepEqual(plain(calls)[0], ['withdraw', 'L6', 'RESOURCE_HYDROXIDE'], 'more of the product, not the terminal yet');
});
