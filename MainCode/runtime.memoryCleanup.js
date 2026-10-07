// runtime.memoryCleanup — keep Memory lean (rebuildable caches live in heap: runtime.heapMemory). Memory is JSON-parsed every tick, so every kilobyte
// costs CPU on every tick.
//
// Every CLEAN_EVERY ticks (a few loops over Memory, no Game searches):
//   - top-level keys nothing reads any more (old base generator, old CPU counters, a misspelled
//     duplicate). Only keys the Nightmare branch either never reads or recreates before reading,
//     so a rollback stays safe.
//   - creep memory fields nothing reads (old lab worker / reserver flags), fields only some roles
//     read on the creeps of other roles (slimCreep; also applied at spawn), and travel data of
//     creeps that are not travelling (Traveler starts a fresh record on the next trip)
//   - expired entries other code only drops when it happens to read them: remote threats, remote
//     "outmatched" marks, cached remote round trips (and homes we no longer own)
//   - remote intel for rooms nobody has seen in a long time, or out of reach of every home
//   - empty Memory.rooms / Memory.flags entries
const CLEAN_EVERY = 1000;
const OBSOLETE_KEYS = ['genBestSourceID', 'genBestCenterCoords', 'genBestDirection', 'rampartQueue',
    'lastAutoBuildRegen', 'autoBuildRegenIndex', 'FarGuardNeeded', 'FarCreeps', 'hasFired', 'energyCap',
    'ClosedrampartList', 'averageUsedCPU', 'averageUsedSpawnCPU', 'averageUsedCreepCPU', 'totalTicksRecorded',
    'totalTicksSpawnRecorded', 'totalTicksCreepRecorded', 'roomCreeps', 'hostileEnterTicks', 'flagCount'];
const DEAD_CREEP_FIELDS = ['isMoving', 'movingOtherMineral2', 'resourceChecks', 'nextReservationCheck',
    'primaryFlag', 'backupFlag', 'nextResourceCheck', '_travel'];
// Fields only some roles read (everything else drops them at spawn and in the cleanup):
//   fromSpawn   defender, distributor, mule, repair, lab worker (it fills in as distributor)
//   terminalID  mule
//   lab1..10 / mineral1..10  nobody any more: the lab worker derives them each tick
const SPAWN_READERS = new Set(['defender', 'distributor', 'distributorNearDeath', 'mule', 'muleNearDeath',
    'repair', 'repairNearDeath', 'labWorker', 'labWorkerNearDeath']);
const TERMINAL_READERS = new Set(['mule', 'muleNearDeath']);
const LAB_FIELDS = [];
for (let i = 1; i <= 10; i++) LAB_FIELDS.push('lab' + i, 'mineral' + i);

// Drop fields this creep's role never reads. Returns how many were removed.
function slimCreep(memory) {
    let removed = 0;
    const role = memory.priority;
    const roles = [role, memory.previousPriority];
    if ('fromSpawn' in memory && !roles.some(r => SPAWN_READERS.has(r))) { delete memory.fromSpawn; removed++; }
    if ('terminalID' in memory && !roles.some(r => TERMINAL_READERS.has(r))) { delete memory.terminalID; removed++; }
    for (const field of LAB_FIELDS) {
        if (field in memory) { delete memory[field]; removed++; }
    }
    // false/null read exactly like a missing field everywhere (no code compares with === false).
    for (const field in memory) {
        if (memory[field] === false || memory[field] === null) { delete memory[field]; removed++; }
    }
    return removed;
}

const THREAT_MAX_AGE = 1500;        // combat.intel.remoteThreat default
const TRIP_TTL = 50000;             // system.remoteMining round-trip cache
const INTEL_MAX_AGE = 100000;       // 5x the scouting staleness: re-scouted if ever needed again
const INTEL_RANGE = 3;              // remote mining looks 2 rooms out; keep a margin

function ownedRooms() {
    const homes = new Set();
    for (const name in Game.spawns) homes.add(Game.spawns[name].room.name);
    return homes;
}

function emptyObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0;
}

function clean() {
    let removed = 0;
    for (const key of OBSOLETE_KEYS) {
        if (key in Memory) { delete Memory[key]; removed++; }
    }

    for (const name in Memory.creeps) {
        const m = Memory.creeps[name];
        if (!m) continue;
        for (const field of DEAD_CREEP_FIELDS) {
            if (field in m) { delete m[field]; removed++; }
        }
        removed += slimCreep(m);
        // Not travelling (no path left): the record is rebuilt on the next travelTo.
        if (m._trav && !m._trav.path) { delete m._trav; removed++; }
    }

    // Operators look their towers/spawns up each tick now.
    for (const name in Memory.powerCreeps) {
        const m = Memory.powerCreeps[name];
        if (!m) continue;
        for (const field of ['towerList', 'spawnList']) {
            if (field in m) { delete m[field]; removed++; }
        }
    }

    const threats = Memory.remoteThreat || {};
    for (const room in threats) {
        if (Game.time - threats[room].t > THREAT_MAX_AGE) { delete threats[room]; removed++; }
    }
    const outmatched = Memory.FarRoomsOutmatched || {};
    for (const room in outmatched) {
        if (outmatched[room] <= Game.time) { delete outmatched[room]; removed++; }
    }

    removed += require('system.reachability').prune();

    const homes = ownedRooms();
    const trips = Memory.remoteTrips || {};
    for (const home in trips) {
        if (!homes.has(home)) { delete trips[home]; removed++; continue; }
        for (const id in trips[home]) {
            if (Game.time - trips[home][id].t > TRIP_TTL) { delete trips[home][id]; removed++; }
        }
    }

    const intel = Memory.remoteIntel || {};
    for (const room in intel) {
        let near = false;
        for (const home of homes) {
            if (Game.map.getRoomLinearDistance(home, room) <= INTEL_RANGE) { near = true; break; }
        }
        if (!near || Game.time - intel[room].t > INTEL_MAX_AGE) { delete intel[room]; removed++; }
    }

    for (const bucket of ['rooms', 'flags']) {
        const table = Memory[bucket];
        if (!table) continue;
        for (const name in table) {
            if (emptyObject(table[name])) { delete table[name]; removed++; }
        }
    }
    return removed;
}

function run() {
    if (Game.time % CLEAN_EVERY === 0) clean();
}

module.exports = { run, clean, slimCreep, OBSOLETE_KEYS, DEAD_CREEP_FIELDS };
