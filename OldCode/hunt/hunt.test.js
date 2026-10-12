const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

function setup(shard = 'shard2') {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Game.shard.name = shard;
    g.Game.time = 1000;
    let now = 1000000;
    g.Date = { now: () => now };
    const messages = {};
    g.InterShardMemory = { getLocal: () => messages[g.Game.shard.name] || '', setLocal: v => { messages[g.Game.shard.name] = v; }, getRemote: s => messages[s] || '' };
    g.Game.notify = () => {};
    const advance = (ticks, ms = ticks * 3000) => { g.Game.time += ticks; now += ms; };
    return { h, g, advance, messages, hunt: h.load('system.hunt'), squads: h.load('system.guardSquads') };
}

test('Bezoka is whitelisted on every shard and his rooms are no longer avoided', () => {
    const { g, hunt } = setup();
    g.Memory.badRooms = { E25N38: { o: 'Bezoka', t: 1 }, E1N1: { o: 'Harabi', t: 1 } };
    hunt.run();
    assert.ok(g.Memory.whiteList.includes('Bezoka'));
    assert.equal(Object.keys(g.Memory.badRooms).join(), 'E1N1');
});

test('the E25N38 hunt: one quad at a time from E32N39 only, through E30N40, parked at the south border', () => {
    const { g, hunt, squads } = setup();
    hunt.run();
    const t = squads.state().targets['shardX:E25N38'];
    assert.ok(t, 'target registered');
    assert.equal(t.home, 'E32N39');
    assert.equal(t.corner, 'E30N40');
    assert.equal(t.desired, 1);
    assert.equal(t.helper, null, 'no helper home');
    assert.equal(JSON.stringify(t.hunt.park), JSON.stringify({ x: 25, y: 45 }));
    // Not ours, not a shardX claim target: still kept, never recalled.
    g.Game.rooms.E32N39 = { name: 'E32N39', energyCapacityAvailable: 12900, controller: { my: true, level: 8 }, find: () => [] };
    squads.run();
    assert.ok(squads.state().targets['shardX:E25N38']);
    assert.equal(squads.state().targets['shardX:E25N38'].stopped, false);
});

test('two squads in a row losing two or more members early hold the next squad for 3,000 ticks', () => {
    const { g, h: s_h, hunt, squads } = setup();
    hunt.run();
    const t = squads.state().targets['shardX:E25N38'];
    const lost = (id, killed) => ({ id, home: 'E32N39', created: 1, killed, slots: [0, 1, 2, 3].map(slot => ({ slot, spawnedAt: 1, phase: 'missing' })) });
    t.squads = [lost('a', 3)];
    squads.scoreHunt(t);
    assert.equal(t.holdUntil, undefined, 'one lost fight');
    t.squads.push(lost('b', 1));
    squads.scoreHunt(t);
    assert.equal(t.lostStreak, 0, 'members mostly ran out of life: the streak resets');
    t.squads.push(lost('c', 2), lost('d', 4));
    squads.scoreHunt(t);
    assert.equal(t.holdUntil, g.Game.time + 3000);
    // Held: nothing spawned for it meanwhile.
    t.squads = [{ id: 'e', home: 'E32N39', created: g.Game.time, slots: [0, 1, 2, 3].map(slot => ({ slot, phase: 'missing' })) }];
    g.Game.rooms.E32N39 = { name: 'E32N39', energyCapacityAvailable: 12900, controller: { my: true, level: 8 }, find: () => [] };
    squads.state().targets = { 'shardX:E25N38': t };
    s_h.load('system.guardBoosts').moveReady = () => true;   // the MOVE gate has its own tests
    assert.equal(squads.spawnOrder('E32N39'), null);
    delete t.holdUntil;
    const order = squads.spawnOrder('E32N39');
    assert.ok(order);
    assert.equal(JSON.stringify(order.memory.guardPark), JSON.stringify({ x: 25, y: 45 }));
});

test('Harabi not seen in E25N38 for two quad lifespans ends the order', () => {
    const s = setup();
    s.hunt.run();
    // shardX saw him: the clock restarts from that sighting.
    s.advance(2000);
    s.messages.shardX = JSON.stringify({ hunt: { E25N38: s.g.Date.now() } });
    s.advance(2000);
    s.hunt.run();
    assert.ok(s.squads.state().targets['shardX:E25N38'], '2,000 ticks since the sighting');
    s.advance(1100);
    s.hunt.run();
    assert.equal(s.squads.state().targets['shardX:E25N38'], undefined, 'over 3,000 ticks: ended');
    assert.ok(s.g.Memory.hunt.done['shardX:E25N38']);
    s.hunt.run();
    assert.equal(s.squads.state().targets['shardX:E25N38'], undefined, 'and stays ended');
});

test('shardX records when it sees Harabi in the hunt room', () => {
    const s = setup('shardX');
    s.g.Game.time = 1010;
    s.g.Game.rooms.E25N38 = { name: 'E25N38', find: () => [{ owner: { username: 'Harabi' } }] };
    s.hunt.run();
    assert.equal(JSON.parse(s.messages.shardX).hunt.E25N38, s.g.Date.now());
});

test('the E25N38 hunt avoids E26N38: spawned members and existing manifests carry the list', () => {
    const { g, h, hunt, squads } = setup();
    hunt.run();
    const t = squads.state().targets['shardX:E25N38'];
    assert.equal(t.hunt.avoid.join(), 'E26N38');
    t.squads = [{ id: 'q', home: 'E32N39', created: g.Game.time, slots: [{ slot: 0, name: 'old', memory: { destination: 'E25N38' } }, { slot: 1 }, { slot: 2 }, { slot: 3 }] }];
    g.Game.creeps.old = { name: 'old', memory: { destination: 'E25N38', guardStaging: { room: 'E26N38' } } };
    hunt.run();
    assert.equal(t.squads[0].slots[0].memory.guardAvoid.join(), 'E26N38');
    assert.equal(g.Game.creeps.old.memory.guardAvoid.join(), 'E26N38');
    assert.equal(g.Game.creeps.old.memory.guardStaging, undefined, 'staging re-chosen');
    g.Game.rooms.E32N39 = { name: 'E32N39', energyCapacityAvailable: 12900, controller: { my: true, level: 8 }, find: () => [] };
    h.load('system.guardBoosts').moveReady = () => true;
    const order = squads.spawnOrder('E32N39');
    assert.equal(order.memory.guardAvoid.join(), 'E26N38');
});

test('hunt quads spawn with the hunter body and reserve boosts for it; other quads keep the standard body', () => {
    const { g, h, hunt, squads } = setup();
    hunt.run();
    const t = squads.state().targets['shardX:E25N38'];
    const ra = list => list.filter(p => p === g.RANGED_ATTACK).length;
    assert.equal(ra(squads.body(12900, 0, t)), 26);
    assert.equal(ra(squads.body(12900, 0)), 22);
    g.Game.rooms.E32N39 = { name: 'E32N39', energyCapacityAvailable: 12900, controller: { my: true, level: 8 }, find: () => [] };
    h.load('system.guardBoosts').moveReady = () => true;
    t.squads = [{ id: 'q', home: 'E32N39', created: g.Game.time, slots: [0, 1, 2, 3].map(slot => ({ slot, phase: 'missing' })) }];
    assert.equal(ra(squads.spawnOrder('E32N39').body), 26);
    h.load('system.guardBoosts').prepare();
    assert.equal(g.Memory.guardBoosts.rooms.E32N39.need[g.RESOURCE_CATALYZED_KEANIUM_ALKALIDE] >= 26 * 30 * 4, true);
});

// From tests/guardQuad.test.js (uses its world() fixture):
test('rooms on a squad\'s avoid list (hunt: E26N38, walled off) are never in its room route or tile paths, nor its staging choice',()=>{
    const w=world();
    for(const c of w.squad){c.memory.guardAvoid=['E26N38'];}
    w.q.snake(w.squad,new w.Pos(25,25,'E25N38'),false);
    const call=w.actions.find(a=>a[1]==='travel');
    assert.ok(call);
    assert.equal(call[3].routeCallback('E26N38'),Infinity);
    assert.equal(call[3].routeCallback('E26N39'),undefined);
    assert.equal(call[3].roomCallback('E26N38'),false);
    assert.equal(call[3].roomCallback('E25N39'),undefined);
    // Staging: the route is planned without it.
    let callback;
    w.g.Game.map.findRoute=(from,to,opts)=>{callback=opts.routeCallback;return [{room:'E25N39'},{room:'E25N38'}];};
    w.g.Memory.badRooms={};
    w.h.load('traveler').Traveler.checkAvoid=()=>false;
    const leader={memory:{guardAvoid:['E26N38']},room:{name:'E27N39'}};
    assert.equal(w.q.stagingRoom(leader,'E25N38'),'E25N39');
    assert.equal(callback('E26N38'),Infinity);
    assert.equal(callback('E26N39'),1);
});
