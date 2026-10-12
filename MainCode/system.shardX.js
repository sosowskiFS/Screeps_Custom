// system.shardX — scouting and settling shardX from shard2, shard1 and shard3.
//
// Console (shard2):  shardX('scout')  scouting on every home shard (shard1/shard3 follow shard2)
//                    shardX('claim')  stop scouting, pick 3 rooms, claim and support them
//                    shardX('claim', ['E19N28', 'E22N31@E32N33'])  claim these candidates instead
//                                     (ROOM@HOME: sponsor other than the scouted one)
//                    shardX('candidates')  list shardX's reported candidates
//                    shardX('cancel') stop everything;  shardX() status (on any shard)
//                    shardX('reset')  forget the attempt (works while switched off)
//                    shardX('focus', ['W1N9'])  all in: only these targets stay; the others become
//                                     bait centres (system.bait) supplied by their old sponsors
// Focus shifts (shiftFocus): when the one target's controller is attacked (upgrade block) or lost,
// the held bait room furthest along (level, then progress) becomes the target, built fortified by
// the home that runs it; the old target becomes a bait centre. It shifts again on every attack:
// rooms keep being tested, and the attacker can't tell which one is the real one.
//
// Scouting
//   Home shards (HOME_SHARDS): every SCOUT_EVERY ticks each shard sends one 1-MOVE scout,
//     rotating through the nearest highway corner (both coordinates multiples of 10) of each of
//     its homes, from that home. The scout steps into the corner's shardX portal (corners
//     without one are noted and skipped). While shardX reports MAX_SCOUTS scouts alive, no more
//     are sent (shardX has little CPU).
//   Memory is per shard: a creep publishes its memory in its shard's InterShardMemory just before
//     stepping in; shardX gives it that memory on arrival (else infers the role from the body).
//   shardX: scouts explore nearest-first from where they arrived. A 1-MOVE scout moves at full
//     speed on any terrain, like the claimer (CLAIM + 5 MOVE), so its life used when it enters a
//     room is a real measure of the trip from its home's spawn. Every room entered is recorded
//     where the rest of the code looks (Memory.expandIntel, Memory.badRooms, Memory.remoteIntel)
//     and tagged with the fastest trip seen: home (shard:room), arrival room, and ticks to the
//     controller (life used + range to it). Scouts go up to EXPLORE_TICKS out (a ring past the
//     claim limit, so the neighbours of edge rooms are known too), never into rooms claimed by
//     others or source-keeper rooms.
//   Candidates: valid by the auto-expansion rules (system.expansion; the base planner must fit)
//     and controller reachable within CLAIM_TICKS (a claimer lives 600).
// Claiming
//   shard2 picks the 3 best candidates, each from a different home (any home shard). The home's
//   own shard sends a claimer through the same corner, then keeps HELPERS builders there until
//   shardX reports a terminal. From then on shardX's own auto-expansion takes over.
//
// InterShardMemory key 'xs':
//   home shards { t, travellers: {name: {m}}, rc: rooms owned } plus, on shard2, mode and targets [{r,h,e,t}]
//   shardX      { t, cands: [{r,h,e,t,s}], progress: {room: {cl,tm,hp}}, seen, sc, bt: bait rooms, bf: free GCL slots }
// Bait rooms (system.bait, creep.xBait): decoys claimed around the targets while claiming or done.
// Pests (system.nuisance, creep.xNuisance): a CARRY+MOVE creep in each room Harabi reserves (nz).
const expansion = require('system.expansion');
const badRooms = require('system.badRooms');
const remoteMining = require('system.remoteMining');

const X_SHARD = 'shardX';
// On/off switch. While off: no scouting, claiming, helpers or guards, whatever mode shard2 has
// saved, and creeps still bound for the portal are recalled home (creep.recall). On in code;
// Memory.settings.shardX = false switches it off on that shard without a deploy (true switches it
// on when ENABLED is false).
const ENABLED = true;

function enabled() {
    if (!require('runtime.world').multiShard()) return false;   // Seasonal World: one shard, no shardX
    const setting = Memory.settings && Memory.settings.shardX;
    if (setting === false) return false;
    return ENABLED || setting === true;
}
const COORD_SHARD = 'shard2';
const HOME_SHARDS = ['shard2', 'shard1', 'shard3'];
const SCOUT_EVERY = 100;
const MAX_SCOUTS = 15;
const CORNER_SEARCH = 12;
const CLAIM_TICKS = 500;
const EXPLORE_TICKS = 600;
const TICKS_PER_ROOM = 50;
const SCOUT_LIFE = 1500;
const RESEEN = 20000;
const HELPERS = 4;
const FOCUS_HELPERS = 6;           // the sponsor's helpers while focused (shardX('focus'))
const FOCUS_FORTIFY_HELPERS = 4;   // the second home's, while focused and fortified
const CLAIMER_GAP = 300;          // at least this between claimer orders (more: the trip, see scheduleSupport)
const MAX_TARGETS = 3;
const SKIP_FOR = 50000;           // a target someone else claimed first is not picked again for this long
const BLOCK_TTL = 1500;           // a claimer's report of what blocks a target (shardX ticks)
const HELPER_GAP = 150;
const GUARD_GAP = 400;           // between guard orders (one in transit is invisible to shardX)
const TOP_CANDS = 30;
const PLAN_CHECKS = 2;           // base planner runs per 100 ticks (CPU spikes; shardX has little CPU)
const TRAVELLER_TTL = 2000;

const BODIES = {
    xScout: [MOVE],
    claimer: [CLAIM, MOVE, MOVE, MOVE, MOVE, MOVE],
    helper: [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
        WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY],
};

function state() {
    return Memory.xs || (Memory.xs = {});
}

// A claimer that must first wear down another player's reservation: each CLAIM takes a tick off
// it per tick (the reservation also runs down by itself), so as many as the home can afford.
function breakerBody(capacity) {
    const n = Math.max(1, Math.min(25, Math.floor(capacity / (BODYPART_COST[CLAIM] + BODYPART_COST[MOVE]))));
    return Array(n).fill(CLAIM).concat(Array(n).fill(MOVE));
}

// ---------------------------------------------------------------- inter-shard memory

// InterShardMemory through runtime.ism: system.powerCreeps writes its 'pc' key on the same ticks,
// and each used to write back a copy without the other's key ('xs' never reached shard2).
const ism = require('runtime.ism');

function readISM(shard) {
    return ism.get(shard, 'xs') || null;
}

function writeISM(entry) {
    ism.setLocal('xs', entry || undefined);
}

// The mode is set on shard2; the other home shards follow it (read at most every 10 ticks).
const coordCache = { t: -Infinity, value: null };
function coord() {
    if (Game.time - coordCache.t >= 10) {
        coordCache.t = Game.time;
        coordCache.value = readISM(COORD_SHARD);
    }
    return coordCache.value;
}

function mode() {
    if (Game.shard.name === COORD_SHARD) return state().mode;
    const c = coord();
    return c ? c.mode : undefined;
}

// shardX('focus'): the rooms dropped from the targets, now bait centres ([{r,h,e,t}]).
function baitCenters() {
    if (Game.shard.name === COORD_SHARD) return state().baitCenters || [];
    const c = coord();
    return (c && c.baitCenters) || [];
}
function focused() {
    return baitCenters().length > 0;
}

function targets() {
    if (Game.shard.name === COORD_SHARD) return state().targets || [];
    const c = coord();
    return (c && c.targets) || [];
}

// ---------------------------------------------------------------- rooms

const { parse, format, linear } = expansion;

function isCorner(name) {
    const m = /^[WE](\d+)[NS](\d+)$/.exec(name);
    return !!m && Number(m[1]) % 10 === 0 && Number(m[2]) % 10 === 0;
}

function isSourceKeeper(name) {
    const m = /^[WE](\d+)[NS](\d+)$/.exec(name);
    if (!m) return false;
    const x = Number(m[1]) % 10, y = Number(m[2]) % 10;
    return x >= 4 && x <= 6 && y >= 4 && y <= 6 && !(x === 5 && y === 5);
}

function homes() {
    const out = [];
    for (const name in Game.rooms) {
        const room = Game.rooms[name];
        if (room.controller && room.controller.my && room.storage && room.find(FIND_MY_SPAWNS).length &&
            !require('system.retire').retiring(name)) out.push(name);
    }
    return out;
}

// Each home's nearest corner (ties: the first found), one entry per corner, nearest first:
// [{ corner, home, distance }].
function nearCorners(homeList = homes()) {
    const best = {};
    for (const home of homeList) {
        const p = parse(home);
        let mine = null;
        for (let dx = -CORNER_SEARCH; dx <= CORNER_SEARCH; dx++) {
            for (let dy = -CORNER_SEARCH; dy <= CORNER_SEARCH; dy++) {
                const name = format(p.x + dx, p.y + dy);
                if (!isCorner(name)) continue;
                const distance = Math.max(Math.abs(dx), Math.abs(dy));
                if (!mine || distance < mine.distance) mine = { corner: name, home, distance };
            }
        }
        if (mine && (!best[mine.corner] || mine.distance < best[mine.corner].distance)) best[mine.corner] = mine;
    }
    return Object.values(best).sort((a, b) => a.distance - b.distance);
}

// ---------------------------------------------------------------- portal travel (home shards)

// Creeps bound for shardX (memory.xShard = { c: corner }) walk to the corner and step into its
// shardX portal. Returns true when it handled the creep this tick.
function portalStep(creep) {
    const x = creep.memory.xShard;
    if (!x || Game.shard.name === X_SHARD) return false;
    if (!enabled()) {
        require('creep.recall').recall(creep);   // switched off: home, unboost, recycle
        return true;
    }
    // Bound for a room that is no longer a target (shardX('focus') made it a bait centre): home.
    const m = mode();
    if (creep.memory.xTarget && (m === 'claim' || m === 'done') && !targets().some(t => t.r === creep.memory.destination)) {
        require('creep.recall').recall(creep);
        return true;
    }
    if (creep.memory.priority === 'helper' && require('creep.logistics').loadForTrip(creep)) return true;
    if (creep.room.name !== x.c) {
        creep.travelTo(new RoomPosition(25, 25, x.c), { range: 20 });
        return true;
    }
    const s = state();
    const portals = creep.room.find(FIND_STRUCTURES, { filter: s2 => s2.structureType === STRUCTURE_PORTAL && s2.destination &&
        s2.destination.shard === X_SHARD });
    if (!portals.length) {
        (s.noPortal || (s.noPortal = {}))[x.c] = Game.time;
        console.log('[shardX] ' + x.c + ' has no portal to ' + X_SHARD);
        creep.suicide();
        return true;
    }
    (s.portals || (s.portals = {}))[x.c] = portals[0].destination.room;
    // Published before it steps in: shardX gives it this memory on arrival.
    const mem = Object.assign({}, creep.memory);
    delete mem.xShard;
    delete mem._trav;
    mem.hs = Game.shard.name;
    (s.travellers || (s.travellers = {}))[creep.name] = { m: mem, t: Game.time };
    s.dirty = 1;
    const portal = creep.pos.findClosestByRange(portals);
    if (creep.pos.isNearTo(portal)) creep.move(creep.pos.getDirectionTo(portal));
    else creep.travelTo(portal, { range: 1 });
    return true;
}

// ---------------------------------------------------------------- shardX: arrivals and scouting

// Creeps that just came through a portal have no memory here.
function adopt() {
    let remotes;
    for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        if (creep.memory && creep.memory.priority && !creep.memory.guardAwaitManifest) continue;
        if (require('system.guardSquads').adopt(creep)) continue;
        if (!remotes) remotes = HOME_SHARDS.map(readISM).filter(Boolean);
        let entry;
        for (const r of remotes) if (r.travellers && r.travellers[name]) entry = r.travellers[name];
        // Preserve ordinary traveller adoption before the delayed squad-manifest fallback.
        if (!entry && (creep.name.startsWith('gq-') || (!creep.getActiveBodyparts(WORK) &&
            (creep.getActiveBodyparts(HEAL) || creep.getActiveBodyparts(RANGED_ATTACK))))) {
            Memory.creeps[name] = { priority: 'roomGuard', guardAwaitManifest: true };
            continue;
        }
        const coord = remotes.find(r => r.targets) || {};
        const mem = entry ? Object.assign({}, entry.m) : inferMemory(creep, coord);
        if (mem.priority === 'xScout') mem.entry = creep.room.name;
        Memory.creeps[name] = mem;
    }
}

function inferMemory(creep, remote) {
    const list = (remote && remote.targets) || [];
    const local = list.filter(t => t.e === creep.room.name);
    const target = (local.length ? local : list)[0];
    const home = target ? target.h.split(':')[1] : undefined;
    if (creep.getActiveBodyparts(CLAIM) && target) return { priority: 'claimer', destination: target.r, homeRoom: home, xTarget: 1 };
    if (creep.getActiveBodyparts(WORK) && target) return { priority: 'helper', destination: target.r, homeRoom: home, xTarget: 1, previousPriority: 'helper' };
    return { priority: 'xScout' };
}

function xState() {
    const s = state();
    if (!s.seen) s.seen = {};
    if (!s.tag) s.tag = {};
    return s;
}

// Everything a scout learns about a room goes where the rest of the code looks for it. With
// `trip` ({ h, e, t: ticks used so far, pos }), the room is tagged with the fastest trip seen.
function recordRoom(room, trip) {
    expansion.record(room);
    badRooms.record(room);
    remoteMining.recordIntel(room);
    const s = xState();
    s.seen[room.name] = Game.time;
    if (!trip) return;
    const ctrl = room.controller;
    const t = trip.t + (ctrl && trip.pos ? trip.pos.getRangeTo(ctrl) : TICKS_PER_ROOM / 2);
    const old = s.tag[room.name];
    if (!old || old.t === undefined || t < old.t) s.tag[room.name] = { h: trip.h, e: trip.e, t };
}

function lifeUsed(creep) {
    return SCOUT_LIFE - (creep.ticksToLive || SCOUT_LIFE);
}

function explorable(name) {
    // Closed / out-of-borders rooms (shardX is a checkerboard of them) cannot be entered: a scout
    // aiming at one pushed against the border forever.
    if (isSourceKeeper(name) || badRooms.isBad(name) || !require('room.status').open(name)) return false;
    const seen = xState().seen[name];
    return seen === undefined || Game.time - seen > RESEEN;
}

// Next room for a scout: the nearest unexplored room it can still reach within EXPLORE_TICKS of
// its trip, avoiding other scouts' targets.
function nextRoom(creep) {
    const taken = new Set();
    for (const name in Game.creeps) {
        const other = Game.creeps[name];
        if (other !== creep && other.memory.priority === 'xScout' && other.memory.next) taken.add(other.memory.next);
    }
    const budget = Math.floor((EXPLORE_TICKS - lifeUsed(creep)) / TICKS_PER_ROOM);
    if (budget < 1) return undefined;
    let best, bestScore = Infinity;
    const p = parse(creep.room.name);
    for (let dx = -budget; dx <= budget; dx++) {
        for (let dy = -budget; dy <= budget; dy++) {
            if (!dx && !dy) continue;
            const name = format(p.x + dx, p.y + dy);
            if (taken.has(name) || !explorable(name)) continue;
            const score = Math.max(Math.abs(dx), Math.abs(dy)) + Math.random() * 0.5;
            if (score < bestScore) { best = name; bestScore = score; }
        }
    }
    return best;
}

function runScout(creep) {
    if (Game.shard.name !== X_SHARD) {
        creep.suicide();   // portalStep handles the trip; a scout without a corner is a stray
        return;
    }
    if (!creep.memory.entry) creep.memory.entry = creep.room.name;
    if (creep.memory.last !== creep.room.name) {
        const h = creep.memory.homeRoom ? (creep.memory.hs || 'shard2') + ':' + creep.memory.homeRoom : undefined;
        recordRoom(creep.room, h ? { h, e: creep.memory.entry, t: lifeUsed(creep), pos: creep.pos } : undefined);
        creep.memory.last = creep.room.name;
        if (creep.memory.next === creep.room.name) delete creep.memory.next;
    }
    let next = creep.memory.next;
    if (!next || !explorable(next)) next = creep.memory.next = nextRoom(creep);
    if (!next) {
        creep.suicide();
        return;
    }
    const result = creep.travelTo(new RoomPosition(25, 25, next), { range: 20, maxOps: 4000 });
    if (result === ERR_NO_PATH) {
        xState().seen[next] = Game.time;   // unreachable: don't try it again soon
        delete creep.memory.next;
    }
}

function myName() {
    for (const name in Game.creeps) return Game.creeps[name].owner.username;
    for (const name in Game.spawns) return Game.spawns[name].owner.username;
    return undefined;
}

// Called by a claimer at a shardX target: what blocks the claim (null: nothing).
function noteBlock(roomName, info) {
    const s = xState();
    if (!s.block) s.block = {};
    if (info) s.block[roomName] = Object.assign({ t: Game.time }, info);
    else delete s.block[roomName];
}

function myRooms() {
    return Object.keys(Game.rooms).filter(n => Game.rooms[n].controller && Game.rooms[n].controller.my);
}

// Candidates on shardX: auto-expansion rules, base planner, controller within CLAIM_TICKS.
function candidates(checks = PLAN_CHECKS) {
    const s = xState();
    const ctx = { mine: myRooms(), me: undefined, bad: {} };
    const out = [];
    for (const name in s.tag) {
        const tag = s.tag[name];
        if (tag.t === undefined || tag.t > CLAIM_TICKS || !tag.h) continue;
        const entry = Memory.expandIntel && Memory.expandIntel[name];
        if (!entry || !entry.c || expansion.invalidReason(name, entry, ctx)) continue;
        if (entry.p === undefined) {
            if (checks <= 0) continue;
            checks--;
            if (!expansion.planCheck(name, entry)) continue;
        }
        out.push({ r: name, h: tag.h, e: tag.e, t: tag.t, s: expansion.score(name, ctx.mine).score });
    }
    out.sort((a, b) => b.s - a.s || a.t - b.t);
    return out.slice(0, TOP_CANDS);
}

const NPC = new Set(['Invader', 'Source Keeper']);
function runtimeCacheFind(room, type) { return require('runtime.cache').find(room, type); }

// Owner and reservation of every room in sight (any creep of ours there), not only those scouts
// pass through: bait rooms and pest rooms (system.nuisance) go by them. A room with no entry yet
// gets a full record.
function refreshSeen() {
    const table = Memory.expandIntel || (Memory.expandIntel = {});
    for (const name in Game.rooms) {
        const room = Game.rooms[name], c = room.controller;
        if (!c || c.my) continue;
        const entry = table[name];
        if (!entry) { expansion.record(room); continue; }
        entry.t = Game.time;
        if (c.owner) entry.o = c.owner.username; else delete entry.o;
        if (c.reservation) entry.r = c.reservation.username; else delete entry.r;
    }
}

function runX() {
    adopt();
    if (Game.time % 100 !== 0) return;
    refreshSeen();
    const progress = {};
    const bait = require('system.bait');
    for (const t of (readISM(COORD_SHARD) || {}).targets || []) {
        const room = Game.rooms[t.r];
        // A bait room made the target (a focus shift): no longer a decoy, built fortified.
        if (bait.isBait(t.r)) {
            delete bait.state().rooms[t.r];
            (xState().fortify || (xState().fortify = {}))[t.r] = Game.time;
        }
        progress[t.r] = {
            cl: room && room.controller && room.controller.my ? 1 : 0,
            tm: room && room.terminal && room.terminal.my ? 1 : 0,
            hp: Object.keys(Game.creeps).filter(n => Game.creeps[n].memory.priority === 'helper' && Game.creeps[n].memory.destination === t.r).length,
            // Helpers here by home room (fortified rooms get extra ones from a second home).
            hh: Object.values(Game.creeps).filter(c => c.memory.priority === 'helper' && c.memory.destination === t.r)
                .reduce((o, c) => { const h = c.memory.homeRoom; if (h) o[h] = (o[h] || 0) + 1; return o; }, {}),
            ft: room && fortified(room) ? 1 : 0,
            cx: Object.keys(Game.creeps).filter(n => Game.creeps[n].memory.priority === 'claimer' && Game.creeps[n].memory.destination === t.r).length,
        };
        // What stands in the claim's way: another owner (shard2 picks another room) or another
        // player's reservation (the next claimer comes with many CLAIM parts). Seen live, or as
        // reported by our last claimer there.
        const c = room && room.controller, block = (xState().block || {})[t.r];
        if (c && !c.my) {
            if (c.owner) progress[t.r].ow = c.owner.username;
            else if (c.reservation && c.reservation.username !== myName()) progress[t.r].rs = { u: c.reservation.username, e: c.reservation.ticksToEnd };
        } else if (!c && block && Game.time - block.t < BLOCK_TTL) {
            if (block.ow) progress[t.r].ow = block.ow;
            if (block.rs) progress[t.r].rs = { u: block.rs, e: Math.max(0, block.e - (Game.time - block.t)) };
            if (block.err !== undefined) progress[t.r].er = block.err;
        }
        // Guards here: the longest remaining life, and the latest measured trip (spawn to arrival).
        for (const n in Game.creeps) {
            const m = Game.creeps[n].memory;
            if (m.priority !== 'roomGuard' || m.destination !== t.r) continue;
            progress[t.r].gd = Math.max(progress[t.r].gd || 0, Game.creeps[n].ticksToLive || 0);
            if (m.trip !== undefined) progress[t.r].gt = m.trip;
            if (Game.creeps[n].room.name === t.r) progress[t.r].gq = (progress[t.r].gq || 0) + 1;   // guards on post
        }
        // Lost: ours before, not now (declaimed). The reclaim (shard2, scheduleSupport) waits for
        // the room to be clear of armed players (or held by our guards) and for the controller's
        // attack block to run out.
        const held = xState().held || (xState().held = {});
        if (progress[t.r].cl) held[t.r] = Game.time;
        else if (held[t.r]) progress[t.r].lost = 1;
        // Each loss counts: once reclaimed, the room is built fortified (fortified()).
        const lostMark = xState().lostMark || (xState().lostMark = {});
        if (progress[t.r].lost && !lostMark[t.r]) {
            lostMark[t.r] = Game.time;
            const losses = xState().losses || (xState().losses = {});
            losses[t.r] = (losses[t.r] || 0) + 1;
        } else if (progress[t.r].cl && lostMark[t.r]) {
            delete lostMark[t.r];
        }
        if (room) {
            progress[t.r].hz = runtimeCacheFind(room, FIND_HOSTILE_CREEPS).filter(h => !NPC.has(h.owner.username) &&
                !(Memory.whiteList || []).includes(h.owner.username) && h.body.some(p => p.type === ATTACK || p.type === RANGED_ATTACK)).length;
            if (c && c.upgradeBlocked > 0) progress[t.r].ub = c.upgradeBlocked;
        }
    }
    const scouts = Object.keys(Game.creeps).filter(n => Game.creeps[n].memory.priority === 'xScout').length;
    const coordEntry = readISM(COORD_SHARD) || {};
    const list = coordEntry.mode === 'claim' || coordEntry.mode === 'done' ? coordEntry.targets || [] : [];
    const centers = list.length ? coordEntry.baitCenters || [] : [];
    for (const c of centers) {
        const r = Game.rooms[c.r];
        if (r && r.controller && r.controller.my && !bait.isBait(c.r)) bait.claimed(c.r, c.r);
    }
    const bt = bait.report(list, centers);
    const bf = bait.freeSlots(HOME_SHARDS.map(sh => (readISM(sh) || {}).rc), list, progress);
    const nz = require('system.nuisance').report();
    writeISM({ t: Date.now(), cands: candidates(), progress, seen: Object.keys(xState().seen).length, sc: scouts, bt, bf, nz });
}

// ---------------------------------------------------------------- home shards: scouts, picks, support

function queue(home, order) {
    const s = state();
    if (!s.queue) s.queue = {};
    if (!s.queue[home]) s.queue[home] = order;
}

// One scout per SCOUT_EVERY ticks, rotating through the homes' nearest corners.
function scheduleScout(x) {
    if (x && x.sc >= MAX_SCOUTS) return null;
    const s = state();
    const corners = nearCorners().filter(c => !(s.noPortal && s.noPortal[c.corner]));
    if (!corners.length) return null;
    const next = corners[(s.ri || 0) % corners.length];
    s.ri = ((s.ri || 0) + 1) % corners.length;
    queue(next.home, { kind: 'xScout', memory: { priority: 'xScout', homeRoom: next.home, xShard: { c: next.corner } } });
    return next;
}

// Pick targets: best candidates first, each from a different home, spaced like auto-expansion
// (never within 2 rooms of another pick: two neighbouring candidates are never both taken).
// existing: targets already held; skip: rooms recently lost to another player.
function pick(cands, existing = [], skip = {}) {
    const picks = [];
    const all = existing.slice();
    const used = new Set(existing.map(p => p.h));
    for (const cand of cands) {
        if (all.length >= MAX_TARGETS) break;
        if (!cand.h || used.has(cand.h) || cand.t > CLAIM_TICKS) continue;
        // Lost to another player recently: neither that room nor its neighbours (the candidate
        // list may predate the claim).
        if (Object.keys(skip).some(r => Game.time - skip[r] < SKIP_FOR && linear(r, cand.r) <= 1)) continue;
        if (all.some(p => p.r === cand.r || linear(p.r, cand.r) <= 2)) continue;
        used.add(cand.h);
        const p = { r: cand.r, h: cand.h, e: cand.e, t: cand.t };
        picks.push(p);
        all.push(p);
    }
    return picks;
}

// Claimer, then helpers, for the targets whose home is on this shard.
// Fortified rooms (fortified()): the target's second supporting room (the helper home that also
// builds its second guard quad, system.guardSquads.helperHome) keeps FORTIFY_HELPERS more helpers
// there until the second tower stands, on top of the sponsor's HELPERS: the room cannot spawn its
// own creeps meanwhile and its climb to RCL5 is all helper work.
const FORTIFY_HELPERS = 2;
function secondHome(t) {
    const squads = require('system.guardSquads');
    const quad = squads.state().targets['shardX:' + t.r];
    if (quad && quad.helperAt !== undefined) return quad.helper || null;
    const s = state();
    const cache = (s.helperFor || (s.helperFor = {}))[t.r] ||
        (s.helperFor[t.r] = { home: t.h.split(':')[1], corner: t.e, room: t.r });
    return squads.helperHome(cache);
}
function scheduleFortifyHelpers(list, progress) {
    const s = state(), here = Game.shard.name;
    if (!s.last) s.last = {};
    for (const t of list) {
        // A target taken over from the bait rooms (shiftFocus) is ours before shardX reports it.
        const p = progress[t.r] || (t.held ? { cl: 1, ft: 1 } : {});
        if (!p.ft || !p.cl || t.h.split(':')[0] !== here) continue;
        const home = secondHome(t);
        if (!home || !homes().includes(home)) continue;
        const inFlight = Object.values(Game.creeps).filter(c => c.memory.priority === 'helper' && c.memory.destination === t.r &&
            c.memory.homeRoom === home && c.memory.xShard).length;
        if (((p.hh || {})[home] || 0) + inFlight >= (focused() ? FOCUS_FORTIFY_HELPERS : FORTIFY_HELPERS)) continue;
        if (Game.time - (s.last[t.r + ':fh'] || 0) <= HELPER_GAP) continue;
        s.last[t.r + ':fh'] = Game.time;
        queue(home, { kind: 'helper', memory: { priority: 'helper', previousPriority: 'helper', destination: t.r, homeRoom: home,
            xTarget: 1, xShard: { c: t.e } } });
    }
}

function scheduleSupport(list, progress) {
    const s = state();
    if (!s.last) s.last = {};
    const here = Game.shard.name;
    for (const t of list) {
        const [shard, home] = t.h.split(':');
        // A target taken over from the bait rooms (shiftFocus) is ours before shardX reports it.
        const p = progress[t.r] || (t.held ? { cl: 1, ft: 1 } : {});
        if (shard !== here || p.tm || !homes().includes(home)) continue;
        const inFlight = role => Object.keys(Game.creeps).filter(n => {
            const m = Game.creeps[n].memory;
            return m.priority === role && m.destination === t.r && m.xShard;
        }).length;
        const base = { destination: t.r, homeRoom: home, xTarget: 1, xShard: { c: t.e } };
        // A guard once the room is ours, re-ordered before the last one dies. One still on its way
        // here is not yet counted on shardX: GUARD_GAP keeps it from being ordered twice.
        if (p.cl && !require('system.guardSquads').escalated(X_SHARD, t.r)) {
            const guard = require('creep.roomGuard');
            const lead = guard.leadTime(guard.body(Game.rooms[home].energyCapacityAvailable).length, p.gt, t.t !== undefined ? Math.ceil(t.t / 50) : 10);
            const ttls = p.gd ? [p.gd] : [];
            if (inFlight('roomGuard')) ttls.push(Infinity);
            if (!guard.covered(ttls, lead) && Game.time - (s.last[t.r + ':g'] || 0) > GUARD_GAP) {
                s.last[t.r + ':g'] = Game.time;
                queue(home, { kind: 'roomGuard', memory: Object.assign({ priority: 'roomGuard' }, base) });
                continue;
            }
        }
        // Reclaiming a room that was ours (declaimed by an attacker): the guard quads go first
        // (system.guardSquads keeps the room a target); claimer and helpers wait while armed
        // players are there and no guard of ours is, and while the controller's attack block would
        // outlast the claimer's trip. They would only be fed to the attackers.
        const reclaimWait = p.lost && !p.cl && ((p.hz > 0 && !p.gq) || (p.ub || 0) > (t.t || 300));
        if (!p.cl && !reclaimWait) {
            // Claimers until one succeeds: a new one once none is on its way (here or on shardX)
            // and the last one has had time to get there. A reservation by another player gets a
            // claimer with many CLAIM parts to wear it down first.
            const gap = Math.max(CLAIMER_GAP, (t.t || 300) + 150);
            if (!inFlight('claimer') && !p.cx && Game.time - (s.last[t.r + ':c'] || 0) > gap) {
                s.last[t.r + ':c'] = Game.time;
                const memory = Object.assign({ priority: 'claimer' }, base);
                if (p.rs) memory.breaker = 1;
                queue(home, { kind: 'claimer', memory });
                continue;
            }
        }
        // Helpers from the start, alongside the claimer: they arrive loaded and get to work the
        // moment the room is ours, instead of setting out only after the claim. (Not into a room
        // being reclaimed until it is safe, as for the claimer.)
        // The sponsor's own helpers only (a fortified room's second home adds its own on top).
        const own = (p.hh ? (p.hh[home] || 0) : (p.hp || 0)) + Object.values(Game.creeps).filter(c => c.memory.priority === 'helper' &&
            c.memory.destination === t.r && c.memory.xShard && (!c.memory.homeRoom || c.memory.homeRoom === home)).length;
        if (!reclaimWait && own < (focused() ? FOCUS_HELPERS : HELPERS) && Game.time - (s.last[t.r + ':h'] || 0) > HELPER_GAP) {
            s.last[t.r + ':h'] = Game.time;
            queue(home, { kind: 'helper', memory: Object.assign({ priority: 'helper', previousPriority: 'helper' }, base) });
        }
    }
}

// Bait rooms (system.bait): a creep for each that has none, after the targets' own orders.
function scheduleBait(x) {
    const s = state();
    if (!s.last) s.last = {};
    const inFlight = Object.values(Game.creeps).filter(c => c.memory.priority === 'xBait' && c.memory.xShard);
    const queued = Object.values(s.queue || {}).filter(o => o.kind === 'xBait').map(o => ({ r: o.memory.destination, claim: o.memory.claim }));
    const busy = Object.keys(s.queue || {});
    for (const o of require('system.bait').due(x.bt, x.bf, Game.shard.name, homes(), inFlight, queued, s.last, busy)) {
        queue(o.home, { kind: 'xBait', memory: o.memory });
    }
}

// Coordinator: the one target attacked at its controller (upgrade block) or lost: the held 2-source
// bait room furthest along (level, then progress) that is not blocked itself becomes the target, sponsored
// by the home that runs it; the old target becomes a bait centre. Its quads move along (followed
// over the portal by their manifests) when the new sponsor is on this shard. Returns the shift.
function shiftFocus(x) {
    const s = state();
    const list = s.targets || [];
    if (list.length !== 1) return null;
    const t = list[0], p = (x.progress || {})[t.r];
    if (!p || !(p.ub > 0 || p.lost)) return null;
    // Only 2-source rooms: a 1-source room can't carry a fortified build-up (bait rooms include them).
    const cands = (x.bt || []).filter(b => b.cl && b.ns >= 2 && !(b.ub > 0) && b.r !== t.r)
        .sort((a, b) => (b.lv || 0) - (a.lv || 0) || (b.pg || 0) - (a.pg || 0) || a.k - b.k);
    if (!cands.length) {
        if (Game.time - (s.noShift || 0) >= 1000) {
            s.noShift = Game.time;
            console.log('[shardX] ' + t.r + ' is under attack, but no held bait room to shift the focus to');
        }
        return null;
    }
    const n = cands[0];
    const next = { r: n.r, h: n.h, e: n.e, t: n.k, held: 1 };
    s.targets = [next];
    s.baitCenters = (s.baitCenters || []).filter(c => c.r !== n.r && c.r !== t.r).concat([t]);
    s.manual = 1;
    s.mode = 'claim';
    s.queue = {};
    s.dirty = 1;
    const shift = { t: Game.time, from: t.r, to: n.r, h: n.h, lv: n.lv };
    s.shifts = (s.shifts || []).concat([shift]).slice(-10);
    const [shard, home] = n.h.split(':');
    let moved = 0;
    if (shard === Game.shard.name) moved = require('system.guardSquads').retarget(X_SHARD, [t.r], n.r, home, n.e, n.k, true);
    const text = '[shardX] ' + t.r + ' attacked (' + (p.lost ? 'lost' : 'upgrade blocked ' + p.ub) + '): focus shifts to ' + n.r +
        ' (RCL' + (n.lv || '?') + ', from ' + n.h + '); ' + t.r + ' is a decoy now' + (moved ? '; ' + moved + ' quad member(s) moved here' : '');
    console.log(text);
    Game.notify(text);
    return shift;
}

// Pests (system.nuisance): one per Harabi-reserved room, from the home that scouted it.
function scheduleNuisance(x) {
    const s = state();
    if (!s.last) s.last = {};
    const inFlight = Object.values(Game.creeps).filter(c => c.memory.priority === 'xNuisance' && c.memory.xShard);
    const queued = Object.values(s.queue || {}).filter(o => o.kind === 'xNuisance').map(o => o.memory.destination);
    const busy = Object.keys(s.queue || {});
    for (const o of require('system.nuisance').due(x.nz, Game.shard.name, homes(), inFlight, queued, s.last, busy)) {
        queue(o.home, { kind: 'xNuisance', memory: o.memory });
    }
}

function runHome() {
    const s = state();
    const here = Game.shard.name;
    for (const name in s.travellers || {}) {
        if (Game.time - s.travellers[name].t > TRAVELLER_TTL) { delete s.travellers[name]; s.dirty = 1; }
    }
    const m = mode();
    if (m === 'scout' && Game.time % SCOUT_EVERY === 0) scheduleScout(readISM(X_SHARD));
    // All rooms had their terminal ('done'), but one has since been lost: back to claiming, which
    // reclaims it (quads first, then claimer and helpers once it is safe).
    if (m === 'done' && here === COORD_SHARD && Game.time % 25 === 0) {
        const prog = (readISM(X_SHARD) || {}).progress || {};
        const lost = (s.targets || []).filter(t => prog[t.r] && prog[t.r].lost);
        if (lost.length) {
            s.mode = 'claim';
            s.dirty = 1;
            const text = '[shardX] ' + lost.map(t => t.r).join(', ') + ' lost (declaimed); reclaiming';
            console.log(text);
            Game.notify(text);
        }
    }
    if ((m === 'claim' || m === 'done') && here === COORD_SHARD && Game.time % 25 === 0) shiftFocus(readISM(X_SHARD) || {});
    if (mode() === 'claim' && Game.time % 25 === 0) {
        const x = readISM(X_SHARD) || {};
        if (here === COORD_SHARD) {
            // A target someone else claimed first is dropped (and not picked again for a while);
            // free places are filled with the next best candidates.
            const prog = x.progress || {};
            const keep = (s.targets || []).filter(t => !(prog[t.r] && prog[t.r].ow));
            for (const t of s.targets || []) {
                if (keep.includes(t)) continue;
                (s.skip || (s.skip = {}))[t.r] = Game.time;
                console.log('[shardX] ' + t.r + ' was claimed by ' + prog[t.r].ow + ' first; picking another room');
            }
            // Hand-picked targets (shardX('claim', [...])) are not topped up with automatic picks.
            const add = !s.manual && keep.length < MAX_TARGETS ? pick(x.cands || [], keep, s.skip) : [];
            if (add.length) console.log('[shardX] claiming ' + add.map(t => t.r + ' (from ' + t.h + ')').join(', '));
            else if (s.manual && keep.length < (s.targets || []).length) console.log('[shardX] hand-picked targets left: ' +
                (keep.map(t => t.r).join(', ') || 'none') + '; pick more with shardX("claim", [...])');
            else if (!s.manual && !keep.length) console.log('[shardX] no usable candidates yet (' + (x.cands || []).length + ' reported by ' + X_SHARD + '); retrying');
            if (add.length || keep.length !== (s.targets || []).length) {
                s.targets = keep.concat(add);
                s.dirty = 1;
            }
        }
        const list = targets();
        if (here === COORD_SHARD) {
            const prog = x.progress || {};
            s.lostSeen = s.lostSeen || {};
            for (const t of list) {
                const p = prog[t.r] || {};
                if (p.lost && !p.cl && !s.lostSeen[t.r]) {
                    s.lostSeen[t.r] = Game.time;
                    const text = '[shardX] ' + t.r + ' lost (declaimed); reclaiming once it is clear';
                    console.log(text);
                    Game.notify(text);
                } else if (p.cl && s.lostSeen[t.r]) {
                    console.log('[shardX] ' + t.r + ' reclaimed');
                    delete s.lostSeen[t.r];
                }
            }
        }
        scheduleSupport(list, x.progress || {});
        scheduleFortifyHelpers(list, x.progress || {});
        scheduleBait(x);
        scheduleNuisance(x);
        if (here === COORD_SHARD && list.length && list.every(t => (x.progress || {})[t.r] && x.progress[t.r].tm)) {
            s.mode = 'done';
            s.dirty = 1;
            console.log('[shardX] all ' + list.length + ' rooms have a terminal; shardX develops itself from here');
        }
    }
    if (m === 'done' && Game.time % 25 === 0) {
        scheduleBait(readISM(X_SHARD) || {});
        scheduleNuisance(readISM(X_SHARD) || {});
    }
    if (m === undefined && s.queue && Object.keys(s.queue).length) s.queue = {};
    if (s.dirty || Game.time % 50 === 0) {
        const entry = { t: Date.now(), travellers: mapTravellers(s.travellers), rc: myRooms().length };
        if (here === COORD_SHARD) {
            entry.mode = s.mode;
            entry.targets = s.targets || [];
            if (s.baitCenters && s.baitCenters.length) entry.baitCenters = s.baitCenters;
        }
        writeISM(here === COORD_SHARD && !s.mode && !Object.keys(entry.travellers).length ? null : entry);
        delete s.dirty;
    }
}

function mapTravellers(travellers) {
    const out = {};
    for (const name in travellers || {}) out[name] = { m: travellers[name].m };
    return out;
}

// Spawning hook (system.spawning): { body, memory } for this home, or null.
function spawnOrder(roomName) {
    if (!enabled()) return null;
    const s = Memory.xs;
    const order = s && s.queue && s.queue[roomName];
    if (!order) return null;
    if (order.kind === 'roomGuard' && require('system.guardSquads').escalated(X_SHARD, order.memory.destination)) {
        delete s.queue[roomName];
        return null;
    }
    const capacity = Game.rooms[roomName].energyCapacityAvailable;
    const body = order.kind === 'roomGuard' ? require('creep.roomGuard').body(capacity)
        : order.kind === 'claimer' && order.memory.breaker ? breakerBody(capacity)
        : order.kind === 'xBait' ? require('system.bait').body(order.memory.claim)
        : order.kind === 'xNuisance' ? require('system.nuisance').body() : BODIES[order.kind];
    return { body, memory: order.memory };
}

function spawned(roomName) {
    if (Memory.xs && Memory.xs.queue) delete Memory.xs.queue[roomName];
}

function run() {
    if (!enabled()) {
        if (Memory.xs && Memory.xs.queue && Object.keys(Memory.xs.queue).length) Memory.xs.queue = {};
        return;
    }
    if (Game.shard.name === X_SHARD) runX();
    else if (HOME_SHARDS.includes(Game.shard.name)) runHome();
}

// ---------------------------------------------------------------- console

// Full reset (works while switched off). On shard2: forget the claim attempt (mode, targets,
// orders, travellers and the quad targets for shardX rooms; quad members still on shard2 go home,
// unboost and recycle) and clear what shard2 publishes to the other shards. On shardX: drop its
// orders and attacked-room latches. Map knowledge (portals, rooms seen by scouts) is kept.
function reset() {
    const s = state();
    for (const k of ['mode', 'targets', 'travellers', 'sent', 'last', 'ri', 'dirty', 'skip', 'block', 'manual', 'held', 'lostSeen', 'baitCenters', 'shifts', 'noShift']) delete s[k];
    s.queue = {};
    const recalled = require('system.guardSquads').forget(X_SHARD);
    writeISM(null);
    return 'shardX reset on ' + Game.shard.name + ': mode off, no targets or orders' +
        (recalled ? ', ' + recalled + ' quad member(s) recalled' : '') + '; scouted map data kept' +
        (Game.shard.name === COORD_SHARD ? '. Run shardX("reset") on shardX too to clear its leftovers.' : '');
}

// Hand-picked claim targets: ['E19N28', 'E22N31@E32N33', 'W1N22@shard3:E29N43']. Each room must be
// one of the candidates shardX reports. Its sponsor is the candidate's (the home with the fastest
// scouted trip) unless named after '@': another home on this shard (it goes through its own
// nearest corner; the trip is estimated) or the scouted one on another shard. Sponsors must differ.
// Returns { targets } or { error }.
function manualTargets(picks, cands) {
    const out = [];
    for (const spec of picks) {
        const [room, sponsor] = String(spec).split('@');
        const cand = cands.find(c => c.r === room);
        if (!cand) return { error: room + ' is not one of the ' + cands.length + ' candidates shardX reports (shardX("candidates") lists them)' };
        let t = { r: room, h: cand.h, e: cand.e, t: cand.t };
        if (sponsor) {
            const h = sponsor.includes(':') ? sponsor : Game.shard.name + ':' + sponsor;
            if (h !== cand.h) {
                const [shard, home] = h.split(':');
                if (shard !== Game.shard.name) return { error: room + ': a sponsor on ' + shard + ' can only be the scouted one (' + cand.h + ')' };
                if (!homes().includes(home)) return { error: room + ': ' + home + ' is not a home room here (needs a storage and a spawn)' };
                const s = state();
                const corner = nearCorners([home]).find(c => !(s.noPortal && s.noPortal[c.corner]));
                if (!corner) return { error: room + ': no usable corner portal near ' + home };
                const trip = (linear(home, corner.corner) + linear(corner.corner, room)) * TICKS_PER_ROOM;
                if (trip > CLAIM_TICKS) return { error: room + ' from ' + home + ': about ' + trip + ' ticks, over the ' + CLAIM_TICKS + '-tick claim limit' };
                t = { r: room, h, e: corner.corner, t: trip };
            }
        }
        if (out.some(o => o.r === t.r)) return { error: room + ' is listed twice' };
        const clash = out.find(o => o.h === t.h);
        if (clash) return { error: clash.r + ' and ' + room + ' both have sponsor ' + t.h + '; give one another with ROOM@HOME' };
        out.push(t);
    }
    return { targets: out };
}

// A shardX room claimed again after being lost (or marked by hand) is built fortified until its
// second tower stands (RCL5): towers only, ramparts over them (and over a spawn it already has),
// and walls on every free tile around the controller (base.builder). Everything else it would
// build (spawn, extensions, roads...) is what the attacker's dismantlers tore down, and its
// claimers went for the controller: shardX E22N32, W1N22 and W1N9 were overrun repeatedly by
// Harabi's claimers and 25-WORK dismantlers. The sponsor's helpers and guards carry the room.
const FORTIFY_UNTIL_TOWERS = 2;
function fortified(room) {
    if (!room || Game.shard.name !== X_SHARD || !room.controller || !room.controller.my) return false;
    const s = Memory.xs || {};
    if (!((s.losses && s.losses[room.name] > 0) || (s.fortify && s.fortify[room.name]))) return false;
    const towers = require('runtime.cache').find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } }).length;
    return towers < FORTIFY_UNTIL_TOWERS;
}

function command(cmd, picks) {
    if (cmd === 'reset') return reset();
    if (cmd === 'fortify' || cmd === 'unfortify') {
        // On shardX: shardX('fortify', ['W1N22']) builds those rooms fortified (as after a loss).
        if (Game.shard.name !== X_SHARD) return 'run this on ' + X_SHARD;
        const list = Array.isArray(picks) ? picks : picks ? [picks] : [];
        if (!list.length) return 'fortified: ' + (Object.keys(xState().fortify || {}).concat(Object.keys(xState().losses || {}))
            .filter((r, i, a) => a.indexOf(r) === i).join(', ') || 'none');
        const marks = xState().fortify || (xState().fortify = {});
        for (const r of list) {
            if (cmd === 'fortify') marks[r] = Game.time;
            else { delete marks[r]; if (xState().losses) delete xState().losses[r]; }
        }
        return cmd + ': ' + list.join(', ');
    }
    if (!enabled()) return 'shardX is switched off (Memory.settings.shardX = false, or ENABLED = false in system.shardX)';
    const s = state();
    if (cmd === 'candidates') {
        // On a home shard: shardX's reported candidates, to review before hand-picking.
        const cands = (readISM(X_SHARD) || {}).cands || [];
        const lines = [cands.length + ' candidates reported by ' + X_SHARD + ' (room, score, ticks, sponsor, corner):'];
        for (const c of cands) lines.push('  ' + c.r + '  score ' + c.s + '  ' + c.t + ' ticks  ' + c.h + '  via ' + c.e);
        console.log(lines.join('\n'));
        return cands.length + ' candidates';
    }
    if (cmd === 'focus') {
        // All in on these targets: the others become bait centres (their own room and the rooms
        // within 3 of it keep a bait creep each, from their old sponsor). Their quads still on this
        // shard go to the first focused room; their claimers and helpers not yet over the portal
        // go home (portalStep).
        if (Game.shard.name !== COORD_SHARD) return 'run this on ' + COORD_SHARD + ' (the other shards follow it)';
        const keep = Array.isArray(picks) ? picks : picks ? [picks] : [];
        const now = s.targets || [];
        const kept = now.filter(t => keep.includes(t.r));
        if (!kept.length) return 'name at least one of the current targets: ' + (now.map(t => t.r).join(', ') || 'none');
        const dropped = now.filter(t => !keep.includes(t.r));
        const centers = (s.baitCenters || []).filter(c => !keep.includes(c.r));
        for (const t of dropped) if (!centers.some(c => c.r === t.r)) centers.push(t);
        s.targets = kept;
        s.baitCenters = centers;
        s.manual = 1;
        if (s.mode !== 'claim' && s.mode !== 'done') s.mode = 'claim';
        s.queue = {};
        s.dirty = 1;
        const main = kept[0];
        const moved = require('system.guardSquads').retarget(X_SHARD, dropped.map(t => t.r), main.r, main.h.split(':')[1], main.e, main.t);
        return 'focused on ' + kept.map(t => t.r).join(', ') + '; bait centres: ' + (centers.map(c => c.r + ' (from ' + c.h + ')').join(', ') || 'none') +
            '; ' + moved + ' quad member(s) on this shard sent to ' + main.r + ' instead';
    }
    if (cmd === 'claim' && picks !== undefined) {
        if (Game.shard.name !== COORD_SHARD) return 'run this on ' + COORD_SHARD + ' (the other shards follow it)';
        const list = Array.isArray(picks) ? picks : [picks];
        if (!list.length) return 'name at least one room: shardX("claim", ["E19N28", "E22N31@E32N33"])';
        const r = manualTargets(list, (readISM(X_SHARD) || {}).cands || []);
        if (r.error) return r.error;
        s.mode = 'claim';
        s.targets = r.targets;
        s.manual = 1;
        s.queue = {};
        s.dirty = 1;
        return 'claiming ' + r.targets.map(t => t.r + ' (from ' + t.h + ' via ' + t.e + ', ~' + t.t + ' ticks)').join(', ') +
            (r.targets.some((t, i) => r.targets.some((o, j) => j > i && linear(o.r, t.r) <= 2)) ? '; note: some are within 2 rooms of each other' : '');
    }
    if (cmd === 'scout' || cmd === 'claim' || cmd === 'cancel') {
        if (Game.shard.name !== COORD_SHARD) return 'run this on ' + COORD_SHARD + ' (the other shards follow it)';
        if (cmd === 'claim') delete s.manual;
        s.mode = cmd === 'cancel' ? undefined : cmd;
        s.queue = {};
        s.dirty = 1;
        if (cmd === 'cancel') return 'shardX scouting/claiming stopped on all shards';
        return cmd === 'scout' ? 'scouting on ' + HOME_SHARDS.join(', ') + ': one scout per shard every ' + SCOUT_EVERY + ' ticks'
            : 'scouting stopped; picking 3 rooms from ' + X_SHARD + '\'s candidates within 25 ticks';
    }
    const lines = [];
    if (Game.shard.name === X_SHARD) {
        lines.push('shardX: ' + Object.keys(xState().seen).length + ' rooms seen; candidates (controller within ' + CLAIM_TICKS + ' ticks):');
        for (const c of candidates(0).slice(0, 10)) lines.push('  ' + c.r + ' score ' + c.s + ', ' + c.t + ' ticks from ' + c.h + ' via ' + c.e);
    } else {
        const x = readISM(X_SHARD) || {};
        lines.push('mode: ' + (mode() || 'off') + '; ' + X_SHARD + ' reports ' + (x.seen || 0) + ' rooms seen, ' + (x.cands || []).length +
            ' candidates, ' + (x.sc || 0) + ' scouts');
        lines.push('corners here: ' + nearCorners().map(c => c.corner + (s.noPortal && s.noPortal[c.corner] ? ' (no portal)' : '') + ' from ' + c.home).join(', '));
        if (focused()) lines.push('focused; bait centres: ' + baitCenters().map(c => c.r + ' (from ' + c.h + ')').join(', '));
        for (const sh of (state().shifts || []).slice(-3)) lines.push('  focus shift at ' + sh.t + ': ' + sh.from + ' -> ' + sh.to + ' (from ' + sh.h + ')');
        for (const t of targets()) {
            const p = (x.progress || {})[t.r] || {};
            const block = p.lost && !p.cl ? ' (lost: reclaiming' + (p.hz ? ', ' + p.hz + ' armed hostiles' : '') + (p.ub ? ', controller blocked ' + p.ub : '') + ')' :
                p.ow ? ' (owned by ' + p.ow + ')' : p.rs ? ' (reserved by ' + p.rs.u + ', ' + p.rs.e + ' ticks left)' : p.er !== undefined ? ' (claim refused: ' + p.er + ')' : '';
            lines.push('  ' + t.r + ' from ' + t.h + ' via ' + t.e + ': ' + (p.tm ? 'terminal built' : p.cl ? 'claimed, ' + (p.hp || 0) + ' helpers' : 'not claimed yet' + block));
        }
    }
    console.log(lines.join('\n'));
    return mode() || 'off';
}

module.exports = {
    enabled,
    run, reset, fortified, refreshSeen, scheduleNuisance, shiftFocus, baitCenters, focused, FOCUS_HELPERS, scheduleBait, scheduleFortifyHelpers, FORTIFY_HELPERS, manualTargets, noteBlock,breakerBody, portalStep, runScout, adopt, inferMemory, recordRoom, nextRoom, candidates, pick, nearCorners, scheduleScout, spawnOrder,
    spawned, command, isCorner, isSourceKeeper, X_SHARD, COORD_SHARD, BODIES, CLAIM_TICKS,
};
