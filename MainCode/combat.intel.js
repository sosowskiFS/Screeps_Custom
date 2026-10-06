// combat.intel — shared, per-tick combat assessment.
// Every creep and room is assessed at most once per tick; all callers reuse the result.
// Numbers come from visible bodies only: destroyed parts are ignored, boosts are applied.
const runtimeCache = require('runtime.cache');

// Creeps of these roles count toward our fighting strength in a room.
const COMBAT_ROLES = new Set([
    'farGuard', 'farGuardNearDeath', 'ranger', 'ranger2', 'PowerGuard', 'rangerNearDeath',
    'SKAttackGuard', 'SKAttackGuardNearDeath', 'SKHealGuard', 'SKHealGuardNearDeath',
    'highwayPatrol', 'highwayPatrolNearDeath', 'defender',
    'assattacker', 'assattackerNearDeath', 'assranger', 'assrangerNearDeath', 'asshealer', 'asshealerNearDeath',
    'powerAttack', 'powerAttackNearDeath', 'powerHeal', 'powerHealNearDeath',
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
    const stats = { melee: 0, ranged: 0, heal: 0, rangedHeal: 0, ehp: 0, move: 0, parts: 0 };
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
    const threats = hostiles.filter(c => assess(c).combat);
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
function score(target, intel) {
    const cache = tickCache().scores;
    if (cache[target.id] !== undefined) return cache[target.id];
    const stats = assess(target);
    let value = (stats.dps + 2 * stats.heal) * 1000 / Math.max(stats.ehp, 1);
    if (stats.ehp <= intel.us.dps - supportHealing(target, intel)) value += 10000;
    let nearest = 50;
    for (const friend of intel.friends) nearest = Math.min(nearest, friend.pos.getRangeTo(target));
    value -= 10 * (intel.friends.length ? nearest : 0);
    if (target.name && target.name.includes('TANK')) value -= 5000; // bait
    cache[target.id] = value;
    return value;
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
    assess, roomIntel, verdictFor, focusTarget, bestOf, onRampart,
    isDangerous, markOutmatched, isOutmatched,
};
