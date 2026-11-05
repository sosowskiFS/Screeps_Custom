const speech = require('creep.speech');
const runtimeCache = require('runtime.cache');
const combat = require('combat.tactics');
const combatIntel = require('combat.intel');
const defenseWatch = require('defense.watch');

// Room defender: fights from the rampart network.
//  * Each defender claims the free walkable rampart ("post") closest to the shared target,
//    sticking to its current post unless another is clearly better.
//  * It travels along ramparts; open tiles inside hostile reach are treated as impassable.
//  * It focuses the towers' target, so towers and defenders kill the same creep.
//  * It leaves the ramparts only to chase unarmed intruders, and never during a border drain
//    (that is exactly what the drainer wants).
//  * On its post it is parked (memory.atSpot): Traveler never swaps it out and paths go around it.
//    Two W1N9 defenders traded places every tick between a rampart and the open tile behind it:
//    the one off the ramparts pathed through the other to a post beyond, the swap put the other
//    off, and it did the same. A post not reached after POST_STUCK ticks without getting closer is
//    passed over for POST_BAN ticks (memory.badPosts).
const POST_STUCK = 5;
const POST_BAN = 50;
var creep_combat = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (Memory.roomsUnderAttack.indexOf(creep.room.name) == -1) {
            delete creep.memory.atSpot;
            idle(creep);
            return;
        }
        creep.memory.waitingTimer = 0;

        const room = creep.room;
        const intel = combatIntel.roomIntel(room);
        if (handleBoosting(creep, intel)) {
            return;
        }

        const focus = sharedFocus(room);
        const draining = defenseWatch.isDraining(room.name);
        const posts = rampartPosts(room);

        if (!intel.hostiles.length) {
            // Under-attack status lingers briefly after hostiles leave: hold position.
            return;
        }

        if (!posts.length || (!intel.threats.length && !draining)) {
            // No ramparts to use, or only unarmed intruders: the shared fight logic hunts/kites.
            delete creep.memory.atSpot;
            combat.fight(creep);
            return;
        }

        const post = choosePost(creep, room, posts, intel, focus);
        const onPost = !!post && creep.pos.x === post.x && creep.pos.y === post.y;
        creep.memory.atSpot = onPost;
        if (post && !onPost) notePostProgress(creep, post);
        if (post && !onPost) {
            creep.travelTo(new RoomPosition(post.x, post.y, room.name), {
                maxRooms: 1,
                range: 0,
                roomCallback: (roomName, matrix) => roomName === room.name ? exposeThreatZones(room, intel, matrix, creep) : matrix,
            });
        }
        if (focus && creep.pos.inRangeTo(focus, 3)) {
            speech.say(creep, "（งΦ Д Φ）ง", true);
        }
        combat.act(creep, room, focus);
    }
};

// Towers already pick the target they can hurt most; defenders add to it when in range.
function sharedFocus(room) {
    const picked = Game.getObjectById(Memory.towerPickedTarget[room.name]);
    if (picked && picked.pos.roomName === room.name && !combatIntel.onExit(picked.pos)) {
        return picked;
    }
    return combatIntel.focusTarget(room);
}

// What a defender chooses its post by: the focus, else the nearest armed hostile, neither on an exit
// tile (it hops out and back: W1N9's defender walked toward a quad's back half on the border while
// it was in the room, back toward the front half when it hopped out, and never fired). With only
// border hoppers in the room, the last anchor it had (memory.anchor), so it stays on its post.
function postAnchor(creep, intel, focus) {
    const inside = list => list.filter(t => !combatIntel.onExit(t.pos));
    let anchor = focus && !combatIntel.onExit(focus.pos) ? focus : null;
    if (!anchor) {
        const threats = inside(intel.threats);
        const pool = threats.length ? threats : inside(intel.hostiles);
        anchor = pool.length ? creep.pos.findClosestByRange(pool) : null;
    }
    if (anchor) {
        creep.memory.anchor = { x: anchor.pos.x, y: anchor.pos.y, t: Game.time };
        return anchor;
    }
    const last = creep.memory.anchor;
    if (last && Game.time - last.t <= ANCHOR_KEEP) return { pos: { x: last.x, y: last.y } };
    const any = intel.threats.length ? intel.threats : intel.hostiles;
    return any.length ? creep.pos.findClosestByRange(any) : null;
}
const ANCHOR_KEEP = 100;

// Walkable ramparts of ours (no blocking structure on the tile), computed once per room per tick.
function rampartPosts(room) {
    const tick = runtimeCache.current();
    const cache = tick.rampartPosts || (tick.rampartPosts = Object.create(null));
    if (cache[room.name]) {
        return cache[room.name].posts;
    }
    const blocked = new Set();
    const ramparts = [];
    for (const structure of runtimeCache.find(room, FIND_STRUCTURES)) {
        if (structure.structureType === STRUCTURE_RAMPART) {
            if (structure.my) ramparts.push(structure);
        } else if (structure.structureType !== STRUCTURE_ROAD && structure.structureType !== STRUCTURE_CONTAINER) {
            blocked.add(structure.pos.x * 50 + structure.pos.y);
        }
    }
    const posts = ramparts.filter(r => !blocked.has(r.pos.x * 50 + r.pos.y)).map(r => ({ x: r.pos.x, y: r.pos.y }));
    cache[room.name] = { posts, claimed: new Set(), keys: new Set(posts.map(p => p.x * 50 + p.y)) };
    return posts;
}

// Best post: closest to the target (or nearest armed hostile), then closest to us. Our current
// post wins near-ties so defenders don't shuffle every tick.
function choosePost(creep, room, posts, intel, focus) {
    const state = runtimeCache.current().rampartPosts[room.name];
    const anchor = postAnchor(creep, intel, focus);
    if (!anchor) return null;
    const occupiedByDefender = new Set();
    for (const other of runtimeCache.find(room, FIND_MY_CREEPS, { filter: c => c.memory.priority === 'defender' && c.id !== creep.id })) {
        occupiedByDefender.add(other.pos.x * 50 + other.pos.y);
    }
    const currentKey = creep.pos.x * 50 + creep.pos.y;
    const bad = creep.memory.badPosts || {};
    for (const key in bad) if (bad[key] <= Game.time) delete bad[key];
    if (creep.memory.badPosts && !Object.keys(bad).length) delete creep.memory.badPosts;
    let best = null, bestScore = Infinity;
    for (const post of posts) {
        const key = post.x * 50 + post.y;
        if (state.claimed.has(key) || (occupiedByDefender.has(key) && key !== currentKey)) continue;
        if (bad[key] > Game.time && key !== currentKey) continue;
        const toTarget = Math.max(Math.abs(post.x - anchor.pos.x), Math.abs(post.y - anchor.pos.y));
        const travel = Math.max(Math.abs(post.x - creep.pos.x), Math.abs(post.y - creep.pos.y));
        let value = toTarget * 10 + travel;
        if (key === currentKey) value -= 15;
        if (value < bestScore) {
            best = post;
            bestScore = value;
        }
    }
    if (best) state.claimed.add(best.x * 50 + best.y);
    return best;
}

// Heading for a post: getting no closer for POST_STUCK ticks (the way blocked by defenders on their
// own posts) passes it over for POST_BAN ticks.
function notePostProgress(creep, post) {
    const m = creep.memory;
    const key = post.x * 50 + post.y;
    const dist = Math.max(Math.abs(post.x - creep.pos.x), Math.abs(post.y - creep.pos.y));
    if (m.postKey !== key || dist < m.postDist) {
        m.postKey = key;
        m.postDist = dist;
        m.postAt = Game.time;
    } else if (Game.time - m.postAt >= POST_STUCK) {
        (m.badPosts || (m.badPosts = {}))[key] = Game.time + POST_BAN;
        delete m.postKey;
    }
}

// Path cost matrix for moving between posts: open tiles a hostile can hit this tick are walls.
// With creep given, an open tile is crossed (at EXPOSED_COST) when the creep can take TANK_TICKS of
// the damage every hostile in reach deals there with TANK_SHARE of its hits; the towers heal it
// once it is on its rampart. Only tiles it could not survive are walls. W1N9's 40-part defender
// (4,000 hits) never reached the ramparts in range of the focused quad: every way there crossed a
// tile in reach, so it went from post to post (POST_STUCK) without firing.
const TANK_TICKS = 2;
const TANK_SHARE = 0.5;
const EXPOSED_COST = 30;
function exposeThreatZones(room, intel, matrix, creep) {
    const ramparts = runtimeCache.current().rampartPosts[room.name].keys;
    const damage = new Map();
    for (const threat of intel.threats) {
        const stats = combatIntel.assess(threat);
        const reach = stats.ranged > 0 ? 3 : (stats.melee > 0 ? 1 : 0);
        if (!reach) continue;
        for (let x = Math.max(1, threat.pos.x - reach); x <= Math.min(48, threat.pos.x + reach); x++) {
            for (let y = Math.max(1, threat.pos.y - reach); y <= Math.min(48, threat.pos.y + reach); y++) {
                const key = x * 50 + y;
                if (ramparts.has(key)) continue;
                const range = Math.max(Math.abs(x - threat.pos.x), Math.abs(y - threat.pos.y));
                damage.set(key, (damage.get(key) || 0) + stats.ranged + (range <= 1 ? stats.melee : 0));
            }
        }
    }
    const budget = creep && creep.hits ? creep.hits * TANK_SHARE : 0;
    for (const [key, hit] of damage) {
        const x = Math.floor(key / 50), y = key % 50;
        if (budget && hit * TANK_TICKS <= budget) {
            if (matrix.get(x, y) < EXPOSED_COST) matrix.set(x, y, EXPOSED_COST);
        } else {
            matrix.set(x, y, 0xff);
        }
    }
    // Defenders on their posts are never walked through (see POST_STUCK).
    for (const other of runtimeCache.find(room, FIND_MY_CREEPS)) {
        if (other.memory && other.memory.priority === 'defender' && other.memory.atSpot) matrix.set(other.pos.x, other.pos.y, 0xff);
    }
    return matrix;
}

// Boost ranged parts with XKHO2 when boosted attackers show up (RCL6+), as before.
function handleBoosting(creep, intel) {
    if (creep.room.controller.level < 6) return false;
    if (boostMove(creep)) return true;
    if (creep.memory.needBoosts === undefined || Game.time % 10 == 0) {
        const boostedEnemy = intel.threats.some(t => t.owner.username != 'Invader' && t.body.some(part => part.boost));
        creep.memory.needBoosts = boostedEnemy;
    }
    if (!creep.memory.needBoosts) return false;
    const unboosted = creep.body.filter(part => part.type == RANGED_ATTACK && !part.boost).length;
    if (!unboosted) return false;
    const lab = runtimeCache.find(creep.room, FIND_MY_STRUCTURES, {
        filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_KEANIUM_ALKALIDE)
    })[0];
    if (!lab || lab.mineralAmount < unboosted * LAB_BOOST_MINERAL || lab.energy < unboosted * LAB_BOOST_ENERGY) {
        creep.memory.needBoosts = false;
        return false;
    }
    if (!creep.pos.isNearTo(lab)) {
        creep.travelTo(lab);
    }
    lab.boostCreep(creep);
    return true;
}

// A defender spawned with 1 MOVE per 4 parts (spawn.BuildCreeps5.buildOptimalDefender, only with
// XZHO2 ready in a lab: memory.moveBoost) boosts its MOVE first, whatever the enemy: unboosted it
// crawls. The lab gone or short: it gives up and fights as it is.
function boostMove(creep) {
    if (!creep.memory.moveBoost) return false;
    const unboosted = creep.body.filter(part => part.type == MOVE && !part.boost).length;
    const lab = unboosted && runtimeCache.find(creep.room, FIND_MY_STRUCTURES, {
        filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE)
    })[0];
    if (!unboosted || !lab || lab.mineralAmount < unboosted * LAB_BOOST_MINERAL || lab.energy < unboosted * LAB_BOOST_ENERGY) {
        delete creep.memory.moveBoost;
        return false;
    }
    if (!creep.pos.isNearTo(lab)) creep.travelTo(lab);
    else lab.boostCreep(creep);
    return true;
}

function idle(creep) {
    creep.memory.waitingTimer = (creep.memory.waitingTimer || 0) + 1;
    if (creep.memory.waitingTimer >= 10) {
        let homeSpawn = Game.getObjectById(creep.memory.fromSpawn)
        if (homeSpawn && !creep.pos.inRangeTo(homeSpawn, 2)) {
            creep.travelTo(homeSpawn, {
                maxRooms: 1,
                range: 2
            })
        }
    }
    //Move out of the way
    let talkingCreeps = creep.pos.findInRange(FIND_MY_CREEPS, 1, {
        filter: (thisCreep) => (creep.id != thisCreep.id && thisCreep.saying)
    })
    if (talkingCreeps.length) {
        let coords = talkingCreeps[0].saying.split(";");
        if (coords.length == 2 && creep.pos.x == parseInt(coords[0]) && creep.pos.y == parseInt(coords[1])) {
            //Standing in the way of a creep
            let thisDirection = creep.pos.getDirectionTo(talkingCreeps[0].pos);
            creep.move(thisDirection);
            creep.say("💦", true);
        }
    }
}

// Shared with the power creep (taking cover on ramparts).
creep_combat.rampartPosts = rampartPosts;
creep_combat.exposeThreatZones = exposeThreatZones;
creep_combat.choosePost = choosePost;
creep_combat.notePostProgress = notePostProgress;
creep_combat.POST_STUCK = POST_STUCK;

module.exports = creep_combat;
