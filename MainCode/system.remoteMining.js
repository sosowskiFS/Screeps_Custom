// system.remoteMining — automatic remote mining: scouting, source selection and room safety.
//
// Scout:  from the moment a home has a storage, every room within REMOTE_RANGE (2) is looked at:
//         its observer if it has one, otherwise a 1-MOVE scout (50 energy). Each look is
//         summarised in Memory.remoteIntel (sources, owner, reservation, keeper lairs, hostile
//         towers). Rooms are looked at again when their intel gets old: free rooms after
//         INTEL_STALE, rooms another player reserved after RESCOUT_RESERVED, rooms another player
//         owns after RESCOUT_OWNED (they rarely change hands).
// Plan:   for each source in a free room, the round trip from the home's storage. A source is
//         worth mining when, after paying for the creeps that mine it (the miner, as many mules as
//         its round trip needs, at most MAX_MULES, and its share of the room's reserver), it still
//         returns at least MIN_NET_SHARE of its output. The plan (Memory.remotePlan[home].list,
//         nearest first) is the list of mining nodes: spawn.BuildFarCreeps staffs each node
//         directly and its creeps carry the node in memory (target()). No flags are placed any
//         more; flags this system placed before are removed and their creeps moved to their node.
//         Hand-placed FarMining/FarGuard flags still work as before, and their sources are left
//         to them.
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
const RESCOUT_RESERVED = 30000;    // a room another player reserved: looked at again this rarely
const RESCOUT_OWNED = 50000;       // a room another player owns: rarer still
const PLAN_INTERVAL = 2000;        // re-plan each home this often
const APPLY_INTERVAL = 50;         // retire old auto flags this often
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

// ---------------------------------------------------------------- nodes

// A plan entry is a node: { r: room, id: source id, x, y, trip }. Slot order (nearest first) is
// what the 25M/50M rampart caps cut: from the third node with a 50mCap flag, from the fifth with
// a 25mCap flag (spawn.BuildFarCreeps).
function nodes(homeName) {
    const plan = Memory.remotePlan && Memory.remotePlan[homeName];
    return plan ? plan.list : [];
}

// What a remote creep works for: its hand-placed flag, or its node. Either way an object with
// name, pos, room and remove(), as the roles used to get from Game.flags. Removing a node (the
// room was taken, or the miner was attacked) registers an incident: the room is backed off.
function target(creep) {
    const m = creep.memory;
    const flag = m.targetFlag && Game.flags[m.targetFlag];
    if (flag) return flag;
    const n = m.node;
    if (!n) return undefined;
    return {
        name: 'node:' + n.id, pos: new RoomPosition(n.x, n.y, n.r),
        get room() { return Game.rooms[n.r]; },
        remove() { noteIncident(n.r, 'mining stopped (' + creep.name + ')'); },
    };
}

// A node as a creep carries it.
function nodeRef(entry) {
    return { id: entry.id, r: entry.r, x: entry.x, y: entry.y, trip: entry.trip };
}
// A room's guard post (centre), for farGuard creeps sent to a node's room.
function guardRef(roomName) {
    return { id: 'room:' + roomName, r: roomName, x: 25, y: 25, guard: 1 };
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

    // Sources another home already mines, and any source under a hand-placed FarMining flag (this
    // home's too: the flag's creeps mine it), stay theirs. Old auto flags being retired don't count.
    const taken = new Set();
    for (const other in plans) {
        if (other === home.name) continue;
        for (const entry of plans[other].list) taken.add(entry.id);
    }
    const auto = Memory.remoteAuto || {};
    for (const name in Game.flags) {
        if (!name.includes('FarMining') || Object.values(auto).some(a => a[name] !== undefined)) continue;
        const pos = Game.flags[name].pos;
        taken.add(flagKey(pos.roomName, pos.x, pos.y));
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

// Flags this system used to place are retired: their creeps carry the node instead (so none is
// orphaned), then the flag goes. Hand-placed flags are never touched.
function applyPlan(home) {
    const auto = Memory.remoteAuto && Memory.remoteAuto[home.name];
    if (!auto) return;
    const byId = {};
    for (const entry of nodes(home.name)) byId[entry.id] = entry;
    for (const flagName of Object.keys(auto)) {
        const flag = Game.flags[flagName], key = auto[flagName];
        let ref = null;
        if (key.startsWith('room:')) ref = guardRef(key.slice(5));
        else if (byId[key]) ref = nodeRef(byId[key]);
        else if (flag) ref = { id: key, r: flag.pos.roomName, x: flag.pos.x, y: flag.pos.y };
        for (const name in Game.creeps) {
            const m = Game.creeps[name].memory;
            if (m.targetFlag !== flagName) continue;
            delete m.targetFlag;
            if (ref) m.node = ref;
        }
        if (flag) flag.remove();
        delete auto[flagName];
    }
    if (!Object.keys(auto).length) delete Memory.remoteAuto[home.name];
}

// Round trip (ticks) the planner computed for the source under this flag, if it planned it.
function tripFor(homeName, flag) {
    if (!flag) return undefined;
    const entry = nodes(homeName).find(e => e.r === flag.pos.roomName && e.x === flag.pos.x && e.y === flag.pos.y);
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

// Rooms a home should look at, nearest first: never seen, intel gone stale (rarer for rooms other
// players reserve or own), or disabled and due a safety check.
function rescoutAge(record) {
    if (record.o && record.o !== ME) return RESCOUT_OWNED;
    if (record.r && record.r !== ME && record.r !== 'Invader') return RESCOUT_RESERVED;
    return INTEL_STALE;
}
function scoutTargets(homeName) {
    const intel = Memory.remoteIntel || {};
    const targets = [];
    for (const roomName of nearbyRooms(homeName)) {
        if (!require('room.status').open(roomName)) continue;   // closed rooms cannot be entered
        const record = intel[roomName];
        if (!record || Game.time - record.t >= rescoutAge(record) || needsProbe(roomName)) targets.push(roomName);
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

// Observer homes: a room due a safety check first, then the nearest room due a look (the scout's
// list); otherwise the observer's normal sweep.
function observeRequest(homeName) {
    if (!enabled(homeName)) return undefined;
    for (const roomName of nearbyRooms(homeName)) {
        if (needsProbe(roomName)) return roomName;
    }
    return scoutTargets(homeName)[0];
}

// ---------------------------------------------------------------- tick

function run() {
    if (Game.time % 100 === 0) refreshVisibleIntel();

    for (const roomName of interestRooms()) {
        const room = Game.rooms[roomName];
        if (room) inspectRoom(room);
    }

    // Retire the flags this system used to place, for every home (also homes not mining now, so
    // no old flag outlives the switch to nodes); a home that is gone just loses its flags.
    if (Memory.remoteAuto && Game.time % APPLY_INTERVAL === 0) {
        for (const homeName of Object.keys(Memory.remoteAuto)) {
            const home = Game.rooms[homeName];
            if (home && home.controller && home.controller.my) {
                applyPlan(home);
                continue;
            }
            for (const flagName in Memory.remoteAuto[homeName]) if (Game.flags[flagName]) Game.flags[flagName].remove();
            delete Memory.remoteAuto[homeName];
        }
        if (!Object.keys(Memory.remoteAuto).length) delete Memory.remoteAuto;
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
    planHome, applyPlan, roundTrip, muleCapacity, inspectRoom, tripFor, SOURCE_RATE, nodes, target, nodeRef, guardRef, rescoutAge,
    haul, haulFor, netGain, worthMining,
};
