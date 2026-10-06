const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

function market({ orders = [], mine = {}, history = {}, credits = 100000, resources = {} } = {}) {
    const h = harness(), g = h.context, calls = [];
    h.load('runtime.memory').ensureInitialized();
    Object.assign(g.Game.market, {
        credits, orders: mine,
        getAllOrders: ({ resourceType, type }) => orders.filter(o => o.resourceType === resourceType && o.type === type),
        getHistory: res => history[res] || [],
        deal: (id, amount) => { calls.push(['deal', id, amount]); return g.OK; },
        changeOrderPrice: (id, price) => { calls.push(['price', id, price]); return g.OK; },
        createOrder: params => { calls.push(['create', plain(params)]); return g.OK; },
        extendOrder: (id, amount) => { calls.push(['extend', id, amount]); return g.OK; },
        cancelOrder: id => { calls.push(['cancel', id]); return g.OK; },
    });
    g.Game.resources = resources;
    return { g, calls, m: h.load('system.market') };
}
const sell = (id, price, amount = 1000, res = 'X') => ({ id, type: 'ORDER_SELL', resourceType: res, price, amount, remainingAmount: amount });
const buy = (id, price, amount = 10, res = 'cpuUnlock') => ({ id, type: 'ORDER_BUY', resourceType: res, price, amount, remainingAmount: amount });

test('sell price sits just under the cheapest listing that is not ours, ignoring crumbs', () => {
    const own = sell('mine', 1.0);
    const { m } = market({ orders: [own, sell('crumb', 1.2, 50), sell('a', 1.5), sell('b', 2)], mine: { mine: own } });
    assert.equal(m.sellPrice('X', 100, 0.5), 1.499, 'our own 1.0 listing is not a competitor');
});

test('sell price never drops below 70% of the recent average', () => {
    const { m } = market({ orders: [sell('dump', 0.1)], history: { X: [{ avgPrice: 2, volume: 10 }, { avgPrice: 4, volume: 30 }] } });
    assert.equal(m.sellPrice('X', 100, 0.5), 2.45, '0.7 x volume-weighted 3.5');
});

test('repricing: cuts are free, raises only when worth the fee', () => {
    const { m, calls } = market({ credits: 1 });
    m.reprice({ id: 'o', price: 2, remainingAmount: 1000 }, 1.5);
    m.reprice({ id: 'o', price: 2, remainingAmount: 1000 }, 2.01);   // +0.5%: not worth an intent
    m.reprice({ id: 'o', price: 2, remainingAmount: 1000 }, 2.5);    // fee 25 credits, have 1
    assert.deepEqual(plain(calls), [['price', 'o', 1.5]]);
    const rich = market({ credits: 5000 + 100 });   // the credit reserve is never spent on raises
    rich.m.reprice({ id: 'o', price: 2, remainingAmount: 1000 }, 2.5);
    assert.deepEqual(plain(rich.calls), [['price', 'o', 2.5]]);
});

test('CPU unlocks: asks at or under bid+fee or the average are bought outright, in bulk', () => {
    const bid = buy('myBid', 100, 5);
    const { m, calls } = market({
        orders: [bid, sell('cheap', 103, 4, 'cpuUnlock'), sell('dear', 130, 9, 'cpuUnlock')],
        mine: { myBid: bid }, history: { cpuUnlock: [{ avgPrice: 100, volume: 10 }] }, credits: 5000 + 1000,
    });
    m.buyCpuUnlocks();
    assert.deepEqual(plain(calls), [['deal', 'cheap', 4]], '103 <= 100 x 1.05 bid cost; 130 is above it');
});

test('CPU unlocks: otherwise outbid once, capped by the cheapest ask and the average', () => {
    const { m, calls } = market({
        orders: [buy('rival', 95), sell('ask', 120, 3, 'cpuUnlock')],
        history: { cpuUnlock: [{ avgPrice: 100, volume: 10 }] }, credits: 5000 + 2000,
    });
    m.buyCpuUnlocks();
    assert.deepEqual(plain(calls), [['create', { type: 'ORDER_BUY', resourceType: 'cpuUnlock', price: 95.001, totalAmount: 5 }]]);

    const capped = market({ orders: [buy('rival', 150)], history: { cpuUnlock: [{ avgPrice: 100, volume: 10 }] } });
    capped.m.buyCpuUnlocks();
    assert.equal(plain(capped.calls)[0][1].price, 105, 'a bidding war above 105% of average is not joined');

    const bid = buy('myBid', 120, 5);
    const lower = market({ orders: [bid, buy('rival', 90)], mine: { myBid: bid } });
    lower.m.buyCpuUnlocks();
    assert.deepEqual(plain(lower.calls), [['price', 'myBid', 90.001]], 'overpaying bid is cut (free)');
});

test('pixels are listed under the cheapest other ask and topped up as more are generated', () => {
    const order = sell('px', 3000, 20, 'pixel');
    const { m, calls } = market({ orders: [order, sell('other', 2500, 50, 'pixel'), buy('lowball', 1000, 100, 'pixel')],
        mine: { px: order }, resources: { pixel: 45 } });
    m.sellPixels();
    assert.deepEqual(plain(calls), [['price', 'px', 2499.999], ['extend', 'px', 25]]);
});

test('CPU unlock is not attempted (or notified) without a token', () => {
    const { g, m } = market();
    g.Game.shard.name = 'shard2';
    let unlocks = 0;
    g.Game.cpu.unlock = () => { unlocks++; return g.OK; };
    g.Game.notify = () => {};
    m.handleCPUUnlocking();
    assert.equal(unlocks, 0);
    g.Game.resources.cpuUnlock = 2;
    m.handleCPUUnlocking();
    assert.equal(unlocks, 1);
});

// Order books from the live market: our rooms at the shared price, plus a token 500-unit order
// placed a tick above (it had dragged us down to just under it).
const XUH2O_BOOK = (res = 'XUH2O') => {
    const ours = ['E13N22', 'E28N31', 'E23N39', 'E23N28', 'E42N31', 'E12N15', 'E22N34', 'E8N14']
        .map((room, i) => sell('mine' + i, 2207.72, 40000 + i * 100, res));
    return { ours, orders: [...ours, sell('bait', 2207.721, 500, res), sell('real', 2590.664, 20133, res)] };
};

test('token orders far below our volume do not set our price; real depth does', () => {
    const { ours, orders } = XUH2O_BOOK();
    const { m } = market({ orders, mine: Object.fromEntries(ours.map(o => [o.id, o])) });
    assert.equal(m.competitiveLevel('XUH2O', 100, 40000), 2590.664, '500 units against 40,000 are ignored');
    assert.equal(m.sellPrice('XUH2O', 100, 0.5, 2207.72, 40000), 2590.663);
    assert.equal(m.competitiveLevel('XUH2O', 100, 1000), 2207.721, 'a small seller of ours would still compete with it');

    // Many small orders that add up to real volume do count.
    const crowd = Array.from({ length: 30 }, (_, i) => sell('c' + i, 2300 + i, 500, 'XUH2O'));
    const crowded = market({ orders: [...ours, ...crowd], mine: Object.fromEntries(ours.map(o => [o.id, o])) });
    assert.equal(crowded.m.competitiveLevel('XUH2O', 100, 40000), 2319, '20 x 500 reaches 25% of 40,000');
});

test('no meaningful competition: hold the price (XKHO2 vs a 5,000 order), or recover to the average', () => {
    const ours = sell('mine', 2893.349, 40848, 'XKHO2');
    const { m } = market({ orders: [ours, sell('small', 2893.35, 5000, 'XKHO2')], mine: { mine: ours } });
    assert.equal(m.sellPrice('XKHO2', 100, 0.5, 2893.349, 40848), 2893.349);
    const dragged = market({ orders: [ours, sell('small', 2000.001, 500, 'XKHO2')], mine: { mine: ours },
        history: { XKHO2: [{ avgPrice: 2900, volume: 100 }] } });
    assert.equal(dragged.m.sellPrice('XKHO2', 100, 0.5, 2000, 40848), 2900);
});

test('raises across many orders share one credit budget, smallest orders first', () => {
    const { ours, orders } = XUH2O_BOOK('RESOURCE_CATALYZED_UTRIUM_ACID');
    // ~383 x 40,000 x 5% = ~766k per order: credits for two raises plus the reserve.
    const { m, calls } = market({ orders, mine: Object.fromEntries(ours.map(o => [o.id, o])), credits: 5000 + 1540000 });
    m.sellCompounds();
    const raised = plain(calls).filter(c => c[0] === 'price');
    assert.deepEqual(raised.map(c => c[1]), ['mine0', 'mine1'], 'only what the budget covers');
    assert.ok(raised.every(c => c[2] === 2590.663));
});
