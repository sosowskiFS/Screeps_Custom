const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');
function setup(overrides = {}) {
    const h = harness(overrides), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    h.context.Memory.settings = Object.assign({}, h.context.Memory.settings, { shardX: true });   // these tests exercise shardX switched on
    g.Game.shard.name = 'shard2';
    let now = 1000000;
    g.Date = { now: () => now };
    const messages = {};
    g.InterShardMemory = { getLocal: () => messages.shard2 || '', setLocal: v => { messages[g.Game.shard.name] = v; }, getRemote: s => messages[s] || '' };
    const store = values => Object.assign({ getFreeCapacity: () => 100000 }, values);
    const home = g.Game.rooms.HOME = { name: 'HOME', energyCapacityAvailable: 12900, controller: { my: true, level: 8 },
        storage: { store: store({}) }, terminal: { store: store({}) }, find: () => [] };
    const target = g.Game.rooms.NEW = { name: 'NEW', controller: { my: true, level: 2 }, find: () => [] };
    g.Game.spawns.A = { room: home, spawning: null };
    g.Memory.expansion = { st: 'develop', sp: 'HOME', t: 'NEW' };
    const sys = h.load('system.guardSquads');
    // Scheduling tests: every home can boost MOVE (the MOVE rule has its own tests).
    h.load('system.guardBoosts').moveReady = () => true;
    const advance = (ticks = 1, ms = ticks * 3000) => { g.Game.time += ticks; now += ms; };
    return { h, g, sys, home, target, messages, advance, now: () => now, store };
}
function escalate(s, desired = 1) {
    s.sys.latch(s.target, 'prior safe mode'); s.sys.run();
    const target = Object.values(s.sys.state().targets)[0];
    target.desired = desired;
    return target;
}
function spawnAll(s) {
    const orders = [];
    for (let i = 0; i < 4; i++) {
        const order = s.sys.spawnOrder('HOME'); assert.ok(order); s.sys.spawned(order); orders.push(order);
    }
    return orders;
}
function post(s, orders, ttl = 1200) {
    for (const o of orders) s.g.Game.creeps[o.name] = { name: o.name, memory: Object.assign({}, o.memory,
        { guardBoostDone: true, guardPhase: 'arrived', guardAssembled: true }), room: s.target,
        ticksToLive: ttl, body: o.body.map(type => ({ type, hits: 100 })) };
}
test('escalation is latched only for young owned rooms; bootstrap is shard-specific', () => {
    const s = setup(); s.sys.run(); assert.equal(Object.keys(s.sys.state().targets).length, 0);
    escalate(s); delete s.target.controller.safeMode; s.advance(); s.sys.run();
    assert.equal(s.sys.escalated('shard2', 'NEW'), true);
    const x = setup(); x.g.Game.rooms.E29N36 = { name: 'E29N36', controller: { my: true, level: 2 } };
    x.sys.run(); assert.equal(x.sys.escalated('shard2', 'E29N36'), false);
    x.g.Game.shard.name = 'shardX'; x.advance(); x.sys.run(); assert.equal(x.sys.escalated('shardX', 'E29N36'), true);
    const old = { name: 'OLD', controller: { my: true, level: 7 }, storage: {} };
    x.sys.latch(old, 'test'); assert.equal(x.sys.escalated('shardX', 'OLD'), false);
});
test('every quad member is alike: TOUGH, RANGED_ATTACK and HEAL about 4:1, then MOVE, HEAL last; quad minerals', () => {
    const s = setup(), g = s.g, boost = s.h.load('system.guardBoosts');
    const cost = { tough: 10, move: 50, ranged_attack: 150, heal: 250 };
    const full = plain(s.sys.body(12900, 0));
    assert.equal(full.reduce((n,p) => n + cost[p], 0), 5900);
    assert.deepEqual(plain(s.sys.body(12900, 3)), full, 'no dedicated healer');
    const runs = full.filter((p, i) => p !== full[i - 1]);
    assert.deepEqual(runs, [g.TOUGH, g.RANGED_ATTACK, g.MOVE, g.HEAL], 'order: TOUGH, ranged, MOVE, HEAL');
    assert.deepEqual([g.TOUGH, g.RANGED_ATTACK, g.MOVE, g.HEAL].map(t => full.filter(p => p === t).length), [10, 22, 10, 8]);
    assert.equal(s.sys.body(2300, 3).length, 15);
    assert.equal(s.sys.body(500, 0).length, 0);
    const minerals = {};
    for (let i = 0; i < 4; i++) for (const [r,n] of Object.entries(boost.requirements(s.sys.body(12900,i)))) minerals[r] = (minerals[r] || 0) + n;
    assert.equal(minerals[g.RESOURCE_CATALYZED_GHODIUM_ALKALIDE], 1200);
    assert.equal(minerals[g.RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE], 1200);
    assert.equal(minerals[g.RESOURCE_CATALYZED_KEANIUM_ALKALIDE], 2640);
    assert.equal(minerals[g.RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE], 960);
});
test('four accepted slots are unique, failed attempts do not reserve, actual opaque names are preserved', () => {
    const s = setup(); escalate(s);
    const failed = s.sys.spawnOrder('HOME'); assert.equal(failed.slot.phase, 'queued');
    const first = s.sys.spawnOrder('HOME'); assert.equal(first.memory.guardSlot, failed.memory.guardSlot);
    first.memory.guardSpawnName = 'opaque123'; s.sys.spawned(first);
    assert.equal(first.slot.name, 'opaque123');
    for (let i = 1; i < 4; i++) { const o = s.sys.spawnOrder('HOME'); assert.equal(o.memory.guardSlot, i); s.sys.spawned(o); }
    assert.equal(s.sys.spawnOrder('HOME'), null);
    const report = JSON.parse(s.messages.shard2).guards;
    assert.equal(Object.keys(report.manifests).length, 4);
    assert.equal(report.manifests.opaque123.guardRoster.length, 4);
});
test('coverage uses earliest member expiry, overlaps replacements, and retains the posted squad', () => {
    const s = setup(); const t = escalate(s), orders = spawnAll(s);
    // Use a short measured route so a healthy squad does not immediately need a successor.
    t.samples[4] = 50; post(s, orders, 1400); s.advance(); s.sys.run();
    assert.equal(t.gap, false); assert.equal(t.squads.length, 1);
    s.g.Game.creeps[orders[3].name].ticksToLive = 500;
    s.advance(); s.sys.run(); assert.equal(t.squads.length, 2);
    assert.equal(t.squads[0].slots.every(slot => slot.name), true);
    assert.notEqual(s.sys.spawnOrder('HOME').memory.guardSquad, orders[0].memory.guardSquad);
});
test('a confirmed casualty reopens its specialization, graduation releases reservations without changing defenders', () => {
    const s = setup(); const t = escalate(s), orders = spawnAll(s); t.samples[4] = 50;
    post(s, orders, 1400); s.advance(); s.sys.run();
    delete s.g.Game.creeps[orders[3].name]; s.advance(); s.sys.run();
    assert.equal(t.gap, true); assert.equal(s.sys.spawnOrder('HOME').memory.guardSlot, 3);
    assert.equal(t.squads.length, 1);
    s.target.terminal = { my: true }; s.advance(); s.sys.run();
    assert.equal(s.sys.spawnOrder('HOME'), null);
    assert.equal(s.h.load('system.guardBoosts').roomState('HOME'), undefined);
    assert.equal(Object.keys(s.g.Game.creeps).length, 3);
});
test('ownership loss stops reinforcement; sponsor handoff retains squad identity', () => {
    const s = setup(); const t = escalate(s); spawnAll(s);
    const id = t.squads[0].id;
    s.g.Game.rooms.OTHER = Object.assign({}, s.home, { name: 'OTHER' });
    s.g.Memory.expansion.sp = 'OTHER'; s.advance(); s.sys.run();
    assert.equal(t.home, 'OTHER'); assert.equal(t.squads[0].id, id);
    s.target.controller.my = false; s.advance(); s.sys.run();
    assert.equal(t.stopped, true); assert.equal(s.sys.spawnOrder('OTHER'), null);
});
test('cross-shard snapshots age in milliseconds, not by subtracting unrelated Game.time values', () => {
    const s = setup(); delete s.g.Memory.expansion;
    s.g.Memory.xs = { mode: 'claim', targets: [{ r:'E29N36',h:'shard2:HOME',e:'E30N40',t:100 }] };
    s.messages.shardX = JSON.stringify({ guards: { at:s.now(), tick:9000000, ms:1000,
        rooms:{ E29N36:{escalated:true,owned:true,established:false} }, members:{} } });
    s.sys.run(); const t = Object.values(s.sys.state().targets)[0]; t.desired=1; const orders = spawnAll(s);
    const members = Object.fromEntries(orders.map(o => [o.name, { name:o.name,squad:o.memory.guardSquad,slot:o.memory.guardSlot,
        target:'E29N36',room:'E29N36',phase:'arrived',assembled:true,ttl:1400,movement:1,boosts:{} }]));
    s.messages.shardX = JSON.stringify({ guards: { at:s.now(), tick:9000001, ms:1000,
        rooms:{ E29N36:{escalated:true,owned:true,established:false} },members } });
    s.advance(); s.sys.run();
    assert.ok(t.remaining < 470 && t.remaining > 400);
    assert.equal(t.gap,false);
    s.advance(30, 90000); s.sys.run();
    assert.equal(s.sys.fresh(JSON.parse(s.messages.shardX).guards), false);
    assert.ok(t.remaining < 450, 'stale data cannot refresh the old TTL');
});
test('manifests restore member identity after a global reset and remove source-only portal state', () => {
    const s = setup(); escalate(s); const orders = spawnAll(s), healer = orders[3];
    const x = setup(); x.g.Game.shard.name = 'shardX'; x.messages.shard2 = s.messages.shard2;
    const c = { name: healer.name, memory:{} };
    assert.equal(x.sys.adopt(c),true);
    assert.equal(x.g.Memory.creeps[c.name].guardSlot,3);
    assert.equal(x.g.Memory.creeps[c.name].xShard,undefined);
    assert.equal(x.g.Memory.creeps[c.name].guardBoostDone,true);
});
test('boost preparation is bounded, uses available partial T3 and skips absent minerals', () => {
    const s = setup(), g = s.g, b = s.h.load('system.guardBoosts');
    const res = g.RESOURCE_CATALYZED_KEANIUM_ALKALIDE;
    let boosted = 0;
    const lab = { id:'lab', mineralType:res,mineralAmount:30,store:s.store({[res]:30,[g.RESOURCE_ENERGY]:20}),
        boostCreep:(c,n) => { boosted += n; c.body[0].boost=res; lab.store[res]=0; return g.OK; } };
    g.Game.getObjectById = id => id === 'lab' ? lab : null; g.Memory.labList.HOME=['lab'];
    g.Memory.guardBoosts = { rooms: { HOME:{need:{[res]:60},assignments:{lab:res}} } };
    const c = { memory:{homeRoom:'HOME'},room:s.home,body:[{type:g.RANGED_ATTACK,hits:100},{type:g.RANGED_ATTACK,hits:100}, {type:g.MOVE,hits:100,boost:g.RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE}],pos:{isNearTo:()=>true} };
    assert.equal(b.boost(c),true); assert.equal(boosted,1);
    s.advance(); assert.equal(b.boost(c),false); assert.equal(c.memory.guardBoostDone,true);
    s.home.storage.store[res]=300;
    const waiting = { memory:{homeRoom:'HOME'},room:s.home,body:[{type:g.RANGED_ATTACK,hits:100}],pos:{isNearTo:()=>true} };
    assert.equal(b.boost(waiting),true); s.advance(100); assert.equal(b.boost(waiting),false);
    const urgent = { memory:{homeRoom:'HOME',guardDeparture:g.Game.time},room:s.home,body:waiting.body };
    assert.equal(b.boost(urgent),false);
});
test('reservations include pending plus future quad, prefer existing labs, and protect mineral floors', () => {
    const s=setup(), g=s.g, b=s.h.load('system.guardBoosts');
    const range=g.RESOURCE_CATALYZED_KEANIUM_ALKALIDE;
    const list=Array.from({length:10},(_,i)=>({id:'lab'+i,mineralType:i===0?range:null,mineralAmount:i===0?3000:0,store:s.store({})}));
    g.Memory.labList.HOME=list.map(l=>l.id); g.Game.getObjectById=id=>list.find(l=>l.id===id);
    escalate(s);
    assert.equal(b.reserved('HOME',range),7920);   // three formations x 4 members x 22 RANGED_ATTACK x 30
    assert.equal(b.assignment('HOME','lab0'),range);
    assert.equal(Object.keys(b.roomState('HOME').assignments).length,4);
    assert.equal(b.assignment('HOME','lab3'),undefined);
    assert.equal(b.assignment('HOME','lab4'),undefined);
    assert.ok(s.h.load('system.labs').targets(1)[range] >= 10400);
    assert.ok(b.shortages('HOME')[range] > 0);
});
test('a lost home-shard traveler is replaced promptly, while portal transit keeps its reservation', () => {
    const s=setup();const t=escalate(s);t.samples[4]=50;const orders=spawnAll(s);
    const o=orders[0];
    s.g.Game.creeps[o.name]={name:o.name,memory:Object.assign({},o.memory,{guardPhase:'traveling',guardBoostDone:true}),room:s.home,ticksToLive:1200,body:[]};
    s.advance();s.sys.run();delete s.g.Game.creeps[o.name];s.advance();s.sys.run();
    assert.equal(s.sys.spawnOrder('HOME').memory.guardSlot,0);
    const replacement=s.sys.spawnOrder('HOME');s.sys.spawned(replacement);
    s.g.Game.creeps[replacement.name]={name:replacement.name,memory:Object.assign({},replacement.memory,{guardPhase:'crossing',guardBoostDone:true}),room:s.home,ticksToLive:1200,body:[]};
    s.sys.publish(true);delete s.g.Game.creeps[replacement.name];s.advance();s.sys.run();
    assert.equal(s.sys.spawnOrder('HOME'),null);
});
test('graduation does not erase manifests for a squad already in transit', () => {
    const s=setup();escalate(s);const orders=spawnAll(s);
    s.target.terminal={my:true};s.advance();s.sys.run();s.sys.publish(true);
    const manifests=JSON.parse(s.messages.shard2).guards.manifests;
    assert.equal(Object.keys(manifests).length,4);
    assert.ok(manifests[orders[3].name]);
});
test('lease worker flushes old minerals, loads boost minerals, and restores ordinary ownership', () => {
    const s=setup(),g=s.g,b=s.h.load('system.guardBoosts');
    const res=g.RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE;
    const lab={id:'lab',mineralType:'old',mineralAmount:100,store:s.store({old:100})};
    g.Game.getObjectById=id=>id==='lab'?lab:null;
    s.home.terminal.store[res]=300;g.Memory.guardBoosts={rooms:{HOME:{need:{[res]:300},assignments:{lab:res}}}};
    const calls=[], c={room:s.home,memory:{structureTarget:'lab'},carry:{},carryCapacity:100,
        withdraw:(target,resource,amount)=>{calls.push(['withdraw',target===lab?'lab':'terminal',resource]);c.carry[resource]=amount||100;return g.OK;},
        transfer:(target,resource)=>{calls.push(['transfer',target===lab?'lab':'terminal',resource]);delete c.carry[resource];return g.OK;}};
    assert.equal(b.workLabs(c),true);assert.deepEqual(calls[0],['withdraw','lab','old']);
    assert.equal(b.workLabs(c),true);assert.deepEqual(calls[1],['transfer','terminal','old']);
    lab.mineralType=undefined;lab.mineralAmount=0;lab.store[g.RESOURCE_ENERGY]=2000;
    assert.equal(b.workLabs(c),true);assert.deepEqual(calls[2],['withdraw','terminal',res]);
    assert.equal(b.workLabs(c),true);assert.deepEqual(calls[3],['transfer','lab',res]);
    g.Memory.guardBoosts.rooms={};assert.equal(b.workLabs(c),false);
});
test('existing sell orders cannot consume stock reserved by a different sponsor room', () => {
    const s=setup(),g=s.g,res=g.RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE;
    g.Memory.guardBoosts={rooms:{HOME:{need:{[res]:2000},assignments:{}}}};
    s.home.terminal.store[res]=1000;
    const seller=g.Game.rooms.SELLER={name:'SELLER',controller:{my:true},terminal:{store:s.store({[res]:3000})}};
    const cancelled=[];
    Object.assign(g.Game.market,{credits:100000,orders:{o:{id:'o',roomName:'SELLER',resourceType:res,type:g.ORDER_SELL,remainingAmount:3000,price:1}},
        cancelOrder:id=>{cancelled.push(id);return g.OK;},getHistory:()=>[],createOrder:()=>g.OK});
    s.h.load('system.market').sellCompounds();assert.deepEqual(cancelled,['o']);assert.ok(seller);
});
test('delayed portal manifests hold an opaque healer instead of dispatching it as a scout',()=>{
    const s=setup(),g=s.g;g.Game.shard.name='shardX';
    const c={name:'opaqueHealer',memory:{},getActiveBodyparts:type=>type===g.HEAL?30:0};
    g.Game.creeps[c.name]=c;s.h.load('system.shardX').adopt();
    assert.equal(g.Memory.creeps[c.name].priority,'roomGuard');
    assert.equal(g.Memory.creeps[c.name].guardAwaitManifest,true);
    c.memory=g.Memory.creeps[c.name];
    s.messages.shard2=JSON.stringify({guards:{manifests:{opaqueHealer:{priority:'roomGuard',guardSquad:'q',guardSlot:3,guardKind:'healer',destination:'NEW',guardTargetShard:'shardX'}}}});
    s.advance();s.h.load('system.shardX').adopt();
    assert.equal(g.Memory.creeps[c.name].guardSquad,'q');
    assert.equal(g.Memory.creeps[c.name].guardAwaitManifest,undefined);
});
test('ordinary cross-shard guards still adopt their original xs traveller record',()=>{
    const s=setup(),g=s.g;g.Game.shard.name='shardX';
    const c={name:'ordinary',memory:{},getActiveBodyparts:type=>type===g.RANGED_ATTACK?15:0};g.Game.creeps[c.name]=c;
    s.messages.shard2=JSON.stringify({xs:{travellers:{ordinary:{m:{priority:'roomGuard',destination:'NEW',homeRoom:'HOME'}}}}});
    s.h.load('system.shardX').adopt();
    assert.equal(g.Memory.creeps[c.name].destination,'NEW');
    assert.equal(g.Memory.creeps[c.name].guardAwaitManifest,undefined);
});
test('long routes pipeline a second defensive quad before the initial quad reaches the post',()=>{
    const s=setup(),t=escalate(s,2);t.samples[4]=450;
    const first=spawnAll(s);s.advance(300);s.sys.run();
    assert.equal(t.active.length,0);
    assert.equal(t.squads.length,2);
    const next=s.sys.spawnOrder('HOME');assert.ok(next);
    assert.notEqual(next.memory.guardSquad,first[0].memory.guardSquad);
    assert.equal(t.squads[0].slots.every(slot=>slot.name),true);
});
test('safe mode reserves two formations, delays their lives, then deploys both just in time',()=>{
    const s=setup();s.target.controller.safeMode=5000;s.sys.run();
    const t=Object.values(s.sys.state().targets)[0];
    assert.equal(t.safeMode,true);assert.equal(t.squads.length,0);assert.equal(s.sys.spawnOrder('HOME'),null);
    assert.ok(s.h.load('system.guardBoosts').roomState('HOME'));
    assert.equal(s.g.Memory.energyNeedRooms[0],'HOME');
    s.target.controller.safeMode=t.lead+200;s.advance();s.sys.run();
    assert.ok(s.sys.spawnOrder('HOME'));assert.equal(t.squads.length,1);
    s.advance();s.sys.run();assert.equal(t.squads.length,2);
});
test('cross-shard safe mode countdown is published and starts source orders near expiry',()=>{
    const x=setup();x.g.Game.shard.name='shardX';x.target.controller.safeMode=5000;x.sys.latch(x.target,'test');x.sys.publish(true);
    const report=JSON.parse(x.messages.shardX).guards;
    assert.equal(report.rooms.NEW.safeMode,5000);
    const s=setup();delete s.g.Memory.expansion;s.g.Memory.xs={mode:'claim',targets:[{r:'NEW',h:'shard2:HOME',e:'ENTRY',t:100}]};
    s.messages.shardX=x.messages.shardX;s.sys.run();assert.equal(s.sys.spawnOrder('HOME'),null);
    s.advance();report.at=s.now();report.rooms.NEW.safeMode=1000;s.messages.shardX=JSON.stringify({guards:report});
    s.sys.run();assert.ok(s.sys.spawnOrder('HOME'));
});
test('the sponsor builds one quad and the nearest capable room to the target builds the other',()=>{
    const s=setup(),g=s.g;
    const store=values=>Object.assign({getFreeCapacity:()=>100000},values);
    const labsIn=()=>[1,2,3].map(i=>({structureType:g.STRUCTURE_LAB,id:'lab'+i}));
    const room=(name,cap=12900)=>({name,energyCapacityAvailable:cap,controller:{my:true,level:8},storage:{store:store({})},terminal:{store:store({})},find:type=>type===g.FIND_MY_STRUCTURES?labsIn():[]});
    g.Game.rooms.NEAR=room('NEAR');g.Game.rooms.FAR=room('FAR');g.Game.rooms.SMALL=room('SMALL',5600);
    g.Game.spawns.B={room:g.Game.rooms.NEAR,spawning:null};g.Game.spawns.C={room:g.Game.rooms.FAR,spawning:null};g.Game.spawns.D={room:g.Game.rooms.SMALL,spawning:null};
    for(const n of ['HOME','NEAR','FAR','SMALL'])g.Memory.labList[n]=['l1','l2','l3'];
    const dist={HOME:3,NEAR:3,FAR:5,SMALL:1};
    g.Game.map.getRoomLinearDistance=(a)=>dist[a]===undefined?20:dist[a];
    const t=escalate(s,2);
    assert.equal(t.helper,'NEAR','nearest room able to build the same quad (SMALL is too small)');
    assert.equal(t.squads.map(q=>q.home).join(),'HOME');
    s.advance();s.sys.run();
    assert.equal(t.squads.map(q=>q.home).join(),'HOME,NEAR');
    // Each home spawns only its own squad.
    const home=s.sys.spawnOrder('HOME'),near=s.sys.spawnOrder('NEAR');
    assert.equal(home.squad.id,t.squads[0].id);assert.equal(near.squad.id,t.squads[1].id);
    assert.equal(near.memory.homeRoom,'NEAR');
    assert.equal(s.sys.spawnOrder('FAR'),null);
    // Boost minerals are reserved at both homes.
    s.h.load('system.guardBoosts').prepare();
    assert.ok(g.Memory.guardBoosts.rooms.HOME&&g.Memory.guardBoosts.rooms.NEAR,JSON.stringify(Object.keys(g.Memory.guardBoosts.rooms)));
});
test('squads made before homes existed keep the room that started them; empty ones are shared out',()=>{
    const s=setup(),g=s.g;
    const store=values=>Object.assign({getFreeCapacity:()=>100000},values);
    g.Game.rooms.NEAR={name:'NEAR',energyCapacityAvailable:12900,controller:{my:true,level:8},storage:{store:store({})},terminal:{store:store({})},find:type=>type===g.FIND_MY_STRUCTURES?[1,2,3].map(i=>({structureType:g.STRUCTURE_LAB,id:'l'+i})):[]};
    g.Game.spawns.B={room:g.Game.rooms.NEAR,spawning:null};
    g.Memory.labList.HOME=['l1'];g.Memory.labList.NEAR=['l1'];
    g.Game.map.getRoomLinearDistance=()=>3;
    const t=escalate(s,2);
    t.squads=[{id:'a',created:1,slots:[{slot:0,name:'x',memory:{homeRoom:'HOME'}},{slot:1},{slot:2},{slot:3}]},
        {id:'b',created:2,slots:[{slot:0},{slot:1},{slot:2},{slot:3}]}];
    s.advance();s.sys.run();
    assert.equal(t.squads.map(q=>q.home).join(),'HOME,NEAR');
});
test('a quad member never leaves with unboosted MOVE: other boosts keep their window, MOVE is waited for',()=>{
    const s=setup(),g=s.g,b=s.h.load('system.guardBoosts');
    const XZ=g.RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE;
    const lab={id:'zlab',store:s.store({[XZ]:0,[g.RESOURCE_ENERGY]:2000}),
        boostCreep:(c,n)=>{c.body.filter(p=>p.type===g.MOVE).slice(0,n).forEach(p=>p.boost=XZ);lab.store[XZ]-=30*n;return g.OK;}};
    g.Game.getObjectById=id=>id==='zlab'?lab:null;g.Memory.labList.HOME=['zlab'];
    g.Memory.guardBoosts={rooms:{HOME:{need:{[XZ]:60},assignments:{zlab:XZ}}}};
    const c={memory:{homeRoom:'HOME'},room:s.home,body:[{type:g.MOVE,hits:100},{type:g.MOVE,hits:100},{type:g.RANGED_ATTACK,hits:100}],pos:{isNearTo:()=>true}};
    assert.equal(b.boost(c),true);
    s.advance(500);                                   // far past the 100-tick window
    assert.equal(b.boost(c),true,'still waiting for XZHO2');
    assert.match(c.memory.guardBlocked,/XZHO2/);
    lab.store[XZ]=60;s.home.storage.store[XZ]=60;
    assert.equal(b.boost(c),true);                    // boosts now
    assert.equal(b.boost(c),false,'MOVE boosted: leaves');
    assert.equal(c.memory.guardBoostDone,true);
});
test('a quad member is only spawned where an XZHO2 lab can boost all its MOVE',()=>{
    const h=harness(),g=h.context;h.load('runtime.memory').ensureInitialized();
    const b=h.load('system.guardBoosts'),XZ=g.RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE;
    const store=v=>Object.assign({getFreeCapacity:()=>100000},v);
    g.Game.rooms.HOME={name:'HOME',storage:{store:store({[XZ]:0})},terminal:{store:store({})}};
    const parts=Array(10).fill(g.MOVE).concat(Array(30).fill(g.RANGED_ATTACK));
    assert.equal(b.moveReady('HOME',parts),false,'no lab leased');
    const lab={id:'zlab',store:store({})};g.Game.getObjectById=id=>id==='zlab'?lab:null;g.Memory.labList.HOME=['zlab'];
    g.Memory.guardBoosts={rooms:{HOME:{need:{[XZ]:1200},assignments:{zlab:XZ}}}};
    assert.equal(b.moveReady('HOME',parts),false,'lab but no XZHO2');
    g.Game.rooms.HOME.storage.store[XZ]=300;
    assert.equal(b.moveReady('HOME',parts),true,'10 MOVE x 30 = 300');
    g.Game.creeps.w={memory:{guardSquad:'q',homeRoom:'HOME'},body:Array(10).fill(0).map(()=>({type:g.MOVE,hits:100}))};
    assert.equal(b.moveReady('HOME',parts),false,'a member already waiting takes that stock');
});
test('boost labs: the lab worker carries the compound first and leaves lab energy to a distributor; energy only for what the boosts use',()=>{
    const s=setup(),g=s.g,b=s.h.load('system.guardBoosts');
    const res=g.RESOURCE_CATALYZED_KEANIUM_ALKALIDE;
    const lab={id:'lab',mineralType:undefined,mineralAmount:0,store:s.store({}),pos:{}};
    g.Game.getObjectById=id=>id==='lab'?lab:null;
    s.home.terminal.store[res]=3000;s.home.terminal.store[g.RESOURCE_ENERGY]=50000;
    g.Memory.guardBoosts={rooms:{HOME:{need:{[res]:2640},assignments:{lab:res}}}};
    const calls=[];
    const worker=()=>({room:s.home,memory:{},carry:{},carryCapacity:100,
        withdraw:(t,r)=>{calls.push(['withdraw',r]);return g.OK;},transfer:()=>g.OK});
    // A distributor lives here: the lab worker takes the compound, not energy.
    g.Game.creeps.d={memory:{priority:'distributor',homeRoom:'HOME'},room:s.home};
    b.workLabs(worker());
    assert.deepEqual(calls[0],['withdraw',res]);
    assert.equal(b.labEnergyWant(g.Memory.guardBoosts.rooms.HOME,res),1760,'88 parts x 20 (it used to fill 2000)');
    // Compound in: the lab still needs energy, and that is the distributor's job.
    lab.store[res]=3000;lab.mineralType=res;lab.mineralAmount=3000;calls.length=0;
    assert.equal(b.workLabs(worker()),false,'nothing for the lab worker');
    const dist={room:s.home,pos:{findClosestByRange:l=>l[0]}};
    assert.equal(b.labNeedingEnergy(dist),lab);
    lab.store[g.RESOURCE_ENERGY]=1760;
    assert.equal(b.labNeedingEnergy(dist),null,'enough for the planned boosts');
    // No distributor or mule: the lab worker fills energy itself (after the compound).
    delete g.Game.creeps.d;lab.store[g.RESOURCE_ENERGY]=0;
    b.workLabs(worker());
    assert.deepEqual(calls[0],['withdraw',g.RESOURCE_ENERGY]);
});
test('while boosting needs it, the lab worker does not go off as a distributor, and one that did comes back',()=>{
    const s=setup(),g=s.g,b=s.h.load('system.guardBoosts');
    const res=g.RESOURCE_CATALYZED_KEANIUM_ALKALIDE;
    const lab={id:'lab',mineralType:undefined,mineralAmount:0,store:s.store({}),pos:{}};
    g.Game.getObjectById=id=>id==='lab'?lab:null;
    s.home.terminal.store[res]=3000;
    g.Memory.guardBoosts={rooms:{HOME:{need:{[res]:2640},assignments:{lab:res}}}};
    assert.equal(b.mineralsUrgent(s.home),true,'the lab is short of its compound');
    lab.store[res]=2640;
    assert.equal(b.mineralsUrgent(s.home),false);
    g.Game.creeps.q={memory:{guardSquad:'q',homeRoom:'HOME'},room:s.home};
    assert.equal(b.mineralsUrgent(s.home),true,'a member waiting at home to be boosted');
    // A lab worker on loan as a distributor, empty: straight back.
    const loan={room:s.home,memory:{priority:'distributor',previousPriority:'labWorker'},store:{},carry:{},ticksToLive:1000};
    s.h.load('creep.distributor').run(loan);
    assert.equal(loan.memory.priority,'labWorker');
});
test('an old squad is not refilled (its replacement is the next squad), and is retired once nobody is left',()=>{
    const s=setup();const t=escalate(s,1);const orders=spawnAll(s);
    post(s,orders,1400);s.advance();s.sys.run();
    const q=t.squads[0];
    s.g.Game.time=q.created+s.sys.REFILL_WINDOW+1;
    delete s.g.Game.creeps[orders[3].name];s.advance();s.sys.run();
    const o=s.sys.spawnOrder('HOME');
    assert.ok(!o||o.squad.id!==q.id,'the old squad does not get a new member');
    for(const x of orders)delete s.g.Game.creeps[x.name];
    s.advance();s.sys.run();
    assert.ok(!t.squads.some(x=>x.id===q.id)||q.retired,'retired with nobody left');
});
test('a member waiting at home steps away from the labs, storage and terminal',()=>{
    const s=setup(),g=s.g,b=s.h.load('system.guardBoosts');
    const lab={id:'lab',pos:{x:20,y:20}};g.Game.getObjectById=id=>id==='lab'?lab:null;g.Memory.labList.HOME=['lab'];
    s.home.storage.pos={x:22,y:20};s.home.terminal.pos={x:23,y:20};
    const at=(x,y)=>({x,y,roomName:'HOME',inRangeTo:(o,r)=>Math.max(Math.abs((o.pos||o).x-x),Math.abs((o.pos||o).y-y))<=r,getDirectionTo:()=>3});
    g.PathFinder={search:()=>({path:[{x:25,y:25}]})};
    s.h.load('traveler').Traveler.getStructureMatrix=()=>({});
    const moved=[];
    const near={room:s.home,memory:{homeRoom:'HOME'},pos:at(21,21),move:d=>moved.push(d)};
    assert.equal(b.parkAway(near),true);assert.equal(moved.length,1);
    const far={room:s.home,memory:{homeRoom:'HOME'},pos:at(10,10),move:d=>moved.push(d)};
    assert.equal(b.parkAway(far),false,'already clear: stays');
});
