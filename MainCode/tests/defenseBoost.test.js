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
    g.Game.market.credits = 100000;
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
    const s = setup({ donorX: 4000, asks });   // E23N31 would drop under 3,000
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
