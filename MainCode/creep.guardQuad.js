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
    if (list.some((c, i) => i && c.room.name === list[i - 1].room.name && (c.fatigue || range(c, list[i - 1]) > 1))) return;
    leader.travelTo(goal.pos || goal, options);
}
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
function travel(members) {
    const leader = members[0], m = leader.memory;
    const corner = m.xShard && m.xShard.c;
    const target = corner || m.destination;
    for (const c of members) c.memory.guardPhase = 'traveling';
    const sameRoom = members.every(c => c.room.name === leader.room.name);
    if (corner && leader.room.name === corner) {
        const p = leader.room.find(FIND_STRUCTURES).find(s => s.structureType === STRUCTURE_PORTAL && s.destination && s.destination.shard === m.guardTargetShard);
        if (!p) { m.guardBlocked = 'portal missing'; return; }
        if (!sameRoom || range(leader, p) <= 3 || members.length < 4) { portal(members, p); return; }
        const result = formationMove(members, p.pos, 3);
        if (result === 'narrow') portal(members, p);
        return;
    }
    const goal = position(25, 25, target);
    if (!sameRoom) { snake(members, goal, false); return; }
    if (leader.room.name === target) return;
    const exit = Game.map.findExit(leader.room.name, target);
    if (typeof exit !== 'number' || exit < 0) { m.guardBlocked = 'route unavailable'; return; }
    const tiles = leader.room.find(exit);
    const edge = leader.pos.findClosestByRange(tiles);
    if (!edge) return;
    if (range(leader, edge) <= 3 || members.length < 4) { snake(members, goal, false); return; }
    advance(members, edge, 3, false);
}
function defend(members) {
    const leader = members[0], room = leader.room;
    for (const c of members) {
        c.memory.guardPhase = 'arrived'; delete c.memory.xShard;
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
    for (const name of new Set(members.map(c => c.room.name))) combat(members.filter(c => c.room.name === name));
    travel(members);
}
module.exports = { run, grid, assembled, formationMove, nearestAnchor, snake, combat, range, OFFSETS, STEPS };
