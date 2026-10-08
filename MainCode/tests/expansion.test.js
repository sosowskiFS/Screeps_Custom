const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

// Home E10N10 (sponsor), candidate E14N10 four rooms east. Every room nearby is scouted and empty.
function setup({ ema = 150, harasser = 10, roomCpu = 5 } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    g.ERR_GCL_NOT_ENOUGH = -15;
    g.Game.time = 100000;
    g.Game.cpu.limit = 230;
    g.Game.gcl = { level: 40 };
    g.Game.shard = { name: 'shard3' };   // shard1/shard2 never expand (system.expansion NO_EXPAND_SHARDS)
    g.console = { log: () => {} };
    const expansion = h.load('system.expansion');
    const home = { name: 'E10N10', controller: { my: true, level: 7 }, storage: { store: { energy: 200000 } },
        find: type => type === g.FIND_MY_SPAWNS ? [{ owner: { username: 'me' } }] : [] };
    g.Game.rooms = { E10N10: home };
    g.Game.spawns = { S: { owner: { username: 'me' }, room: home } };
    g.Memory.cpuGov = { ema, shed: 0 };
    // A guard already posted at the candidate (creep.roomGuard): these tests are about the other orders.
    g.Game.creeps = { guard: { memory: { priority: 'roomGuard', destination: 'E14N10' }, ticksToLive: 1400 } };
    g.Memory.roomCPU = { E10N10: { a: roomCpu, n: 500, l: 1 }, '~harasser': { a: harasser, n: 500, l: 1 } };
    g.Game.map.getRoomLinearDistance = (a, b) => expansion.linear(a, b);
    g.Game.map.findRoute = (from, to) => [{ room: to }];
    g.Game.map.describeExits = name => {
        const p = expansion.parse(name);
        return { 1: expansion.format(p.x, p.y - 1), 3: expansion.format(p.x + 1, p.y), 5: expansion.format(p.x, p.y + 1), 7: expansion.format(p.x - 1, p.y) };
    };
    g.Game.map.getRoomTerrain = () => ({ get: (x, y) => (x === 0 || y === 0 || x === 49 || y === 49 ? 1 : 0) });
    g.Memory.expandIntel = {};
    for (const name of expansion.around('E12N10', 4)) g.Memory.expandIntel[name] = { t: g.Game.time };
    const candidate = { t: g.Game.time, n: 2, c: [25, 10], s: [[10, 30], [40, 30]], m: [20, 40] };
    g.Memory.expandIntel.E14N10 = candidate;
    return { h, g, expansion, candidate };
}

test('room coordinates: names round-trip and distance works across the W/E and N/S lines', () => {
    const { expansion } = setup();
    for (const name of ['E0N0', 'W0S0', 'E14N10', 'W3S12']) assert.equal(expansion.format(expansion.parse(name).x, expansion.parse(name).y), name);
    assert.equal(expansion.linear('E0N5', 'W0N5'), 1);
    assert.equal(expansion.linear('E3N0', 'E3S0'), 1);
    assert.equal(expansion.around('E5N5', 1).length, 8);
});

test('CPU budget: shard average minus harassers plus one average room must stay at or under 85% of the limit', () => {
    let s = setup({ ema: 150 });
    assert.deepEqual([s.expansion.budget().projected, s.expansion.budget().allowed], [145, true]);
    s = setup({ ema: 200, harasser: 10 });      // 200 - 10 + 5 = 195 <= 195.5
    assert.equal(s.expansion.budget().allowed, true, 'harasser CPU is free CPU');
    s = setup({ ema: 200, harasser: 0 });       // 205 > 195.5
    assert.equal(s.expansion.budget().allowed, false);
});

test('candidate rules: spacing from our and whitelisted rooms, claimed neighbours, reservations, keepers, scouting', () => {
    const { g, expansion, candidate } = setup();
    const ctx = () => ({ mine: ['E10N10'], me: 'me', bad: {} });
    assert.equal(expansion.invalidReason('E14N10', candidate, ctx()), null);
    assert.match(expansion.invalidReason('E12N10', Object.assign({}, candidate), ctx()), /within 2 of our room/);
    g.Memory.whiteList = ['friend'];
    g.Memory.expandIntel.E16N11 = { t: g.Game.time, o: 'friend' };
    assert.match(expansion.invalidReason('E14N10', candidate, ctx()), /whitelisted E16N11/);
    delete g.Memory.expandIntel.E16N11.o;
    g.Memory.badRooms = { E15N9: { o: 'enemy', t: g.Game.time } };
    assert.match(expansion.invalidReason('E14N10', candidate, ctx()), /next to claimed E15N9/);
    g.Memory.badRooms = {};
    g.Memory.expandIntel.E15N10 = { t: g.Game.time, r: 'enemy' };   // reserved neighbour: fine
    assert.equal(expansion.invalidReason('E14N10', candidate, ctx()), null);
    assert.match(expansion.invalidReason('E14N10', Object.assign({}, candidate, { r: 'enemy' }), ctx()), /reserved by enemy/);
    assert.match(expansion.invalidReason('E14N10', Object.assign({}, candidate, { k: 1 }), ctx()), /source keepers/);
    delete g.Memory.expandIntel.E13N11;
    assert.match(expansion.invalidReason('E14N10', candidate, ctx()), /not scouted/);
});

test('ranking: farther from our rooms and more free remote sources around rank higher', () => {
    const { g, expansion } = setup();
    const near = expansion.score('E13N10', ['E10N10']);
    const far = expansion.score('E15N10', ['E10N10']);
    assert.ok(far.score > near.score);
    g.Memory.expandIntel.E16N10 = { t: g.Game.time, n: 2 };   // east of E15N10: free remote sources
    g.Memory.expandIntel.E15N9 = { t: g.Game.time, n: 1, r: 'enemy' };   // reserved by someone else: not counted
    // E16N10 (2) and E14N10 (2, the other candidate) count; E15N9 is reserved by someone else.
    assert.equal(expansion.score('E15N10', ['E10N10']).remote, 4);
});

test('the planner check uses terrain plus recorded positions', () => {
    const { expansion, candidate } = setup();
    assert.equal(expansion.planCheck('E14N10', candidate), true);
    assert.equal(candidate.p, 1);
});

test('claim, then helpers until the terminal is built; the sponsor spawns them', () => {
    const { g, expansion } = setup();
    expansion.run();
    assert.equal(g.Memory.expansion.t, 'E14N10');
    assert.deepEqual(plain(expansion.spawnOrder('E10N10')), { type: 'claim', target: 'E14N10' });
    assert.equal(expansion.spawnOrder('E1N1'), null);
    expansion.claimed('E14N10');
    assert.deepEqual(plain(expansion.spawnOrder('E10N10')), { type: 'helper', target: 'E14N10', max: expansion.HELPERS });
    const room = { name: 'E14N10', controller: { my: true, level: 6 }, find: () => [] };
    g.Game.rooms.E14N10 = room;
    expansion.run();
    assert.equal(g.Memory.expansion.t, 'E14N10', 'still developing');
    room.terminal = { my: true };
    expansion.run();
    assert.equal(g.Memory.expansion.t, undefined, 'done once the terminal stands');
    assert.equal(expansion.spawnOrder('E10N10'), null);
});

test('no spare CPU: no expansion and no scanning; GCL refusal backs off; failures cool down', () => {
    let s = setup({ ema: 220, harasser: 0 });
    s.expansion.run();
    assert.equal(s.g.Memory.expansion.t, undefined);
    assert.ok(!s.g.Memory.expansion.scan, 'no intel gathering while capped');

    s = setup();
    s.expansion.run();
    s.expansion.claimFailed('E14N10', s.g.ERR_GCL_NOT_ENOUGH);
    assert.equal(s.g.Memory.expansion.t, undefined);
    assert.ok(s.g.Memory.expansion.gcl > s.g.Game.time);
    assert.ok(!s.g.Memory.expansion.bad.E14N10, 'the room itself is still fine');

    s = setup();
    s.expansion.run();
    s.g.Game.time += 6000;   // claimer never made it
    s.expansion.run();
    assert.ok(s.g.Memory.expansion.bad.E14N10);
    s.g.Memory.expansion.next = 0;
    s.expansion.run();
    assert.equal(s.g.Memory.expansion.t, undefined, 'not retried during the cool-down');
});

test('the claim does not time out while a claimer is on its way (shard3 E25N43)', () => {
    const { g, expansion } = setup();
    expansion.run();
    assert.equal(g.Memory.expansion.t, 'E14N10');
    g.Game.creeps = { c: { memory: { priority: 'claimer', destination: 'E14N10' } } };
    g.Game.time += 6000;
    expansion.run();
    assert.equal(g.Memory.expansion.t, 'E14N10', 'still claiming');
    assert.ok(!g.Memory.expansion.bad.E14N10);
});

test('a refused claim on a room that is already ours is ignored', () => {
    const { g, expansion } = setup();
    expansion.run();
    g.Game.rooms.E14N10 = { name: 'E14N10', controller: { my: true }, find: () => [] };
    expansion.claimFailed('E14N10', g.ERR_INVALID_TARGET);
    assert.equal(g.Memory.expansion.t, 'E14N10');
    assert.ok(!g.Memory.expansion.bad.E14N10);
});

test('a room of ours without a terminal is supported even after its expansion was dropped', () => {
    const { g, expansion } = setup({ ema: 220, harasser: 0 });   // no CPU to expand: only the safety net acts
    g.Memory.expansion = { next: 0, bad: { E14N10: g.Game.time - 10 } };
    g.Game.rooms.E14N10 = { name: 'E14N10', controller: { my: true, level: 1 }, find: () => [] };
    g.Game.time = 100100;
    expansion.run();
    assert.equal(g.Memory.expansion.t, 'E14N10');
    assert.equal(g.Memory.expansion.st, 'develop');
    assert.ok(!g.Memory.expansion.bad.E14N10, 'its old failure mark is cleared');
    assert.deepEqual(plain(expansion.spawnOrder('E10N10')), { type: 'helper', target: 'E14N10', max: expansion.HELPERS });
});

test('shard1/shard2 never expand; a room an expansion there already claimed is handed to retirement (shard2 E26N27)', () => {
    const { g, expansion } = setup();
    g.Game.shard = { name: 'shard2' };
    g.Memory.expansion = { next: 0, bad: {}, t: 'E14N10', sp: 'E10N10', st: 'develop', since: 1 };
    g.Game.rooms.E14N10 = { name: 'E14N10', controller: { my: true, level: 2 }, find: () => [] };
    expansion.run();
    assert.equal(g.Memory.expansion.t, undefined);
    assert.equal(g.Memory.retire.rooms.E14N10.st, 'drain', 'retired: drained, then unclaimed');
    assert.equal(expansion.spawnOrder('E10N10'), null);
    g.Memory.expansion.next = 0;
    expansion.run();
    assert.equal(g.Memory.expansion.t, undefined, 'no new expansion');
    assert.ok(!g.Memory.expansion.scan, 'no scanning either');
});
