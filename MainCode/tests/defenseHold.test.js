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
    assert.deepEqual(pick(), { x: 24, y: 6 }, 'nearest the threat, not the held one');
    for (let i = 0; i <= combat.POST_STUCK; i++) combat.notePostProgress(creep, pick());
    assert.deepEqual(pick(), { x: 21, y: 7 }, 'the blocked post is passed over');
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
