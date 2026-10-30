const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

// One lab room (A) with a terminal. Recipes for the move boost only:
// XZHO2 = X + ZHO2, ZHO2 = ZO + OH, ZO = Z + O, OH = O + H  =>  X1 Z1 O2 H1 per unit.
function world({ stock = {}, asks = [], history = { avg: 1, volume: 100000 }, credits = 100000 } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    const R = n => g['RESOURCE_' + n];
    const re = {};
    const add = (a, b, p) => { (re[a] = re[a] || {})[b] = p; (re[b] = re[b] || {})[a] = p; };
    add(R('ZYNTHIUM'), R('OXYGEN'), R('ZYNTHIUM_OXIDE'));
    add(R('OXYGEN'), R('HYDROGEN'), R('HYDROXIDE'));
    add(R('ZYNTHIUM_OXIDE'), R('HYDROXIDE'), R('ZYNTHIUM_ALKALIDE'));
    add(R('ZYNTHIUM_ALKALIDE'), R('CATALYST'), R('CATALYZED_ZYNTHIUM_ALKALIDE'));
    g.REACTIONS = re;
    const store = Object.assign({ energy: 50000, getFreeCapacity: () => 100000 }, stock);
    g.Game.rooms = { A: { name: 'A', controller: { my: true }, terminal: { cooldown: 0, store }, storage: { store: {} } } };
    g.Memory.labList = { A: ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'] };
    g.Game.getObjectById = () => null;
    const deals = [];
    g.Game.market = { credits, orders: {}, deal: (id, n, room) => { deals.push({ id, n, room }); return g.OK; },
        getAllOrders: ({ resourceType, type }) => asks.filter(o => o.resourceType === resourceType && type === g.ORDER_SELL),
        getHistory: () => [{ avgPrice: history.avg, volume: history.volume }],
        calcTransactionCost: n => Math.ceil(n * 0.1) };
    g.Game.shard = { name: 'shard2' };
    g.console = { log: () => {} };
    return { h, g, R, deals, buy: h.load('system.mineralBuy') };
}

test('demand: boosts short of target are expanded to the base minerals still missing, after what is in stock', () => {
    const { R, buy, h } = world();
    const labs = h.load('system.labs');
    const goal = { [R('CATALYZED_ZYNTHIUM_ALKALIDE')]: 10000 };
    // 4000 XZHO2 and 2000 ZHO2 in stock: 4000 more to make from 2000 ZHO2 and 2000 from scratch.
    const need = buy.missingBase({ [R('CATALYZED_ZYNTHIUM_ALKALIDE')]: 4000, [R('ZYNTHIUM_ALKALIDE')]: 2000, [R('OXYGEN')]: 1000 }, goal);
    assert.equal(need[R('CATALYST')], 6000);
    assert.equal(need[R('ZYNTHIUM')], 4000);
    assert.equal(need[R('OXYGEN')], 7000, '2 per unit, less the 1000 held');
    assert.equal(need[R('HYDROGEN')], 4000);
    assert.ok(labs.COMBAT.has(R('CATALYZED_ZYNTHIUM_ALKALIDE')));
});

test('only minerals both missing and critically low are bought, up to the refill level', () => {
    const { R, buy } = world();
    const goal = { [R('CATALYZED_ZYNTHIUM_ALKALIDE')]: 10000 };
    const list = buy.wants({ [R('CATALYST')]: 500, [R('OXYGEN')]: 5000 }, goal, 1);
    const byRes = Object.fromEntries(list.map(w => [w.resource, w.amount]));
    assert.equal(byRes[R('CATALYST')], 9500, 'X at 500: refilled to 10,000');
    assert.equal(byRes[R('OXYGEN')], undefined, 'O at 5,000 is not critical (under 3,000 per lab room is)');
    assert.equal(byRes[R('ZYNTHIUM')], 10000);
});

test('buys the cheapest fair asks only: never above 110% of the history average, never on thin history', () => {
    const asks = r => [
        { id: 'cheap', resourceType: r, price: 1.05, amount: 3000, roomName: 'B' },
        { id: 'dear', resourceType: r, price: 1.5, amount: 50000, roomName: 'B' },
    ];
    let w = world({ stock: { RESOURCE_CATALYST: 0 } });
    w.g.Game.market.getAllOrders = ({ resourceType, type }) => (type === w.g.ORDER_SELL ? asks(resourceType) : []);
    w.buy.run();
    assert.ok(w.deals.length > 0 && w.deals.every(d => d.id === 'cheap'), JSON.stringify(w.deals));
    assert.ok(w.deals.every(d => d.n <= 3000));
    assert.ok(w.g.Memory.mineralBuys.length > 0, 'logged');
    // History too thin to trust: nothing.
    w = world({ history: { avg: 1, volume: 500 } });
    w.g.Game.market.getAllOrders = ({ resourceType, type }) => (type === w.g.ORDER_SELL ? asks(resourceType) : []);
    w.buy.run();
    assert.equal(w.deals.length, 0);
    // Credits at the reserve: nothing.
    w = world({ credits: 4000 });
    w.g.Game.market.getAllOrders = ({ resourceType, type }) => (type === w.g.ORDER_SELL ? asks(resourceType) : []);
    w.buy.run();
    assert.equal(w.deals.length, 0);
});
