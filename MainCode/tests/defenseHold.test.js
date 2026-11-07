const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

function base() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.CONTROLLER_DOWNGRADE = { 6: 120000, 7: 150000, 8: 200000 };
    return { h, g };
}

test('under attack, no energy into the controller unless its timer is under half (safe mode stays available)', () => {
    const { h, g } = base();
    const m = h.load('system.maintenance');
    const room = { name: 'W1N9', controller: { my: true, level: 7, ticksToDowngrade: 140000 } };
    assert.equal(m.attackHold(room), false, 'not under attack');
    g.Memory.roomsUnderAttack = ['W1N9'];
    assert.equal(m.attackHold(room), true);
    room.controller.ticksToDowngrade = 74000;
    assert.equal(m.attackHold(room), false, 'critical: upgrade to keep safe mode');
});

test('a held upgrader does nothing (no withdraw, no upgrade)', () => {
    const { h, g } = base();
    g.Memory.roomsUnderAttack = ['W1N9'];
    const calls = [];
    const room = { name: 'W1N9', controller: { my: true, level: 7, ticksToDowngrade: 140000 } };
    const creep = { room, ticksToLive: 1000, memory: { priority: 'upgrader', deathWarn: 0, homeRoom: 'W1N9' },
        store: { energy: 50 }, getActiveBodyparts: () => 10,
        upgradeController: () => calls.push('upgrade'), withdraw: () => calls.push('withdraw'), travelTo: () => calls.push('move') };
    h.load('creep.upgrader').run(creep);
    assert.deepEqual(plain(calls), []);
});

test('young-room defenders take no HEAL where towers stand', () => {
    const { h, g } = base();
    const bodies = h.load('combat.bodies');
    assert.ok(bodies.youngDefender(1700).includes(g.HEAL));
    const noHeal = bodies.youngDefender(1700, false);
    assert.ok(!noHeal.includes(g.HEAL));
    assert.equal(noHeal.filter(p => p === g.RANGED_ATTACK).length, 8, 'the HEAL money buys ranged parts');
});

test('a defender that gets no closer to its post passes it over and picks a free one it can reach', () => {
    const { h, g } = base();
    const combat = h.load('creep.combat');
    g.Game.time = 100;
    // W1N9: 23,7 held by another defender; the best free post 24,6 is only reachable through it.
    const other = { id: 'b', pos: { x: 23, y: 7 }, memory: { priority: 'defender', atSpot: true } };
    const creep = { id: 'a', pos: { x: 22, y: 8, findClosestByRange: list => list[0] }, memory: { priority: 'defender' } };
    const room = { name: 'W1N9', find: type => (type === g.FIND_MY_CREEPS ? [other, creep] : []) };
    const posts = [{ x: 23, y: 7 }, { x: 24, y: 6 }, { x: 21, y: 7 }];
    const intel = { threats: [{ pos: { x: 24, y: 4 } }], hostiles: [] };
    const pick = () => {
        g.Game.time++;
        h.load('runtime.cache').current().rampartPosts = { W1N9: { posts, claimed: new Set(), keys: new Set(posts.map(p => p.x * 50 + p.y)) } };
        return plain(combat.choosePost(creep, room, posts, intel, null));
    };
    const first = pick();
    assert.ok(!(first.x === 23 && first.y === 7), 'not the held one');
    for (let i = 0; i <= combat.POST_STUCK; i++) combat.notePostProgress(creep, pick());
    const next = pick();
    assert.ok(!(next.x === first.x && next.y === first.y), 'the post it got no closer to is passed over');
});

test('defenders choose posts by attackers inside the room, not by ones on the border; only hoppers left: the last anchor', () => {
    const { h, g } = base();
    const combat = h.load('creep.combat');
    g.Game.time = 100;
    const creep = { id: 'a', pos: { x: 20, y: 10, findClosestByRange: list => list[0] }, memory: { priority: 'defender' } };
    const room = { name: 'W1N9', find: type => (type === g.FIND_MY_CREEPS ? [creep] : []) };
    const posts = [{ x: 23, y: 12 }, { x: 25, y: 3 }];
    const front = { pos: { x: 25, y: 14 } }, back = { pos: { x: 25, y: 0 } };
    const pick = (intel, focus) => {
        g.Game.time++;
        h.load('runtime.cache').current().rampartPosts = { W1N9: { posts, claimed: new Set(), keys: new Set(posts.map(p => p.x * 50 + p.y)) } };
        return plain(combat.choosePost(creep, room, posts, intel, focus));
    };
    assert.deepEqual(pick({ threats: [front, back], hostiles: [] }, back), { x: 23, y: 12 }, 'the back half on the border is not the anchor');
    assert.deepEqual(pick({ threats: [back], hostiles: [] }, back), { x: 23, y: 12 }, 'only the hopper in the room: stays by the last anchor');
});

test('under attack only for armed hostiles; rooms no longer ours drop off the attack lists', () => {
    const { h, g } = base();
    const defense = h.load('system.defense');
    assert.equal(defense.armedHostile({ body: [{ type: g.MOVE, hits: 100 }] }), false, 'a 1-MOVE scout (E32N45)');
    assert.equal(defense.armedHostile({ body: [{ type: g.WORK, hits: 100 }] }), true);
    assert.equal(defense.armedHostile({ body: [{ type: g.RANGED_ATTACK, hits: 0 }, { type: g.MOVE, hits: 100 }] }), false, 'its weapons shot off');
    const tower = { structureType: g.STRUCTURE_TOWER, my: true };
    const quad = { owner: { username: 'Harabi' }, body: [{ type: g.RANGED_ATTACK, hits: 100 }] };
    g.Game.rooms = { W1N9: { name: 'W1N9', controller: { my: true }, find: t => (t === g.FIND_MY_STRUCTURES ? [tower] : []) },
        W1N7: { name: 'W1N7', controller: { my: false }, find: () => [] },
        W2N22: { name: 'W2N22', controller: { my: true }, find: () => [] },                                   // a decoy, no tower, quiet
        W1N22: { name: 'W1N22', controller: { my: true }, find: t => (t === g.FIND_HOSTILE_CREEPS ? [quad] : []) } }; // no tower, a quad in it
    g.Memory.roomsUnderAttack = ['W1N9', 'W1N7', 'E21N19', 'W2N22', 'W1N22'];
    g.Memory.roomsPrepSalvager = ['E21N19'];
    defense.pruneAttackLists();
    assert.deepEqual(plain(g.Memory.roomsUnderAttack), ['W1N9', 'W1N22'], 'lost, out-of-sight and quiet tower-less rooms go');
    assert.deepEqual(plain(g.Memory.roomsPrepSalvager), []);
});

// shardX E23N31: chasing the attackers along the ramparts, as a line.
function chaseCase({ defenders, posts, threats, terrain = () => 0, structures = [], others = [], outsideTiles = new Uint8Array(2500) }) {
    const { h, g } = base();
    const combat = h.load('creep.combat');
    g.Game.time = 500;
    g.TERRAIN_MASK_WALL = 1;
    h.load('combat.intel').assess = t => t.stats || { ranged: 0, melee: 0 };
    h.load('system.safeMode').flood = () => ({ open: false, outside: outsideTiles });
    const room = { name: 'E23N31', getTerrain: () => ({ get: terrain }),
        find: type => (type === g.FIND_MY_CREEPS ? defenders : type === g.FIND_CREEPS ? defenders.concat(others) : type === g.FIND_STRUCTURES ? structures : []) };
    const plan = () => {
        g.Game.time++;
        h.load('runtime.cache').current().rampartPosts = { E23N31: { posts, claimed: new Set(), keys: new Set(posts.map(p => p.x * 50 + p.y)) } };
        const p = combat.planPosts(room, posts, { threats, hostiles: threats }, null);
        return Object.fromEntries([...p].map(([id, t]) => [id, plain(t)]));
    };
    return { plan, g, h };
}
const defender = (id, x, y, hits = 3000) => ({ id, my: true, hits, pos: { x, y }, memory: { priority: 'defender' } });

test('a line of defenders runs along the ramparts after the enemy, each a step, not the far one past the others', () => {
    // Ramparts along y=10 from x=10 to 20; three defenders on 13, 14, 15; the enemy moves to x=19, y=7 (range 4 from 15).
    const posts = Array.from({ length: 11 }, (_, i) => ({ x: 10 + i, y: 10 }));
    const a = defender('a', 13, 10), b = defender('b', 14, 10), c = defender('c', 15, 10);
    const enemy = { pos: { x: 19, y: 7 }, stats: { ranged: 100, melee: 0 } };
    const { plan } = chaseCase({ defenders: [a, b, c], posts, threats: [enemy], others: [enemy] });
    const p = plan();
    assert.deepEqual(p.c, { x: 16, y: 10 }, 'the front one steps up');
    assert.deepEqual(p.b, { x: 17, y: 10 });
    assert.deepEqual(p.a, { x: 18, y: 10 });
    for (const t of Object.values(p)) assert.ok(!t.open, 'all on ramparts');
});

test('in range a defender holds its rampart; no shuffling', () => {
    const posts = [{ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 12, y: 10 }];
    const a = defender('a', 10, 10);
    const { plan } = chaseCase({ defenders: [a], posts, threats: [{ pos: { x: 12, y: 7 }, stats: { ranged: 100, melee: 0 } }] });
    assert.deepEqual(plan().a, { x: 10, y: 10 });
});

test('with no rampart in range, an open tile no hostile can hit (or one it can tank) gets it in range', () => {
    // Ramparts far from the enemy; it only shoots range 1 (melee), so tiles at range 2-3 are safe.
    const posts = [{ x: 5, y: 5 }];
    const a = defender('a', 5, 5);
    const melee = { pos: { x: 30, y: 30 }, stats: { ranged: 0, melee: 300 } };
    const { plan } = chaseCase({ defenders: [a], posts, threats: [melee], others: [melee] });
    const t = plan().a;
    assert.equal(t.open, true);
    assert.ok(Math.max(Math.abs(t.x - 30), Math.abs(t.y - 30)) >= 2 && Math.max(Math.abs(t.x - 30), Math.abs(t.y - 30)) <= 3, 'in range, out of its reach');
});

test('never onto open ground it cannot survive; out of range it keeps to the ramparts, nearest the enemy', () => {
    const posts = [{ x: 5, y: 5 }, { x: 8, y: 8 }];
    const weak = defender('a', 5, 5, 500);
    const quad = { pos: { x: 30, y: 30 }, stats: { ranged: 400, melee: 0 } };
    const { plan } = chaseCase({ defenders: [weak], posts, threats: [quad] });
    assert.deepEqual(plan().a, { x: 8, y: 8 }, 'every open tile in range is in its reach: the rampart nearest it');
});

test('open tiles skip walls, structures and other creeps', () => {
    const posts = [{ x: 5, y: 5 }];
    const a = defender('a', 5, 5);
    const melee = { pos: { x: 30, y: 30 }, stats: { ranged: 0, melee: 300 } };
    const wall = (x, y) => (x !== 27 || y !== 27 ? 1 : 0);   // only 27,27 is open ground
    let c = chaseCase({ defenders: [a], posts, threats: [melee], terrain: wall });
    assert.deepEqual(c.plan().a, { x: 27, y: 27, open: true });
    c = chaseCase({ defenders: [a], posts, threats: [melee], terrain: wall, others: [{ my: false, pos: { x: 27, y: 27 } }] });
    assert.deepEqual(c.plan().a, { x: 5, y: 5 }, 'taken: back to the rampart');
});

test('never an open tile outside the ring: with only those in range, it keeps to the ramparts', () => {
    const posts = [{ x: 5, y: 5 }];
    const a = defender('a', 5, 5);
    const melee = { pos: { x: 30, y: 30 }, stats: { ranged: 0, melee: 300 } };
    const out = new Uint8Array(2500);
    for (let x = 25; x <= 35; x++) for (let y = 25; y <= 35; y++) out[x * 50 + y] = 1;   // the enemy and all round it: outside
    const { plan } = chaseCase({ defenders: [a], posts, threats: [melee], others: [melee], outsideTiles: out });
    assert.deepEqual(plan().a, { x: 5, y: 5 });
});

test('a ring not closed: no open tiles at all, ramparts only', () => {
    const posts = [{ x: 5, y: 5 }];
    const a = defender('a', 5, 5);
    const melee = { pos: { x: 30, y: 30 }, stats: { ranged: 0, melee: 300 } };
    const c = chaseCase({ defenders: [a], posts, threats: [melee], others: [melee] });
    c.h.load('system.safeMode').flood = () => ({ open: true, outside: new Uint8Array(2500) });
    c.g.Game.time += 10;
    assert.deepEqual(c.plan().a, { x: 5, y: 5 });
});

// Breakers on the controller's walls, outside the base ring.
function sortieCase({ threats, defenders, outside = true, wallsAt = [[30, 31]], confirmed = true }) {
    const { h, g } = base();
    const combat = h.load('creep.combat');
    const ci = h.load('combat.intel');
    g.Game.time = 1000;
    const out = new Uint8Array(2500);
    if (outside) for (let x = 25; x <= 40; x++) for (let y = 25; y <= 40; y++) out[x * 50 + y] = 1;
    h.load('system.safeMode').flood = () => ({ open: false, outside: out });
    ci.assess = t => t.stats;
    ci.wallThreat = t => t.wall || 0;
    const walls = wallsAt.map(([x, y]) => ({ structureType: g.STRUCTURE_WALL, pos: { x, y } }));
    const room = { name: 'R', controller: { my: true, pos: { x: 30, y: 30 } },
        find: type => (type === g.FIND_STRUCTURES ? walls : type === g.FIND_MY_CREEPS ? defenders : []) };
    const intel = { threats, hostiles: threats };
    const at = () => {
        if (confirmed) { g.Game.time++; combat.sortieTarget(room, intel); g.Game.time += 6; }
        g.Game.time++;
        return combat.sortieTarget(room, intel);
    };
    return { at, combat, room, intel, g };
}
const foe = (x, y, stats, wall = 0) => ({ pos: { x, y }, stats: Object.assign({ melee: 0, ranged: 0, heal: 0, ehp: 3000, dps: 0 }, stats), wall });
const def = n => Array.from({ length: n }, (_, i) => ({ id: 'd' + i, memory: { priority: 'defender' }, stats: { dps: 400, heal: 0, ehp: 4000, melee: 0, ranged: 400 } }));

test('sortie: breakers on the controller walls, alone in the room, outside the ring: go after the fastest', () => {
    const slow = foe(31, 32, { dps: 0, heal: 0 }, 200), fast = foe(29, 32, { dps: 0 }, 800);
    const cover = foe(32, 34, { ranged: 100, dps: 100, heal: 100 });
    const s = sortieCase({ threats: [slow, fast, cover], defenders: def(3) });
    assert.equal(s.at(), fast);
});

test('sortie: never with another armed group in the room, never inside the ring, never on passing fire, never outmatched', () => {
    const breaker = foe(31, 32, {}, 800);
    const raiders = foe(10, 10, { ranged: 300, dps: 300 });
    assert.equal(sortieCase({ threats: [breaker, raiders], defenders: def(3) }).at(), null, 'a second group elsewhere');
    assert.equal(sortieCase({ threats: [breaker], defenders: def(3), outside: false }).at(), null, 'the controller is inside the ring');
    const passing = foe(31, 32, { ranged: 200, dps: 200 }, 0);
    assert.equal(sortieCase({ threats: [passing], defenders: def(3) }).at(), null, 'rangers firing as they pass');
    const far = foe(36, 36, {}, 800);
    assert.equal(sortieCase({ threats: [far], defenders: def(3) }).at(), null, 'breaking some other wall');
    const big = foe(31, 32, { heal: 5000, dps: 2000, ehp: 50000 }, 800);
    assert.equal(sortieCase({ threats: [big], defenders: def(2) }).at(), null, 'they would lose');
    assert.equal(sortieCase({ threats: [breaker], defenders: def(3), confirmed: false }).at(), null, 'not on the first tick it is seen');
});

test('skirmish: fire in range and step back out of reach; out of range, close to 3; badly hurt, back to the ring', () => {
    const { h, g } = base();
    const combat = h.load('creep.combat');
    const tactics = h.load('combat.tactics');
    h.load('combat.intel').assess = t => t.stats;
    const calls = [];
    tactics.act = () => calls.push('fire');
    tactics.flee = (c, list) => { calls.push('flee:' + list.length); return true; };
    const target = foe(30, 32, {}, 800);
    const ranger = foe(31, 33, { ranged: 200, dps: 200 });
    const intel = { threats: [target, ranger] };
    const creep = { hits: 4000, hitsMax: 4000, pos: { x: 30, y: 35 }, memory: {}, travelTo: () => calls.push('close') };
    assert.equal(combat.skirmish(creep, {}, intel, target), true);
    assert.deepEqual(calls, ['fire', 'flee:1']);
    calls.length = 0;
    creep.pos = { x: 30, y: 40 };
    combat.skirmish(creep, {}, intel, target);
    assert.deepEqual(calls, ['close', 'fire']);
    creep.hits = 1500;
    assert.equal(combat.skirmish(creep, {}, intel, target), false, 'under half: the ring');
});

// shardX E23N31: wall-breakers pushed off one side, a ranged squad parked on the walls at the other.
function coverCase({ defenders, threats, rates }) {
    const { h, g } = base();
    const combat = h.load('creep.combat');
    const ci = h.load('combat.intel');
    g.Game.time = 2000;
    ci.wallThreat = t => rates[t.id] || 0;
    ci.assess = () => ({ dps: 440 });
    ci.supportHealing = () => 0;   // one defender beats any of these
    const room = { name: 'R', find: type => (type === g.FIND_MY_CREEPS ? defenders : []) };
    return () => { g.Game.time++; return combat.coverPlan(room, { threats, hostiles: threats }); };
}
const hostile = (id, x, y) => ({ id, pos: { x, y } });
const guard = (id, x, y, cover) => ({ id, pos: { x, y }, memory: { priority: 'defender', cover } });

test('split cover: defenders shared out by wall damage, one each at least, nearest first', () => {
    const breakers = [hostile('b1', 10, 10), hostile('b2', 11, 10)];
    const rangers = [hostile('r1', 40, 40), hostile('r2', 41, 40)];
    const defs = [guard('d1', 12, 14), guard('d2', 13, 14), guard('d3', 38, 36), guard('d4', 20, 20)];
    const plan = coverCase({ defenders: defs, threats: breakers.concat(rangers), rates: { b1: 800, b2: 600, r1: 300, r2: 0 } })();
    const toBreakers = defs.filter(d => plan.get(d.id) === breakers[0]).map(d => d.id);
    const toRangers = defs.filter(d => plan.get(d.id) === rangers[0]).map(d => d.id);
    assert.equal(toBreakers.length, 3, 'most wall damage: most defenders');
    assert.deepEqual(toRangers, ['d3'], 'the nearest one covers the rangers');
});

test('split cover keeps a defender on its group, and stays out of it with one group or one defender', () => {
    const breakers = [hostile('b1', 10, 10)], rangers = [hostile('r1', 40, 40)];
    const defs = [guard('d1', 39, 39, 'b1'), guard('d2', 12, 12)];
    const plan = coverCase({ defenders: defs, threats: breakers.concat(rangers), rates: { b1: 800, r1: 300 } })();
    assert.equal(plan.get('d1'), breakers[0], 'kept on its group though the other is nearer');
    assert.equal(coverCase({ defenders: defs, threats: breakers, rates: { b1: 800 } })().size, 0, 'one group: the shared focus leads');
    assert.equal(coverCase({ defenders: [defs[0]], threats: breakers.concat(rangers), rates: { b1: 800, r1: 300 } })().size, 0, 'one defender');
    assert.equal(coverCase({ defenders: defs, threats: breakers.concat(rangers), rates: { b1: 800 } })().size, 0, 'only one group on the walls');
});

test('split cover: a group the defenders cannot beat gets none; with only one group beatable, no split', () => {
    const { h, g } = base();
    const combat = h.load('creep.combat');
    const ci = h.load('combat.intel');
    const staffing = h.load('defense.staffing');
    g.Game.time = 3000;
    const rates = { n1: 500, s1: 400 };
    ci.wallThreat = t => rates[t.id] || 0;
    ci.assess = c => ({ dps: 440 });
    let heal = { n1: 4000, n2: 4000, s1: 300, s2: 300 };
    ci.supportHealing = t => heal[t.id];
    staffing.toughFactor = () => 1;
    const north = [{ id: 'n1', pos: { x: 25, y: 15 } }, { id: 'n2', pos: { x: 26, y: 15 } }];
    const south = [{ id: 's1', pos: { x: 25, y: 28 } }, { id: 's2', pos: { x: 26, y: 28 } }];
    const defs = Array.from({ length: 6 }, (_, i) => ({ id: 'd' + i, pos: { x: 22, y: 16 + i * 3 }, memory: { priority: 'defender' } }));
    const room = { name: 'R', find: type => (type === g.FIND_MY_CREEPS ? defs : []) };
    const plan = () => { g.Game.time++; return combat.coverPlan(room, { threats: north.concat(south), hostiles: [] }); };
    // North heals 4,000 x 1.3: 12 defenders of 440; south 300 x 1.3: 1. Six defenders: only south is beatable.
    assert.equal(plan().size, 0, 'one group beatable: the shared focus leads');
    heal = { n1: 700, n2: 700, s1: 300, s2: 300 };
    const p = plan();
    const toNorth = defs.filter(d => p.get(d.id) === north[0]).length, toSouth = defs.filter(d => p.get(d.id) === south[0]).length;
    assert.ok(toNorth >= 3, 'north gets enough to beat 910 healing: ' + toNorth);
    assert.ok(toSouth >= 1);
    assert.equal(toNorth + toSouth, 6);
});

test('a free rampart next to the enemy beats holding a post at range 3: mass attack hits it in full', () => {
    const posts = [{ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 12, y: 10 }];
    const a = defender('a', 10, 10);
    const pair = [{ pos: { x: 12, y: 8 }, stats: { ranged: 100, melee: 0 } }, { pos: { x: 13, y: 9 }, stats: { ranged: 100, melee: 0 } }];
    const { plan } = chaseCase({ defenders: [a], posts, threats: pair, others: pair });
    assert.deepEqual(plan().a, { x: 12, y: 10 }, 'beside one of them');
});

test('the defenders in range fill the ramparts nearest the enemy: one on an inner rampart moves up and leaves it for the next', () => {
    // Ramparts in a column at x=10, y=10..14; the enemy at 13,8: 10,10 is range 3, 10,11 range 3, 10,12+ out of range.
    const posts = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }, { x: 11, y: 9 }];
    const inner = defender('in', 10, 11), late = defender('late', 10, 13);
    const enemy = { pos: { x: 13, y: 8 }, stats: { ranged: 100, melee: 0 } };
    const { plan } = chaseCase({ defenders: [inner, late], posts, threats: [enemy], others: [enemy] });
    const p = plan();
    assert.deepEqual(p.in, { x: 11, y: 9 }, 'moves up to the front rampart, range 2');
    assert.ok(Math.max(Math.abs(p.late.x - 13), Math.abs(p.late.y - 8)) <= 3, 'the newcomer gets an in-range one: ' + JSON.stringify(p.late));
});

// E23N31: the x=24 chain, entered at its north end; the attackers just east of it.
test('a chain of ramparts fills from its far end: the defender in the middle moves on, the entrance stays free', () => {
    const posts = [18, 19, 20, 21, 22].map(y => ({ x: 24, y }));
    const mid = defender('mid', 24, 20);
    // Rangers two tiles east: every open tile beside the chain is in their reach but the ones by its north end.
    const enemies = [{ pos: { x: 26, y: 21 }, stats: { ranged: 400, melee: 0 } }, { pos: { x: 26, y: 22 }, stats: { ranged: 400, melee: 0 } }];
    const { plan } = chaseCase({ defenders: [mid], posts, threats: enemies, others: enemies });
    const p = plan();
    assert.ok(p.mid.y >= 21, 'moves deeper, still beside them: ' + JSON.stringify(p.mid));
});

test('a boosted defender gets the front of the chain; the unboosted one on it steps back', () => {
    const posts = [18, 19, 20, 21, 22].map(y => ({ x: 24, y }));
    const plainOne = defender('plain', 24, 22), boosted = defender('boosted', 24, 19);
    plainOne.body = Array.from({ length: 11 }, () => ({ type: 'ranged_attack', hits: 100 }));
    boosted.body = Array.from({ length: 11 }, () => ({ type: 'ranged_attack', hits: 100, boost: 'XKHO2' }));
    const enemies = [{ pos: { x: 25, y: 23 }, stats: { ranged: 400, melee: 0 } }];
    const c = chaseCase({ defenders: [plainOne, boosted], posts, threats: enemies, others: enemies });
    c.g.RANGED_ATTACK = 'ranged_attack';
    const p = c.plan();
    assert.deepEqual(p.boosted, { x: 24, y: 22 }, 'the front, by the enemy');
    assert.notDeepEqual(p.plain, { x: 24, y: 22 });
});
