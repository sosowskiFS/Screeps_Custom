const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

// Shard3 E29N43 as seen live: Spawn1 at 28,12 finishing a creep. Its exits: extensions at 28,11
// and 29,12, walls below, a factory site at 27,11, a stuck hauler at 27,12, an idle lab worker
// at 29,11.
function spawnSetup() {
    const h = harness(), g = h.context;
    const walls = new Set(['29,13', '28,13', '27,13']);
    const structures = { '28,11': g.STRUCTURE_EXTENSION, '29,12': g.STRUCTURE_EXTENSION };
    const sites = { '27,11': g.STRUCTURE_FACTORY };
    const moves = [];
    const creep = (name, x, y, memory = {}) => ({ name, my: true, spawning: false, fatigue: 0, memory, pos: { x, y },
        move: d => { moves.push([name, d]); return g.OK; } });
    const creeps = { '27,12': creep('farMule', 27, 12), '29,11': creep('labWorker', 29, 11) };
    const room = {
        getTerrain: () => ({ get: (x, y) => (walls.has(x + ',' + y) ? 1 : 0) }),
        lookForAt: (type, x, y) => {
            const k = x + ',' + y;
            if (type === g.LOOK_STRUCTURES) return structures[k] ? [{ structureType: structures[k], my: true }] : [];
            if (type === g.LOOK_CONSTRUCTION_SITES) return sites[k] ? [{ structureType: sites[k] }] : [];
            if (type === g.LOOK_CREEPS) return creeps[k] ? [creeps[k]] : [];
            return [];
        },
    };
    const spawn = { pos: { x: 28, y: 12 }, room, spawning: { remainingTime: 1, directions: [1, 2, 3, 4, 5, 6, 7, 8] } };
    h.load('traveler');
    return { g, spawn, creeps, moves, exit: h.load('spawn.exit') };
}

test('a spawn finishing a creep with every exit taken moves an idle creep one step outward', () => {
    const { spawn, moves, exit } = spawnSetup();
    const moved = exit.clearExit(spawn);
    assert.equal(moved && moved.name, 'labWorker');
    assert.deepEqual(moves, [['labWorker', 2]], 'to 30,10: away from the spawn');
});

test('nothing moves while an exit is free, before the last tick, or when only parked workers block', () => {
    let s = spawnSetup();
    delete s.creeps['29,11'];
    assert.equal(s.exit.clearExit(s.spawn), null);
    s = spawnSetup();
    s.spawn.spawning.remainingTime = 5;
    assert.equal(s.exit.clearExit(s.spawn), null);
    s = spawnSetup();
    s.creeps['29,11'].memory.atSpot = true;
    s.creeps['27,12'].memory.onPoint = true;
    assert.equal(s.exit.clearExit(s.spawn), null);
    assert.deepEqual(s.moves, []);
});

test('paths never plan through a parked worker (the storage miner on its tile)', () => {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Game.time = 10;
    class Matrix {
        constructor(data) { this.data = data ? Object.assign({}, data) : {}; }
        set(x, y, v) { this.data[x + ',' + y] = v; }
        get(x, y) { return this.data[x + ',' + y] || 0; }
        clone() { return new Matrix(this.data); }
    }
    g.PathFinder = { CostMatrix: Matrix };
    const miner = { my: true, pos: { x: 26, y: 13 }, memory: { priority: 'miner', atSpot: true } };
    const hauler = { my: true, pos: { x: 25, y: 14 }, memory: { priority: 'mule' } };
    const room = { name: 'E29N43', find: type => (type === g.FIND_MY_CREEPS ? [miner, hauler] : []) };
    const { Traveler } = h.load('traveler');
    const matrix = Traveler.getStructureMatrix(room);
    assert.equal(matrix.get(26, 13), 0xff, 'parked miner tile is blocked');
    assert.equal(matrix.get(25, 14), 0, 'a moving hauler is not');
});

test('a site that would leave a spawn exit tile cut off from the room is refused (E29N43 factory at 27,11)', () => {
    const h = harness();
    const c = h.load('base.connectivity');
    const I = (x, y) => x * 50 + y;
    const walkable = new Uint8Array(2500).fill(1);
    // Spawn 28,12; 27,12 is boxed in by towers (26,11 26,12), an extension (28,11), walls below
    // (27,13 28,13) and the parked storage miner at 26,13: its only way out is 27,11.
    for (const [x, y] of [[28, 12], [26, 11], [26, 12], [28, 11], [27, 13], [28, 13], [26, 13]]) walkable[I(x, y)] = 0;
    const req = c.requirements(walkable, { spawns: [I(28, 12)], sources: [], controller: undefined });
    const before = c.status(walkable, req);
    assert.ok(before.every(Boolean));
    assert.equal(c.blocks(walkable, req, before, I(27, 11)), true, 'would trap creeps spawned onto 27,12');
    assert.equal(c.blocks(walkable, req, before, I(27, 12)), false, 'building on the exit tile itself is fine');
    assert.equal(c.blocks(walkable, req, before, I(29, 11)), false, 'an ordinary exit with other ways out');
});

// shard1 E19N59 (live snapshot): mid-migration, new extensions at 35,47 36,47 37,47 went down
// while the old towers at 37,46 38,46 39,46 still stood, walling 37,47 into a dead corner.
function e19() {
    const h = harness();
    const c = h.load('base.connectivity');
    const room = require('./fixtures/E19N59.json');
    const walkable = new Uint8Array(2500).fill(1);
    for (const t of room.walls.concat(room.obstacles)) walkable[t] = 0;
    walkable[38 * 50 + 43] = 0;   // Supply tile (parked supplier)
    const req = c.requirements(walkable, Object.assign({}, room, { service: [38 * 50 + 43] }));
    return { c, room, walkable, req };
}

test('E19N59: the walled-in extension at 37,47 is detected; its neighbours are fine', () => {
    const { c, walkable, req } = e19();
    assert.equal(c.accessible(walkable, req, 37 * 50 + 47), false);
    assert.equal(c.accessible(walkable, req, 35 * 50 + 47), true);
    assert.equal(c.accessible(walkable, req, 36 * 50 + 46), true);
});

test('E19N59: the extension site at 36,47 that sealed the corner would now be refused', () => {
    const { c, walkable } = e19();
    walkable[36 * 50 + 47] = 1;   // before 36,47 was built
    const room = require('./fixtures/E19N59.json');
    const req = c.requirements(walkable, Object.assign({}, room, { service: [38 * 50 + 43] }));
    const before = c.status(walkable, req);
    assert.equal(c.accessible(walkable, req, 37 * 50 + 47), true, '37,47 reachable through 36,47');
    assert.equal(c.blocks(walkable, req, before, 36 * 50 + 47, true), true, 'cuts access to 37,47');
});
