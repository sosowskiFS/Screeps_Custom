const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

// shardX W1N9: a 2x2 ranged quad, 40 XLHO2 HEAL parts (1,920 healing a tick on any member), three
// towers 7-8 tiles away.
function setup({ towersEnergy = 864, invader = false } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    g.BOOSTS = { heal: { XLHO2: { heal: 4, rangedHeal: 4 } }, tough: {} };
    const pos = (x, y) => ({ x, y, roomName: 'W1N9', getRangeTo: o => Math.max(Math.abs((o.pos || o).x - x), Math.abs((o.pos || o).y - y)) });
    const member = (id, x, y, ranged, heal) => ({ id, owner: { username: invader ? 'Invader' : 'Harabi' }, pos: pos(x, y),
        body: [].concat(Array(ranged).fill({ type: g.RANGED_ATTACK, hits: 100 }), Array(25).fill({ type: g.MOVE, hits: 100 }),
            Array(heal).fill({ type: g.HEAL, hits: 100, boost: 'XLHO2' })) });
    const hostiles = [member('a', 24, 4, 23, 2), member('b', 24, 3, 23, 2), member('c', 25, 4, 7, 18), member('d', 25, 3, 7, 18)];
    const towers = [[16, 8], [17, 7], [17, 9]].map(([x, y], n) => ({ id: 't' + n, structureType: g.STRUCTURE_TOWER, pos: pos(x, y), store: { energy: towersEnergy } }));
    const room = { name: 'W1N9', controller: { my: true, level: 7 },
        find: (type, opts) => {
            let list = type === g.FIND_HOSTILE_CREEPS ? hostiles : type === g.FIND_MY_STRUCTURES ? towers : [];
            const f = opts && opts.filter;
            if (typeof f === 'function') list = list.filter(f);
            else if (f) list = list.filter(o => Object.entries(f).every(([k, v]) => o[k] === v));
            return list;
        } };
    g.Game.rooms.W1N9 = room;
    return { h, g, room, staffing: h.load('defense.staffing') };
}

test('W1N9: enough defenders to beat a 1,920-heal quad with the towers, not 2', () => {
    const { room, staffing } = setup();
    // 1,920 x 1.3 = 2,496 to deal; towers at 7-8 tiles ~1,590; a 20-ranged defender 200: 5.
    assert.equal(staffing.needed(room, 200), 5);
    assert.equal(staffing.needed(room, 320), 3, 'bigger defenders, fewer of them');
});

test('towers out of energy leave it all to defenders, capped at 8; nothing hostile, none', () => {
    let { room, staffing } = setup({ towersEnergy: 0 });
    assert.equal(staffing.needed(room, 200), 8);
    ({ room, staffing } = setup());
    room.find = () => [];
    assert.equal(staffing.needed(room, 200), 0);
});

test('tower damage falls off from 600 at 5 tiles to 150 at 20', () => {
    const { staffing } = setup();
    assert.equal(staffing.towerDamage(3), 600);
    assert.equal(staffing.towerDamage(20), 150);
    assert.equal(staffing.towerDamage(8), 510);
});

test('RCL5+ defenders move at full speed unboosted: a MOVE for every RANGED_ATTACK (W1N9: 20 ranged, 5 move crawled)', () => {
    const { h } = setup();
    const s5 = h.load('spawn.BuildCreeps5');
    for (const cap of [800, 3300, 5600, 12900]) {
        const body = s5.buildOptimalDefender(cap);
        const ranged = body.filter(p => p === 'ranged_attack').length, move = body.filter(p => p === 'move').length;
        assert.equal(ranged, move, cap + ': ' + ranged + ' ranged, ' + move + ' move');
        assert.ok(body.length <= 50 && ranged * 200 <= cap);
    }
    assert.equal(s5.buildOptimalDefender(12900).length, 50);
});

test('the MOVE-light defender (1 MOVE per 4 ranged) only with enough XZHO2 ready in a lab to boost its MOVE', () => {
    const { h, g } = setup();
    Object.assign(g, { LAB_BOOST_MINERAL: 30, LAB_BOOST_ENERGY: 20 });
    const s5 = h.load('spawn.BuildCreeps5');
    const lab = { id: 'lab', structureType: g.STRUCTURE_LAB, mineralType: 'RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE', mineralAmount: 100, store: { energy: 2000 } };
    const room = { name: 'W1N9', find: type => (type === g.FIND_MY_STRUCTURES ? [lab] : []) };
    const moves = b => b.filter(p => p === 'move').length;
    let body = s5.buildOptimalDefender(5600, room);
    assert.equal(moves(body) * 2, body.length, '100 XZHO2 cannot boost 8 MOVE: pairs');
    lab.mineralAmount = 3000;
    g.Game.time++;
    body = s5.buildOptimalDefender(5600, room);
    assert.deepEqual([moves(body), body.length - moves(body)], [8, 32], 'boostable: 8 MOVE carry 32 ranged');
});

// shardX E23N31: whole bodies boosted against any boosted attacker, though it ran when outgunned.
test('ranged boosts: none while defenders and towers already beat the healing; just enough parts when they do not', () => {
    const { g, room, staffing, h } = setup();
    g.BOOSTS.ranged_attack = { XKHO2: { rangedAttack: 4 } };
    g.BOOSTS[g.RANGED_ATTACK] = { XKHO2: { rangedAttack: 4 } };
    g.RESOURCE_CATALYZED_KEANIUM_ALKALIDE = 'XKHO2';
    const defender = (id, ranged, boosted = 0) => ({ id, my: true, memory: { priority: 'defender' },
        body: [].concat(Array(boosted).fill({ type: g.RANGED_ATTACK, hits: 100, boost: 'XKHO2' }), Array(ranged - boosted).fill({ type: g.RANGED_ATTACK, hits: 100 })) });
    const find = room.find;
    let ours = [];
    room.find = (type, opts) => (type === g.FIND_MY_CREEPS ? ours : find(type, opts));
    const short = () => { g.Game.time++; return staffing.boostShortfall(room); };
    ours = [];
    const none = short();
    assert.ok(none > 0, 'no defenders: the quad out-heals the towers');
    // Easiest target heals about 1,920 x 1.3 = 2,496; three towers do some of it.
    ours = Array.from({ length: 12 }, (_, n) => defender('d' + n, 25));   // 3,000 unboosted
    assert.equal(short(), 0, 'already out-damaging: no boost');
    ours = [defender('da', 25), defender('db', 25)];                        // 500
    const parts = short();
    assert.ok(parts > 0 && parts < 50, 'some of their 50 parts, not all: ' + parts);
    ours = [defender('da', 25, parts > 25 ? 25 : parts), defender('db', 25, Math.max(0, parts - 25))];
    assert.equal(short(), 0, 'once those parts are boosted: no more');
});
