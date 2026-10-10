// system.remoteMining — automatic remote-mining source selection and room safety.
//
// Intel:  any visible room near a home room is summarised in Memory.remoteIntel (sources,
//         owner, reservation, keeper lairs, hostile towers). Vision comes from observers,
//         our creeps, or a 1-MOVE scout sent when intel is missing or stale.
// Plan:   a source is worth mining when, after paying for the creeps that mine it (the miner,
//         as many mules as its round trip needs, at most MAX_MULES, and its share of the room's
//         reserver), it still returns at least MIN_NET_SHARE of its output. (It used to need a
//         single mule to carry it all: at RCL4 that meant only sources within ~76 ticks.)
//         Qualifying sources fill free FarMining slots nearest-first (slot order is what the 25M/50M
//         rampart caps cut), with one FarGuard flag per mined room. Manual flags are never
//         touched; auto flags are tracked in Memory.remoteAuto and removed when unplanned.
// Safety: player attacks register strikes per room (Memory.remoteStatus). A struck room
//         stops spawning for an escalating back-off, and only resumes after it has been
//         seen clear (observer, passing creep, or scout) once the back-off has passed.
const runtimeCache = require('runtime.cache');
const combatIntel = require('combat.intel');
const { getRoomAtOffset } = require('util.common');
const governor = require('runtime.cpuGovernor');
const maintenance = require('system.maintenance');

const ME = 'Montblanc';
const REMOTE_RANGE = 2;            // rooms (linear) from home considered for mining
const SOURCE_RATE = 10;            // 3000 energy / 300 ticks when reserved (claimers keep it so)
const MIN_NET_SHARE = 0.5;         // a source must keep at least this share of its output after creep costs
const MAX_MULES = 3;               // mules per source at most (CPU)
const MINER_COST = 1130;           // the far miner body (spawn.BuildFarCreeps)
const RESERVER_WORK = 450;         // ticks a reserver works at the controller (600 life less the trip)
const RESERVE_REFILL = 4000;       // reservation it can usefully add (a new one is sent below 1000; max 5000)
const COST = { carry: 50, move: 50, claim: 600 };
const cost = part => (typeof BODYPART_COST !== 'undefined' && BODYPART_COST[part]) || COST[part];
const TRIP_OVERHEAD = 6;           // withdraw, transfer and exit-tile ticks per round trip
const INTEL_REFRESH = 1000;        // re-record visible rooms at most this often
const INTEL_STALE = 20000;         // older intel needs a scout
const PLAN_INTERVAL = 2000;        // re-plan each home this often
const APPLY_INTERVAL = 50;         // reconcile flags this often
const TRIP_TTL = 50000;            // cached round trips (terrain paths barely change)
const PATHS_PER_PLAN = 10;         // new path searches per tick; a big first plan spreads out
const SLOTS = ['', '2', '3', '4', '5', '6', '7', '8', '9'];
// Disable system
const INCIDENT_GAP = 100;          // events closer than this are one incident
const BASE_BACKOFF = 1500;         // first strike: about one creep lifetime
const MAX_BACKOFF = 50000;
const STRIKE_DECAY = 30000;        // quiet this long: strikes reset
const MAX_STRIKES = 4;             // planner drops the room until strikes decay

function enabled(homeName) {
    if (Memory.settings && Memory.settings.autoRemote === false) return false;
    if (require('system.retire').retiring(homeName)) return false;
    return !Game.flags[homeName + 'NoAutoRemote'];
}

function mem(key) {
    return Memory[key] || (Memory[key] = {});
}

// ---------------------------------------------------------------- intel

function recordIntel(room) {
    if (room.controller && room.controller.my) return;
    const controller = room.controller;
    let towers = 0;
    if (controller && controller.owner && !controller.my) {
        towers = runtimeCache.find(room, FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } }).length;
    }
    mem('remoteIntel')[room.name] = {
        t: Game.time,
        s: runtimeCache.find(room, FIND_SOURCES).map(s => [s.id, s.pos.x, s.pos.y]),
        c: controller ? 1 : 0,
        o: controller && controller.owner ? controller.owner.username : undefined,
        r: controller && controller.reservation ? controller.reservation.username : undefined,
        k: runtimeCache.find(room, FIND_STRUCTURES, { filter: { structureType: STRUCTURE_KEEPER_LAIR } }).length ? 1 : 0,
        tw: towers,
    };
}

function refreshVisibleIntel() {
    const intel = mem('remoteIntel');
    for (const name in Game.rooms) {
        const record = intel[name];
        if (!record || Game.time - record.t >= INTEL_REFRESH) recordIntel(Game.rooms[name]);
    }
}

function homeRooms() {
    const homes = [];
    const seen = new Set();
    for (const name in Game.spawns) {
        const room = Game.spawns[name].room;
        if (seen.has(room.name)) continue;
        seen.add(room.name);
        if (room.controller && room.controller.my && room.storage) homes.push(room);
    }
    return homes;
}

function nearbyRooms(homeName) {
    const rooms = [];
    for (let dx = -REMOTE_RANGE; dx <= REMOTE_RANGE; dx++) {
        for (let dy = -REMOTE_RANGE; dy <= REMOTE_RANGE; dy++) {
            if (dx || dy) rooms.push(getRoomAtOffset(dx, dy, homeName));
        }
    }
    return rooms;
}

// ---------------------------------------------------------------- safety / disable

function status(roomName) {
    return mem('remoteStatus')[roomName];
}

function backoff(strikes) {
    return Math.min(BASE_BACKOFF * Math.pow(2, Math.max(0, strikes - 1)), MAX_BACKOFF);
}

// Register a hostile incident. Repeats within INCIDENT_GAP extend the current one; a new
// incident adds a strike and doubles the back-off.
function noteIncident(roomName, reason) {
    const all = mem('remoteStatus');
    let st = all[roomName];
    if (!st) st = all[roomName] = { strikes: 0, last: -Infinity, until: 0 };
    const continuing = Game.time - st.last < INCIDENT_GAP;
    if (!continuing) {
        if (Game.time - st.last > STRIKE_DECAY) st.strikes = 0;
        st.strikes++;
        const message = Game.time + ' : remote ' + roomName + ' disabled (' + reason + '), strike ' + st.strikes +
            ', ' + backoff(st.strikes) + ' ticks';
        Memory.LastNotification = message;
        console.log(message);
    }
    st.last = Game.time;
    st.reason = reason;
    st.until = Math.max(st.until, Game.time + backoff(st.strikes));
    delete st.clear;
}

// Disabled while backing off, and afterwards until the room has been seen clear.
function isDisabled(roomName) {
    const st = status(roomName);
    if (!st) return false;
    return Game.time < st.until || !(st.clear >= st.until);
}

function needsProbe(roomName) {
    const st = status(roomName);
    return !!st && Game.time >= st.until && !(st.clear >= st.until);
}

// Hostile signals in a visible room we mine (or plan to).
function inspectRoom(room) {
    const controller = room.controller;
    if (controller && controller.owner && controller.owner.username !== ME) {
        noteIncident(room.name, 'claimed by ' + controller.owner.username);
        return;
    }
    const intel = combatIntel.roomIntel(room);
    if (intel.players && intel.verdict !== 'win') {
        const owner = intel.threats.find(c => c.owner.username !== 'Invader').owner.username;
        noteIncident(room.name, 'attacked by ' + owner);
        return;
    }
    const st = status(room.name);
    if (st && Game.time >= st.until && !(st.clear >= st.until)) {
        st.clear = Game.time; // back-off over and seen clear: resume
        const message = Game.time + ' : remote ' + room.name + ' re-enabled after strike ' + st.strikes;
        Memory.LastNotification = message;
        console.log(message);
    }
    if (st && st.clear >= st.until && Game.time - st.last > STRIKE_DECAY) {
        delete mem('remoteStatus')[room.name];
    }
}

// Rooms we mine or plan to mine (any home), refreshed every APPLY_INTERVAL ticks.
let interest = { tick: -Infinity, rooms: new Set() };
function interestRooms() {
    if (Game.time - interest.tick < APPLY_INTERVAL) return interest.rooms;
    const rooms = new Set();
    for (const name in Game.flags) {
        if (name.includes('FarMining') || name.includes('FarGuard')) rooms.add(Game.flags[name].pos.roomName);
    }
    for (const home in Memory.remotePlan || {}) {
        for (const entry of Memory.remotePlan[home].list) rooms.add(entry.r);
    }
    for (const roomName in Memory.remoteStatus || {}) rooms.add(roomName);
    interest = { tick: Game.time, rooms };
    return rooms;
}

// ---------------------------------------------------------------- flag placement

// RoomPosition.createFlag throws in rooms without vision. Rooms waiting for a flag are queued
// here (heap; re-queued by the next applyPlan after a global reset) and get vision from the
// observer or the scout; run() places their flags on the first tick they are visible.
const pendingFlags = Object.create(null); // roomName -> Set(homeName)

function queueFlag(roomName, homeName) {
    (pendingFlags[roomName] || (pendingFlags[roomName] = new Set())).add(homeName);
}

function placeFlag(x, y, roomName, name, homeName) {
    if (!Game.rooms[roomName]) {
        queueFlag(roomName, homeName);
        return false;
    }
    return new RoomPosition(x, y, roomName).createFlag(name) === name;
}

function pendingRoomsFor(homeName) {
    const rooms = [];
    for (const roomName in pendingFlags) {
        if (pendingFlags[roomName].has(homeName)) rooms.push(roomName);
    }
    return rooms;
}

// ---------------------------------------------------------------- planning

// Hauling for one source: mules of up to 25 CARRY/MOVE pairs (as many as the home affords),
// together carrying one round trip of output plus 15%.
function haul(energyCapacity, trip) {
    const affordable = Math.max(1, Math.min(25, Math.floor(energyCapacity / (cost(CARRY) + cost(MOVE)))));
    const total = Math.ceil(SOURCE_RATE * trip * 1.15 / CARRY_CAPACITY);
    const mules = Math.max(1, Math.ceil(total / affordable));
    return { mules, pairs: Math.max(4, Math.min(affordable, Math.ceil(total / mules))) };
}

// Energy per tick a source returns after its creeps: the miner, its mules and its share of the
// room's reserver. A reserver (CLAIM/MOVE pairs as spawn.BuildFarCreeps builds them) adds a tick
// of reservation per CLAIM per working tick, so one covers CLAIM x RESERVER_WORK ticks (up to the
// refill window) before the next is due: about 1.4 energy/tick per room at any size.
function netGain(energyCapacity, trip, sourcesInRoom) {
    const h = haul(energyCapacity, trip);
    const pair = cost(CLAIM) + cost(MOVE);
    const claims = Math.max(1, Math.min(8, Math.floor(energyCapacity / pair)));
    const reserverPerTick = claims * pair / Math.min(RESERVE_REFILL + RESERVER_WORK, claims * RESERVER_WORK);
    const life = typeof CREEP_LIFE_TIME === 'number' ? CREEP_LIFE_TIME : 1500;
    const spend = MINER_COST / life + h.mules * h.pairs * (cost(CARRY) + cost(MOVE)) / life +
        reserverPerTick / Math.max(1, sourcesInRoom);
    return SOURCE_RATE - spend;
}

function worthMining(energyCapacity, trip, sourcesInRoom) {
    return haul(energyCapacity, trip).mules <= MAX_MULES && netGain(energyCapacity, trip, sourcesInRoom) >= SOURCE_RATE * MIN_NET_SHARE;
}

function muleCapacity(energyCapacity) {
    // Mirrors getMuleBuild in spawn.BuildFarCreeps: CARRY/MOVE pairs only (max 25).
    const pairs = Math.max(0, Math.min(25, Math.floor(energyCapacity / 100)));
    return pairs * CARRY_CAPACITY;
}

function eligibleRoom(roomName, intel, homeName, homeStatus) {
    if (!intel || !intel.c || !intel.s.length) return false;
    if (intel.o) return false;                                   // owned by anyone (us included: that's a home)
    if (intel.r && intel.r !== ME && intel.r !== 'Invader') return false; // reserved by a player
    if (intel.k || intel.tw) return false;                       // keeper rooms and towers need other roles
    if (Memory.blockedRooms && Memory.blockedRooms.indexOf(roomName) !== -1) return false;
    const st = status(roomName);
    if (st && st.strikes >= MAX_STRIKES) return false;
    const roomStatus = Game.map.getRoomStatus(roomName);
    return !roomStatus || roomStatus.status === homeStatus;
}

// Round trip for a far mule: loaded leg pays swamp fatigue (1 MOVE per CARRY), empty leg doesn't.
function roundTrip(origin, target) {
    const result = PathFinder.search(origin, { pos: target, range: 1 }, {
        plainCost: 1,
        swampCost: 5,
        maxRooms: 2 * REMOTE_RANGE + 1,
        maxOps: 8000,
        roomCallback: roomName => {
            const intel = Memory.remoteIntel && Memory.remoteIntel[roomName];
            if (intel && intel.o && intel.o !== ME) return false;
            if (Memory.blockedRooms && Memory.blockedRooms.indexOf(roomName) !== -1) return false;
            return undefined;
        },
    });
    if (result.incomplete) return undefined;
    return result.cost + result.path.length + TRIP_OVERHEAD;
}

function flagKey(roomName, x, y) {
    return roomName + ':' + x + ':' + y;
}

function planHome(home) {
    const plans = mem('remotePlan');
    const intel = mem('remoteIntel');
    const homeStatus = (Game.map.getRoomStatus(home.name) || {}).status;

    // Sources another home already mines (planned or manually flagged) stay theirs.
    const taken = new Set();
    for (const other in plans) {
        if (other === home.name) continue;
        for (const entry of plans[other].list) taken.add(entry.id);
    }
    for (const name in Game.flags) {
        if (name.includes('FarMining') && !name.startsWith(home.name)) {
            const pos = Game.flags[name].pos;
            taken.add(flagKey(pos.roomName, pos.x, pos.y));
        }
    }

    const trips = mem('remoteTrips')[home.name] || (Memory.remoteTrips[home.name] = {});
    let searches = 0;
    let complete = true;
    const list = [];
    for (const roomName of nearbyRooms(home.name)) {
        if (!eligibleRoom(roomName, intel[roomName], home.name, homeStatus)) continue;
        for (const [id, x, y] of intel[roomName].s) {
            if (taken.has(id) || taken.has(flagKey(roomName, x, y))) continue;
            let cached = trips[id];
            if (!cached || Game.time - cached.t > TRIP_TTL) {
                if (searches >= PATHS_PER_PLAN) {
                    complete = false;
                    continue;
                }
                searches++;
                // null = unreachable; cached too so it is not searched again every plan.
                cached = trips[id] = { t: Game.time, trip: roundTrip(home.storage.pos, new RoomPosition(x, y, roomName)) || null };
            }
            const trip = cached.trip === null ? undefined : cached.trip;
            if (trip === undefined || !worthMining(home.energyCapacityAvailable, trip, intel[roomName].s.length)) continue;
            list.push({ r: roomName, id, x, y, trip });
        }
    }
    // Nearest first; ties broken by room then id so plans (and flag slots) stay stable.
    list.sort((a, b) => a.trip - b.trip || (a.r < b.r ? -1 : a.r > b.r ? 1 : 0) || (a.id < b.id ? -1 : 1));
    // Unfinished (search cap hit): keep what we have and continue on a later tick.
    plans[home.name] = { t: complete ? Game.time : Game.time - PLAN_INTERVAL + 5, list: list.slice(0, SLOTS.length) };
}

// Make flags match the plan: drop auto flags no longer planned, fill free slots nearest-first.
// Removal and creation of the same name cannot happen in one tick, so this runs repeatedly.
function applyPlan(home) {
    const plan = Memory.remotePlan && Memory.remotePlan[home.name];
    if (!plan) return;
    const auto = mem('remoteAuto')[home.name] || (Memory.remoteAuto[home.name] = {});
    const plannedSources = new Set(plan.list.map(entry => entry.id));
    const plannedRooms = new Set(plan.list.map(entry => entry.r));

    for (const flagName in auto) {
        const flag = Game.flags[flagName];
        const key = auto[flagName];
        if (!flag) {
            delete auto[flagName]; // removed by hand (or renamed): forget it
        } else if (key.startsWith('room:') ? !plannedRooms.has(key.slice(5)) : !plannedSources.has(key)) {
            flag.remove();
            delete auto[flagName];
        }
    }

    // What this home already covers, including manual and legacy timed-out (";") flags.
    const covered = new Set();
    const guarded = new Set();
    for (const name in Game.flags) {
        if (!name.startsWith(home.name)) continue;
        const pos = Game.flags[name].pos;
        if (name.startsWith(home.name + 'FarMining')) covered.add(flagKey(pos.roomName, pos.x, pos.y));
        else if (name.startsWith(home.name + 'FarGuard')) guarded.add(pos.roomName);
    }
    const freeSlot = prefix => {
        for (const suffix of SLOTS) {
            const name = home.name + prefix + suffix;
            if (!Game.flags[name] && !auto[name]) return name;
        }
        return undefined;
    };

    for (const entry of plan.list) {
        if (!covered.has(flagKey(entry.r, entry.x, entry.y))) {
            const name = freeSlot('FarMining');
            if (!name) break;
            if (placeFlag(entry.x, entry.y, entry.r, name, home.name)) {
                auto[name] = entry.id;
                covered.add(flagKey(entry.r, entry.x, entry.y));
            }
        }
        if (!guarded.has(entry.r)) {
            const name = freeSlot('FarGuard');
            if (name && placeFlag(25, 25, entry.r, name, home.name)) {
                auto[name] = 'room:' + entry.r;
                guarded.add(entry.r);
            }
        }
    }
}

// Round trip (ticks) the planner computed for the source under this flag, if it planned it.
function tripFor(homeName, flag) {
    const plan = Memory.remotePlan && Memory.remotePlan[homeName];
    if (!plan || !flag) return undefined;
    const entry = plan.list.find(e => e.r === flag.pos.roomName && e.x === flag.pos.x && e.y === flag.pos.y);
    return entry ? entry.trip : undefined;
}

// Mules for the source under this flag: { mules, pairs } from its planned round trip; a manual
// (unplanned) flag gets one max-size mule.
function haulFor(home, flag) {
    const trip = tripFor(home.name, flag);
    if (!trip) return { mules: 1, pairs: Math.max(1, Math.min(25, Math.floor(home.energyCapacityAvailable / (cost(CARRY) + cost(MOVE))))) };
    return haul(home.energyCapacityAvailable, trip);
}

// ---------------------------------------------------------------- scouting

// Rooms a home should look at: missing/stale intel, or disabled rooms due a safety check.
function scoutTargets(homeName) {
    const intel = Memory.remoteIntel || {};
    const targets = [];
    for (const roomName of nearbyRooms(homeName)) {
        const record = intel[roomName];
        const unknown = !record || Game.time - record.t >= INTEL_STALE;
        const awaitingFlag = pendingFlags[roomName] && pendingFlags[roomName].has(homeName);
        if ((unknown && !(record && record.o && record.o !== ME)) || needsProbe(roomName) || awaitingFlag) targets.push(roomName);
    }
    targets.sort((a, b) => Game.map.getRoomLinearDistance(homeName, a) - Game.map.getRoomLinearDistance(homeName, b));
    return targets;
}

function hasObserver(homeName) {
    return !!(Memory.observerList && Memory.observerList[homeName] && Memory.observerList[homeName].length);
}

// Called from spawning. Homes with an observer never need scouts.
function needsScout(home) {
    if (!home.storage || hasObserver(home.name) || !enabled(home.name) || !governor.allows('scouting') || !maintenance.remoteMiningWanted(home)) return false;
    return scoutTargets(home.name).length > 0;
}

// Observer homes: point the observer at a room due a safety check before normal scanning.
function observeRequest(homeName) {
    if (!enabled(homeName)) return undefined;
    for (const roomName of nearbyRooms(homeName)) {
        if (needsProbe(roomName)) return roomName;
    }
    const awaiting = pendingRoomsFor(homeName);
    return awaiting.length ? awaiting[0] : undefined;
}

// ---------------------------------------------------------------- tick

function run() {
    if (Game.time % 100 === 0) refreshVisibleIntel();

    for (const roomName in pendingFlags) {
        if (!Game.rooms[roomName]) continue;
        const homes = pendingFlags[roomName];
        delete pendingFlags[roomName];
        for (const homeName of homes) {
            const home = Game.rooms[homeName];
            if (home && home.controller && home.controller.my) applyPlan(home);
        }
    }

    for (const roomName of interestRooms()) {
        const room = Game.rooms[roomName];
        if (room) inspectRoom(room);
    }

    if (!governor.allows('planning')) return;
    const homes = homeRooms();
    const plans = mem('remotePlan');
    let planned = false;
    for (let i = 0; i < homes.length; i++) {
        const home = homes[i];
        // Established rooms that don't need remote income skip the (path-finding) planning.
        if (!enabled(home.name) || !maintenance.remoteMiningWanted(home)) continue;
        // One (path-finding) plan per tick at most; plans are staggered across homes.
        if (!planned && (!plans[home.name] || Game.time - plans[home.name].t >= PLAN_INTERVAL)) {
            planHome(home);
            planned = true;
            applyPlan(home);
        } else if ((Game.time + i) % APPLY_INTERVAL === 0) {
            applyPlan(home);
        }
    }
}

module.exports = {
    run, recordIntel, noteIncident, isDisabled, needsProbe, needsScout, scoutTargets, observeRequest,
    planHome, applyPlan, roundTrip, muleCapacity, inspectRoom, tripFor, SOURCE_RATE, pendingRoomsFor,
    haul, haulFor, netGain, worthMining,
};
