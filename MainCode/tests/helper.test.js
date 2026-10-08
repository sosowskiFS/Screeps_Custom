const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

function storeOf(contents, capacity) {
    const store = Object.assign({}, contents);
    const used = () => Object.values(store).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
    Object.defineProperties(store, {
        getFreeCapacity: { value: () => capacity - used() },
        getUsedCapacity: { value: () => used() },
    });
    return store;
}

const range = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

// The room being built: source A at 10,10 is near but walled in to a single harvesting tile
// (11,10); source B at 40,40 is far with open ground around it.
function setup({ carry = {}, others = [], sites = [], dropped = [], aEnergy = 3000, tower = true, structures = [] } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    g.Game.time = 101;
    const walls = new Set();
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if ((dx || dy) && !(dx === 1 && dy === 0)) walls.add((10 + dx) + ',' + (10 + dy));
    const room = { name: 'NEW', controller: { my: true, level: 2, ticksToDowngrade: 20000, pos: { x: 25, y: 25 }, sign: { username: 'me' } },
        energyAvailable: 300, energyCapacityAvailable: 300,
        getTerrain: () => ({ get: (x, y) => (walls.has(x + ',' + y) ? 1 : 0) }), lookForAtArea: () => [] };
    const source = (id, x, y, energy) => ({ id, energy, ticksToRegeneration: 200, room, pos: { x, y, roomName: 'NEW' } });
    const A = source('A', 10, 10, aEnergy), B = source('B', 40, 40, 3000);
    const objects = { A, B };
    for (const o of sites.concat(dropped)) objects[o.id] = o;
    const calls = [];
    const { Traveler } = h.load('traveler');
    const at = t => t.pos || t;
    const creep = {
        name: 'me', room, owner: { username: 'me' }, carryCapacity: 400, store: storeOf(carry, 400),
        memory: { priority: 'helper', destination: 'NEW', homeRoom: 'HOME', loaded: 1 },
        getActiveBodyparts: () => 4,
        pos: { x: 15, y: 15, roomName: 'NEW', isNearTo: t => range(creep.pos, at(t)) <= 1, inRangeTo: (t, r) => range(creep.pos, at(t)) <= r,
            getRangeTo: t => range(creep.pos, at(t)), findInRange: () => [], lookFor: () => [],
            findClosestByRange: list => list.slice().sort((a, b) => range(creep.pos, at(a)) - range(creep.pos, at(b)))[0] },
        harvest: t => { calls.push(['harvest', t.id]); return creep.pos.isNearTo(t) ? (t.energy ? g.OK : g.ERR_NOT_ENOUGH_RESOURCES) : g.ERR_NOT_IN_RANGE; },
        pickup: t => { calls.push(['pickup', t.id]); return g.ERR_NOT_IN_RANGE; },
        withdraw: (t, resource) => {
            calls.push(['withdraw', t.id, resource]);
            if (!creep.pos.isNearTo(t)) return g.ERR_NOT_IN_RANGE;
            const amount = Math.min(t.store[resource] || 0, creep.store.getFreeCapacity(resource));
            t.store[resource] = (t.store[resource] || 0) - amount;
            creep.store[resource] = (creep.store[resource] || 0) + amount;
            return amount ? g.OK : g.ERR_NOT_ENOUGH_RESOURCES;
        },
        build: t => { calls.push(['build', t.id]); return creep.pos.inRangeTo(t, 3) ? g.OK : g.ERR_NOT_IN_RANGE; },
        upgradeController: () => { calls.push(['upgrade']); return g.ERR_NOT_IN_RANGE; },
        transfer: () => g.ERR_NOT_IN_RANGE, signController: () => g.OK,
        travelTo: (t, opts) => { calls.push(['travelTo', t.id || 'pos', opts && opts.range]); Traveler.markMoved(creep); return g.OK; },
    };
    // A full tower by default: most tests are about building (a tower-less young room upgrades first).
    const mine = structures.concat(tower ? [{ id: 'tower', structureType: g.STRUCTURE_TOWER, store: { [g.RESOURCE_ENERGY]: 1000 } }] : []);
    for (const o of mine) objects[o.id] = o;
    g.Game.getObjectById = id => objects[id] || null;
    room.find = type => {
        if (type === g.FIND_SOURCES) return [A, B];
        if (type === g.FIND_MY_CREEPS) return [creep, ...others];
        if (type === g.FIND_MY_CONSTRUCTION_SITES) return sites;
        if (type === g.FIND_DROPPED_RESOURCES) return dropped;
        if (type === g.FIND_MY_STRUCTURES || type === g.FIND_STRUCTURES) return mine;
        return [];
    };
    return { h, g, creep, calls, run: () => h.load('creep.helper').run(creep) };
}

test('a helper takes the nearest source that still has a free harvesting tile', () => {
    let s = setup();
    s.run();
    assert.equal(s.creep.memory.targetSource, 'A', 'A is nearest and its one tile is free');
    s = setup({ others: [{ memory: { targetSource: 'A' } }] });
    s.run();
    assert.equal(s.creep.memory.targetSource, 'B', 'A\'s only tile is taken: B, not a queue at A');
    assert.deepEqual(plain(s.calls).filter(c => c[0] === 'travelTo')[0], ['travelTo', 'B', 1]);
});

test('beside a source that ran dry with some energy carried, it goes to build instead of standing there', () => {
    const site = { id: 'site', structureType: 'extension', progress: 0, progressTotal: 3000, pos: { x: 13, y: 12 } };
    const s = setup({ carry: { energy: 150 }, sites: [site], aEnergy: 0, others: Array.from({ length: 8 }, () => ({ memory: { targetSource: 'B' } })) });
    s.creep.pos.x = 11; s.creep.pos.y = 10;
    s.creep.memory.targetSource = 'A';
    s.creep.memory.currentState = 1;
    s.run();
    assert.equal(s.creep.memory.currentState, 2);
    assert.deepEqual(plain(s.calls).filter(c => c[0] !== 'travelTo'), [['build', 'site']]);
    assert.equal(s.creep.memory.targetSource, undefined, 'its tile is released');
});

test('loose energy that fills the helper comes before harvesting', () => {
    const drop = { id: 'drop', resourceType: 'energy', amount: 500, pos: { x: 20, y: 20 } };
    const s = setup({ dropped: [drop] });
    s.run();
    assert.deepEqual(plain(s.calls).slice(0, 2), [['pickup', 'drop'], ['travelTo', 'drop', 1]]);
    assert.equal(s.creep.memory.lootTarget, 'drop', 'claimed');
});

test('a little loose energy far away is not worth the walk; close by it is', () => {
    let s = setup({ dropped: [{ id: 'drop', resourceType: 'energy', amount: 300, pos: { x: 20, y: 20 } }] });
    s.run();
    assert.equal(s.creep.memory.targetSource, 'A', '300 of the 400 needed, 5 tiles away: harvest instead');
    s = setup({ dropped: [{ id: 'drop', resourceType: 'energy', amount: 100, pos: { x: 17, y: 17 } }] });
    s.run();
    assert.equal(s.creep.memory.lootTarget, 'drop', 'within 3: a cheap top-up');
});

test('energy another helper is already heading for is not chased by a second one', () => {
    const other = { memory: { lootTarget: 'drop' }, store: { getFreeCapacity: () => 400 } };
    const s = setup({ dropped: [{ id: 'drop', resourceType: 'energy', amount: 500, pos: { x: 20, y: 20 } }], others: [other] });
    s.run();
    assert.equal(s.creep.memory.lootTarget, undefined, 'only 100 left after its claim');
    assert.equal(s.creep.memory.targetSource, 'A');
});

test('a partial source container is withdrawn once, then the helper mines the rest of its load', () => {
    const s0 = setup({ tower: false });
    const container = { id: 'sourceBox', structureType: s0.g.STRUCTURE_CONTAINER,
        store: storeOf({ energy: 100 }, 2000), pos: { x: 41, y: 40, roomName: 'NEW',
            inRangeTo: (t, r) => range(container.pos, t.pos || t) <= r,
            findClosestByRange: list => list.slice().sort((a,b) => range(container.pos,a.pos)-range(container.pos,b.pos))[0] } };
    const s = setup({ tower: false, structures: [container] });
    s.creep.pos.x = 41; s.creep.pos.y = 40;
    s.run();
    assert.deepEqual(plain(s.calls), [['withdraw', 'sourceBox', 'energy']]);
    assert.equal(s.creep.store.energy, 100);
    assert.equal(s.creep.memory.targetSource, 'B');
    assert.equal(s.creep.memory.lootTarget, undefined);
    s.calls.length = 0; s.g.Game.time++; s.run();
    assert.deepEqual(plain(s.calls), [['harvest', 'B']]);
});

test('all helpers pour into one site: spawn/tower/extension first, then the furthest along', () => {
    const site = (id, type, progress, x) => ({ id, structureType: type, progress, progressTotal: 1000, pos: { x, y: 15 } });
    const s0 = setup();
    const T = s0.g;
    const sites = [site('road', T.STRUCTURE_ROAD, 900, 16), site('ext1', T.STRUCTURE_EXTENSION, 100, 17), site('ext2', T.STRUCTURE_EXTENSION, 600, 30), site('lab', T.STRUCTURE_LAB, 0, 18)];
    const s = setup({ carry: { energy: 400 }, sites });
    s.run();
    assert.equal(s.creep.memory.job.id, 'ext2', 'an extension, the one closest to done, even though further away');
    assert.deepEqual(plain(s.calls).find(c => c[0] === 'travelTo'), ['travelTo', 'ext2', 3], 'worked from range 3');
});

test('with every tile taken it spends what it carries, or waits out of the way', () => {
    const busy = [{ memory: { targetSource: 'A' } }, ...Array.from({ length: 8 }, () => ({ memory: { targetSource: 'B' } }))];
    let s = setup({ carry: { energy: 100 }, others: busy });
    s.run();
    assert.equal(s.creep.memory.currentState, 2, 'off to work with the 100 it has');
    s = setup({ others: busy });
    s.run();
    assert.notEqual(s.creep.memory.currentState, 2);
    assert.deepEqual(plain(s.calls).pop(), ['travelTo', 'A', 3], 'waits 3 tiles from the nearest source');
});

test('a helper working in place is parked (not pushed or pathed through); one on the move is not', () => {
    const s = setup();
    s.creep.pos.x = 11; s.creep.pos.y = 10;   // on A's harvesting tile
    s.run();
    assert.equal(s.creep.memory.onPoint, 1);
    s.creep.pos.x = 15; s.creep.pos.y = 15;
    s.creep.memory.targetSource = 'B';
    s.g.Game.time++;
    s.run();
    assert.equal(s.creep.memory.onPoint, undefined);
});

test('walls around the controller are brought to 10k hits per RCL; a blocked controller is not upgraded', () => {
    const s = setup({ carry: { energy: 400 } });
    const wall = { id: 'wall', structureType: s.g.STRUCTURE_WALL, hits: 5000, pos: { x: 25, y: 26, inRangeTo: () => true } };
    const room = s.creep.room;
    const find = room.find;
    room.find = type => (type === s.g.FIND_STRUCTURES ? [wall] : find(type));
    const get = s.g.Game.getObjectById;
    s.g.Game.getObjectById = id => (id === 'wall' ? wall : get(id));
    s.creep.repair = t => { s.calls.push(['repair', t.id]); return s.g.ERR_NOT_IN_RANGE; };
    s.creep.memory.currentState = 2;
    s.run();
    assert.deepEqual(plain(s.calls).slice(0, 2), [['repair', 'wall'], ['travelTo', 'wall', 3]], 'RCL2: up to 20k');
    wall.hits = 20000;
    room.controller.upgradeBlocked = 900;
    s.calls.length = 0;
    s.g.Game.time++;
    s.run();
    assert.ok(!plain(s.calls).some(c => c[0] === 'upgrade'), 'no upgrading while blocked');
});

test('siege helpers repair only spawn, tower, and supplier ramparts and stop at the siege cap', () => {
    const p = (x, y) => ({ x, y, roomName: 'NEW' });
    const s0 = setup({ tower: false });
    const g = s0.g;
    const structures = [
        { id: 'spawn', structureType: g.STRUCTURE_SPAWN, pos: p(10, 10), store: { getFreeCapacity: () => 0 } },
        { id: 'protected', structureType: g.STRUCTURE_RAMPART, pos: p(10, 10), hits: 1000, hitsMax: 10000000 },
        { id: 'unrelated', structureType: g.STRUCTURE_RAMPART, pos: p(11, 10), hits: 1, hitsMax: 10000000 }];
    const s = setup({ carry: { energy: 400 }, tower: false, structures });
    s.h.load('system.guardSquads').latch(s.creep.room, 'safe mode');
    s.creep.repair = t => { s.calls.push(['repair', t.id]); return s.g.ERR_NOT_IN_RANGE; };
    s.creep.memory.currentState = 2;
    s.run();
    assert.equal(s.creep.memory.job.id, 'protected');
    structures[1].hits = 250000;
    delete s.creep.memory.job; s.calls.length = 0; s.g.Game.time++; s.run();
    assert.ok(!s.calls.some(c => c[0] === 'repair'), 'the unrelated rampart and capped protected rampart are ignored');
});

test('a helper blocked on its way is never marked parked (two blocked helpers used to freeze each other: shardX E29N36)', () => {
    const site = { id: 'site', structureType: 'STRUCTURE_EXTENSION', progress: 1543, progressTotal: 3000, pos: { x: 3, y: 21 } };
    const s = setup({ carry: { energy: 400 }, sites: [site] });
    s.creep.pos.x = 4; s.creep.pos.y = 16;          // 5 away: has to walk
    s.creep.memory.onPoint = 1;                      // marked last tick
    s.creep.travelTo = () => s.g.OK;                 // blocked: no move happens
    s.run();
    assert.equal(s.creep.memory.onPoint, undefined, 'standing still because blocked is not working');
    s.creep.pos.x = 4; s.creep.pos.y = 19;           // in range 3 of the site now
    s.g.Game.time++;
    s.run();
    assert.equal(s.creep.memory.onPoint, 1, 'building in place: parked');
});

test('controller near downgrade but attack-blocked: the helper builds instead of retrying the upgrade (shardX E29N36)', () => {
    const site = { id: 'site', structureType: 'STRUCTURE_EXTENSION', progress: 1543, progressTotal: 3000, pos: { x: 3, y: 21 } };
    const s = setup({ carry: { energy: 400 }, sites: [site] });
    s.creep.pos.x = 4; s.creep.pos.y = 16;
    const controller = s.creep.room.controller;
    controller.ticksToDowngrade = 2808;
    controller.upgradeBlocked = 108;
    s.creep.upgradeController = () => { s.calls.push(['upgrade']); return s.g.ERR_INVALID_TARGET; };
    s.run();
    assert.ok(!plain(s.calls).some(c => c[0] === 'upgrade'), 'no upgrade attempts while blocked');
    assert.deepEqual(plain(s.calls).filter(c => c[0] === 'build' || c[0] === 'travelTo'), [['build', 'site'], ['travelTo', 'site', 3]]);
});

test('a job that fails outright moves the helper on to the next one', () => {
    const site = { id: 'site', structureType: 'STRUCTURE_EXTENSION', progress: 0, progressTotal: 3000, pos: { x: 15, y: 17 } };
    const s = setup({ carry: { energy: 400 }, sites: [site] });
    s.creep.build = () => { s.calls.push(['build']); return s.g.ERR_INVALID_TARGET; };   // e.g. a creep standing on it
    s.run();
    assert.ok(plain(s.calls).some(c => c[0] === 'upgrade'), 'falls through to upgrading');
    assert.equal(s.creep.memory.job && s.creep.memory.job.k, 'upgrade', 'the next job');
});

test('a helper keeps upgrading until it runs dry, even once the controller is out of downgrade danger and sites exist', () => {
    const site = { id: 'site', structureType: 'STRUCTURE_EXTENSION', progress: 0, progressTotal: 3000, pos: { x: 15, y: 17 } };
    const s = setup({ carry: { energy: 200 }, sites: [site] });
    s.creep.memory.currentState = 2;
    s.creep.memory.job = { k: 'upgrade' };
    s.creep.room.controller.ticksToDowngrade = 15000;   // recovered
    s.run();
    assert.ok(plain(s.calls).some(c => c[0] === 'upgrade'));
    assert.ok(!plain(s.calls).some(c => c[0] === 'build'), 'the site waits for the next load');
    s.creep.store = { getUsedCapacity: () => 0, getFreeCapacity: () => 400 };
    s.g.Game.time++;
    s.run();
    assert.equal(s.creep.memory.job, undefined, 'dry: the next load picks again');
});

test('a young room without a tower: upgrade before extension sites; the tower site first once there is one', () => {
    const ext = { id: 'ext', structureType: 'STRUCTURE_EXTENSION', progress: 1543, progressTotal: 3000, pos: { x: 15, y: 17 } };
    let s = setup({ carry: { energy: 400 }, sites: [ext], tower: false });
    s.run();
    assert.equal(s.creep.memory.job.k, 'upgrade', 'the half-built extension waits');
    const towerSite = { id: 'towerSite', structureType: 'STRUCTURE_TOWER', progress: 0, progressTotal: 5000, pos: { x: 16, y: 16 } };
    s = setup({ carry: { energy: 400 }, sites: [ext, towerSite], tower: false });
    s.run();
    assert.deepEqual(plain(s.creep.memory.job), { k: 'build', id: 'towerSite' });
});

test('spawns and extensions with room are filled first, so the room can make its own creeps', () => {
    const ext = { id: 'ext1', structureType: 'STRUCTURE_EXTENSION', store: { getFreeCapacity: () => 50 }, pos: { x: 16, y: 16 } };
    const site = { id: 'site', structureType: 'STRUCTURE_EXTENSION', progress: 0, progressTotal: 3000, pos: { x: 15, y: 17 } };
    const s = setup({ carry: { energy: 400 }, sites: [site], structures: [ext] });
    const transfers = [];
    s.creep.transfer = (t) => { transfers.push(t.id); return s.g.ERR_NOT_IN_RANGE; };
    s.run();
    assert.deepEqual(transfers, ['ext1']);
    assert.deepEqual(plain(s.creep.memory.job), { k: 'fill', id: 'ext1' });
});
