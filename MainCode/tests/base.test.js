const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

const h0 = harness();
const P = h0.load('base.planner');
const { I, X, Y, cheb, neighbors } = P;

// Room terrain: border walls with an exit gap on each side, plus `wall(x, y)`.
function terrain(wall) {
    const walls = new Uint8Array(2500);
    for (let x = 0; x < 50; x++) for (let y = 0; y < 50; y++) {
        const edge = x === 0 || y === 0 || x === 49 || y === 49;
        const exit = edge && ((x > 20 && x < 26) || (y > 20 && y < 26));
        if ((edge && !exit) || wall(x, y)) walls[I(x, y)] = 1;
    }
    return walls;
}
function plan(walls, ctx, typeAt = {}) {
    const all = Object.assign({}, typeAt);
    for (const s of ctx.sources) all[s] = 'source';
    if (ctx.controller !== undefined) all[ctx.controller] = 'controller';
    if (ctx.mineral !== undefined) all[ctx.mineral] = 'mineral';
    return P.plan(Object.assign({ walls, typeAt: all }, ctx));
}
function tilesOf(result) {
    const all = new Map();
    for (const kind in result.structures) for (const t of result.structures[kind]) {
        assert.ok(!all.has(t), `two structures on ${X(t)},${Y(t)}`);
        all.set(t, kind);
    }
    return all;
}
// Every structure touches a tile creeps can reach from the core once everything is built.
function assertReachable(walls, result, typeAt = {}) {
    const all = tilesOf(result);
    const blocked = i => walls[i] || all.has(i) || typeAt[i];
    const seeds = [];
    for (const t of all.keys()) for (const n of neighbors(t)) if (!blocked(n)) seeds.push(n);
    const core = result.flags.storageMiner !== undefined ? result.flags.storageMiner : seeds[0];
    const r = P.bfs([core], i => !blocked(i));
    // The core ring is served from the enclosed Supply tile (the supplier spawns straight into it).
    const core3x3 = t => result.flags.Supply !== undefined && cheb(t, result.flags.Supply) === 1;
    for (const [t, kind] of all) assert.ok(core3x3(t) || neighbors(t).some(n => r.dist[n] >= 0), `${kind} at ${X(t)},${Y(t)} cut off`);
    for (const road of result.roads) assert.ok(!all.has(road), 'road under a structure');
    for (const path of result.paths) assert.ok(!all.has(path), 'structure on a kept-clear path');
    return r;
}

const OPEN = { sources: [I(10, 10), I(40, 40)], controller: I(25, 8), mineral: I(40, 10) };

test('core: Supply centre, storage + spawn + 6 towers ring, miner tile touching storage and source', () => {
    const walls = terrain(() => false);
    const result = plan(walls, OPEN);
    const { Supply, storageMiner } = result.flags;
    const s = result.structures;
    assert.equal(result.mode, 'fresh');
    const ring = [s.storage[0], s.spawn[0], ...s.tower];
    assert.equal(new Set(ring).size, 8);
    for (const t of ring) assert.equal(cheb(t, Supply), 1, 'ring of the 3x3');
    assert.equal(cheb(storageMiner, s.storage[0]), 1);
    assert.equal(cheb(storageMiner, OPEN.sources[0]) === 1 || cheb(storageMiner, OPEN.sources[1]) === 1, true);
    assert.ok(cheb(storageMiner, Supply) === 2, 'miner tile outside the core');
    const counts = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.length]));
    assert.deepEqual(counts, { spawn: 3, tower: 6, extension: 60, link: 4, terminal: 1, factory: 1, powerSpawn: 1, nuker: 1, observer: 1, storage: 1, lab: 10 });
    assertReachable(walls, result);
});

test('labs: 3 boost labs, then 2 inputs and 5 outputs packed so every output reacts', () => {
    const result = plan(terrain(() => false), OPEN);
    const labs = result.structures.lab;
    const [a, b] = [labs[3], labs[4]];
    for (const out of labs.slice(5)) assert.ok(cheb(out, a) <= 2 && cheb(out, b) <= 2);
    // The 7 reaction labs ring one road tile the lab worker can stand on to reach all of them.
    const hub = result.roads.find(r => labs.slice(3).every(l => cheb(l, r) === 1));
    assert.ok(hub !== undefined);
});

test('a room with only a 3x3 + miner tile beside its source still gets a full base in its other space', () => {
    // Source pocket: open 3x3 at 6..8,6..8 plus the miner tile, joined to the rest of the room by
    // a 1-wide corridor; the old generator needed a free 7x7 around the core.
    const pocket = (x, y) => (x >= 6 && x <= 8 && y >= 6 && y <= 8) || (x === 9 && y === 6);
    const corridor = (x, y) => y === 7 && x >= 9 && x <= 14;
    const walls = terrain((x, y) => x <= 14 && y <= 14 && !pocket(x, y) && !corridor(x, y));
    const ctx = { sources: [I(10, 5)], controller: I(30, 30), mineral: I(40, 10) };
    const result = plan(walls, ctx);
    assert.ok(result, 'planned');
    assert.equal(result.flags.Supply, I(7, 7));
    assert.equal(result.structures.extension.length, 60);
    assert.equal(result.structures.lab.length, 10);
    assertReachable(walls, result);
});

test('no 3x3 + miner tile next to any source: no plan (retried later), nothing half-built', () => {
    const walls = terrain((x, y) => !(x >= 20 && x <= 30 && y >= 20 && y <= 30));
    assert.equal(plan(walls, { sources: [I(10, 10)], controller: I(25, 25), mineral: I(26, 26) }), null);
});

test('links land where system.industry gives them the right roles', () => {
    const result = plan(terrain(() => false), OPEN);
    const [source1, controllerLink, source2, storageLink] = result.structures.link;
    const storage = result.structures.storage[0];
    // updateRoomStructureLists: controller (<=4) first, then storage (<=3), then source (<=3).
    assert.ok(cheb(controllerLink, OPEN.controller) <= 2);
    assert.ok(cheb(storageLink, OPEN.controller) > 4 && cheb(storageLink, storage) <= 3);
    for (const link of [source1, source2]) {
        assert.ok(cheb(link, OPEN.controller) > 4 && cheb(link, storage) > 3);
        assert.equal(cheb(link, result.flags.upgradeMiner), 1, 'beside the upgrade miner');
    }
});

test('a hand-placed first spawn becomes the core spawn; established rooms are adopted around their storage', () => {
    const walls = terrain(() => false);
    const first = plan(walls, OPEN);
    const spawnAt = first.structures.spawn[0];
    const withSpawn = plan(walls, OPEN, { [spawnAt]: 'spawn' });
    assert.equal(withSpawn.structures.spawn[0], spawnAt);

    const typeAt = { [I(30, 20)]: 'storage', [I(31, 21)]: 'spawn', [I(29, 19)]: 'extension' };
    const adopted = plan(walls, OPEN, typeAt);
    assert.equal(adopted.mode, 'adopt');
    assert.equal(adopted.structures.storage, undefined, 'its storage stays');
    assert.deepEqual(plain(adopted.flags).Supply, undefined, 'no layout flags moved');
    for (const t of tilesOf(adopted).keys()) assert.ok(!typeAt[t], 'never planned over existing structures');
});

test('planning stays cheap enough to run one room per tick', () => {
    const walls = terrain((x, y) => (x * 7 + y * 13) % 11 === 0);
    const started = process.hrtime.bigint();
    for (let n = 0; n < 5; n++) plan(walls, OPEN);
    const ms = Number(process.hrtime.bigint() - started) / 1e6 / 5;
    assert.ok(ms < 40, `${ms.toFixed(1)} ms per room`);
});

// ---------------------------------------------------------------- builder

function builderRoom(rcl, existing = []) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.CONTROLLER_STRUCTURES = {
        spawn: [0, 1, 1, 1, 1, 1, 1, 2, 3], extension: [0, 0, 5, 10, 20, 30, 40, 50, 60], storage: [0, 0, 0, 0, 1, 1, 1, 1, 1],
        tower: [0, 0, 0, 1, 1, 2, 2, 3, 6], link: [0, 0, 0, 0, 0, 2, 3, 4, 6], terminal: [0, 0, 0, 0, 0, 0, 1, 1, 1],
        lab: [0, 0, 0, 0, 0, 0, 3, 6, 10], factory: [0, 0, 0, 0, 0, 0, 0, 1, 1], powerSpawn: [0, 0, 0, 0, 0, 0, 0, 0, 1],
        nuker: [0, 0, 0, 0, 0, 0, 0, 0, 1], observer: [0, 0, 0, 0, 0, 0, 0, 0, 1],
    };
    for (const k of ['spawn', 'extension', 'storage', 'tower', 'link', 'terminal', 'lab', 'factory', 'powerSpawn', 'nuker', 'observer']) {
        g.CONTROLLER_STRUCTURES[g['STRUCTURE_' + k.replace(/[A-Z]/g, c => '_' + c).toUpperCase()]] = g.CONTROLLER_STRUCTURES[k];
    }
    const walls = terrain(() => false);
    g.Game.map.getRoomTerrain = () => ({ get: (x, y) => walls[I(x, y)] });
    const pos = (x, y) => ({ x, y, roomName: 'W1N1', lookFor: () => [], createConstructionSite: () => g.OK });
    const sites = [];
    const flags = [];
    const room = { name: 'W1N1', controller: { my: true, level: rcl, pos: pos(25, 8) },
        find: type => {
            if (type === g.FIND_SOURCES) return OPEN.sources.map(t => ({ pos: pos(X(t), Y(t)) }));
            if (type === g.FIND_MINERALS) return [{ pos: pos(40, 10) }];
            if (type === g.FIND_STRUCTURES || type === g.FIND_MY_STRUCTURES) return existing;
            return [];
        },
        createConstructionSite: (x, y, type) => { sites.push([x, y, type]); return g.OK; },
        createFlag: (x, y, name) => { flags.push(name); return name; } };
    g.Game.rooms.W1N1 = room;
    g.Game.constructionSites = {};
    return { h, g, room, sites, flags, builder: h.load('base.builder') };
}

// The planned spawn and tower built (so the builder moves past its spawn- and tower-first focus).
function buildCore(g, builder, room, existing) {
    const plan = builder.planOf(room.name);
    for (const kind of ['spawn', 'tower']) {
        const t = plan.structures[kind][0];
        existing.push({ structureType: kind === 'spawn' ? g.STRUCTURE_SPAWN : g.STRUCTURE_TOWER, my: true,
            pos: { x: X(t), y: Y(t), roomName: room.name, lookFor: () => [] } });
    }
}

test('a room without a spawn gets only its spawn site first', () => {
    const { g, room, sites, builder } = builderRoom(3);
    builder.planRoom(room);
    builder.buildRoom(room);
    assert.deepEqual(sites.map(s => s[2]).filter(t => t !== g.STRUCTURE_WALL), [g.STRUCTURE_SPAWN], 'besides the controller walls');
});

test('a tower the controller level now allows is placed before anything else', () => {
    const existing = [];
    const { g, room, sites, builder } = builderRoom(3, existing);
    builder.planRoom(room);
    const plan = builder.planOf(room.name);
    const t = plan.structures.spawn[0];
    existing.push({ structureType: g.STRUCTURE_SPAWN, my: true, pos: { x: X(t), y: Y(t), roomName: room.name, lookFor: () => [] } });
    builder.buildRoom(room);
    assert.deepEqual(sites.map(s => s[2]).filter(t => t !== g.STRUCTURE_WALL && t !== g.STRUCTURE_RAMPART), [g.STRUCTURE_TOWER], 'RCL3 allows one tower: only it (and the controller walls), no extensions yet');
    assert.deepEqual(sites.filter(s => s[2] === g.STRUCTURE_RAMPART).map(s => s[0] + ',' + s[1]), [X(t) + ',' + Y(t)], 'the spawn\'s shell rampart');
});

test('a young room (no terminal) gets no road sites and no ramparts off its shell, and loses the ones it had', () => {
    const existing = [];
    const { g, room, sites, builder } = builderRoom(5, existing);
    const removed = [];
    room.find = (find => type => (type === g.FIND_MY_CONSTRUCTION_SITES
        ? [{ structureType: g.STRUCTURE_ROAD, pos: { x: 2, y: 2 }, remove: () => removed.push('road') },
            { structureType: g.STRUCTURE_RAMPART, pos: { x: 3, y: 3 }, remove: () => removed.push('rampart') }]
        : find(type)))(room.find);
    builder.planRoom(room);
    buildCore(g, builder, room, existing);
    existing.push({ structureType: g.STRUCTURE_TOWER, my: true, pos: { x: 1, y: 1, roomName: room.name, lookFor: () => [] } });   // RCL5: 2 towers
    builder.buildRoom(room);
    const types = sites.map(s => s[2]);
    assert.ok(!types.includes(g.STRUCTURE_ROAD));
    const shell = new Set(existing.map(s => s.pos.x + ',' + s.pos.y));
    assert.ok(sites.filter(s => s[2] === g.STRUCTURE_RAMPART).every(s => shell.has(s[0] + ',' + s[1])), 'ramparts only over the shell');
    assert.deepEqual(removed, ['road', 'rampart'], 'the stray rampart site at 3,3 goes');
});

test('every young room gets a rampart shell over its spawn, towers and storage, and the Supply tile once a supplier stands there', () => {
    const existing = [];
    const { g, room, sites, builder } = builderRoom(5, existing);
    builder.planRoom(room);
    buildCore(g, builder, room, existing);
    const plan = builder.planOf(room.name);
    const st = plan.structures.storage[0];
    existing.push({ structureType: g.STRUCTURE_STORAGE, my: true, pos: { x: X(st), y: Y(st), roomName: room.name, lookFor: () => [] } });
    builder.buildRoom(room, plan);   // not attacked
    const at = () => sites.filter(s => s[2] === g.STRUCTURE_RAMPART).map(s => s[0] + ',' + s[1]).sort();
    assert.deepEqual(at(), existing.map(s => s.pos.x + ',' + s.pos.y).sort(), 'no supplier yet: no Supply-tile rampart');
    sites.length = 0;
    g.Game.time++;
    g.Game.creeps.sup = { name: 'sup', memory: { priority: 'supplier', homeRoom: room.name } };
    builder.buildRoom(room, plan);
    assert.ok(at().includes(X(plan.flags.Supply) + ',' + Y(plan.flags.Supply)), 'the supplier spawned: its tile too');
});

test('the shell is kept at 50k hits, 250k once the room has been attacked, and no cap once established', () => {
    const { h, g, room } = builderRoom(5, []);
    const guards = h.load('system.guardSquads');
    assert.equal(guards.rampartCap(room), 50000);
    guards.latch(room, 'attacked');
    assert.equal(guards.rampartCap(room), 250000);
    room.terminal = { my: true };
    assert.equal(guards.rampartCap(room), Infinity);
});

test('builder places only what the RCL allows, a few sites per pass, plus the layout flags', () => {
    const existing = [];
    const { g, room, sites, flags, builder } = builderRoom(3, existing);
    builder.planRoom(room);
    buildCore(g, builder, room, existing);
    builder.buildRoom(room);
    const types = sites.map(s => s[2]);
    assert.ok(sites.length <= 10, 'site budget per pass');
    assert.equal(types.filter(t => t === g.STRUCTURE_SPAWN).length, 0, 'the one RCL3 spawn is built');
    assert.equal(types.filter(t => t === g.STRUCTURE_STORAGE).length, 0, 'storage needs RCL4');
    assert.ok(types.filter(t => t === g.STRUCTURE_EXTENSION).length > 0);
    assert.deepEqual(flags.sort(), ['W1N1Supply', 'W1N1storageMiner', 'W1N1upgradeMiner']);
    assert.ok(g.Memory.autoBuildRooms.includes('W1N1'), 'fresh layouts get the auto-build supplier handling');
});

test('the CPU guard plans one room per tick and only when the governor allows', () => {
    const { g, builder } = builderRoom(3);
    g.Game.rooms.W2N2 = Object.assign({}, g.Game.rooms.W1N1, { name: 'W2N2' });
    g.Memory.cpuGov = { ema: 0, shed: 3, adjusted: 0, pixel: 0 };
    builder.run();
    assert.equal(Object.keys(g.Memory.basePlan || {}).length, 0, 'shedding: no planning');
    g.Memory.cpuGov.shed = 0;
    g.Game.cpu.bucket = 10000;
    builder.run();
    assert.equal(Object.keys(g.Memory.basePlan).length, 1);
    g.Game.time++;
    builder.run();
    assert.equal(Object.keys(g.Memory.basePlan).length, 2);
});

test('lab list follows planned roles (boost, reagents, outputs) once every lab is a planned one', () => {
    const { h, g, room, builder } = builderRoom(8);
    builder.planRoom(room);
    const order = builder.labOrder('W1N1');
    const labs = order.slice().reverse().map((t, n) => ({ id: 'lab' + n, structureType: g.STRUCTURE_LAB, my: true, pos: { x: X(t), y: Y(t) } }));
    room.find = type => type === g.FIND_MY_STRUCTURES || type === g.FIND_STRUCTURES ? labs : [];
    h.load('system.industry').updateRoomStructureLists(room);
    assert.deepEqual(plain(g.Memory.labList.W1N1), plain(order.map(t => labs.find(l => X(t) === l.pos.x && Y(t) === l.pos.y).id)));

    // One hand-built lab elsewhere: keep the old order untouched.
    labs.push({ id: 'manual', structureType: g.STRUCTURE_LAB, my: true, pos: { x: 3, y: 45 } });
    g.Game.time++;
    h.load('system.industry').updateRoomStructureLists(room);
    assert.deepEqual(plain(g.Memory.labList.W1N1), plain(labs.map(l => l.id)));
});

test('another player\'s leftovers in a room we claimed are destroyed and the room is replanned (shard3 E25N43)', () => {
    const { harness } = require('./harness');
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    const calls = [];
    const pos = (x, y) => ({ x, y, roomName: 'E25N43' });
    const theirs = (type, x, y) => ({ structureType: type, my: false, owner: { username: 'previousOwner' }, pos: pos(x, y),
        destroy: () => { calls.push(['destroy', type]); return g.OK; } });
    const structures = [theirs(g.STRUCTURE_STORAGE, 25, 21), theirs(g.STRUCTURE_TERMINAL, 27, 24),
        { structureType: g.STRUCTURE_CONSTRUCTED_WALL, pos: pos(10, 10), destroy: () => calls.push(['destroy', 'wall']) }];
    const sites = [{ structureType: g.STRUCTURE_SPAWN, my: true, pos: pos(24, 21), remove: () => calls.push(['remove', 'spawn site']) }];
    const room = { name: 'E25N43', controller: { my: true, level: 1 },
        find: type => (type === g.FIND_STRUCTURES ? structures : type === g.FIND_MY_CONSTRUCTION_SITES ? sites : []) };
    g.Memory.basePlan = { E25N43: { v: 1, m: 'adopt' } };
    const builder = h.load('base.builder');
    assert.equal(builder.clearLeftovers(room), true);
    assert.deepEqual(calls, [['destroy', g.STRUCTURE_STORAGE], ['destroy', g.STRUCTURE_TERMINAL], ['remove', 'spawn site']], 'neutral walls stay');
    assert.equal(g.Memory.basePlan.E25N43, undefined, 'replanned fresh');
});

test('a parked miner does not serve a power spawn; a boxed-in planned tile is moved (shard3 E29N43)', () => {
    const existing = [];
    const { g, room, sites, builder } = builderRoom(8, existing);
    const p = (x, y) => ({ x, y, roomName: 'W1N1', lookFor: () => [] });
    const add = (type, x, y) => existing.push({ structureType: type, my: true, pos: p(x, y) });
    // Around 27,12: towers 26,11 26,12, extension 28,11, spawn 28,12, factory 27,11, walls 27,13 28,13,
    // and the storage miner parked on 26,13.
    add(g.STRUCTURE_TOWER, 26, 11); add(g.STRUCTURE_TOWER, 26, 12); add(g.STRUCTURE_EXTENSION, 28, 11);
    add(g.STRUCTURE_SPAWN, 28, 12); add(g.STRUCTURE_FACTORY, 27, 11);
    add(g.STRUCTURE_WALL, 27, 13); add(g.STRUCTURE_WALL, 28, 13);
    g.Game.flags = { W1N1storageMiner: { pos: p(26, 13) } };
    const plan = { mode: 'fresh', anchor: I(25, 12), flags: {}, roads: [], paths: [], structures: { powerSpawn: [I(27, 12)] } };
    g.Memory.basePlan = { W1N1: { v: builder.VERSION, t: 1, s: { powerSpawn: builder.pack([I(27, 12)]) } } };

    const c = builder.liveState(room);
    builder.buildRoom(room, plan);
    const placed = sites.filter(s => s[2] === g.STRUCTURE_POWER_SPAWN).map(s => s[0] + ',' + s[1]);
    assert.equal(placed.length, 1);
    assert.notEqual(placed[0], '27,12', 'not on the boxed-in tile');
    const moved = builder.unpack(g.Memory.basePlan.W1N1.s.powerSpawn)[0];
    assert.equal(X(moved) + ',' + Y(moved), placed[0], 'the stored plan follows');
    assert.ok(c.req.service.has(I(26, 13)), 'the miner tile is a service tile');
});

test('a young room without a tower builds nothing but its spawn: controller first until RCL3', () => {
    const existing = [];
    const { g, room, sites, builder } = builderRoom(2, existing);
    const removed = [];
    const site = (type, x) => ({ structureType: type, progress: 0, pos: { x, y: 2 }, remove: () => removed.push(type) });
    room.find = (find => type => (type === g.FIND_MY_CONSTRUCTION_SITES
        ? [site(g.STRUCTURE_EXTENSION, 2), site(g.STRUCTURE_CONTAINER, 3)] : find(type)))(room.find);
    builder.planRoom(room);
    const t = builder.planOf(room.name).structures.spawn[0];
    existing.push({ structureType: g.STRUCTURE_SPAWN, my: true, pos: { x: X(t), y: Y(t), roomName: room.name, lookFor: () => [] } });
    builder.buildRoom(room);
    assert.deepEqual(sites.filter(s => s[2] !== g.STRUCTURE_WALL && s[2] !== g.STRUCTURE_RAMPART), [], 'RCL2, no tower possible yet: no extension sites (walls around the controller only)');
    assert.deepEqual(sites.filter(s => s[2] === g.STRUCTURE_RAMPART).map(s => s[0] + ',' + s[1]), [X(t) + ',' + Y(t)], 'and the spawn\'s shell rampart');
    assert.deepEqual(removed, [g.STRUCTURE_EXTENSION], 'the container for the miners stays');
});

test('a young room walls in a controller far from its base, except on planned tiles', () => {
    const existing = [];
    const { g, room, sites, builder } = builderRoom(2, existing);
    existing.push({ structureType: g.STRUCTURE_SPAWN, my: true, pos: { x: 25, y: 30, roomName: 'W1N1', lookFor: () => [] } });
    // Controller at 25,8; base core around 25,30. Planned: controller link 26,9, a road 24,7.
    const plan = { mode: 'fresh', anchor: I(25, 30), flags: {}, roads: [I(24, 7)], paths: [],
        structures: { spawn: [I(25, 30)], link: [I(26, 9)] } };
    builder.buildRoom(room, plan);
    const walls = sites.filter(s => s[2] === g.STRUCTURE_WALL).map(s => s[0] + ',' + s[1]).sort();
    assert.deepEqual(walls, ['24,8', '24,9', '25,7', '25,9', '26,7', '26,8'], 'the 8 neighbours minus the link and road tiles');
    sites.length = 0;
    plan.anchor = I(25, 12);   // base right next to it: no walls
    g.Memory.baseBuild = {};
    builder.buildRoom(room, plan);
    assert.deepEqual(sites.filter(s => s[2] === g.STRUCTURE_WALL), []);
});

test('while the controller is blocked from upgrading, a tower-less young room gets its other structures placed', () => {
    const existing = [];
    const { g, room, sites, builder } = builderRoom(2, existing);
    builder.planRoom(room);
    const t = builder.planOf(room.name).structures.spawn[0];
    existing.push({ structureType: g.STRUCTURE_SPAWN, my: true, pos: { x: X(t), y: Y(t), roomName: room.name, lookFor: () => [] } });
    room.controller.upgradeBlocked = 800;
    builder.buildRoom(room);
    assert.ok(sites.some(s => s[2] === g.STRUCTURE_EXTENSION), 'extensions to build instead of upgrading');
});
