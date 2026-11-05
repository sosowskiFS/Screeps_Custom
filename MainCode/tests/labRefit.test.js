const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');
const { refit } = require('../base.labRefit');

const I = (x, y) => x * 50 + y;
const cheb = (a, b) => Math.max(Math.abs(((a / 50) | 0) - ((b / 50) | 0)), Math.abs(a % 50 - b % 50));
const open = () => { const w = new Uint8Array(2500); for (let i = 0; i < 50; i++) { w[I(i, 0)] = w[I(i, 49)] = w[I(0, i)] = w[I(49, i)] = 1; } w[I(25, 0)] = w[I(25, 49)] = 0; return w; };
const inRange = labs => labs.every((t, i) => i === 3 || i === 4 || (cheb(t, labs[3]) <= 2 && cheb(t, labs[4]) <= 2));

// The old layout: a 3x3 of 7 labs around a road at 20,20 (entrance 20,19), 3 boost labs by the spawn.
function oldRoom(extra = {}) {
    const stamp = [I(19, 19), I(21, 19), I(19, 20), I(21, 20), I(19, 21), I(20, 21), I(21, 21)];
    const boost = [I(35, 35), I(36, 35), I(37, 35)];
    const lab = [...boost, ...stamp];
    return Object.assign({ walls: open(), structures: { lab, extension: [], spawn: [I(36, 37)] }, roads: [I(20, 20), I(20, 19)], paths: [], flags: {},
        live: lab.map(tile => ({ tile, type: 'lab' })), sources: [], anchor: I(30, 30) }, extra);
}

test('the old stamp stays: 3 labs move in beside it, all 10 in range of both reagents', () => {
    const r = refit(oldRoom());
    assert.equal(r.kept, 7);
    assert.equal(new Set(r.lab).size, 10);
    assert.ok(inRange(r.lab), r.lab.join());
    assert.ok(!r.lab.includes(I(20, 20)), 'the road the worker stands on stays');
    assert.ok(r.roads.includes(I(20, 20)));
});

test('extensions on the new tiles go to the tiles the labs leave; nothing else is used', () => {
    // Everything round the stamp is planned as extensions and built, except that towers close one side.
    const s = oldRoom();
    const ext = [];
    for (let x = 16; x <= 24; x++) for (let y = 16; y <= 24; y++) {
        const t = I(x, y);
        if (cheb(t, I(20, 20)) === 2 && x !== 20) ext.push(t);
    }
    s.structures.extension = ext;
    s.live.push(...ext.map(tile => ({ tile, type: 'extension' })));
    const r = refit(s);
    assert.ok(inRange(r.lab));
    assert.equal(r.extension.length, ext.length, 'same count');
    const moved = ext.filter(t => !r.extension.includes(t));
    const arrived = r.extension.filter(t => !ext.includes(t));
    assert.equal(moved.length, arrived.length);
    assert.ok(moved.every(t => r.lab.includes(t)));
    assert.ok(arrived.every(t => s.structures.lab.includes(t)), 'onto tiles labs leave');
    assert.equal(new Set(r.extension).size, r.extension.length);
    assert.ok(!r.lab.some(t => r.extension.includes(t)));
});

test('never on another building, a kept-clear path, a flag, a source tile or by the controller', () => {
    const s = oldRoom({ flags: { Supply: I(22, 20) }, paths: [I(18, 20), I(22, 19)], sources: [I(20, 16)], controller: I(23, 23) });
    s.structures.tower = [I(18, 19), I(18, 21)];
    s.live.push({ tile: I(22, 21), type: 'terminal' });
    const r = refit(s);
    if (r) {
        const banned = [I(22, 20), I(18, 20), I(22, 19), I(18, 19), I(18, 21), I(22, 21)];
        for (const t of r.lab) {
            assert.ok(!banned.includes(t), 'used ' + t);
            assert.ok(cheb(t, I(20, 16)) > 1, 'beside the source');
            assert.ok(cheb(t, I(23, 23)) > 2, 'by the controller');
        }
        assert.ok(inRange(r.lab));
    }
});

test('labs are not walled in, and a corridor stays open', () => {
    // A 1-wide corridor at y=25 is the only way east: labs on it would cut the spawn off.
    const walls = open();
    for (let y = 1; y < 49; y++) if (y !== 25) walls[I(30, y)] = 1;
    const s = oldRoom({ walls });
    const r = refit(s);
    assert.ok(r);
    assert.ok(!r.lab.includes(I(30, 25)));
    assert.ok(inRange(r.lab));
});

test('no room for 10 in range: null, and the plan stays', () => {
    const walls = new Uint8Array(2500).fill(1);
    for (let x = 10; x <= 12; x++) for (let y = 0; y <= 49; y++) walls[I(x, y)] = 0;
    assert.equal(refit({ walls, structures: { lab: [] }, roads: [], paths: [], flags: {}, live: [], sources: [] }), refit({ walls, structures: { lab: [] }, roads: [], paths: [], flags: {}, live: [], sources: [] }));
    const none = new Uint8Array(2500).fill(1);
    assert.equal(refit({ walls: none, structures: { lab: [] }, roads: [], paths: [], flags: {}, live: [], sources: [] }), null);
});

// ---------------------------------------------------------------- base.migrate: labs first
function migrateCase(extra = {}) {
    const h = harness();
    const migrate = h.load('base.migrate');
    const lab = [100, 101, 102], extension = [200], terminal = [300];
    const built = [
        { id: 'term', kind: 'terminal', tile: 999, used: 5000 },
        { id: 'oldLab', kind: 'lab', tile: 500, used: 2000 },
        { id: 'lab1', kind: 'lab', tile: 100, used: 0 },
        { id: 'lab2', kind: 'lab', tile: 101, used: 0 },
        { id: 'ext', kind: 'extension', tile: 102, used: 0 },
    ];
    return { migrate, s: Object.assign({ plan: { structures: { lab, extension, terminal }, paths: [], flags: {} }, built, siteTiles: new Set(), roomSites: 0,
        globalSites: 0, energy: 500000, storageFree: 500000, hostiles: false }, extra) };
}

test('labs first: what stands on a lab tile goes, then the lab; the terminal waits', () => {
    const { migrate, s } = migrateCase({ labsFirst: true });
    const first = migrate.chooseStep(s);
    assert.equal(first.id, 'ext', 'on a planned lab tile');
    assert.equal(first.fast, true);
    s.built = s.built.filter(b => b.id !== 'ext');
    const second = migrate.chooseStep(s);
    assert.equal(second.id, 'oldLab');
    assert.equal(second.evacuate, true, 'holding 2000 minerals');
    s.built = s.built.filter(b => b.id !== 'oldLab');
    const third = migrate.chooseStep(s);
    assert.equal(third.id, 'term', 'labs done: the terminal may move again');
    assert.equal(third.fast, undefined);
});

test('labs first holds from a lower storage; below the floor nothing else slips in ahead', () => {
    const { migrate, s } = migrateCase({ labsFirst: true, energy: 110000 });
    s.built = s.built.filter(b => b.id !== 'ext');
    assert.equal(migrate.chooseStep(s).id, 'oldLab', 'under the usual 130,000');
    s.energy = 90000;
    assert.equal(migrate.chooseStep(s), null);
});

test('holdLabs: labs and what stands on their tiles stay, the rest moves', () => {
    const { migrate, s } = migrateCase({ holdLabs: true });
    assert.equal(migrate.chooseStep(s).id, 'term');
    assert.ok(s.misplaced > 1, 'still counted, so the migration is not marked done');
});

test('a blocker with no free tile yet does not make the room wait for its rebuild', () => {
    const { migrate, s } = migrateCase({ labsFirst: true });
    s.plan.structures.extension = [500];   // the tile the lab leaves
    s.built.push({ id: 'ext2', kind: 'extension', tile: 201, used: 0 });
    const step = migrate.chooseStep(s);
    assert.equal(step.id, 'ext');
    assert.equal(step.noWait, true);
});

test('a lab being emptied is destroyed after the short timeout; its energy is no reason to wait', () => {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    const migrate = h.load('base.migrate');
    let destroyed = 0;
    const lab = { id: 'L', structureType: g.STRUCTURE_LAB, store: { energy: 2000, X: 900 }, destroy: () => { destroyed++; return g.OK; } };
    g.Game.getObjectById = () => lab;
    g.Game.time = 1000;
    const mem = { step: { id: 'L', kind: 'lab', tile: 1, phase: 'evacuate', t: 900, before: 10, fast: 1 } };
    const room = { name: 'R', find: () => [] };
    migrate.progress(room, mem, {}, () => {});
    assert.equal(destroyed, 0, 'still emptying');
    g.Game.time = 1201;
    migrate.progress(room, mem, {}, () => {});
    assert.equal(destroyed, 1);

    lab.store = { energy: 2000 };
    destroyed = 0;
    g.Game.time = 1300;
    mem.step = { id: 'L', kind: 'lab', tile: 1, phase: 'evacuate', t: 1299, before: 10, fast: 1 };
    migrate.progress(room, mem, {}, () => {});
    assert.equal(destroyed, 1, 'no minerals left: only energy');
});

// ---------------------------------------------------------------- operator targets
function labAt(id, x, y, mineral, amount) {
    return { id, pos: { x, y }, store: { energy: 2000 }, mineralType: mineral, mineralAmount: amount || 0, mineralCapacity: 3000, cooldown: 0 };
}
function operatorCase(job = { p: 'OH', a: 'O', b: 'H' }) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.LAB_REACTION_AMOUNT = 5;
    const labs = [labAt('f0', 10, 10), labAt('f1', 11, 10), labAt('f2', 12, 10), labAt('a', 11, 11, 'O', 1000), labAt('b', 12, 12, 'H', 1000),
        labAt('o0', 10, 11, 'OH', 500), labAt('o1', 10, 12, 'OH', 100), labAt('o2', 13, 11, 'X', 700), labAt('o3', 13, 12, 'OH', 2990), labAt('far', 30, 30)];
    const byId = Object.fromEntries(labs.map(l => [l.id, l]));
    g.Game.getObjectById = id => byId[id] || null;
    g.Game.rooms.R = { name: 'R', controller: { my: true, level: 8 }, terminal: { store: {} }, storage: { store: {} }, find: () => [] };
    g.Memory.labList.R = labs.map(l => l.id);
    g.Memory.labJobs = job ? { R: job } : {};
    return { g, labs, byId, layout: h.load('system.labLayout') };
}

test('operators pick labs the reaction runs in: in reach, right product or empty, with room; never the reagents', () => {
    const { layout } = operatorCase();
    const ids = plain(layout.operateTargets('R').map(l => l.id));
    assert.deepEqual(ids.slice().sort(), ['f0', 'f1', 'f2', 'o0', 'o1'].sort());
    assert.ok(ids.indexOf('o1') < ids.indexOf('o0'), 'most room first');
});

test('no reaction running, or reagents not loaded: no operator effect is spent', () => {
    let c = operatorCase(null);
    assert.equal(c.layout.operateTargets('R').length, 0, 'no job');
    c = operatorCase();
    c.byId.a.mineralType = 'L';
    assert.equal(c.layout.operateTargets('R').length, 0, 'the reagent lab holds the wrong mineral');
    c = operatorCase();
    c.byId.b.mineralAmount = 2;
    assert.equal(c.layout.operateTargets('R').length, 0, 'too little to react');
});

test('a lab being emptied to move neither reacts nor gets the effect', () => {
    const { g, layout } = operatorCase();
    g.Memory.baseMigrate = { R: { step: { id: 'o1', phase: 'evacuate' } } };
    assert.ok(!plain(layout.operateTargets('R').map(l => l.id)).includes('o1'));
    assert.ok(!plain(layout.reactionLabs('R').map(l => l.id)).includes('o1'));
});

test('arrange keeps the plan pair through a move, even when another pair ties', () => {
    const { layout } = operatorCase();
    const labs = [labAt('p', 20, 20), labAt('q', 21, 21), labAt('c', 20, 21), labAt('d', 21, 20), labAt('e', 19, 20), labAt('f', 22, 21)];
    const order = layout.arrange(labs, false, [labs[0], labs[1]]);
    assert.deepEqual(plain(order.slice(3, 5).map(l => l.id)), ['p', 'q']);
});

test('a lab tile behind terrain is never chosen', () => {
    const s = oldRoom({ behind: t => ((t / 50) | 0) >= 18 && ((t / 50) | 0) <= 24 });
    const r = refit(s);
    assert.ok(r);
    assert.ok(r.lab.every(t => ((t / 50) | 0) < 18 || ((t / 50) | 0) > 24));
    assert.ok(inRange(r.lab));
});

test('behind terrain goes first, then labs, then the rest', () => {
    const { migrate, s } = migrateCase({ labsFirst: true, behind: t => t === 999 });
    s.plan.structures.terminal = [300];
    const first = migrate.chooseStep(s);
    assert.equal(first.id, 'term', 'the terminal stands behind terrain');
    assert.equal(first.fast, true);
    s.built = s.built.filter(b => b.id !== 'term');
    assert.equal(migrate.chooseStep(s).id, 'ext', 'then what is on the lab tile');
});

// shard2 E26N32: a stray tower on the Supply tile, its other towers unfed.
function coreCase(extra = {}) {
    const h = harness();
    const migrate = h.load('base.migrate');
    const built = [
        { id: 'towerOnSupply', kind: 'tower', tile: 50, used: 0 },
        { id: 't1', kind: 'tower', tile: 11, used: 0 }, { id: 't2', kind: 'tower', tile: 12, used: 0 },
        { id: 'strayLab', kind: 'lab', tile: 60, used: 0 },
        { id: 'spawnOff', kind: 'spawn', tile: 70, used: 0 }, { id: 'spawnOff2', kind: 'spawn', tile: 71, used: 0 },
        { id: 'strayTerm', kind: 'terminal', tile: 80, used: 5000 },
    ];
    return { migrate, s: Object.assign({ plan: { structures: { tower: [10, 11, 12], spawn: [20, 21], lab: [30], terminal: [40] }, paths: [], flags: { Supply: 50 } }, built,
        siteTiles: new Set(), roomSites: 3, globalSites: 0, energy: 500000, storageFree: 500000, hostiles: false, labsFirst: true }, extra) };
}

test('a tower comes first, even with other sites in the room; then the supplier spawn, then labs, then the rest', () => {
    const { migrate, s } = coreCase();
    const first = migrate.chooseStep(s);
    assert.equal(first.id, 'towerOnSupply');
    assert.equal(first.fast, true);
    s.built = s.built.filter(b => b.id !== 'towerOnSupply').concat({ id: 't0', kind: 'tower', tile: 10, used: 0 });
    assert.equal(migrate.chooseStep(s).id, 'spawnOff');
    s.built = s.built.filter(b => b.id !== 'spawnOff').concat({ id: 'core', kind: 'spawn', tile: 20, used: 0 });
    assert.equal(migrate.chooseStep(s).id, 'strayLab', 'the first spawn stands: the other waits with the rest');
    s.built = s.built.filter(b => b.id !== 'strayLab');
    s.roomSites = 0;
    assert.equal(migrate.chooseStep(s).id, 'spawnOff2');
});

test('what blocks a tower tile outranks labs; what moves at once goes before what must be emptied', () => {
    const { migrate, s } = coreCase();
    s.built.push({ id: 'termOnTower', kind: 'terminal', tile: 10, used: 90000 });
    const before = migrate.chooseStep(s);
    assert.equal(before.id, 'towerOnSupply', 'no emptying first');
    assert.equal(before.noWait, true, 'no free tower tile, but it cannot stay on the Supply tile');
    s.built = s.built.filter(b => b.id !== 'towerOnSupply');
    s.plan.flags = {};
    s.plan.structures.terminal = [40];
    const step = migrate.chooseStep(s);
    assert.equal(step.id, 'termOnTower');
    assert.equal(step.evacuate, true);
});

test('a rank short of energy holds the lower ones; a rank stuck for another reason does not', () => {
    let { migrate, s } = coreCase({ energy: 20000 });
    assert.equal(migrate.chooseStep(s), null, 'saving for the tower: no lab spending');
    ({ migrate, s } = coreCase());
    s.built = s.built.filter(b => !['t1', 't2'].includes(b.id));   // one tower: never below 2... none may move
    const step = migrate.chooseStep(s);
    assert.equal(step.id, 'spawnOff', 'towers cannot move; the next rank can');
});

test('a step in progress gives way to a higher rank; a tower step to nothing', () => {
    const { migrate, s } = coreCase();
    assert.equal(migrate.outranked({ kind: 'lab', tile: 60 }, s), true);
    assert.equal(migrate.outranked({ kind: 'terminal', tile: 80 }, s), true);
    assert.equal(migrate.outranked({ kind: 'tower', tile: 50 }, s), false);
    s.built = s.built.filter(b => b.id !== 'towerOnSupply').concat({ id: 't0', kind: 'tower', tile: 10, used: 0 }, { id: 'core', kind: 'spawn', tile: 20, used: 0 });
    assert.equal(migrate.outranked({ kind: 'lab', tile: 60 }, s), false, 'nothing above it now');
    assert.equal(migrate.outranked({ kind: 'terminal', tile: 80 }, s), true, 'the lab outranks it');
});
