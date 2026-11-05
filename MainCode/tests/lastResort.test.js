const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

// A built room: storage at 25,25 inside a closed rampart ring (20..30), an armed player quad outside.
function setup({ level = 7, others = [] } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.console = { log: () => {} };
    g.Game.notify = () => {};
    g.EVENT_ATTACK = 1;
    g.EVENT_ATTACK_CONTROLLER = 6;
    const activated = [], latched = [];
    const structures = [];
    let n = 0;
    const add = (type, x, y, extra = {}) => {
        const s = Object.assign({ id: type + n++, structureType: type, my: true, hits: 1000000, hitsMax: 300000000, pos: { x, y, roomName: 'W1N9' } }, extra);
        structures.push(s);
        return s;
    };
    for (let i = 20; i <= 30; i++) for (const [x, y] of [[i, 20], [i, 30], [20, i], [30, i]]) {
        if (!structures.some(s => s.pos.x === x && s.pos.y === y)) add(g.STRUCTURE_RAMPART, x, y);
    }
    add(g.STRUCTURE_STORAGE, 25, 25, { hits: 10000, hitsMax: 10000 });
    const raider = { id: 'q1', owner: { username: 'Harabi' }, body: [{ type: g.RANGED_ATTACK, hits: 100 }], pos: { x: 25, y: 18 },
        getActiveBodyparts: t => (t === g.RANGED_ATTACK ? 1 : 0) };
    let log = [];
    const room = {
        name: 'W1N9', terminal: { my: true }, storage: structures.find(s => s.structureType === g.STRUCTURE_STORAGE),
        controller: { my: true, level, safeModeAvailable: 6, activateSafeMode: () => { activated.push('W1N9'); return g.OK; } },
        getTerrain: () => ({ get: () => 0 }),
        getEventLog: () => log,
        find: type => (type === g.FIND_STRUCTURES ? structures : type === g.FIND_HOSTILE_CREEPS ? [raider] : []),
    };
    g.Game.rooms = { W1N9: room };
    for (const [name, lvl] of others) {
        g.Game.rooms[name] = { name, getEventLog: () => [], find: () => [], getTerrain: () => ({ get: () => 0 }),
            controller: { my: true, level: lvl, safeModeAvailable: 1, activateSafeMode: () => { activated.push(name); return g.OK; } } };
    }
    g.Game.getObjectById = id => (id === 'q1' ? raider : structures.find(s => s.id === id) || null);
    g.Memory.whiteList = [];
    // The room is built (a terminal); guard squads only record the latch.
    const safe = h.load('system.safeMode');
    h.load('system.guardSquads').latch = (r, why) => latched.push([r.name, why]);
    return { h, g, room, structures, activated, latched, safe, setLog: l => { log = l; }, raider };
}

test('a built room: nothing while the ring holds; safe mode the moment the core is reachable', () => {
    const s = setup();
    s.g.Game.time = 100;
    s.safe.run();
    assert.deepEqual(s.activated, [], 'ring closed: the walls are doing their job');
    // A rampart on the ring falls.
    const gap = s.structures.findIndex(x => x.pos.x === 25 && x.pos.y === 20);
    s.structures.splice(gap, 1);
    s.g.Game.time = 110;
    s.safe.run();
    assert.deepEqual(s.activated, ['W1N9']);
});

test('safe mode before the breach: a ring rampart worn down to under 30 ticks of damage', () => {
    const s = setup();
    const wall = s.structures.find(x => x.pos.x === 25 && x.pos.y === 20);
    const hit = () => s.setLog([{ event: 1, objectId: 'q1', data: { targetId: wall.id, damage: 600 } }]);
    s.g.Game.time = 100; wall.hits = 100000; hit(); s.safe.run();
    s.g.Game.time = 110; wall.hits = 94000; hit(); s.safe.run();
    assert.deepEqual(s.activated, [], '600 a tick, 94,000 left: 156 ticks');
    s.g.Game.time = 120; wall.hits = 15000; hit(); s.safe.run();
    assert.deepEqual(s.activated, ['W1N9'], 'about 4,250 a tick now, 15,000 left: falls in 4 ticks');
});

test('the shard\'s safe mode is kept for its one developed room', () => {
    const s = setup({ others: [['E23N31', 6]] });
    assert.equal(s.safe.reservedRoom(), 'W1N9');
    assert.equal(s.safe.mayActivate(s.g.Game.rooms.E23N31), false);
    assert.equal(s.safe.mayActivate(s.room), true);
    s.g.Memory.safeModeReserve = false;
    assert.equal(s.safe.reservedRoom(), null, 'turned off');
    const tie = setup({ others: [['E1N1', 7]] });
    assert.equal(tie.safe.reservedRoom(), null, 'two rooms at the top: no reservation');
});

test('under fire, nothing is built within ranged reach of the walls\' outside; ramparts still are', () => {
    const s = setup();
    const at = (x, y) => ({ x, y });
    assert.equal(s.safe.buildHeld(s.room, at(21, 25), s.g.STRUCTURE_EXTENSION), true, '2 tiles inside the ring: shot from outside');
    assert.equal(s.safe.buildHeld(s.room, at(25, 25), s.g.STRUCTURE_EXTENSION), false, 'the middle: 6 tiles in');
    assert.equal(s.safe.buildHeld(s.room, at(21, 25), s.g.STRUCTURE_RAMPART), false, 'ramparts are the cover');
    s.room.find = type => (type === s.g.FIND_STRUCTURES ? s.structures : []);   // the attackers leave
    s.g.Game.time++;
    assert.equal(s.safe.buildHeld(s.room, at(21, 25), s.g.STRUCTURE_EXTENSION), false);
});
