// combat.tactics — shared fight/flee behavior built on combat.intel.
//
// Fighters call fight(creep). Each tick it picks one mode from the room verdict and
// the creep's own state:
//   engage  - we clearly win: close on the room's shared focus target
//   hold    - even fight: keep position, kite melee, trade only what is in range
//   retreat - we lose, or this creep is about to die: break contact and regroup
// Civilians call avoidDanger(creep, workRoom) to stay out of fights they cannot win.
const intel = require('combat.intel');
const { Traveler } = require('traveler');
const remoteMining = require('system.remoteMining');

const REGROUP_TICKS = 50;  // how long a retreating fighter stays back before returning
const LOW_HEALTH = 0.35;   // retreat below this fraction of max hits

// Damage this creep can take this tick from start-of-tick positions (attacks need range at
// the start of the tick, so pre-healing now cancels it).
function incomingDamage(creep, threats) {
    let damage = 0;
    for (const threat of threats) {
        const range = creep.pos.getRangeTo(threat);
        const stats = intel.assess(threat);
        if (range <= 1) damage += stats.melee;
        if (range <= 3) damage += stats.ranged;
    }
    return damage;
}

// Tiles to keep from each threat: melee needs adjacency, ranged reaches 3, both can step first.
function fleeRange(stats) {
    return stats.ranged > 0 ? 5 : 3;
}

// Flee from every given threat at once (not just the nearest), staying inside the room.
function flee(creep, threats) {
    const goals = threats.map(threat => ({ pos: threat.pos, range: fleeRange(intel.assess(threat)) }));
    const result = PathFinder.search(creep.pos, goals, {
        flee: true,
        maxRooms: 1,
        plainCost: 2,
        swampCost: 10,
        roomCallback: roomName => {
            const room = Game.rooms[roomName];
            // Read-only use of Traveler's per-tick matrix (structures + creeps).
            return room ? Traveler.getCreepMatrix(room) : undefined;
        },
    });
    if (result.path.length) {
        creep.move(creep.pos.getDirectionTo(result.path[0]));
        return true;
    }
    return false;
}

// Step toward a target that is a few tiles away without a full pathfinding search.
function closeIn(creep, target, range) {
    const distance = creep.pos.getRangeTo(target);
    if (distance <= range) return;
    if (distance <= 3) {
        creep.move(creep.pos.getDirectionTo(target));
    } else {
        creep.travelTo(target, { maxRooms: 1, range: range, movingTarget: true, ignoreCreeps: false });
    }
}

function homeRoomOf(creep) {
    return creep.memory.homeRoom || creep.room.name;
}

function goHome(creep) {
    const home = Game.rooms[homeRoomOf(creep)];
    if (creep.room.name === homeRoomOf(creep)) return false;
    creep.travelTo(home && home.storage ? home.storage : new RoomPosition(25, 25, homeRoomOf(creep)), { range: 3 });
    return true;
}

function stepOffBorder(creep) {
    const { x, y } = creep.pos;
    if (x === 0) creep.move(RIGHT);
    else if (x === 49) creep.move(LEFT);
    else if (y === 0) creep.move(BOTTOM);
    else if (y === 49) creep.move(TOP);
    else return false;
    return true;
}

// Combat actions for this tick. Intents are chosen so they never cancel each other:
// attack and heal share a pipeline (choose one), rangedAttack/rangedMassAttack and
// rangedHeal share another (choose one), and the two pipelines run together.
function act(creep, room, focus) {
    const me = intel.assess(creep);
    const roomIntel = intel.roomIntel(room);
    const inRange = roomIntel.hostiles.filter(h => creep.pos.inRangeTo(h, 3));
    const incoming = incomingDamage(creep, roomIntel.threats);

    // Heal choice: the biggest deficit (counting damage about to land on us) among us and adjacent friends.
    let healTarget = null, healNeed = 0, rangedHealTarget = null;
    if (me.heal > 0) {
        healNeed = creep.hitsMax - creep.hits + incoming;
        if (healNeed > 0) healTarget = creep;
        for (const friend of creep.pos.findInRange(FIND_MY_CREEPS, 3)) {
            if (friend.id === creep.id || friend.hits >= friend.hitsMax) continue;
            const deficit = friend.hitsMax - friend.hits;
            if (creep.pos.isNearTo(friend)) {
                if (deficit > healNeed) {
                    healTarget = friend;
                    healNeed = deficit;
                }
            } else if (!rangedHealTarget || friend.hits < rangedHealTarget.hits) {
                rangedHealTarget = friend;
            }
        }
    }
    // Attacking usually beats healing; give it up only when the heal target is in real trouble.
    const healUrgent = healTarget && (healTarget === creep
        ? creep.hits - incoming < creep.hitsMax * 0.5
        : healTarget.hits < healTarget.hitsMax * 0.5);

    // Melee: prefer the focus target, else the best adjacent one.
    let meleeTarget = null;
    if (me.melee > 0) {
        const adjacent = inRange.filter(h => creep.pos.isNearTo(h));
        meleeTarget = focus && adjacent.includes(focus) ? focus : intel.bestOf(adjacent, roomIntel);
    }
    if (meleeTarget && healTarget) {
        if (healUrgent) meleeTarget = null;
        else healTarget = null;
    }
    if (meleeTarget) creep.attack(meleeTarget);
    if (healTarget) creep.heal(healTarget);

    // Ranged: mass attack when it out-damages a single shot (several targets close by).
    let usedRanged = false;
    if (me.ranged > 0 && inRange.length) {
        const single = focus && inRange.includes(focus) && !intel.onRampart(focus) ? focus : intel.bestOf(inRange, roomIntel);
        let mass = 0;
        for (const hostile of inRange) mass += me.ranged * intel.MASS_FACTOR[creep.pos.getRangeTo(hostile)];
        const allyCritical = rangedHealTarget && !healTarget && rangedHealTarget.hits < rangedHealTarget.hitsMax * 0.4;
        if (!allyCritical) {
            if (mass > (single ? me.ranged : 0)) {
                creep.rangedMassAttack();
                usedRanged = true;
            } else if (single) {
                creep.rangedAttack(single);
                usedRanged = true;
            }
        }
    }
    if (!usedRanged && !healTarget && rangedHealTarget) {
        creep.rangedHeal(rangedHealTarget);
    }
}

function startRegroup(creep) {
    creep.memory.regroupUntil = Game.time + REGROUP_TICKS;
}

// True while a fighter is staying back after a retreat. Moves it home and heals it.
function regroup(creep) {
    if (!creep.memory.regroupUntil) return false;
    if (Game.time >= creep.memory.regroupUntil) {
        delete creep.memory.regroupUntil;
        return false;
    }
    if (!goHome(creep)) stepOffBorder(creep);
    if (creep.hits < creep.hitsMax && intel.assess(creep).heal > 0) creep.heal(creep);
    return true;
}

// Run one tick of combat. Returns false when the room holds no hostiles (caller continues
// its normal routine). opts.transit: the creep is passing through; only fight what is near.
function fight(creep, opts = {}) {
    const room = creep.room;
    const roomIntel = intel.roomIntel(room);
    if (!roomIntel.hostiles.length) return false;
    const me = intel.assess(creep);
    const threats = roomIntel.threats;
    const near = threats.filter(t => creep.pos.inRangeTo(t, fleeRange(intel.assess(t)) + 1));
    if (opts.transit && !near.length) return false;

    const incoming = incomingDamage(creep, threats);
    const dying = creep.hits < creep.hitsMax * LOW_HEALTH || incoming >= creep.hits;
    let mode = 'engage';
    if (threats.length) {
        if (roomIntel.verdict === 'lose' || dying) mode = 'retreat';
        else if (roomIntel.verdict === 'even') mode = 'hold';
    }
    if (roomIntel.verdict === 'lose') intel.markOutmatched(room.name);
    if (mode === 'engage' && threats.length) delete creep.memory.regroupUntil; // reinforcements arrived

    const focus = intel.focusTarget(room);
    const kiter = me.ranged >= me.melee;
    const meleeNear = near.filter(t => intel.assess(t).melee > 0 && creep.pos.inRangeTo(t, 2));

    if (mode === 'retreat') {
        if (roomIntel.verdict === 'lose') startRegroup(creep);
        if (!(near.length && flee(creep, near))) goHome(creep);
    } else if (kiter && meleeNear.length) {
        // Ranged fighters never let melee get adjacent; they shoot while backing off.
        flee(creep, meleeNear);
    } else if (focus && mode === 'engage') {
        const focusStats = intel.assess(focus);
        // Close all the way on harmless targets, otherwise stay at the edge of our reach.
        const range = kiter ? (focusStats.dps > 0 ? 3 : 1) : 1;
        closeIn(creep, focus, range);
    } else if (focus && mode === 'hold' && kiter && creep.pos.getRangeTo(focus) > 3) {
        // Even fight: keep pressure at max range but never commit to melee range.
        closeIn(creep, focus, 3);
    }

    act(creep, room, focus);
    return true;
}

// Civilians (miners, haulers, claimers, collectors). Returns true when it has taken over
// movement for this tick. workRoom: where the creep is headed to work (null when going home).
function avoidDanger(creep, workRoom) {
    const roomIntel = intel.roomIntel(creep.room);
    if (roomIntel.threats.length) {
        // Always step out of reach of armed hostiles, even if our guards are winning.
        const near = roomIntel.threats.filter(t => {
            const stats = intel.assess(t);
            return stats.dps > 0 && creep.pos.inRangeTo(t, fleeRange(stats));
        });
        if (near.length && flee(creep, near)) return true;
        if (roomIntel.verdict !== 'win' && creep.room.name === workRoom) {
            goHome(creep);
            return true;
        }
    }
    if (workRoom && remoteMining.isDisabled(workRoom)) {
        // Remote disabled after player attacks: wait at home (alive) until it is re-enabled.
        if (!goHome(creep)) stepOffBorder(creep);
        return true;
    }
    if (workRoom && workRoom !== creep.room.name && intel.isDangerous(workRoom)) {
        // Wait outside until our guards have dealt with it.
        stepOffBorder(creep);
        return true;
    }
    return false;
}

module.exports = { fight, act, flee, avoidDanger, regroup, startRegroup, incomingDamage };
