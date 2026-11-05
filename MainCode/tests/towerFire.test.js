const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

// shardX W1N9: three towers at 16-17,7-9; one healer quad at 24-25,13-14 (two members with 18 XLHO2
// HEAL each, the others ranged), well away from the second quad; storage and terminal nearly empty.
function setup({ defenderAt = null, defenderHits = 4000, heal = 18 } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    Object.assign(g, { TOWER_POWER_ATTACK: 600, TOWER_OPTIMAL_RANGE: 5, TOWER_FALLOFF_RANGE: 20, TOWER_FALLOFF: 0.75,
        HEAL_POWER: 12, RANGED_HEAL_POWER: 4, RANGED_ATTACK_POWER: 10, RESOURCE_ENERGY: 'energy',
        BOOSTS: { heal: { XLHO2: { heal: 4, rangedHeal: 4 } }, tough: {}, ranged_attack: {} } });
    g.console = { log() {} };
    g.Game.notify = () => {};
    const range = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    const pos = (x, y) => ({ x, y, roomName: 'W1N9',
        getRangeTo: o => range({ x, y }, o.pos || o), inRangeTo: (o, r) => range({ x, y }, o.pos || o) <= r,
        findInRange: (type, r, opts) => hostiles.filter(c => range({ x, y }, c.pos) <= r && (!opts || !opts.filter || opts.filter(c))),
        findClosestByRange: list => list[0] });
    const part = (type, boost) => ({ type, hits: 100, boost });
    const member = (id, x, y, heal) => ({ id, name: id, owner: { username: 'Harabi' }, pos: pos(x, y), hits: 5000, hitsMax: 5000,
        body: [].concat(Array(heal).fill(part('heal', 'XLHO2')), Array(25 - heal).fill(part('ranged_attack')), Array(25).fill(part('move'))) });
    const hostiles = [member('h1', 24, 13, heal), member('h2', 25, 13, heal), member('r1', 24, 14, 0), member('r2', 25, 14, 0)];
    const attacks = [], heals = [];
    const towers = [[16, 8], [17, 7], [17, 9]].map(([x, y], n) => ({ id: 't' + n, structureType: g.STRUCTURE_TOWER, pos: pos(x, y),
        energy: 864, energyCapacity: 1000, store: { energy: 864 }, isActive: () => true, effects: [],
        attack: t => attacks.push(['t' + n, t.id]), heal: t => heals.push(['t' + n, t.id]), repair() {} }));
    const mine = [];
    if (defenderAt) mine.push({ id: 'd', name: 'd', memory: { priority: 'defender' }, pos: pos(...defenderAt), hits: defenderHits, hitsMax: 4000,
        body: Array(20).fill(part('ranged_attack')) });
    const room = { name: 'W1N9', controller: { my: true, level: 7 }, storage: { store: { energy: 0 } }, terminal: { store: { energy: 900 } },
        find: (type, opts) => {
            let list = type === g.FIND_HOSTILE_CREEPS ? hostiles : type === g.FIND_STRUCTURES || type === g.FIND_MY_STRUCTURES ? towers : [];
            if (opts && typeof opts.filter === 'function') list = list.filter(opts.filter);
            return list;
        } };
    for (const t of towers) t.room = room;
    g.Game.rooms.W1N9 = room;
    g.Game.getObjectById = id => hostiles.find(c => c.id === id) || null;   // the towers share one pick a tick
    g.Memory.roomsUnderAttack = ['W1N9'];
    const tower = h.load('tower.Operate');
    const run = () => {
        h.load('runtime.cache').current().roomCreeps = { W1N9: mine };
        for (const t of towers) tower.run(t, 0, 0, null);
    };
    return { g, run, attacks, heals, mine, hostiles, towerModule: tower };
}

test('towers alone against a healer quad: hold fire (energy kept, the burst saved)', () => {
    const s = setup();
    s.g.Game.time = 100;
    s.run();
    assert.deepEqual(s.attacks, [], '1,728 healing on a member beats ~1,590 tower damage');
});

test('a defender in range: every tower fires on the same member with it, whatever the stores hold', () => {
    const s = setup({ defenderAt: [22, 12] });
    s.g.Game.time = 100;
    s.run();
    assert.equal(s.attacks.length, 3, 'all three towers (storage 0, terminal 900: no reserve gate)');
    assert.equal(new Set(s.attacks.map(a => a[1])).size, 1, 'one target');
});

test('mid-burst the towers keep firing over a scratched defender; one in real trouble is healed', () => {
    let s = setup({ defenderAt: [22, 12], defenderHits: 3000 });
    s.g.Game.time = 100;
    s.run();
    assert.equal(s.attacks.length, 3);
    assert.deepEqual(s.heals, []);
    s = setup({ defenderAt: [22, 12], defenderHits: 1000 });
    s.g.Game.time = 100;
    s.run();
    assert.ok(s.heals.length > 0, '25% hits: healed');
});

test('joint fire short of a kill is a test: a quad that soaks it and stays put stops being shot after 5 ticks', () => {
    const s = setup({ defenderAt: [22, 12], heal: 20 });   // 1,920 healing: towers + defender ~1,790
    for (let t = 100; t <= 105; t++) { s.g.Game.time = t; s.run(); }
    assert.equal(s.attacks.length, 18, 'six ticks of joint fire: the test');
    s.attacks.length = 0;
    for (let t = 106; t < 116; t++) { s.g.Game.time = t; s.run(); }
    assert.deepEqual(s.attacks, [], 'nothing moved, nothing worn down: suspended');
});

test('joint fire that moves the quad keeps going', () => {
    const s = setup({ defenderAt: [22, 12], heal: 20 });
    for (let t = 100; t < 105; t++) { s.g.Game.time = t; s.run(); }
    for (const h of s.hostiles) h.pos.x += 0;      // same tiles, but one member steps back
    s.hostiles[2].pos = Object.assign({}, s.hostiles[2].pos, { x: 24, y: 15 });
    s.attacks.length = 0;
    for (let t = 105; t < 108; t++) { s.g.Game.time = t; s.run(); }
    assert.ok(s.attacks.length > 0, 'it pulled back: still shot at');
});

test('a hopper one volley kills is shot, border tile or not under attack; one it cannot kill is left alone', () => {
    const s = setup();
    s.g.Memory.roomsUnderAttack = [];
    const scout = { id: 'sc', name: 'sc', owner: { username: 'Harabi' }, hits: 100, hitsMax: 100,
        pos: Object.assign({}, s.hostiles[0].pos, { x: 10, y: 49, getRangeTo: o => Math.max(Math.abs((o.pos || o).x - 10), Math.abs((o.pos || o).y - 49)) }),
        body: [{ type: 'move', hits: 100 }] };
    s.hostiles.length = 0;
    s.hostiles.push(scout);
    s.g.Game.time = 200;
    s.run();
    assert.equal(s.attacks.length, 3, 'E32N45\'s 1-MOVE border hopper: all three towers');
    s.attacks.length = 0;
    scout.hits = scout.hitsMax = 5000;
    s.g.Game.time++;
    s.run();
    assert.deepEqual(s.attacks, [], 'a volley cannot kill it: no shots wasted');
});

test('tower repairs: as often as the budget pays for, scaled by how well the towers reach the target; far towers skip all but critical repairs', () => {
    const s = setup();
    const tower = s.g.Game.rooms.W1N9.find(s.g.FIND_MY_STRUCTURES)[0];
    const at = (x, y) => ({ x, y, roomName: 'W1N9' });
    const towerOp = s.towerModule;
    const near = { structureType: 'rampart', hits: 50000, hitsMax: 300000000, pos: at(18, 9) };     // 1-2 from the towers
    const far = { structureType: 'rampart', hits: 50000, hitsMax: 300000000, pos: at(40, 40) };     // 30+ away
    assert.equal(towerOp.worthRepair(tower, near), true);
    assert.equal(towerOp.worthRepair(tower, far), false, 'a quarter strength: repairers do it better');
    far.hits = 5000;
    assert.equal(towerOp.worthRepair(tower, far), true, 'critical: any tower');
    // Roads: towers are the only ones repairing them, so a far road is always worth it.
    const farRoad = { structureType: 'road', hits: 4000, hitsMax: 5000, pos: at(40, 40) };
    assert.equal(towerOp.repairEfficiency(tower, farRoad) < 0.5, true);
    assert.equal(towerOp.worthRepair(tower, farRoad), true, 'distant roads are never left to decay');
    // 20 a tick to spare, the target beside the three towers: 3 x 10 / (20 x 0.5 x 1) = every 3 ticks.
    s.g.Memory.energyFlow = { W1N9: { n: 40, in: 30, up: 10, bu: 0, re: 10, sp: 0, nb: 0, bank: 50000 } };
    s.g.Game.rooms.W1N9.controller.level = 7;
    s.g.Memory.repairTarget = { W1N9: 'nearR' };
    s.g.Game.getObjectById = id => (id === 'nearR' ? near : null);
    assert.equal(towerOp.budgetRepairDelay(s.g.Game.rooms.W1N9, null), 3);
    s.g.Game.getObjectById = id => (id === 'nearR' ? Object.assign({}, far, { hits: 50000 }) : null);
    assert.equal(towerOp.budgetRepairDelay(s.g.Game.rooms.W1N9, null), 250, 'no tower near enough: the slow pace');
});
