// One controller issues all squad actions. No generic fighter can overwrite its moves.
const squads = require('system.guardSquads');
const boosts = require('system.guardBoosts');
const intel = require('combat.intel');
const tactics = require('combat.tactics');
const OFFSETS = [[0, 0], [1, 0], [0, 1], [1, 1]];
const STEPS = [[0, 0], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
let tick = -1, handled = new Set(), matrices = {};
function begin() {
    if (tick !== Game.time) { tick = Game.time; handled = new Set(); matrices = {}; }
}
function position(x, y, roomName) { return new RoomPosition(x, y, roomName); }
function range(a, b) {
    a = a.pos || a; b = b.pos || b;
    return a.roomName === b.roomName ? Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) : Infinity;
}
function atPost(c) { return Game.shard.name === c.memory.guardTargetShard && c.room.name === c.memory.destination; }
function grid(room, members, footprint, dynamic = true) {
    const names = members.map(c => c.name).join(',');
    const id = room.name + names + footprint + dynamic;
    if (matrices[id]) return matrices[id];
    const terrain = room.getTerrain ? room.getTerrain() : Game.map.getRoomTerrain(room.name);
    const tiles = new PathFinder.CostMatrix();
    for (let x = 0; x < 50; x++) for (let y = 0; y < 50; y++) {
        const t = terrain.get(x, y);
        tiles.set(x, y, t === TERRAIN_MASK_WALL ? 255 : t === TERRAIN_MASK_SWAMP ? 10 : 2);
    }
    for (const s of room.find(FIND_STRUCTURES)) {
        if (s.structureType === STRUCTURE_ROAD) { if (tiles.get(s.pos.x, s.pos.y) !== 255) tiles.set(s.pos.x, s.pos.y, 1); }
        else if (s.structureType !== STRUCTURE_CONTAINER && s.structureType !== STRUCTURE_PORTAL &&
            !(s.structureType === STRUCTURE_RAMPART && (s.my || s.isPublic))) tiles.set(s.pos.x, s.pos.y, 255);
    }
    // Sources, minerals, controller and hostile construction sites are not walkable.
    const fixed = room.find(FIND_SOURCES).concat(room.find(FIND_MINERALS));
    if (room.controller) fixed.push(room.controller);
    for (const o of fixed) tiles.set(o.pos.x, o.pos.y, 255);
    if (dynamic) {
        const own = new Set(members.map(c => c.name));
        for (const c of room.find(FIND_CREEPS).concat(room.find(FIND_POWER_CREEPS))) {
            if (!own.has(c.name)) tiles.set(c.pos.x, c.pos.y, 255);
        }
    }
    if (!footprint) return (matrices[id] = tiles);
    for (const s of room.find(FIND_STRUCTURES)) if (s.structureType === STRUCTURE_PORTAL) tiles.set(s.pos.x, s.pos.y, 255);
    const result = new PathFinder.CostMatrix();
    for (let x = 0; x < 50; x++) for (let y = 0; y < 50; y++) {
        // Formation anchors never straddle an exit. Exit traversal is explicit single file.
        let cost = x < 1 || y < 1 || x > 47 || y > 47 ? 255 : 0;
        if (cost !== 255) for (const [dx, dy] of OFFSETS) cost = Math.max(cost, tiles.get(x + dx, y + dy));
        result.set(x, y, cost);
    }
    return (matrices[id] = result);
}
function nearestAnchor(room, members, goal, limit = 3) {
    const matrix = grid(room, members, true);
    let best, score = Infinity;
    for (let x = 1; x <= 47; x++) for (let y = 1; y <= 47; y++) {
        if (matrix.get(x, y) >= 255) continue;
        const p = position(x, y, room.name);
        const distance = Math.max(...OFFSETS.map(([dx, dy]) => range(position(x + dx, y + dy, room.name), goal)));
        const candidate = Math.max(0, distance - limit) * 1000 + range(members[0], p);
        if (candidate < score) { score = candidate; best = p; }
    }
    return best;
}
function ordered(members) { return members.slice().sort((a, b) => a.memory.guardSlot - b.memory.guardSlot); }
function assembled(members, anchor) {
    return members.every((c, i) => c.pos.x === anchor.x + OFFSETS[i][0] && c.pos.y === anchor.y + OFFSETS[i][1] && c.room.name === anchor.roomName);
}
function assemble(members, anchor) {
    if (assembled(members, anchor)) return true;
    for (let i = 0; i < members.length; i++) {
        const target = position(anchor.x + OFFSETS[i][0], anchor.y + OFFSETS[i][1], anchor.roomName);
        if (range(members[i], target) && !members[i].fatigue) members[i].travelTo(target, { range: 0, maxRooms: 1, ignoreCreeps: false });
    }
    return false;
}
function formationMove(members, goal, goalRange, flee = false) {
    for (const c of members) c.memory.guardAssembled = false;
    const room = members[0].room;
    let anchor = members[0].pos;
    if (!assembled(members, anchor)) {
        anchor = nearestAnchor(room, members, members[0].pos, 1);
        if (!anchor) return 'narrow';
        assemble(members, anchor);
        return 'assembling';
    }
    for (const c of members) c.memory.guardAssembled = members.length === 4;
    if (members.some(c => c.fatigue || !c.getActiveBodyparts(MOVE))) return 'waiting';
    const goals = Array.isArray(goal) ? goal : [{ pos: goal.pos || goal, range: goalRange }];
    const search = dynamic => PathFinder.search(anchor, goals, { flee, maxRooms: 1, maxOps: dynamic ? 3000 : 10000,
        roomCallback: name => name === room.name ? grid(room, members, true, dynamic) : false });
    const path = search(true);
    if (!path.path.length) {
        if (!path.incomplete) return 'done';
        // A creep blocking the footprint never makes us break formation.
        return search(false).incomplete ? 'narrow' : 'waiting';
    }
    const step = path.path[0];
    if (grid(room, members, true).get(step.x, step.y) >= 255) return 'waiting';
    const dir = anchor.getDirectionTo(step);
    for (const c of members) c.move(dir);
    return 'moving';
}
function combat(members) {
    const room = members[0].room, info = intel.roomIntel(room);
    const same = members.filter(c => c.room.name === room.name);
    const focus = intel.focusTarget(room) || info.hostiles[0];
    for (const c of same) {
        if (!c.getActiveBodyparts(RANGED_ATTACK)) continue;
        const inRange = info.hostiles.filter(h => range(c, h) <= 3);
        const target = focus && inRange.includes(focus) ? focus : inRange[0];
        if (!target) continue;
        const ranged = intel.assess(c).ranged;
        const mass = inRange.reduce((total, h) => total + ranged * intel.MASS_FACTOR[range(c, h)], 0);
        if (mass > ranged && c.rangedMassAttack) c.rangedMassAttack();
        else c.rangedAttack(target);
    }
    for (const healer of same.filter(c => c.getActiveBodyparts(HEAL))) {
        const patients = same.filter(c => range(healer, c) <= 3);
        patients.sort((a, b) => {
            const risk = c => (c.hitsMax - c.hits + tactics.incomingDamage(c, info.threats)) / Math.max(1, intel.assess(c).ehp);
            return risk(b) - risk(a);
        });
        const patient = patients[0];
        if (patient) {
            if (range(healer, patient) <= 1) healer.heal(patient);
            else healer.rangedHeal(patient);
        }
    }
    // The decision is room-wide: the second defensive quad and our tower are real support. During
    // safe mode hostile combat and healing actions are disabled, so use their HP only as a target.
    const protectedMode = !!(room.controller && room.controller.safeMode);
    const them = protectedMode ? Object.assign({}, info.them, { dps: 0, heal: 0 }) : info.them;
    const retreat = !protectedMode && (intel.verdictFor(info.us, them) === 'lose' || same.some(c =>
        c.hits < c.hitsMax * 0.35 || tactics.incomingDamage(c, info.threats) >= intel.assess(c).ehp));
    return { info, focus, retreat };
}
function snake(members, goal, post) {
    const list = ordered(members);
    const options = { range: post ? 1 : 0, maxRooms: post ? 1 : 16 };
    if (post) options.roomCallback = name => {
        if (name !== list[0].room.name) return false;
        const matrix = grid(list[0].room, members, false).clone();
        for (let i = 0; i < 50; i++) { matrix.set(0, i, 255); matrix.set(49, i, 255); matrix.set(i, 0, 255); matrix.set(i, 49, 255); }
        return matrix;
    };
    for (const c of list) c.memory.guardAssembled = false;
    // Follow the previous member's actual tile, never a predicted position after a failed move.
    for (let i = list.length - 1; i >= 1; i--) {
        const c = list[i], previous = list[i - 1];
        if (c.fatigue) continue;
        if (range(c, previous) === 1 && !previous.fatigue) c.move(c.pos.getDirectionTo(previous));
        else if (range(c, previous) > 1) c.travelTo(previous.pos, Object.assign({}, options, { range: 1 }));
    }
    const leader = list[0];
    if (leader.fatigue) return;
    // Wait for stragglers, but never on an exit tile: a leader parked on the border blocks the
    // followers arriving from the other side and the line bounces there.
    const straggling = list.some((c, i) => i && c.room.name === list[i - 1].room.name && (c.fatigue || range(c, list[i - 1]) > 1));
    if (straggling && !onEdge(leader)) return;
    leader.travelTo(goal.pos || goal, options);
}
function onEdge(c) {
    return c.pos.x === 0 || c.pos.y === 0 || c.pos.x === 49 || c.pos.y === 49;
}
function onBorder(x, y) { return x === 0 || y === 0 || x === 49 || y === 49; }

// Going in by pairs. dir is the direction into the target (a FIND_EXIT_* constant has the value of
// the direction toward that exit). The front pair stands one step from the exit tiles.
const BREACH_WAIT = 20;    // ticks the back pair waits for the front pair to clear the edge, then goes anyway
const BREACH_ABORT = 60;   // ticks after which an unfinished entry falls back to single file
function lined(c, dir) { return onBorder(c.pos.x + STEPS[dir][0], c.pos.y + STEPS[dir][1]); }
// How far inside the target a creep is, counted from the border it came in over.
function depth(c, dir) {
    const [dx, dy] = STEPS[dir];
    return dx > 0 ? c.pos.x : dx < 0 ? 49 - c.pos.x : dy > 0 ? c.pos.y : 49 - c.pos.y;
}
// The 2x2 spot against the border into the target: two members one step from exit tiles, and the
// tiles they land on in the target (plus the next one in, to make room) walkable. null: no such spot.
function breachAnchor(room, members, dir, target) {
    const [dx, dy] = STEPS[dir];
    const matrix = grid(room, members, true);
    const here = room.getTerrain ? room.getTerrain() : Game.map.getRoomTerrain(room.name);
    const there = Game.map.getRoomTerrain(target);
    const leader = members[0];
    let best = null, score = Infinity;
    for (let x = 1; x <= 47; x++) for (let y = 1; y <= 47; y++) {
        if (matrix.get(x, y) >= 255) continue;
        const exits = OFFSETS.map(([ox, oy]) => [x + ox + dx, y + oy + dy]).filter(([ex, ey]) => onBorder(ex, ey));
        if (exits.length !== 2) continue;
        const open = exits.every(([ex, ey]) => {
            const lx = dx ? 49 - ex : ex, ly = dy ? 49 - ey : ey;   // the matching tile on the target's side
            return here.get(ex, ey) !== TERRAIN_MASK_WALL && there.get(lx, ly) !== TERRAIN_MASK_WALL &&
                there.get(lx + dx, ly + dy) !== TERRAIN_MASK_WALL;
        });
        if (!open) continue;
        const candidate = Math.max(Math.abs(x - leader.pos.x), Math.abs(y - leader.pos.y)) * 100 +
            Math.abs(x - leader.pos.x) + Math.abs(y - leader.pos.y);
        if (candidate < score) { score = candidate; best = position(x, y, room.name); }
    }
    return best;
}
// The front pair steps in and one tile further (off the edge); the back pair closes up to the
// border once the front has crossed, and follows in once the front has made room. Members inside
// hold there (combat in run shoots and heals) until the whole party is in.
function breach(party, b, target) {
    const inside = c => c.room.name === target;
    const front = party.filter(c => b.front.includes(c.name)), back = party.filter(c => !b.front.includes(c.name));
    for (const c of front) {
        if (!c.fatigue && (!inside(c) || depth(c, b.dir) < 1)) c.move(b.dir);
    }
    const late = Game.time - b.since >= BREACH_WAIT;
    const crossed = late || front.every(inside);
    const clear = late || front.every(c => inside(c) && depth(c, b.dir) >= 1);
    for (const c of back) {
        if (c.fatigue || inside(c)) continue;
        if (lined(c, b.dir) ? clear : crossed) c.move(b.dir);
    }
}

// The last room before the target on the route (avoiding claimed and closed rooms): where the
// squad forms up before going in. Recomputed when the leader changes room.
function stagingRoom(leader, target) {
    const m = leader.memory, from = leader.room.name;
    if (m.guardStaging && m.guardStaging.from === from && m.guardStaging.to === target) return m.guardStaging.room;
    let room = from;
    if (from !== target) {
        const Traveler = require('traveler').Traveler;
        const route = Game.map.findRoute(from, target, {
            routeCallback: name => (name === target || name === from || !Traveler.checkAvoid(name) ? 1 : Infinity),
        });
        if (Array.isArray(route) && route.length >= 2) room = route[route.length - 2].room;
    }
    m.guardStaging = { from, to: target, room };
    return room;
}

const ASSEMBLE_TIMEOUT = 30;     // ticks to form up at the staging spot (after the walk there) before going in anyway

function advance(members, goal, goalRange, post) {
    const leader = members[0], m = leader.memory;
    if (m.guardSnake) {
        const s = m.guardSnake;
        const clear = members.every(c => c.room.name === leader.room.name && range(c, leader) <= 3) &&
            grid(leader.room, members, true).get(leader.pos.x, leader.pos.y) < 255 &&
            (s.room !== leader.room.name || Math.max(Math.abs(s.x - leader.pos.x), Math.abs(s.y - leader.pos.y)) >= 3);
        if (clear) delete m.guardSnake;
        else { snake(members, goal, post); return; }
    }
    const result = formationMove(members, goal, goalRange);
    if (result === 'narrow') {
        m.guardSnake = { x: leader.pos.x, y: leader.pos.y, room: leader.room.name };
        snake(members, goal, post);
    }
}
function portal(members, portalObject) {
    // All four manifests were published at spawn acceptance, before anyone can enter a portal.
    for (const c of members) { c.memory.guardPhase = 'crossing'; c.memory.guardAssembled = false; }
    squads.publish(true);
    snake(members, portalObject.pos, false);
}
// Travel: single file all the way (through portals too) to the staging room, the last room before
// the target. There the squad forms its 2x2 a few tiles from the exit, then crosses in quick single
// file and fights as a quad inside (defend). Moving as a 2x2 through open rooms broke formation
// whenever one member was blocked and the squad bounced in place (shardX E30N40).
function travel(members) {
    const leader = members[0], m = leader.memory;
    for (const c of members) c.memory.guardPhase = 'traveling';
    const corner = m.xShard && m.xShard.c;
    if (corner && Game.shard.name !== m.guardTargetShard) {
        if (leader.room.name === corner) {
            const p = leader.room.find(FIND_STRUCTURES).find(s => s.structureType === STRUCTURE_PORTAL && s.destination && s.destination.shard === m.guardTargetShard);
            if (!p) { m.guardBlocked = 'portal missing'; return; }
            portal(members, p);
            return;
        }
        snake(members, position(25, 25, corner), false);
        return;
    }
    const target = m.destination;
    if (leader.room.name === target) {
        snake(members, position(25, 25, target), false);   // the rest of the line follows in
        return;
    }
    const staging = stagingRoom(leader, target);
    if (!members.every(c => c.room.name === staging)) {
        delete m.guardGo;
        delete m.guardStageAnchor;
        snake(members, position(25, 25, staging), false);
        return;
    }
    // All in the staging room: form up against the border into the target, then go in by pairs.
    // A spot from before pair entry (no v) is dropped, and with it a latched single-file go.
    if (m.guardStageAnchor && !m.guardStageAnchor.v) { delete m.guardStageAnchor; delete m.guardGo; }
    const exit = Game.map.findExit(staging, target);
    const tiles = typeof exit === 'number' && exit > 0 ? leader.room.find(exit) : [];
    // The exit tile nearest the leader; ties (a whole border is often equally far) go to the one
    // straight across, not to whichever comes first (a corner).
    let door = null, best = Infinity;
    for (const t of tiles) {
        const score = range(leader, t) * 100 + Math.abs(t.x - leader.pos.x) + Math.abs(t.y - leader.pos.y);
        if (score < best) { best = score; door = t; }
    }
    if (!door) { m.guardBlocked = 'route unavailable'; return; }
    // Formed (or out of time): go, and stay going. Re-forming once the line has started across
    // would bring the back-and-forth right back.
    if (!m.guardGo) {
        // The formation spot is chosen once and kept: recomputed from the moving leader each tick,
        // the doorway and spot slid along with it and the squad chased them into a corner.
        // It may take the walk there plus ASSEMBLE_TIMEOUT to form up, then the squad goes anyway.
        // Against the border when the terrain allows; otherwise a few tiles back, crossing single file.
        if (!m.guardStageAnchor) {
            const edge = breachAnchor(leader.room, members, exit, target);
            const a = edge || nearestAnchor(leader.room, members, door, 4);
            m.guardStageAnchor = a ? { v: 2, x: a.x, y: a.y, edge: !!edge, until: Game.time + range(leader, a) * 2 + ASSEMBLE_TIMEOUT } : { v: 2, none: 1 };
        }
        const a = m.guardStageAnchor;
        const anchor = !a.none && Game.time < a.until ? position(a.x, a.y, staging) : null;
        if (anchor && !assembled(members, anchor)) {
            assemble(members, anchor);
            return;
        }
        for (const c of members) { c.memory.guardAssembled = members.length === 4; c.memory.guardCommitted = 1; }
        if (anchor && a.edge) {
            const b = { dir: exit, from: staging, since: Game.time, names: members.map(c => c.name),
                front: members.filter(c => lined(c, exit)).map(c => c.name) };
            for (const c of members) c.memory.guardBreach = Object.assign({}, b);
            delete m.guardStageAnchor;
            breach(members, b, target);
            return;
        }
        m.guardGo = Game.time;
    }
    snake(members, position(25, 25, target), false);
}
function defend(members) {
    const leader = members[0], room = leader.room;
    for (const c of members) {
        c.memory.guardPhase = 'arrived'; c.memory.guardCommitted = 1; delete c.memory.xShard;
        if (c.memory.guardArrival === undefined) c.memory.guardArrival = Game.time;
    }
    const { info, focus, retreat } = combat(members);
    if (retreat && info.threats.length) {
        formationMove(members, info.threats.map(h => ({ pos: h.pos, range: 5 })), 5, true);
        return;
    }
    if (focus) {
        advance(members, focus.pos, 3, true);
        return;
    }
    const goal = room.controller ? room.controller.pos : leader.pos;
    // An idle, formed squad needs no path search or footprint rebuild.
    if (members.every(c => range(c, goal) <= 3) && assembled(members, leader.pos)) {
        for (const c of members) c.memory.guardAssembled = members.length === 4;
        return;
    }
    const anchor = nearestAnchor(room, members, goal);
    if (anchor) {
        advance(members, anchor, 0, true);
    } else snake(members, goal, true);
}
function run(creep) {
    begin();
    const id = creep.memory.guardSquad;
    if (handled.has(id)) return;
    handled.add(id);
    let members = ordered(Object.values(Game.creeps).filter(c => c.memory.guardSquad === id && !c.spawning));
    if (!members.length) return;
    let preparing = false;
    for (const c of members) if (boosts.boost(c)) preparing = true;
    const fight = list => { for (const name of new Set(list.map(c => c.room.name))) combat(list.filter(c => c.room.name === name)); };
    // Going in by pairs: the members inside hold and shoot; no defend (its retreat would walk the
    // first pair back out before the second pair is in).
    const holder = members.find(c => c.memory.guardBreach);
    if (holder) {
        const b = holder.memory.guardBreach, target = holder.memory.destination;
        const party = members.filter(c => b.names.includes(c.name));
        const done = party.every(atPost), strayed = party.some(c => !atPost(c) && c.room.name !== b.from);
        if (done || strayed || Game.time - b.since > BREACH_ABORT) {
            for (const c of members) delete c.memory.guardBreach;
        } else {
            fight(party);
            breach(party, b, target);
            const others = members.filter(c => !b.names.includes(c.name) && atPost(c));
            if (others.length) defend(others);
            return;
        }
    }
    // A member that crossed alone before the squad went in (no breach or single-file go yet) comes
    // back out to the others waiting next door, so the squad enters formed.
    const early = members.filter(atPost), waiting = members.filter(c => !atPost(c));
    if (early.length && waiting.length && !members.some(c => c.memory.guardCommitted)) {
        const next = waiting[0].room.name, exits = Game.map.describeExits(next) || {};
        if (waiting.every(c => c.room.name === next) && Object.values(exits).includes(waiting[0].memory.destination)) {
            fight(members);
            for (const c of early) if (!c.fatigue) c.travelTo(position(25, 25, next), { range: 20 });
            return;
        }
    }
    // Posted survivors keep fighting even while their casualty replacement is prepared elsewhere.
    const posted = members.filter(atPost);
    if (posted.length) defend(posted);
    members = members.filter(c => !atPost(c));
    if (!members.length || preparing) return;
    const sourceTarget = Object.values(squads.state().targets).find(t => t.squads.some(q => q.id === id));
    const sourceSquad = sourceTarget && sourceTarget.squads.find(q => q.id === id);
    if (sourceSquad && !sourceSquad.slots.some(s => s.arrived)) {
        if (sourceSquad.slots.some(s => !s.name || s.phase === 'spawning')) return;
    }
    // Portal arrivals wait for their formation, but a casualty cannot strand the survivors forever.
    if (!sourceSquad && members.length < 4 && !posted.length) {
        const m = members[0].memory;
        if (m.guardRegroupAt === undefined) m.guardRegroupAt = Game.time;
        if (Game.time - m.guardRegroupAt < 100) {
            combat(members.filter(c => c.room.name === members[0].room.name));
            return;
        }
    }
    // Transit combat is defensive; it does not replace the squad's movement orders.
    fight(members);
    travel(members);
}
module.exports = { run, grid, assembled, formationMove, nearestAnchor, snake, combat, range, OFFSETS, STEPS };
