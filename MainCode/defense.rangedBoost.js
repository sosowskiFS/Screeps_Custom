// defense.rangedBoost — which ranged attack boost a room's defenders use: the best one it has.
//
// XKHO2 (T3, x4 damage) was the only one the defence knew. A room without it fought unboosted while
// KHO2 (T2, x3) or KO (T1, x2; invaders drop it) sat in its terminal. Now:
//   - forRoom(room): the best tier with at least MIN_USE in the room (storage, terminal, labs), else
//     XKHO2 (what the labs make and the market buys by default). The boost labs load it
//     (system.labLayout.boostMineral, the lab worker, system.defenseBoost.loadLab), creep.combat boosts
//     from a lab holding any tier, and defense.staffing counts the extra damage at that tier.
//   - system.defenseBoost buys the tier with the cheapest extra damage per credit, and sends any tier
//     to rooms under attack from rooms of ours that can spare it.
const runtimeCache = require('runtime.cache');

const MIN_USE = 300;    // 10 parts: less than this and the lab would be loaded for next to nothing

// Best first: { res, mult } (the damage multiplier, from BOOSTS where it is known).
function tiers() {
    const table = typeof BOOSTS !== 'undefined' && BOOSTS[RANGED_ATTACK] || {};
    return [
        [typeof RESOURCE_CATALYZED_KEANIUM_ALKALIDE !== 'undefined' ? RESOURCE_CATALYZED_KEANIUM_ALKALIDE : 'XKHO2', 4],
        [typeof RESOURCE_KEANIUM_ALKALIDE !== 'undefined' ? RESOURCE_KEANIUM_ALKALIDE : 'KHO2', 3],
        [typeof RESOURCE_KEANIUM_OXIDE !== 'undefined' ? RESOURCE_KEANIUM_OXIDE : 'KO', 2],
    ].map(([res, mult]) => ({ res, mult: (table[res] && table[res].rangedAttack) || mult }));
}
function best() {
    return tiers()[0].res;
}
function isRanged(res) {
    return tiers().some(t => t.res === res);
}
function multOf(res) {
    const t = tiers().find(x => x.res === res);
    return t ? t.mult : 1;
}

function labsIn(room) {
    if (typeof room.find !== 'function') return [];
    return runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LAB } });
}
function stockOf(room, res) {
    let n = 0;
    for (const s of [room.storage, room.terminal]) if (s && s.store) n += s.store[res] || 0;
    for (const lab of labsIn(room)) if (lab.store) n += lab.store[res] || 0;
    return n;
}
// Every tier in the room together (units, whatever the tier).
function totalStock(room) {
    return tiers().reduce((n, t) => n + stockOf(room, t.res), 0);
}

function forRoom(room) {
    if (!room) return best();
    const tick = runtimeCache.current();
    const cache = tick.rangedBoost || (tick.rangedBoost = Object.create(null));
    if (cache[room.name] !== undefined) return cache[room.name];
    const found = tiers().find(t => stockOf(room, t.res) >= MIN_USE);
    return (cache[room.name] = found ? found.res : best());
}

module.exports = { tiers, best, isRanged, multOf, stockOf, totalStock, forRoom, MIN_USE };
