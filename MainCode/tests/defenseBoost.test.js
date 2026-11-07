const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

const X = 'RESOURCE_CATALYZED_KEANIUM_ALKALIDE';
function store(contents, free = 100000) {
    return Object.assign({}, contents, { getFreeCapacity: () => free });
}
// shardX: W1N9 (RCL7, a terminal, one boost lab, no XKHO2) and E23N31.
function setup({ donorX = 0, asks = [] } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    g.console = { log() {} };
    const sends = [], deals = [];
    const lab = { id: 'lab', structureType: g.STRUCTURE_LAB, store: store({ energy: 0 }, 3000), mineralType: undefined };
    const room = (name, x, labs) => ({ name, controller: { my: true, level: 7 }, energyAvailable: 4400, energyCapacityAvailable: 4400,
        storage: { id: name + 's', store: store({ energy: 5000 }) },
        terminal: { id: name + 't', cooldown: 0, store: store({ energy: 18000, [X]: x }),
            send: (r, n, to) => { sends.push([name, r, n, to]); return g.OK; } },
        find: type => (type === g.FIND_MY_STRUCTURES ? labs : []) });
    g.Game.rooms = { W1N9: room('W1N9', 0, [lab]), E23N31: room('E23N31', donorX, []) };
    g.Game.market.credits = 5000000 + 100000000;
    g.Game.market.deal = (id, n, to) => { deals.push([id, n, to]); return g.OK; };
    g.Game.market.getAllOrders = () => asks;
    g.Game.market.getHistory = () => [{ volume: 5000, avgPrice: 2 }];
    g.Game.market.calcTransactionCost = n => Math.ceil(n * 0.3);
    return { h, g, sends, deals, lab, boost: h.load('system.defenseBoost') };
}

test('a room short of XKHO2 gets it from a room of ours that keeps 3,000 after sending', () => {
    const s = setup({ donorX: 7000 });
    s.boost.supply();
    assert.deepEqual(plain(s.sends), [['E23N31', X, 3000, 'W1N9']]);
    assert.deepEqual(s.deals, []);
});

test('none on the shard to spare: bought at a fair price, never above 1.2x the market average', () => {
    const asks = [{ id: 'dear', type: 'sell', resourceType: X, price: 2.6, amount: 5000, roomName: 'E1N1' },
        { id: 'fair', type: 'sell', resourceType: X, price: 2.1, amount: 5000, roomName: 'E1N1' }];
    const s = setup({ donorX: 3000, asks });   // E23N31 keeps its 3,000: nothing to spare
    s.boost.supply();
    assert.deepEqual(plain(s.sends), []);
    assert.deepEqual(plain(s.deals), [['fair', 3000, 'W1N9']]);
});

test('a distributor loads the boost lab from the terminal: XKHO2 first, then its energy', () => {
    const s = setup();
    const room = s.g.Game.rooms.W1N9;
    room.terminal.store[X] = 3000;
    const calls = [];
    const creep = { room, memory: { homeRoom: 'W1N9' }, store: store({}, 500),
        withdraw: (t, r, n) => { calls.push(['withdraw', t.id, r, n]); return s.g.OK; },
        transfer: (t, r) => { calls.push(['transfer', t.id, r]); return s.g.OK; }, travelTo() {} };
    assert.equal(s.boost.loadLab(creep), true);
    assert.deepEqual(plain(calls[0]), ['withdraw', 'W1N9t', X, 500]);
    creep.store = store({ [X]: 500 }, 0);
    s.boost.loadLab(creep);
    assert.deepEqual(plain(calls[1]), ['transfer', 'lab', X]);
    // Stocked: its energy next.
    s.lab.store[X] = 1500; s.lab.mineralType = X;
    creep.store = store({}, 500);
    delete creep.memory.boostLoad;
    s.boost.loadLab(creep);
    assert.deepEqual(plain(calls[2]).slice(0, 3), ['withdraw', 'W1N9t', 'energy']);
});

const KO = 'RESOURCE_KEANIUM_OXIDE', KHO2 = 'RESOURCE_KEANIUM_ALKALIDE';
test('no XKHO2 on hand: the best tier the room has (KHO2, else KO); the boost lab loads it', () => {
    const s = setup();
    const room = s.g.Game.rooms.W1N9;
    const tiers = s.h.load('defense.rangedBoost');
    assert.equal(tiers.forRoom(room), X, 'nothing at all: XKHO2, what is made and bought');
    room.terminal.store[KO] = 2000;
    s.g.Game.time++;
    assert.equal(tiers.forRoom(room), KO);
    room.terminal.store[KHO2] = 400;
    s.g.Game.time++;
    assert.equal(tiers.forRoom(room), KHO2, 'T2 over T1');
    const calls = [];
    const creep = { room, memory: { homeRoom: 'W1N9' }, store: store({}, 500),
        withdraw: (t, r, n) => { calls.push([t.id, r, n]); return s.g.OK; }, transfer: () => s.g.OK, travelTo() {} };
    s.boost.loadLab(creep);
    assert.deepEqual(plain(calls[0]), ['W1N9t', KHO2, 400]);
});

test('buying: the tier whose extra damage is cheapest; dear XKHO2 loses to cheap KO', () => {
    const asks = [{ id: 'x', type: 'sell', resourceType: X, price: 2.1, amount: 5000, roomName: 'E1N1' },
        { id: 'ko', type: 'sell', resourceType: KO, price: 0.5, amount: 5000, roomName: 'E1N1' }];
    const s = setup({ asks });
    s.g.Game.market.getAllOrders = f => asks.filter(o => !f || !f.resourceType || o.resourceType === f.resourceType);
    s.boost.supply();
    // XKHO2: 2.1 for 3x extra (0.7 each); KO: 0.5 for 1x (0.5).
    assert.deepEqual(plain(s.deals), [['ko', 3000, 'W1N9']]);
});

test('a room under attack by a player gets ranged boosts by terminal, any tier, whatever its labs', () => {
    const s = setup();
    const { g } = s;
    // E23N31: a full lab room (not kept stocked by supply), attacked; W1N9 holds KO only.
    g.Game.rooms.E23N31.find = type => (type === g.FIND_MY_STRUCTURES ? [1, 2, 3].map(i => ({ id: 'l' + i, structureType: g.STRUCTURE_LAB, store: store({}) })) : []);
    g.Game.rooms.W1N9.terminal.store[KO] = 5000;
    g.Memory.roomsUnderAttack = ['E23N31'];
    s.h.load('combat.intel').roomIntel = room => ({ players: room.name === 'E23N31', threats: [] });
    s.boost.rescue();
    assert.deepEqual(plain(s.sends), [['W1N9', KO, 2000, 'E23N31']], 'W1N9 keeps its own 3,000');
    // Not under attack: nothing.
    s.sends.length = 0;
    g.Memory.roomsUnderAttack = [];
    s.boost.rescue();
    assert.deepEqual(plain(s.sends), []);
});

test('a defender boosts from a lab holding KO when that is the ranged boost there is, as many parts as it holds', () => {
    const s = setup();
    const { g } = s;
    g.LAB_BOOST_MINERAL = 30; g.LAB_BOOST_ENERGY = 20;
    const room = g.Game.rooms.W1N9;
    room.controller.level = 7;
    const boosts = [];
    const lab = { id: 'ko', structureType: g.STRUCTURE_LAB, mineralType: KO, mineralAmount: 150, energy: 1000, store: store({ [KO]: 150 }),
        boostCreep: (c, n) => { boosts.push(n); return g.OK; } };
    room.find = type => (type === g.FIND_MY_STRUCTURES ? [lab] : []);
    s.h.load('defense.staffing').boostShortfall = () => 10;
    const creep = { name: 'd', room, memory: { priority: 'defender' }, body: Array.from({ length: 10 }, () => ({ type: g.RANGED_ATTACK })),
        pos: { isNearTo: () => true }, travelTo() {} };
    const combat = s.h.load('creep.combat');
    assert.equal(combat.handleBoosting(creep, {}), true);
    assert.deepEqual(boosts, [5], '150 KO: five parts, not none for want of the full ten');
});
