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
            // Like the real engine: flags can only be created in rooms with vision.
            if (!g.Game.rooms[roomName]) throw new Error('Could not access room ' + roomName);
            if (g.Game.flags[name]) return g.ERR_NAME_EXISTS;
            g.Game.flags[name] = { name, pos: { x, y, roomName }, remove() { delete g.Game.flags[name]; } };
            return name;
        };
    };
    const home = { name: 'E5N5', controller: { my: true }, storage: { pos: { x: 25, y: 25, roomName: 'E5N5' } }, energyCapacityAvailable: 5600 };
    const intel = (room, sources, extra = {}) => { g.Memory.remoteIntel = g.Memory.remoteIntel || {}; g.Memory.remoteIntel[room] = Object.assign({ t: 1, s: sources, c: 1 }, extra); };
    return { h, g, home, intel, remote: h.load('system.remoteMining') };
}

test('planner keeps sources that stay well net-positive after their creeps, nearest first', () => {
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
    assert.deepEqual(plan, ['a', 'c', 'far', 'b']);

    g.Memory.remotePlan = {};
    const small = Object.assign({}, home, { energyCapacityAvailable: 1300 }); // 13 pairs = 650 carry -> trip <= 76
    remote.planHome(small);
    // Smaller mules: the farther sources now get several mules each and still return well over half.
    assert.deepEqual(plain(g.Memory.remotePlan.E5N5.list).map(e => e.id), ['a', 'c', 'far', 'b']);
    assert.deepEqual(plain(remote.haul(1300, 136)), { mules: 3, pairs: 11 });
    assert.equal(remote.worthMining(1300, 200, 1), false, 'too far: more than 3 mules, or under half the output left');
});

test('a source another home already mines (plan or manual flag) is left alone', () => {
    const { g, home, intel, remote } = world();
    intel('E6N5', [['a', 10, 10], ['b', 30, 30]]);
    g.Memory.remotePlan = { E7N5: { t: 1, list: [{ r: 'E6N5', id: 'a', x: 10, y: 10, trip: 20 }] } };
    g.Game.flags.E7N4FarMining = { name: 'E7N4FarMining', pos: { x: 30, y: 30, roomName: 'E6N5' } };
    remote.planHome(home);
    assert.deepEqual(plain(g.Memory.remotePlan.E5N5.list), []);
});

test('mining nodes come from the plan, with no flags; old auto flags are retired and their creeps moved to the node', () => {
    const { g, home, intel, remote } = world();
    intel('E6N5', [['a', 10, 10], ['b', 40, 40]]);
    g.Game.rooms.E6N5 = { name: 'E6N5' };
    // A hand-placed flag on b: left to its own creeps, not planned again.
    g.Game.flags.E5N5FarMining = { name: 'E5N5FarMining', pos: { x: 40, y: 40, roomName: 'E6N5' } };
    // An old auto flag on a, with its miner.
    let removed = false;
    g.Game.flags.E5N5FarMining2 = { name: 'E5N5FarMining2', pos: { x: 10, y: 10, roomName: 'E6N5' }, remove: () => { removed = true; delete g.Game.flags.E5N5FarMining2; } };
    g.Memory.remoteAuto = { E5N5: { E5N5FarMining2: 'a' } };
    g.Game.creeps = { m: { memory: { priority: 'farMiner', homeRoom: 'E5N5', targetFlag: 'E5N5FarMining2' } } };
    remote.planHome(home);
    assert.deepEqual(plain(remote.nodes('E5N5')).map(n => n.id), ['a'], 'b is under a hand-placed flag');
    remote.applyPlan(home);
    assert.equal(removed, true, 'the auto flag is retired');
    assert.ok(g.Game.flags.E5N5FarMining, 'the hand-placed flag stays');
    const m = g.Game.creeps.m.memory;
    assert.equal(m.targetFlag, undefined);
    assert.deepEqual([m.node.id, m.node.r, m.node.x], ['a', 'E6N5', 10], 'its miner now works the node');
    // The resolver gives roles a flag-like target.
    const t = remote.target(g.Game.creeps.m);
    assert.deepEqual([t.pos.roomName, t.pos.x, t.pos.y], ['E6N5', 10, 10]);
    assert.equal(t.room, g.Game.rooms.E6N5);
    t.remove();
    assert.equal(remote.isDisabled('E6N5'), true, 'removing a node backs the room off');
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

test('scouting: every room within 2 at first; reserved and owned rooms only rarely again; observers ask for the nearest due room', () => {
    const { g, intel, remote } = world();
    g.Game.time = 100;
    const due = () => remote.scoutTargets('E5N5');
    assert.equal(due().length, 24, 'nothing known: all 24 rooms within 2');
    assert.equal(g.Game.map.getRoomLinearDistance('E5N5', due()[0]), 1, 'nearest first');
    for (const r of due()) intel(r, [['s' + r, 10, 10]], { t: 100 });
    intel('E6N5', [['x', 1, 1]], { t: 100, r: 'rival' });
    intel('E7N7', [['y', 1, 1]], { t: 100, o: 'rival' });
    assert.equal(due().length, 0, 'all fresh');
    g.Game.time = 100 + 20000;
    assert.ok(due().includes('E5N6') && !due().includes('E6N5') && !due().includes('E7N7'), 'free rooms first');
    g.Game.time = 100 + 30000;
    assert.ok(due().includes('E6N5') && !due().includes('E7N7'), 'reserved rooms after 30000');
    g.Game.time = 100 + 50000;
    assert.ok(due().includes('E7N7'), 'owned rooms after 50000');
    assert.equal(remote.observeRequest('E5N5'), due()[0], 'an observer home looks at the nearest due room');
});

test('nodes are staffed without flags: a miner, the mules its trip needs, the reserver, guards when attacked', () => {
    const { h, g } = world();
    g.Memory.FarRoomsUnderAttack = []; g.Memory.FarClaimerNeeded = {};
    const far = h.load('spawn.BuildFarCreeps');
    g.Memory.remotePlan = { E5N5: { t: 1, list: [{ r: 'E6N5', id: 'a', x: 10, y: 10, trip: 136 }] } };
    const room = { name: 'E5N5', energyCapacityAvailable: 1300 };
    const creeps = [];
    const add = (priority, extra = {}) => creeps.push({ memory: Object.assign({ priority, homeRoom: 'E5N5', node: { id: 'a', r: 'E6N5' } }, extra) });
    const job = () => { const j = far.nodeJob(room, creeps, false, false); return j && j.role; };
    assert.equal(job(), 'farMiner');
    add('farMiner');
    assert.equal(job(), 'farMule');
    add('farMule'); add('farMule');
    assert.equal(job(), 'farMule', 'a 136-tick trip at 1300 energy needs 3 mules');
    add('farMule');
    assert.equal(job(), null, 'fully staffed; no reserver needed yet');
    g.Memory.FarClaimerNeeded.E6N5 = true;
    assert.equal(job(), 'farClaimer');
    g.Memory.FarRoomsUnderAttack.push('E6N5');
    const guard = far.nodeJob(room, creeps, false, false);
    assert.equal(guard.role, 'farGuard');
    assert.equal(guard.node.r, 'E6N5');
    assert.equal(far.nodeJob(room, creeps, false, true) && far.nodeJob(room, creeps, false, true).role, 'farGuard', 'the first two nodes survive a 50mCap');
});
