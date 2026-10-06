const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

function setup() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.BODYPART_COST = { move: 50, carry: 50, work: 100, attack: 80, ranged_attack: 150, heal: 250, claim: 600, tough: 10 };
    g.CARRY_CAPACITY = 50;
    return { h, g, far: h.load('spawn.BuildFarCreeps') };
}
const count = (body, part) => body.filter(p => p === part).length;

test('far mules are sized to their round trip, at full off-road speed, with no dead ATTACK part', () => {
    const { g, far } = setup();
    const max = far.getMuleBuild(12900, null, undefined);
    assert.deepEqual([count(max, g.CARRY), count(max, g.MOVE), count(max, g.ATTACK)], [25, 25, 0], 'manual flag: max size');
    const near = far.getMuleBuild(12900, null, 40);   // 10/tick x 40 ticks x 1.15 = 460 -> 10 CARRY
    assert.deepEqual([count(near, g.CARRY), count(near, g.MOVE)], [10, 10]);
    const tiny = far.getMuleBuild(12900, null, 5);
    assert.equal(count(tiny, g.CARRY), 4, 'never below 4 pairs');
    const poor = far.getMuleBuild(800, null, 140);
    assert.equal(count(poor, g.CARRY), 8, 'limited by room energy');
});

test('reservers are CLAIM/MOVE pairs only', () => {
    const { g, far } = setup();
    const body = far.getClaimerBuild(3000);
    assert.deepEqual([count(body, g.CLAIM), count(body, g.MOVE), count(body, g.ATTACK)], [4, 4, 0]);
});

test('player guards: cheapest winning ranged/heal kiter, a pair when one cannot win, nothing when two cannot', () => {
    const { g, h, far } = setup();
    const { verdictFor } = h.load('combat.intel');
    // A small raider: one guard is enough.
    const solo = far.guardPlanFor({ d: 120, h: 24, e: 2500 }, 12900);
    assert.equal(solo.count, 1);
    assert.equal(count(solo.body, g.MOVE), count(solo.body, g.RANGED_ATTACK) + count(solo.body, g.HEAL), 'full speed off-road');
    const us = { dps: count(solo.body, g.RANGED_ATTACK) * 10, heal: count(solo.body, g.HEAL) * 12, ehp: solo.body.length * 100 };
    assert.equal(verdictFor(us, { dps: 120, heal: 24, ehp: 2500 }), 'win');
    // A strong duo: no single unboosted 50-part kiter wins, a pair does.
    const duo = far.guardPlanFor({ d: 300, h: 120, e: 4000 }, 12900);
    assert.equal(duo.count, 2);
    assert.equal(far.guardPlanFor({ d: 300, h: 120, e: 4000 }, 1300), null, 'small room: send nothing rather than feed it');
    assert.equal(far.guardPlanFor({ d: 2000, h: 600, e: 40000 }, 12900), null, 'boosted army: stay away');
    assert.ok(far.guardBodyFor({ d: 10, h: 0, e: 200 }, 12900).length <= 4, 'a lone scout gets a small guard');
});

test('enemy forces seen in remote rooms are remembered (strongest during an incident) and expire', () => {
    const { h, g } = setup();
    const intel = h.load('combat.intel');
    const enemy = (dps) => ({ id: 'e' + dps, name: 'raider', owner: { username: 'rival' }, hits: 2000, hitsMax: 2000,
        pos: { x: 10, y: 10, roomName: 'R', getRangeTo: () => 5 }, body: new Array(dps / 10).fill(0).map(() => ({ type: g.RANGED_ATTACK, hits: 100 })) });
    let hostiles = [enemy(200)];
    const room = { name: 'R', find: type => type === g.FIND_HOSTILE_CREEPS ? hostiles : [] };
    g.Game.time = 100;
    intel.roomIntel(room);
    assert.equal(intel.remoteThreat('R').d, 200);
    assert.equal(intel.remoteThreat('R').p, 1);
    hostiles = [enemy(50)];
    g.Game.time = 150;
    intel.roomIntel(room);
    assert.equal(intel.remoteThreat('R').d, 200, 'keeps the stronger force seen this incident');
    g.Game.time = 2000;
    assert.equal(intel.remoteThreat('R'), undefined, 'expired');
});

test('harassers go for reservers first, then loaded haulers, then miners', () => {
    const { h, g } = setup();
    const harasser = h.load('creep.harasser');
    const at = (x) => ({ x, y: 10, roomName: 'R' });
    const creep = { pos: { getRangeTo: t => Math.abs(t.pos.x - 10) } };
    const part = type => ({ type, hits: 100 });
    const miner = { id: 'miner', pos: at(11), body: [part(g.WORK), part(g.WORK), part(g.WORK), part(g.MOVE)] };
    const hauler = { id: 'hauler', pos: at(14), body: [part(g.CARRY), part(g.CARRY), part(g.MOVE)], store: { getUsedCapacity: () => 100 } };
    const reserver = { id: 'reserver', pos: at(20), body: [part(g.CLAIM), part(g.MOVE)] };
    assert.equal(harasser.pickPrey(creep, [miner, hauler, reserver]).id, 'reserver');
    assert.equal(harasser.pickPrey(creep, [miner, hauler]).id, 'hauler');
    assert.equal(harasser.pickPrey(creep, [miner]).id, 'miner');
});
