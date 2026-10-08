const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

test('two systems writing InterShardMemory on the same tick keep both keys (shardX "0 rooms seen")', () => {
    const h = harness(), g = h.context;
    g.Game.shard = { name: 'shardX' };
    // getLocal returns the value as it was at the start of the tick, like the game does.
    let stored = JSON.stringify({ old: 1 });
    const startOfTick = stored;
    g.InterShardMemory = { getLocal: () => startOfTick, setLocal: v => { stored = v; }, getRemote: () => null };
    const ism = h.load('runtime.ism');
    ism.setLocal('xs', { seen: 206 });   // system.shardX
    ism.setLocal('pc', { need: 0 });     // system.powerCreeps, later in the same tick
    const data = JSON.parse(stored);
    assert.deepEqual(Object.keys(data).sort(), ['old', 'pc', 'xs']);
    assert.equal(data.xs.seen, 206, 'the earlier key survives the later write');
    ism.setLocal('old', undefined);
    assert.deepEqual(Object.keys(JSON.parse(stored)).sort(), ['pc', 'xs'], 'undefined removes a key');
});

test('other shards are read once per tick', () => {
    const h = harness(), g = h.context;
    g.Game.shard = { name: 'shard2' };
    g.Game.time = 10;
    let reads = 0;
    g.InterShardMemory = { getLocal: () => '', setLocal: () => {}, getRemote: () => { reads++; return JSON.stringify({ xs: { seen: reads } }); } };
    const ism = h.load('runtime.ism');
    assert.equal(ism.get('shardX', 'xs').seen, 1);
    assert.equal(ism.get('shardX', 'pc'), undefined);
    assert.equal(reads, 1);
    g.Game.time++;
    assert.equal(ism.get('shardX', 'xs').seen, 2);
});
