const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

function storeOf(contents, capacity) {
    const store = Object.assign({}, contents);
    const used = () => Object.values(store).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
    Object.defineProperties(store, { getFreeCapacity: { value: () => capacity - used() }, getUsedCapacity: { value: () => used() } });
    return store;
}
function world({ terminal = {}, storage = {}, market = true } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    // The game's real resource and order values (the harness names constants after themselves).
    Object.assign(g, { RESOURCE_ENERGY: 'energy', RESOURCE_POWER: 'power', RESOURCE_OPS: 'ops', RESOURCE_SILICON: 'silicon',
        RESOURCE_METAL: 'metal', RESOURCE_BIOMASS: 'biomass', RESOURCE_MIST: 'mist', RESOURCE_HYDROGEN: 'H', ORDER_BUY: 'buy', ORDER_SELL: 'sell' });
    g.Game.shard = { name: market ? 'shard2' : 'shardSeason' };
    const calls = [];
    g.Game.market = { credits: 100000, orders: {}, deal: (id, n, room) => { calls.push(['deal', id, n, room]); return g.OK; },
        createOrder: o => { calls.push(['order', o.resourceType, o.totalAmount, o.roomName]); return g.OK; },
        getAllOrders: () => g.__orders || [], getHistory: () => [{ volume: 100, avgPrice: 2 }], calcTransactionCost: () => 100,
        cancelOrder: () => {} };
    const room = { name: 'R', controller: { my: true },
        terminal: { id: 't', my: true, cooldown: 0, store: storeOf(terminal, 300000) },
        storage: { id: 's', my: true, store: storeOf(storage, 1000000) } };
    g.Game.rooms = { R: room };
    return { h, g, room, calls, budget: h.load('system.mineralBudget') };
}

test('the terminal keeps a working stock: excess goes to the storage, within the storage budget', () => {
    const w = world({ terminal: { energy: 150000, GO: 52000, KO: 9000 }, storage: { energy: 400000 } });
    let move = w.budget.terminalBalance(w.room);
    assert.deepEqual([move.from.id, move.to.id, move.resource, move.amount], ['t', 's', 'energy', 75000], 'energy above 75k first (largest)');
    w.room.terminal.store.energy = 70000;
    move = w.budget.terminalBalance(w.room);
    assert.deepEqual([move.resource, move.amount], ['GO', 42000], 'GO down to 10k');
    // A storage near its budget takes only what keeps 100k free.
    const tight = world({ terminal: { GO: 52000 }, storage: { energy: 880000 } });
    move = tight.budget.terminalBalance(tight.room);
    assert.equal(move.amount, 20000);
    const full = world({ terminal: { energy: 40000, GO: 52000 }, storage: { energy: 900000 } });
    assert.equal(full.budget.terminalBalance(full.room), null, 'storage at its budget: the terminal keeps it');
});

test('the terminal is topped up from the storage when low (minerals first, energy only to 30k), never with power', () => {
    const w = world({ terminal: { energy: 25000, XKHO2: 6000 }, storage: { energy: 500000, power: 50000, XKHO2: 40000, GO: 30000 } });
    const move = w.budget.terminalBalance(w.room);
    assert.deepEqual([move.from.id, move.to.id, move.resource, move.amount], ['s', 't', 'GO', 10000], 'XKHO2 6000 is above half, GO is not there');
    w.room.terminal.store.GO = 10000;
    assert.equal(w.budget.terminalBalance(w.room), null, 'energy 25k is above the 20k top-up line; power stays');
    w.room.terminal.store.energy = 5000;
    assert.deepEqual([w.budget.terminalBalance(w.room).resource, w.budget.terminalBalance(w.room).amount], ['energy', 25000]);
});

test('trade goods stay in the terminal (sold from there); ops are always dumped; trade goods only without a market', () => {
    const w = world({ terminal: { energy: 40000, silicon: 30000, biomass: 18000, ops: 600 }, storage: { energy: 400000 } });
    assert.equal(w.budget.terminalBalance(w.room), null, 'trade goods are not moved out while a market can sell them');
    assert.equal(w.budget.pick(w.room).resource, 'ops', 'ops are disposed of at once');
    delete w.room.terminal.store.ops;
    assert.equal(w.budget.pick(w.room), null, 'with a market, trade goods wait to be sold');
    assert.ok(w.budget.tier('silicon') < w.budget.tier('H'), 'and they are the first excess dumped when space runs out');
    const season = world({ terminal: { silicon: 30000 }, storage: { energy: 400000 }, market: false });
    assert.equal(season.budget.pick(season.room).resource, 'silicon', 'no market: dumped');
});

test('trade goods are sold first chance: into the best bid above half the average, else listed once', () => {
    const w = world({ terminal: { energy: 50000, silicon: 30000 }, storage: {} });
    w.g.__orders = [{ id: 'low', resourceType: 'silicon', type: 'buy', amount: 50000, price: 0.5, roomName: 'X' },
        { id: 'good', resourceType: 'silicon', type: 'buy', amount: 20000, price: 1.5, roomName: 'Y' }];
    const market = w.h.load('system.market');
    assert.equal(market.sellTradeGoods(), 1);
    assert.deepEqual(w.calls[0], ['deal', 'good', 20000, 'R'], 'the 0.5 bid is under half the 2.0 average');
    const v = world({ terminal: { energy: 50000, silicon: 30000 }, storage: {} });
    v.g.__orders = [];
    v.h.load('system.market').sellTradeGoods();
    assert.deepEqual(v.calls[0], ['order', 'silicon', 30000, 'R'], 'no bid: listed');
});
