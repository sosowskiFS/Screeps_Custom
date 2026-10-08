// system.shardX — scouting and settling shardX from shard2, shard1 and shard3.
//
// Console (shard2):  shardX('scout')  scouting on every home shard (shard1/shard3 follow shard2)
//                    shardX('claim')  stop scouting, pick 3 rooms, claim and support them
//                    shardX('cancel') stop everything;  shardX() status (on any shard)
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
//   home shards { t, travellers: {name: {m}} } plus, on shard2, mode and targets [{r,h,e,t}]
//   shardX      { t, cands: [{r,h,e,t,s}], progress: {room: {cl,tm,hp}}, seen, sc }
const expansion = require('system.expansion');
const badRooms = require('system.badRooms');
const remoteMining = require('system.remoteMining');

const X_SHARD = 'shardX';
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
const CLAIMER_GAP = 700;
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

function runX() {
    adopt();
    if (Game.time % 100 !== 0) return;
    const progress = {};
    for (const t of (readISM(COORD_SHARD) || {}).targets || []) {
        const room = Game.rooms[t.r];
        progress[t.r] = {
            cl: room && room.controller && room.controller.my ? 1 : 0,
            tm: room && room.terminal && room.terminal.my ? 1 : 0,
            hp: Object.keys(Game.creeps).filter(n => Game.creeps[n].memory.priority === 'helper' && Game.creeps[n].memory.destination === t.r).length,
        };
        // Guards here: the longest remaining life, and the latest measured trip (spawn to arrival).
        for (const n in Game.creeps) {
            const m = Game.creeps[n].memory;
            if (m.priority !== 'roomGuard' || m.destination !== t.r) continue;
            progress[t.r].gd = Math.max(progress[t.r].gd || 0, Game.creeps[n].ticksToLive || 0);
            if (m.trip !== undefined) progress[t.r].gt = m.trip;
        }
    }
    const scouts = Object.keys(Game.creeps).filter(n => Game.creeps[n].memory.priority === 'xScout').length;
    writeISM({ t: Date.now(), cands: candidates(), progress, seen: Object.keys(xState().seen).length, sc: scouts });
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

// Pick the targets: best candidates first, each from a different home, spaced like auto-expansion.
function pick(cands) {
    const picks = [];
    const used = new Set();
    for (const cand of cands) {
        if (picks.length >= 3) break;
        if (!cand.h || used.has(cand.h) || cand.t > CLAIM_TICKS) continue;
        if (picks.some(p => linear(p.r, cand.r) <= 2)) continue;
        used.add(cand.h);
        picks.push({ r: cand.r, h: cand.h, e: cand.e, t: cand.t });
    }
    return picks;
}

// Claimer, then helpers, for the targets whose home is on this shard.
function scheduleSupport(list, progress) {
    const s = state();
    if (!s.last) s.last = {};
    const here = Game.shard.name;
    for (const t of list) {
        const [shard, home] = t.h.split(':');
        const p = progress[t.r] || {};
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
        if (!p.cl) {
            if (!inFlight('claimer') && Game.time - (s.last[t.r + ':c'] || 0) > CLAIMER_GAP) {
                s.last[t.r + ':c'] = Game.time;
                queue(home, { kind: 'claimer', memory: Object.assign({ priority: 'claimer' }, base) });
            }
        } else if ((p.hp || 0) + inFlight('helper') < HELPERS && Game.time - (s.last[t.r + ':h'] || 0) > HELPER_GAP) {
            s.last[t.r + ':h'] = Game.time;
            queue(home, { kind: 'helper', memory: Object.assign({ priority: 'helper', previousPriority: 'helper' }, base) });
        }
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
    if (m === 'claim' && Game.time % 25 === 0) {
        const x = readISM(X_SHARD) || {};
        if (here === COORD_SHARD && !(s.targets && s.targets.length)) {
            s.targets = pick(x.cands || []);
            console.log('[shardX] ' + (s.targets.length ? 'claiming ' + s.targets.map(t => t.r + ' (from ' + t.h + ')').join(', ')
                : 'no usable candidates yet (' + (x.cands || []).length + ' reported by ' + X_SHARD + '); retrying'));
            s.dirty = 1;
        }
        const list = targets();
        scheduleSupport(list, x.progress || {});
        if (here === COORD_SHARD && list.length && list.every(t => (x.progress || {})[t.r] && x.progress[t.r].tm)) {
            s.mode = 'done';
            s.dirty = 1;
            console.log('[shardX] all ' + list.length + ' rooms have a terminal; shardX develops itself from here');
        }
    }
    if (m === undefined && s.queue && Object.keys(s.queue).length) s.queue = {};
    if (s.dirty || Game.time % 50 === 0) {
        const entry = { t: Date.now(), travellers: mapTravellers(s.travellers) };
        if (here === COORD_SHARD) {
            entry.mode = s.mode;
            entry.targets = s.targets || [];
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
    const s = Memory.xs;
    const order = s && s.queue && s.queue[roomName];
    if (!order) return null;
    if (order.kind === 'roomGuard' && require('system.guardSquads').escalated(X_SHARD, order.memory.destination)) {
        delete s.queue[roomName];
        return null;
    }
    const body = order.kind === 'roomGuard' ? require('creep.roomGuard').body(Game.rooms[roomName].energyCapacityAvailable) : BODIES[order.kind];
    return { body, memory: order.memory };
}

function spawned(roomName) {
    if (Memory.xs && Memory.xs.queue) delete Memory.xs.queue[roomName];
}

function run() {
    if (Game.shard.name === X_SHARD) runX();
    else if (HOME_SHARDS.includes(Game.shard.name)) runHome();
}

// ---------------------------------------------------------------- console

function command(cmd) {
    const s = state();
    if (cmd === 'scout' || cmd === 'claim' || cmd === 'cancel') {
        if (Game.shard.name !== COORD_SHARD) return 'run this on ' + COORD_SHARD + ' (the other shards follow it)';
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
        for (const t of targets()) {
            const p = (x.progress || {})[t.r] || {};
            lines.push('  ' + t.r + ' from ' + t.h + ' via ' + t.e + ': ' + (p.tm ? 'terminal built' : p.cl ? 'claimed, ' + (p.hp || 0) + ' helpers' : 'not claimed yet'));
        }
    }
    console.log(lines.join('\n'));
    return mode() || 'off';
}

module.exports = {
    run, portalStep, runScout, adopt, inferMemory, recordRoom, nextRoom, candidates, pick, nearCorners, scheduleScout, spawnOrder,
    spawned, command, isCorner, isSourceKeeper, X_SHARD, COORD_SHARD, BODIES, CLAIM_TICKS,
};
