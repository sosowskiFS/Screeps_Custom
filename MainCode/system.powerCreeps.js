// system.powerCreeps — automatic power creep assignment, cross-shard moves and creation.
//
// Replaces the manual SpawnOperator / RoomOperator routine (the flag still works as an override).
// Every RUN_EVERY ticks on each shard:
//   1. Assignments are cleaned up. Power creep memory is kept per shard, so a home recorded on a
//      shard is only trusted while the creep is spawned on this shard or unspawned, and its home
//      is a room of ours with a power spawn that is not retiring.
//   2. A creep spawned here without a valid home is given a room here that needs one (it walks
//      there: creep.baseOp), or, with none needing one, suicides so another shard can use it.
//   3. Assigned unspawned creeps respawn at their home's power spawn once their cooldown is over.
//   4. Free creeps (unspawned, not reserved by any shard, fully built, cooldown over) go to the
//      rooms with a power spawn but no creep, shard by shard in PRIORITY order: shardX, shard2,
//      shard1 (other shards last). Within a shard, rooms in the order they come up.
//      Shards run their passes at different moments, so this is two-phase: a shard first
//      publishes a claim (creep -> room) and only spawns on a later pass, CONFIRM_MS x its rank
//      after claiming, if no higher-priority shard has claimed the same creep meanwhile. A shard
//      only claims once every higher-priority shard has either published fresh state or been
//      seen silent for STALE_MS (a shard with no entry yet may simply not have run its pass).
//   5. When shardX has rooms waiting and the free creeps (cooldowns included) don't cover them,
//      shard1 gives up creeps first, then shard2 once shard1 has none: they are unassigned and
//      suicided, become free after their spawn cooldown and then spawn on shardX.
//   6. CREATOR_SHARD creates a new operator when the account has enough free power levels for
//      a complete one (1 + the levels in BUILD) and upgrades it to BUILD, one level per tick.
// Shards coordinate through InterShardMemory (key 'pc'): { t: Date.now(), need, reserved: [names],
// claims: [names], assigned }. A shard is treated as not running only after this shard has seen
// it without a fresh entry for STALE_MS (Memory.pcSilent).
const PRIORITY = ['shardX', 'shard2', 'shard1'];
const RELEASE_ORDER = ['shard1', 'shard2'];          // who gives creeps up to shardX first
const TOP_SHARD = 'shardX';
const CREATOR_SHARD = 'shard2';
const RUN_EVERY = 100;
const STALE_MS = 30 * 60 * 1000;
const RELEASE_GAP_MS = 20 * 60 * 1000;               // between releases (lets the others catch up)
const CONFIRM_MS = 5 * 60 * 1000;                    // x (priority rank + 1): wait before spawning a claim
const CLAIM_TTL_MS = 60 * 60 * 1000;
// The build in use: GENERATE_OPS 4, OPERATE_TOWER 3, OPERATE_LAB 5, OPERATE_EXTENSION 5,
// REGEN_SOURCE 5, OPERATE_POWER 3 (25 levels).
const BUILD = [['PWR_GENERATE_OPS', 4], ['PWR_OPERATE_TOWER', 3], ['PWR_OPERATE_LAB', 5], ['PWR_OPERATE_EXTENSION', 5],
    ['PWR_REGEN_SOURCE', 5], ['PWR_OPERATE_POWER', 3]];

function build() {
    return BUILD.map(([key, level]) => [global[key], level]);
}

function buildLevels() {
    return BUILD.reduce((sum, [, level]) => sum + level, 0);
}

function priorityOf(shard) {
    const i = PRIORITY.indexOf(shard);
    return i === -1 ? PRIORITY.length : i;
}

// ---------------------------------------------------------------- inter-shard state

// No InterShardMemory (private servers, tests): a single shard, nothing to coordinate.
function hasISM() {
    return typeof InterShardMemory !== 'undefined';
}

function readShard(shard) {
    if (!hasISM()) return null;
    try {
        const raw = shard === Game.shard.name ? InterShardMemory.getLocal() : InterShardMemory.getRemote(shard);
        const data = raw ? JSON.parse(raw) : {};
        return data.pc && Date.now() - data.pc.t < STALE_MS ? data.pc : null;
    } catch (e) {
        return null;
    }
}

function writeLocal(entry) {
    if (!hasISM()) return;
    let data = {};
    try {
        data = JSON.parse(InterShardMemory.getLocal() || '{}') || {};
    } catch (e) {
        data = {};
    }
    data.pc = entry;
    InterShardMemory.setLocal(JSON.stringify(data));
}

function otherShards() {
    const out = {};
    if (!Memory.pcSilent) Memory.pcSilent = {};
    for (const shard of PRIORITY.concat(Object.keys(Game.cpu.shardLimits || {}))) {
        if (shard === Game.shard.name || out[shard] !== undefined) continue;
        out[shard] = readShard(shard);
        if (out[shard]) delete Memory.pcSilent[shard];
        else if (!Memory.pcSilent[shard]) Memory.pcSilent[shard] = Date.now();
    }
    return out;
}

// Every higher-priority shard has either told us its state or been silent long enough to count
// as not running. Until then a lower shard does not claim free creeps.
function settled(others, here) {
    for (const shard in others) {
        if (priorityOf(shard) >= priorityOf(here) || others[shard]) continue;
        if (Date.now() - (Memory.pcSilent[shard] || Date.now()) < STALE_MS) return false;
    }
    return true;
}

// ---------------------------------------------------------------- rooms

function retiring(roomName) {
    return require('system.retire').retiring(roomName);
}

// Our rooms with a power spawn, in the order they come up: { name: powerSpawn | null }. A room
// whose power spawn is being rebuilt (base migration: only a site) stays a valid home (null),
// so its operator is not given up for a few ticks without the structure.
function powerRooms() {
    const out = {};
    for (const name in Game.rooms) {
        const room = Game.rooms[name];
        if (!room.controller || !room.controller.my || retiring(name)) continue;
        const ps = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_POWER_SPAWN } })[0];
        if (ps) out[name] = ps;
        else if (room.find(FIND_MY_CONSTRUCTION_SITES, { filter: { structureType: STRUCTURE_POWER_SPAWN } }).length) out[name] = null;
    }
    return out;
}

function memOf(name) {
    if (!Memory.powerCreeps) Memory.powerCreeps = {};
    return Memory.powerCreeps[name] || (Memory.powerCreeps[name] = {});
}

function unspawned(pc) {
    return !pc.shard;
}

function ready(pc) {
    return unspawned(pc) && (!pc.spawnCooldownTime || pc.spawnCooldownTime <= Date.now());
}

function complete(pc) {
    return pc.className === POWER_CLASS.OPERATOR && pc.level >= buildLevels();
}

// ---------------------------------------------------------------- the pass

function assign(pc, room) {
    const mem = memOf(pc.name);
    mem.homeRoom = room;
    mem.priority = 'baseOp';
    mem.initialSetup = false;   // creep.baseOp re-runs its room setup on arrival
}

function unassign(name) {
    const mem = Memory.powerCreeps && Memory.powerCreeps[name];
    if (!mem) return;
    delete mem.homeRoom;
    delete mem.jobFocus;
    mem.initialSetup = false;
}

function run() {
    if (Game.time % RUN_EVERY !== 0) return;
    const here = Game.shard.name;
    const rooms = powerRooms();
    const others = otherShards();
    const reservedElsewhere = new Map();   // name -> shard
    for (const shard in others) {
        for (const name of (others[shard] && others[shard].reserved) || []) reservedElsewhere.set(name, shard);
    }

    // 1. Clean assignments; 3. respawn assigned creeps.
    const homes = new Set();
    const reserved = [];
    let assigned = 0;
    for (const name in Game.powerCreeps) {
        const pc = Game.powerCreeps[name];
        const mem = Memory.powerCreeps && Memory.powerCreeps[name];
        if (!mem || !mem.homeRoom) continue;
        const elsewhere = pc.shard && pc.shard !== here;
        const yielded = unspawned(pc) && reservedElsewhere.has(name) && priorityOf(reservedElsewhere.get(name)) < priorityOf(here);
        if (elsewhere || yielded || !(mem.homeRoom in rooms) || homes.has(mem.homeRoom)) {
            unassign(name);
            continue;
        }
        homes.add(mem.homeRoom);
        assigned++;
        if (unspawned(pc)) {
            reserved.push(name);
            if (ready(pc) && rooms[mem.homeRoom] && pc.spawn(rooms[mem.homeRoom]) === OK) mem.priority = 'baseOp';
        }
    }
    const needing = Object.keys(rooms).filter(r => rooms[r] && !homes.has(r));

    // 2. Spawned here without a home: a room here that needs one; else, if another shard is
    // waiting for one, free it up (suicide: it can spawn there after its cooldown).
    const waitingElsewhere = Object.keys(others).some(s => others[s] && others[s].need > 0);
    for (const name in Game.powerCreeps) {
        const pc = Game.powerCreeps[name];
        if (pc.shard !== here) continue;
        const mem = memOf(name);
        if (mem.homeRoom) continue;
        if (needing.length) {
            assign(pc, needing.shift());
            assigned++;
        } else if (waitingElsewhere) {
            pc.suicide();
            console.log('[powerCreeps] ' + name + ' has no room here; freed for another shard');
        }
    }

    // 4. Free creeps by shard priority.
    const building = Memory.pcBuild;
    const isFree = pc => unspawned(pc) && complete(pc) && pc.name !== building && !reservedElsewhere.has(pc.name) &&
        !reserved.includes(pc.name);
    const free = Object.keys(Game.powerCreeps).sort().map(n => Game.powerCreeps[n]).filter(isFree);
    const claimedHigher = new Set();
    for (const shard in others) {
        if (!others[shard] || priorityOf(shard) >= priorityOf(here)) continue;
        for (const name of others[shard].claims || []) claimedHigher.add(name);
    }
    const claims = Memory.pcClaims || (Memory.pcClaims = {});
    // Drop claims that no longer hold; spawn the ones that have waited long enough.
    const confirmAfter = CONFIRM_MS * (priorityOf(here) + 1);
    for (const name in claims) {
        const claim = claims[name];
        const pc = Game.powerCreeps[name];
        const stillNeeded = needing.includes(claim.r);
        if (!pc || !isFree(pc) || claimedHigher.has(name) || !stillNeeded || Date.now() - claim.at > CLAIM_TTL_MS) {
            delete claims[name];
            continue;
        }
        if (Date.now() - claim.at < confirmAfter || !ready(pc)) continue;
        if (pc.spawn(rooms[claim.r]) === OK) {
            needing.splice(needing.indexOf(claim.r), 1);
            assign(pc, claim.r);
            assigned++;
            delete claims[name];
            console.log('[powerCreeps] ' + name + ' spawning in ' + claim.r);
        }
    }
    // New claims: free creeps in shard priority order, once the higher shards are settled.
    if (settled(others, here)) {
        const available = free.filter(ready).filter(pc => !claimedHigher.has(pc.name));
        const demand = [];
        for (const shard in others) {
            const entry = others[shard];
            if (entry && entry.need > 0) demand.push([shard, Math.max(0, entry.need - (entry.claims || []).length)]);
        }
        const mine = Object.keys(claims);
        const open = needing.filter(r => !mine.some(n => claims[n].r === r));
        demand.push([here, open.length + mine.length]);
        demand.sort((a, b) => priorityOf(a[0]) - priorityOf(b[0]));
        let offset = 0;
        for (const [shard, need] of demand) {
            const slice = available.slice(offset, offset + need);
            offset += need;
            if (shard !== here) continue;
            for (const pc of slice) {
                if (claims[pc.name] || !open.length) continue;
                claims[pc.name] = { r: open.shift(), at: Date.now() };
                console.log('[powerCreeps] claimed ' + pc.name + ' for ' + claims[pc.name].r + '; spawning after ' + (confirmAfter / 60000) + ' min if no higher shard claims it');
            }
        }
    }

    // 5. shardX waiting: lower shards give creeps up (shard1 first).
    const top = others[TOP_SHARD];
    if (here !== TOP_SHARD && top && top.need > 0 && RELEASE_ORDER.includes(here)) {
        const unmet = top.need - free.length;
        const earlier = RELEASE_ORDER.slice(0, RELEASE_ORDER.indexOf(here)).some(s => others[s] && others[s].assigned > 0);
        if (unmet > 0 && !earlier && Date.now() - (Memory.pcReleased || 0) > RELEASE_GAP_MS) {
            let released = 0;
            for (const name in Game.powerCreeps) {
                if (released >= unmet) break;
                const mem = Memory.powerCreeps && Memory.powerCreeps[name];
                const pc = Game.powerCreeps[name];
                if (!mem || !mem.homeRoom || (pc.shard && pc.shard !== here)) continue;
                unassign(name);
                const i = reserved.indexOf(name);
                if (i !== -1) reserved.splice(i, 1);
                if (pc.shard === here) pc.suicide();
                assigned--;
                released++;
                console.log('[powerCreeps] released ' + name + ' for ' + TOP_SHARD);
            }
            if (released) Memory.pcReleased = Date.now();
        }
    }

    // 6. New creeps.
    if (here === CREATOR_SHARD) createIfAffordable();
    if (building) reserved.push(building);
    writeLocal({ t: Date.now(), need: needing.length, reserved, claims: Object.keys(Memory.pcClaims || {}), assigned });
}

// ---------------------------------------------------------------- creation

function freeLevels() {
    if (!Game.gpl) return 0;
    let used = 0;
    for (const name in Game.powerCreeps) used += Game.powerCreeps[name].level + 1;
    return Game.gpl.level - used;
}

function createIfAffordable() {
    if (Memory.pcBuild || freeLevels() < 1 + buildLevels()) return false;
    const name = 'Op' + Game.time.toString(36);
    if (PowerCreep.create(name, POWER_CLASS.OPERATOR) !== OK) return false;
    Memory.pcBuild = name;
    console.log('[powerCreeps] created ' + name + '; upgrading it to the standard build');
    return true;
}

// Next power to upgrade toward the build, or null when complete or nothing is allowed yet.
// A power's next level needs the creep's level to be at least POWER_INFO[power].level[current].
function nextUpgrade(powers, creepLevel, target = build(), info = POWER_INFO) {
    let best = null, bestReq = Infinity;
    for (const [power, want] of target) {
        const have = powers[power] ? powers[power].level : 0;
        if (have >= want) continue;
        const req = info[power].level[have];
        if (req <= creepLevel && req < bestReq) {
            best = power;
            bestReq = req;
        }
    }
    return best;
}

// Every tick on the creator shard: one upgrade for the creep being built.
function upgradeBuild() {
    const name = Memory.pcBuild;
    if (!name || Game.shard.name !== CREATOR_SHARD) return;
    const pc = Game.powerCreeps[name];
    if (!pc) return;   // created this tick: appears next tick
    const power = nextUpgrade(pc.powers || {}, pc.level);
    if (power === null) {
        if (pc.level >= buildLevels()) console.log('[powerCreeps] ' + name + ' is complete');
        else console.log('[powerCreeps] ' + name + ': no allowed upgrade toward the build (level ' + pc.level + ')');
        delete Memory.pcBuild;
        return;
    }
    if (freeLevels() >= 1) pc.upgrade(power);
}

function tick() {
    upgradeBuild();
    run();
}

module.exports = { run: tick, assignmentPass: run, nextUpgrade, freeLevels, createIfAffordable, unassign, powerRooms, buildLevels, PRIORITY };
