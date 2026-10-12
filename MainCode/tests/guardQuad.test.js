const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');
function world() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.Game.shard.name='shard2';
    const walls=new Set(), structures=[], hostiles=[], actions=[];
    const room={name:'POST',controller:null,getTerrain:()=>({get:(x,y)=>walls.has(x+','+y)?1:0}),
        find:type=>type===g.FIND_STRUCTURES?structures:type===g.FIND_CREEPS?Object.values(g.Game.creeps).concat(hostiles):
            type===g.FIND_MY_CREEPS?Object.values(g.Game.creeps):type===g.FIND_HOSTILE_CREEPS?hostiles:[]};
    g.Game.rooms.POST=room;
    class Pos {
        constructor(x,y,roomName='POST'){this.x=x;this.y=y;this.roomName=roomName;}
        lookFor(){return structures.filter(s=>this.getRangeTo(s)===0);}
        getRangeTo(other){other=other.pos||other;return other.roomName===this.roomName?Math.max(Math.abs(other.x-this.x),Math.abs(other.y-this.y)):Infinity;}
        inRangeTo(other,r){return this.getRangeTo(other)<=r;}
        isNearTo(other){return this.getRangeTo(other)<=1;}
        getDirectionTo(other){other=other.pos||other;return steps.findIndex(([x,y])=>x===Math.sign(other.x-this.x)&&y===Math.sign(other.y-this.y));}
        findClosestByRange(list){return list.slice().sort((a,b)=>this.getRangeTo(a)-this.getRangeTo(b))[0];}
    }
    const steps=[[0,0],[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
    class Matrix {
        constructor(){this.data=new Uint8Array(2500);}
        get(x,y){return x<0||y<0||x>49||y>49?255:this.data[x*50+y];}
        set(x,y,v){if(x>=0&&y>=0&&x<50&&y<50)this.data[x*50+y]=v;}
        clone(){const m=new Matrix();m.data.set(this.data);return m;}
    }
    function search(start,goals,opts={}) {
        if(!Array.isArray(goals))goals=[goals];
        const matrix=opts.roomCallback?opts.roomCallback(start.roomName):null;
        if(matrix===false)return{path:[],incomplete:true};
        const done=p=>opts.flee?goals.every(v=>p.getRangeTo(v.pos)>v.range):goals.some(v=>p.getRangeTo(v.pos)<=v.range);
        const queue=[{p:start,path:[]}],seen=new Set([start.x+','+start.y]);
        for(let j=0;j<queue.length;j++) {
            const n=queue[j];if(done(n.p))return{path:n.path,incomplete:false};
            for(const [dx,dy] of steps.slice(1)) {
                const x=n.p.x+dx,y=n.p.y+dy,k=x+','+y;
                if(x<0||y<0||x>49||y>49||seen.has(k)||walls.has(k)||(matrix&&matrix.get(x,y)>=255))continue;
                if(room.controller&&x===room.controller.pos.x&&y===room.controller.pos.y)continue;
                seen.add(k);const p=new Pos(x,y,start.roomName);queue.push({p,path:n.path.concat(p)});
            }
        }
        return{path:[],incomplete:true};
    }
    g.RoomPosition=Pos;g.PathFinder={CostMatrix:Matrix,search};
    const squad=[];
    for(let i=0;i<4;i++) {
        const c={name:'c'+i,id:'c'+i,room,pos:new Pos(10+i%2,20+Math.floor(i/2)),fatigue:0,hits:5000,hitsMax:5000,ticksToLive:1000,
            memory:{priority:'roomGuard',guardSquad:'q',guardSlot:i,guardBoostDone:true,guardTargetShard:'shard2',destination:'POST'},
            body:[{type:g.MOVE,hits:100},{type:i===3?g.HEAL:g.RANGED_ATTACK,hits:100}],
            getActiveBodyparts(type){return this.body.filter(p=>p.type===type&&p.hits>0).length;},
            move(dir){actions.push([this.name,'move',dir]);this.intent=dir;return g.OK;},
            travelTo(target,options={}){actions.push([this.name,'travel',target,options]);if(options.ignoreCreeps===false){const original=options.roomCallback;options=Object.assign({},options,{roomCallback:name=>{const matrix=original?original(name):new Matrix();for(const other of squad)if(other!==this)matrix.set(other.pos.x,other.pos.y,255);return matrix;}});}const r=search(this.pos,{pos:target.pos||target,range:options.range||0},options);if(r.path[0])this.intent=this.pos.getDirectionTo(r.path[0]);},
            heal(target){actions.push([this.name,'heal',target.name]);},rangedHeal(target){actions.push([this.name,'rangedHeal',target.name]);},
            rangedAttack(target){actions.push([this.name,'fire',target.name]);},
            rangedMassAttack(){actions.push([this.name,'mass']);}};
        squad.push(c);g.Game.creeps[c.name]=c;
    }
    h.load('traveler').Traveler.findTravelPath=(origin,destination,opts={})=>search(origin.pos||origin,{pos:destination.pos||destination,range:opts.range||0},opts);
    const q=h.load('creep.guardQuad');
    const next=()=>{g.Game.time++;actions.length=0;};
    const apply=()=>{
        const desired=new Map(squad.map(c=>[c.name,c.intent?new Pos(c.pos.x+steps[c.intent][0],c.pos.y+steps[c.intent][1]):c.pos]));
        const moving=new Set(squad.filter(c=>c.intent&&!walls.has(desired.get(c.name).x+','+desired.get(c.name).y)).map(c=>c.name));
        for(let pass=0;pass<5;pass++)for(const c of squad)if(moving.has(c.name)) {
            const p=desired.get(c.name);
            if(squad.some(o=>o!==c&&(moving.has(o.name)?desired.get(o.name):o.pos).getRangeTo(p)===0))moving.delete(c.name);
        }
        for(const c of squad){if(moving.has(c.name))c.pos=desired.get(c.name);delete c.intent;}
        next();
    };
    return {h,g,q,squad,room,walls,structures,hostiles,actions,Pos,Matrix,apply,next};
}
test('2x2 moves together, waits for fatigue, and reconciles a failed step before advancing',()=>{
    const w=world();
    assert.equal(w.q.formationMove(w.squad,new w.Pos(15,20),0),'moving');
    assert.equal(w.actions.filter(a=>a[1]==='move').length,4);
    assert.equal(new Set(w.actions.map(a=>a[2])).size,1);
    w.next();w.squad[2].fatigue=1;
    assert.equal(w.q.formationMove(w.squad,new w.Pos(15,20),0),'waiting');assert.equal(w.actions.length,0);
    w.next();w.squad[2].fatigue=0;w.squad[2].pos=new w.Pos(9,21);
    assert.equal(w.q.formationMove(w.squad,new w.Pos(15,20),0),'assembling');
    assert.equal(w.squad.every(c=>c.memory.guardAssembled),false);
});
test('footprint rejects walls, portals, hostile ramparts and exits while allowing own ramparts',()=>{
    const w=world();w.walls.add('16,16');
    w.structures.push({structureType:w.g.STRUCTURE_PORTAL,pos:new w.Pos(20,20)},
        {structureType:w.g.STRUCTURE_RAMPART,pos:new w.Pos(25,25),my:false},
        {structureType:w.g.STRUCTURE_RAMPART,pos:new w.Pos(30,30),my:true});
    const matrix=w.q.grid(w.room,w.squad,true);
    assert.equal(matrix.get(15,15),255);assert.equal(matrix.get(19,19),255);assert.equal(matrix.get(24,24),255);
    assert.notEqual(matrix.get(29,29),255);assert.equal(matrix.get(0,20),255);assert.equal(matrix.get(48,20),255);
});
test('temporary occupancy waits without breaking formation; a genuine narrow passage allows single file',()=>{
    const w=world();
    for(let y=0;y<50;y++)if(y!==20)w.walls.add('20,'+y);
    assert.equal(w.q.formationMove(w.squad,new w.Pos(30,20),0),'narrow');
    const x=world();
    // A creep-only barrier is passable in the static path, so it must not trigger snake mode.
    for(let y=0;y<50;y++)x.hostiles.push({name:'b'+y,pos:new x.Pos(20,y)});
    assert.equal(x.q.formationMove(x.squad,new x.Pos(30,20),0),'waiting');
});
test('posted quad parks all members near controller and runs only once per tick',()=>{
    const w=world();w.room.controller={pos:new w.Pos(15,20),my:true};
    for(let tick=0;tick<15;tick++){for(const c of w.squad)w.q.run(c);w.apply();}
    assert.ok(w.squad.every(c=>c.pos.getRangeTo(w.room.controller)<=3));
    assert.equal(w.q.assembled(w.squad,w.squad[0].pos),true);
    w.q.run(w.squad[0]);const count=w.actions.length;w.q.run(w.squad[3]);assert.equal(w.actions.length,count);
});
test('single-file defensive paths exclude every border tile',()=>{
    const w=world();w.q.snake(w.squad,new w.Pos(0,20),true);
    const call=w.actions.find(a=>a[1]==='travel');assert.ok(call);
    assert.equal(call[3].maxRooms,1);
    const matrix=call[3].roomCallback('POST');
    for(let i=0;i<50;i++){assert.equal(matrix.get(0,i),255);assert.equal(matrix.get(i,49),255);}
    assert.equal(call[3].roomCallback('ELSEWHERE'),false);
});
test('healer prioritizes a threatened injured member and fighters share a target',()=>{
    const w=world();w.squad[0].hits=1000;
    const enemy={name:'enemy',id:'enemy',owner:{username:'Harabi'},pos:new w.Pos(12,20),body:[{type:w.g.RANGED_ATTACK,hits:100}],hits:100,hitsMax:100};
    w.hostiles.push(enemy);
    w.q.combat(w.squad);
    assert.ok(w.actions.some(a=>a[0]==='c3'&&a[1]==='heal'&&a[2]==='c0'));
    assert.equal(w.actions.filter(a=>a[1]==='fire'&&a[2]==='enemy').length,3);
});
test('a quad traverses a one-tile chokepoint and reforms on the other side',()=>{
    const w=world();w.room.controller={pos:new w.Pos(30,20),my:true};
    for(let y=0;y<50;y++)if(y!==20)w.walls.add('20,'+y);
    for(let tick=0;tick<100;tick++){w.q.run(w.squad[0]);w.apply();}
    assert.ok(w.squad.every(c=>c.pos.x>20),JSON.stringify(w.squad.map(c=>[c.pos.x,c.pos.y])));
    assert.equal(w.q.assembled(w.squad,w.squad[0].pos),true);
    assert.ok(w.squad.every(c=>c.pos.getRangeTo(w.room.controller)<=3));
});
test('fighters use ranged mass attack only when nearby hostile damage exceeds focused fire',()=>{
    const w=world();
    w.hostiles.push(
        {name:'a',id:'a',owner:{username:'Harabi'},pos:new w.Pos(11,20),body:[],hits:100,hitsMax:100},
        {name:'b',id:'b',owner:{username:'Harabi'},pos:new w.Pos(11,21),body:[],hits:100,hitsMax:100});
    w.q.combat(w.squad);
    assert.ok(w.actions.some(a=>a[1]==='mass'));
    assert.equal(w.actions.some(a=>a[1]==='fire'),false);
});
test('whitelisted creeps are never targeted and an outmatched squad never requests another room',()=>{
    const w=world();w.room.controller={pos:new w.Pos(15,20),my:true};
    w.g.Memory.whiteList.push('friend');
    w.hostiles.push({name:'friend',id:'friend',owner:{username:'friend'},pos:new w.Pos(12,20),body:[{type:w.g.RANGED_ATTACK,hits:100}],hits:100,hitsMax:100});
    w.q.run(w.squad[0]);assert.equal(w.actions.some(a=>a[1]==='fire'),false);
    w.next();w.hostiles[0].owner.username='Harabi';w.hostiles[0].body=Array.from({length:50},()=>({type:w.g.RANGED_ATTACK,hits:100}));
    w.q.run(w.squad[0]);
    for(const c of w.squad)if(c.intent){const step=w.q.STEPS[c.intent];assert.ok(c.pos.x+step[0]>0&&c.pos.x+step[0]<49);}
    assert.equal(w.actions.some(a=>a[1]==='travel'&&a[3].maxRooms!==1),false);
});

// The squad in POST, the room just before its target (TARGET lies east): staging.
function staged() {
    const w=world();
    for(const c of w.squad)c.memory.destination='TARGET';
    w.g.FIND_EXIT_RIGHT=3;
    w.g.Game.map.findRoute=(from,to)=>[{exit:3,room:to}];
    w.g.Game.map.findExit=()=>3;
    const find=w.room.find;
    w.room.find=type=>type===3?Array.from({length:48},(_,i)=>new w.Pos(49,i+1)):find(type);
    return w;
}
// POST and TARGET side by side: stepping onto x=49 of POST lands on x=0 of TARGET (if free).
function twoRooms() {
    const w=staged(),g=w.g,squad=w.squad,hostiles=[];
    const here=r=>squad.filter(c=>c.room===r);
    const target={name:'TARGET',controller:null,getTerrain:()=>({get:()=>0}),
        find:type=>type===g.FIND_STRUCTURES?[]:type===g.FIND_CREEPS?here(target).concat(hostiles):
            type===g.FIND_MY_CREEPS?here(target):type===g.FIND_HOSTILE_CREEPS?hostiles:[]};
    g.Game.rooms.TARGET=target;
    const find=w.room.find;
    w.room.find=type=>type===g.FIND_CREEPS?here(w.room):type===g.FIND_MY_CREEPS?here(w.room):type===g.FIND_HOSTILE_CREEPS?[]:find(type);
    g.Game.map.getRoomTerrain=()=>({get:()=>0});
    g.Game.map.describeExits=name=>name==='POST'?{3:'TARGET'}:{7:'POST'};
    const steps=w.q.STEPS;
    const apply=()=>{
        const spot=c=>c.intent?{x:c.pos.x+steps[c.intent][0],y:c.pos.y+steps[c.intent][1],room:c.room}:{x:c.pos.x,y:c.pos.y,room:c.room};
        const taken=(p,self,moving)=>squad.concat(hostiles).some(o=>o!==self&&o.room===p.room&&(moving.has(o)?spot(o):o.pos).x===p.x&&(moving.has(o)?spot(o):o.pos).y===p.y);
        const moving=new Set(squad.filter(c=>c.intent&&!c.fatigue));
        for(let pass=0;pass<5;pass++)for(const c of [...moving])if(taken(spot(c),c,moving))moving.delete(c);
        for(const c of squad){
            if(moving.has(c)){const p=spot(c);c.pos=new w.Pos(p.x,p.y,c.room.name);}
            delete c.intent;
            // Border crossing (blocked landing: stays on the exit tile).
            if(c.room===w.room&&c.pos.x===49&&!squad.concat(hostiles).some(o=>o.room===target&&o.pos.x===0&&o.pos.y===c.pos.y)){
                c.room=target;c.pos=new w.Pos(0,c.pos.y,'TARGET');
            }
        }
        w.next();
    };
    for(const h of hostiles)h.room=target;
    return Object.assign(w,{target,hostiles,apply});
}
test('staging: the quad forms a 2x2 against the border, then enters two at a time and finishes formed inside',()=>{
    const w=twoRooms();
    const trace=[];
    for(let tick=0;tick<120;tick++){w.q.run(w.squad[0]);if(w.squad[0].memory.guardBreach)break;w.apply();}
    const b=w.squad[0].memory.guardBreach;
    assert.ok(b,'formed and going in by pairs');
    assert.equal(JSON.stringify(b.front.slice().sort()),'["c1","c3"]','the pair nearest the border goes first');
    assert.ok(w.squad.every(c=>c.room===w.room&&c.pos.x>=47),JSON.stringify(w.squad.map(c=>[c.pos.x,c.pos.y])));
    assert.equal(w.q.assembled(w.squad,w.squad[0].pos),true,'a 2x2 against the border');
    assert.ok(w.actions.filter(a=>a[1]==='move'&&a[2]===b.dir).map(a=>a[0]).sort().join()==='c1,c3','only the front pair steps first');
    w.apply();
    for(let tick=0;tick<10&&w.squad.some(c=>c.room!==w.target);tick++){
        w.q.run(w.squad[0]);w.apply();
        trace.push(w.squad.map(c=>c.room.name[0]+c.pos.x));
        const front=w.squad.filter(c=>b.front.includes(c.name)),back=w.squad.filter(c=>!b.front.includes(c.name));
        if(back.some(c=>c.room===w.target))assert.ok(front.every(c=>c.room===w.target&&c.pos.x>=1),'the back pair only follows once the front made room: '+JSON.stringify(trace));
    }
    assert.ok(w.squad.every(c=>c.room===w.target),JSON.stringify(trace));
    assert.equal(w.q.assembled(w.squad,w.squad[0].pos),true,'a 2x2 inside: '+JSON.stringify(w.squad.map(c=>[c.pos.x,c.pos.y])));
    w.q.run(w.squad[0]);
    assert.ok(w.squad.every(c=>!c.memory.guardBreach),'entry finished');
});
test('the front pair shoots hostiles in range while it waits inside for the back pair, and never backs out',()=>{
    const w=twoRooms();
    for(let tick=0;tick<120&&!w.squad[0].memory.guardBreach;tick++){w.q.run(w.squad[0]);w.apply();}
    const b=w.squad[0].memory.guardBreach;
    // A strong enemy just inside: alone, the front pair would lose (defend would retreat).
    w.hostiles.push({name:'e',id:'e',room:w.target,owner:{username:'Harabi'},pos:new w.Pos(3,w.squad[1].pos.y,'TARGET'),
        body:Array.from({length:50},()=>({type:w.g.RANGED_ATTACK,hits:100})),hits:5000,hitsMax:5000});
    w.q.run(w.squad[0]);w.apply();             // the front pair steps in
    w.q.run(w.squad[0]);
    const front=w.squad.filter(c=>b.front.includes(c.name));
    assert.ok(front.every(c=>c.room===w.target));
    assert.ok(w.actions.some(a=>a[0]==='c1'&&(a[1]==='fire'||a[1]==='mass')),'the ranged front member shoots: '+JSON.stringify(w.actions));
    const back=w.actions.filter(a=>b.front.includes(a[0])&&a[1]==='move'&&a[2]!==b.dir);
    assert.equal(back.length,0,'no front member moves back toward the border');
    assert.ok(!w.actions.some(a=>b.front.includes(a[0])&&a[1]==='travel'),'no retreat path');
});
test('a member that slipped in alone before the squad committed comes back out to the others',()=>{
    const w=twoRooms();
    w.squad[0].room=w.target;w.squad[0].pos=new w.Pos(0,20,'TARGET');
    w.q.run(w.squad[1]);
    assert.ok(w.actions.some(a=>a[0]==='c0'&&a[1]==='travel'&&a[2].roomName==='POST'),JSON.stringify(w.actions));
    w.squad[0].memory.guardCommitted=1;w.next();
    w.q.run(w.squad[1]);
    assert.ok(!w.actions.some(a=>a[0]==='c0'&&a[1]==='travel'&&a[2].roomName==='POST'),'a committed squad does not pull back');
});
test('away from the staging room the squad moves single file, never as a 2x2 block',()=>{
    const w=staged();
    w.g.Game.map.findRoute=(from,to)=>[{exit:3,room:'MID'},{exit:3,room:to}];   // POST -> MID -> TARGET: MID stages
    w.q.run(w.squad[0]);
    const moves=w.actions.filter(a=>a[1]==='move');
    assert.ok(!(moves.length===4&&new Set(moves.map(a=>a[2])).size===1),'no formation step');
    const lead=w.actions.find(a=>a[0]==='c0'&&a[1]==='travel');
    assert.ok(lead&&lead[2].roomName==='MID','heading for the staging room');
});
test('a snake leader standing on an exit tile does not wait for stragglers there',()=>{
    const w=world();
    w.squad[0].pos=new w.Pos(49,20);w.squad[1].pos=new w.Pos(45,20);   // straggler 4 behind
    w.q.snake(w.squad,new w.Pos(25,25,'NEXT'),false);
    assert.ok(w.actions.some(a=>a[0]==='c0'&&a[1]==='travel'),'steps on instead of blocking the border');
    const x=world();
    x.squad[0].pos=new x.Pos(30,20);x.squad[1].pos=new x.Pos(26,20);
    x.q.snake(x.squad,new x.Pos(25,25,'NEXT'),false);
    assert.ok(!x.actions.some(a=>a[0]==='c0'&&a[1]==='travel'),'inside the room it waits as before');
});
test('our construction sites for blocking structures are off the formation map (W1N22: a quad around a spawn site never formed)',()=>{
    const w=world();
    const sites=[{structureType:w.g.STRUCTURE_SPAWN,pos:new w.Pos(11,20)},{structureType:w.g.STRUCTURE_ROAD,pos:new w.Pos(15,15)}];
    const find=w.room.find;
    w.room.find=type=>type===w.g.FIND_MY_CONSTRUCTION_SITES?sites:find(type);
    const tiles=w.q.grid(w.room,w.squad,false);
    assert.equal(tiles.get(11,20),255,'spawn site');
    assert.notEqual(tiles.get(15,15),255,'a road site is walkable');
    const footprint=w.q.grid(w.room,w.squad,true);
    assert.equal(footprint.get(10,20),255,'no 2x2 that covers the spawn site');
    const anchor=w.q.nearestAnchor(w.room,w.squad,new w.Pos(10,20),1);
    const cells=w.q.OFFSETS.map(([dx,dy])=>(anchor.x+dx)+','+(anchor.y+dy));
    assert.ok(!cells.includes('11,20'),'formed up beside it: '+cells.join(' '));
});
test('with no hostiles in the room, the quad heals our damaged workers, walking up to them first',()=>{
    const w=world();w.room.controller={pos:new w.Pos(15,20),my:true};
    const worker={name:'helper',pos:new w.Pos(30,20),hits:200,hitsMax:1000,memory:{priority:'helper'}};
    w.g.Game.creeps.helper=worker;
    for(let tick=0;tick<25&&!w.actions.some(a=>a[2]==='helper');tick++){for(const c of w.squad)w.q.run(c);if(!w.actions.some(a=>a[2]==='helper'))w.apply();}
    assert.ok(w.actions.some(a=>a[0]==='c3'&&(a[1]==='heal'||a[1]==='rangedHeal')&&a[2]==='helper'),'the healer treats the worker');
    assert.ok(w.squad.every(c=>c.pos.getRangeTo(worker)<=4));
    // A hostile in the room: back to fighting, the worker waits.
    const x=world();x.g.Game.creeps.helper=Object.assign({},worker,{pos:new x.Pos(12,22)});
    x.hostiles.push({name:'enemy',id:'enemy',owner:{username:'Harabi'},pos:new x.Pos(14,20),body:[{type:x.g.RANGED_ATTACK,hits:100}],hits:100,hitsMax:100});
    x.q.combat(x.squad);
    assert.ok(!x.actions.some(a=>a[2]==='helper'));
});
test('an enemy that hops out over the border is waited for 5 ticks where the quad stands, not chased',()=>{
    const go=(x,y)=>{
        const w=world();w.room.controller={pos:new w.Pos(30,20),my:true};
        w.hostiles.push({name:'enemy',id:'enemy',owner:{username:'Harabi'},pos:new w.Pos(x,y),body:[{type:w.g.RANGED_ATTACK,hits:100}],hits:100,hitsMax:100});
        for(const c of w.squad)w.q.run(c);w.apply();
        w.hostiles.length=0;
        const moved=[];
        for(let tick=0;tick<8;tick++){for(const c of w.squad)w.q.run(c);moved.push(w.actions.some(a=>a[1]==='move'||a[1]==='travel'));w.apply();}
        return {w,moved};
    };
    const {w,moved}=go(48,20);
    assert.equal(JSON.stringify(moved.slice(0,5)),JSON.stringify([false,false,false,false,false]),'holds 5 ticks');
    assert.ok(moved.slice(5).some(Boolean),'then back to its idle routine');
    assert.ok(w.squad.every(c=>c.memory.guardHold===undefined));
    // An enemy gone from mid-room (killed): no hold.
    assert.equal(go(25,25).moved[0],true);
});
test('single file: once together, the member with the shortest path leads and the rest follow nearest first',()=>{
    const w=world();
    // A line with slot 0 at the back: it used to lead and worked its way through the other three.
    w.squad.forEach((c,i)=>{c.pos=new w.Pos(10+i,20);});
    const goal=new w.Pos(30,20);
    w.q.snake(w.squad,goal,false);
    const travel=w.actions.filter(a=>a[1]==='travel'&&a[2]===goal);
    assert.equal(JSON.stringify(travel.map(a=>a[0])),JSON.stringify(['c3']),'the front member leads');
    assert.equal(JSON.stringify(w.squad[0].memory.guardLine.order),JSON.stringify(['c3','c2','c1','c0']));
    w.apply();
    // Kept while the goal stays the same, even as positions shift.
    w.squad[0].pos=new w.Pos(20,20);
    w.q.snake(w.squad,goal,false);
    assert.equal(w.squad[0].memory.guardLine.order[0],'c3');
    w.apply();
    // A new goal behind them: picked again.
    w.squad.forEach((c,i)=>{c.pos=new w.Pos(10+i,20);});
    w.q.snake(w.squad,new w.Pos(2,20),false);
    assert.equal(JSON.stringify(w.squad[0].memory.guardLine.order),JSON.stringify(['c0','c1','c2','c3']));
    // Spread out (not yet together): slot order until they meet.
    const x=world();x.squad[3].pos=new x.Pos(40,40);
    x.q.snake(x.squad,goal,false);
    assert.equal(x.squad[0].memory.guardLine.fixed,undefined);
    assert.equal(x.squad[0].memory.guardLine.order[0],'c0');
});
test('an attacker split into groups is fought one group at a time: the tower\'s target first, else the nearest, and the quad does not hold back',()=>{
    const w=world();
    const enemy=(name,x,y)=>({name,id:name,owner:{username:'Harabi'},pos:new w.Pos(x,y),hits:5000,hitsMax:5000,
        body:Array(25).fill({type:w.g.RANGED_ATTACK,hits:100}).concat(Array(25).fill({type:w.g.MOVE,hits:100}))});
    // Each group: 2 x 25 ranged (500 damage). Our quad: 3 x 1 ranged and a healer, far weaker,
    // so give our members real bodies: 22 ranged + 8 heal each.
    for(const c of w.squad)c.body=Array(22).fill({type:w.g.RANGED_ATTACK,hits:100}).concat(Array(8).fill({type:w.g.HEAL,hits:100}),Array(10).fill({type:w.g.MOVE,hits:100}));
    w.hostiles.push(enemy('s1',30,40),enemy('s2',31,40),enemy('n1',14,5),enemy('n2',15,5));
    const all=w.q.combat(w.squad);
    assert.equal(all.retreat,false,'4 attackers in two far groups: each group is beaten, so no retreat');
    assert.equal(all.focus.name[0],'n','the nearest group (north, the quad is at 10,20)');
    assert.equal(JSON.stringify(w.q.groups(w.hostiles).map(g=>g.map(t=>t.name).join())),JSON.stringify(['s1,s2','n1,n2']));
    // The tower's target decides when it has one.
    w.next();w.g.Memory.towerPickedTarget={POST:'s2'};
    w.g.Game.getObjectById=id=>w.hostiles.find(h=>h.id===id)||null;
    assert.equal(w.q.combat(w.squad).focus.name,'s2');
    // Without it, the group already chased is kept.
    w.next();w.g.Memory.towerPickedTarget={};
    assert.equal(w.q.combat(w.squad).focus.name[0],'s','keeps chasing the south group');
    // The squad advances on it.
    w.next();
    for(const c of w.squad)w.q.run(c);
    assert.ok(w.actions.some(a=>a[1]==='move'),'moves toward the group');
});
test('a quad runs ranged-only attackers down to range 1; with melee among them it stops at range 3',()=>{
    const go=melee=>{
        const w=world();
        for(const c of w.squad)c.body=Array(22).fill({type:w.g.RANGED_ATTACK,hits:100}).concat(Array(8).fill({type:w.g.HEAL,hits:100}),Array(10).fill({type:w.g.MOVE,hits:100}));
        w.hostiles.push({name:'e',id:'e',owner:{username:'Harabi'},pos:new w.Pos(13,22),hits:500,hitsMax:500,
            body:[{type:melee?w.g.ATTACK:w.g.RANGED_ATTACK,hits:100},{type:w.g.MOVE,hits:100}]});
        for(const c of w.squad)w.q.run(c);
        return w.actions.some(a=>a[1]==='move');
    };
    assert.equal(go(false),true,'range 3 from the anchor: keeps closing');
    assert.equal(go(true),false,'melee: holds at its reach');
});
test('vs Harabi\'s T3 quad (snapshot E25N38): a 9 TOUGH / 26 RANGED / 10 MOVE / 5 HEAL quad out-damages his healing, shoots his rangers not his TOUGH healers, holds its ground, and runs down a ranger pair split from its healers',()=>{
    const w=world(),g=w.g;
    g.BOOSTS={ranged_attack:{XKHO2:{rangedAttack:4,rangedMassAttack:4}},heal:{XLHO2:{heal:4,rangedHeal:4}},tough:{XGHO2:{damage:0.3}},move:{XZHO2:{fatigue:4}}};
    g.CLAIM='claim';g.BODYPART_COST={move:50,work:100,carry:50,attack:80,ranged_attack:150,heal:250,claim:600,tough:10};
    const boostOf={tough:'XGHO2',ranged_attack:'XKHO2',heal:'XLHO2',move:'XZHO2'};
    const parts=list=>list.map(type=>({type,hits:100,boost:boostOf[type]}));
    const hunter=[].concat(Array(9).fill(g.TOUGH),Array(26).fill(g.RANGED_ATTACK),Array(10).fill(g.MOVE),Array(5).fill(g.HEAL));
    for(const c of w.squad)c.body=parts(hunter);
    const n=(k,t)=>Array(k).fill(t);
    const healer=(name,x,y)=>({name,id:name,owner:{username:'Harabi'},pos:new w.Pos(x,y),hits:5000,hitsMax:5000,body:parts([].concat(n(8,g.TOUGH),n(10,g.MOVE),n(32,g.HEAL)))});
    const ranger=(name,x,y)=>({name,id:name,owner:{username:'Harabi'},pos:new w.Pos(x,y),hits:5000,hitsMax:5000,body:parts([].concat(n(35,g.RANGED_ATTACK),n(10,g.MOVE),n(5,g.HEAL)))});
    w.hostiles.push(healer('h1',13,20),healer('h2',14,20),ranger('r1',13,21),ranger('r2',14,21));
    const r=w.q.combat(w.squad);
    assert.equal(r.focus.name[0],'r','a ranger: his healers\' T3 TOUGH makes them unkillable');
    assert.equal(r.retreat,false,'he cannot kill one of ours: no retreat');
    // The old member (22 RANGED) cannot out-damage his healing at all.
    const x=world();x.g.BOOSTS=g.BOOSTS;
    for(const c of x.squad)c.body=parts(x.h.load('combat.bodies').quadMember(12900));
    x.hostiles.push(healer('h1',13,20),healer('h2',14,20),ranger('r1',13,21),ranger('r2',14,21));
    const intel=x.h.load('combat.intel');
    assert.equal(intel.killTime(x.hostiles[2],intel.roomIntel(x.room)),Infinity);
    // Border hop: the ranger pair alone in this room (healers next door) is picked over a full quad further off.
    const y=world();y.g.BOOSTS=g.BOOSTS;
    for(const c of y.squad)c.body=parts(hunter);
    y.hostiles.push(ranger('p1',30,20),ranger('p2',30,21),healer('h1',12,35),healer('h2',13,35),ranger('r1',12,36),ranger('r2',13,36));
    assert.equal(y.q.combat(y.squad).focus.name[0],'p');
});
