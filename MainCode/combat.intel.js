// combat.intel — shared, per-tick combat assessment.
// Every creep and room is assessed at most once per tick; all callers reuse the result.
// Numbers come from visible bodies only: destroyed parts are ignored, boosts are applied.
const runtimeCache = require('runtime.cache');

// Creeps of these roles count toward our fighting strength in a room.
const COMBAT_ROLES = new Set([
    'farGuard', 'farGuardNearDeath', 'ranger', 'ranger2', 'PowerGuard', 'rangerNearDeath',
    'SKAttackGuard', 'SKAttackGuardNearDeath', 'SKHealGuard', 'SKHealGuardNearDeath',
    'highwayPatrol', 'highwayPatrolNearDeath', 'defender', 'roomGuard', 'claimHunter',
    'assattacker', 'assattackerNearDeath', 'assranger', 'assrangerNearDeath', 'asshealer', 'asshealerNearDeath',
    'powerAttack', 'powerAttackNearDeath', 'powerHeal', 'powerHealNearDeath',
    'harasser', 'harasserNearDeath',
]);
// One side must be this much faster at killing the other to call the fight won/lost.
const DECISIVE = 1.3;
// After danger is seen, keep treating an unseen room as dangerous for this long.
const DANGER_LINGER = 50;
// Average tower hit across typical engagement ranges (600 close, 150 far).
const TOWER_DPS = 300;
const MASS_FACTOR = [1, 1, 0.4, 0.1]; // rangedMassAttack damage by range, relative to rangedAttack

// Heap only: survives ticks, not global resets (rooms simply get re-scouted).
const dangerUntil = Object.create(null);

function tickCache() {
    const tick = runtimeCache.current();
    return tick.combat || (tick.combat = { creeps: Object.create(null), rooms: Object.create(null), ramparts: Object.create(null), scores: Object.create(null) });
}

function boostOf(part, action) {
    if (!part.boost || typeof BOOSTS === 'undefined' || !BOOSTS[part.type] || !BOOSTS[part.type][part.boost]) return 1;
    const value = BOOSTS[part.type][part.boost][action];
    return value === undefined ? 1 : value;
}

// Damage/heal output and effective HP of one creep this tick.
function assess(creep) {
    const cache = tickCache().creeps;
    if (cache[creep.id]) return cache[creep.id];
    const stats = { melee: 0, ranged: 0, heal: 0, rangedHeal: 0, ehp: 0, move: 0, parts: 0, dismantle: 0 };
    for (const part of creep.body) {
        if (part.hits <= 0) continue; // destroyed parts do nothing
        stats.parts++;
        switch (part.type) {
            case ATTACK: stats.melee += 30 * boostOf(part, 'attack'); break;
            case RANGED_ATTACK: stats.ranged += 10 * boostOf(part, 'rangedAttack'); break;
            case HEAL:
                stats.heal += 12 * boostOf(part, 'heal');
                stats.rangedHeal += 4 * boostOf(part, 'rangedHeal');
                break;
            case MOVE: stats.move++; break;
            case WORK: stats.dismantle += 50 * boostOf(part, 'dismantle'); break;
        }
        // Boosted TOUGH takes only `damage` (0.3–0.7) of each hit while it survives.
        stats.ehp += part.type === TOUGH ? part.hits / boostOf(part, 'damage') : part.hits;
    }
    stats.dps = stats.melee + stats.ranged;
    stats.combat = stats.dps > 0 || stats.heal > 0;
    cache[creep.id] = stats;
    return stats;
}

function sideTotals(creeps) {
    const total = { dps: 0, heal: 0, ehp: 0, count: creeps.length };
    for (const creep of creeps) {
        const stats = assess(creep);
        total.dps += stats.dps;
        total.heal += stats.heal;
        total.ehp += stats.ehp;
    }
    return total;
}

function hostileTowerDps(room) {
    const controller = room.controller;
    if (!controller || !controller.owner || controller.my || Memory.whiteList.includes(controller.owner.username)) return 0;
    if (controller.safeMode) return 0;
    let dps = 0;
    for (const tower of runtimeCache.find(room, FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } })) {
        if (tower.store && tower.store[RESOURCE_ENERGY] >= 10) dps += TOWER_DPS;
    }
    return dps;
}

// Our towers fight for us at home.
function ownTowerDps(room) {
    if (!room.controller || !room.controller.my) return 0;
    let dps = 0;
    for (const tower of runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } })) {
        if (tower.store && tower.store[RESOURCE_ENERGY] >= 10) dps += TOWER_DPS;
    }
    return dps;
}

// Lanchester-style estimate: ticks for each side to grind down the other's total effective HP.
function verdictFor(us, them) {
    if (them.dps <= 0 && them.heal <= 0) return 'win';
    const ourNet = us.dps - them.heal;
    const theirNet = them.dps - us.heal;
    if (ourNet <= 0 && theirNet <= 0) return 'even';
    if (ourNet <= 0) return 'lose';
    if (theirNet <= 0) return 'win';
    const timeToKillThem = them.ehp / ourNet;
    const timeToKillUs = us.ehp / theirNet;
    if (timeToKillThem * DECISIVE <= timeToKillUs) return 'win';
    if (timeToKillUs * DECISIVE <= timeToKillThem) return 'lose';
    return 'even';
}

const QUIET = Object.freeze({ hostiles: [], threats: [], friends: [], them: { dps: 0, heal: 0, ehp: 0, count: 0 },
    us: { dps: 0, heal: 0, ehp: 0, count: 0 }, verdict: 'none', players: false });

// Room-level picture: hostiles, which of them can fight, our fighters, both sides' totals and a verdict.
// Source Keepers are excluded; they are handled by the SK roles.
function roomIntel(room) {
    const cache = tickCache().rooms;
    if (cache[room.name]) return cache[room.name];
    const hostiles = runtimeCache.find(room, FIND_HOSTILE_CREEPS, {
        filter: c => !Memory.whiteList.includes(c.owner.username) && c.owner.username !== 'Source Keeper'
    });
    if (!hostiles.length) {
        const towerDps = hostileTowerDps(room);
        if (!towerDps) return (cache[room.name] = Object.assign({ room: room.name }, QUIET));
    }
    // At home a dismantler is a threat too: WORK takes ramparts down 50 hits a part a tick (x4 boosted),
    // though it deals no damage to creeps. Elsewhere a creep with WORK is as likely a harvester.
    const home = !!(room.controller && room.controller.my);
    const threats = hostiles.filter(c => assess(c).combat || (home && assess(c).dismantle > 0));
    const friends = runtimeCache.find(room, FIND_MY_CREEPS, { filter: c => !c.spawning && COMBAT_ROLES.has(c.memory.priority) });
    const them = sideTotals(threats);
    them.dps += hostileTowerDps(room);
    const us = sideTotals(friends);
    us.dps += ownTowerDps(room);
    const intel = {
        room: room.name, hostiles, threats, friends, them, us,
        verdict: threats.length || them.dps ? verdictFor(us, them) : 'win',
        players: threats.some(c => c.owner.username !== 'Invader'),
    };
    if (threats.length && intel.verdict !== 'win') markDanger(room);
    if (threats.length && !(room.controller && room.controller.my)) recordThreat(room.name, them, intel.players);
    cache[room.name] = intel;
    return intel;
}

function markDanger(room) {
    dangerUntil[room.name] = Game.time + DANGER_LINGER;
    // Same signal the guard spawner already watches for remote rooms.
    if (!(room.controller && room.controller.my) && Memory.FarRoomsUnderAttack && Memory.FarRoomsUnderAttack.indexOf(room.name) === -1) {
        Memory.FarRoomsUnderAttack.push(room.name);
    }
}

// Last enemy force seen in a room we don't own: { d: dps, h: heal, e: effective HP, p: players, t }.
// Guards for that room are sized from it.
function recordThreat(roomName, them, players) {
    if (!Memory.remoteThreat) Memory.remoteThreat = {};
    const previous = Memory.remoteThreat[roomName];
    // Keep the strongest force seen during an ongoing incident (enemies leave and return).
    const keep = previous && Game.time - previous.t < 300 && previous.d + previous.h > them.dps + them.heal;
    Memory.remoteThreat[roomName] = keep ? Object.assign(previous, { t: Game.time }) :
        { d: Math.round(them.dps), h: Math.round(them.heal), e: Math.round(them.ehp), p: players ? 1 : 0, t: Game.time };
}

function remoteThreat(roomName, maxAge = 1500) {
    const threat = Memory.remoteThreat && Memory.remoteThreat[roomName];
    if (!threat) return undefined;
    if (Game.time - threat.t > maxAge) {
        delete Memory.remoteThreat[roomName];
        return undefined;
    }
    return threat;
}

// Unwinnable fight in this room: let the spawner send a second guard for a while.
function markOutmatched(roomName) {
    if (!Memory.FarRoomsOutmatched) Memory.FarRoomsOutmatched = {};
    Memory.FarRoomsOutmatched[roomName] = Game.time + 1500;
}

function isOutmatched(roomName) {
    const until = Memory.FarRoomsOutmatched && Memory.FarRoomsOutmatched[roomName];
    if (until === undefined) return false;
    if (until <= Game.time) {
        delete Memory.FarRoomsOutmatched[roomName];
        return false;
    }
    return true;
}

// Dangerous = enemy fighters our forces there cannot clearly beat. Unseen rooms use the last sighting.
function isDangerous(roomName) {
    const room = Game.rooms[roomName];
    if (room) {
        const intel = roomIntel(room);
        return intel.threats.length > 0 && intel.verdict !== 'win';
    }
    return (dangerUntil[roomName] || 0) > Game.time;
}

function onRampart(creep) {
    const cache = tickCache().ramparts;
    if (cache[creep.id] === undefined) {
        cache[creep.id] = creep.pos.lookFor(LOOK_STRUCTURES).some(s => s.structureType === STRUCTURE_RAMPART);
    }
    return cache[creep.id];
}

// Healing the target can receive this tick from its own side.
function supportHealing(target, intel) {
    let heal = 0;
    for (const other of intel.threats) {
        const range = target.pos.getRangeTo(other);
        const stats = assess(other);
        if (range <= 1) heal += stats.heal;
        else if (range <= 3) heal += stats.rangedHeal;
    }
    return heal;
}

// Higher is better. Kill what removes the most enemy output per tick of focus fire:
// (damage + 2 x healing) / effective HP. A boosted-TOUGH attacker with a healer behind it
// scores low, so the healer gets focused; a fragile damage dealer scores high. Anything we
// can kill this tick comes first; nearer targets win close calls.
// Ticks for our side to kill a target against the healing it gets (its own and its neighbours'),
// Infinity when that healing matches our damage.
function killTime(target, intel) {
    const net = intel.us.dps - supportHealing(target, intel);
    return net > 0 ? assess(target).ehp / net : Infinity;
}

// Focus value: targets we can kill come first, fastest kill first (threat breaks ties); a target
// whose healing outlasts our damage only after them. Threat alone used to rank a boosted healer
// (8 T3 TOUGH, 3,552 healing on it) over the ranger next to it that we could actually kill.
function score(target, intel) {
    const cache = tickCache().scores;
    if (cache[target.id] !== undefined) return cache[target.id];
    const stats = assess(target);
    const threat = (stats.dps + 2 * stats.heal) * 1000 / Math.max(stats.ehp, 1);
    const ticks = killTime(target, intel);
    let value = ticks === Infinity ? threat - 100000 : 100000 / Math.max(ticks, 0.01) + threat;
    const killable = stats.ehp <= intel.us.dps - supportHealing(target, intel);
    if (killable) value += 10000;
    // On an exit tile it hops out next tick (a quad's back half parked on W1N9's border): only worth
    // focusing if it dies this tick; damage on it is otherwise healed or lost as it leaves.
    else if (onExit(target.pos)) value -= 50000;
    let nearest = 50;
    for (const friend of intel.friends) nearest = Math.min(nearest, friend.pos.getRangeTo(target));
    value -= 10 * (intel.friends.length ? nearest : 0);
    if (target.name && target.name.includes('TANK')) value -= 5000; // bait
    const breaking = intel.room && Game.rooms[intel.room] ? wallThreat(target, Game.rooms[intel.room]) : 0;
    if (breaking) value += WALL_FIRST + breaking * 1000;
    cache[target.id] = value;
    return value;
}

// Hits a tick a hostile is taking off our ramparts and walls: its dismantling and melee while it stands
// next to one (both work at range 1). 0 away from them. Barrier tiles cached per room per tick.
function barrierTiles(room) {
    const cache = tickCache();
    const all = cache.barriers || (cache.barriers = Object.create(null));
    if (all[room.name]) return all[room.name];
    const tiles = new Set();
    for (const s of runtimeCache.find(room, FIND_STRUCTURES)) {
        if ((s.structureType === STRUCTURE_RAMPART && s.my) || s.structureType === STRUCTURE_WALL) tiles.add(s.pos.x * 50 + s.pos.y);
    }
    return (all[room.name] = tiles);
}
function wallThreat(creep, room) {
    if (!room) return 0;
    const seen = wallDamageSeen(room, creep.id);
    const stats = assess(creep);
    const rate = stats.dismantle + stats.melee;
    if (!rate) return seen;
    const tiles = barrierTiles(room);
    const { x, y } = creep.pos;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if ((dx || dy) && tiles.has((x + dx) * 50 + y + dy)) return Math.max(rate, seen);
    }
    return seen;
}

// Damage each hostile has actually been doing to our ramparts and walls lately, from the room's event log:
// rangers firing at the walls count by what they hit (shardX E23N31's ranged squad parked by the walls
// while its wall-breakers were pushed off). An average that halves every WALL_HALF ticks without hits,
// kept in heap per room; read once per room per tick.
const WALL_HALF = 3;
const wallSeen = Object.create(null);     // room -> { t, rates: { id: average } }
function wallDamageSeen(room, id) {
    let w = wallSeen[room.name];
    if (!w || w.t !== Game.time) {
        const before = w && w.t < Game.time ? w : { t: Game.time, rates: Object.create(null) };
        const decay = Math.pow(0.5, Math.max(1, Game.time - before.t) / WALL_HALF);
        const rates = Object.create(null);
        for (const key in before.rates) { const v = before.rates[key] * decay; if (v >= 1) rates[key] = v; }
        let log = [];
        // Our rooms only: a remote fight has no walls of ours, and the log costs CPU to read.
        try { log = room.controller && room.controller.my && typeof room.getEventLog === 'function' ? room.getEventLog() : []; } catch (e) { log = []; }
        const tiles = barrierTiles(room);
        const hit = Object.create(null);
        for (const entry of log || []) {
            if (entry.event !== EVENT_ATTACK) continue;
            const target = Game.getObjectById(entry.data && entry.data.targetId);
            if (!target || !target.pos || !tiles.has(target.pos.x * 50 + target.pos.y)) continue;
            hit[entry.objectId] = (hit[entry.objectId] || 0) + ((entry.data && entry.data.damage) || 0);
        }
        for (const key in hit) rates[key] = Math.max(rates[key] || 0, hit[key]);
        w = wallSeen[room.name] = { t: Game.time, rates };
    }
    return w.rates[id] || 0;
}
// Ahead of every other consideration: a creep taking a wall down comes first, the fastest breaker first
// (shardX E23N31's second squad, mostly WORK, was the danger to the ramparts while its rangers did
// the damage the focus went after).
const WALL_FIRST = 1e8;

// On a room exit tile: a creep there leaves the room by stepping (or is moved over) next tick.
function onExit(pos) {
    return !!pos && (pos.x <= 0 || pos.x >= 49 || pos.y <= 0 || pos.y >= 49);
}

function bestOf(candidates, intel) {
    let best = null, bestScore = -Infinity;
    for (const candidate of candidates) {
        if (onRampart(candidate)) continue; // only rangedMassAttack can reach it, and that hits the rampart
        const value = score(candidate, intel);
        if (value > bestScore) {
            best = candidate;
            bestScore = value;
        }
    }
    return best;
}

// One focus target per room per tick, shared by every fighter there.
function focusTarget(room) {
    const intel = roomIntel(room);
    if (intel.focus === undefined) {
        intel.focus = bestOf(intel.threats.length ? intel.threats : intel.hostiles, intel);
    }
    return intel.focus;
}

module.exports = {
    COMBAT_ROLES, MASS_FACTOR,
    assess, roomIntel, verdictFor, focusTarget, bestOf, onRampart, killTime, supportHealing, onExit, wallThreat, WALL_FIRST,
    isDangerous, markOutmatched, isOutmatched, remoteThreat,
};
