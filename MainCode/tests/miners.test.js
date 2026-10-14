const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

test('a surplus storage miner becomes the upgrade miner when there is none (E29N43: two storage miners, second source unmined)', () => {
    const h = harness();
    const spawn5 = h.load('spawn.BuildCreeps5');
    const miner = (name, ttl) => ({ name, ticksToLive: ttl, memory: { priority: 'miner', jobSpecific: 'storageMiner', mineSource: 'A', linkSource: 'storage', atSpot: false, _trav: {} } });
    const old = miner('old', 300), young = miner('young', 1400);
    const counts = { storageMiners: [old, young], upgradeMiners: [] };
    const moved = spawn5.rebalanceMiners(counts, ['A', 'B'], ['L0', 'L1', 'L2'], 'E29N43');
    assert.equal(moved, young, 'the youngest goes');
    assert.equal(young.memory.jobSpecific, 'upgradeMiner');
    assert.equal(young.memory.mineSource, 'B');
    assert.equal(young.memory.linkSource, 'L0');
    assert.equal(young.memory.linkSource2, 'L2');
    assert.equal(young.memory._trav, undefined);
    assert.equal(counts.storageMiners.length, 1);
    assert.equal(counts.upgradeMiners.length, 1);
    // One storage miner, or an upgrade miner already there: nothing changes.
    assert.equal(spawn5.rebalanceMiners({ storageMiners: [miner('x', 1)], upgradeMiners: [] }, ['A', 'B'], ['L0'], 'R'), null);
    assert.equal(spawn5.rebalanceMiners({ storageMiners: [miner('x', 1), miner('y', 2)], upgradeMiners: [{}] }, ['A', 'B'], ['L0'], 'R'), null);
});

test('a near-death miner still walks to its tile (its job reads storageMinerNearDeath)', () => {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    const travelled = [];
    g.Game.flags = { E29N43storageMiner: { pos: { x: 26, y: 13 } } };
    g.Game.getObjectById = () => null;
    const creep = { name: 'm', room: { name: 'E29N43' }, pos: { x: 25, y: 14 }, ticksToLive: 50, store: { getFreeCapacity: () => 50 },
        memory: { priority: 'minerNearDeath', jobSpecific: 'storageMinerNearDeath', deathWarn: 60 },
        travelTo: f => { travelled.push(f.pos.x + ',' + f.pos.y); return g.OK; }, say: () => {} };
    h.load('creep.miner').run(creep);
    assert.equal(travelled.join(), '26,13');
});

test('a miner still on its way to its tile can be swapped aside; one on its tile cannot', () => {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    const { Traveler } = h.load('traveler');
    const moves = [];
    const blocker = memory => ({ name: 'b', my: true, spawning: false, fatigue: 0, memory, pos: { x: 11, y: 10, roomName: 'R' },
        move: d => { moves.push(d); return g.OK; } });
    let here;
    g.RoomPosition = function (x, y, roomName) { Object.assign(this, { x, y, roomName }); this.lookFor = () => [here]; };
    const pusher = { name: 'p', pos: { x: 10, y: 10, roomName: 'R' } };
    here = blocker({ priority: 'minerNearDeath', atSpot: false });
    here.pos.getDirectionTo = () => g.LEFT;
    assert.equal(Traveler.pushBlocker(pusher, g.RIGHT), true, 'short of its tile: swapped');
    here = blocker({ priority: 'miner', atSpot: true });
    assert.equal(Traveler.pushBlocker(pusher, g.RIGHT), false, 'on its tile: stays');
    here = blocker({ priority: 'farMiner' });
    assert.equal(Traveler.pushBlocker(pusher, g.RIGHT), false, 'parked roles that keep no atSpot are still never pushed');
});

test('links: the one beside the storage is the storage link even with the controller close (E29N43 layout)', () => {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    const range = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    const sources = [{ pos: { x: 27, y: 14 } }, { pos: { x: 39, y: 38 } }];
    const link = (id, x, y) => ({ id, structureType: g.STRUCTURE_LINK, pos: { x, y,
        getRangeTo: o => range({ x, y }, o.pos || o), findInRange: (t, r) => sources.filter(s => range({ x, y }, s.pos) <= r) } });
    const links = [link('srcB1', 37, 37), link('srcB2', 38, 38), link('ctrl', 22, 16), link('srcB3', 37, 38), link('besideStorage', 25, 13), link('far', 24, 9)];
    const room = { name: 'E29N43', controller: { pos: { x: 25, y: 15 } }, storage: { pos: { x: 25, y: 12 } },
        find: type => (type === g.FIND_MY_STRUCTURES ? links : []) };
    g.Memory.linkList = {}; g.Memory.labList = {}; g.Memory.powerSpawnList = {}; g.Memory.factoryList = {};
    h.load('system.industry').updateRoomStructureLists(room);
    const list = g.Memory.linkList.E29N43;
    assert.equal(list[0], 'srcB1');
    assert.equal(list[1], 'ctrl', 'controller link: the nearest other within 4');
    assert.equal(list[2], 'srcB2');
    assert.equal(list[3], 'besideStorage', 'storage link: the one beside the storage');
    assert.ok(list.includes('srcB3') && list.includes('far'), 'nothing dropped');
});
