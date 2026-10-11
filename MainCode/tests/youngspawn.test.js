const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

const COST = { MOVE: 50, WORK: 100, CARRY: 50, move: 50, work: 100, carry: 50 };

function load() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.BODYPART_COST = COST;
    return { h, g, build: h.load('spawn.BuildCreeps') };
}

test('harvester bodies never cost more than the energy they are sized for (they used to cost 50 more)', () => {
    const { build } = load();
    const cost = body => body.reduce((n, p) => n + COST[p], 0);
    for (let energy = 200; energy <= 1300; energy += 50) {
        const body = build.getMinerConfig(energy, 5, 0);
        assert.ok(cost(body) <= energy, energy + ': ' + body.join(',') + ' costs ' + cost(body));
    }
    assert.deepEqual(plain(build.getMinerConfig(400, 5, 0)), ['work', 'work', 'work', 'carry', 'move'], '400 exactly (it used to ask for 450)');
});

test('a young room with only visiting helpers and 400 energy spawns its harvester (shardX E29N36)', () => {
    const { g, build } = load();
    const spawned = [];
    g.Memory.sourceList = { NEW: ['s1', 's2'] };
    g.Memory.CurrentRoomEnergy = ['NEW', 400];
    g.Memory.autoBuildRooms = [];
    g.setSpawnBusy = () => {};
    const room = { name: 'NEW', energyAvailable: 400, energyCapacityAvailable: 400, controller: { level: 2 }, find: () => [] };
    const spawn = { name: 'S', pos: { isNearTo: () => false },
        spawnCreep: (body, name, opts) => { spawned.push([body.reduce((n, p) => n + COST[p], 0), opts.memory.priority]); return g.OK; } };
    // The room's creeps: two helpers and a guard from elsewhere, none of its own.
    const visitors = [{ memory: { priority: 'helper', homeRoom: 'E32N39' } }, { memory: { priority: 'helper', homeRoom: 'E32N39' } },
        { memory: { priority: 'roomGuard', homeRoom: 'E32N39' } }];
    build.run(spawn, [], room, visitors, 1);
    assert.equal(spawned.length, 1);
    assert.equal(spawned[0][1], 'harvester');
    assert.ok(spawned[0][0] <= 400, 'within the 400 on hand');
});

test('with less energy on hand than full capacity, it spawns a smaller body now instead of waiting', () => {
    const { g, build } = load();
    const spawned = [];
    g.Memory.sourceList = { NEW: ['s1', 's2'] };
    g.Memory.CurrentRoomEnergy = ['NEW', 250];
    g.Memory.autoBuildRooms = [];
    g.setSpawnBusy = () => {};
    const room = { name: 'NEW', energyAvailable: 250, energyCapacityAvailable: 550, controller: { level: 2 }, find: () => [] };
    const spawn = { name: 'S', pos: { isNearTo: () => false },
        spawnCreep: (body) => { spawned.push(body.reduce((n, p) => n + COST[p], 0)); return g.OK; } };
    build.run(spawn, [], room, [{ memory: { priority: 'harvester', homeRoom: 'NEW', sourceLocation: 's1' } }], 1);
    assert.equal(spawned.length, 1, 'not waiting for the 550 capacity');
    assert.ok(spawned[0] <= 250);
});
function wallRoom({wall=true,wallX=11,repairer=false,visitor=false,focus=false,energy=400}={}) {
    const {h,g,build}=load(),spawned=[];
    g.Memory.sourceList={NEW:['s1','s2']};g.Memory.CurrentRoomEnergy=['NEW',energy];g.Memory.autoBuildRooms=[];g.setSpawnBusy=()=>{};
    if(focus)g.Game.flags.NEWupFocus={};
    const walls=wall?[{id:'wall',structureType:g.STRUCTURE_WALL,pos:{x:wallX,y:10},hits:50000,hitsMax:300000000}]:[];
    const room={name:'NEW',controller:{my:true,level:2,pos:{x:10,y:10}},energyAvailable:energy,energyCapacityAvailable:800,
        find:type=>type===g.FIND_STRUCTURES?walls:[]};
    const residents=[['harvester','s1'],['harvester','s2'],['distributor'],['upgrader']].map(([priority,sourceLocation])=>({memory:{priority,sourceLocation,homeRoom:'NEW'}}));
    if(repairer||visitor)residents.push({memory:{priority:'repair',homeRoom:visitor?'OTHER':'NEW'}});
    const spawn={name:'S',pos:{isNearTo:()=>false},spawnCreep:(body,name,opts)=>{spawned.push({body:plain(body),role:opts.memory.priority});return g.OK;}};
    build.run(spawn,[],room,residents,1);
    return {h,g,spawned,room,walls};
}
test('young controller enclosures maintain one local repairer, including during upgrade focus',()=>{
    assert.equal(wallRoom().spawned[0].role,'repair');
    assert.equal(wallRoom({focus:true}).spawned[0].role,'repair');
    assert.equal(wallRoom({visitor:true}).spawned[0].role,'repair');
    assert.notEqual(wallRoom({repairer:true}).spawned[0].role,'repair');
    assert.notEqual(wallRoom({wall:false}).spawned[0].role,'repair');
    assert.notEqual(wallRoom({wallX:20}).spawned[0].role,'repair');
});
test('controller-wall repairers have usable affordable bodies at low energy budgets',()=>{
    for(let energy=200;energy<=800;energy+=50){
        const {spawned}=wallRoom({energy});assert.equal(spawned[0].role,'repair');
        for(const part of ['work','carry','move'])assert.ok(spawned[0].body.includes(part));
        assert.ok(spawned[0].body.reduce((n,p)=>n+COST[p],0)<=energy);
    }
});
test('young repairers keep strengthening the weakest controller wall beyond helper hit limits',()=>{
    const {h,g,room,walls}=wallRoom();
    walls.push({id:'other',structureType:g.STRUCTURE_WALL,pos:{x:10,y:11},hits:60000,hitsMax:300000000});
    const repaired=[];
    g.Game.getObjectById=id=>walls.find(w=>w.id===id);
    const creep={id:'repairer',room,memory:{priority:'repair',homeRoom:'NEW',structureTarget:'other',deathWarn:0},ticksToLive:1000,
        carry:{energy:100},carryCapacity:100,getActiveBodyparts:()=>1,
        pos:{lookFor:()=>[],findInRange:()=>[]},repair:target=>{repaired.push(target.id);return g.OK;}};
    h.load('creep.workV2').run(creep,25);assert.equal(repaired[0],'wall');
    walls[0].hits=70000;g.Game.time++;h.load('creep.workV2').run(creep,25);assert.equal(repaired[1],'other');
    assert.equal(h.load('creep.registry').tierOf(creep),'essential');
});

// A young room for the staffing pass: structures, sources and residents as given.
function staffRoom({ residents = [], structures = [], sources = [], storage, energy = 800, level = 3, sites = 0, flags = {}, containers = true } = {}) {
    const { h, g, build } = load(), spawned = [];
    // A container beside each source (the miners' economy), unless the room is still bootstrapping.
    if (containers) structures = structures.concat(sources.map(src => ({ structureType: 'container', hits: 250000, hitsMax: 250000, store: { energy: 0 }, pos: near(src.pos.x + 1, src.pos.y) })));
    g.Memory.sourceList = { NEW: sources.map(s => s.id) };
    g.Memory.CurrentRoomEnergy = ['NEW', energy];
    g.Memory.autoBuildRooms = ['NEW'];
    g.setSpawnBusy = () => {};
    Object.assign(g.Game.flags, flags);
    const objects = {};
    for (const s of sources) objects[s.id] = s;
    g.Game.getObjectById = id => objects[id];
    const room = { name: 'NEW', storage, energyAvailable: energy, energyCapacityAvailable: energy, controller: { my: true, level, pos: { x: 40, y: 40 } },
        getTerrain: () => ({ get: () => 0 }),
        find: type => type === g.FIND_STRUCTURES || type === g.FIND_MY_STRUCTURES ? structures :
            type === g.FIND_CONSTRUCTION_SITES ? Array(sites).fill({}) : [] };
    for (const s of sources) s.room = room;
    for (const s of structures) {
        s.room = room;
        if (!s.structureType.startsWith('STRUCTURE_')) s.structureType = g['STRUCTURE_' + s.structureType.toUpperCase()];
        if (s.store && s.store.energy !== undefined) s.store[g.RESOURCE_ENERGY] = s.store.energy;
    }
    const spawn = { name: 'S', pos: { isNearTo: () => false },
        spawnCreep: (body, name, opts) => { spawned.push({ role: opts.memory.priority, source: opts.memory.sourceLocation, body: plain(body) }); return g.OK; } };
    build.run(spawn, [], room, residents.map(r => Object.assign({}, r, { memory: Object.assign({ homeRoom: 'NEW' }, r.memory) })), 1);
    return { spawned, g };
}
const near = (x, y) => ({ inRangeTo: (p, r) => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) <= r, x, y });
const source = (id, x, y) => ({ id, pos: Object.assign(near(x, y), { x, y }) });
const worker = (priority, work = 5, extra = {}) => ({ memory: Object.assign({ priority }, extra), getActiveBodyparts: t => (t === 'work' || t === 'WORK' ? work : 1) });

test('a source gets more harvesters until it has 5 WORK (small early bodies); then none', () => {
    const s1 = source('s1', 10, 10), s2 = source('s2', 30, 30);
    let r = staffRoom({ sources: [s1, s2], energy: 300, level: 1, residents: [worker('harvester', 2, { sourceLocation: 's1' }), worker('harvester', 5, { sourceLocation: 's2' })] });
    assert.equal(r.spawned[0].role, 'harvester');
    assert.equal(r.spawned[0].source, 's1', 'the source short of WORK gets a second harvester');
    r = staffRoom({ sources: [s1, s2], residents: [worker('harvester', 5, { sourceLocation: 's1' }), worker('harvester', 5, { sourceLocation: 's2' }), worker('distributor'), worker('upgrader'), worker('upgrader'), worker('upgrader')] });
    assert.ok(!r.spawned.some(c => c.role === 'harvester'), 'both sources at 5 WORK: ' + JSON.stringify(r.spawned));
});

test('no supplier before the storage (it only takes from the storage), even with a Supply flag', () => {
    const s1 = source('s1', 10, 10);
    const residents = [worker('harvester', 5, { sourceLocation: 's1' }), worker('distributor'), worker('upgrader'), worker('upgrader'), worker('upgrader')];
    const tower = { structureType: 'tower', hits: 3000, hitsMax: 3000, pos: near(20, 20) };
    let r = staffRoom({ sources: [s1], residents, structures: [tower], flags: { NEWSupply: { pos: { isNearTo: () => false } } } });
    assert.ok(!r.spawned.some(c => c.role === 'supplier'), JSON.stringify(r.spawned));
    r = staffRoom({ sources: [s1], residents, structures: [tower], storage: { store: { energy: 1000 } }, level: 4 });
    assert.equal(r.spawned[0].role, 'supplier', 'storage and towers: the supplier feeds the towers');
});

test('decaying roads and walls alone spawn no repairer; a damaged spawn or a half-broken container does', () => {
    const s1 = source('s1', 10, 10);
    const residents = [worker('harvester', 5, { sourceLocation: 's1' }), worker('distributor'), worker('upgrader'), worker('upgrader'), worker('upgrader')];
    const road = { structureType: 'road', hits: 1000, hitsMax: 5000, pos: near(5, 5) };
    const rampart = { structureType: 'rampart', hits: 1000, hitsMax: 300000, pos: near(6, 6) };
    const container = { structureType: 'container', hits: 200000, hitsMax: 250000, store: { energy: 0 }, pos: near(11, 11) };
    let r = staffRoom({ sources: [s1], residents, structures: [road, rampart, container] });
    assert.ok(!r.spawned.some(c => c.role === 'repair'), JSON.stringify(r.spawned));
    r = staffRoom({ sources: [s1], residents, structures: [road, Object.assign({}, container, { hits: 100000 })] });
    assert.equal(r.spawned[0].role, 'repair');
});

test('helpers stand in for the builder, then upgraders (one upgrader always kept)', () => {
    const s1 = source('s1', 10, 10);
    const base = [worker('harvester', 5, { sourceLocation: 's1' }), worker('distributor')];
    const helper = worker('helper', 8, { destination: 'NEW', homeRoom: 'E1N1' });
    let r = staffRoom({ sources: [s1], residents: base.concat([worker('upgrader')]), sites: 3 });
    assert.ok(r.spawned.some(c => c.role === 'upgrader' || c.role === 'builder'), 'no helpers: builder and upgraders wanted');
    r = staffRoom({ sources: [s1], residents: base.concat([worker('upgrader'), helper, helper, helper]), sites: 3 });
    assert.equal(r.spawned.length, 0, 'three helpers cover the builder and the other upgraders: ' + JSON.stringify(r.spawned));
});

test('source containers nearly full: an extra upgrader spends the overflow', () => {
    const s1 = source('s1', 10, 10);
    const residents = [worker('harvester', 5, { sourceLocation: 's1' }), worker('distributor'), worker('upgrader'), worker('upgrader'), worker('upgrader')];
    const container = { structureType: 'container', hits: 250000, hitsMax: 250000, store: { energy: 1900 }, pos: near(11, 11) };
    let r = staffRoom({ sources: [s1], residents, structures: [Object.assign({}, container, { store: { energy: 300 } })] });
    assert.equal(r.spawned.length, 0, '3 upgraders at RCL3 with energy to spare: enough');
    r = staffRoom({ sources: [s1], residents, structures: [container] });
    assert.equal(r.spawned[0].role, 'upgrader');
});

test('the rampart shell over the spawn is repaired up to its cap; ramparts off the shell are not', () => {
    const s1 = source('s1', 10, 10);
    const residents = [worker('harvester', 5, { sourceLocation: 's1' }), worker('distributor'), worker('upgrader'), worker('upgrader'), worker('upgrader')];
    const spawn = () => ({ structureType: 'spawn', my: true, hits: 5000, hitsMax: 5000, pos: near(20, 20) });
    const rampart = hits => ({ structureType: 'rampart', my: true, hits, hitsMax: 1000000, pos: near(20, 20) });
    let r = staffRoom({ sources: [s1], residents, structures: [spawn(), rampart(1000)] });
    assert.equal(r.spawned[0] && r.spawned[0].role, 'repair', 'shell rampart at 1000: repairer');
    r = staffRoom({ sources: [s1], residents, structures: [spawn(), rampart(60000)] });
    assert.ok(!r.spawned.some(c => c.role === 'repair'), 'at the 50k cap: none');
    r = staffRoom({ sources: [s1], residents, structures: [spawn(), Object.assign(rampart(1000), { pos: near(30, 30) })] });
    assert.ok(!r.spawned.some(c => c.role === 'repair'), 'a rampart off the shell: none');
});

test('bootstrap (no storage, no source container): carrying 5-part harvesters, at most 3 per source, nothing cut down, no distributor or upgrader', () => {
    const s1 = source('s1', 10, 10), s2 = source('s2', 30, 30);
    const r = n => staffRoom({ sources: [s1, s2], energy: n, level: 1, containers: false, residents: [] .concat(
        [carryless('s1'), carryless('s1')]) });
const carryless = id => Object.assign(worker('harvester', 1, { sourceLocation: id }), { getActiveBodyparts: t => (t === 'work' ? 1 : 0) });
    // Two carry-less [MOVE, WORK] harvesters at s1 don't count: s1 (or s2) gets a carrying one.
    let out = r(300);
    assert.equal(out.spawned[0].role, 'harvester');
    assert.deepEqual(out.spawned[0].body.map(p => p[0]).join(''), 'wccmm', 'the 300-energy default unit');
    assert.equal(out.spawned[0].source, 's1', 'its two [MOVE, WORK] harvesters cannot carry, so s1 still gets a carrier');
    out = r(150);
    assert.equal(out.spawned.length, 0, 'at 150 it waits instead of making a creep that cannot carry');
    // Three carriers on each source: no more harvesters, and no distributor/upgrader either.
    const carriers = [];
    for (const id of ['s1', 's2']) for (let i = 0; i < 3; i++) carriers.push(Object.assign(worker('harvester', 1, { sourceLocation: id }), { getActiveBodyparts: () => 1 }));
    out = staffRoom({ sources: [s1, s2], energy: 800, level: 2, containers: false, residents: carriers });
    assert.equal(out.spawned.length, 0, JSON.stringify(out.spawned));
});

test('bootstrap bodies scale by whole blocks, up to 3', () => {
    const { build } = load();
    assert.equal(build.getBootstrapConfig(299).length, 0);
    assert.equal(build.getBootstrapConfig(550).length, 5);
    assert.equal(build.getBootstrapConfig(1300).length, 15);
});
