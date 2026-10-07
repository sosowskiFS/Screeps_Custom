const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

function setup() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Game.time = 1000;
    g._.isArray = Array.isArray;
    g.Game.map.getRoomLinearDistance = () => 2;
    const searches = [];
    let open = false;
    g.Game.map.findRoute = (from, to) => { searches.push([from, to]); return open ? [{ room: to }] : g.ERR_NO_PATH; };
    g.console = { log: () => {} };
    return { h, g, searches, reach: h.load('system.reachability'), setOpen: v => { open = v; } };
}

test('no route avoiding claimed rooms: paused, not searched again until the recheck, then cleared', () => {
    const { g, searches, reach, setOpen } = setup();
    assert.equal(reach.reachable('E1N1', 'E3N1'), false);
    assert.deepEqual(plain(g.Memory.unreachable), { 'E1N1>E3N1': 1000 });
    g.Game.time += 100;
    assert.equal(reach.reachable('E1N1', 'E3N1'), false);
    assert.equal(searches.length, 1, 'remembered, no new route search');
    setOpen(true);
    g.Game.time += reach.RECHECK;
    assert.equal(reach.reachable('E1N1', 'E3N1'), true, 'rechecked after RECHECK ticks');
    assert.ok(!('E1N1>E3N1' in g.Memory.unreachable));
});

test('special spawns (harassers, flag commands) are not spawned for an unreachable room', () => {
    const { h, g } = setup();
    const spawned = [];
    const spawn = { name: 'S', room: { name: 'E1N1', energyCapacityAvailable: 1300 },
        spawnCreep: (body, name, opts) => { spawned.push(opts.memory.priority); return g.OK; } };
    g.Memory.CurrentRoomEnergy = [5000];
    g.setSpawnBusy = () => {};
    const instruction = h.load('spawn.BuildInstruction');
    instruction.run(spawn, 'harasser', 'E3N1', 0, 'E1N1');
    assert.deepEqual(spawned, []);
    assert.ok(g.Memory.unreachable['E1N1>E3N1']);
});

test('expired entries are pruned by the memory cleanup', () => {
    const { g, reach } = setup();
    g.Memory.unreachable = { 'A>B': 1000, 'A>C': 1000 - reach.RECHECK };
    assert.equal(reach.prune(), 1);
    assert.deepEqual(Object.keys(g.Memory.unreachable), ['A>B']);
});
