// system.bait — decoy rooms around the shardX targets, to spend the attacker's time, not ours.
//
// Around each shardX target (system.shardX targets, the fortified rooms), every room within RADIUS
// that nobody else owns or reserves gets one cheap creep (creep.xBait): it claims the controller
// (1-source rooms too), then upgrades it. At RCL3 it builds a tower and keeps it supplied; otherwise
// it only upgrades. Nothing else is built there (base.builder), and no other creep is sent: no
// helpers, guards or quads, no safe mode (it would take the one-per-shard safe mode from the real
// targets).
//   - One creep per room at a time. A claimer (CLAIM_BODY, 600 ticks of life) is sent only where the
//     trip fits in its life; once the room is ours, replacements are KEEP_BODY (1,500 ticks).
//   - No creep while the controller's upgrade block (after an attack) outlasts the trip: it could
//     do nothing there.
//   - GCL: a claim only while the account has a free room slot, after the targets not held right
//     now (they need theirs to be reclaimed). Every home shard publishes its room count (rc in its
//     'xs' InterShardMemory entry); shardX adds its own, its claimers on the way, and reports the
//     free slots (bf). A claim refused for GCL stops bait claims for GCL_BACKOFF ticks.
//   - The creep flees armed hostiles (combat.tactics.escape) and waits outside its room while they
//     are there, coming back once they leave: the attacker has to keep coming back for it.
// shardX reports the rooms (bt: [{ r, t, h, e, cl, ub, n, k }]) every 100 ticks; each target's
// sponsor (its home shard) orders the creeps (system.shardX scheduleBait).
//
// Memory.bait (shardX) = { rooms: { room: { t: target, since } }, block: { room: until }, gcl: until }
const expansion = require('system.expansion');

const RADIUS = 3;
const PER_TARGET = 10;           // rooms reported per target (nearest first)
const GAP = 200;                 // between orders for one room
const GCL_BACKOFF = 5000;
const TICKS_PER_ROOM = 50;
const CLAIM_MARGIN = 50;         // ticks a claimer needs at the controller
const CLAIM_BODY = [CLAIM, WORK, CARRY, MOVE, MOVE, MOVE];
const KEEP_BODY = [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];

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
function report(targets, centers = []) {
    const s = state(), user = me();
    const taken = new Set(targets.map(t => t.r));
    const creeps = baitCreeps();
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
                if (taken.has(name) || !controllerRoom(name) || s.block[name]) continue;
                if (require('system.badRooms').isBad(name) || !require('room.status').open(name)) continue;
                const room = Game.rooms[name], c = room && room.controller;
                const k = trip(t, name);
                let cl = 0;
                if (c) {
                    if (c.my) {
                        if (!s.rooms[name]) continue;      // one of our real rooms
                        cl = 1;
                    } else if (c.owner || (c.reservation && c.reservation.username !== user)) continue;
                } else if (room) continue;
                else {
                    const intel = Memory.expandIntel && Memory.expandIntel[name];
                    if (!intel || !intel.n || intel.k || intel.o || (intel.r && intel.r !== user)) continue;
                }
                if (!cl && k + CLAIM_MARGIN > CREEP_CLAIM_LIFE_TIME) continue;
                const entry = { r: name, t: t.r, h: t.h, e: t.e, cl, k, d: expansion.linear(t.r, name),
                    n: creeps.filter(cr => cr.memory.destination === name).length };
                if (c && c.upgradeBlocked > 0) entry.ub = c.upgradeBlocked;
                list.push(entry);
            }
        }
        list.sort((a, b) => b.cl - a.cl || a.d - b.d || a.k - b.k);
        for (const entry of list.slice(0, PER_TARGET)) {
            if (out.some(o => o.r === entry.r)) continue;
            delete entry.d;
            out.push(entry);
        }
    }
    return out;
}

// shardX: free room slots for bait claims (see the header). homeCounts: rc of each home shard,
// undefined when unknown.
function freeSlots(homeCounts, targets, progress) {
    const s = state();
    if (s.gcl && Game.time < s.gcl) return 0;
    if (!Game.gcl) return 0;
    const owned = homeCounts.reduce((a, b) => a + (b || 0), 0) +
        Object.values(Game.rooms).filter(r => r.controller && r.controller.my).length;
    const unheld = targets.filter(t => !(progress[t.r] && progress[t.r].cl)).length;
    const claiming = baitCreeps().filter(c => c.getActiveBodyparts(CLAIM) &&
        !(Game.rooms[c.memory.destination] && Game.rooms[c.memory.destination].controller.my)).length;
    return Math.max(0, Game.gcl.level - owned - unheld - claiming);
}

// Home shard: which bait rooms to order a creep for now. bt: shardX's report; free: its bf; here
// and homes: this shard and its home rooms; inFlight: our bait creeps still on this shard; queued:
// destinations of bait orders waiting to spawn; last: per-room order times (updated).
function due(bt, free, here, homes, inFlight, queued, last) {
    let claims = inFlight.filter(c => c.memory.claim).length + queued.filter(q => q.claim).length;
    const out = [];
    for (const b of bt || []) {
        const [shard, home] = String(b.h).split(':');
        if (shard !== here || !homes.includes(home)) continue;
        if (b.n || inFlight.some(c => c.memory.destination === b.r) || queued.some(q => q.r === b.r)) continue;
        if ((b.ub || 0) > b.k) continue;                  // blocked past its arrival
        if (Game.time - (last['b:' + b.r] || 0) < GAP) continue;
        if (!b.cl) {
            if (claims >= (free || 0)) continue;
            claims++;
        }
        last['b:' + b.r] = Game.time;
        out.push({ home, memory: { priority: 'xBait', destination: b.r, baitFor: b.t, homeRoom: home, claim: b.cl ? 0 : 1, xShard: { c: b.e } } });
    }
    return out;
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

module.exports = { isBait, report, freeSlots, due, body, noteBlock, noteGcl, claimed, controllerRoom, state,
    CLAIM_BODY, KEEP_BODY, RADIUS, GAP };
