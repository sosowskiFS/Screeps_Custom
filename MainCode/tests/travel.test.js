const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

function setup() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RoomPosition = class {
        constructor(x, y, roomName) { this.x = x; this.y = y; this.roomName = roomName; }
        getRangeTo(o) { const p = o.pos || o; return p.roomName === this.roomName ? Math.max(Math.abs(p.x - this.x), Math.abs(p.y - this.y)) : 50; }
        getDirectionTo(o) {
            const p = o.pos || o, dx = Math.sign(p.x - this.x), dy = Math.sign(p.y - this.y);
            return { '0,-1': 1, '1,-1': 2, '1,0': 3, '1,1': 4, '0,1': 5, '-1,1': 6, '-1,0': 7, '-1,-1': 8 }[dx + ',' + dy];
        }
        lookFor() { return (g.lookAt[this.roomName + ':' + this.x + ',' + this.y]) || []; }
    };
    g.lookAt = {};
    g._.defaults = (o, d) => { for (const k in d) if (o[k] === undefined) o[k] = d[k]; return o; };
    g._.round = n => Math.round(n);
    g.Game.cpu.getUsed = () => 0;
    g.PathFinder = { CostMatrix: class { set() {} get() { return 0; } clone() { return this; } }, search: () => ({ path: [], incomplete: false }) };
    // A row of rooms W3N1 - W2N1 - W1N1 - E0N1, plus W2N2 above W2N1.
    const exits = { W1N1: { 7: 'W2N1', 3: 'E0N1' }, W2N1: { 3: 'W1N1', 7: 'W3N1', 1: 'W2N2' }, W3N1: { 3: 'W2N1' }, E0N1: { 7: 'W1N1' }, W2N2: { 5: 'W2N1' } };
    g.Game.map.describeExits = r => exits[r];
    g.Game.map.getRoomLinearDistance = (a, b) => Math.abs(parseInt(a.slice(1), 10) * (a[0] === 'W' ? -1 : 1) - parseInt(b.slice(1), 10) * (b[0] === 'W' ? -1 : 1));
    const routes = [];
    g.Game.map.findRoute = (from, to, opts) => {
        routes.push([from, to]);
        // W1N1 -> W3N1 straight through W2N1 unless the callback blocks it.
        if (opts.routeCallback('W2N1') === Infinity) return -2;
        return [{ room: 'W2N1' }, { room: to }];
    };
    const { Traveler } = h.load('traveler');
    return { h, g, Traveler, routes };
}

test('a trip to the next room plans its room route too (no bounce back through the room just left)', () => {
    const { g, Traveler, routes } = setup();
    let callback;
    g.PathFinder.search = (origin, goal, opts) => { callback = opts.roomCallback; return { path: [], incomplete: false }; };
    Traveler.findTravelPath(new g.RoomPosition(1, 25, 'W1N1'), new g.RoomPosition(25, 25, 'W2N1'), {});
    assert.deepEqual(plain(routes), [['W1N1', 'W2N1']], 'route used for a 1-room trip');
    assert.equal(callback('E0N1'), false, 'rooms off the route are not searched');
});

test('rooms claimed by non-whitelisted players are never routed through; reserved ones are fine', () => {
    const { h, g, Traveler, routes } = setup();
    const badRooms = h.load('system.badRooms');
    g.Memory.whiteList = ['friend'];
    const room = (name, controller) => ({ name, controller });
    badRooms.record(room('W2N1', { owner: { username: 'rival' }, my: false }));
    badRooms.record(room('W2N2', { reservation: { username: 'rival' } }));
    badRooms.record(room('E0N1', { owner: { username: 'friend' }, my: false }));
    assert.deepEqual(Object.keys(plain(g.Memory.badRooms)), ['W2N1'], 'only the hostile claim');

    let searched;
    g.PathFinder.search = (origin, goal, opts) => { searched = opts.roomCallback; return { path: [], incomplete: true }; };
    Traveler.findTravelPath(new g.RoomPosition(1, 25, 'W1N1'), new g.RoomPosition(25, 25, 'W3N1'), {});
    assert.equal(searched('W2N1'), false, 'the claimed room is not part of any search');
    assert.notEqual(searched('W2N2'), false, 'a reserved room is');
    // The destination itself may be a bad room (attackers).
    assert.notEqual(searched('W3N1'), false);

    // Unclaimed again: dropped (and the route cache keys on the change).
    badRooms.record(room('W2N1', { reservation: { username: 'rival' } }));
    assert.deepEqual(plain(g.Memory.badRooms), {});
});

test('a route cut off by walls is widened to neighbouring rooms before giving up', () => {
    const { g, Traveler } = setup();
    const attempts = [];
    g.PathFinder.search = (origin, goal, opts) => {
        const allowed = ['W1N1', 'W2N1', 'W3N1', 'W2N2', 'E0N1'].filter(r => opts.roomCallback(r) !== false);
        attempts.push(allowed);
        return { path: [], incomplete: !allowed.includes('W2N2') };   // needs the detour through W2N2
    };
    const ret = Traveler.findTravelPath(new g.RoomPosition(1, 25, 'W1N1'), new g.RoomPosition(25, 25, 'W3N1'), {});
    assert.equal(ret.incomplete, false);
    assert.equal(attempts.length, 2, 'route first, then widened');
});

test('stuck behind our own idle creep: swap places; parked workers and creeps already moving are left alone', () => {
    const { g, Traveler } = setup();
    const moves = [];
    const creep = { name: 'harasser', pos: new g.RoomPosition(10, 10, 'W1N1') };
    const blocker = (memory, extra = {}) => Object.assign({ name: 'b', my: true, spawning: false, fatigue: 0, memory,
        pos: new g.RoomPosition(11, 10, 'W1N1'), move: d => { moves.push(d); return g.OK; } }, extra);
    g.lookAt['W1N1:11,10'] = [blocker({ priority: 'distributor' })];
    Traveler.pushBlocker(creep, g.RIGHT);
    assert.deepEqual(moves, [g.LEFT], 'distributor swaps into our tile');

    moves.length = 0;
    g.lookAt['W1N1:11,10'] = [blocker({ priority: 'supplier' })];
    Traveler.pushBlocker(creep, g.RIGHT);
    g.lookAt['W1N1:11,10'] = [blocker({ priority: 'miner', atSpot: true })];
    Traveler.pushBlocker(creep, g.RIGHT);
    const moving = blocker({ priority: 'mule' });
    Traveler.markMoved(moving);
    g.lookAt['W1N1:11,10'] = [moving];
    Traveler.pushBlocker(creep, g.RIGHT);
    assert.deepEqual(moves, []);
});

test('repath around creeps that cannot reach the goal is discarded: wait and push, do not walk back', () => {
    const { g, Traveler } = setup();
    const searches = [];
    g.PathFinder.search = (origin, goal, opts) => {
        const aroundCreeps = searches.length === 0;   // the stuck repath comes first
        searches.push(aroundCreeps);
        // Around creeps: only a partial path going back west; ignoring them: straight east.
        return aroundCreeps
            ? { path: [new g.RoomPosition(9, 10, 'W1N1')], incomplete: true }
            : { path: [new g.RoomPosition(11, 10, 'W1N1'), new g.RoomPosition(12, 10, 'W1N1')], incomplete: false };
    };
    const moves = [];
    const creep = { name: 'h', fatigue: 0, pos: new g.RoomPosition(10, 10, 'W1N1'), memory: { _trav: {
        path: '3', state: [10, 10, 1, 0, 30, 10, 'W1N1'] } }, move: d => { moves.push(d); return g.OK; }, say: () => {} };
    Traveler.travelTo(creep, new g.RoomPosition(30, 10, 'W1N1'), { stuckValue: 2 });
    assert.equal(searches.length, 2);
    assert.deepEqual(moves, [g.RIGHT], 'still heading east, not back west');
});

test('stale claimed rooms: observer homes look, otherwise the nearest home sends a scout', () => {
    const { h, g } = setup();
    const badRooms = h.load('system.badRooms');
    g.Memory.badRooms = { W3N1: { o: 'rival', t: 1 } };
    g.Game.time = 1 + badRooms.RECHECK;
    g.Game.spawns = { a: { room: { name: 'W1N1' } }, b: { room: { name: 'E0N1' } } };
    assert.deepEqual(plain(badRooms.scoutTargets('W1N1')), ['W3N1'], 'W1N1 is the nearest home');
    assert.deepEqual(plain(badRooms.scoutTargets('E0N1')), []);
    g.Memory.observerList = { E0N1: ['obs'] };
    assert.equal(badRooms.observeRequest('E0N1'), 'W3N1');
    assert.deepEqual(plain(badRooms.scoutTargets('W1N1')), [], 'an observer covers it: no scout');
});

test('a creep swapped out of the way while waiting near a spot stays put instead of walking straight back', () => {
    const { g, Traveler } = setup();
    const moves = [];
    const mule = { name: 'mule', fatigue: 0, my: true, spawning: false, memory: { priority: 'mule' },
        pos: new g.RoomPosition(11, 10, 'W1N1'), move: d => { moves.push(d); return g.OK; } };
    g.lookAt['W1N1:11,10'] = [mule];
    assert.equal(Traveler.pushBlocker({ name: 'dist', pos: new g.RoomPosition(10, 10, 'W1N1') }, g.RIGHT), true);
    moves.length = 0;
    mule.pos = new g.RoomPosition(10, 10, 'W1N1');   // swapped
    const spawn = new g.RoomPosition(14, 10, 'W1N1'); // now 4 away, waits within 3
    g.Game.time += 1;
    assert.equal(Traveler.travelTo(mule, spawn, { range: 3 }), g.OK);
    assert.deepEqual(moves, [], 'settles instead of swapping back');
    g.Game.time += 5;
    assert.equal(Traveler.wasPushed(mule), false, 'the hold expires');
});
