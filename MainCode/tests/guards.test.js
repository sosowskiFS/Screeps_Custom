const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

// A home with one remote under attack; what guard does the spawner order?
function spawnGuard({ threat, energyCap = 12900 } = {}) {
    const h = harness(), g = h.context;
    const orders = [];
    g.StructureSpawn = class { spawnCreep(body, name, opts) { orders.push({ body: plain(body), memory: opts.memory }); return g.OK; } };
    h.load('runtime.memory').ensureInitialized();
    h.load('spawn.state');
    g.BODYPART_COST = { move: 50, carry: 50, work: 100, attack: 80, ranged_attack: 150, heal: 250, claim: 600, tough: 10 };
    g.CARRY_CAPACITY = 50;
    g.isSpawnBusy = () => false;
    g.setSpawnBusy = () => {};
    g.RESOURCE_ENERGY = 'energy';
    const room = { name: 'H', energyCapacityAvailable: energyCap, controller: { my: true, level: 8 },
        storage: { id: 'storage', store: { energy: 200000 } }, find: () => [] };
    g.Game.rooms.H = room;
    const spawn = Object.assign(new g.StructureSpawn(), { name: 'S1', id: 'S1', room, spawning: null, pos: { x: 25, y: 25, roomName: 'H', isNearTo: () => false } });
    g.Memory.CurrentRoomEnergy = [1000000];
    g.Game.flags.HFarGuard = { name: 'HFarGuard', pos: { x: 25, y: 25, roomName: 'R1' } };
    g.Memory.FarRoomsUnderAttack = ['R1'];
    if (threat) g.Memory.remoteThreat = { R1: Object.assign({ t: g.Game.time }, threat) };
    h.load('spawn.BuildFarCreeps').run(spawn, room, 0);
    return { g, orders: orders.filter(o => o.memory.priority === 'farGuard'), verdictFor: h.load('combat.intel').verdictFor };
}
const count = (body, part) => body.filter(p => p === part).length;

test('war mode is gone: no empire switch, no ToggleWar flag, the old flag value is cleared', () => {
    const h = harness();
    h.context.Memory.warMode = true;
    h.load('runtime.memory').ensureInitialized();
    assert.equal(h.context.Memory.warMode, undefined);
});

test('guards for invaders are sized to beat the recorded force, like guards for players', () => {
    const { g, orders, verdictFor } = spawnGuard({ threat: { d: 200, h: 50, e: 3000, p: 0 } });
    assert.equal(orders.length, 1);
    const body = orders[0].body;
    const us = { dps: count(body, g.RANGED_ATTACK) * 10, heal: count(body, g.HEAL) * 12, ehp: body.length * 100 };
    assert.equal(verdictFor(us, { dps: 200, heal: 50, ehp: 3000 }), 'win');
    assert.equal(count(body, g.TOUGH) + count(body, g.ATTACK), 0, 'a kiter, not the fixed default body');
});

test('a force nothing affordable can beat gets no guard (not fed); no recorded force gets the default', () => {
    assert.equal(spawnGuard({ threat: { d: 2000, h: 600, e: 40000, p: 0 } }).orders.length, 0);
    const { g, orders } = spawnGuard();
    assert.equal(orders.length, 1);
    assert.ok(count(orders[0].body, g.HEAL) === 1 && orders[0].body.length <= 26, 'small default guard, not a war-size one');
});
