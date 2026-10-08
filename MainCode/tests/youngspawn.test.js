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
