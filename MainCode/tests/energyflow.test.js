const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

function setup() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    g.Game.time = 1000;
    g.CONTROLLER_DOWNGRADE = { 4: 40000, 6: 100000, 8: 200000 };
    Object.assign(g, { EVENT_BUILD: 4, EVENT_HARVEST: 5, EVENT_REPAIR: 7, EVENT_UPGRADE_CONTROLLER: 9 });
    const objects = {};
    g.Game.getObjectById = id => objects[id] || null;
    const room = (name, extra = {}) => Object.assign({ name, controller: { my: true, level: 6, ticksToDowngrade: 90000 },
        storage: { store: { energy: 20000 } }, find: t => (t === g.FIND_MY_SPAWNS ? [{}] : []), getEventLog: () => [] }, extra);
    return { h, g, objects, room, flow: h.load('system.energyFlow') };
}

test('energy is counted at the action: harvest (boosted, capped by the source), build, repair and upgrade (capped), spawning; a sample averages it per tick', () => {
    const { g, room, flow } = setup();
    Object.assign(g, { HARVEST_POWER: 2, BUILD_POWER: 5, REPAIR_POWER: 100, CONTROLLER_MAX_UPGRADE_PER_TICK: 15,
        BOOSTS: { work: { UO: { harvest: 3 } } } });
    const part = (type, boost) => ({ type, hits: 100, boost });
    const miner = { body: [part(g.WORK), part(g.WORK), part(g.WORK, 'UO')], store: { energy: 0 } };
    assert.equal(flow.AMOUNT.harvest(miner, { energy: 3000 }), 2 * (1 + 1 + 3), 'boosted WORK harvests 3x');
    assert.equal(flow.AMOUNT.harvest(miner, { energy: 4 }), 4, 'no more than the source holds');
    assert.equal(flow.AMOUNT.harvest(miner, { mineralType: 'H', energy: undefined }), 0, 'minerals are not energy');
    const worker = { body: [part(g.WORK), part(g.WORK)], store: { energy: 7 } };
    assert.equal(flow.AMOUNT.build(worker, { progress: 0, progressTotal: 3000 }), 7, 'capped by what it carries');
    assert.equal(flow.AMOUNT.build({ body: worker.body, store: { energy: 100 } }, { progress: 2997, progressTotal: 3000 }), 3, 'and the progress left');
    assert.equal(flow.AMOUNT.repair({ body: worker.body, store: { energy: 100 } }, { hits: 950, hitsMax: 1000 }), 1, '50 hits missing: 1 energy');
    assert.equal(flow.AMOUNT.upgradeController({ body: Array(20).fill(part(g.WORK)), store: { energy: 100 } }, { level: 8 }), 15, 'RCL8 cap');
    // Tallies over a 10-tick interval become per-tick values.
    g.Game.rooms = { HOME: room('HOME') };
    flow.count('HOME', 'in', 200); flow.count('HOME', 'up', 50); flow.noteSpawn('HOME', 500);
    flow.sample();
    const e = g.Memory.energyFlow.HOME;
    assert.equal(e.in, 20);
    assert.equal(e.up, 5);
    assert.equal(e.sp, 50);
    g.Game.time += 10;
    flow.sample();
    assert.ok(g.Memory.energyFlow.HOME.in < 20, 'nothing since: the average falls');
});

test('the budget with a storage: what optional work costs now plus the storage change, steered toward the reserve; without one, income less spawning', () => {
    const { g, room, flow } = setup();
    const r = room('R');                                   // RCL6: reserve 50k
    g.Memory.energyFlow = { R: { n: 5, in: 20, up: 5, bu: 2, re: 3, sp: 8, nb: -4, bank: 50000 } };
    assert.equal(flow.budget(r), null, 'warming up');
    g.Memory.energyFlow.R.n = 40;
    assert.equal(flow.budget(r), 5 + 2 + 3 - 4, 'at the reserve: what it spends, less what the storage loses');
    g.Memory.energyFlow.R.bank = 150000;
    assert.equal(flow.budget(r), 6 + 100000 / 10000, '100k above: spent over 10,000 ticks');
    g.Memory.energyFlow.R.bank = 20000;
    assert.equal(flow.budget(r), 6 - 30000 / 3000, '30k short: rebuilt over 3,000 ticks');
    const bare = room('Y', { storage: undefined });
    g.Memory.energyFlow.Y = { n: 40, in: 20, up: 1, bu: 9, re: 0, sp: 8, nb: 0, bank: 0 };
    assert.equal(flow.budget(bare), 12, 'no storage: income less spawning');
});

test('staffing: a hardened room repairers take up to half its budget; spent out, none; RCL8 repairers follow the budget unless ramparts are capped', () => {
    const { g, room, flow } = setup();
    const r = room('W1N9');                                 // RCL6, reserve 50k
    g.Game.shard = { name: 'shardX' };
    g.Memory.xs = { losses: { W1N9: 1 } };
    g.Memory.energyFlow = { W1N9: { n: 40, in: 18, up: 3, bu: 6, re: 1, sp: 12, nb: 7, bank: 50000 } };
    let s = flow.staffing(r, { upgrade: 12, repair: 4 }, { upgraderMax: 2, repairMax: 1 });
    // 17 a tick: the upgrader first (9.6), half the rest (3.7) pays one 4-WORK repairer (3.2).
    assert.equal(s.repairMax, 1);
    assert.equal(s.upgraderModules, 0, 'no extra upgrade module from what is left (4.2)');
    assert.equal(s.upgraders, undefined, 'never fewer than the one upgrader below RCL8');
    assert.ok(Math.abs(s.spare - 4.2) < 1e-9, 'what is left over for the upgrade supplier: ' + s.spare);
    // Collapsed (storage at 80, 50k short): nothing.
    g.Memory.energyFlow.W1N9.bank = 80;
    s = flow.staffing(r, { upgrade: 12, repair: 4 }, { upgraderMax: 2, repairMax: 1 });
    assert.equal(s.repairMax, 0);
    assert.equal(s.upgraders, undefined, 'spent out: still its one upgrader');
    assert.equal(s.spare, 0, 'spent out: nothing for the upgrade supplier to upgrade with');
    // An RCL8 room with 450k stored (200k above its 250k reserve): repairers spend it, up to 2.
    const big = room('E18N22', { controller: { my: true, level: 8, ticksToDowngrade: 190000 } });
    g.Memory.energyFlow.E18N22 = { n: 40, in: 110, up: 0, bu: 0, re: 8, sp: 16, nb: 0, bank: 450000 };
    assert.equal(flow.staffing(big, { repair: 4 }).repairMax, 2, 'at most 2 at RCL8');
    assert.equal(flow.staffing(big, { repair: 4, repairCapped: true }).repairMax, 0, 'ramparts at their cap');
});

test('a room without a storage losing over a fifth of its income on the ground gets another distributor', () => {
    const { g, room, flow } = setup();
    const r = room('W24N8', { storage: undefined, controller: { my: true, level: 3, ticksToDowngrade: 20000 } });
    g.Memory.energyFlow = { W24N8: { n: 40, in: 18, up: 0.1, bu: 3.2, re: 0.3, sp: 3.6, nb: 0, bank: 0 } };
    assert.equal(flow.staffing(r, {}).extraDistributor, true, 'about 60% unaccounted');
    g.Memory.energyFlow.W24N8.bu = 14;
    assert.equal(flow.staffing(r, {}).extraDistributor, false);
});

test('staffing: workers in a room before links are its whole budget, 1 to 8', () => {
    const { g, room, flow } = setup();
    const r = room('Y', { storage: undefined, controller: { my: true, level: 3, ticksToDowngrade: 20000 } });
    g.Memory.energyFlow = { Y: { n: 40, in: 20, sp: 4, bank: 0 } };
    assert.equal(flow.staffing(r, { worker: 6 }).workers, 3, '16 a tick over 4.8 per worker');
    g.Memory.energyFlow.Y.in = 2;
    assert.equal(flow.staffing(r, { worker: 6 }).workers, 1, 'always one');
});

test('the wrapped creep actions count only what succeeds, for the creep\'s home room', () => {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    Object.assign(g, { RESOURCE_ENERGY: 'energy', HARVEST_POWER: 2 });
    g.Game.time = 1000;
    let result = g.OK;
    g.Creep.prototype.harvest = function () { return result; };
    const flow = h.load('system.energyFlow');           // installs the wrappers
    const creep = Object.assign(Object.create(g.Creep.prototype), { memory: { homeRoom: 'HOME' }, body: [{ type: g.WORK, hits: 100 }], store: { energy: 0 } });
    creep.harvest({ energy: 3000 });
    result = g.ERR_NOT_IN_RANGE;
    creep.harvest({ energy: 3000 });
    g.Game.rooms = { HOME: { name: 'HOME', controller: { my: true, level: 3 }, find: t => (t === g.FIND_MY_SPAWNS ? [{}] : []) } };
    flow.sample();
    assert.equal(g.Memory.energyFlow.HOME.in, 0.2, 'one successful 2-energy harvest over 10 ticks');
});

// shard1 E19N59: RCL8, 1.07M stored, +112.7 a tick to spend, two repairers and no upgrader; the
// storage overflowed.
test('RCL8 with energy to spare and CPU to spare: one 15-a-tick upgrader, then up to 6 repairers; no CPU to spare: 2, no upgrader', () => {
    const { g, room, flow } = setup();
    const r = room('E19N59', { controller: { my: true, level: 8, ticksToDowngrade: 190000 } });
    g.Memory.energyFlow = { E19N59: { n: 29794, in: 51.3, up: 0, bu: 0, re: 28.5, sp: 14.5, nb: 1.66, bank: 1075368 } };
    g.Game.cpu.limit = 40;
    g.Memory.cpuGov = { ema: 28.6, shed: 0 };
    let s = flow.staffing(r, { rcl8Upgrade: true, repair: 20 });
    assert.ok(Math.abs(s.budget - 112.7) < 0.1, 'budget ' + s.budget);
    assert.equal(s.rcl8Upgrader, true);
    assert.equal(s.repairMax, 6, '112.7 - 12 for the upgrader pays six 20-WORK repairers (16 each)');
    // shard2-like: shedding work.
    g.Memory.cpuGov = { ema: 137, shed: 3 };
    g.Game.cpu.limit = 145;
    s = flow.staffing(r, { rcl8Upgrade: true, repair: 20 }, { repairMax: 2 });
    assert.equal(s.rcl8Upgrader, undefined, 'no CPU to spare: no upgrader');
    assert.equal(s.repairMax, 2, 'and at most 2 repairers');
    // Below its reserve: no surplus to burn.
    g.Memory.cpuGov = { ema: 20, shed: 0 };
    g.Game.cpu.limit = 40;
    g.Memory.energyFlow.E19N59 = { n: 29794, in: 20, up: 0, bu: 0, re: 5, sp: 10, nb: -5, bank: 200000 };
    s = flow.staffing(r, { rcl8Upgrade: true, repair: 20 });
    assert.equal(s.rcl8Upgrader, undefined);
});

test('lean spawning: stores falling under the reserve until they are back at it (shardX E32N45)', () => {
    const { g, room, flow } = setup();
    const r = room('E32N45');                                     // RCL6: 50k reserve
    g.Memory.energyFlow = { E32N45: { n: 40, in: 24.9, up: 4.2, bu: 9.1, re: 9.6, sp: 10.3, nb: -7.9, bank: 33714 } };
    assert.equal(flow.lean(r), true, 'falling 7.9 a tick at 34k');
    g.Memory.energyFlow.E32N45.nb = 3;
    g.Memory.energyFlow.E32N45.bank = 45000;
    assert.equal(flow.lean(r), true, 'rising again, still short of 50k: stays lean');
    g.Memory.energyFlow.E32N45.bank = 50000;
    assert.equal(flow.lean(r), false, 'back at the reserve: full-size creeps');
    g.Memory.energyFlow.E32N45.nb = -0.5;
    g.Memory.energyFlow.E32N45.bank = 40000;
    assert.equal(flow.lean(r), false, 'a slow drift is not a deficit');
});

test('ring ramparts: affordable on income after spawning and the usual reserve; repairs, upgrading and a watch stockpile do not count', () => {
    const { g, room, flow } = setup();
    const r = room('E23N31');                                     // RCL6: 50k reserve
    g.Memory.energyFlow = { E23N31: { n: 40, in: 25.7, up: 5, bu: 0, re: 20, sp: 8.8, nb: -9, bank: 124000 } };
    assert.equal(flow.ringAffordable(r), true, 'heavy repairs and falling stores: still 17 a tick after spawning, 124k stored');
    g.Game.rooms.E32N45 = { name: 'E32N45', controller: { my: true, safeModeCooldown: 20000, level: 6 } };
    g.Game.rooms.E23N31 = r;
    g.Game.time++;
    assert.equal(flow.ringAffordable(r), true, 'the shard on watch: same answer');
    g.Memory.energyFlow.E23N31.bank = 700;
    assert.equal(flow.ringAffordable(r), false, 'stores empty (E19N44): not yet');
    g.Memory.energyFlow.E23N31.bank = 124000;
    g.Memory.energyFlow.E23N31.sp = 30;
    assert.equal(flow.ringAffordable(r), false, 'spawning takes all it earns');
    delete g.Memory.energyFlow.E23N31;
    assert.equal(flow.ringAffordable(r), true, 'no data yet: allowed');
});
