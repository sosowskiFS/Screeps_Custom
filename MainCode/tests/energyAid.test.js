const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

function store(contents, free = 200000) {
    return Object.assign({}, contents, { getFreeCapacity: () => free });
}

// shardX on the day: W1N9 attacked and dry, E23N31 with 128k, E19N44 dry but not attacked.
function setup() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.RESOURCE_ENERGY = 'energy';
    const sends = [];
    const room = (name, storage, terminal, hostiles = []) => ({
        name, controller: { my: true, level: 7 },
        storage: { store: store({ energy: storage }) },
        terminal: { cooldown: 0, store: store({ energy: terminal }),
            send: (r, n, to) => { sends.push([name, r, n, to]); return g.OK; } },
        find: type => (type === g.FIND_HOSTILE_CREEPS ? hostiles : []),
    });
    const attacker = { owner: { username: 'Harabi' } };
    g.Game.rooms = {
        W1N9: room('W1N9', 80, 0, [attacker]),
        E23N31: room('E23N31', 99483, 28949),
        E19N44: room('E19N44', 2482, 0),
    };
    g.Memory.roomsUnderAttack = ['W1N9'];
    g.Game.market.calcTransactionCost = n => Math.ceil(n * 0.55);
    g.Game.time = 1000;
    return { h, g, sends, aid: h.load('system.energyAid') };
}

test('a room under a player attack running dry gets energy from a room that can spare it', () => {
    const { g, sends, aid } = setup();
    assert.deepEqual(plain(aid.emergencies().map(r => r.name)), ['W1N9']);
    for (const name of ['W1N9', 'E23N31', 'E19N44']) aid.aid(g.Game.rooms[name]);
    assert.equal(sends.length, 1, JSON.stringify(plain(sends)));
    const [from, res, amount, to] = sends[0];
    assert.deepEqual([from, res, to], ['E23N31', 'energy', 'W1N9']);
    assert.ok(amount >= 2000 && amount + Math.ceil(amount * 0.55) <= 28949, 'fits the terminal with its cost: ' + amount);
    assert.ok(amount <= 20000);
});

test('no aid from a donor near its floor, nor to NPC raids, nor off the 10-tick beat', () => {
    let { g, sends, aid } = setup();
    g.Game.time = 1001;
    aid.aid(g.Game.rooms.E23N31);
    assert.equal(sends.length, 0, 'off the beat');

    ({ g, sends, aid } = setup());
    g.Game.rooms.E23N31.storage.store.energy = 20000;
    aid.aid(g.Game.rooms.E23N31);
    assert.equal(sends.length, 0, '49k total: under its own 50k floor');

    ({ g, sends, aid } = setup());
    g.Game.rooms.W1N9.find = type => (type === g.FIND_HOSTILE_CREEPS ? [{ owner: { username: 'Invader' } }] : []);
    aid.aid(g.Game.rooms.E23N31);
    assert.equal(sends.length, 0, 'invaders: the towers cope');
});

test('after a safe mode the shard is on watch: the attacked room is sent energy before the next attack, every 100 ticks', () => {
    const { g, sends, aid } = setup();
    // W1N9's attackers are gone (safe mode); its stores are still nearly empty.
    g.Game.rooms.W1N9.find = () => [];
    g.Memory.roomsUnderAttack = [];
    g.Game.rooms.W1N9.controller.safeMode = 15000;
    g.Game.rooms.E23N31.storage.store.energy = 120000;
    g.Game.time = 1010;
    aid.aid(g.Game.rooms.E23N31);
    assert.equal(sends.length, 0, 'between the 100-tick sends');
    g.Game.time = 1100;
    aid.aid(g.Game.rooms.E23N31);
    assert.equal(sends.length, 1);
    assert.deepEqual([sends[0][0], sends[0][3]], ['E23N31', 'W1N9']);
    assert.equal(aid.aid(g.Game.rooms.W1N9), 0, 'the watched room never donates');
});

test('on watch the other rooms keep more in reserve and in their terminals; it ends with the cooldown', () => {
    const { h, g } = setup();
    const watch = h.load('system.siegeWatch');
    const donor = g.Game.rooms.E23N31;
    donor.controller.level = 6;
    assert.equal(watch.extraReserve(donor), 0);
    assert.equal(watch.terminalEnergyGoal(donor), 30000);
    g.Game.rooms.W1N9.controller.safeModeCooldown = 40000;
    g.Game.time++;
    assert.equal(watch.extraReserve(donor), 100000);
    assert.equal(watch.terminalEnergyGoal(donor), 60000);
    assert.equal(watch.extraReserve(g.Game.rooms.W1N9), 0, 'not the watched room itself');
    g.Game.rooms.W1N9.controller.safeModeCooldown = 0;
    g.Game.time++;
    assert.equal(watch.extraReserve(donor), 0, 'cooldown over, no attack: back to normal');
});
