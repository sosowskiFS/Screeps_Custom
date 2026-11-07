// defense.staffing — how many defenders a room under attack needs to out-damage the enemy's healing.
//
// The spawners kept fixed counts: at most 2 (spawn.BuildCreeps) or 6 for any hostile at all
// (spawn.BuildCreeps5). shardX W1N9 was hit by a boosted ranged quad: 40 XLHO2 HEAL parts, 1,920
// healing a tick on whichever member was hit (all four adjacent), against ~1,530 from three towers
// 8 tiles away. With two defenders (one of them 2 parts) nothing ever died and the walls took the
// damage for free.
// needed(room, perDefender): for each armed hostile, the raw damage it takes to beat the healing it
// receives this tick (its own and its neighbours', supportHealing) by MARGIN, through its boosted
// TOUGH (damage multiplier); less what our towers do to it at their range (energy permitting).
// The easiest target sets the count: the towers and defenders focus one target. At least one
// defender against a player, at most MAX_DEFENDERS.
const runtimeCache = require('runtime.cache');
const combatIntel = require('combat.intel');

const MARGIN = 1.3;
const MAX_DEFENDERS = 8;
const RANGED_POWER = 10;

// A tower's damage at a range: full to TOWER_OPTIMAL_RANGE (5), a quarter from TOWER_FALLOFF_RANGE
// (20), linear between.
function towerDamage(range) {
    const power = typeof TOWER_POWER_ATTACK !== 'undefined' ? TOWER_POWER_ATTACK : 600;
    const near = typeof TOWER_OPTIMAL_RANGE !== 'undefined' ? TOWER_OPTIMAL_RANGE : 5;
    const far = typeof TOWER_FALLOFF_RANGE !== 'undefined' ? TOWER_FALLOFF_RANGE : 20;
    const falloff = typeof TOWER_FALLOFF !== 'undefined' ? TOWER_FALLOFF : 0.75;
    if (range <= near) return power;
    if (range >= far) return power * (1 - falloff);
    return power * (1 - falloff * (range - near) / (far - near));
}

// Share of each hit a creep takes while its boosted TOUGH lasts (1 without).
function toughFactor(creep) {
    let factor = 1;
    for (const part of creep.body || []) {
        if (part.type !== TOUGH || part.hits <= 0 || !part.boost || typeof BOOSTS === 'undefined') continue;
        const b = BOOSTS[TOUGH] && BOOSTS[TOUGH][part.boost];
        if (b && b.damage !== undefined) factor = Math.min(factor, b.damage);
    }
    return factor;
}

function rangeBetween(a, b) {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

// Defenders wanted now. perDefender: the damage one new defender deals a tick (its ranged parts).
function needed(room, perDefender) {
    const intel = combatIntel.roomIntel(room);
    const threats = intel.threats || [];
    if (!threats.length) return 0;
    const towers = runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } })
        .filter(t => !t.store || (t.store[RESOURCE_ENERGY] || 0) >= 10);
    const each = Math.max(1, perDefender || 0);
    let best = Infinity;
    for (const target of threats) {
        const heal = combatIntel.supportHealing(target, intel);
        const required = heal * MARGIN / toughFactor(target);
        const tower = towers.reduce((n, t) => n + towerDamage(rangeBetween(t.pos, target.pos)), 0);
        best = Math.min(best, Math.ceil(Math.max(0, required - tower) / each));
    }
    const floor = intel.players ? 1 : 0;
    return Math.min(MAX_DEFENDERS, Math.max(floor, best));
}

// Boosted ranged parts the defenders need right now: what the easiest target's healing still out-lasts,
// after the towers and every defender in the room as it is (boosted parts counted boosted), at the extra
// damage a part gets from the room's ranged boost (defense.rangedBoost.forRoom: 30 for XKHO2, 20 KHO2,
// 10 KO). 0 when they already win: a quad that is outgunned runs, and shardX E23N31's defenders
// boosted whole bodies whenever any attacker was boosted at all. Cached per tick.
function boostGain(room) {
    const rangedBoost = require('defense.rangedBoost');
    return RANGED_POWER * rangedBoost.multOf(rangedBoost.forRoom(room)) - RANGED_POWER;
}
function boostShortfall(room) {
    const tick = runtimeCache.current();
    const cache = tick.boostShortfall || (tick.boostShortfall = Object.create(null));
    if (cache[room.name] !== undefined) return cache[room.name];
    const intel = combatIntel.roomIntel(room);
    const threats = intel.threats || [];
    let parts = 0;
    if (threats.length) {
        const towers = runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } })
            .filter(t => !t.store || (t.store[RESOURCE_ENERGY] || 0) >= 10);
        const ours = runtimeCache.find(room, FIND_MY_CREEPS).filter(c => c.memory && c.memory.priority === 'defender')
            .reduce((n, c) => n + combatIntel.assess(c).ranged, 0);
        let short = Infinity;
        for (const target of threats) {
            const required = combatIntel.supportHealing(target, intel) * MARGIN / toughFactor(target);
            const tower = towers.reduce((n, t) => n + towerDamage(rangeBetween(t.pos, target.pos)), 0);
            short = Math.min(short, required - tower - ours);
        }
        parts = short > 0 ? Math.ceil(short / boostGain(room)) : 0;
    }
    return (cache[room.name] = parts);
}

function rangedDamage(body) {
    return body.filter(p => p === RANGED_ATTACK).length * RANGED_POWER;
}

module.exports = { needed, boostShortfall, towerDamage, toughFactor, rangedDamage, MARGIN, MAX_DEFENDERS };
