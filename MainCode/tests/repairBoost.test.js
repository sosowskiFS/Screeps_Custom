const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

// Repairers boost (XLH2O) only under a player attack, with 750+ ticks to live.
function setup({ attacked = true, hostiles = ['Harabi'], ttl = 1400 } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.LAB_BOOST_MINERAL = 30; g.LAB_BOOST_ENERGY = 20;
    g.RESOURCE_ENERGY = 'energy';
    g.Memory.roomsUnderAttack = attacked ? ['R'] : [];
    g.Memory.labList = { R: ['a', 'b', 'c'] };
    g.Memory.whiteList = ['Friend'];
    const lab = { structureType: g.STRUCTURE_LAB, mineralType: g.RESOURCE_CATALYZED_LEMERGIUM_ACID, mineralAmount: 3000, energy: 2000 };
    const calls = [];
    lab.boostCreep = () => { calls.push('boost'); return g.OK; };
    const room = { name: 'R', controller: { level: 8 },
        find: t => (t === g.FIND_MY_STRUCTURES ? [lab] : t === g.FIND_HOSTILE_CREEPS ? hostiles.map(u => ({ owner: { username: u } })) : []) };
    const creep = { room, ticksToLive: ttl, memory: { priority: 'repair', deathWarn: 0 }, carryCapacity: 0,
        getActiveBodyparts: () => 20, travelTo: () => calls.push('travel'), suicide: () => calls.push('work') };
    return { run: () => h.load('creep.repair').run(creep), calls, creep };
}

test('a repairer boosts only under a player attack, with 750+ ticks to live', () => {
    let s = setup();
    s.run();
    assert.deepEqual(s.calls, ['boost']);
    assert.equal(s.creep.memory.hasBoosted, true);
    for (const [why, opts] of [['not attacked', { attacked: false }], ['NPC invaders only', { hostiles: ['Invader', 'Source Keeper'] }],
        ['a whitelisted player', { hostiles: ['Friend'] }], ['under 750 ticks left', { ttl: 600 }]]) {
        s = setup(opts);
        s.run();
        assert.ok(!s.calls.includes('boost'), why + ': no boost');
        assert.ok(!s.creep.memory.hasBoosted, why + ': may still boost later');
    }
});
