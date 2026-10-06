const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

function setup() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Game.cpu.limit = 20;
    g.Game.cpu.bucket = 5000;
    return { h, g, gov: h.load('runtime.cpuGovernor') };
}

// Run `ticks` ticks at a fixed CPU usage.
function run(g, gov, ticks, used) {
    for (let i = 0; i < ticks; i++) {
        g.Game.time++;
        gov.update(used);
    }
}

test('shed level moves one step per 100 ticks while over budget, and back down once under', () => {
    const { g, gov } = setup();
    run(g, gov, 50, 25);               // ticks 2-51
    assert.equal(gov.shedLevel(), 0, 'first adjustment window not reached');
    run(g, gov, 50, 25);               // tick 100: first step
    assert.equal(gov.shedLevel(), 1);
    run(g, gov, 98, 25);               // ticks 102-199: still within 100 ticks of the step
    assert.equal(gov.shedLevel(), 1, 'no second step within 100 ticks');
    run(g, gov, 1, 25);                // tick 200: second step
    assert.equal(gov.shedLevel(), 2);
    run(g, gov, 1000, 25);
    assert.equal(gov.shedLevel(), 3, 'capped at 3');

    run(g, gov, 150, 19);           // just under the limit: holds (hysteresis band 90-100%)
    assert.equal(gov.shedLevel(), 3);
    run(g, gov, 600, 12);           // well under: steps down one level per 100 ticks
    assert.equal(gov.shedLevel(), 0);
});

test('a pixel only drains the bucket when there is headroom, and the low bucket after it is not an emergency', () => {
    const { g, gov } = setup();
    let generated = 0;
    g.Game.cpu.generatePixel = () => { generated++; g.Game.cpu.bucket = 0; return g.OK; };
    run(g, gov, 300, 14);

    g.Game.cpu.bucket = 9500;
    gov.maybeGeneratePixel();
    assert.equal(generated, 0, 'needs the full 10000');

    g.Game.cpu.bucket = 10000;
    g.Memory.roomsUnderAttack = ['A'];
    gov.maybeGeneratePixel();
    assert.equal(generated, 0, 'keeps the buffer during a fight');

    g.Memory.roomsUnderAttack = [];
    gov.maybeGeneratePixel();
    assert.equal(generated, 1);
    run(g, gov, 50, 14);
    assert.equal(gov.shedLevel(), 0, 'bucket at 0 right after a pixel: nothing shed');
});

test('no pixel while CPU is close to the limit or work is being shed', () => {
    const { g, gov } = setup();
    let generated = 0;
    g.Game.cpu.generatePixel = () => { generated++; return g.OK; };
    g.Game.cpu.bucket = 10000;
    run(g, gov, 300, 19);
    gov.maybeGeneratePixel();
    assert.equal(generated, 0, 'averaging 95% of the limit: keep the bucket');
});

test('an unexplained near-empty bucket jumps straight to full shedding', () => {
    const { g, gov } = setup();
    run(g, gov, 10, 15);
    g.Game.cpu.bucket = 300;
    run(g, gov, 1, 15);
    assert.equal(gov.shedLevel(), 3);
});

test('thinned creeps are staggered: each tick sheds about the same share, essentials always run', () => {
    const { g, gov } = setup();
    gov.shedLevel(); // creates the state
    g.Memory.cpuGov.shed = 2;
    const names = Array.from({ length: 400 }, (_, i) => 'creep' + i);
    for (let t = 0; t < 4; t++) {
        g.Game.time = 1000 + t;
        const optional = names.filter(n => gov.shouldRun(n, 'optional')).length;
        assert.ok(optional > 150 && optional < 250, 'about half of optional creeps run each tick, not all-or-nothing');
        assert.equal(names.filter(n => gov.shouldRun(n, 'essential')).length, 400);
    }
    // Each optional creep runs exactly 2 of every 4 ticks.
    const runs = [0, 1, 2, 3].filter(t => { g.Game.time = 2000 + t; return gov.shouldRun('repair_X', 'optional'); }).length;
    assert.equal(runs, 2);
});

test('features turn off in order as shedding rises; path-heavy ones also wait for some bucket', () => {
    const { g, gov } = setup();
    gov.shedLevel();
    const on = () => ['roads', 'excessScans', 'scouting', 'harasser', 'planning', 'remoteSpawning'].filter(f => gov.allows(f));
    assert.deepEqual(on(), ['roads', 'excessScans', 'scouting', 'harasser', 'planning', 'remoteSpawning']);
    g.Memory.cpuGov.shed = 1;
    assert.deepEqual(on(), ['scouting', 'harasser', 'planning', 'remoteSpawning']);
    g.Memory.cpuGov.shed = 2;
    assert.deepEqual(on(), ['remoteSpawning']);
    g.Memory.cpuGov.shed = 3;
    assert.deepEqual(on(), []);
    g.Memory.cpuGov.shed = 0;
    g.Game.cpu.bucket = 500;
    assert.deepEqual(on(), ['roads', 'excessScans', 'harasser', 'remoteSpawning'], 'right after a pixel: no path-heavy planning');
});

test('creep tiers keep spawn energy, towers and urgent work running', () => {
    const { h, g } = setup();
    const { tierOf } = h.load('creep.registry');
    const creep = (priority, extra = {}) => Object.assign({ memory: { priority, homeRoom: 'A' }, room: { name: 'A', controller: { my: true, ticksToDowngrade: 100000 } },
        getActiveBodyparts: () => 0 }, extra);
    assert.equal(tierOf(creep('mule')), 'essential');
    assert.equal(tierOf(creep('distributor')), 'essential');
    assert.equal(tierOf(creep('supplier')), 'essential');
    assert.equal(tierOf(creep('farMule')), 'economy');
    assert.equal(tierOf(creep('farMiner')), 'economy');
    assert.equal(tierOf(creep('farMiner', { getActiveBodyparts: () => 4 })), 'essential', 'keeper-room miner');
    assert.equal(tierOf(creep('repair')), 'optional');
    g.Memory.roomsUnderAttack = ['A'];
    assert.equal(tierOf(creep('repair')), 'essential', 'repairs matter during an attack');
    g.Game.flags.AWarBoosts = {};
    assert.equal(tierOf(creep('labWorker')), 'essential', 'boosts being staged');
    assert.equal(tierOf(creep('upSupplier', { room: { name: 'A', controller: { my: true, ticksToDowngrade: 5000 } } })), 'essential');
});
