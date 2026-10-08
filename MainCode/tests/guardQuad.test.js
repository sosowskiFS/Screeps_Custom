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
