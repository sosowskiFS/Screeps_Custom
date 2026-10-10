const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

function load() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Game.shard = { name: 'shard2' };
    g.console = { log: () => {} };
    g.RoomPosition = class { constructor(x, y, roomName) { this.x = x; this.y = y; this.roomName = roomName; } };
    return { h, g };
}

// A quad guard back in E32N39 next to a lab, then the spawn.
function homeCreep(g, { boosted = true, room = 'E32N39', hs } = {}) {
    const calls = [];
    const lab = { id: 'lab', structureType: g.STRUCTURE_LAB, cooldown: 0, unboostCreep: () => { calls.push('unboost'); return g.OK; } };
    const spawn = { id: 'spawn', recycleCreep: () => { calls.push('recycle'); return g.OK; } };
    g.Game.rooms = { E32N39: { name: 'E32N39', controller: { my: true },
        find: (type, opts) => (type === g.FIND_MY_SPAWNS ? [spawn] : [lab].filter(opts && opts.filter ? opts.filter : () => true)) } };
    const creep = { name: 'q', memory: { priority: 'roomGuard', homeRoom: 'E32N39', guardRecall: 1, hs },
        room: { name: room }, body: [{ type: g.RANGED_ATTACK, boost: boosted ? 'XKHO2' : undefined }],
        pos: { findClosestByRange: list => list[0] },
        travelTo: t => calls.push('travel ' + (t.roomName || t.id)), suicide: () => calls.push('suicide') };
    return { creep, calls };
}

test('a recalled boosted guard walks home, unboosts at a lab, then recycles', () => {
    const { h, g } = load();
    const { recall } = h.load('creep.recall');
    let s = homeCreep(g, { room: 'E30N40' });
    recall(s.creep);
    assert.deepEqual(s.calls, ['travel E32N39']);
    s = homeCreep(g);
    recall(s.creep);
    recall(s.creep);
    assert.deepEqual(s.calls, ['unboost', 'recycle']);
});

test('a recalled creep stranded on another shard is retired there', () => {
    const { h, g } = load();
    g.Game.shard = { name: 'shardX' };
    const s = homeCreep(g, { hs: 'shard2' });
    h.load('creep.recall').recall(s.creep);
    assert.deepEqual(s.calls, ['suicide']);
});

test('shardX switched off: no orders, the queue is cleared, and creeps bound for the portal are recalled', () => {
    const { h, g } = load();
    g.Memory.xs = { mode: 'claim', queue: { E32N39: { kind: 'claimer', memory: {} } }, targets: [{ r: 'E29N36', h: 'shard2:E32N39', e: 'E30N40' }] };
    const x = h.load('system.shardX');
    g.Memory.settings = { shardX: false };
    assert.equal(x.enabled(), false, 'Memory.settings.shardX = false switches it off');
    assert.equal(x.spawnOrder('E32N39'), null);
    x.run();
    assert.deepEqual(plain(g.Memory.xs.queue), {});
    const s = homeCreep(g, { boosted: false, room: 'E30N40' });
    s.creep.memory.xShard = { c: 'E30N40' };
    assert.equal(x.portalStep(s.creep), true);
    assert.deepEqual(s.calls, ['travel E32N39'], 'heading home, not into the portal');
    assert.match(x.command('claim'), /switched off/);
    g.Memory.settings = { shardX: true };
    assert.equal(x.enabled(), true, 'Memory.settings.shardX = true switches it back on');
});
