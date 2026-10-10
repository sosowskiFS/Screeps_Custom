const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

// The Seasonal World: shard "shardSeason", the market API present but unusable, no generatePixel.
function season({ shard = 'shardSeason' } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Game.shard = { name: shard };
    g.console = { log: () => {} };
    const calls = [];
    g.Game.market = { credits: 0, orders: {}, deal: () => { calls.push('deal'); return g.OK; }, getAllOrders: () => { calls.push('getAllOrders'); return []; },
        createOrder: () => { calls.push('createOrder'); return g.OK; }, cancelOrder: () => calls.push('cancelOrder'),
        calcTransactionCost: () => 5, getHistory: () => [] };
    g.Game.resources = {};
    g.InterShardMemory = { getLocal: () => '', setLocal: () => calls.push('ism.setLocal'), getRemote: () => { calls.push('ism.getRemote'); return null; } };
    return { h, g, calls, world: h.load('runtime.world') };
}

test('the Seasonal World is recognised by its shard, and its missing features are reported', () => {
    let s = season();
    assert.equal(s.world.isSeason(), true);
    assert.equal(s.world.market(), false);
    assert.equal(s.world.pixels(), false);
    assert.equal(s.world.accountResources(), false);
    assert.equal(s.world.multiShard(), false);
    assert.equal(s.world.transactionCost(1000, 'E1N1', 'E5N5'), 5, 'own terminal sends still priced by the game');
    s = season({ shard: 'shard2' });
    s.g.Game.cpu.generatePixel = () => s.g.OK;
    s.g.Game.cpu.unlock = () => s.g.OK;
    assert.deepEqual([s.world.isSeason(), s.world.market(), s.world.pixels(), s.world.accountResources(), s.world.multiShard()], [false, true, true, true, true]);
    s.g.Memory.settings = { world: 'season' };
    assert.equal(s.world.isSeason(), true, 'Memory.settings.world forces it (private season servers)');
});

test('in the Seasonal World nothing trades, generates pixels, unlocks CPU or talks to other shards', () => {
    const s = season();
    s.g.Game.time = 100;
    s.h.load('system.market').handleMarketOperations();
    s.h.load('system.market').handleCPUUnlocking();
    s.g.Game.cpu.bucket = 10000;
    s.g.Game.cpu.generatePixel = () => s.calls.push('pixel');   // even if a season offered it
    s.h.load('runtime.cpuGovernor').maybeGeneratePixel();
    assert.equal(s.h.load('runtime.cache').marketOrders('energy', 'buy').length, 0);
    const ism = s.h.load('runtime.ism');
    ism.setLocal('pc', { t: 1 });
    assert.equal(ism.get('shard2', 'xs'), undefined);
    assert.equal(s.h.load('system.shardX').enabled(), false, 'no shardX from a one-shard world');
    assert.equal(s.calls.length, 0, JSON.stringify(s.calls));
});

test('without other shards, this shard creates and assigns the power creeps itself', () => {
    const s = season();
    const pc = s.h.load('system.powerCreeps');
    assert.equal(pc.creatorShard(), 'shardSeason', 'normally only shard2 creates operators');
    assert.equal(pc.topShard(), 'shardSeason', 'normally shardX');
    const mmo = season({ shard: 'shard1' });
    const pc1 = mmo.h.load('system.powerCreeps');
    assert.deepEqual([pc1.creatorShard(), pc1.topShard()], ['shard2', 'shardX']);
});
