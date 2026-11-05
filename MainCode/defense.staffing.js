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

function rangedDamage(body) {
    return body.filter(p => p === RANGED_ATTACK).length * RANGED_POWER;
}

module.exports = { needed, towerDamage, toughFactor, rangedDamage, MARGIN, MAX_DEFENDERS };
