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
var creep_combat = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (Memory.roomsUnderAttack.indexOf(creep.room.name) == -1) {
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
            combat.fight(creep);
            return;
        }

        const post = choosePost(creep, room, posts, intel, focus);
        if (post && !(creep.pos.x === post.x && creep.pos.y === post.y)) {
            creep.travelTo(new RoomPosition(post.x, post.y, room.name), {
                maxRooms: 1,
                range: 0,
                roomCallback: (roomName, matrix) => roomName === room.name ? exposeThreatZones(room, intel, matrix) : matrix,
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
    if (picked && picked.pos.roomName === room.name) {
        return picked;
    }
    return combatIntel.focusTarget(room);
}

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
    const anchor = focus || (intel.threats.length ? creep.pos.findClosestByRange(intel.threats) : creep.pos.findClosestByRange(intel.hostiles));
    if (!anchor) return null;
    const occupiedByDefender = new Set();
    for (const other of runtimeCache.find(room, FIND_MY_CREEPS, { filter: c => c.memory.priority === 'defender' && c.id !== creep.id })) {
        occupiedByDefender.add(other.pos.x * 50 + other.pos.y);
    }
    const currentKey = creep.pos.x * 50 + creep.pos.y;
    let best = null, bestScore = Infinity;
    for (const post of posts) {
        const key = post.x * 50 + post.y;
        if (state.claimed.has(key) || (occupiedByDefender.has(key) && key !== currentKey)) continue;
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

// Path cost matrix for moving between posts: open tiles a hostile can hit this tick are walls.
function exposeThreatZones(room, intel, matrix) {
    const ramparts = runtimeCache.current().rampartPosts[room.name].keys;
    for (const threat of intel.threats) {
        const stats = combatIntel.assess(threat);
        const reach = stats.ranged > 0 ? 3 : (stats.melee > 0 ? 1 : 0);
        if (!reach) continue;
        for (let x = Math.max(1, threat.pos.x - reach); x <= Math.min(48, threat.pos.x + reach); x++) {
            for (let y = Math.max(1, threat.pos.y - reach); y <= Math.min(48, threat.pos.y + reach); y++) {
                if (!ramparts.has(x * 50 + y)) matrix.set(x, y, 0xff);
            }
        }
    }
    return matrix;
}

// Boost ranged parts with XKHO2 when boosted attackers show up (RCL6+), as before.
function handleBoosting(creep, intel) {
    if (creep.room.controller.level < 6) return false;
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

module.exports = creep_combat;
