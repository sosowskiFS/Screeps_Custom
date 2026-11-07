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
const runtimeCache = require('runtime.cache');

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

// Terrain costs for this creep's own body: ticks a step takes on plain and swamp ground. A fixed 2/10
// sent creeps with few MOVE parts, or loaded haulers, fleeing into swamp, where each step took several
// ticks and they were caught there. Fatigue a step: 2 (plain) or 10 (swamp) per part that weighs (not
// MOVE, not an empty CARRY); each MOVE part takes off 2 a tick (x its boost).
const MAX_COST = 250;
function terrainCosts(creep) {
    let weight = 0, move = 0;
    let carrying = creep.store && typeof creep.store.getUsedCapacity === 'function' ? creep.store.getUsedCapacity() : 0;
    for (const part of creep.body || []) {
        if (part.type === MOVE) {
            if (part.hits > 0) {
                const b = part.boost && typeof BOOSTS !== 'undefined' && BOOSTS[MOVE] && BOOSTS[MOVE][part.boost];
                move += (b && b.fatigue) || 1;
            }
            continue;
        }
        if (part.type === CARRY) {
            if (carrying <= 0) continue;
            carrying -= (typeof CARRY_CAPACITY === 'number' ? CARRY_CAPACITY : 50);
        }
        weight++;
    }
    const ticks = factor => (move > 0 ? Math.max(1, Math.ceil(weight * factor / (move * 2))) : MAX_COST);
    return { plainCost: Math.min(MAX_COST, ticks(2) * 2), swampCost: Math.min(MAX_COST, ticks(10) * 2) };
}

// Flee from every given threat at once (not just the nearest), staying inside the room.
function flee(creep, threats) {
    const goals = threats.map(threat => ({ pos: threat.pos, range: fleeRange(intel.assess(threat)) }));
    const result = PathFinder.search(creep.pos, goals, Object.assign({
        flee: true,
        maxRooms: 1,
        roomCallback: roomName => {
            const room = Game.rooms[roomName];
            // Read-only use of Traveler's per-tick matrix (structures + creeps).
            return room ? Traveler.getCreepMatrix(room) : undefined;
        },
    }, terrainCosts(creep)));
    if (result.path.length) {
        creep.move(creep.pos.getDirectionTo(result.path[0]));
        return true;
    }
    return false;
}

// ---------------------------------------------------------------- civilian escape
// Armed hostiles in a room (they can damage a non-combat creep).
function armedThreats(room) {
    return room ? intel.roomIntel(room).threats.filter(t => intel.assess(t).dps > 0) : [];
}

// Armed hostiles that matter to a creep in `roomName`: those in it, and those in the visible rooms
// across its borders, placed in this room's coordinates as if the border were not there (a hostile
// on the next room's edge tile counts as on ours: one step brings it in). A worker that fled over a
// border used to stop right behind it, and was shot again as soon as its attacker followed.
// Returns { t, x, y } (x, y may lie outside 0..49).
const ACROSS = { 1: [0, -49], 3: [49, 0], 5: [0, 49], 7: [-49, 0] };
function threatsAround(roomName) {
    const list = armedThreats(Game.rooms[roomName]).map(t => ({ t, x: t.pos.x, y: t.pos.y }));
    const exits = (Game.map.describeExits && Game.map.describeExits(roomName)) || {};
    for (const dir in exits) {
        const next = Game.rooms[exits[dir]], shift = ACROSS[dir];
        if (!next || !shift) continue;
        for (const t of armedThreats(next)) list.push({ t, x: t.pos.x + shift[0], y: t.pos.y + shift[1] });
    }
    return list;
}

// Mark every tile an armed hostile (in this room or seen just across its borders) could hit next
// tick (its reach plus the step it can take) on `matrix`, with `cost`; at least its flee range
// (fleeRange), so a path around it never comes close enough to set off escape(). It was one short
// for rangers (4 against 5): shardX W1N9's far miner and hauler, routed along the edge, fled every
// other tick and went back and forth for good. Rooms out of sight are left as they are.
function markDanger(roomName, matrix, cost = 255) {
    if (!Game.rooms[roomName] || !matrix) return matrix;
    for (const { t, x: tx, y: ty } of threatsAround(roomName)) {
        const stats = intel.assess(t);
        const reach = Math.max((stats.ranged > 0 ? 3 : 1) + 1, fleeRange(stats));
        for (let dx = -reach; dx <= reach; dx++) {
            for (let dy = -reach; dy <= reach; dy++) {
                const x = tx + dx, y = ty + dy;
                if (x >= 0 && y >= 0 && x <= 49 && y <= 49 && matrix.get(x, y) < cost) matrix.set(x, y, cost);
            }
        }
    }
    return matrix;
}

// Traveler roomCallback: route around the reach of armed hostiles in every visible room.
function avoidReach(roomName, matrix) {
    return markDanger(roomName, matrix, 255);
}

// Is it safe to (re-)enter `roomName`? Visible: no armed hostiles in it. Out of sight: not marked
// dangerous recently (combat.intel). A creep that fled a room keeps out while its attackers are
// still seen there.
function unsafeToEnter(roomName) {
    const room = Game.rooms[roomName];
    if (room) return armedThreats(room).length > 0;
    return intel.isDangerous(roomName);
}

// A non-combat creep with an armed hostile close: get away. Preferably to a haven (our tower, a
// guard quad member or room guard in this room) by a path that never enters any hostile's reach;
// otherwise flee from all of them (into the next room if need be), counting hostiles seen in the
// neighbouring rooms too, so it never flees into another one. Returns true when it moved.
function escape(creep) {
    const room = creep.room;
    const around = threatsAround(room.name);
    const near = around.filter(v => Math.max(Math.abs(v.x - creep.pos.x), Math.abs(v.y - creep.pos.y)) <= fleeRange(intel.assess(v.t)));
    if (!near.length) return false;
    const matrixFor = cost => name => {
        const r = Game.rooms[name];
        if (!r) return undefined;
        return markDanger(name, Traveler.getCreepMatrix(r).clone(), cost);
    };
    const havens = runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } })
        .concat(runtimeCache.find(room, FIND_MY_CREEPS).filter(c => c.memory && (c.memory.guardSquad || c.memory.priority === 'roomGuard')))
        .map(h => ({ pos: h.pos, range: 2 }));
    if (havens.length) {
        const safe = PathFinder.search(creep.pos, havens, Object.assign({ maxRooms: 1, maxOps: 2000, roomCallback: matrixFor(255) }, terrainCosts(creep)));
        if (!safe.incomplete && safe.path.length) {
            creep.move(creep.pos.getDirectionTo(safe.path[0]));
            return true;
        }
    }
    // PathFinder measures goals in other rooms across the border itself.
    const goals = around.map(v => ({ pos: v.t.pos, range: fleeRange(intel.assess(v.t)) + 1 }));
    const away = PathFinder.search(creep.pos, goals, Object.assign({ flee: true, maxRooms: 2, roomCallback: matrixFor(50) }, terrainCosts(creep)));
    if (away.path.length) {
        creep.move(creep.pos.getDirectionTo(away.path[0]));
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
        // The shared focus in reach and healed by its side: a single shot on it. Mass attack spreads
        // the damage over a quad whose healers cover all four; breaking one takes every hit landing on
        // the same member. Except beside it: mass attack does the focus full damage at range 1, and
        // the rest of the quad takes some on top. Unhealed groups still take mass attack.
        const focusShot = single && single === focus && intel.supportHealing(focus, roomIntel) > 0 && creep.pos.getRangeTo(focus) > 1;
        if (!allyCritical) {
            if (!focusShot && mass > (single ? me.ranged : 0)) {
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
        // Close all the way on harmless targets, and on any target while no hostile here has melee
        // parts (nothing punishes being close; holding at 3 let a retreating target step out of
        // reach every tick). Otherwise stay at the edge of our reach.
        const meleeHere = threats.some(t => intel.assess(t).melee > 0);
        const range = kiter && focusStats.dps > 0 && meleeHere ? 3 : 1;
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
        // escape(): toward a tower or our guards if that path stays out of every hostile's reach,
        // otherwise away from all of them (neighbouring rooms' hostiles counted too).
        if (escape(creep)) return true;
        if (roomIntel.verdict !== 'win' && creep.room.name === workRoom) {
            goHome(creep);
            return true;
        }
        // Out of reach: carry on, around them (routeAround).
        routeAround(creep);
    }
    if (workRoom && remoteMining.isDisabled(workRoom)) {
        // Remote disabled after player attacks: wait at home (alive) until it is re-enabled.
        if (!goHome(creep)) stepOffBorder(creep);
        return true;
    }
    if (workRoom && workRoom !== creep.room.name && unsafeToEnter(workRoom)) {
        // Wait outside until our guards have dealt with it.
        stepOffBorder(creep);
        return true;
    }
    return false;
}

// ---------------------------------------------------------------- repairing under fire
// While armed hostiles are in the room, a creep repairs only from a tile none of them can hit (ranged
// 3, melee 1, from where they stand): repair() elsewhere is refused (ERR_NOT_IN_RANGE), and the
// travelTo that follows goes to the nearest such tile within REPAIR_RANGE of the structure, around
// their reach. With no such tile it steps out of reach and leaves the structure for later. A W1N9
// builder repaired the ring from 2 tiles inside it, with a ranged quad just outside.
const REPAIR_RANGE = 3;
const OBSTACLES = () => new Set([STRUCTURE_WALL, STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_LINK, STRUCTURE_STORAGE, STRUCTURE_TOWER,
    STRUCTURE_OBSERVER, STRUCTURE_POWER_SPAWN, STRUCTURE_LAB, STRUCTURE_TERMINAL, STRUCTURE_NUKER, STRUCTURE_FACTORY, STRUCTURE_CONTROLLER, STRUCTURE_EXTRACTOR]);

// Tiles (x * 50 + y) an armed hostile in the room can hit where it stands.
// Every place an armed hostile stood in the last SEEN_TICKS ticks counts: border hoppers are in the
// room one tick and out the next, and a danger zone that came and went with them sent W1N9's
// repairers back and forth. Heap: room -> { t, at: { id: [x, y, reach, tick] } }.
const SEEN_TICKS = 10;
const seen = Object.create(null);
function hitTiles(room) {
    const s = seen[room.name] || (seen[room.name] = { t: -1, at: Object.create(null), tiles: null });
    if (s.t !== Game.time) {
        for (const t of armedThreats(room)) s.at[t.id] = [t.pos.x, t.pos.y, intel.assess(t).ranged > 0 ? 3 : 1, Game.time];
        for (const id in s.at) if (Game.time - s.at[id][3] > SEEN_TICKS) delete s.at[id];
        const tiles = new Set();
        for (const id in s.at) {
            const [hx, hy, reach] = s.at[id];
            for (let dx = -reach; dx <= reach; dx++) for (let dy = -reach; dy <= reach; dy++) {
                const x = hx + dx, y = hy + dy;
                if (x >= 0 && y >= 0 && x <= 49 && y <= 49) tiles.add(x * 50 + y);
            }
        }
        s.t = Game.time;
        s.tiles = tiles;
    }
    return s.tiles;
}


// Tiles a creep cannot stand on (x * 50 + y): obstacle structures, others' ramparts, creeps. Per
// room per tick.
const standCache = Object.create(null);
function unstandable(room) {
    const c = standCache[room.name];
    if (c && c.t === Game.time) return c.tiles;
    const tiles = new Set();
    const obstacles = OBSTACLES();
    for (const s of runtimeCache.find(room, FIND_STRUCTURES)) {
        if (obstacles.has(s.structureType) || (s.structureType === STRUCTURE_RAMPART && !s.my && !s.isPublic)) tiles.add(s.pos.x * 50 + s.pos.y);
    }
    for (const c2 of runtimeCache.find(room, FIND_CREEPS)) tiles.add(c2.pos.x * 50 + c2.pos.y);
    standCache[room.name] = { t: Game.time, tiles };
    return tiles;
}

// Nearest tile to the creep within range of target that no hostile can hit and a creep can stand
// on (its own tile included), or null.
function safeWorkTile(creep, target, range, danger) {
    const room = creep.room;
    const terrain = room.getTerrain();
    const blocked = unstandable(room);
    const own = creep.pos.x * 50 + creep.pos.y;
    const p = target.pos || target;
    let best = null, bestRange = Infinity;
    for (let x = Math.max(1, p.x - range); x <= Math.min(48, p.x + range); x++) {
        for (let y = Math.max(1, p.y - range); y <= Math.min(48, p.y + range); y++) {
            const k = x * 50 + y;
            if (danger.has(k) || (blocked.has(k) && k !== own) || (terrain.get(x, y) & TERRAIN_MASK_WALL)) continue;
            const r = Math.max(Math.abs(x - creep.pos.x), Math.abs(y - creep.pos.y));
            if (r < bestRange) { best = { x, y }; bestRange = r; }
        }
    }
    return best;
}

// Barriers worth repairing that can be worked from a safe tile, weakest first: what a repairer turns
// to when its target cannot be (W1N9: repairers kept heading for a ring rampart inside a quad's
// reach, fled, and came back, never picking another). Unworkable ones are skipped BLOCKED_TICKS.
const ALT_SCAN = 20;
const BLOCKED_TICKS = 25;
const blockedRepairs = Object.create(null);
function reachableRepair(creep, danger, exclude) {
    const room = creep.room;
    const b = blockedRepairs[room.name] || (blockedRepairs[room.name] = Object.create(null));
    if (exclude) b[exclude] = Game.time + BLOCKED_TICKS;
    for (const id in b) if (b[id] <= Game.time) delete b[id];
    const barriers = runtimeCache.find(room, FIND_STRUCTURES)
        .filter(s => ((s.structureType === STRUCTURE_RAMPART && s.my) || s.structureType === STRUCTURE_WALL) && s.hits < s.hitsMax && !b[s.id])
        .sort((x, y) => x.hits - y.hits)
        .slice(0, ALT_SCAN);
    for (const s of barriers) {
        const tile = safeWorkTile(creep, s, REPAIR_RANGE, danger);
        if (tile) return { structure: s, tile };
        b[s.id] = Game.time + BLOCKED_TICKS;
    }
    return null;
}

// Returns true when the creep stood in reach and has stepped out this tick: the caller does nothing
// else (W1N9: a builder stood beside a site 2 tiles from the quad, shot to its last WORK part).
// Its repairs: the structure asked for when a safe tile is in range of it, else the weakest barrier
// that has one (reachableRepair), worked from that tile; the walk there keeps out of reach (the same
// reach, not the wider flee range: a tile 4 from a ranger was safe to stand on but not to path to).
function guardRepairs(creep) {
    if (creep._guardRepairs || !creep.room || typeof creep.repair !== 'function') return false;
    // Hostiles in the room now or in the last SEEN_TICKS (border hoppers out for a tick count).
    const danger = hitTiles(creep.room);
    if (!danger.size) return false;
    creep._guardRepairs = true;
    const repair = creep.repair, travelTo = creep.travelTo;
    const here = () => danger.has(creep.pos.x * 50 + creep.pos.y);
    if (here() && escape(creep)) return true;
    let plan = null;     // { for: asked id, structure, tile }
    const planFor = structure => {
        if (plan && plan.for === structure.id) return plan;
        const tile = safeWorkTile(creep, structure, REPAIR_RANGE, danger);
        const alt = tile ? { structure, tile } : reachableRepair(creep, danger, structure.id);
        plan = Object.assign({ for: structure.id }, alt || {});
        return plan;
    };
    creep.repair = (structure, ...rest) => {
        if (!structure || structure.structureType === STRUCTURE_ROAD || structure.progressTotal !== undefined) return repair.call(creep, structure, ...rest);
        const p = planFor(structure);
        if (!p.structure || here()) return ERR_NOT_IN_RANGE;
        return repair.call(creep, p.structure, ...rest);
    };
    creep.travelTo = (dest, options = {}) => {
        if (!plan || !dest || dest.id !== plan.for) return travelTo.call(creep, dest, options);
        if (!plan.tile) {
            // Nothing it can repair out of reach: leave it for now, out of reach.
            if (creep.memory) delete creep.memory.structureTarget;
            if (here()) escape(creep);
            return ERR_NO_PATH;
        }
        if (creep.pos.x === plan.tile.x && creep.pos.y === plan.tile.y) return OK;
        return travelTo.call(creep, new RoomPosition(plan.tile.x, plan.tile.y, creep.room.name), Object.assign({}, options, {
            range: 0,
            roomCallback: (name, matrix) => {
                const m = options.roomCallback ? options.roomCallback(name, matrix) || matrix : matrix;
                if (name !== creep.room.name || !m) return m;
                for (const k of danger) if (k !== plan.tile.x * 50 + plan.tile.y) m.set(Math.floor(k / 50), k % 50, 0xff);
                return m;
            },
        }));
    };
    return false;
}

// While armed hostiles are in the creep's room, every travelTo this tick keeps out of their reach
// (markDanger) and is planned afresh, as they move: a cached path planned before they came led back
// into them. Workers then go around attackers instead of only running from them.
function routeAround(creep) {
    if (creep._routeAround) return;
    const travelTo = creep.travelTo;
    if (typeof travelTo !== 'function') return;
    creep._routeAround = true;
    creep.travelTo = (target, options = {}) => travelTo.call(creep, target, Object.assign({}, options, {
        repath: 1,
        roomCallback: (name, matrix) => avoidReach(name, options.roomCallback ? options.roomCallback(name, matrix) || matrix : matrix),
    }));
}

// ---------------------------------------------------------------- damaged creeps
// Damage disables body parts front to back and creeps never regenerate, so a creep whose
// working parts are all disabled stays useless (and keeps blocking its replacement) until
// something heals it.

// Has parts of this type, all disabled.
function crippled(creep, type) {
    if (creep.hits >= creep.hitsMax) return false;
    let has = false;
    for (const part of creep.body) {
        if (part.type !== type) continue;
        if (part.hits > 0) return false;
        has = true;
    }
    return has;
}

function healerNear(creep, range) {
    return creep.pos.findInRange(FIND_MY_CREEPS, range, {
        filter: c => c.id !== creep.id && c.getActiveBodyparts(HEAL) > 0
    }).length > 0;
}

// Cannot move: only a healer beside it can save it. Wait for one, else suicide so the spawn
// logic sends a replacement (anything carried stays in the tombstone for collectors).
// True when it has handled the tick.
function stranded(creep) {
    if (!crippled(creep, MOVE)) return false;
    if (!healerNear(creep, 3)) creep.suicide();
    return true;
}

// Towers stop healing at hitsMax - 199: close enough to go back to work.
function repaired(creep) {
    return creep.hits > creep.hitsMax - 200;
}

// Go home and wait by storage for the towers to heal us. A home without towers, or too little
// life left to make another trip worthwhile, ends in suicide instead of loitering.
function seekRepair(creep) {
    if (stranded(creep)) return true;
    if (goHome(creep)) return true;
    const towers = runtimeCache.find(creep.room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });
    if (!towers.length || creep.ticksToLive < 200) {
        creep.suicide();
        return true;
    }
    const anchor = creep.room.storage || towers[0];
    if (!creep.pos.inRangeTo(anchor, 3)) creep.travelTo(anchor, { range: 3 });
    return true;
}

module.exports = { terrainCosts, threatsAround, escape, avoidReach, routeAround, guardRepairs, safeWorkTile, unsafeToEnter, armedThreats, markDanger, fight, act, flee, avoidDanger, regroup, startRegroup, incomingDamage, crippled, healerNear, stranded, repaired, seekRepair };
