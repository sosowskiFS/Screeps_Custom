// system.shardX — one-time scouting and settling of shardX from shard2.
//
// Console (run on shard2):  shardX('scout')  start scouting
//                           shardX('claim')  stop scouting, pick 3 rooms, claim and support them
//                           shardX('cancel') stop everything;  shardX() status (on either shard)
//
// Scouting
//   shard2: the nearest highway corners (both coordinates multiples of 10) to our homes are
//     visited by 1-MOVE scouts from the closest home. A scout records the corner's portals; one
//     leading to shardX is remembered (Memory.xs.portals[corner] = arrival room) and stepped
//     into; a corner without one is noted and the next corner is tried. Scouts are re-sent every
//     RESEND ticks while scouting.
//   shardX: arriving creeps take their memory from shard2's InterShardMemory (Memory is per shard;
//     if that fails the role is inferred from the body). Scouts explore outward from where they
//     arrived (up to EXPLORE_RANGE rooms), never into rooms claimed by others or source-keeper
//     rooms. Every room entered is recorded into the structures the rest of the code uses:
//     Memory.expandIntel (auto-expansion), Memory.badRooms (Traveler never routes through claimed
//     rooms) and Memory.remoteIntel (remote mining). shardX validates candidates with the
//     auto-expansion rules (system.expansion: controller, 2+ sources, spacing, no claimed
//     neighbour, the base planner fits) and publishes them ranked.
// Claiming
//   shard2 picks the 3 best candidates, each supported by a different shard2 home: the home
//   nearest a corner whose portal leads to the candidate's arrival room, within MAX_TOTAL rooms
//   overall (a claimer lives 600 ticks). That home sends a claimer through the portal, then keeps
//   HELPERS builders there until shardX reports the room has a terminal. From then on shardX's own
//   auto-expansion takes over.
//
// InterShardMemory key 'xs':  shard2 { t, mode, targets: [{r,h,c,e,d}], travellers: {name: memory} }
//                             shardX { t, cands: [{r,e,d,s}], progress: {room: {cl,tm,hp}}, seen }
const expansion = require('system.expansion');
const badRooms = require('system.badRooms');
const remoteMining = require('system.remoteMining');
const reachability = require('system.reachability');
const { Traveler } = require('traveler');

const X_SHARD = 'shardX';
const HOME_SHARD = 'shard2';
const CORNERS = 4;               // corners scouted at once
const CORNER_SEARCH = 12;        // corners looked for within this many rooms of a home
const RESEND = 1500;
const EXPLORE_RANGE = 8;         // rooms from the arrival room
const RESEEN = 20000;
const MAX_TOTAL = 11;            // home -> corner + arrival -> target, in rooms
const MAX_HOME_ROUTE = 8;
const HELPERS = 4;
const CLAIMER_GAP = 700;
const HELPER_GAP = 150;
const TOP_CANDS = 30;
const PLAN_CHECKS = 2;           // base planner runs per 100 ticks (CPU spikes; shardX may have little CPU)
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

function hasISM() {
    return typeof InterShardMemory !== 'undefined';
}

function readISM(shard) {
    if (!hasISM()) return null;
    try {
        const raw = shard === Game.shard.name ? InterShardMemory.getLocal() : InterShardMemory.getRemote(shard);
        return raw ? (JSON.parse(raw).xs || null) : null;
    } catch (e) {
        return null;
    }
}

function writeISM(entry) {
    if (!hasISM()) return;
    let data = {};
    try {
        data = JSON.parse(InterShardMemory.getLocal() || '{}') || {};
    } catch (e) {
        data = {};
    }
    if (entry) data.xs = entry;
    else delete data.xs;
    InterShardMemory.setLocal(JSON.stringify(data));
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

function routeLength(from, to) {
    if (!reachability.reachable(from, to)) return Infinity;
    const route = Traveler.findRoute(from, to);
    return route ? Object.keys(route).length - 1 : Infinity;
}

// Corners near our homes, nearest first: [{ corner, home, distance }], one home per corner.
function nearCorners(homeList = homes()) {
    const best = {};
    for (const home of homeList) {
        const p = parse(home);
        for (let dx = -CORNER_SEARCH; dx <= CORNER_SEARCH; dx++) {
            for (let dy = -CORNER_SEARCH; dy <= CORNER_SEARCH; dy++) {
                const name = format(p.x + dx, p.y + dy);
                if (!isCorner(name)) continue;
                const distance = Math.max(Math.abs(dx), Math.abs(dy));
                if (!best[name] || distance < best[name].distance) best[name] = { corner: name, home, distance };
            }
        }
    }
    return Object.values(best).sort((a, b) => a.distance - b.distance);
}

// ---------------------------------------------------------------- portal travel (any shard)

// Creeps bound for shardX (memory.xShard = { c: corner }) walk to the corner and step into its
// shardX portal. Returns true when it handled the creep this tick.
function portalStep(creep) {
    const x = creep.memory.xShard;
    if (!x || Game.shard.name === X_SHARD) return false;
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
    let remote;
    for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        if (creep.memory && creep.memory.priority) continue;
        if (remote === undefined) remote = readISM(HOME_SHARD) || {};
        const entry = remote.travellers && remote.travellers[name];
        const mem = entry ? Object.assign({}, entry.m) : inferMemory(creep, remote);
        if (mem.priority === 'xScout') mem.entry = creep.room.name;
        Memory.creeps[name] = mem;
    }
}

function inferMemory(creep, remote) {
    const targets = (remote && remote.targets) || [];
    const local = targets.filter(t => t.e === creep.room.name);
    const target = (local.length ? local : targets)[0];
    if (creep.getActiveBodyparts(CLAIM) && target) return { priority: 'claimer', destination: target.r, homeRoom: target.h, xTarget: 1 };
    if (creep.getActiveBodyparts(WORK) && target) return { priority: 'helper', destination: target.r, homeRoom: target.h, xTarget: 1, previousPriority: 'helper' };
    return { priority: 'xScout' };
}

function xState() {
    const s = state();
    if (!s.seen) s.seen = {};
    if (!s.tag) s.tag = {};
    return s;
}

// Everything a scout learns about a room goes where the rest of the code looks for it.
function recordRoom(room, entry) {
    expansion.record(room);
    badRooms.record(room);
    remoteMining.recordIntel(room);
    const s = xState();
    s.seen[room.name] = Game.time;
    if (entry) {
        const d = linear(entry, room.name);
        const old = s.tag[room.name];
        if (!old || d < old.d) s.tag[room.name] = { e: entry, d };
    }
}

function explorable(name, entry) {
    if (linear(entry, name) > EXPLORE_RANGE || isSourceKeeper(name) || badRooms.isBad(name)) return false;
    const seen = xState().seen[name];
    return seen === undefined || Game.time - seen > RESEEN;
}

// Next room for a scout: the nearest unexplored room in range, avoiding other scouts' targets.
function nextRoom(creep) {
    const entry = creep.memory.entry || creep.room.name;
    const taken = new Set();
    for (const name in Game.creeps) {
        const other = Game.creeps[name];
        if (other !== creep && other.memory.priority === 'xScout' && other.memory.next) taken.add(other.memory.next);
    }
    let best, bestScore = Infinity;
    const p = parse(entry);
    for (let dx = -EXPLORE_RANGE; dx <= EXPLORE_RANGE; dx++) {
        for (let dy = -EXPLORE_RANGE; dy <= EXPLORE_RANGE; dy++) {
            const name = format(p.x + dx, p.y + dy);
            if (taken.has(name) || !explorable(name, entry)) continue;
            const score = linear(creep.room.name, name) + Math.random() * 0.5;
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
        recordRoom(creep.room, creep.memory.entry);
        creep.memory.last = creep.room.name;
        if (creep.memory.next === creep.room.name) delete creep.memory.next;
    }
    let next = creep.memory.next;
    if (!next || !explorable(next, creep.memory.entry)) next = creep.memory.next = nextRoom(creep);
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

// Candidates on shardX: valid by the auto-expansion rules, base planner checked, ranked.
function candidates(checks = PLAN_CHECKS) {
    const s = xState();
    const ctx = { mine: myRooms(), me: undefined, bad: {} };
    const out = [];
    for (const name in s.tag) {
        const entry = Memory.expandIntel && Memory.expandIntel[name];
        if (!entry || !entry.c || expansion.invalidReason(name, entry, ctx)) continue;
        if (entry.p === undefined) {
            if (checks <= 0) continue;
            checks--;
            if (!expansion.planCheck(name, entry)) continue;
        }
        out.push({ r: name, e: s.tag[name].e, d: s.tag[name].d, s: expansion.score(name, ctx.mine).score });
    }
    out.sort((a, b) => b.s - a.s || a.d - b.d);
    return out.slice(0, TOP_CANDS);
}

function myRooms() {
    return Object.keys(Game.rooms).filter(n => Game.rooms[n].controller && Game.rooms[n].controller.my);
}

function runX() {
    adopt();
    if (Game.time % 100 !== 0) return;
    const home = readISM(HOME_SHARD) || {};
    const progress = {};
    for (const t of home.targets || []) {
        const room = Game.rooms[t.r];
        progress[t.r] = {
            cl: room && room.controller && room.controller.my ? 1 : 0,
            tm: room && room.terminal && room.terminal.my ? 1 : 0,
            hp: Object.keys(Game.creeps).filter(n => Game.creeps[n].memory.priority === 'helper' && Game.creeps[n].memory.destination === t.r).length,
        };
    }
    writeISM({ t: Date.now(), cands: candidates(), progress, seen: Object.keys(xState().seen).length });
}

// ---------------------------------------------------------------- shard2: scouts, picks, support

function queue(home, order) {
    const s = state();
    if (!s.queue) s.queue = {};
    if (!s.queue[home]) s.queue[home] = order;
}

function scheduleScouts() {
    const s = state();
    if (!s.sent) s.sent = {};
    const corners = nearCorners().filter(c => !(s.noPortal && s.noPortal[c.corner])).slice(0, CORNERS);
    for (const { corner, home } of corners) {
        if (Game.time - (s.sent[corner] || 0) < RESEND) continue;
        s.sent[corner] = Game.time;
        queue(home, { kind: 'xScout', memory: { priority: 'xScout', homeRoom: home, xShard: { c: corner } } });
    }
}

// Pick the targets: best candidates first, each from a different home, spaced like auto-expansion.
function pick(cands) {
    const s = state();
    const homeList = homes();
    const picks = [];
    const used = new Set();
    for (const cand of cands) {
        if (picks.length >= 3) break;
        if (picks.some(p => linear(p.r, cand.r) <= 2)) continue;
        let best = null;
        for (const corner in s.portals || {}) {
            if (s.portals[corner] !== cand.e) continue;
            for (const home of homeList) {
                if (used.has(home) || linear(home, corner) > MAX_HOME_ROUTE) continue;
                const hd = routeLength(home, corner);
                if (hd > MAX_HOME_ROUTE || hd + cand.d > MAX_TOTAL) continue;
                if (!best || hd < best.hd) best = { home, corner, hd };
            }
        }
        if (!best) continue;
        used.add(best.home);
        picks.push({ r: cand.r, h: best.home, c: best.corner, e: cand.e, d: best.hd + cand.d });
    }
    return picks;
}

function fitHome(name) {
    return homes().includes(name);
}

function scheduleSupport(progress) {
    const s = state();
    if (!s.last) s.last = {};
    let done = 0;
    for (const t of s.targets) {
        const p = progress[t.r] || {};
        if (p.tm) { done++; continue; }
        let home = t.h;
        if (!fitHome(home)) {
            const alt = homes().sort((a, b) => linear(a, t.c) - linear(b, t.c))[0];
            if (!alt) continue;
            home = alt;
        }
        const inFlight = role => Object.keys(Game.creeps).filter(n => {
            const m = Game.creeps[n].memory;
            return m.priority === role && m.destination === t.r && m.xShard;
        }).length;
        const base = { destination: t.r, homeRoom: home, xTarget: 1, xShard: { c: t.c } };
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
    if (s.targets.length && done === s.targets.length) {
        s.mode = 'done';
        console.log('[shardX] all ' + done + ' rooms have a terminal; shardX develops itself from here');
    }
}

function runHome() {
    const s = state();
    // Travellers are kept a creep lifetime: shardX reads them when the creep arrives.
    for (const name in s.travellers || {}) {
        if (Game.time - s.travellers[name].t > TRAVELLER_TTL) { delete s.travellers[name]; s.dirty = 1; }
    }
    if (s.mode === 'scout' && Game.time % 100 === 0) scheduleScouts();
    if (s.mode === 'claim' && Game.time % 25 === 0) {
        const remote = readISM(X_SHARD) || {};
        if (!s.targets || !s.targets.length) {
            const cands = remote.cands || [];
            s.targets = pick(cands);
            console.log('[shardX] ' + (s.targets.length ? 'claiming ' + s.targets.map(t => t.r + ' (from ' + t.h + ' via ' + t.c + ')').join(', ')
                : 'no usable candidates yet (' + cands.length + ' reported by ' + X_SHARD + '); retrying'));
            s.dirty = 1;
        }
        if (s.targets.length) scheduleSupport(remote.progress || {});
    }
    if (s.dirty || Game.time % 50 === 0) {
        writeISM(s.mode || Object.keys(s.travellers || {}).length
            ? { t: Date.now(), mode: s.mode, targets: s.targets || [], travellers: mapTravellers(s.travellers) } : null);
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
    return { body: BODIES[order.kind], memory: order.memory };
}

function spawned(roomName) {
    if (Memory.xs && Memory.xs.queue) delete Memory.xs.queue[roomName];
}

function run() {
    if (Game.shard.name === X_SHARD) runX();
    else if (Game.shard.name === HOME_SHARD && Memory.xs) runHome();
}

// ---------------------------------------------------------------- console

function command(cmd) {
    const s = state();
    if (cmd === 'scout' || cmd === 'claim' || cmd === 'cancel') {
        if (Game.shard.name !== HOME_SHARD) return 'run this on ' + HOME_SHARD;
        if (cmd === 'cancel') {
            s.mode = undefined;
            s.queue = {};
            s.dirty = 1;
            return 'shardX scouting/claiming stopped';
        }
        s.mode = cmd;
        s.dirty = 1;
        if (cmd === 'claim') s.queue = {};
        return cmd === 'scout' ? 'scouting started: scouts go to ' + nearCorners().slice(0, CORNERS).map(c => c.corner + ' (from ' + c.home + ')').join(', ')
            : 'scouting stopped; picking 3 rooms from ' + X_SHARD + '\'s candidates within 25 ticks';
    }
    const lines = [];
    if (Game.shard.name === X_SHARD) {
        lines.push('shardX: ' + Object.keys(xState().seen).length + ' rooms seen; top candidates:');
        for (const c of candidates(0).slice(0, 10)) lines.push('  ' + c.r + ' score ' + c.s + ', ' + c.d + ' rooms from arrival ' + c.e);
    } else {
        const remote = readISM(X_SHARD) || {};
        lines.push('mode: ' + (s.mode || 'off') + '; ' + X_SHARD + ' reports ' + (remote.seen || 0) + ' rooms seen, ' + (remote.cands || []).length + ' candidates');
        lines.push('portals to ' + X_SHARD + ': ' + JSON.stringify(s.portals || {}) + '; corners without: ' + Object.keys(s.noPortal || {}).join(', '));
        for (const t of s.targets || []) {
            const p = (remote.progress || {})[t.r] || {};
            lines.push('  ' + t.r + ' from ' + t.h + ' via ' + t.c + ': ' + (p.tm ? 'terminal built' : p.cl ? 'claimed, ' + (p.hp || 0) + ' helpers' : 'not claimed yet'));
        }
    }
    console.log(lines.join('\n'));
    return s.mode || 'off';
}

module.exports = {
    run, portalStep, runScout, adopt, inferMemory, recordRoom, nextRoom, candidates, pick, nearCorners, spawnOrder, spawned,
    command, isCorner, isSourceKeeper, X_SHARD, HOME_SHARD, BODIES,
};
