// system.expansion — automatic base expansion (one new room at a time per shard).
//
// When: the shard has CPU to spare. Projected CPU = shard average (governor EMA) - harasser CPU
//   (a bonus role that only uses free CPU) + one average room. It must stay at or under
//   CPU_MARGIN of the limit. Room averages come from runtime.roomCpu; global overhead is
//   whatever the shard average holds beyond the rooms. A claim refused for GCL backs off.
// Sponsors: "normally operating" rooms (RCL6+, storage with energy, not under attack). The
//   sponsor nearest the target by route sends the claimer, then helpers, until the new room has
//   built its terminal. From then on the room develops itself.
// Candidates (all must hold):
//   * controller, not owned, not reserved by anyone else, 2+ sources, no source keepers
//   * no room owned by us or a whitelisted player within SPACING rooms
//   * no room claimed by anyone else (non-whitelisted) adjacent to it
//   * the base planner can lay out a full base there (terrain + source/controller/mineral)
//   * reachable from a sponsor without crossing claimed rooms, within SUPPORT_ROUTE rooms
// Ranking: farther from our rooms is better (spreads territory, capped by SEARCH_RANGE /
//   SUPPORT_ROUTE), plus remote-mining potential: sources in the rooms around it that nobody
//   owns or reserves and that are not source-keeper rooms.
// Intel: Memory.expandIntel[room] is recorded from any vision (observers, scouts, passing
//   creeps), but only while expansion is eligible, so a CPU-capped shard spends nothing here.
//   Observers in range look at unknown rooms; homes without one send a 1-MOVE scout.
//
// Memory.expansion = { t: target, sp: sponsor, st: 'claim'|'develop', since, next: next
//   evaluation tick, scan: scanning active until, gcl: GCL back-off until, bad: { room: tick } }
// Memory.settings.autoExpand = false switches it off (manual ClaimThis/SendHelper flags still work).
const roomCpu = require('runtime.roomCpu');
const reachability = require('system.reachability');
const badRooms = require('system.badRooms');
const planner = require('base.planner');
const { Traveler } = require('traveler');

const CPU_MARGIN = 0.85;
const MIN_SAMPLES = 100;          // room CPU averages need this many samples to count
const EVAL_EVERY = 500;
const SPACING = 2;                // no own/whitelisted room within this many rooms
const SEARCH_RANGE = 6;           // candidates up to this far (linear) from a sponsor
const SCAN_RANGE = SEARCH_RANGE + 1;   // neighbours too, for remote counting and adjacency
const SUPPORT_ROUTE = 10;         // max route length sponsor -> target (claimer lives 600 ticks)
const INTEL_REFRESH = 20000;
const INTEL_MAX_AGE = 100000;
const CLAIM_TIMEOUT = 5000;
const FAIL_COOLDOWN = 100000;
const GCL_BACKOFF = 20000;
const PLAN_CHECKS = 3;            // planner runs per evaluation
const SCOUT_EVERY = 1500;
const SCOUT_TARGETS = 8;
const OBSERVER_RANGE = 10;
const HELPERS = 6;
const SPONSOR_RCL = 6;
const SPONSOR_ENERGY = 50000;
const DISTANCE_WEIGHT = 1;
const REMOTE_WEIGHT = 1;

// ---------------------------------------------------------------- rooms and coordinates

function parse(name) {
    const m = /^([WE])(\d+)([NS])(\d+)$/.exec(name);
    if (!m) return null;
    return { x: m[1] === 'W' ? -1 - Number(m[2]) : Number(m[2]), y: m[3] === 'N' ? -1 - Number(m[4]) : Number(m[4]) };
}

function format(x, y) {
    return (x < 0 ? 'W' + (-1 - x) : 'E' + x) + (y < 0 ? 'N' + (-1 - y) : 'S' + y);
}

function linear(a, b) {
    const pa = parse(a), pb = parse(b);
    if (!pa || !pb) return Infinity;
    return Math.max(Math.abs(pa.x - pb.x), Math.abs(pa.y - pb.y));
}

function around(name, range) {
    const p = parse(name);
    const out = [];
    if (!p) return out;
    for (let dx = -range; dx <= range; dx++) {
        for (let dy = -range; dy <= range; dy++) {
            if (dx || dy) out.push(format(p.x + dx, p.y + dy));
        }
    }
    return out;
}

function state() {
    return Memory.expansion || (Memory.expansion = { next: 0, bad: {} });
}

function intelTable() {
    return Memory.expandIntel || (Memory.expandIntel = {});
}

function enabled() {
    return !(Memory.settings && Memory.settings.autoExpand === false);
}

function friendly(username) {
    return !!(Memory.whiteList && Memory.whiteList.includes(username));
}

function myRooms() {
    const out = [];
    for (const name in Game.rooms) {
        const c = Game.rooms[name].controller;
        if (c && c.my) out.push(name);
    }
    return out;
}

// ---------------------------------------------------------------- CPU budget

const HARASSER_KEY = '~harasser';

function budget() {
    const limit = Game.cpu.limit;
    const gov = Memory.cpuGov;
    const shard = gov && gov.ema > 0 ? gov.ema : (Memory.CPUAverages && Memory.CPUAverages.TotalCPU ? Memory.CPUAverages.TotalCPU.CPU : 0);
    const harasser = roomCpu.average(HARASSER_KEY);
    const target = state().t;
    let sum = 0, count = 0, samples = Infinity;
    const table = Memory.roomCPU || {};
    for (const name of myRooms()) {
        const entry = table[name];
        if (!entry || name === target) continue;
        sum += entry.a;
        count++;
        samples = Math.min(samples, entry.n);
    }
    const avgRoom = count ? sum / count : 0;
    const overhead = Math.max(0, shard - harasser - sum);
    const projected = shard - harasser + avgRoom;
    const ready = count > 0 && samples >= MIN_SAMPLES && shard > 0;
    return {
        limit, shard: round(shard), harasser: round(harasser), rooms: count, avgRoom: round(avgRoom),
        overhead: round(overhead), projected: round(projected), cap: round(limit * CPU_MARGIN),
        allowed: ready && projected <= limit * CPU_MARGIN,
    };
}

function round(n) {
    return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------- sponsors

function sponsorFit(room) {
    return !!(room && room.controller && room.controller.my && room.controller.level >= SPONSOR_RCL &&
        room.storage && room.storage.store[RESOURCE_ENERGY] >= SPONSOR_ENERGY &&
        (Memory.roomsUnderAttack || []).indexOf(room.name) === -1 &&
        room.find(FIND_MY_SPAWNS).length > 0);
}

function sponsors() {
    return myRooms().filter(name => sponsorFit(Game.rooms[name]));
}

// Route length in rooms (Traveler's route, avoiding claimed rooms); Infinity when unreachable.
function routeLength(from, to) {
    if (!reachability.reachable(from, to)) return Infinity;
    const route = Traveler.findRoute(from, to);
    return route ? Object.keys(route).length - 1 : Infinity;
}

// Nearest fit sponsor by route, within SUPPORT_ROUTE.
function pickSponsor(target, list = sponsors()) {
    let best, bestLength = Infinity;
    for (const name of list.filter(n => linear(n, target) <= SEARCH_RANGE).sort((a, b) => linear(a, target) - linear(b, target))) {
        if (linear(name, target) >= bestLength) break;
        const length = routeLength(name, target);
        if (length < bestLength && length <= SUPPORT_ROUTE) {
            best = name;
            bestLength = length;
        }
    }
    return best;
}

// ---------------------------------------------------------------- intel

function record(room) {
    if (room.controller && room.controller.my) return;
    const c = room.controller;
    const sources = room.find(FIND_SOURCES);
    const entry = { t: Game.time };
    if (sources.length) entry.n = sources.length;
    if (room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_KEEPER_LAIR } }).length) entry.k = 1;
    if (c) {
        if (c.owner) entry.o = c.owner.username;
        if (c.reservation) entry.r = c.reservation.username;
        if (!c.owner && sources.length >= 2) {
            entry.c = [c.pos.x, c.pos.y];
            entry.s = sources.map(s => [s.pos.x, s.pos.y]);
            const mineral = room.find(FIND_MINERALS)[0];
            if (mineral) entry.m = [mineral.pos.x, mineral.pos.y];
            const old = intelTable()[room.name];
            // Layout depends on terrain and these positions only: keep a finished plan check.
            if (old && old.p !== undefined && old.c && old.c[0] === entry.c[0] && old.c[1] === entry.c[1]) entry.p = old.p;
        }
    }
    intelTable()[room.name] = entry;
}

function fresh(entry, age = INTEL_REFRESH) {
    return !!entry && Game.time - entry.t < age;
}

function scanning() {
    return enabled() && state().scan > Game.time;
}

// While scanning: record every visible room whose intel is missing or old.
function observe() {
    if (!scanning()) return;
    const table = intelTable();
    for (const name in Game.rooms) {
        if (!fresh(table[name])) record(Game.rooms[name]);
    }
}

// Who owns a room, as far as we know.
function ownerOf(name) {
    const room = Game.rooms[name];
    if (room) return room.controller && room.controller.owner ? room.controller.owner.username : undefined;
    const entry = Memory.expandIntel && Memory.expandIntel[name];
    if (entry && fresh(entry, INTEL_MAX_AGE)) return entry.o;
    const remote = Memory.remoteIntel && Memory.remoteIntel[name];
    if (remote && remote.o) return remote.o;
    return Memory.badRooms && Memory.badRooms[name] ? Memory.badRooms[name].o : undefined;
}

function known(name) {
    return !!Game.rooms[name] || fresh(Memory.expandIntel && Memory.expandIntel[name], INTEL_MAX_AGE) || badRooms.isBad(name);
}

// ---------------------------------------------------------------- candidates

// Why a room is not a candidate (null = valid apart from the plan check and route).
function invalidReason(name, entry, ctx) {
    if (!entry || !fresh(entry, INTEL_MAX_AGE)) return 'no intel';
    if (!entry.c) return entry.o ? 'owned by ' + entry.o : (entry.n >= 2 ? 'no controller' : 'fewer than 2 sources');
    if (entry.k) return 'source keepers';
    if (entry.r && entry.r !== ctx.me) return 'reserved by ' + entry.r;
    if (ctx.bad[name] !== undefined && Game.time - ctx.bad[name] < FAIL_COOLDOWN) return 'failed recently';
    for (const own of ctx.mine) {
        if (linear(own, name) <= SPACING) return 'within ' + SPACING + ' of our room ' + own;
    }
    for (const near of around(name, SPACING)) {
        const owner = ownerOf(near);
        if (owner && owner !== ctx.me && friendly(owner)) return 'within ' + SPACING + ' of whitelisted ' + near;
    }
    for (const next of around(name, 1)) {
        if (!known(next)) return 'neighbour ' + next + ' not scouted';
        const owner = ownerOf(next);
        if (badRooms.isBad(next) || (owner && owner !== ctx.me && !friendly(owner))) return 'next to claimed ' + next;
    }
    if (entry.p === 0) return 'base does not fit';
    return null;
}

// Sources in the rooms bordering a candidate that could become its remotes.
function remotePotential(name) {
    const exits = Game.map.describeExits(name) || {};
    let total = 0;
    for (const dir in exits) {
        const next = exits[dir];
        const entry = Memory.expandIntel && Memory.expandIntel[next];
        if (!entry || !entry.n || entry.k || entry.o) continue;
        if (entry.r && entry.r !== myName()) continue;
        if (ownerOf(next)) continue;
        total += entry.n;
    }
    return total;
}

function myName() {
    for (const name in Game.spawns) return Game.spawns[name].owner.username;
    return undefined;
}

function score(name, mine) {
    let distance = Infinity;
    for (const own of mine) distance = Math.min(distance, linear(own, name));
    if (!isFinite(distance)) distance = 0;
    const remote = remotePotential(name);
    return { distance, remote, score: DISTANCE_WEIGHT * Math.min(distance, SEARCH_RANGE) + REMOTE_WEIGHT * remote };
}

// Can the base planner lay out a full base here? Terrain needs no vision.
function planCheck(name, entry) {
    const terrain = Game.map.getRoomTerrain(name);
    const walls = new Uint8Array(2500);
    for (let x = 0; x < 50; x++) {
        for (let y = 0; y < 50; y++) walls[x * 50 + y] = terrain.get(x, y) & TERRAIN_MASK_WALL ? 1 : 0;
    }
    const tile = p => p[0] * 50 + p[1];
    const typeAt = {};
    const sources = entry.s.map(tile);
    for (const t of sources) typeAt[t] = 'source';
    const controller = tile(entry.c);
    typeAt[controller] = 'controller';
    const mineral = entry.m ? tile(entry.m) : undefined;
    if (mineral !== undefined) typeAt[mineral] = 'mineral';
    let result = null;
    try {
        result = planner.plan({ walls, typeAt, sources, controller, mineral });
    } catch (e) {
        result = null;
    }
    // A proper base: storage and the full count of every structure kind the planner places.
    const ok = !!(result && result.structures && (result.structures.storage || []).length >= 1 &&
        Object.keys(planner.COUNTS).every(kind => (result.structures[kind] || []).length >= planner.COUNTS[kind]));
    entry.p = ok ? 1 : 0;
    return ok;
}

// All rooms with intel, valid or not, ranked (valid first, by score).
function candidates() {
    const ctx = { mine: myRooms(), me: myName(), bad: state().bad || {} };
    if (state().t) ctx.mine.push(state().t);
    const out = [];
    const table = Memory.expandIntel || {};
    for (const name in table) {
        const entry = table[name];
        if (!entry.c) continue;
        const reason = invalidReason(name, entry, ctx);
        out.push(Object.assign({ room: name, reason }, reason ? { score: -1 } : score(name, ctx.mine)));
    }
    out.sort((a, b) => (a.reason ? 1 : 0) - (b.reason ? 1 : 0) || b.score - a.score);
    return out;
}

// ---------------------------------------------------------------- scanning requests

const scanQueues = Object.create(null);   // heap: home -> { t, rooms }

function scanQueue(home) {
    let queue = scanQueues[home];
    if (!queue || Game.time - queue.t > EVAL_EVERY) {
        const table = intelTable();
        const rooms = around(home, SCAN_RANGE).filter(name => !fresh(table[name]) && !Game.rooms[name]);
        rooms.sort((a, b) => linear(home, a) - linear(home, b));
        queue = scanQueues[home] = { t: Game.time, rooms };
    }
    const table = intelTable();
    while (queue.rooms.length && fresh(table[queue.rooms[0]])) queue.rooms.shift();
    return queue.rooms;
}

// Observer homes: the next room to look at for expansion intel (only while scanning).
function observeRequest(home) {
    if (!scanning() || !sponsorFit(Game.rooms[home])) return undefined;
    const rooms = scanQueue(home);
    return rooms.length ? rooms.shift() : undefined;
}

function hasObserver(home) {
    return !!(Memory.observerList && Memory.observerList[home] && Memory.observerList[home].length);
}

function observerCovers(name) {
    for (const home in Memory.observerList || {}) {
        if (hasObserver(home) && linear(home, name) <= OBSERVER_RANGE) return true;
    }
    return false;
}

// Homes without an observer: rooms for a scout to visit, every SCOUT_EVERY ticks while scanning.
function scoutTargets(home) {
    if (!scanning() || Game.time % SCOUT_EVERY !== 0 || hasObserver(home) || !sponsorFit(Game.rooms[home])) return [];
    return scanQueue(home).filter(name => !observerCovers(name)).slice(0, SCOUT_TARGETS);
}

// ---------------------------------------------------------------- state machine

function start(target, sponsor) {
    const s = state();
    s.t = target;
    s.sp = sponsor;
    s.st = 'claim';
    s.since = Game.time;
    console.log('[expansion] claiming ' + target + ' from ' + sponsor);
}

function finish(message) {
    const s = state();
    console.log('[expansion] ' + s.t + ': ' + message);
    delete s.t;
    delete s.sp;
    delete s.st;
    delete s.since;
    s.next = Game.time + EVAL_EVERY;
}

function fail(reason) {
    const s = state();
    if (!s.bad) s.bad = {};
    s.bad[s.t] = Game.time;
    finish('abandoned (' + reason + ')');
}

// The claimer reports back (creep.claimer).
function claimed(roomName) {
    const s = state();
    if (s.t !== roomName) return;
    s.st = 'develop';
    s.since = Game.time;
    console.log('[expansion] ' + roomName + ' claimed; helpers from ' + s.sp + ' until it has a terminal');
}

function claimFailed(roomName, code) {
    const s = state();
    if (s.t !== roomName) return;
    if (code === ERR_GCL_NOT_ENOUGH) {
        s.gcl = Game.time + GCL_BACKOFF;
        finish('GCL too low, waiting ' + GCL_BACKOFF + ' ticks');
    } else {
        fail('claim refused: ' + code);
    }
}

function progress() {
    const s = state();
    const room = Game.rooms[s.t];
    if (s.st === 'claim') {
        if (room && room.controller && room.controller.my) return claimed(s.t);
        if (room && room.controller && room.controller.owner) return fail('claimed by ' + room.controller.owner.username);
        if (room && room.controller && room.controller.reservation && room.controller.reservation.username !== myName()) {
            return fail('reserved by ' + room.controller.reservation.username);
        }
        if (Game.time - s.since > CLAIM_TIMEOUT) return fail('claim timed out');
    } else if (s.st === 'develop') {
        if (!room || !room.controller || !room.controller.my) return fail('room lost');
        if (room.terminal && room.terminal.my) return finish('terminal built, the room develops itself now');
    }
    // Keep a fit sponsor (the old one may have come under attack or run low).
    if (Game.time % 100 === 0 && !sponsorFit(Game.rooms[s.sp])) {
        const next = pickSponsor(s.t);
        if (next) s.sp = next;
    }
}

function evaluate() {
    const s = state();
    s.next = Game.time + EVAL_EVERY;
    const cpu = budget();
    const list = sponsors();
    if (!cpu.allowed || (s.gcl && Game.time < s.gcl) || !list.length || myRooms().length >= Game.gcl.level) {
        delete s.scan;
        return;
    }
    s.scan = Game.time + EVAL_EVERY * 2;
    let checks = 0;
    for (const candidate of candidates()) {
        if (candidate.reason) break;
        const entry = Memory.expandIntel[candidate.room];
        if (entry.p === undefined) {
            if (checks >= PLAN_CHECKS) {
                s.next = Game.time + 10;   // more plan checks shortly
                return;
            }
            checks++;
            if (!planCheck(candidate.room, entry)) continue;
        }
        const sponsor = pickSponsor(candidate.room, list);
        if (!sponsor) continue;
        start(candidate.room, sponsor);
        return;
    }
}

function pruneIntel() {
    const table = Memory.expandIntel;
    if (!table) return 0;
    let removed = 0;
    for (const name in table) {
        if (!fresh(table[name], INTEL_MAX_AGE)) {
            delete table[name];
            removed++;
        }
    }
    if (!Object.keys(table).length) delete Memory.expandIntel;
    const bad = Memory.expansion && Memory.expansion.bad;
    for (const name in bad || {}) {
        if (Game.time - bad[name] >= FAIL_COOLDOWN) {
            delete bad[name];
            removed++;
        }
    }
    return removed;
}

function run() {
    if (!enabled()) return;
    observe();
    const s = state();
    if (s.t) progress();
    else if (Game.time >= (s.next || 0)) evaluate();
}

// What this home's spawn should make for the expansion: { type, target } or null.
function spawnOrder(roomName) {
    if (!enabled()) return null;
    const s = state();
    if (!s.t || s.sp !== roomName) return null;
    if (s.st === 'claim') return { type: 'claim', target: s.t };
    if (s.st === 'develop') return { type: 'helper', target: s.t, max: HELPERS };
    return null;
}

// Console: expansion() prints budget, state and the best candidates.
function report(limit = 10) {
    const s = state();
    const cpu = budget();
    const lines = ['Expansion ' + (enabled() ? '' : '(disabled) ') + 'on ' + Game.shard.name,
        'CPU: shard ' + cpu.shard + ' - harasser ' + cpu.harasser + ' + room ' + cpu.avgRoom + ' (' + cpu.rooms + ' rooms, overhead ' +
        cpu.overhead + ') = ' + cpu.projected + ' vs cap ' + cpu.cap + ' (' + Math.round(CPU_MARGIN * 100) + '% of ' + cpu.limit + '): ' +
        (cpu.allowed ? 'room to expand' : 'no room to expand'),
        'GCL ' + Game.gcl.level + ', rooms here ' + myRooms().length + (s.gcl > Game.time ? ', GCL back-off until ' + s.gcl : ''),
        s.t ? 'In progress: ' + s.t + ' (' + s.st + ' since ' + s.since + ', sponsor ' + s.sp + ')' : 'Nothing in progress; next evaluation at ' + s.next,
        'Scanning: ' + (scanning() ? 'until ' + s.scan : 'off') + ', sponsors: ' + sponsors().join(', ')];
    const list = candidates();
    lines.push('Candidates (' + list.filter(c => !c.reason).length + ' valid of ' + list.length + ' with a free controller):');
    for (const c of list.slice(0, limit)) {
        lines.push('  ' + c.room + ': ' + (c.reason ? c.reason : 'score ' + c.score + ' (distance ' + c.distance + ', remote sources ' + c.remote +
            (Memory.expandIntel[c.room].p === undefined ? ', plan not checked yet' : '') + ')'));
    }
    console.log(lines.join('\n'));
    return list.length + ' candidates';
}

module.exports = {
    run, budget, sponsors, sponsorFit, pickSponsor, candidates, invalidReason, score, remotePotential, planCheck,
    record, observe, observeRequest, scoutTargets, spawnOrder, claimed, claimFailed, pruneIntel, report,
    parse, format, linear, around, HARASSER_KEY, CPU_MARGIN, HELPERS,
};
