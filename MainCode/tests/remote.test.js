const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

// Home E5N5 with storage; rooms around it described only by Memory.remoteIntel.
// PathFinder is mocked: round-trip cost grows with room distance (and per-source extras).
function world(extraCost = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.BODYPART_COST = { move: 50, carry: 50, attack: 80, work: 100 };
    g.CARRY_CAPACITY = 50;
    const coords = name => { const m = /^([WE])(\d+)([NS])(\d+)$/.exec(name); return [(m[1] === 'W' ? -1 : 1) * +m[2], (m[3] === 'N' ? -1 : 1) * +m[4]]; };
    const distance = (a, b) => { const [ax, ay] = coords(a), [bx, by] = coords(b); return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); };
    g.Game.map = { getRoomStatus: () => ({ status: 'normal' }), getRoomLinearDistance: distance };
    g.PathFinder = { search: (origin, goal) => {
        const target = goal.pos;
        const cost = 25 * distance(origin.roomName, target.roomName) + (extraCost[target.roomName + ':' + target.x] || 0);
        return { cost, path: new Array(cost).fill(0), incomplete: false };
    } };
    g.Game.flags = {};
    g.RoomPosition = function (x, y, roomName) {
        this.x = x; this.y = y; this.roomName = roomName;
        this.createFlag = name => {
            if (g.Game.flags[name]) return g.ERR_NAME_EXISTS;
            g.Game.flags[name] = { name, pos: { x, y, roomName }, remove() { delete g.Game.flags[name]; } };
            return name;
        };
    };
    const home = { name: 'E5N5', controller: { my: true }, storage: { pos: { x: 25, y: 25, roomName: 'E5N5' } }, energyCapacityAvailable: 5600 };
    const intel = (room, sources, extra = {}) => { g.Memory.remoteIntel = g.Memory.remoteIntel || {}; g.Memory.remoteIntel[room] = Object.assign({ t: 1, s: sources, c: 1 }, extra); };
    return { h, g, home, intel, remote: h.load('system.remoteMining') };
}

test('planner keeps sources a max-size mule can keep up with, nearest first', () => {
    const { g, home, intel, remote } = world({ 'E6N5:40': 40, 'E5N6:20': 2 });
    assert.equal(remote.muleCapacity(5600), 1250, '25 CARRY at full energy (no ATTACK part)');
    intel('E6N5', [['a', 10, 10], ['b', 40, 40]]);   // adjacent: round trips 56 and 136
    intel('E5N6', [['c', 20, 20]]);                  // adjacent: round trip 60
    intel('E7N5', [['far', 5, 5]]);                  // two rooms away: round trip 106
    intel('E5N3', [['x', 5, 5]], { r: 'rival' });    // reserved by a player
    intel('E4N4', [['sk', 5, 5]], { k: 1 });         // keeper room
    intel('E6N6', [['own', 5, 5]], { o: 'rival' });  // owned
    remote.planHome(home);
    const plan = plain(g.Memory.remotePlan.E5N5.list).map(e => e.id);
    // 1250 / trip >= 8.5 energy/tick  ->  trip <= 147
    assert.deepEqual(plan, ['a', 'c', 'far', 'b']);

    g.Memory.remotePlan = {};
    const small = Object.assign({}, home, { energyCapacityAvailable: 1300 }); // 13 pairs = 650 carry -> trip <= 76
    remote.planHome(small);
    assert.deepEqual(plain(g.Memory.remotePlan.E5N5.list).map(e => e.id), ['a', 'c'], 'smaller mules: two-room source is out of reach');
});

test('a source another home already mines (plan or manual flag) is left alone', () => {
    const { g, home, intel, remote } = world();
    intel('E6N5', [['a', 10, 10], ['b', 30, 30]]);
    g.Memory.remotePlan = { E7N5: { t: 1, list: [{ r: 'E6N5', id: 'a', x: 10, y: 10, trip: 20 }] } };
    g.Game.flags.E7N4FarMining = { name: 'E7N4FarMining', pos: { x: 30, y: 30, roomName: 'E6N5' } };
    remote.planHome(home);
    assert.deepEqual(plain(g.Memory.remotePlan.E5N5.list), []);
});

test('flags fill free slots nearest-first, keep manual flags, add one guard per room, drop unplanned ones', () => {
    const { g, home, intel, remote } = world({ 'E5N6:20': 30 });
    intel('E6N5', [['a', 10, 10], ['b', 40, 40]]);
    intel('E5N6', [['c', 20, 20]]);
    // Manual flag already in slot 1 on some other source: untouched, slot skipped.
    g.Game.flags.E5N5FarMining = { name: 'E5N5FarMining', pos: { x: 1, y: 1, roomName: 'E4N5' } };
    remote.planHome(home);
    remote.applyPlan(home);
    const at = name => g.Game.flags[name] && [g.Game.flags[name].pos.roomName, g.Game.flags[name].pos.x];
    assert.deepEqual(at('E5N5FarMining'), ['E4N5', 1], 'manual flag kept');
    assert.deepEqual([at('E5N5FarMining2'), at('E5N5FarMining3'), at('E5N5FarMining4')], [['E6N5', 10], ['E6N5', 40], ['E5N6', 20]]);
    assert.deepEqual([at('E5N5FarGuard'), at('E5N5FarGuard2')], [['E6N5', 25], ['E5N6', 25]], 'one guard flag per mined room');

    // E5N6 gets reserved by a player: its auto flags go, the manual flag stays.
    intel('E5N6', [['c', 20, 20]], { r: 'rival' });
    remote.planHome(home);
    remote.applyPlan(home);
    assert.equal(g.Game.flags.E5N5FarMining4, undefined);
    assert.equal(g.Game.flags.E5N5FarGuard2, undefined);
    assert.ok(g.Game.flags.E5N5FarMining && g.Game.flags.E5N5FarMining2);
});

test('player attacks disable the room with escalating back-off and a safety check before resuming', () => {
    const { g, remote } = world();
    g.Game.time = 1000;
    remote.noteIncident('E6N5', 'miner attacked by rival');
    g.Game.time = 1050;
    remote.noteIncident('E6N5', 'still here'); // same incident
    let st = g.Memory.remoteStatus.E6N5;
    assert.equal(st.strikes, 1);
    assert.equal(st.until, 1050 + 1500);
    assert.equal(remote.isDisabled('E6N5'), true);

    g.Game.time = 3000;
    assert.equal(remote.isDisabled('E6N5'), true, 'back-off over but not yet seen clear');
    assert.equal(remote.needsProbe('E6N5'), true);

    // Seen with no hostiles: resume.
    const room = { name: 'E6N5', controller: {}, find: () => [] };
    g.Game.rooms.E6N5 = room;
    remote.inspectRoom(room);
    assert.equal(remote.isDisabled('E6N5'), false);

    // Attacked again later: second strike doubles the wait.
    g.Game.time = 4000;
    remote.noteIncident('E6N5', 'again');
    st = g.Memory.remoteStatus.E6N5;
    assert.equal(st.strikes, 2);
    assert.equal(st.until, 4000 + 3000);
});

test('a room claimed by another player is disabled on sight', () => {
    const { g, remote } = world();
    g.Game.time = 10;
    remote.inspectRoom({ name: 'E6N5', controller: { owner: { username: 'rival' } }, find: () => [] });
    assert.equal(remote.isDisabled('E6N5'), true);
    assert.match(g.Memory.remoteStatus.E6N5.reason, /claimed by rival/);
});

test('scouts are requested for unknown or due-for-check rooms, never for observer homes', () => {
    const { g, home, intel, remote } = world();
    g.Game.time = 100;
    g.Game.cpu.bucket = 9000;
    const targets = remote.scoutTargets('E5N5');
    assert.equal(targets.length, 24, 'nothing known yet: every room within 2');
    assert.ok(['E4N4', 'E5N4', 'E6N6'].every(r => targets.slice(0, 8).includes(r)), 'adjacent rooms first');
    assert.equal(remote.needsScout(home), true);

    for (const room of targets) intel(room, [], { t: 100 });
    assert.equal(remote.needsScout(home), false, 'fresh intel everywhere');

    remote.noteIncident('E6N5', 'test');
    g.Game.time = 100 + 1600;
    assert.deepEqual(plain(remote.scoutTargets('E5N5')), ['E6N5'], 'disabled room due its check');

    g.Memory.observerList = { E5N5: ['obs'] };
    assert.equal(remote.needsScout(home), false, 'observer homes check with the observer');
    assert.equal(remote.observeRequest('E5N5'), 'E6N5');
});

test('civilians wait at home while their remote is disabled', () => {
    const { h, g, remote } = world();
    const tactics = h.load('combat.tactics');
    g.Game.time = 50;
    remote.noteIncident('E6N5', 'test');
    const moves = [];
    const creep = { room: { name: 'E5N6', find: () => [] }, pos: { x: 20, y: 20, roomName: 'E5N6' },
        memory: { homeRoom: 'E5N5' }, travelTo: target => moves.push(target.roomName || target.pos.roomName), move() {} };
    g.Game.rooms.E5N5 = { name: 'E5N5', storage: { pos: { x: 25, y: 25, roomName: 'E5N5' } } };
    g.Game.rooms.E5N6 = creep.room;
    assert.equal(tactics.avoidDanger(creep, 'E6N5'), true);
    assert.deepEqual(moves, ['E5N5']);
});

test('round trips are cached and a large first plan spreads its path searches over ticks', () => {
    const { g, home, intel, remote } = world();
    let searches = 0;
    const search = g.PathFinder.search;
    g.PathFinder.search = (...args) => { searches++; return search(...args); };
    const rooms = ['E6N5', 'E5N6', 'E4N5', 'E5N4', 'E6N6', 'E4N4'];
    rooms.forEach((room, i) => intel(room, [['s' + i, 10, 10], ['t' + i, 20, 20]]));
    g.Game.time = 10;
    remote.planHome(home);
    assert.equal(searches, 10, 'capped at 10 new searches per tick');
    assert.equal(g.Memory.remotePlan.E5N5.list.length, 9, 'partial plan already usable');
    assert.ok(g.Memory.remotePlan.E5N5.t < 10, 'marked for an early follow-up');
    remote.planHome(home);
    assert.equal(searches, 12, 'only the two remaining sources are searched');
    remote.planHome(home);
    assert.equal(searches, 12, 'fully cached');
});
