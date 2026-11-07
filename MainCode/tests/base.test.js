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

test('labs: all 10 in reaction range of the 2 inputs, and the lab worker reaches them from 2 road tiles', () => {
    const result = plan(terrain(() => false), OPEN);
    const labs = result.structures.lab;
    assert.equal(new Set(labs).size, 10);
    const [a, b] = [labs[3], labs[4]];
    labs.forEach((lab, i) => { if (i !== 3 && i !== 4) assert.ok(cheb(lab, a) <= 2 && cheb(lab, b) <= 2, 'lab ' + i); });
    const hubs = result.roads.filter(r => cheb(r, a) === 1 && cheb(r, b) === 1);
    assert.equal(hubs.length, 2);
    for (const lab of labs) assert.ok(hubs.some(hub => cheb(lab, hub) === 1), 'beside a road tile');
    assert.equal(cheb(hubs[0], hubs[1]), 1);
});

test('a plan from before the 10-lab stamp gets new lab tiles once, keeping its standing labs; new plans need none', () => {
    const { g, room, builder } = builderRoom(8);
    builder.planRoom(room);
    const stored = g.Memory.basePlan.W1N1;
    assert.equal(stored.lf, 1, 'a new plan has them in range');
    g.Game.cpu.bucket = 5000;
    assert.equal(builder.refitDue(stored), false);
    // A plan with no lf mark: its standing labs, already all in range here, stay.
    const old = builder.planOf('W1N1').structures.lab;
    delete stored.lf;
    const labs = old.map((t, n) => ({ id: 'lab' + n, structureType: g.STRUCTURE_LAB, my: true, pos: { x: X(t), y: Y(t) } }));
    room.find = type => (type === g.FIND_STRUCTURES || type === g.FIND_MY_STRUCTURES ? labs : []);
    g.Game.map.getRoomTerrain = () => ({ get: () => 0 });
    assert.equal(builder.refitDue(stored), true);
    g.Game.time += 10;
    assert.equal(builder.refitLabs(room), true);
    assert.equal(stored.lf, 1);
    assert.equal(builder.refitDue(stored), false, 'once');
    const now = builder.planOf('W1N1').structures.lab;
    assert.deepEqual(plain(now).slice().sort(), plain(old).slice().sort(), 'already all in range: every lab stays');
});

test('one due room looks for a step each tick; a room with nothing due does not hold the turn', () => {
    const { builder } = builderRoom(8);
    const turn = builder.migrationTurn;
    assert.equal(turn(true, false, true), 'step', 'a step in progress always advances');
    assert.equal(turn(false, true, false), 'look');
    assert.equal(turn(false, false, false), null, 'not due: the next room gets the turn');
    assert.equal(turn(false, true, true), null, 'one room a tick');
});

test('planned tiles behind terrain move once: a factory and an extension across a wall come back to the core side', () => {
    const { g, room, builder } = builderRoom(8);
    builder.planRoom(room);
    const stored = g.Memory.basePlan.W1N1;
    const plan = builder.planOf('W1N1');
    const anchor = plan.anchor;
    const ax = X(anchor), ay = Y(anchor);
    // A wall column 6 east of the core, closed but for a far gap; the tiles beyond are a long walk away.
    const wallX = ax + 6, beyondFactory = I(wallX + 1, ay), beyondExt = I(wallX + 1, ay + 1);
    const gapY = ay < 25 ? 48 : 1;
    const isWall = (x, y) => x === wallX && y !== gapY;
    const terrain = { get: (x, y) => (isWall(x, y) ? g.TERRAIN_MASK_WALL : 0) };
    g.TERRAIN_MASK_WALL = 1;
    g.Game.map.getRoomTerrain = () => terrain;
    room.getTerrain = () => terrain;
    // Keep the plan's real tiles off the wall and beyond it, except the two under test.
    for (const kind in plan.structures) plan.structures[kind] = plan.structures[kind].filter(t => X(t) < wallX);
    plan.roads = plan.roads.filter(t => X(t) < wallX);
    plan.paths = plan.paths.filter(t => X(t) < wallX);
    plan.structures.factory = [beyondFactory];
    plan.structures.extension = plan.structures.extension.slice(0, 20).concat(beyondExt);
    stored.s.factory = 'x'; stored.s.extension = 'x'; stored.r = ''; stored.p = '';
    const pack = list => list.map(t => String.fromCharCode(t + 48)).join('');
    for (const kind in plan.structures) stored.s[kind] = pack(plan.structures[kind]);
    stored.r = pack(plan.roads); stored.p = pack(plan.paths);
    g.Game.time += 10;
    g.Game.cpu.bucket = 5000;
    room.find = () => [];
    delete stored.bw;
    assert.equal(builder.behindDue(stored), true);
    const moved = builder.fixBehind(room);
    assert.equal(moved, 2);
    assert.equal(stored.bw, 1);
    assert.equal(builder.behindDue(stored), false, 'once');
    const after = builder.planOf('W1N1');
    for (const t of [...after.structures.factory, ...after.structures.extension]) assert.ok(X(t) < wallX, 'on the core side: ' + X(t));
    assert.equal(after.structures.extension.length, 21, 'none lost');
});

test('only a full room outside shardX moves its labs first', () => {
    const { g, room, builder } = builderRoom(8);
    g.Game.shard = { name: 'shard2' };
    assert.equal(builder.labsUrgent(room), true);
    g.Game.shard = { name: 'shardX' };
    assert.equal(builder.labsUrgent(room), false);
    g.Game.shard = { name: 'shard2' };
    room.controller.level = 7;
    assert.equal(builder.labsUrgent(room), false);
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
        getTerrain: () => g.Game.map.getRoomTerrain('W1N1'),
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
    assert.deepEqual([...new Set(removed)].sort(), ['rampart', 'road'], 'the stray rampart site at 3,3 goes');
});

test('every young room gets a rampart shell over its spawn, towers and storage only (below RCL8 not the Supply tile, even with a supplier)', () => {
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
    assert.ok(!at().includes(X(plan.flags.Supply) + ',' + Y(plan.flags.Supply)), 'below RCL8 the core only: not the Supply tile');
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
    const planned = plain(order.map(t => labs.find(l => X(t) === l.pos.x && Y(t) === l.pos.y).id));
    const got = plain(g.Memory.labList.W1N1);
    // The plan's boost labs; its stamp as reagents and outputs (the pair may be another stamp pair
    // when that also reaches a boost lab standing close: system.labLayout.arrange).
    assert.deepEqual(got.slice(0, 3), planned.slice(0, 3));
    assert.deepEqual(got.slice(3).sort(), planned.slice(3).sort());

    // One hand-built lab elsewhere: no plan order, but the reagent pair still reaches the stamp
    // (system.labLayout.arrange), and the far lab is a boost lab.
    labs.push({ id: 'manual', structureType: g.STRUCTURE_LAB, my: true, pos: { x: 3, y: 45 } });
    g.Game.time++;
    h.load('system.industry').updateRoomStructureLists(room);
    const list = plain(g.Memory.labList.W1N1);
    assert.equal(list.length, 11);
    assert.ok(list.slice(0, 3).includes('manual'), 'the lab out of reach holds boosts');
    const at = id => labs.find(l => l.id === id).pos;
    const near = (p, q) => Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)) <= 2;
    const reached = list.filter((id, i) => i !== 3 && i !== 4 && near(at(id), at(list[3])) && near(at(id), at(list[4])));
    assert.ok(reached.length >= 5, 'the stamp pair reaches its 5 outputs: ' + reached.length);
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

test('a supported young room without a tower builds nothing but its spawn: controller first until RCL3', () => {
    const existing = [];
    const { g, room, sites, builder } = builderRoom(2, existing);
    g.Memory.expansion = { t: 'W1N1' };   // a sponsor's helpers carry it
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

// shardX room reclaimed after a loss: fortified until its second tower.
function fortifiedRoom(rcl, existing = []) {
    const r = builderRoom(rcl, existing);
    r.g.Game.shard.name = 'shardX';
    r.g.Memory.xs = { losses: { W1N1: 1 } };
    return r;
}
test('a reclaimed shardX room builds only towers (no spawn first), ramparts over them, and walls the controller in', () => {
    const existing = [];
    const { g, room, sites, builder } = fortifiedRoom(3, existing);
    const removed = [];
    room.find = (find => type => (type === g.FIND_MY_CONSTRUCTION_SITES
        ? [{ structureType: g.STRUCTURE_EXTENSION, progress: 500, pos: { x: 2, y: 2 }, remove: () => removed.push('extension') },
            { structureType: g.STRUCTURE_SPAWN, progress: 0, pos: { x: 3, y: 3 }, remove: () => removed.push('spawn') }]
        : find(type)))(room.find);
    builder.planRoom(room);
    builder.buildRoom(room);
    const types = sites.map(s => s[2]);
    assert.ok(types.includes(g.STRUCTURE_TOWER), 'its tower');
    assert.ok(!types.includes(g.STRUCTURE_SPAWN) && !types.includes(g.STRUCTURE_EXTENSION), JSON.stringify(types));
    assert.ok(types.includes(g.STRUCTURE_WALL), 'controller walls even with the controller near the base');
    assert.deepEqual(removed.sort(), ['extension', 'spawn'], 'started sites for anything else go');
    // The tower stands: its rampart, still nothing else.
    const t = builder.planOf(room.name).structures.tower[0];
    existing.push({ structureType: g.STRUCTURE_TOWER, my: true, pos: { x: X(t), y: Y(t), roomName: room.name, lookFor: () => [] } });
    sites.length = 0;
    builder.buildRoom(room);
    assert.deepEqual(sites.filter(s => s[2] !== g.STRUCTURE_WALL).map(s => s[2]), [g.STRUCTURE_RAMPART]);
});
test('the fortified build ends with the second tower; rooms never lost (or on other shards) are not fortified', () => {
    const { h, g, room } = fortifiedRoom(5, []);
    const x = h.load('system.shardX');
    assert.equal(x.fortified(room), true);
    room.find = type => (type === g.FIND_MY_STRUCTURES ? [1, 2].map(i => ({ structureType: g.STRUCTURE_TOWER, id: 't' + i })) : []);
    h.load('runtime.cache').invalidateRoom(room.name);
    assert.equal(x.fortified(room), false, 'two towers: the normal build resumes');
    const other = builderRoom(5, []);
    other.g.Game.shard.name = 'shardX';
    assert.equal(other.h.load('system.shardX').fortified(other.room), false, 'never lost');
    const mmo = builderRoom(5, []);
    mmo.g.Memory.xs = { losses: { W1N1: 1 } };
    assert.equal(mmo.h.load('system.shardX').fortified(mmo.room), false, 'shardX only');
});

test('a young room on its own (no sponsor) builds its extensions at RCL2 without waiting for a tower', () => {
    const existing = [];
    const { g, room, sites, builder } = builderRoom(2, existing);
    builder.planRoom(room);
    const t = builder.planOf(room.name).structures.spawn[0];
    existing.push({ structureType: g.STRUCTURE_SPAWN, my: true, pos: { x: X(t), y: Y(t), roomName: room.name, lookFor: () => [] } });
    builder.buildRoom(room);
    assert.ok(sites.filter(s => s[2] === g.STRUCTURE_EXTENSION).length > 0, JSON.stringify(sites.map(s => s[2])));
});

test('hardened shardX rooms (fortified before, RCL5+): an outer rampart ring round the planned base, ramparts and walls repaired freely', () => {
    const { harness } = require('./harness');
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Game.shard = { name: 'shardX' };
    g.RESOURCE_ENERGY = 'energy';
    const room = { name: 'X', controller: { my: true, level: 5, pos: { x: 25, y: 30 } },
        getTerrain: () => ({ get: () => 0 }), find: () => [] };
    const shardX = h.load('system.shardX');
    assert.equal(shardX.hardened(room), false, 'never fortified');
    g.Memory.xs = { fortify: { X: 1 } };
    assert.equal(shardX.hardened(room), true);
    room.controller.level = 4;
    assert.equal(shardX.hardened(room), false, 'below RCL5');
    room.controller.level = 5;
    // A 5x5 base at 23..27 x 23..27 (anchor 25,25), the controller at 25,30 (ring 24..26 x 29..31).
    const tiles = [];
    for (let x = 23; x <= 27; x++) for (let y = 23; y <= 27; y++) tiles.push(x * 50 + y);
    const plan = { anchor: 25 * 50 + 25, structures: { extension: tiles }, roads: [] };
    const ring = h.load('base.builder').ringTiles(room, plan);
    const has = (x, y) => ring.r.includes(x * 50 + y);
    assert.ok(has(22, 22) && has(28, 28) && has(22, 25) && has(25, 22), 'all round the base');
    assert.ok(has(23, 32) && has(27, 32), 'and round the controller');
    assert.ok(!has(25, 25) && !has(24, 24), 'not inside');
    assert.ok(has(23, 28) && has(27, 28) && !has(25, 28), 'the gap between base and controller is sealed at its two ends, not ramparted along');
    assert.equal(plan.ring, ring, 'kept with the plan');
    assert.equal(ring.w.length, 0, 'no walls while its repairers keep up');
    // Repairs: no cap; ramparts and walls always count.
    assert.equal(h.load('system.guardSquads').rampartCap(room), Infinity);
    const needsRepair = h.load('spawn.BuildCreeps').needsRepair;
    assert.equal(needsRepair({ structureType: g.STRUCTURE_WALL, room, hits: 50000, hitsMax: 300000000 }), true);
    assert.equal(needsRepair({ structureType: g.STRUCTURE_RAMPART, room, hits: 400000, hitsMax: 3000000 }), true);
});

test('the ring never runs next to an exit (nothing can be built there): the barrier moves onto the base; ramparts only, never walls', () => {
    const { harness } = require('./harness');
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    // A base against the north edge (W1N9): rows 2..6, the edge row 0 open at x 20..30.
    const terrain = { get: (x, y) => (y === 0 && (x < 20 || x > 30) ? 1 : x === 0 || x === 49 || y === 49 ? 1 : 0) };
    const room = { name: 'X', controller: null, getTerrain: () => terrain, find: () => [] };
    const tiles = [];
    for (let x = 22; x <= 28; x++) for (let y = 2; y <= 6; y++) tiles.push(x * 50 + y);
    const plan = { anchor: 25 * 50 + 4, structures: { extension: tiles }, roads: [] };
    const builder = h.load('base.builder');
    const ring = builder.ringTiles(room, plan);
    const all = ring.r.concat(ring.w);
    const exitNear = t => { const x = (t / 50) | 0, y = t % 50; return y <= 1 && x >= 19 && x <= 31; };
    assert.ok(!all.some(exitNear), 'nothing next to the open edge');
    assert.ok(ring.r.includes(25 * 50 + 2), 'the base\'s own top row is ramparted instead');
    assert.ok(ring.r.includes(25 * 50 + 7), 'and the ring runs on round the rest');
    assert.equal(ring.w.length, 0, 'no walls (an alternating wall ring left W1N9 defenders no posts)');
    // A ring kept from the wall days is recomputed as ramparts.
    plan.ring = Object.assign({}, ring, { w: [ring.r[0]], alt: true });
    assert.equal(builder.ringTiles(room, plan).w.length, 0);
});

test('a hardened room keeps repairers by its stored energy: 1 under 50k, 2 under 150k, 3 above', () => {
    const { harness } = require('./harness');
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.BODYPART_COST = { work: 100, carry: 50, move: 50, WORK: 100, CARRY: 50, MOVE: 50 };
    g.Game.shard = { name: 'shardX' };
    g.RESOURCE_ENERGY = 'energy';
    g.Memory.xs = { fortify: { X: 1 } };
    const room = energy => ({ name: 'X', controller: { my: true, level: 5 }, storage: { store: { energy } }, find: () => [] });
    const spawn = h.load('spawn.BuildCreeps');
    assert.equal(spawn.getRepairMax(room(20000)), 1);
    assert.equal(spawn.getRepairMax(room(113000)), 2);
    assert.equal(spawn.getRepairMax(room(400000)), 3);
});

test('below RCL8 no labs, factory or extractor: unstarted sites go, the extractor is not placed; at RCL8 they stay', () => {
    for (const rcl of [7, 8]) {
        const existing = [];
        const s = builderRoom(rcl, existing);
        const { g, room, builder } = s;
        builder.planRoom(room);
        buildCore(g, builder, room, existing);
        const removed = [];
        const labSite = { structureType: g.STRUCTURE_LAB, progress: 0, pos: { x: 1, y: 1 }, remove: () => removed.push('lab') };
        const startedFactory = { structureType: g.STRUCTURE_FACTORY, progress: 500, pos: { x: 2, y: 1 }, remove: () => removed.push('factory') };
        const find = room.find;
        room.find = type => (type === g.FIND_MY_CONSTRUCTION_SITES || type === g.FIND_CONSTRUCTION_SITES ? [labSite, startedFactory] : find(type));
        let extractor = false;
        const mineral = { pos: { x: 40, y: 10, roomName: 'W1N1', lookFor: () => [], createConstructionSite: () => { extractor = true; return g.OK; } } };
        room.find = (inner => type => (type === g.FIND_MINERALS ? [mineral] : inner(type)))(room.find);
        builder.buildRoom(room);
        if (rcl === 7) {
            assert.equal(removed.join(), 'lab', 'RCL7: the unstarted lab site goes; the started factory stays');
            assert.equal(extractor, false);
        } else {
            assert.equal(removed.length, 0, 'RCL8: kept');
        }
    }
});

test('build priority: no storage (or anything later) while extension sites are unfinished; then the storage', () => {
    const existing = [];
    const { g, room, sites, builder } = builderRoom(4, existing);
    builder.planRoom(room);
    buildCore(g, builder, room, existing);
    builder.buildRoom(room);
    const types = () => sites.map(s => s[2]);
    assert.ok(types().includes(g.STRUCTURE_EXTENSION));
    assert.ok(!types().includes(g.STRUCTURE_STORAGE), 'extensions first');
    // All 20 extensions built: the storage is next.
    const plan = builder.planOf(room.name);
    for (const t of plan.structures.extension.slice(0, 20)) {
        existing.push({ structureType: g.STRUCTURE_EXTENSION, my: true, pos: { x: X(t), y: Y(t), roomName: room.name, lookFor: () => [] } });
    }
    sites.length = 0;
    g.Memory.baseBuild = {};
    g.Game.time += 1;                // a new tick: the structure lists are read again
    builder.buildRoom(room);
    assert.ok(types().includes(g.STRUCTURE_STORAGE), 'then the storage: ' + types().join());
});

test('while extension sites are unfinished, an unstarted terminal site goes; a started one stays', () => {
    const existing = [];
    const { g, room, builder } = builderRoom(6, existing);
    builder.planRoom(room);
    buildCore(g, builder, room, existing);
    const plan = builder.planOf(room.name);
    const t2 = plan.structures.tower[1];
    existing.push({ structureType: g.STRUCTURE_TOWER, my: true, pos: { x: X(t2), y: Y(t2), roomName: room.name, lookFor: () => [] } });
    const removed = [];
    const fresh = { structureType: g.STRUCTURE_TERMINAL, progress: 0, pos: { x: 1, y: 1 }, remove: () => removed.push('fresh') };
    const started = { structureType: g.STRUCTURE_LINK, progress: 100, pos: { x: 2, y: 1 }, remove: () => removed.push('started') };
    const find = room.find;
    room.find = type => (type === g.FIND_MY_CONSTRUCTION_SITES || type === g.FIND_CONSTRUCTION_SITES ? [fresh, started] : find(type));
    builder.buildRoom(room);
    assert.equal(removed.join(), 'fresh');
});

test('below RCL8 an established room ramparts its spawns, towers and storage only, and unstarted ramparts elsewhere go', () => {
    const existing = [];
    const { g, room, sites, builder } = builderRoom(7, existing);
    room.terminal = { my: true, store: { energy: 0 } };          // established
    builder.planRoom(room);
    buildCore(g, builder, room, existing);
    const plan = builder.planOf(room.name);
    const ext = plan.structures.extension[0];
    existing.push({ structureType: g.STRUCTURE_EXTENSION, my: true, pos: { x: X(ext), y: Y(ext), roomName: room.name, lookFor: () => [] } });
    const removed = [];
    const stray = { structureType: g.STRUCTURE_RAMPART, progress: 0, pos: { x: X(ext), y: Y(ext) }, remove: () => removed.push('stray') };
    const find = room.find;
    room.find = type => (type === g.FIND_MY_CONSTRUCTION_SITES || type === g.FIND_CONSTRUCTION_SITES ? [stray] : find(type));
    builder.buildRoom(room, plan);
    const ramparts = sites.filter(s => s[2] === g.STRUCTURE_RAMPART).map(s => s[0] + ',' + s[1]);
    assert.ok(!ramparts.includes(X(ext) + ',' + Y(ext)), 'not over an extension');
    assert.equal(removed.join(), 'stray', 'the unstarted one over the extension goes');
});

test('the ring has depth tiles: footprint tiles within 2 of it, inside', () => {
    const { harness } = require('./harness');
    const h = harness();
    h.load('runtime.memory').ensureInitialized();
    const room = { name: 'X', controller: null, getTerrain: () => ({ get: () => 0 }), find: () => [] };
    const tiles = [];
    for (let x = 20; x <= 30; x++) for (let y = 20; y <= 30; y++) tiles.push(x * 50 + y);
    const plan = { anchor: 25 * 50 + 25, structures: { extension: tiles }, roads: [] };
    const ring = h.load('base.builder').ringTiles(room, plan);
    const d = new Set(ring.d);
    assert.ok(ring.r.includes(19 * 50 + 25), 'the ring just outside');
    assert.ok(d.has(20 * 50 + 25) && d.has(21 * 50 + 25) && d.has(21 * 50 + 21), 'two tiles in');
    assert.ok(!d.has(22 * 50 + 25) && !d.has(25 * 50 + 25), 'not further');
    assert.ok(!ring.d.some(t => ring.r.includes(t)), 'not the ring itself');
});

// A finished 11x11 base (extensions), established; returns the rampart sites one pass places.
function ringPass(rcl, { storage = true, extraRamparts = [], extra = [], ring, tower = true, terminal = true } = {}) {
    const { harness } = require('./harness');
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    g.CONTROLLER_STRUCTURES = {};
    g.CONTROLLER_STRUCTURES[g.STRUCTURE_EXTENSION] = { 7: 200, 8: 200 };
    g.Game.map.getRoomTerrain = () => ({ get: (x, y) => (x === 0 || y === 0 || x === 49 || y === 49 ? 1 : 0) });
    const pos = (x, y) => ({ x, y, roomName: 'R', lookFor: () => [] });
    const tiles = [];
    // Column 21 (rows 22..28) left open: ground inside the base, within 2 of the ring.
    for (let x = 20; x <= 30; x++) for (let y = 20; y <= 30; y++) if (!(x === 21 && y >= 22 && y <= 28)) tiles.push(x * 50 + y);
    const supply = 25 * 50 + 25;
    const ext = tiles.filter(t => t !== supply);
    const structures = ext.map(t => ({ structureType: g.STRUCTURE_EXTENSION, my: true, pos: pos((t / 50) | 0, t % 50) }));
    if (tower) structures.push({ structureType: g.STRUCTURE_TOWER, my: true, pos: pos(24, 24) });
    const store = storage ? { structureType: g.STRUCTURE_STORAGE, my: true, pos: pos(26, 26), store: { energy: 100000 } } : null;
    for (const t of extraRamparts) structures.push({ structureType: g.STRUCTURE_RAMPART, my: true, pos: pos((t / 50) | 0, t % 50) });
    const destroyed = [];
    for (const [t, type, hits] of extra) structures.push({ structureType: g['STRUCTURE_' + type], my: true, pos: pos((t / 50) | 0, t % 50), hits,
        destroy: () => { destroyed.push(t); return g.OK; } });
    const placed = [];
    const room = { name: 'R', terminal: terminal ? { my: true } : undefined, storage: store || undefined, controller: { my: true, level: rcl, pos: pos(25, 45) },
        getTerrain: () => g.Game.map.getRoomTerrain('R'),
        find: type => (type === g.FIND_STRUCTURES || type === g.FIND_MY_STRUCTURES ? structures : []),
        createConstructionSite: (x, y, type) => { placed.push([x * 50 + y, type]); return g.OK; }, createFlag: () => g.OK };
    g.Game.rooms.R = room;
    g.Game.constructionSites = {};
    const builder = h.load('base.builder');
    const plan = { mode: 'adopt', anchor: 25 * 50 + 25, flags: { Supply: supply }, roads: [], paths: [], structures: { extension: ext }, ring };
    builder.buildRoom(room, plan);
    return { ramparts: placed.filter(p => p[1] === g.STRUCTURE_RAMPART).map(p => p[0]), walls: placed.filter(p => p[1] === g.STRUCTURE_WALL).map(p => p[0]), ring: plan.ring, supply, ext, destroyed };
}

test('from RCL6, terminal or not, once a tower stands: a one-tile rampart ring outside the base; RCL8: two tiles deeper, and every structure', () => {
    const young = ringPass(6, { terminal: false });
    assert.ok(young.ring.r.some(t => young.ramparts.includes(t)), 'RCL6 with no terminal yet: ring sites');
    assert.equal(ringPass(5).ramparts.filter(t => (ringPass(7).ring.r).includes(t)).length, 0, 'not below RCL6');
    const towerless = ringPass(6, { tower: false });
    assert.ok(!towerless.ramparts.some(t => ringPass(7).ring.r.includes(t)), 'no tower to fight from behind it: no ring yet');
    const at7 = ringPass(7);
    assert.ok(at7.ramparts.length > 0, 'ring sites');
    const tower = 24 * 50 + 24;
    assert.ok(at7.ramparts.every(t => at7.ring.r.includes(t) || t === at7.supply || t === tower), 'only ring tiles (the Supply tile, the core): ' + at7.ramparts);
    assert.ok(at7.ramparts.includes(at7.supply), 'the Supply tile, the storage standing');
    assert.ok(!at7.ramparts.some(t => at7.ring.d.includes(t)), 'no depth yet');
    // RCL8 with every structure and the ring ramparted already: the depth tiles go down.
    const done = at7.ext.concat(at7.ring.r, [at7.supply]);
    const at8 = ringPass(8, { extraRamparts: done });
    assert.ok(at8.ramparts.length > 0 && at8.ramparts.every(t => at8.ring.d.includes(t)), 'depth tiles: ' + at8.ramparts);
    assert.ok(at8.ramparts.every(t => ((t / 50) | 0) === 21), 'the open ground inside (the structures had theirs)');
});

test('before RCL8 the Supply tile is ramparted only once the storage stands', () => {
    const r = ringPass(6, { storage: false });
    assert.ok(!r.ramparts.includes(r.supply));
    assert.ok(ringPass(6).ramparts.includes(r.supply));
});

// shardX W1N9: gaps in the ring where a road was built on a wall tile, and on edge tiles under its
// extensions (the ring moved onto the base beside an exit).
test('every ring tile gets a rampart, over a structure or road; an old ring wall is swapped for one while the ring holds', () => {
    const t = (x, y) => x * 50 + y;
    const ring = { r: [t(19, 25), t(20, 20), t(19, 24), t(19, 26)], w: [], d: [], n: 4, at: 1 };
    let r = ringPass(7, { ring, extra: [[t(19, 24), 'ROAD'], [t(19, 25), 'CONTAINER'], [t(19, 26), 'WALL']] });
    assert.ok(r.ramparts.includes(t(19, 24)) && r.ramparts.includes(t(19, 25)) && r.ramparts.includes(t(20, 20)), 'ramparts over a road, a container, an extension');
    assert.deepEqual(r.walls, [], 'no walls placed');
    assert.deepEqual(r.destroyed, [t(19, 26)], 'the old wall goes, its rampart next pass');
    // A ring rampart still weak: the wall waits.
    r = ringPass(7, { ring, extra: [[t(19, 26), 'WALL'], [t(19, 25), 'RAMPART', 5000]] });
    assert.deepEqual(r.destroyed, [], 'the ring first: no wall swapped while a ring rampart is under 100k');
});

// Stray cleanup (clearStrays): ramparts only over structures, the Supply tile and the ring; our
// structures off a fresh plan go one per pass; never in a migrating room (ramparts still are).
function strayRoom({ migration = false, mode = 'fresh', hostiles = 0 } = {}) {
    const { harness } = require('./harness');
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    const t = (x, y) => x * 50 + y;
    const gone = [];
    const mk = (type, x, y, extra = {}) => Object.assign({ structureType: g['STRUCTURE_' + type], my: true, pos: { x, y }, hits: 5000,
        destroy() { gone.push(type + '@' + x + ',' + y); return g.OK; } }, extra);
    const structures = [
        mk('SPAWN', 20, 20), mk('SPAWN', 21, 20), mk('RAMPART', 20, 20),           // over a structure: stays
        mk('RAMPART', 30, 30),                                                         // stray, low: goes
        mk('RAMPART', 31, 31, { hits: 50000000 }),                                     // stray, established: goes once the ring holds
        mk('RAMPART', 25, 26),                                                         // the Supply tile: stays
        mk('EXTENSION', 10, 10, { store: { getUsedCapacity: r => (r ? 50 : 50) } }),   // off the plan: goes
        mk('STORAGE', 12, 12, { store: { getUsedCapacity: r => (r ? 1000 : 1000) } }), // off the plan, not empty: stays
    ];
    const room = { name: 'R', controller: { my: true, level: 5, pos: { x: 40, y: 40 } },   // below the ring (RCL6)
        find: type => type === g.FIND_MY_STRUCTURES ? structures : type === g.FIND_HOSTILE_CREEPS ? new Array(hostiles).fill({}) : [] };
    g.Game.rooms.R = room;
    const plan = { mode, migration, anchor: t(25, 25), flags: { Supply: t(25, 26) }, roads: [], paths: [],
        structures: { spawn: [t(20, 20), t(21, 20)], extension: [t(11, 11)], storage: [t(26, 26)] } };
    const builder = h.load('base.builder');
    return { run: () => builder.clearStrays(room, plan), gone };
}

test('with the ring standing, established stray ramparts and off-ring walls go; ring walls and shardX controller walls stay', () => {
    const { harness } = require('./harness');
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Game.shard = { name: 'shard2' };
    const t = (x, y) => x * 50 + y;
    const gone = [];
    const mk = (type, x, y, hits) => ({ id: type + x + y, structureType: g['STRUCTURE_' + type], my: type !== 'WALL', pos: { x, y }, hits,
        destroy() { gone.push(type + '@' + x + ',' + y); return g.OK; } });
    const ringTilesList = [t(10, 10), t(10, 11), t(10, 12), t(10, 13), t(10, 14)];
    const ringRamparts = ringTilesList.slice(0, 4).map(k => mk('RAMPART', (k / 50) | 0, k % 50, 200000));
    const stray = mk('RAMPART', 30, 30, 50000000), strayWall = mk('WALL', 31, 31, 90000000), ringWall = mk('WALL', 10, 14, 90000000), byController = mk('WALL', 39, 39, 90000000);
    const list = [...ringRamparts, stray, strayWall, ringWall, byController];
    const room = { name: 'R', storage: { pos: { x: 25, y: 25 } }, controller: { my: true, level: 8, pos: { x: 40, y: 40 } }, find: type => {
        if (type === g.FIND_MY_STRUCTURES) return list.filter(s => s.my);
        if (type === g.FIND_STRUCTURES) return list;
        return [];
    } };
    g.Game.rooms.R = room;
    const plan = { mode: 'fresh', migration: true, anchor: t(25, 25), flags: {}, roads: [], paths: [], structures: {},
        ring: { r: ringTilesList, w: [], d: [], n: 5, at: g.Game.time } };
    const builder = h.load('base.builder');
    assert.equal(builder.ringHolds(room, plan), true, '4 of 5 strong');
    builder.clearStrays(room, plan);
    assert.ok(gone.includes('RAMPART@30,30'));
    assert.ok(gone.includes('WALL@31,31'));
    assert.ok(!gone.includes('WALL@10,14'), 'on the ring: swapped for a rampart by the build pass');
    assert.ok(gone.includes('WALL@39,39'), 'an established room outside shardX has no use for it');
    gone.length = 0;
    g.Game.shard = { name: 'shardX' };
    g.Game.time++;
    builder.clearStrays(room, plan);
    assert.ok(!gone.includes('WALL@39,39'), 'on shardX it stays');
    // A ring not standing yet: only weak strays go.
    gone.length = 0;
    ringRamparts.forEach(s => { s.hits = 5000; });
    g.Game.time++;
    assert.equal(builder.ringHolds(room, plan), false);
    builder.clearStrays(room, plan);
    assert.ok(!gone.includes('RAMPART@30,30') && !gone.includes('WALL@31,31'), 'they may be all that covers a gap');
});

test('stray ramparts under 1M hits go; established ones, those over structures and on the Supply tile stay; misplaced structures go one per pass', () => {
    const s = strayRoom();
    s.run();
    assert.deepEqual(s.gone.slice().sort(), ['EXTENSION@10,10', 'RAMPART@30,30'], JSON.stringify(s.gone));
});

test('a migrating room: stray ramparts still go, structures stay; nothing at all with hostiles in the room', () => {
    let s = strayRoom({ migration: true });
    s.run();
    assert.deepEqual(s.gone, ['RAMPART@30,30']);
    s = strayRoom({ mode: 'adopt' });
    s.run();
    assert.deepEqual(s.gone, ['RAMPART@30,30'], 'adopted layouts keep their hand-built structures');
    s = strayRoom({ hostiles: 1 });
    s.run();
    assert.deepEqual(s.gone, []);
});

// shard2 E3N18: the base a tile off the room's west edge (terrain wall, no exit): the ring ramparted
// the whole corridor between them, though an enemy can only get in at its mouth.
test('a ring tile only reachable through other ring tiles is left out (a corridor sealed at its mouth)', () => {
    const { harness } = require('./harness');
    const h = harness();
    h.load('runtime.memory').ensureInitialized();
    // West edge (x 0) and north edge (y 0) are terrain walls; exits on the south and east.
    const room = { name: 'X', controller: null, getTerrain: () => ({ get: (x, y) => (x === 0 || y === 0 ? 1 : 0) }), find: () => [] };
    const tiles = [];
    for (let x = 2; x <= 10; x++) for (let y = 2; y <= 10; y++) tiles.push(x * 50 + y);
    const plan = { anchor: 6 * 50 + 6, structures: { extension: tiles }, roads: [] };
    const ring = h.load('base.builder').ringTiles(room, plan);
    const has = (x, y) => ring.r.includes(x * 50 + y) || ring.w.includes(x * 50 + y);
    assert.ok(!has(1, 5) && !has(1, 8) && !has(5, 1), 'inside the corridors: not needed');
    assert.ok(has(1, 11) && has(11, 1), 'their mouths are');
    assert.ok(has(11, 5) && has(5, 11), 'the open sides as before');
});

test('nothing for the base behind a terrain wall: E19N44\'s spawn at 36,30, near by range, a long walk round', () => {
    const { harness } = require('./harness');
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    // A wall band on row 31 from x 20 to 45: the storage south of it at 33,35, a pocket north of it.
    g.Game.map.getRoomTerrain = () => ({ get: (x, y) => (y === 31 && x >= 20 && x <= 45 ? 1 : 0) });
    const room = { name: 'E19N44', storage: { pos: { x: 33, y: 35 } } };
    const builder = h.load('base.builder');
    const plan = { anchor: 31 * 50 + 37 };
    assert.equal(builder.behindWall(room, plan, 36 * 50 + 30, g.STRUCTURE_SPAWN), true, 'range 5, walk round the band ~25');
    assert.equal(builder.behindWall(room, plan, 36 * 50 + 33, g.STRUCTURE_SPAWN), false, 'same side');
    assert.equal(builder.behindWall(room, plan, 36 * 50 + 30, g.STRUCTURE_LINK), false, 'links go where their job is');
});

test('a young RCL6 room keeps its ring ramparts at the shell cap: they count as protected, so they get repaired', () => {
    const { h, g, room, builder } = builderRoom(6);
    builder.planRoom(room);
    const guards = h.load('system.guardSquads');
    const ring = builder.ringTiles(room, builder.planOf(room.name)).r;
    assert.ok(ring.length > 0);
    const rampart = (tile, hits) => ({ structureType: g.STRUCTURE_RAMPART, pos: { x: X(tile), y: Y(tile), roomName: room.name }, hits });
    assert.equal(guards.protectedRampart(room, rampart(ring[0], 100)), true, 'on the ring');
    assert.equal(guards.shellRampartDue(room, rampart(ring[0], 100)), true, 'below the 50k cap: due');
    assert.equal(guards.shellRampartDue(room, rampart(ring[0], 60000)), false, 'at its cap: left');
    const off = [X(ring[0]) * 50 + 1].find(t => !ring.includes(t));
    assert.equal(guards.protectedRampart(room, rampart(off, 100)), false, 'a stray rampart is not');
});

test('a ring three-quarters built is finished whatever the storage holds; a new one, or a finished one, is not', () => {
    const { harness } = require('./harness');
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Game.time = 5000;
    const tiles = Array.from({ length: 8 }, (_, i) => (10 + i) * 50 + 10);
    const plan = { anchor: 25 * 50 + 25, structures: {}, roads: [], paths: [], flags: {}, ring: { r: tiles, w: [], d: [], n: tiles.length, at: g.Game.time } };
    let ramparts = [];
    const room = { name: 'R', controller: { my: true, level: 7 }, find: (type, opts) => (type === g.FIND_MY_STRUCTURES ? ramparts : []) };
    const builder = h.load('base.builder');
    const at = n => tiles.slice(0, n).map((t, i) => ({ id: 'r' + i, structureType: g.STRUCTURE_RAMPART, my: true, pos: { x: (t / 50) | 0, y: t % 50 } }));
    const check = n => { ramparts = at(n); g.Game.time++; plan.ring.at = g.Game.time; return builder.ringNearlyDone(room, plan); };
    assert.equal(check(2), false, 'a quarter: the energy rule decides');
    assert.equal(check(6), true, 'three-quarters: finish it');
    assert.equal(check(7), true);
    assert.equal(check(8), false, 'complete: nothing to do');
});

test('swamp tiles of the ring get roads; plain ones do not; they count as the base\'s roads', () => {
    const { harness } = require('./harness');
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.TERRAIN_MASK_SWAMP = 2;
    g.Game.time = 7000;
    const tiles = [10 * 50 + 10, 11 * 50 + 10, 12 * 50 + 10];
    g.Game.map.getRoomTerrain = () => ({ get: (x, y) => (x === 11 && y === 10 ? 2 : 0) });
    const plan = { anchor: 25 * 50 + 25, structures: {}, roads: [99], paths: [], flags: {}, ring: { r: tiles, w: [], d: [12 * 50 + 11], n: 3, at: g.Game.time } };
    const room = { name: 'R', controller: { my: true, level: 7 }, find: () => [] };
    const builder = h.load('base.builder');
    assert.deepEqual(plain(builder.ringSwampRoads(room, plan)), [11 * 50 + 10]);
    room.controller.level = 5;
    assert.deepEqual(plain(builder.ringSwampRoads(room, plan)), [], 'no ring yet');
});

test('below RCL8: structures inside the ring that ranged attackers outside it reach get ramparts; deeper ones and roads do not', () => {
    const { harness } = require('./harness');
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.TERRAIN_MASK_WALL = 1;
    g.Game.time = 9000;
    // A ring: the square x/y 10..30.
    const r = [];
    for (let i = 10; i <= 30; i++) r.push(i * 50 + 10, i * 50 + 30, 10 * 50 + i, 30 * 50 + i);
    const plan = { anchor: 20 * 50 + 20, structures: {}, roads: [], flags: {}, ring: { r: [...new Set(r)], w: [], d: [], n: 0, at: 1 } };
    const s = (type, x, y) => ({ structureType: type, pos: { x, y } });
    const E = g.STRUCTURE_EXTENSION;
    const structures = [s(E, 12, 20), s(E, 12, 13), s(E, 14, 20), s(g.STRUCTURE_SPAWN, 20, 20), s(g.STRUCTURE_ROAD, 11, 20), s(E, 5, 5)];
    const room = { name: 'R', controller: { my: true, level: 7 }, getTerrain: () => ({ get: () => 0 }),
        find: type => (type === g.FIND_MY_STRUCTURES ? structures : []) };
    const builder = h.load('base.builder');
    const tile = (x, y) => x * 50 + y;
    // 12,20 and 12,13: 3 from the outside (x 9). 14,20: 5 from it. 5,5: outside the ring. The road: bare.
    assert.deepEqual(plain(builder.ringCover(room, plan, plan.ring)), [tile(12, 20), tile(12, 13)].sort((a, b) => a - b));
});
