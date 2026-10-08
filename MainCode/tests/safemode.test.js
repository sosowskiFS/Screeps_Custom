const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

// shardX E29N36: RCL2, no tower, one safe mode charge.
function setup({ terminal = false, otherSafe = false, available = 1, log = [], objects = {} } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.console = { log: () => {} };
    g.Game.notify = () => {};
    g.EVENT_ATTACK = 1;
    g.EVENT_ATTACK_CONTROLLER = 6;
    const activated = [];
    const room = { name: 'E29N36', terminal: terminal ? { my: true } : undefined, getEventLog: () => log, find: () => [],
        controller: { my: true, level: 2, safeModeAvailable: available, activateSafeMode: () => { activated.push('E29N36'); return g.OK; } } };
    const other = { name: 'E1N1', getEventLog: () => [], controller: { my: true, safeMode: otherSafe ? 1000 : undefined, safeModeAvailable: 0 } };
    g.Game.rooms = { E29N36: room, E1N1: other };
    const all = Object.assign({
        raider: { owner: { username: 'raider' } },
        invader: { owner: { username: 'Invader' } },
        friend: { owner: { username: 'friend' } },
        helper: { my: true, name: 'helper' },
        spawn: { my: true, structureType: 'spawn', pos: { roomName: 'E29N36' } },
        road: { structureType: 'road', pos: { roomName: 'E29N36' } },
    }, objects);
    g.Game.getObjectById = id => all[id] || null;
    g.Memory.whiteList = ['friend'];
    return { g, activated, run: () => h.load('system.safeMode').run() };
}

const attack = (by, target, damage = 300) => ({ event: 1, objectId: by, data: { targetId: target, damage, attackType: 1 } });

test('hostiles only passing through (the stuck quad) do not trigger safe mode', () => {
    const s = setup({ log: [] });
    s.run();
    assert.deepEqual(s.activated, []);
});

test('a player damaging one of our creeps, a structure, or the controller triggers it', () => {
    for (const log of [[attack('raider', 'helper')], [attack('raider', 'spawn')], [attack('raider', 'road')], [{ event: 6, objectId: 'raider', data: {} }]]) {
        const s = setup({ log });
        s.run();
        assert.deepEqual(s.activated, ['E29N36'], JSON.stringify(log));
    }
});

test('Invaders, whitelisted players and attackers already gone do not', () => {
    for (const log of [[attack('invader', 'helper')], [attack('friend', 'spawn')], [attack('ghost', 'spawn')]]) {
        const s = setup({ log });
        s.run();
        assert.deepEqual(s.activated, [], JSON.stringify(log));
    }
});

test('never in an established room, without a charge, or while another room has safe mode', () => {
    for (const opts of [{ terminal: true }, { available: 0 }, { otherSafe: true }]) {
        const s = setup(Object.assign({ log: [attack('raider', 'spawn')] }, opts));
        s.run();
        assert.deepEqual(s.activated, [], JSON.stringify(opts));
    }
});

test('no attempt (and no failed-attempt spam) while the controller is attack-blocked', () => {
    const s = setup({ log: [attack('raider', 'spawn')] });
    s.g.Game.rooms.E29N36.controller.upgradeBlocked = 230;
    s.run();
    assert.deepEqual(s.activated, []);
});
