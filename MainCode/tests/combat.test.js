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

test('against ranged-only attackers a winning ranged fighter closes to range 1 instead of stopping at 3', () => {
    const { unit, tactics, parts: { A, R, H, M } } = battlefield();
    const me = unit('me', [[R, 15], [H, 5], [M, 20]], 20, 20, { memory: { priority: 'ranger', homeRoom: 'HOME' } });
    unit('foe', [[R, 1], [M, 1]], 23, 20);
    tactics.fight(me);
    assert.ok(me.intents.some(i => i[0] === 'move'), 'steps in from range 3');
    // With a melee attacker in the room it keeps its distance at 3.
    const b = battlefield();
    const me2 = b.unit('me', [[R, 15], [H, 5], [M, 20]], 20, 20, { memory: { priority: 'ranger', homeRoom: 'HOME' } });
    b.unit('foe', [[R, 1], [M, 1]], 23, 20);
    b.unit('foe', [[A, 1], [M, 1]], 40, 40);
    b.tactics.fight(me2);
    assert.ok(!me2.intents.some(i => i[0] === 'move' || i[0] === 'travelTo'));
});

test('against a healed focus: a single shot from range 2-3, mass attack from range 1 (full damage on it, some on the rest)', () => {
    const { unit, tactics, parts: { R, H, M } } = battlefield();
    const me = unit('me', [[R, 10], [M, 10]], 20, 20, { memory: { priority: 'defender', homeRoom: 'HOME' } });
    const focus = unit('foe', [[R, 2], [M, 2]], 22, 20);
    unit('foe', [[H, 10], [M, 10]], 23, 20);        // its healer beside it
    tactics.act(me, me.room, focus);
    assert.deepEqual(plain(me.intents).filter(i => i[0].startsWith('ranged')), [['rangedAttack', focus.id]], 'range 2: all of it on the focus');
    const near = battlefield();
    const me1 = near.unit('me', [[R, 10], [M, 10]], 21, 20, { memory: { priority: 'defender', homeRoom: 'HOME' } });
    const focus1 = near.unit('foe', [[R, 2], [M, 2]], 22, 20);
    near.unit('foe', [[H, 10], [M, 10]], 23, 20);
    near.tactics.act(me1, me1.room, focus1);
    assert.deepEqual(plain(me1.intents).filter(i => i[0].startsWith('ranged')).map(i => i[0]), ['rangedMassAttack'], 'range 1: mass attack');
});

// shardX E23N31: a second squad, mostly WORK, on the ramparts; the rangers doing the damage elsewhere.
test('a creep taking our walls down is the focus, ahead of the easier, harder-hitting targets', () => {
    const b = battlefield();
    const { unit, room, intel, g, parts: { W, R, M, H } } = b;
    room.controller = { my: true };
    const rampart = { structureType: g.STRUCTURE_RAMPART, my: true, pos: b.pos(30, 30) };
    room.find = (type => (type === g.FIND_STRUCTURES ? [rampart] : type === g.FIND_HOSTILE_CREEPS ? b.theirs : type === g.FIND_MY_CREEPS ? b.mine : []));
    unit('me', [[R, 10], [M, 10]], 20, 20, { memory: { priority: 'farGuard', homeRoom: 'HOME' } });
    const ranger = unit('foe', [[R, 10], [M, 5]], 22, 20);                       // fragile, hits hard
    const breaker = unit('foe', [[W, 20, 'XZH2O'], [H, 4], [M, 10]], 31, 31);    // next to the rampart
    g.BOOSTS.work = { XZH2O: { dismantle: 4 } };
    assert.equal(intel.wallThreat(breaker, room) > 0, true);
    assert.equal(intel.focusTarget(room).id, breaker.id);
    assert.equal(intel.wallThreat(ranger, room), 0, 'rangers do not count');
});

test('a dismantler away from the walls is not put first; with no weapon it is still a threat at home, not elsewhere', () => {
    const b = battlefield();
    const { unit, room, intel, g, parts: { W, R, M } } = b;
    room.controller = { my: true };
    const rampart = { structureType: g.STRUCTURE_RAMPART, my: true, pos: b.pos(30, 30) };
    room.find = (type => (type === g.FIND_STRUCTURES ? [rampart] : type === g.FIND_HOSTILE_CREEPS ? b.theirs : type === g.FIND_MY_CREEPS ? b.mine : []));
    unit('me', [[R, 10], [M, 10]], 20, 20, { memory: { priority: 'farGuard', homeRoom: 'HOME' } });
    const ranger = unit('foe', [[R, 10], [M, 5]], 22, 20);
    const walker = unit('foe', [[W, 20], [M, 10]], 40, 40);
    assert.equal(intel.wallThreat(walker, room), 0);
    assert.equal(intel.focusTarget(room).id, ranger.id);
    assert.ok(intel.roomIntel(room).threats.includes(walker), 'at home: a threat');
    const away = battlefield();
    away.unit('foe', [[away.parts.W, 5], [away.parts.M, 5]], 10, 10);
    assert.equal(away.intel.roomIntel(away.room).threats.length, 0, 'a remote harvester is not');
});

test('fleeing costs swamp by the creep\'s own legs: a slow or loaded creep keeps out of it', () => {
    const { tactics, g, parts: { W, M } } = battlefield();
    const C = g.CARRY;
    const body = list => list.flatMap(([t, n]) => Array.from({ length: n }, () => ({ type: t, hits: 100 })));
    const fast = { body: body([[W, 5], [M, 5]]), store: { getUsedCapacity: () => 0 } };
    const slow = { body: body([[W, 10], [M, 2]]), store: { getUsedCapacity: () => 0 } };
    const emptyHauler = { body: body([[C, 10], [M, 5]]), store: { getUsedCapacity: () => 0 } };
    const fullHauler = { body: body([[C, 10], [M, 5]]), store: { getUsedCapacity: () => 500 } };
    assert.deepEqual(plain(tactics.terrainCosts(fast)), { plainCost: 2, swampCost: 10 }, '1:1 MOVE: a tick on plain, 5 on swamp');
    const s = tactics.terrainCosts(slow);
    assert.ok(s.swampCost >= 50 && s.plainCost >= 10, 'few MOVE: swamp far dearer: ' + JSON.stringify(plain(s)));
    assert.deepEqual(plain(tactics.terrainCosts(emptyHauler)), { plainCost: 2, swampCost: 2 }, 'empty CARRY weighs nothing');
    assert.ok(tactics.terrainCosts(fullHauler).swampCost > 2, 'a full load does');
    const boosted = { body: body([[W, 10]]).concat([{ type: M, hits: 100, boost: 'XZHO2' }, { type: M, hits: 100, boost: 'XZHO2' }]), store: { getUsedCapacity: () => 0 } };
    g.BOOSTS[M] = { XZHO2: { fatigue: 4 } };
    assert.ok(tactics.terrainCosts(boosted).swampCost < s.swampCost, 'boosted MOVE counts for more');
});

test('wall damage seen in the event log counts: a ranger firing at the ramparts is a wall threat, and it fades once it stops', () => {
    const b = battlefield();
    const { unit, room, intel, g, parts: { R, M } } = b;
    room.controller = { my: true };
    g.EVENT_ATTACK = 1;
    const rampart = { id: 'ramp', structureType: g.STRUCTURE_RAMPART, my: true, pos: b.pos(30, 30) };
    room.find = (type => (type === g.FIND_STRUCTURES ? [rampart] : type === g.FIND_HOSTILE_CREEPS ? b.theirs : type === g.FIND_MY_CREEPS ? b.mine : []));
    const ranger = unit('foe', [[R, 10], [M, 5]], 33, 30);
    g.Game.getObjectById = id => (id === 'ramp' ? rampart : null);
    let log = [{ event: g.EVENT_ATTACK, objectId: ranger.id, data: { targetId: 'ramp', damage: 400 } }];
    room.getEventLog = () => log;
    g.Game.time = 100;
    assert.equal(intel.wallThreat(ranger, room), 400);
    log = [];
    g.Game.time = 103;
    assert.ok(Math.abs(intel.wallThreat(ranger, room) - 200) < 1, 'halved after 3 quiet ticks');
    g.Game.time = 130;
    assert.equal(intel.wallThreat(ranger, room), 0, 'gone');
});
