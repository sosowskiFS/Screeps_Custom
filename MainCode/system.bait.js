// system.bait — decoy rooms around the shardX targets, to spend the attacker's time, not ours.
//
// Around each shardX target (system.shardX targets, the fortified rooms), every room within RADIUS
// that nobody else owns or reserves gets one cheap creep (creep.xBait): it claims the controller
// (1-source rooms too), then upgrades it. At RCL3 it builds a tower and keeps it supplied, then the
// room's whole planned base, one site at a time (base.builder.decoyNext): an empty decoy stopped
// drawing the attacker. Its spawns make only its own bait creep (keepLocal), one at a time, and it counts
// as nobody's home (isBait checks in system.spawning, remoteMining, roads, badRooms, guardSquads,
// energyFlow), to keep its CPU near nothing. No other creep is sent: no helpers, guards or quads, no
// safe mode (it would take the one-per-shard safe mode from the real targets).
//   - One creep per room at a time from its sponsor, and one from the room's own spawn: if both are
//     there they work side by side. A claimer (CLAIM_BODY, 600 ticks of life) is sent only where the
//     trip fits in its life; once the room is ours, replacements are KEEP_BODY (1,500 ticks).
//   - No creep while the controller's upgrade block (after an attack) outlasts the trip: it could
//     do nothing there.
//   - GCL: a claim only while the account has a free room slot, after the targets not held right
//     now (they need theirs to be reclaimed). Every home shard publishes its room count (rc in its
//     'xs' InterShardMemory entry); shardX adds its own, its claimers on the way, and reports the
//     free slots (bf). A claim refused for GCL stops bait claims for GCL_BACKOFF ticks.
//   - The creep flees armed hostiles (combat.tactics.escape) and waits outside its room while they
//     are there, coming back once they leave: the attacker has to keep coming back for it.
//   - Everywhere else (WIDE): every room any home has scouted on shardX (Memory.xs.tag: the home with
//     the fastest trip, its corner) that a claimer reaches in time is a bait room too, sponsored by
//     that home. These come after the rooms around the targets and bait centres, nearest trips
//     first, so those keep first call on the free room slots.
//   - CPU: shardX has little of it. No new bait claims while its CPU governor sheds anything or its
//     bucket is under BUCKET_MIN; rooms already held keep their creep.
// shardX reports the rooms (bt: [{ r, t, h, e, cl, ub, n, k }]) every 100 ticks; each room's sponsor
// (its home shard) orders the creeps (system.shardX scheduleBait).
//
// Memory.bait (shardX) = { rooms: { room: { t: target, since } }, block: { room: until }, gcl: until }
const expansion = require('system.expansion');

const RADIUS = 3;
const PER_TARGET = 10;           // rooms reported per target (nearest first)
const WIDE_MAX = 80;             // rooms reported from the rest of the scouted map
const BUCKET_MIN = 4000;
const GAP = 200;                 // between orders for one room
const GCL_BACKOFF = 5000;
const TICKS_PER_ROOM = 50;
const CLAIM_MARGIN = 50;         // ticks a claimer needs at the controller
// The ATTACK part (and the WORK part) break a way in when the controller is walled off
// (creep.breach): the attacker left our own old walls up round lost decoys' controllers.
const CLAIM_BODY = [CLAIM, WORK, CARRY, ATTACK, MOVE, MOVE, MOVE, MOVE];
const KEEP_BODY = [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
// From the room's own spawn, as large as the energy in the room pays for: its workers keep the spawns and
// extensions filled up to LOCAL_FULL (creep.xBait), and a spawn regains up to 300 by itself. 5 WORK empties
// a source as fast as it refills, so more would be wasted.
const LOCAL_UNIT = [WORK, CARRY, MOVE, MOVE];
const LOCAL_UNIT_COST = 250;
const LOCAL_MAX_UNITS = 5;
const LOCAL_FULL = LOCAL_UNIT_COST * LOCAL_MAX_UNITS;
const LOCAL_MIN = 300;           // what the room always gets back to
const LOCAL_CHECK = 10;          // ticks between looks at a decoy's spawns
const LOCAL_BUCKET = 1000;

function state() {
    const s = Memory.bait || (Memory.bait = {});
    if (!s.rooms) s.rooms = {};
    if (!s.block) s.block = {};
    return s;
}

function isBait(roomName) {
    const s = Memory.bait;
    return Game.shard.name === 'shardX' && !!(s && s.rooms && s.rooms[roomName]);
}

// A room with a controller: not a highway, not a source-keeper sector or its centre.
function controllerRoom(name) {
    const m = /^[WE](\d+)[NS](\d+)$/.exec(name);
    if (!m) return false;
    const x = Number(m[1]) % 10, y = Number(m[2]) % 10;
    return x !== 0 && y !== 0 && !(x >= 4 && x <= 6 && y >= 4 && y <= 6);
}

function body(claim) {
    return (claim ? CLAIM_BODY : KEEP_BODY).slice();
}

function me() {
    for (const name in Game.creeps) return Game.creeps[name].owner.username;
    return undefined;
}

function baitCreeps() {
    return Object.values(Game.creeps).filter(c => c.memory.priority === 'xBait');
}

// Estimated trip from the target's sponsor to the room: the scouted trip from that home, else the
// target's plus 50 a room.
function trip(t, name) {
    const tag = Memory.xs && Memory.xs.tag && Memory.xs.tag[name];
    if (tag && tag.t !== undefined && tag.h === t.h) return tag.t;
    return (t.t || 300) + expansion.linear(t.r, name) * TICKS_PER_ROOM;
}

// shardX: the bait rooms around the targets and the bait centres (rooms dropped from the targets by
// shardX('focus'): the centre itself counts too), with what the sponsors need to order creeps.
// One room as a bait room for sponsor t ({ r, h, e, t }), with trip k: its entry, or null.
function entryFor(name, t, k, ctx) {
    const s = state();
    if (ctx.taken.has(name) || !controllerRoom(name) || s.block[name]) return null;
    if (require('system.badRooms').isBad(name) || !require('room.status').open(name)) return null;
    const room = Game.rooms[name], c = room && room.controller;
    let cl = 0;
    if (c) {
        if (c.my) {
            if (!s.rooms[name]) return null;      // one of our real rooms (centres are marked by shardX)
            cl = 1;
        } else if (c.owner || (c.reservation && c.reservation.username !== ctx.user)) return null;
    } else if (room) return null;
    else {
        const intel = Memory.expandIntel && Memory.expandIntel[name];
        if (!intel || !intel.n || intel.k || intel.o || (intel.r && intel.r !== ctx.user)) return null;
    }
    if (!cl && k + CLAIM_MARGIN > CREEP_CLAIM_LIFE_TIME) return null;
    const entry = { r: name, t: t.r, h: t.h, e: t.e, cl, k, n: ctx.creeps.filter(cr => cr.memory.destination === name).length };
    if (c && c.upgradeBlocked > 0) entry.ub = c.upgradeBlocked;
    // How far along a held one is (a focus shift picks the furthest, system.shardX shiftFocus).
    // and its sources: only a 2-source room can become the focus.
    if (cl) { entry.lv = c.level; entry.pg = c.progress || 0; entry.ns = room.find(FIND_SOURCES).length; }
    // A held 2-source room: can the base planner lay out a full base there (system.shardX
    // promoteBait makes such rooms full rooms)? Checked once per room, one per report (CPU).
    if (cl && entry.ns >= 2) {
        const rec = s.rooms[name];
        const srcs = room.find(FIND_SOURCES);
        if (rec.pf === undefined && !ctx.planned && c.pos && srcs.every(src => src.pos)) {
            ctx.planned = true;
            const sources = srcs.map(src => [src.pos.x, src.pos.y]);
            const mineral = room.find(FIND_MINERALS)[0];
            const intel = { c: [c.pos.x, c.pos.y], s: sources, m: mineral ? [mineral.pos.x, mineral.pos.y] : undefined };
            rec.pf = expansion.planCheck(name, intel) ? 1 : 0;
        }
        if (rec.pf !== undefined) entry.pf = rec.pf;
    }
    return entry;
}

function report(targets, centers = []) {
    const s = state(), user = me();
    const taken = new Set(targets.map(t => t.r));
    const creeps = baitCreeps();
    const ctx = { taken, user, creeps };
    const out = [];
    for (const name of Object.keys(s.block)) if (Game.time >= s.block[name]) delete s.block[name];
    for (const name of Object.keys(s.rooms)) {
        const room = Game.rooms[name];
        // Owned rooms are always visible: gone from sight means lost.
        if (!(room && room.controller && room.controller.my) && !creeps.some(c => c.memory.destination === name)) delete s.rooms[name];
    }
    for (const t of targets.concat(centers)) {
        const p = expansion.parse(t.r);
        if (!p) continue;
        const list = [];
        for (let dx = -RADIUS; dx <= RADIUS; dx++) {
            for (let dy = -RADIUS; dy <= RADIUS; dy++) {
                const name = expansion.format(p.x + dx, p.y + dy);
                const entry = entryFor(name, t, trip(t, name), ctx);
                if (entry) list.push(Object.assign(entry, { d: expansion.linear(t.r, name) }));
            }
        }
        list.sort((a, b) => b.cl - a.cl || a.d - b.d || a.k - b.k);
        for (const entry of list.slice(0, PER_TARGET)) {
            if (out.some(o => o.r === entry.r)) continue;
            delete entry.d;
            out.push(entry);
        }
    }
    // The rest of the scouted map, while there are targets at all (claim or done mode).
    if (targets.length || centers.length) {
        const tags = (Memory.xs && Memory.xs.tag) || {};
        const wide = [];
        for (const name in tags) {
            const tag = tags[name];
            if (!tag.h || tag.t === undefined || out.some(o => o.r === name)) continue;
            const entry = entryFor(name, { r: name, h: tag.h, e: tag.e }, tag.t, ctx);
            if (entry) wide.push(entry);
        }
        wide.sort((a, b) => b.cl - a.cl || a.k - b.k);
        for (const entry of wide.slice(0, WIDE_MAX)) out.push(entry);
    }
    return out;
}

// shardX: free room slots for bait claims (see the header). homeCounts: rc of each home shard,
// undefined when unknown.
function freeSlots(homeCounts, targets, progress) {
    const s = state();
    if (s.gcl && Game.time < s.gcl) return 0;
    if (!Game.gcl) return 0;
    if (Game.cpu && Game.cpu.bucket < BUCKET_MIN) return 0;
    if (require('runtime.cpuGovernor').shedLevel() > 0) return 0;
    const owned = homeCounts.reduce((a, b) => a + (b || 0), 0) +
        Object.values(Game.rooms).filter(r => r.controller && r.controller.my).length;
    const unheld = targets.filter(t => !(progress[t.r] && progress[t.r].cl)).length;
    const claiming = baitCreeps().filter(c => c.getActiveBodyparts(CLAIM) &&
        !(Game.rooms[c.memory.destination] && Game.rooms[c.memory.destination].controller.my)).length;
    return Math.max(0, Game.gcl.level - owned - unheld - claiming);
}

// Home shard: which bait rooms to order a creep for now. bt: shardX's report; free: its bf; here
// and homes: this shard and its home rooms; inFlight: our bait creeps still on this shard; queued:
// destinations of bait orders waiting to spawn; last: per-room order times (updated); busy: homes
// with an order already waiting (the spawn queue holds one per home: at most one more each).
function due(bt, free, here, homes, inFlight, queued, last, busy = []) {
    const used = new Set(busy);
    let claims = inFlight.filter(c => c.memory.claim).length + queued.filter(q => q.claim).length;
    const out = [];
    for (const b of bt || []) {
        const [shard, home] = String(b.h).split(':');
        if (shard !== here || !homes.includes(home) || used.has(home)) continue;
        if (b.n || inFlight.some(c => c.memory.destination === b.r) || queued.some(q => q.r === b.r)) continue;
        if ((b.ub || 0) > b.k) continue;                  // blocked past its arrival
        if (Game.time - (last['b:' + b.r] || 0) < GAP) continue;
        if (!b.cl) {
            if (claims >= (free || 0)) continue;
            claims++;
        }
        last['b:' + b.r] = Game.time;
        used.add(home);
        out.push({ home, memory: { priority: 'xBait', destination: b.r, baitFor: b.t, homeRoom: home, claim: b.cl ? 0 : 1, xShard: { c: b.e } } });
    }
    return out;
}

// A decoy's spawn keeps one creep of its own going, on the same job. Not while armed hostiles are in the
// room (it would be shot leaving the spawn; the creep flees them anyway). A sponsor's creep does not
// count: they work alongside each other. True when one was ordered.
const localOrdered = Object.create(null);    // room -> tick: a new creep is not in Game.creeps until next tick
function keepLocal(spawn) {
    if (Game.time % LOCAL_CHECK !== 0 || spawn.spawning) return false;
    const room = spawn.room, name = room.name;
    if (localOrdered[name] === Game.time || Game.cpu.bucket < LOCAL_BUCKET || !spawn.isActive()) return false;
    if (baitCreeps().some(c => c.memory.destination === name && c.memory.baitLocal)) return false;
    if (require('combat.tactics').armedThreats(room).length) return false;
    if (room.energyAvailable < LOCAL_MIN) return false;
    const mark = state().rooms[name];
    const memory = { priority: 'xBait', destination: name, baitFor: mark && mark.t, homeRoom: name, claim: 0, baitLocal: 1 };
    if (spawn.spawnCreep(localBody(room.energyAvailable), 'xb' + name + Game.time, { memory }) !== OK) return false;
    localOrdered[name] = Game.time;
    return true;
}

// The body this much energy pays for; what is left over from the last unit adds a CARRY and a MOVE.
function localBody(energy) {
    const units = Math.min(LOCAL_MAX_UNITS, Math.floor(energy / LOCAL_UNIT_COST));
    const parts = [];
    for (let n = 0; n < units; n++) parts.push(...LOCAL_UNIT);
    if (units < LOCAL_MAX_UNITS && energy - units * LOCAL_UNIT_COST >= 100) parts.push(CARRY, MOVE);
    return parts;
}

function noteBlock(roomName, until) {
    state().block[roomName] = until;
}

function noteGcl() {
    state().gcl = Game.time + GCL_BACKOFF;
}

function claimed(roomName, target) {
    state().rooms[roomName] = { t: target, since: Game.time };
}

module.exports = { isBait, keepLocal, localBody, LOCAL_FULL, LOCAL_MIN, LOCAL_CHECK, report, freeSlots, due, body, noteBlock, noteGcl, claimed, controllerRoom, state,
    CLAIM_BODY, KEEP_BODY, RADIUS, GAP, WIDE_MAX, BUCKET_MIN };
