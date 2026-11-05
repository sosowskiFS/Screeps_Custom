// system.labLayout — which lab does what, and which boost labs can react while no boost is wanted.
//
// Memory.labList[room] is read by index everywhere: 0-2 boost labs, 3-4 reagent labs, 5+ outputs.
// An output only reacts within range 2 of both reagent labs. The list used to be in find order in
// rooms built before the base planner, and labs 4 and 5 there could sit 12 tiles apart: E18N22 and
// E22N19 (shard2) had no output in reach, E1N16 one, E18N26 two. arrange() orders the labs so the
// reagent pair reaches the most labs; labs no pair reaches make the best boost labs (they could
// never react anyway).
//
// Flex labs: a boost lab within range 2 of both reagent labs. While nothing in the room wants its
// boost it reacts like an output (labWorker sees the product as its mineral); when a creep wants
// the boost (boostWanted) the lab worker empties the product and loads FLEX_FILL of the boost.
// Planned bases keep their boost labs by the spawns, out of reach of the reaction stamp, so this
// applies where the labs happen to stand close.
const runtimeCache = require('runtime.cache');

const REACH = 2;
const FLEX_FILL = 1000;          // a flex lab loads this much boost (one lab worker trip)
const FLEX_HOLD = 50;            // ...and stays a boost lab this long after the last want
const MIN_STOCK = 300;           // less in the room than this: no point flushing the product
const BOOST_WAIT = 150;          // a new creep waits this long (working meanwhile) for a flex lab

function near(a, b) {
    return Math.max(Math.abs(a.pos.x - b.pos.x), Math.abs(a.pos.y - b.pos.y)) <= REACH;
}
function key(lab) {
    return lab.pos.x * 50 + lab.pos.y;
}

// Order the labs: boost labs (3), the reagent pair, outputs (in reach first). labs: in the planned
// order where the room has a plan (planned: true), so its stamp pair wins a tie. Deterministic from
// positions alone (Memory.labList is heap-only and rebuilt after a reset).
function arrange(labs, planned) {
    if (labs.length < 6) return labs.slice();
    const reached = (a, b) => labs.filter(l => l !== a && l !== b && near(l, a) && near(l, b));
    const order = planned ? labs : labs.slice().sort((x, y) => key(x) - key(y));
    let best = null, bestReach = -1;
    if (planned) {
        best = [order[3], order[4]];
        bestReach = near(best[0], best[1]) ? reached(best[0], best[1]).length : -1;
    }
    for (let i = 0; i < order.length; i++) {
        for (let j = i + 1; j < order.length; j++) {
            if (!near(order[i], order[j])) continue;
            const n = reached(order[i], order[j]).length;
            if (n > bestReach) { best = [order[i], order[j]]; bestReach = n; }
        }
    }
    if (!best) return labs.slice();
    const rest = order.filter(l => l !== best[0] && l !== best[1]);
    const inReach = new Set(reached(best[0], best[1]));
    const planIndex = new Map(order.map((l, n) => [l, n]));
    // Boost labs: out of reach first; the plan's own boost labs first within each group.
    const boostRank = l => (inReach.has(l) ? 100 : 0) + (planned && planIndex.get(l) < 3 ? 0 : 10);
    const boost = rest.slice().sort((x, y) => boostRank(x) - boostRank(y) || planIndex.get(x) - planIndex.get(y)).slice(0, 3);
    const outputs = rest.filter(l => !boost.includes(l)).sort((x, y) => Number(inReach.has(y)) - Number(inReach.has(x)) || planIndex.get(x) - planIndex.get(y));
    return [...boost, best[0], best[1], ...outputs];
}

function labsOf(roomName) {
    return ((Memory.labList && Memory.labList[roomName]) || []).map(id => Game.getObjectById(id));
}

// Output labs (index 5+) in reach of both reagent labs.
function inReach(roomName, labs = labsOf(roomName)) {
    const a = labs[3], b = labs[4];
    if (!a || !b) return [];
    return labs.filter((l, i) => l && i !== 3 && i !== 4 && near(l, a) && near(l, b));
}

// Boost labs (0-2) within reach of both reagent labs: indices.
function flexIndices(roomName, labs = labsOf(roomName)) {
    const reach = new Set(inReach(roomName, labs));
    return [0, 1, 2].filter(i => labs[i] && reach.has(labs[i]));
}

function stockIn(room, mineral) {
    let n = 0;
    for (const s of [room.storage, room.terminal]) if (s && s.store) n += s.store[mineral] || 0;
    for (const lab of labsOf(room.name)) if (lab && lab.mineralType === mineral) n += lab.mineralAmount || 0;
    return n;
}

const NPC = new Set(['Invader', 'Source Keeper']);
function playerHostiles(room) {
    const white = Memory.whiteList || [];
    return runtimeCache.find(room, FIND_HOSTILE_CREEPS).filter(c => c.owner && !NPC.has(c.owner.username) && !white.includes(c.owner.username));
}

// Creeps in the room that would take each default boost now (the rules their roles boost by:
// creep.upgrader, creep.repair, creep.combat). Another boost (WarBoosts staging): always wanted.
const WANTS = {
    [RESOURCE_CATALYZED_GHODIUM_ACID]: (room, creeps) => room.controller && room.controller.level >= 6 &&
        creeps.some(c => c.memory.priority === 'upgrader' && !c.memory.hasBoosted && !c.memory.previousPriority),
    [RESOURCE_CATALYZED_LEMERGIUM_ACID]: (room, creeps) => Memory.roomsUnderAttack && Memory.roomsUnderAttack.includes(room.name) &&
        playerHostiles(room).length > 0 &&
        creeps.some(c => c.memory.priority === 'repair' && !c.memory.hasBoosted && (c.spawning || (c.ticksToLive || 0) >= 750)),
    [RESOURCE_CATALYZED_KEANIUM_ALKALIDE]: room => playerHostiles(room).some(t => (t.body || []).some(p => p.boost)),
};

let wantCache = { t: -1, rooms: {} };
function boostWanted(room, mineral) {
    if (wantCache.t !== Game.time) wantCache = { t: Game.time, rooms: {} };
    const memo = wantCache.rooms[room.name] || (wantCache.rooms[room.name] = {});
    if (memo[mineral] !== undefined) return memo[mineral];
    const rule = WANTS[mineral];
    let wanted = true;
    if (rule) {
        const creeps = runtimeCache.find(room, FIND_MY_CREEPS);
        wanted = stockIn(room, mineral) >= MIN_STOCK && !!rule(room, creeps);
    }
    return (memo[mineral] = wanted);
}

function boostMineral(roomName, i) {
    const config = (Memory.roomConfigs && Memory.roomConfigs[roomName] && Memory.roomConfigs[roomName].mineralConfig) || {};
    const defaults = [RESOURCE_CATALYZED_KEANIUM_ALKALIDE, RESOURCE_CATALYZED_GHODIUM_ACID, RESOURCE_CATALYZED_LEMERGIUM_ACID];
    return config['min' + (i + 1)] || defaults[i];
}

// Boost lab indices (0-2) reacting this tick. Not with WarBoosts staging, a guard boost lease, or
// no reaction planned; a want keeps the lab a boost lab FLEX_HOLD more ticks (Memory.labFlex).
let reactCache = { t: -1, rooms: {} };
function reacting(roomName) {
    if (reactCache.t !== Game.time) reactCache = { t: Game.time, rooms: {} };
    if (reactCache.rooms[roomName]) return reactCache.rooms[roomName];
    const out = new Set();
    reactCache.rooms[roomName] = out;
    const room = Game.rooms[roomName];
    const job = require('system.labs').jobFor(roomName);
    if (!room || !job || Game.flags[roomName + 'WarBoosts']) return out;
    const labs = labsOf(roomName);
    const hold = Memory.labFlex || (Memory.labFlex = {});
    for (const i of flexIndices(roomName, labs)) {
        const lab = labs[i];
        if (require('system.guardBoosts').assignment(roomName, lab.id)) continue;
        const mineral = boostMineral(roomName, i);
        if (mineral === job.p) continue;      // it holds the product as its boost already
        if (boostWanted(room, mineral)) { hold[lab.id] = Game.time + FLEX_HOLD; continue; }
        if (hold[lab.id] > Game.time) continue;
        delete hold[lab.id];
        out.add(i);
    }
    return out;
}
function isFlex(roomName, i) {
    return flexIndices(roomName).includes(i);
}

// Labs to run reactions in: outputs in reach and reacting flex labs, not leased for guard boosts.
function reactionLabs(roomName) {
    const labs = labsOf(roomName);
    const reach = new Set(inReach(roomName, labs));
    const flex = reacting(roomName);
    const lease = id => require('system.guardBoosts').assignment(roomName, id);
    return labs.filter((l, i) => l && reach.has(l) && (i >= 5 || flex.has(i)) && !lease(l.id));
}

// A flex lab is being switched to this boost (wanted, not yet holding enough): a new creep should
// keep working and come back for it rather than give up on boosting.
function boostPending(room, mineral, amount) {
    const labs = labsOf(room.name);
    for (const i of flexIndices(room.name, labs)) {
        if (boostMineral(room.name, i) !== mineral || reacting(room.name).has(i)) continue;
        const lab = labs[i];
        if (!(lab.mineralType === mineral && lab.mineralAmount >= amount)) return true;
    }
    return false;
}

module.exports = { arrange, inReach, flexIndices, isFlex, reacting, reactionLabs, boostWanted, boostPending, boostMineral,
    REACH, FLEX_FILL, FLEX_HOLD, BOOST_WAIT, MIN_STOCK };
