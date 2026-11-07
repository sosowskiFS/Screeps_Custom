const speech = require('creep.speech');
const runtimeCache = require('runtime.cache');
const combat = require('combat.tactics');
const combatIntel = require('combat.intel');
const defenseWatch = require('defense.watch');

// Room defender: fights from the rampart network.
//  * Posts are planned for all of a room's defenders together each tick (planPosts): every rampart, and
//    an open tile inside the rampart ring within range of the enemy that no hostile can hit this tick or
//    that the defender can tank (exposeThreatZones' rule), goes to the defender it costs least. Never a
//    tile outside the ring, and its paths never cross outside either (insideRing): out there E23N31's
//    defenders were cut up chasing a quad. A room whose ring is not closed keeps them on ramparts. The best spot by the enemy goes
//    to whoever is nearest it, the next to whoever is nearest that: a line of defenders runs along a line
//    of ramparts after the enemy, each a step or two, instead of the one furthest away crossing open
//    ground. Chasing keeps the enemy moving, off any one wall (shardX E23N31).
//  * In range (3) of its target a defender stays put unless another tile is clearly better; out of range
//    it moves along the ramparts towards it, and never onto open ground.
//  * Split cover (coverPlan): with more than one enemy group damaging the walls, the defenders are shared
//    out by each group's wall damage (combat.intel.wallThreat: what it hits the walls for, seen in the
//    event log, or its dismantling and melee beside them), nearest first and keeping their group from
//    tick to tick. A group only gets defenders enough, with the towers, to beat its healing: fewer and
//    it backs off a step and keeps shooting the wall from range 3 (E23N31's north quad, 2 defenders on
//    a pair of 38-HEAL healers). Groups the rest cannot beat get none. Each covers its group: posts by it, and its fire on it when in range.
//    Keeping the walls up matters more than chasing a kill on a squad that runs as soon as it is losing.
//  * Sortie (sortieTarget): the one exception. A controller outside the base ring, a group breaking the
//    walls round it, and nothing else armed in the room: the defenders go out and skirmish (in to range
//    3, fire, step back out of reach) to force the breakers off. Any other armed group anywhere in the
//    room, or a defender below half its hits, and they go straight back to the ring.
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

        const sortie = sortieTarget(room, intel);
        if (sortie && skirmish(creep, room, intel, sortie)) return;

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
        // Its own group's worst wall-breaker first when it is in reach (split cover), else the shared focus.
        const cover = coverPlan(room, intel).get(creep.id);
        const harabi = cover ? null : require('combat.harabi').anchor(room);
        const mine = cover || (harabi && harabi.target);
        combat.act(creep, room, mine && creep.pos.inRangeTo(mine, 3) ? mine : focus);
    }
};

// ---------------------------------------------------------------- split cover
// Defenders of average damage `each` a group needs, with the towers, to beat the healing on its easiest
// member (defense.staffing's rule: MARGIN over the healing, through boosted TOUGH). At least 1.
function groupNeed(room, intel, group, each) {
    const staffing = require('defense.staffing');
    const towers = runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } })
        .filter(t => !t.store || (t.store[RESOURCE_ENERGY] || 0) >= 10);
    let best = Infinity;
    for (const t of group.members) {
        const required = combatIntel.supportHealing(t, intel) * staffing.MARGIN / staffing.toughFactor(t);
        const tower = towers.reduce((n, tw) => n + staffing.towerDamage(Math.max(Math.abs(tw.pos.x - t.pos.x), Math.abs(tw.pos.y - t.pos.y))), 0);
        best = Math.min(best, Math.max(0, required - tower));
    }
    return Math.max(1, Math.ceil(best / Math.max(1, each)));
}
// Enemy groups (threats within GROUP_LINK of one another) and their wall damage; defenders shared out
// among the groups doing damage, by it: one each first (nearest), the rest in proportion. Returns
// Map(defender id -> the group's worst wall-breaker), empty with fewer than two such groups (then the
// shared focus leads everyone, as before). Defenders keep their group (memory.cover) while it still
// needs them.
const GROUP_LINK = 3;
function enemyGroups(room, intel) {
    const threats = intel.threats.filter(t => !combatIntel.onExit(t.pos));
    const group = threats.map((_, i) => i);
    const find = i => (group[i] === i ? i : (group[i] = find(group[i])));
    for (let i = 0; i < threats.length; i++) for (let j = i + 1; j < threats.length; j++) {
        if (Math.max(Math.abs(threats[i].pos.x - threats[j].pos.x), Math.abs(threats[i].pos.y - threats[j].pos.y)) <= GROUP_LINK) group[find(i)] = find(j);
    }
    const out = new Map();
    threats.forEach((t, i) => {
        const k = find(i);
        if (!out.has(k)) out.set(k, { members: [], pressure: 0, lead: null, leadRate: 0 });
        const g = out.get(k);
        g.members.push(t);
        const rate = combatIntel.wallThreat(t, room);
        g.pressure += rate;
        if (rate > g.leadRate) { g.leadRate = rate; g.lead = t; }
    });
    return [...out.values()];
}
function coverPlan(room, intel) {
    const tick = runtimeCache.current();
    const cache = tick.cover || (tick.cover = Object.create(null));
    if (cache[room.name]) return cache[room.name];
    const plan = new Map();
    cache[room.name] = plan;
    // Whoever is not given a group this tick has none (memory.cover is only a preference to keep one).
    const before = new Map();
    for (const c of runtimeCache.find(room, FIND_MY_CREEPS)) if (c.memory && c.memory.cover) { before.set(c.id, c.memory.cover); delete c.memory.cover; }
    let groups = enemyGroups(room, intel).filter(g => g.pressure > 0).sort((a, b) => b.pressure - a.pressure);
    if (groups.length < 2) return plan;
    const defenders = runtimeCache.find(room, FIND_MY_CREEPS).filter(c => c.memory && c.memory.priority === 'defender' && !c.spawning);
    if (defenders.length < 2) return plan;
    // Defenders each group needs to beat its healing, with the towers on it.
    const each = defenders.reduce((n, c) => n + combatIntel.assess(c).dps, 0) / defenders.length;
    const need = g => groupNeed(room, intel, g, each);
    const chosen = [], shares = [];
    let left = defenders.length;
    for (const g of groups) {
        const k = need(g);
        if (k > left) continue;
        chosen.push(g);
        shares.push(k);
        left -= k;
    }
    // Two or more groups it can beat at once, or no split at all: then the shared focus leads everyone.
    if (chosen.length < 2) return plan;
    groups = chosen;
    while (left > 0) {
        // The group with the most wall damage per defender gets the next one.
        let best = 0;
        for (let i = 1; i < groups.length; i++) if (groups[i].pressure / (shares[i] + 1) > groups[best].pressure / (shares[best] + 1)) best = i;
        shares[best]++;
        left--;
    }
    const free = new Set(defenders);
    const dist = (c, g) => Math.min(...g.members.map(t => Math.max(Math.abs(t.pos.x - c.pos.x), Math.abs(t.pos.y - c.pos.y))));
    groups.forEach((g, i) => {
        const ids = new Set(g.members.map(t => t.id));
        const pick = [...free].sort((a, b) => ((ids.has(before.get(a.id)) ? -100 : 0) + dist(a, g)) - ((ids.has(before.get(b.id)) ? -100 : 0) + dist(b, g)))
            .slice(0, shares[i]);
        for (const c of pick) {
            free.delete(c);
            plan.set(c.id, g.lead);
            c.memory.cover = g.lead.id;
        }
    });
    return plan;
}

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
    const cover = creep.room ? coverPlan(creep.room, intel).get(creep.id) : null;
    if (cover) {
        creep.memory.anchor = { x: cover.pos.x, y: cover.pos.y, t: Game.time };
        return cover;
    }
    // Against Harabi: all on his one committed squad, by the tile its speaker left when it pulls back to
    // heal (it comes straight back), instead of after each squad in turn (combat.harabi).
    const harabi = creep.room ? require('combat.harabi').anchor(creep.room) : null;
    if (harabi) return { pos: harabi.pos };
    const inside = list => list.filter(t => !combatIntel.onExit(t.pos));
    let anchor = focus && !combatIntel.onExit(focus.pos) ? focus : null;
    if (!anchor) {
        const threats = inside(intel.threats);
        const pool = threats.length ? threats : inside(intel.hostiles);
        anchor = pool.length ? nearestOf(pool, creep.pos) : null;
    }
    if (anchor) {
        creep.memory.anchor = { x: anchor.pos.x, y: anchor.pos.y, t: Game.time };
        return anchor;
    }
    const last = creep.memory.anchor;
    if (last && Game.time - last.t <= ANCHOR_KEEP) return { pos: { x: last.x, y: last.y } };
    const any = intel.threats.length ? intel.threats : intel.hostiles;
    return any.length ? nearestOf(any, creep.pos) : null;
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

// ---------------------------------------------------------------- controller sortie
// The breaker to go out after, or null. Deliberately narrow, because leaving the ring is the risk: another
// group of rangers in the room would close on defenders in the open and cut them down.
//   - the ring is closed and the controller is outside it (a creep can walk to it from an exit);
//   - some hostile is breaking a wall or rampart next to the controller (wallThreat: dismantling or melee
//     beside it; rangers firing as they pass do not count), for SORTIE_CONFIRM ticks running;
//   - every armed hostile in the room is with that group (within GROUP_RANGE of one of its breakers);
//   - the defenders, without the towers, are not outmatched by the group.
const SORTIE_CONFIRM = 5;
const GROUP_RANGE = 4;
const SORTIE_RETREAT = 0.5;      // of its hits: back to the ring to be healed
const sortieSeen = Object.create(null);    // room -> first tick the controller was being broken
function sortieTarget(room, intel) {
    const tick = runtimeCache.current();
    const cache = tick.sortie || (tick.sortie = Object.create(null));
    if (cache[room.name] !== undefined) return cache[room.name];
    const done = target => {
        if (!target) delete sortieSeen[room.name];
        return (cache[room.name] = target);
    };
    const c = room.controller;
    if (!c || !c.pos || !intel.threats.length) return done(null);
    const outside = insideRing(room);
    if (!outside) return done(null);
    const cx = c.pos.x, cy = c.pos.y;
    let open = false;
    for (let dx = -1; dx <= 1 && !open; dx++) for (let dy = -1; dy <= 1 && !open; dy++) if (outside[(cx + dx) * 50 + cy + dy]) open = true;
    // Its walls: our ramparts and walls within 1 of it.
    const walls = new Set();
    for (const s of runtimeCache.find(room, FIND_STRUCTURES)) {
        if (!((s.structureType === STRUCTURE_RAMPART && s.my) || s.structureType === STRUCTURE_WALL)) continue;
        if (Math.max(Math.abs(s.pos.x - cx), Math.abs(s.pos.y - cy)) <= 1) walls.add(s.pos.x * 50 + s.pos.y);
    }
    // The walls themselves may be what makes the controller inside: outside the ring is what matters.
    if (!open) for (const k of walls) for (let dx = -1; dx <= 1 && !open; dx++) for (let dy = -1; dy <= 1 && !open; dy++) {
        if (outside[k + dx * 50 + dy]) open = true;
    }
    if (!open || !walls.size) return done(null);
    const besideWall = t => {
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if ((dx || dy) && walls.has((t.pos.x + dx) * 50 + t.pos.y + dy)) return true;
        return false;
    };
    const breakers = intel.threats.filter(t => combatIntel.wallThreat(t, room) > 0 && besideWall(t));
    if (!breakers.length) return done(null);
    const group = intel.threats.filter(t => breakers.some(b => Math.max(Math.abs(b.pos.x - t.pos.x), Math.abs(b.pos.y - t.pos.y)) <= GROUP_RANGE));
    if (group.length !== intel.threats.length) return done(null);
    const defenders = runtimeCache.find(room, FIND_MY_CREEPS).filter(d => d.memory && d.memory.priority === 'defender' && !d.spawning);
    if (!defenders.length) return done(null);
    const us = { dps: 0, heal: 0, ehp: 0 }, them = { dps: 0, heal: 0, ehp: 0 };
    for (const d of defenders) { const st = combatIntel.assess(d); us.dps += st.dps; us.heal += st.heal; us.ehp += st.ehp; }
    for (const t of group) { const st = combatIntel.assess(t); them.dps += st.dps; them.heal += st.heal; them.ehp += st.ehp; }
    if (combatIntel.verdictFor(us, them) === 'lose') return done(null);
    if (sortieSeen[room.name] === undefined) sortieSeen[room.name] = Game.time;
    if (Game.time - sortieSeen[room.name] < SORTIE_CONFIRM) return (cache[room.name] = null);
    let best = breakers[0];
    for (const b of breakers) if (combatIntel.wallThreat(b, room) > combatIntel.wallThreat(best, room)) best = b;
    return (cache[room.name] = best);
}

// In to range 3 of the breaker, fire, and step back out of the group's reach the same tick: they get a
// shot in every other tick at most, it gets pushed off the wall. True when it handled the defender.
function skirmish(creep, room, intel, target) {
    if (creep.hits < creep.hitsMax * SORTIE_RETREAT) return false;      // back to the ring, the towers heal
    creep.memory.atSpot = false;
    const reach = t => { const st = combatIntel.assess(t); return st.ranged > 0 ? 3 : st.melee > 0 ? 1 : 0; };
    const danger = intel.threats.filter(t => {
        const r = reach(t);
        return r && Math.max(Math.abs(t.pos.x - creep.pos.x), Math.abs(t.pos.y - creep.pos.y)) <= r + 1;
    });
    const range = Math.max(Math.abs(target.pos.x - creep.pos.x), Math.abs(target.pos.y - creep.pos.y));
    if (range <= 3) {
        combat.act(creep, room, target);
        if (danger.length) combat.flee(creep, danger);
    } else {
        creep.travelTo(target, { range: 3, maxRooms: 1 });
        combat.act(creep, room, target);
    }
    return true;
}

// This defender's tile from the room's plan (planPosts), or null.
function choosePost(creep, room, posts, intel, focus) {
    const plan = planPosts(room, posts, intel, focus);
    return plan.get(creep.id) || null;
}

const FIRE_RANGE = 3;
const OUT_OF_RANGE = 100;        // any tile in range beats any tile out of it
const OPEN_COST = 25;            // an open tile in range: only where no rampart in range is free
const OPEN_DAMAGE_COST = 20;     // ...and more the more of the tank budget it would take
// Its own tile, while in range: less than a step nearer the enemy is worth (IN_RANGE_STEP), so a defender
// holding an inner rampart moves up to a free one in front and leaves its tile for the next one in. They sat
// on the ramparts nearest the core instead, and defenders arriving later had to path round to worse posts.
const STAY = 4;
const IN_RANGE_STEP = 8;
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

function nearestOf(list, pos) {
    let best = null, d = Infinity;
    for (const o of list) { const r = cheb(o.pos, pos); if (r < d) { d = r; best = o; } }
    return best;
}

// What a tile costs a defender. In range of its anchor: nearer is better (mass attack at range 1),
// then a short walk; out of range: as near as the ramparts go.
// Next to enemies a ranged mass attack hits each of them for full damage (10 a part at range 1, 4 at 2,
// 1 at 3): every hostile adjacent to the tile is worth more than staying put. A defender sat a step from a
// free rampart beside the squad instead (shardX E23N31). Ramparts only: on open ground next to them it would
// be the one taking the full force.
const ADJACENT_BONUS = 20;
function tileCost(creep, tile, anchor, extra, threats = [], depth = 0) {
    const dist = cheb(tile, anchor.pos);
    const travel = cheb(tile, creep.pos);
    const inRange = dist <= FIRE_RANGE;
    let cost = (inRange ? dist * IN_RANGE_STEP : OUT_OF_RANGE + dist * 10) + travel + extra;
    if (inRange && tile.x === creep.pos.x && tile.y === creep.pos.y) cost -= STAY;
    // Next to an enemy at all: the bonus once. Counting each one held a defender beside two of them on a
    // rampart that blocked the way to two more beside one.
    if (threats.some(t => cheb(tile, t.pos) <= 1)) cost -= ADJACENT_BONUS;
    if (inRange && depth) cost -= depth * DEPTH_STEP;
    return cost;
}

// Share of a defender's ranged parts that are boosted (0 to 1).
const BOOSTED_FIRST = 1000;
function boostedShare(creep) {
    let all = 0, boosted = 0;
    for (const p of creep.body || []) if (p.type === RANGED_ATTACK) { all++; if (p.boost) boosted++; }
    return all ? boosted / all : 0;
}

// Ramparts are often reached only along other ramparts: the open tiles beside them are in the enemy's
// reach. How deep each post is in its chain: rampart steps from a post next to safe open ground (an
// entrance). Deeper in range is better, so defenders fill a chain from its far end and leave the
// entrance free for the next one in. In E23N31 a defender held the middle of the x=24 chain beside the
// attackers, and two ramparts beyond it, just as close to them, stayed empty: nobody could get past.
const DEPTH_STEP = 5;
function postDepths(room, posts, damage, terrain, blocked) {
    const depth = new Map();
    if (!terrain) return depth;
    const keys = new Set(posts.map(p => p.x * 50 + p.y));
    const queue = [];
    for (const p of posts) {
        let entrance = false;
        for (let dx = -1; dx <= 1 && !entrance; dx++) for (let dy = -1; dy <= 1 && !entrance; dy++) {
            const x = p.x + dx, y = p.y + dy, k = x * 50 + y;
            if ((!dx && !dy) || x < 1 || y < 1 || x > 48 || y > 48 || keys.has(k)) continue;
            if (terrain.get(x, y) & TERRAIN_MASK_WALL || blocked.has(k)) continue;
            if (!(damage.get(k) > 0)) entrance = true;
        }
        if (entrance) { depth.set(p.x * 50 + p.y, 0); queue.push(p); }
    }
    for (let head = 0; head < queue.length; head++) {
        const p = queue[head], d = depth.get(p.x * 50 + p.y);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
            const k = (p.x + dx) * 50 + p.y + dy;
            if ((!dx && !dy) || !keys.has(k) || depth.has(k)) continue;
            depth.set(k, d + 1);
            queue.push({ x: p.x + dx, y: p.y + dy });
        }
    }
    return depth;
}

// Damage hostiles can deal on each open tile this tick (ramparts excepted), cached per room per tick.
function threatDamage(room, intel) {
    const tick = runtimeCache.current();
    const cache = tick.threatDamage || (tick.threatDamage = Object.create(null));
    if (cache[room.name]) return cache[room.name];
    const ramparts = rampartKeys(room);
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
    return (cache[room.name] = damage);
}
function rampartKeys(room) {
    const state = runtimeCache.current().rampartPosts;
    if (!state || !state[room.name]) rampartPosts(room);
    return runtimeCache.current().rampartPosts[room.name].keys;
}
// An open tile a defender can stand on to fire from: nobody can hit it, or it can tank it.
function tankable(creep, hit) {
    return !hit || (creep.hits > 0 && hit * TANK_TICKS <= creep.hits * TANK_SHARE);
}

// The tiles outside the rampart ring (reachable from the exits without crossing our ramparts or walls),
// or null when the ring is not closed (then nothing counts as inside). Cached a few ticks.
const RING_TTL = 5;
const ringCache = Object.create(null);
function insideRing(room) {
    const hit = ringCache[room.name];
    if (hit && Game.time - hit.t < RING_TTL && Game.time >= hit.t) return hit.outside;
    let outside = null;
    try {
        const f = require('system.safeMode').flood(room);
        outside = f && !f.open ? f.outside : null;
    } catch (e) {
        outside = null;
    }
    ringCache[room.name] = { t: Game.time, outside };
    return outside;
}

// Every defender in the room, its tile. Cheapest pairing first, so each tile goes to the defender it
// suits best and each defender to its best free tile. Open tiles only in range of the enemy, never
// during a border drain (that is what the drainer wants), and only where a creep can stand.
function planPosts(room, posts, intel, focus) {
    const tick = runtimeCache.current();
    const cache = tick.defensePlan || (tick.defensePlan = Object.create(null));
    if (cache[room.name]) return cache[room.name];
    const plan = new Map();
    cache[room.name] = plan;
    const defenders = runtimeCache.find(room, FIND_MY_CREEPS).filter(c => c.memory && c.memory.priority === 'defender' && !c.spawning);
    const draining = defenseWatch.isDraining(room.name);
    const rampart = rampartKeys(room);
    let blocked = null, terrain = null, damage = null;
    const outside = draining ? null : insideRing(room);
    if (outside && typeof room.getTerrain === 'function') {
        terrain = room.getTerrain();
        damage = threatDamage(room, intel);
        blocked = new Set();
        for (const s of runtimeCache.find(room, FIND_STRUCTURES)) {
            if (s.structureType !== STRUCTURE_ROAD && s.structureType !== STRUCTURE_CONTAINER && s.structureType !== STRUCTURE_RAMPART) blocked.add(s.pos.x * 50 + s.pos.y);
        }
        for (const c of runtimeCache.find(room, FIND_CREEPS)) if (!(c.my && c.memory && c.memory.priority === 'defender')) blocked.add(c.pos.x * 50 + c.pos.y);
    }
    const depths = terrain ? postDepths(room, posts, damage, terrain, blocked) : new Map();
    const pairs = [];
    for (const creep of defenders) {
        const anchor = postAnchor(creep, intel, focus);
        if (!anchor) continue;
        // Boosted defenders pick first: the best tile is theirs even with an unboosted one standing on it,
        // who is given another and steps aside along the chain (Traveler swaps with a defender off its post).
        const lead = -BOOSTED_FIRST * boostedShare(creep);
        const own = creep.pos.x * 50 + creep.pos.y;
        const bad = creep.memory.badPosts || {};
        for (const key in bad) if (bad[key] <= Game.time) delete bad[key];
        if (creep.memory.badPosts && !Object.keys(bad).length) delete creep.memory.badPosts;
        for (const post of posts) {
            const key = post.x * 50 + post.y;
            if (bad[key] > Game.time && key !== own) continue;
            pairs.push([tileCost(creep, post, anchor, 0, intel.threats, depths.get(key) || 0) + lead, creep.id, key, post]);
        }
        if (!terrain) continue;
        for (let x = Math.max(1, anchor.pos.x - FIRE_RANGE); x <= Math.min(48, anchor.pos.x + FIRE_RANGE); x++) {
            for (let y = Math.max(1, anchor.pos.y - FIRE_RANGE); y <= Math.min(48, anchor.pos.y + FIRE_RANGE); y++) {
                const key = x * 50 + y;
                if (rampart.has(key) || blocked.has(key) || outside[key] || terrain.get(x, y) & TERRAIN_MASK_WALL) continue;
                if (bad[key] > Game.time && key !== own) continue;
                const hit = damage.get(key) || 0;
                if (!tankable(creep, hit)) continue;
                const share = hit && creep.hits ? (hit * TANK_TICKS) / (creep.hits * TANK_SHARE) : 0;
                pairs.push([tileCost(creep, { x, y }, anchor, OPEN_COST + share * OPEN_DAMAGE_COST) + lead, creep.id, key, { x, y, open: true }]);
            }
        }
    }
    pairs.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
    const taken = new Set();
    for (const [, id, key, tile] of pairs) {
        if (plan.has(id) || taken.has(key)) continue;
        plan.set(id, tile);
        taken.add(key);
    }
    return plan;
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
    const damage = threatDamage(room, intel);
    const budget = creep && creep.hits ? creep.hits * TANK_SHARE : 0;
    for (const [key, hit] of damage) {
        const x = Math.floor(key / 50), y = key % 50;
        if (budget && hit * TANK_TICKS <= budget) {
            if (matrix.get(x, y) < EXPOSED_COST) matrix.set(x, y, EXPOSED_COST);
        } else {
            matrix.set(x, y, 0xff);
        }
    }
    // Never out past the ring (a defender caught outside may still find its way back in).
    const outside = insideRing(room);
    if (outside && creep && !outside[creep.pos.x * 50 + creep.pos.y]) {
        const ramparts = rampartKeys(room);
        for (let k = 0; k < 2500; k++) if (outside[k] && !ramparts.has(k)) matrix.set(Math.floor(k / 50), k % 50, 0xff);
    }
    // Defenders on their posts are never walked through (see POST_STUCK).
    for (const other of runtimeCache.find(room, FIND_MY_CREEPS)) {
        if (other.memory && other.memory.priority === 'defender' && other.memory.atSpot) matrix.set(other.pos.x, other.pos.y, 0xff);
    }
    return matrix;
}

// XKHO2 on as many ranged parts as the fight needs (RCL6+): defense.staffing.boostShortfall, less what the
// room's other defenders are already on their way to boost (memory.boostParts), looked at every 10 ticks.
// None while the defenders and towers out-damage the enemy's healing as they are.
function handleBoosting(creep, intel) {
    if (creep.room.controller.level < 6) return false;
    if (boostMove(creep)) return true;
    const unboosted = creep.body.filter(part => part.type == RANGED_ATTACK && !part.boost).length;
    if (!unboosted) {
        delete creep.memory.boostParts;
        return false;
    }
    if (creep.memory.boostParts === undefined || Game.time % 10 == 0) {
        const short = require('defense.staffing').boostShortfall(creep.room);
        const pending = runtimeCache.find(creep.room, FIND_MY_CREEPS)
            .filter(c => c !== creep && c.memory && c.memory.priority === 'defender' && c.memory.boostParts > 0)
            .reduce((n, c) => n + c.memory.boostParts, 0);
        creep.memory.boostParts = Math.max(0, Math.min(unboosted, short - pending));
    }
    const parts = creep.memory.boostParts;
    creep.memory.needBoosts = parts > 0;
    if (!parts) return false;
    // Any ranged boost a lab holds (defense.rangedBoost: XKHO2, else KHO2, else KO), the best first, for
    // as many of the parts as it holds mineral and energy for.
    const rangedBoost = require('defense.rangedBoost');
    const can = l => Math.min(parts, Math.floor((l.mineralAmount || 0) / LAB_BOOST_MINERAL), Math.floor((l.energy || 0) / LAB_BOOST_ENERGY));
    const lab = runtimeCache.find(creep.room, FIND_MY_STRUCTURES, {
        filter: (structure) => structure.structureType == STRUCTURE_LAB && rangedBoost.isRanged(structure.mineralType)
    }).filter(l => can(l) > 0).sort((a, b) => rangedBoost.multOf(b.mineralType) - rangedBoost.multOf(a.mineralType))[0];
    if (!lab) {
        // The lab worker is loading a lab that was reacting (system.labLayout): fight until it is ready.
        if (!require('system.labLayout').boostPending(creep.room, rangedBoost.forRoom(creep.room), parts * LAB_BOOST_MINERAL)) {
            creep.memory.needBoosts = false;
            creep.memory.boostParts = 0;
        }
        return false;
    }
    if (!creep.pos.isNearTo(lab)) {
        creep.travelTo(lab);
        return true;
    }
    if (lab.boostCreep(creep, can(lab)) === OK) creep.memory.boostParts = 0;
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
creep_combat.planPosts = planPosts;
creep_combat.sortieTarget = sortieTarget;
creep_combat.coverPlan = coverPlan;
creep_combat.skirmish = skirmish;
creep_combat.notePostProgress = notePostProgress;
creep_combat.POST_STUCK = POST_STUCK;
creep_combat.handleBoosting = handleBoosting;

module.exports = creep_combat;
