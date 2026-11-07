const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

// shardX E19N44: a second storage miner stood at 32,34, the one corridor through the base.
function minerCase({ occupant, at = { x: 32, y: 34 } }) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    let recalled = 0, travelled = 0;
    h.load('creep.recall').recall = () => { recalled++; };
    const flag = { pos: { x: 33, y: 35, roomName: 'R', lookFor: () => (occupant ? [occupant] : []) } };
    g.Game.flags = { RstorageMiner: flag };
    g.Game.getObjectById = () => null;
    const creep = { name: 'm', my: true, room: { name: 'R' }, pos: Object.assign({ roomName: 'R' }, at), ticksToLive: 600,
        memory: { priority: 'miner', jobSpecific: 'storageMiner', deathWarn: 44, ignoreTravel: true }, travelTo: () => { travelled++; }, harvest: () => g.OK,
        store: { getFreeCapacity: () => 100 } };
    return { creep, miner: h.load('creep.miner'), recalled: () => recalled, travelled: () => travelled };
}
const healthy = { my: true, memory: { priority: 'miner', jobSpecific: 'storageMiner', atSpot: true } };

test('a second miner for a tile with a healthy miner on it goes home to recycle, and stays recalled', () => {
    const c = minerCase({ occupant: healthy });
    c.miner.run(c.creep);
    assert.equal(c.recalled(), 1);
    assert.equal(c.travelled(), 0);
    assert.equal(c.creep.memory.surplus, 1);
    c.miner.run(c.creep);
    assert.equal(c.recalled(), 2);
});

test('a replacement waits for a miner near death, and walks to a free tile', () => {
    let c = minerCase({ occupant: { my: true, memory: { priority: 'minerNearDeath', jobSpecific: 'storageMinerNearDeath', atSpot: true } } });
    c.miner.run(c.creep);
    assert.equal(c.recalled(), 0);
    assert.equal(c.travelled(), 1);
    c = minerCase({ occupant: null });
    c.miner.run(c.creep);
    assert.equal(c.recalled(), 0);
    assert.equal(c.travelled(), 1);
});

test('another job on the tile is not a duplicate', () => {
    const c = minerCase({ occupant: { my: true, memory: { priority: 'miner', jobSpecific: 'upgradeMiner', atSpot: true } } });
    c.miner.run(c.creep);
    assert.equal(c.recalled(), 0);
});

function pushCase(memory) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    let moved = 0;
    const blocker = { my: true, memory, fatigue: 0, name: 'b', pos: { getDirectionTo: () => 1 }, move: () => { moved++; return g.OK; } };
    const { Traveler } = h.load('traveler');
    const next = { lookFor: () => [blocker] };
    Traveler.positionAtDirection = () => next;
    const creep = { pos: {} };
    return { pushed: Traveler.pushBlocker(creep, 1), moved: () => moved };
}

test('a miner walking to its flag can be swapped with; one at work, or a parked supplier, cannot', () => {
    assert.equal(pushCase({ priority: 'miner', ignoreTravel: true }).pushed, true, 'on its way');
    assert.equal(pushCase({ priority: 'miner', ignoreTravel: true, atSpot: true }).pushed, false, 'at work');
    assert.equal(pushCase({ priority: 'supplier', atSpot: true }).pushed, false);
    assert.equal(pushCase({ priority: 'farMiner' }).pushed, false, 'a far miner by its source is left alone');
});

function reachCase(under) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RoomPosition = function (x, y, roomName) {
        this.x = x; this.y = y; this.roomName = roomName;
        this.lookFor = type => (type === g.LOOK_CREEPS && x === 31 && y === 37 ? under : []);
    };
    g.Game.rooms.R = { name: 'R', getTerrain: () => ({ get: () => 0 }) };
    return h.load('room.reach');
}

test('a pile under a parked supplier is its own; under another parked creep it is still reachable from beside it', () => {
    const target = { pos: { x: 31, y: 37, roomName: 'R' } };
    const asker = { pos: { roomName: 'R', inRangeTo: () => false } };
    assert.equal(reachCase([{ my: true, memory: { priority: 'supplier', atSpot: true } }]).reachable(target, asker), false);
    assert.equal(reachCase([{ my: true, memory: { priority: 'miner', atSpot: true } }]).reachable(target, asker), true);
    assert.equal(reachCase([]).reachable(target, asker), true);
    const beside = { pos: { roomName: 'R', inRangeTo: () => true } };
    assert.equal(reachCase([{ my: true, memory: { priority: 'supplier', atSpot: true } }]).reachable(target, beside), true, 'already beside it');
});
