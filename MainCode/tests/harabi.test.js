const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

// shardX E23N31 as recorded: his speaker holds at range 3 (🔫🛑), retreats (💨🚑) and steps back in (👣🎲).
function setup() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Game.time = 1000;
    Object.assign(g, { RESOURCE_ENERGY: 'energy', TOWER_POWER_ATTACK: 600, TOWER_OPTIMAL_RANGE: 5, TOWER_FALLOFF_RANGE: 20, TOWER_FALLOFF: 0.75 });
    const ci = h.load('combat.intel');
    const speaker = { id: 's', owner: { username: 'Harabi' }, pos: { x: 26, y: 20 }, hits: 5000, saying: '🔫🛑' };
    const healer = { id: 'h', owner: { username: 'Harabi' }, pos: { x: 27, y: 20 }, hits: 5000 };
    let threats = [speaker, healer];
    ci.roomIntel = () => ({ threats, hostiles: threats });
    ci.assess = c => c.stats || { ranged: 0 };
    ci.supportHealing = () => 1500;
    const towers = [];
    const defenders = [];
    const room = { name: 'R', find: type => (type === g.FIND_MY_STRUCTURES ? towers : type === g.FIND_MY_CREEPS ? defenders : []) };
    const hx = h.load('combat.harabi');
    const step = (say, x, y) => { g.Game.time++; speaker.saying = say; speaker.pos = { x, y }; return hx.observe(room); };
    return { h, g, hx, room, speaker, healer, towers, defenders, step, setThreats: t => { threats = t; } };
}
function earnTrust(s) {
    // Holds, a retreat and a return: every prediction right.
    for (let i = 0; i < 4; i++) s.step('🔫🛑', 26, 20);
    s.step('💨🚑', 27, 20);
    s.step('👣🎲', 26, 20);
    for (let i = 0; i < 4; i++) s.step('🔫🛑', 26, 20);
}

test('his speech is trusted only once it has matched; then towers hold below a burst and fire a burst', () => {
    const s = setup();
    s.step('🔫🛑', 26, 20);
    assert.equal(s.hx.towerOrder(s.room), null, 'not trusted yet: normal targeting');
    earnTrust(s);
    assert.equal(s.hx.observe(s.room).trusted, true);
    s.towers.push({ structureType: s.g.STRUCTURE_TOWER, pos: { x: 26, y: 25 }, store: { energy: 1000 } });   // range 5: 600
    assert.deepEqual(plain(s.hx.towerOrder(s.room)), { target: null }, '600 on one member: hold, keep the energy');
    s.g.Game.time++;
    s.towers.push({ structureType: s.g.STRUCTURE_TOWER, pos: { x: 27, y: 25 }, store: { energy: 1000 } });
    s.defenders.push({ pos: { x: 26, y: 22 }, memory: { priority: 'defender' }, stats: { ranged: 440 } });
    s.step('🔫🛑', 26, 20);
    const order = s.hx.towerOrder(s.room);
    assert.equal(order.target, s.speaker, 'a burst: towers and the defender beside it, 1,000+');
});

test('after a retreat the defenders wait by the tile it left', () => {
    const s = setup();
    earnTrust(s);
    s.step('💨🚑', 28, 19);
    assert.deepEqual(plain(s.hx.returnTile(s.room)), { x: 26, y: 20 });
    s.step('👣🎲', 26, 20);
    assert.equal(s.hx.returnTile(s.room), null);
});

test('safeguards: speech that stops matching, another player, or a long fruitless hold, and it is normal defence', () => {
    let s = setup();
    earnTrust(s);
    for (let i = 0; i < 6; i++) s.step('🔫🛑', 20 + i, 20);      // says hold, keeps walking: wrong
    assert.equal(s.hx.observe(s.room).trusted, false);
    assert.equal(s.hx.towerOrder(s.room), null);

    s = setup();
    earnTrust(s);
    for (let i = 0; i < 3; i++) s.step('💨🚑', 30 + i, 20);       // retreats and never comes back
    s.step('👣', 34, 20); s.step('👣', 35, 20); s.step('👣', 36, 20); s.step('👣', 37, 20);
    assert.ok(s.hx.state('R').checks.includes(0), 'no return counts against it');

    s = setup();
    earnTrust(s);
    s.setThreats([s.speaker, s.healer, { id: 'x', owner: { username: 'Other' }, pos: { x: 10, y: 10 }, hits: 3000 }]);
    s.g.Game.time++;
    assert.equal(s.hx.towerOrder(s.room), null, 'another player armed in the room');

    s = setup();
    earnTrust(s);
    s.towers.push({ structureType: s.g.STRUCTURE_TOWER, pos: { x: 40, y: 40 }, store: { energy: 1000 } });   // too far to burst
    for (let i = 0; i <= s.hx.HOLD_MAX + 1; i++) { s.step('🔫🛑', 26, 20); s.hx.towerOrder(s.room); }
    assert.equal(s.hx.towerOrder(s.room), null, 'held too long with no retreat: normal for a while');
});

test('nothing for anyone else, or when switched off', () => {
    const s = setup();
    s.setThreats([{ id: 'x', owner: { username: 'Other' }, pos: { x: 10, y: 10 }, hits: 3000, saying: '🔫🛑' }]);
    s.g.Game.time++;
    assert.equal(s.hx.observe(s.room), null);
    s.setThreats([s.speaker]);
    s.g.Memory.settings = { harabiTactics: false };
    s.g.Game.time++;
    assert.equal(s.hx.observe(s.room), null);
});

test('stances from his emojis', () => {
    const { hx } = setup();
    assert.equal(hx.stanceOf('💨🚑'), 'retreat');
    assert.equal(hx.stanceOf('💨🚨'), 'retreat');
    assert.equal(hx.stanceOf('🔫🛑🎲🔍'), 'hold');
    assert.equal(hx.stanceOf('🌀🎲'), 'mass');
    assert.equal(hx.stanceOf('👣🔄'), 'move');
    assert.equal(hx.stanceOf('hello'), 'other');
});

test('bursts that make no retreat count against it: towers back to normal', () => {
    const s = setup();
    earnTrust(s);
    s.towers.push({ structureType: s.g.STRUCTURE_TOWER, pos: { x: 26, y: 25 }, store: { energy: 1000 } }, { structureType: s.g.STRUCTURE_TOWER, pos: { x: 27, y: 25 }, store: { energy: 1000 } });
    for (let i = 0; i < 40 && s.hx.towerOrder(s.room); i++) s.step('🔫🛑', 26, 20);   // bursts, and it just stays
    assert.equal(s.hx.towerOrder(s.room), null);
    assert.equal(s.g.Memory.harabiStatus.R.on, 0);
});

test('two squads: the force commits to the one it beats by most and keeps it, rather than bouncing', () => {
    const s = setup();
    earnTrust(s);
    const other = { id: 's2', owner: { username: 'Harabi' }, pos: { x: 10, y: 10 }, hits: 5000, saying: '🔫🛑' };
    s.setThreats([s.speaker, s.healer, other]);
    s.h.load('combat.intel').supportHealing = t => (t.id === 's2' ? 200 : 3000);   // the far one heals less
    s.towers.push({ structureType: s.g.STRUCTURE_TOWER, pos: { x: 12, y: 12 }, store: { energy: 1000 } });
    s.step('🔫🛑', 26, 20);
    other.pos = { x: 10, y: 10 };
    const first = s.hx.anchor(s.room);
    assert.equal(first.target, other, 'the easier squad');
    // It retreats; the other squad does not draw the force over while the commitment holds.
    s.h.load('combat.intel').supportHealing = t => (t.id === 's2' ? 2000 : 200);
    for (let i = 0; i < 5; i++) { s.step('🔫🛑', 26, 20); }
    assert.equal(s.hx.anchor(s.room).target, other, 'kept for COMMIT_TICKS');
    for (let i = 0; i < s.hx.COMMIT_TICKS; i++) { s.step('🔫🛑', 26, 20); }
    assert.notEqual(s.hx.anchor(s.room).target, other, 'then the much easier one');
});

test('the force still on its way: a burst is no test, and holding is no fruitless hold', () => {
    const s = setup();
    earnTrust(s);
    s.towers.push({ structureType: s.g.STRUCTURE_TOWER, pos: { x: 26, y: 25 }, store: { energy: 1000 } }, { structureType: s.g.STRUCTURE_TOWER, pos: { x: 27, y: 25 }, store: { energy: 1000 } });
    for (let i = 0; i < 5; i++) s.defenders.push({ pos: { x: 5, y: 40 + i }, memory: { priority: 'defender' }, stats: { ranged: 100 } });
    for (let i = 0; i < 20; i++) { s.step('🔫🛑', 26, 20); s.hx.towerOrder(s.room); }
    assert.ok(s.hx.towerOrder(s.room), 'bursts with the defenders far off: not held against it');
    assert.ok(!s.hx.state('R').burst, 'no burst test pending');
});

test('a squad that sits by the wall mass attacking (🌀) builds trust too', () => {
    const s = setup();
    for (let i = 0; i < 8; i++) s.step('🌀', 26, 20);
    assert.equal(s.hx.observe(s.room).trusted, true);
    for (let i = 0; i < 6; i++) s.step('🌀', 26 + i, 20);   // says it is holding, walks off
    assert.equal(s.hx.observe(s.room).trusted, false);
});
