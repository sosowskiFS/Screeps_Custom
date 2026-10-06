const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

function setup() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    const structures = [];
    const room = { name: 'A', controller: { my: true, level: 8 }, find: type => type === g.FIND_STRUCTURES || type === g.FIND_MY_STRUCTURES ? structures : [] };
    g.Game.rooms.A = room;
    function pos(x, y) {
        return { x, y, roomName: 'A',
            getRangeTo: o => { const p = o.pos || o; return Math.max(Math.abs(p.x - x), Math.abs(p.y - y)); },
            inRangeTo(o, r) { return this.getRangeTo(o) <= r; },
            isNearTo(o) { return this.getRangeTo(o) <= 1; },
            findInRange: (type, r) => structures.filter(s => Math.max(Math.abs(s.pos.x - x), Math.abs(s.pos.y - y)) <= r),
            findClosestByRange: list => list[0], lookFor: () => [], getDirectionTo: () => 1 };
    }
    function hostile(x, y, parts = { work: 0, attack: 0 }, extra = {}) {
        return Object.assign({ id: 'h' + x + y, name: 'enemy', owner: { username: 'enemy' }, pos: pos(x, y), hits: 3000, hitsMax: 3000,
            body: [{ type: g.MOVE, hits: 100 }], getActiveBodyparts: type => parts[type] || 0 }, extra);
    }
    return { h, g, room, structures, pos, hostile, watch: h.load('defense.watch') };
}

test('a creep bouncing on the border is recognised as a drain', () => {
    const { g, room, hostile, watch } = setup();
    const bouncer = hostile(0, 20);
    for (let tick = 1; tick <= 6; tick++) {
        g.Game.time = tick;
        watch.update(room, tick % 2 ? [bouncer] : []); // in, out (healed), in, out...
    }
    g.Game.time = 7;
    watch.update(room, [bouncer]);
    assert.equal(watch.isDraining('A'), true);
});

test('pushing deeper, damaging structures, or leaving ends drain mode', () => {
    const deep = setup();
    for (let tick = 1; tick <= 7; tick += 2) { deep.g.Game.time = tick; deep.watch.update(deep.room, [deep.hostile(1, 20)]); }
    deep.g.Game.time = 9;
    deep.watch.update(deep.room, [deep.hostile(10, 20)]);
    assert.equal(deep.watch.isDraining('A'), false, 'a hostile 10 tiles in is a real attack');

    const siege = setup();
    siege.structures.push({ structureType: siege.g.STRUCTURE_WALL, pos: siege.pos(2, 20) });
    for (let tick = 1; tick <= 7; tick += 2) {
        siege.g.Game.time = tick;
        siege.watch.update(siege.room, [siege.hostile(1, 20, { work: 5 })]);
    }
    assert.equal(siege.watch.isDraining('A'), false, 'a dismantler at the edge is a siege, not a drain');

    const gone = setup();
    for (let tick = 1; tick <= 7; tick += 2) { gone.g.Game.time = tick; gone.watch.update(gone.room, [gone.hostile(0, 5)]); }
    assert.equal(gone.watch.isDraining('A'), true);
    gone.g.Game.time = 40;
    assert.equal(gone.watch.isDraining('A'), false, 'quiet for 20+ ticks');
});

test('rooms stay under attack across bounces and do not flip ramparts each time', () => {
    const { g, h, room, hostile, watch } = setup();
    const defense = h.load('system.defense');
    g.Memory.attackDuration = 0;
    const bouncer = hostile(0, 20, {}, { owner: { username: 'enemy' } });
    const directions = [];
    for (let tick = 1; tick <= 10; tick++) {
        g.Game.time = tick;
        const present = tick % 2 ? [bouncer] : [];
        watch.update(room, present);
        directions.push(defense.handleHostileDetection(room, present, []));
        assert.deepEqual(plain(g.Memory.roomsUnderAttack), ['A'], 'tick ' + tick);
    }
    assert.ok(directions.every(d => d === ''), 'no Open/Closed rampart flips during the bounce');
    assert.ok(g.Memory.attackDuration <= 2, 'drain does not count toward war mode once recognised');

    g.Game.time = 40;
    watch.update(room, []);
    assert.equal(defense.handleHostileDetection(room, [], []), 'Open', 'stands down after the quiet period');
    assert.deepEqual(plain(g.Memory.roomsUnderAttack), []);
});

test('boosted attackers are recognised as threats (old check always said no)', () => {
    const { h, hostile } = setup();
    const defense = h.load('system.defense');
    const boosted = hostile(10, 10, {}, { hitsMax: 5000, body: [{ type: 'attack', hits: 100, boost: 'XUH2O' }] });
    const plainCreep = hostile(10, 10, {}, { hitsMax: 5000, body: [{ type: 'attack', hits: 100 }] });
    assert.equal(defense.determineCreepThreat(boosted, 2), true);
    assert.equal(defense.determineCreepThreat(plainCreep, 2), false);
});

test('towers skip drain bait at the exit but shoot what they can kill or what is sieging', () => {
    const { h, g, structures, pos, hostile } = setup();
    const tower = h.load('tower.Operate');
    assert.equal(tower.isDrainBait(hostile(1, 20), 400), true, 'cannot kill 3000 hits before it steps out');
    assert.equal(tower.isDrainBait(hostile(1, 20, {}, { hits: 700 }), 400), false, 'dies within two ticks');
    assert.equal(tower.isDrainBait(hostile(8, 20), 400), false, 'too deep to escape quickly');
    structures.push({ structureType: g.STRUCTURE_WALL, pos: pos(2, 20) });
    assert.equal(tower.isDrainBait(hostile(1, 20, { work: 4 }), 400), false, 'dismantling a wall');
});

test('defenders claim the rampart nearest the target and never path through exposed tiles', () => {
    const { h, g, room, structures, pos } = setup();
    g.Memory.roomsUnderAttack = ['A'];
    g.Memory.towerPickedTarget = {};
    g.STRUCTURE_RAMPART = 'rampart';
    const rampart = (x, y) => structures.push({ structureType: 'rampart', my: true, pos: pos(x, y) });
    rampart(10, 10); rampart(10, 11); rampart(20, 20);
    structures.push({ structureType: 'spawn', pos: pos(20, 20) }); // rampart over a spawn: not a post
    const enemy = { id: 'foe', name: 'enemy', owner: { username: 'enemy' }, pos: pos(8, 10), hits: 1000, hitsMax: 1000,
        body: [{ type: g.RANGED_ATTACK, hits: 100 }, { type: g.MOVE, hits: 100 }] };
    const mine = [];
    room.find = type => type === g.FIND_HOSTILE_CREEPS ? [enemy] : type === g.FIND_MY_CREEPS ? mine
        : (type === g.FIND_STRUCTURES || type === g.FIND_MY_STRUCTURES) ? structures : [];
    g.RoomPosition = function (x, y) { return pos(x, y); };
    let travel;
    const intents = [];
    const make = (id, x, y) => {
        const creep = { id, name: id, room, pos: pos(x, y), hits: 1000, hitsMax: 1000, memory: { priority: 'defender', homeRoom: 'A' },
            body: [{ type: g.RANGED_ATTACK, hits: 100 }, { type: g.MOVE, hits: 100 }],
            travelTo: (target, opts) => { travel = { x: target.x, y: target.y, opts }; },
            rangedAttack: t => intents.push(['rangedAttack', id, t.id]), rangedMassAttack: () => intents.push(['mass', id]),
            heal() {}, rangedHeal() {}, attack() {}, move() {}, say() {} };
        mine.push(creep);
        return creep;
    };
    const first = make('d1', 15, 15);
    const second = make('d2', 15, 16);
    const defender = h.load('creep.combat');

    defender.run(first);
    assert.deepEqual([travel.x, travel.y], [10, 10], 'closest post to the enemy');
    const matrix = { set: (x, y, v) => { matrix.cells[x + ',' + y] = v; }, cells: {} };
    travel.opts.roomCallback('A', matrix);
    assert.equal(matrix.cells['9,9'], 255, 'open tile in the enemy\'s reach is blocked');
    assert.equal(matrix.cells['10,10'], undefined, 'the rampart itself stays walkable');

    defender.run(second);
    assert.deepEqual([travel.x, travel.y], [10, 11], 'second defender takes the next post, not the same one');
});

test('defenders are only requested for hostiles inside the room, never for an empty or border-only room', () => {
    const { g, room, hostile, watch } = setup();
    g.Game.time = 1;
    watch.update(room, [hostile(0, 20)]);
    assert.equal(watch.hasInnerHostile('A'), false, 'sitting on the exit');
    g.Game.time = 2;
    watch.update(room, []);
    assert.equal(watch.hasInnerHostile('A'), false, 'outside being healed');
    g.Game.time = 3;
    watch.update(room, [hostile(12, 20)]);
    assert.equal(watch.hasInnerHostile('A'), true, 'inside the room');
});
