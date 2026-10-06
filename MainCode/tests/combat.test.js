const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

// Small battlefield: one room, creeps on a grid, intents recorded per creep.
function battlefield() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    g.BOOSTS = {
        attack: { XUH2O: { attack: 4 } },
        ranged_attack: { XKHO2: { rangedAttack: 4, rangedMassAttack: 4 } },
        heal: { XLHO2: { heal: 4, rangedHeal: 4 } },
        tough: { XGHO2: { damage: 0.3 } },
    };
    const searches = [];
    g.PathFinder = { search: (origin, goals, opts) => { searches.push({ goals: goals.length, flee: opts.flee }); return { path: [pos(origin.x - 1, origin.y)] }; } };
    const ramparts = new Set();
    const mine = [], theirs = [];
    const room = { name: 'R', controller: undefined, find(type) {
        if (type === g.FIND_HOSTILE_CREEPS) return theirs;
        if (type === g.FIND_MY_CREEPS) return mine;
        return [];
    } };
    g.Game.rooms.R = room;
    g.Game.rooms.HOME = { name: 'HOME', find: () => [] };
    function pos(x, y, roomName = 'R') {
        return { x, y, roomName,
            getRangeTo: o => { const p = o.pos || o; return Math.max(Math.abs(p.x - x), Math.abs(p.y - y)); },
            inRangeTo(o, r) { return this.getRangeTo(o) <= r; },
            isNearTo(o) { return this.getRangeTo(o) <= 1; },
            isEqualTo: o => (o.pos || o).x === x && (o.pos || o).y === y,
            getDirectionTo: () => 7,
            findInRange: (type, r) => (type === g.FIND_MY_CREEPS ? mine : theirs).filter(c => Math.max(Math.abs(c.pos.x - x), Math.abs(c.pos.y - y)) <= r),
            lookFor: () => ramparts.has(x + ',' + y) ? [{ structureType: g.STRUCTURE_RAMPART }] : [],
        };
    }
    let nextId = 0;
    function unit(owner, parts, x, y, extra = {}) {
        const body = [];
        for (const [type, count, boost] of parts) for (let i = 0; i < count; i++) body.push({ type, hits: 100, boost });
        const hitsMax = body.length * 100;
        const creep = Object.assign({ id: owner + (nextId++), name: owner + nextId, owner: { username: owner }, body, hits: hitsMax, hitsMax,
            pos: pos(x, y), room, memory: { homeRoom: 'HOME' }, intents: [] }, extra);
        for (const method of ['attack', 'rangedAttack', 'rangedMassAttack', 'heal', 'rangedHeal', 'move', 'travelTo', 'say']) {
            creep[method] = (...args) => { creep.intents.push([method, ...args.map(a => a && a.id || a)]); return g.OK; };
        }
        (owner === 'me' ? mine : theirs).push(creep);
        return creep;
    }
    const W = g.WORK, A = g.ATTACK, R = g.RANGED_ATTACK, H = g.HEAL, M = g.MOVE, T = g.TOUGH;
    return { h, g, room, unit, pos, ramparts, searches, mine, theirs, parts: { W, A, R, H, M, T },
        intel: h.load('combat.intel'), tactics: h.load('combat.tactics') };
}

test('assessment counts only working parts and applies boosts', () => {
    const { unit, intel, parts: { A, R, H, T, M } } = battlefield();
    const enemy = unit('foe', [[T, 2, 'XGHO2'], [A, 2, 'XUH2O'], [R, 1], [H, 1], [M, 2]], 10, 10);
    enemy.body[2].hits = 0; // one ATTACK part destroyed
    const stats = intel.assess(enemy);
    assert.equal(stats.melee, 30 * 4, 'only the surviving boosted ATTACK part counts');
    assert.equal(stats.ranged, 10);
    assert.equal(stats.heal, 12);
    assert.ok(Math.abs(stats.ehp - (200 / 0.3 + 500)) < 1e-6, 'boosted TOUGH absorbs ~3.3x its hits');
});

test('room verdict weighs numbers, healing and damage on both sides', () => {
    const { intel } = battlefield();
    const side = (dps, heal, ehp) => ({ dps, heal, ehp });
    assert.equal(intel.verdictFor(side(300, 0, 3000), side(60, 0, 1000)), 'win');
    assert.equal(intel.verdictFor(side(60, 0, 1000), side(300, 0, 3000)), 'lose');
    assert.equal(intel.verdictFor(side(100, 0, 1000), side(100, 0, 1000)), 'even');
    assert.equal(intel.verdictFor(side(50, 0, 1000), side(30, 60, 1000)), 'lose', 'their healing outpaces our damage');
    assert.equal(intel.verdictFor(side(50, 0, 1000), side(0, 0, 500)), 'win', 'unarmed hostiles');
});

test('focus fire prefers healers and killable targets, skips ramparts and bait', () => {
    const { unit, room, intel, parts: { A, R, H, M, T } } = battlefield();
    unit('me', [[R, 10], [M, 10]], 20, 20, { memory: { priority: 'farGuard', homeRoom: 'HOME' } });
    const brawler = unit('foe', [[T, 10, 'XGHO2'], [A, 10], [M, 10]], 22, 20);
    const healer = unit('foe', [[H, 5], [M, 5]], 24, 20);
    assert.equal(intel.focusTarget(room).id, healer.id, 'healer behind a boosted tank, before the closer tank');

    const finish = battlefield();
    finish.unit('me', [[finish.parts.R, 10], [finish.parts.M, 10]], 20, 20, { memory: { priority: 'farGuard', homeRoom: 'HOME' } });
    finish.unit('foe', [[finish.parts.H, 5], [finish.parts.M, 5]], 22, 20);
    const weak = finish.unit('foe', [[finish.parts.A, 1]], 27, 20); // out of its healer's reach
    assert.equal(finish.intel.focusTarget(finish.room).id, weak.id, 'a target we can kill this tick comes first');

    const next = battlefield();
    next.unit('me', [[next.parts.R, 10], [next.parts.M, 10]], 20, 20, { memory: { priority: 'farGuard', homeRoom: 'HOME' } });
    const hidden = next.unit('foe', [[next.parts.H, 5], [next.parts.M, 5]], 21, 20);
    const bait = next.unit('foe', [[next.parts.A, 5], [next.parts.M, 5]], 22, 20, { name: 'TANK_1' });
    const real = next.unit('foe', [[next.parts.A, 2], [next.parts.M, 2]], 25, 20);
    next.ramparts.add('21,20');
    assert.equal(next.intel.focusTarget(next.room).id, real.id, 'rampart-covered and TANK bait are passed over');
    assert.ok(brawler && bait && hidden);
});

test('ranged fighter pre-heals and shoots in the same tick, never attack+heal', () => {
    const { unit, tactics, parts: { R, H, M } } = battlefield();
    const me = unit('me', [[R, 10], [H, 5], [M, 15]], 20, 20, { memory: { priority: 'ranger', homeRoom: 'HOME' } });
    const foe = unit('foe', [[R, 4], [M, 4]], 23, 20);
    tactics.act(me, me.room, foe);
    assert.deepEqual(plain(me.intents), [['heal', me.id], ['rangedAttack', foe.id]],
        'full-health creep under fire heals itself (cancels incoming) while shooting');
});

test('several adjacent enemies trigger rangedMassAttack; melee hits unless healing is urgent', () => {
    const { unit, tactics, parts: { A, R, H, M } } = battlefield();
    const me = unit('me', [[A, 5], [R, 5], [H, 2], [M, 12]], 20, 20, { memory: { priority: 'farGuard', homeRoom: 'HOME' } });
    const a = unit('foe', [[M, 2]], 21, 20), b = unit('foe', [[M, 2]], 19, 20), c = unit('foe', [[M, 2]], 20, 21);
    tactics.act(me, me.room, a);
    assert.deepEqual(plain(me.intents), [['attack', a.id], ['rangedMassAttack']]);

    me.intents.length = 0;
    me.hits = 300; // badly hurt: heal wins the shared pipeline
    tactics.act(me, me.room, a);
    assert.deepEqual(plain(me.intents.map(i => i[0])), ['heal', 'rangedMassAttack']);
    assert.ok(b && c);
});

test('outmatched fighters retreat from every threat, regroup and request reinforcements', () => {
    const { g, unit, tactics, searches, parts: { A, R, M } } = battlefield();
    const me = unit('me', [[A, 3], [M, 3]], 20, 20, { memory: { priority: 'farGuard', homeRoom: 'HOME' } });
    unit('foe', [[A, 10], [M, 10]], 22, 20);
    unit('foe', [[R, 10], [M, 10]], 18, 22);
    assert.equal(tactics.fight(me), true);
    assert.deepEqual(searches, [{ goals: 2, flee: true }], 'one flee search away from both threats');
    assert.ok(me.memory.regroupUntil > g.Game.time);
    assert.ok(g.Memory.FarRoomsOutmatched.R > g.Game.time, 'spawner will send a second guard');
    assert.ok(g.Memory.FarRoomsUnderAttack.includes('R'));
});

test('kiters back away from melee in reach instead of trading blows', () => {
    const { unit, tactics, searches, parts: { A, R, H, M } } = battlefield();
    const me = unit('me', [[R, 15], [H, 5], [M, 20]], 20, 20, { memory: { priority: 'ranger', homeRoom: 'HOME' } });
    const melee = unit('foe', [[A, 2], [M, 2]], 22, 20);
    tactics.fight(me);
    assert.equal(searches.length, 1, 'flee from the melee creep');
    assert.ok(me.intents.some(i => i[0] === 'rangedAttack' && i[1] === melee.id), 'still shooting while backing off');
});

test('civilians flee armed hostiles and wait outside rooms we are losing', () => {
    const { g, unit, pos, tactics, intel, parts: { A, W, M } } = battlefield();
    const miner = unit('me', [[W, 5], [M, 3]], 20, 20, { memory: { priority: 'farMiner', homeRoom: 'HOME' } });
    unit('foe', [[A, 5], [M, 5]], 21, 20);
    assert.equal(tactics.avoidDanger(miner, 'R'), true, 'steps out of reach');

    // Elsewhere, heading for the dangerous room: hold at the border instead of entering.
    const hauler = unit('me', [[M, 2]], 0, 25, { memory: { priority: 'farMule', homeRoom: 'HOME' } });
    hauler.room = g.Game.rooms.HOME;
    hauler.pos = pos(0, 25, 'HOME');
    assert.ok(intel.isDangerous('R'));
    assert.equal(tactics.avoidDanger(hauler, 'R'), true);
    assert.deepEqual(plain(hauler.intents), [['move', g.RIGHT]]);
});

test('ranger no longer throws when the nearest enemy stands on a rampart', () => {
    const { g, h, unit, ramparts, parts: { R, M, H } } = battlefield();
    const ranger = h.load('creep.ranger');
    const me = unit('me', [[R, 10], [H, 2], [M, 12]], 20, 20, { memory: { priority: 'ranger', homeRoom: 'HOME', destination: 'R', previousRoom: 'R' } });
    unit('foe', [[R, 1], [M, 1]], 22, 20);
    ramparts.add('22,20');
    g.Game.flags = {};
    me.room.controller = undefined;
    assert.doesNotThrow(() => ranger.run(me));
    assert.ok(me.intents.some(i => i[0] === 'rangedMassAttack'), 'hits the rampart-covered enemy with mass attack instead');
});
