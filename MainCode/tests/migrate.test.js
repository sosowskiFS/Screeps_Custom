const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

const h0 = harness();
const M = h0.load('base.migrate');
const P = h0.load('base.planner');
const { I, cheb } = P;

// Planned: towers at 1,2; extensions at 3,4,5; terminal at 6; spawn at 7.
const PLAN = { structures: { tower: [1, 2], extension: [3, 4, 5], terminal: [6], spawn: [7, 9], powerSpawn: [8] }, paths: [99], flags: { Supply: 98 } };
function state(built, extra = {}) {
    return Object.assign({ plan: PLAN, built, siteTiles: new Set(), roomSites: 0, globalSites: 0,
        energy: 500000, storageFree: 500000, hostiles: false, operatorTtl: undefined }, extra);
}
const b = (id, kind, tile, more = {}) => Object.assign({ id, kind, tile, used: 0, spawning: false }, more);

test('blockers go first: an extension on a planned tower tile moves before other misplaced pieces', () => {
    const built = [b('ext-on-tower', 'extension', 1), b('ext-elsewhere', 'extension', 40), b('tower-a', 'tower', 41),
        b('tower-b', 'tower', 42), b('tower-c', 'tower', 43)];
    assert.deepEqual(plain(M.chooseStep(state(built))), { id: 'ext-on-tower', kind: 'extension', tile: 1, evacuate: false });
    // Something on a kept-clear path or the Supply tile is a blocker too.
    const onPath = [b('ext-path', 'extension', 99), b('ext-x', 'extension', 40)];
    assert.equal(M.chooseStep(state(onPath)).id, 'ext-path');
});

test('nothing moves with hostiles around, without site headroom, or without energy for the rebuild', () => {
    const built = [b('e1', 'extension', 40), b('e2', 'extension', 41)];
    assert.equal(M.chooseStep(state(built, { hostiles: true })), null);
    assert.equal(M.chooseStep(state(built, { globalSites: 90 })), null);
    assert.equal(M.chooseStep(state(built, { energy: 30000 })), null, '2 x 3000 + 30k needed');
    assert.equal(M.chooseStep(state(built)).id, 'e1');
});

test('a structure only moves if its replacement has a free planned tile (cheap blockers excepted)', () => {
    // All three extension tiles hold misplaced towers: extensions elsewhere cannot move yet...
    const built = [b('t1', 'tower', 3), b('t2', 'tower', 4), b('t3', 'tower', 5), b('e1', 'extension', 40)];
    const step = M.chooseStep(state(built, { siteTiles: new Set([1, 2]) }));
    assert.equal(step, null, 'tower tiles have sites, extension tiles have towers');
    // ...but a misplaced extension sitting on a needed tile can be cleared even without one.
    const blocking = [b('e-block', 'extension', 6), b('e2', 'extension', 3), b('e3', 'extension', 4), b('e4', 'extension', 5)];
    assert.equal(M.chooseStep(state(blocking)).id, 'e-block');
});

test('important buildings: spawns, towers, power spawn, terminal guards', () => {
    const towers = n => Array.from({ length: n }, (_, i) => b('t' + i, 'tower', 50 + i));
    assert.equal(M.chooseStep(state(towers(2))), null, 'two towers always stay up');
    assert.equal(M.chooseStep(state(towers(3))).kind, 'tower');
    assert.equal(M.chooseStep(state(towers(3), { roomSites: 1 })), null, 'only when builders have nothing else to do');

    assert.equal(M.chooseStep(state([b('s1', 'spawn', 60)])), null, 'never the only spawn');
    assert.equal(M.chooseStep(state([b('s1', 'spawn', 60, { spawning: true }), b('s2', 'spawn', 7)])), null, 'not while spawning');
    assert.equal(M.chooseStep(state([b('s1', 'spawn', 60), b('s2', 'spawn', 7)])).id, 's1');

    const ps = [b('ps', 'powerSpawn', 70)];
    assert.equal(M.chooseStep(state(ps, { operatorTtl: 1200 })), null, 'operator could not renew during the rebuild');
    assert.equal(M.chooseStep(state(ps, { operatorTtl: 4000 })).id, 'ps');

    const terminal = [b('term', 'terminal', 80, { used: 250000 })];
    assert.equal(M.chooseStep(state(terminal, { storageFree: 200000 })), null, 'storage cannot take its contents');
    assert.deepEqual(plain(M.chooseStep(state(terminal))), { id: 'term', kind: 'terminal', tile: 80, evacuate: true });
    assert.equal(M.chooseStep(state([b('term', 'terminal', 80, { used: 1000 })])).evacuate, false, 'nearly empty: just move it');
});

test('a room already on its layout has nothing to move', () => {
    const s = state([b('t1', 'tower', 1), b('t2', 'tower', 2), b('e', 'extension', 3), b('road', 'road', 40), b('c', 'container', 41)]);
    assert.equal(M.chooseStep(s), null);
    assert.equal(s.misplaced, 0, 'roads and containers off the plan are left alone');
});

// ---------------------------------------------------------------- game side

function room() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    const objects = {};
    const destroyed = [];
    const structures = [];
    const mk = (id, type, x, y, store) => {
        const s = { id, structureType: type, my: true, pos: { x, y, roomName: 'R', isNearTo: () => false },
            store: Object.assign({ getUsedCapacity: () => store || 0 }, {}), destroy: () => { destroyed.push(id); return g.OK; } };
        objects[id] = s;
        structures.push(s);
        return s;
    };
    const r = { name: 'R', storage: { store: { energy: 500000, getFreeCapacity: () => 500000 } },
        find: (type, opts) => {
            if (type === g.FIND_STRUCTURES || type === g.FIND_MY_STRUCTURES) {
                const filter = opts && opts.filter;
                return filter && filter.structureType ? structures.filter(s => s.structureType === filter.structureType) : structures.slice();
            }
            return [];
        } };
    g.Game.rooms.R = r;
    g.Game.getObjectById = id => objects[id] || null;
    g.Game.constructionSites = {};
    g.Game.time = 1000;
    const kindOf = { [g.STRUCTURE_EXTENSION]: 'extension', [g.STRUCTURE_TERMINAL]: 'terminal', [g.STRUCTURE_TOWER]: 'tower' };
    return { h, g, r, mk, objects, structures, destroyed, kindOf, migrate: h.load('base.migrate') };
}

test('a step: empty the terminal, destroy it, ask for the rebuild, finish when the new one stands', () => {
    const { g, r, mk, structures, destroyed, kindOf, migrate } = room();
    const term = mk('term', g.STRUCTURE_TERMINAL, 30, 30, 250000);
    const plan = { structures: { terminal: [I(20, 20)] }, paths: [], flags: {} };
    const rebuilds = [];
    migrate.runRoom(r, plan, kindOf, name => rebuilds.push(name));
    assert.equal(g.Memory.baseMigrate.R.step.phase, 'evacuate');
    assert.equal(migrate.evacuationTarget('R'), 'term', 'lab worker is told to empty it');

    // Still full: wait. Emptied: destroyed, rebuild requested.
    g.Game.time++;
    migrate.runRoom(r, plan, kindOf, name => rebuilds.push(name));
    assert.deepEqual(destroyed, []);
    term.store.getUsedCapacity = () => 100;
    g.Game.time++;
    migrate.runRoom(r, plan, kindOf, name => rebuilds.push(name));
    assert.deepEqual(destroyed, ['term']);
    assert.deepEqual(rebuilds, ['R']);
    assert.equal(migrate.evacuationTarget('R'), undefined);

    // The old one is gone; the step finishes once the replacement is built.
    structures.splice(structures.indexOf(term), 1);
    g.Game.time += 50;
    migrate.runRoom(r, plan, kindOf, () => {});
    assert.ok(g.Memory.baseMigrate.R.step, 'still rebuilding');
    mk('term2', g.STRUCTURE_TERMINAL, 20, 20, 0);
    g.Game.time++;
    migrate.runRoom(r, plan, kindOf, () => {});
    assert.equal(g.Memory.baseMigrate.R.step, undefined);
    assert.ok(g.Memory.baseMigrate.R.next > g.Game.time, 'cooldown before the next step');
});

test('steps start at most every 20 ticks empire-wide; a finished room is marked done', () => {
    const { g, r, mk, kindOf, migrate } = room();
    mk('e1', g.STRUCTURE_EXTENSION, 30, 30);
    mk('e2', g.STRUCTURE_EXTENSION, 31, 31);
    const plan = { structures: { extension: [I(20, 20), I(21, 21)] }, paths: [], flags: {} };
    g.Memory.baseMigrateLast = g.Game.time - 5;
    migrate.runRoom(r, plan, kindOf, () => {});
    assert.equal(g.Memory.baseMigrate.R.step, undefined);

    const done = room();
    done.mk('e1', done.g.STRUCTURE_EXTENSION, 20, 20);
    done.migrate.runRoom(done.r, { structures: { extension: [I(20, 20)] }, paths: [], flags: {} }, done.kindOf, () => {});
    assert.ok(done.g.Memory.baseMigrate.R.done);
});

test('migration target: the core forms around the existing storage', () => {
    const walls = new Uint8Array(2500);
    for (let x = 0; x < 50; x++) for (let y = 0; y < 50; y++) if (x === 0 || y === 0 || x === 49 || y === 49) walls[I(x, y)] = 1;
    const storage = I(30, 30);
    const typeAt = { [storage]: 'storage', [I(32, 30)]: 'source', [I(10, 40)]: 'source', [I(25, 10)]: 'controller' };
    const result = P.plan({ walls, typeAt, sources: [I(32, 30), I(10, 40)], controller: I(25, 10), requireStorage: storage });
    assert.equal(result.mode, 'fresh');
    assert.equal(result.structures.storage[0], storage);
    assert.equal(cheb(result.flags.Supply, storage), 1);
});

test('lab worker empties the structure being moved into the storage', () => {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Memory.baseMigrate = { R: { step: { id: 'term', phase: 'evacuate' } } };
    const terminal = { id: 'term', store: { X: 5000 } };
    const storage = { id: 'storage', store: { getFreeCapacity: () => 100000 } };
    g.Game.getObjectById = id => ({ term: terminal })[id];
    const calls = [];
    const creep = { name: 'lw', room: { name: 'R', terminal, storage }, memory: { priority: 'labWorker', deathWarn: 0 }, ticksToLive: 1000,
        store: {}, carry: {}, pos: { x: 1, y: 1, findInRange: () => [], lookFor: () => [] },
        withdraw: (t, r) => { calls.push(['withdraw', t.id, r]); return g.OK; },
        transfer: (t, r) => { calls.push(['transfer', t.id, r]); return g.OK; },
        travelTo: () => {}, say: () => {} };
    const lw = h.load('creep.labWorker');
    lw.run(creep);
    creep.store = { X: 1000 };
    lw.run(creep);
    assert.deepEqual(plain(calls), [['withdraw', 'term', 'X'], ['transfer', 'storage', 'X']]);
});

test('roads are never planned, kept or repaired on wall tiles (tunnels)', () => {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Game.map.getRoomTerrain = () => ({ get: (x, y) => (x === 10 && y === 10 ? g.TERRAIN_MASK_WALL : 0) });
    const roads = h.load('system.roads');
    assert.equal(roads.isPriority('R', 10, 10), false, 'a tunnel is left to decay');
    assert.equal(roads.isPriority('R', 11, 10), true);
});
