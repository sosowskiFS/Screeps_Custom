// Persistent room defense. Tick counters are local; remote deadlines use wall time.
const ism = require('runtime.ism');
const stage = require('room.stage');
const SOURCES = ['shard0', 'shard1', 'shard2', 'shard3', 'shardX'];
const BOOSTS_BY_PART = () => ({ [TOUGH]: RESOURCE_CATALYZED_GHODIUM_ALKALIDE,
    [MOVE]: RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE, [RANGED_ATTACK]: RESOURCE_CATALYZED_KEANIUM_ALKALIDE,
    [HEAL]: RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE });
function state() {
    return Memory.guardSquads || (Memory.guardSquads = { rooms: {}, targets: {}, serial: 0 });
}
function key(shard, room) { return shard + ':' + room; }
function body(capacity, slot) {
    const part = slot === 3 ? HEAL : RANGED_ATTACK;
    const blocks = Math.max(0, Math.min(10, Math.floor(capacity / (slot === 3 ? 810 : 510))));
    return Array(blocks).fill(TOUGH).concat(Array(blocks).fill(MOVE), Array(blocks * 3).fill(part));
}
function clock() {
    const s = state(), now = Date.now();
    const c = s.clock || (s.clock = { tick: Game.time, at: now, ms: 3000 });
    if (Game.time > c.tick && now > c.at) {
        const sample = (now - c.at) / (Game.time - c.tick);
        c.ms = Math.max(100, Math.min(60000, c.ms * 0.8 + sample * 0.2));
        c.tick = Game.time; c.at = now;
    }
    return c;
}
function latch(room, reason) {
    if (!room || !room.controller || !room.controller.my || stage.established(room)) return;
    const rooms = state().rooms;
    if (!rooms[room.name]) rooms[room.name] = { since: Game.time, reason };
}
function remote(shard) { return ism.get(shard, 'guards'); }
function fresh(report) {
    return !!report && Date.now() - report.at <= Math.max(60000, (report.ms || 3000) * 30);
}
function escalated(shard, room) {
    if (shard === Game.shard.name) return !!state().rooms[room];
    const r = remote(shard);
    return !!(r && r.rooms && r.rooms[room] && r.rooms[room].escalated);
}
function safeModeActive(shard, room) {
    if (shard === Game.shard.name) {
        const r = Game.rooms[room];
        return !!(r && r.controller && r.controller.safeMode > 0);
    }
    const report = remote(shard), r = report && report.rooms && report.rooms[room];
    if (!r || !(r.safeMode > 0)) return false;
    return fresh(report) || report.at + r.safeMode * (report.ms || 3000) > Date.now();
}
function localMembers() {
    return Object.values(Game.creeps).filter(c => c.memory && c.memory.guardSquad);
}
function snapshot(c) {
    const m = c.memory;
    return { name: c.name, squad: m.guardSquad, slot: m.guardSlot, target: m.destination,
        shard: m.guardTargetShard, room: c.room && c.room.name, ttl: c.spawning ? 1500 : c.ticksToLive,
        phase: c.spawning ? 'spawning' : m.guardPhase || 'boosting', assembled: !!m.guardAssembled,
        movement: movement(c), blocked: m.guardBlocked, boosts: (c.body || []).reduce((o, p) => {
            if (p.boost) o[p.boost] = (o[p.boost] || 0) + 1; return o;
        }, {}) };
}
function movement(c) {
    let weight = 0, power = 0;
    for (const p of c.body || []) {
        if (p.hits === 0) continue;
        if (p.type === MOVE) power += 2 * (p.boost === RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE ? 4 : 1);
        else weight++;
    }
    return Math.max(1, Math.ceil(weight * 2 / Math.max(1, power)));
}
function publish(force) {
    const s = state(), c = clock(), members = {};
    for (const creep of localMembers()) members[creep.name] = snapshot(creep);
    for (const t of Object.values(s.targets)) for (const q of t.squads) for (const slot of q.slots) {
        if (members[slot.name]) { slot.phase = members[slot.name].phase; slot.lastShard = Game.shard.name; }
    }
    const rooms = {};
    for (const name in s.rooms) {
        const room = Game.rooms[name];
        rooms[name] = { escalated: true, owned: room && room.controller ? !!room.controller.my : undefined,
            established: room ? stage.established(room) : undefined,
            safeMode: room && room.controller ? room.controller.safeMode || 0 : 0 };
    }
    const manifests = {};
    for (const t of Object.values(s.targets)) {
        for (const q of t.squads) for (const slot of q.slots) if (slot.name && (!slot.expires || slot.expires > Date.now() || Game.creeps[slot.name])) {
            manifests[slot.name] = Object.assign({}, slot.memory);
        }
    }
    // TTL changes need only a heartbeat; state/position-in-room changes publish immediately.
    const roomSignature = Object.entries(rooms).map(([name, r]) => [name, r.escalated, r.owned, r.established, r.safeMode > 0]);
    const signature = JSON.stringify([roomSignature, Object.values(members).map(m => [m.name, m.phase, m.room, m.assembled, m.boosts]), manifests]);
    if (force || Game.time % 10 === 0 || signature !== s.signature) {
        ism.setLocal('guards', { tick: Game.time, at: Date.now(), ms: c.ms, rooms, members, manifests });
        s.signature = signature;
    }
}
function adopt(creep) {
    for (const shard of SOURCES) {
        if (shard === Game.shard.name) continue;
        const r = remote(shard), m = r && r.manifests && r.manifests[creep.name];
        if (m) {
            Memory.creeps[creep.name] = Object.assign({}, m, { guardBoostDone: true, guardPhase: 'traveling', hs: shard });
            delete Memory.creeps[creep.name].xShard;
            return true;
        }
    }
    return false;
}
function register(shard, room, home, corner, distance) {
    const s = state(), id = key(shard, room);
    if (!escalated(shard, room) && !s.targets[id]) return;
    let t = s.targets[id];
    if (!t) t = s.targets[id] = { shard, room, home, corner, distance, squads: [], samples: {} };
    t.home = home; t.corner = corner; t.distance = distance;
    t.safeMode = safeModeActive(shard, room);
    const r = shard === Game.shard.name ? Game.rooms[room] : null;
    const report = shard === Game.shard.name ? null : remote(shard);
    const rr = report && report.rooms && report.rooms[room];
    t.stopped = !!(r && (!r.controller || !r.controller.my || stage.established(r))) ||
        !!(fresh(report) && rr && (rr.owned === false || rr.established));
    return t;
}
function observe(t) {
    const out = {};
    for (const c of localMembers()) if (c.memory.destination === t.room && c.memory.guardTargetShard === t.shard) {
        out[c.name] = Object.assign(snapshot(c), { at: Date.now(), ms: clock().ms, observedShard: Game.shard.name });
    }
    if (t.shard !== Game.shard.name) {
        const r = remote(t.shard);
        if (fresh(r)) for (const m of Object.values(r.members || {})) {
            if (m.target === t.room) out[m.name] = Object.assign({}, m, { at: r.at, ms: r.ms, observedShard: t.shard });
        }
    }
    return out;
}
function newSquad(t) {
    const s = state();
    const id = Game.shard.name + '/' + t.room + '/' + (++s.serial);
    const q = { id, created: Game.time, slots: [0, 1, 2, 3].map(slot => ({ slot, phase: 'missing' })) };
    t.squads.push(q);
    return q;
}
function travelTicks(t, speed) {
    const measured = t.samples[speed];
    if (measured) return Math.ceil(measured * 1.2 + 25);
    // Resolve terrain on this shard when possible; unseen foreign terrain uses the scout estimate.
    if (t.route && t.route.speed === speed && Game.time - t.route.at < 100) return t.route.ticks;
    let estimate = (t.distance || 500) * speed + 50;
    const spawn = Object.values(Game.spawns).find(s => s.room.name === t.home && s.pos);
    if (spawn && typeof PathFinder !== 'undefined' && Game.map.getRoomTerrain) {
        const goal = new RoomPosition(25, 25, t.corner || t.room);
        const path = PathFinder.search(spawn.pos, { pos: goal, range: 3 }, { maxRooms: 16, maxOps: 6000,
            plainCost: 2, swampCost: 10,
            roomCallback: name => Game.rooms[name] ? require('traveler').Traveler.getStructureMatrix(Game.rooms[name]) : undefined });
        if (!path.incomplete) {
            let cost = 0;
            for (const p of path.path) {
                const terrain = Game.map.getRoomTerrain(p.roomName).get(p.x, p.y);
                const room = Game.rooms[p.roomName];
                const road = room && room.lookForAt && room.lookForAt(LOOK_STRUCTURES, p.x, p.y).some(s => s.structureType === STRUCTURE_ROAD);
                cost += Math.max(1, Math.ceil(speed * (road ? 0.5 : terrain === TERRAIN_MASK_SWAMP ? 5 : 1)));
            }
            estimate = cost + (t.corner ? Math.max(50, (t.distance || 500) - path.path.length) * speed : 0) + 50;
        }
    }
    t.route = { at: Game.time, speed, ticks: Math.ceil(estimate) };
    return t.route.ticks;
}
function leadTime(t) {
    const room = Game.rooms[t.home];
    if (!room) return 2000;
    const spawns = Object.values(Game.spawns).filter(s => s.room.name === t.home && (!s.isActive || s.isActive()));
    const waits = spawns.map(s => s.spawning ? s.spawning.remainingTime || 150 : 0);
    if (!waits.length) waits.push(600);
    for (const slot of [3, 0, 1, 2]) {
        const i = waits.indexOf(Math.min(...waits));
        waits[i] += body(room.energyCapacityAvailable, slot).length * 3;
    }
    const moveReady = require('system.guardBoosts').stock(room, RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE) >= 1200;
    const travel = travelTicks(t, moveReady ? 1 : 4);
    // Refill allowance adapts to actual scheduling stalls and never shrinks the minimum margin.
    return Math.max(...waits) + 100 + 50 + travel + Math.max(100, t.refillDelay || 0) + 30;
}
function updateTarget(t) {
    const seen = observe(t), now = Date.now();
    let complete;
    for (const q of t.squads) {
        for (const slot of q.slots) {
            const m = seen[slot.name];
            if (m) {
                slot.phase = m.phase; slot.lastSeen = now; slot.lastShard = m.observedShard; slot.stale = false;
                slot.expires = m.phase === 'spawning' ? now + 1650 * m.ms : m.at + (m.ttl || 0) * m.ms;
                slot.arrived = m.phase === 'arrived' && m.room === t.room;
                slot.assembled = m.assembled;
                slot.boosts = m.boosts; slot.blocked = m.blocked;
                if (slot.arrived && slot.spawnedAt && !slot.measured) {
                    t.samples[m.movement] = Math.max(t.samples[m.movement] || 0,
                        Math.ceil((now - slot.spawnedAt) / clock().ms));
                    slot.measured = true;
                }
            } else if (slot.name) {
                const remoteReport = t.shard !== Game.shard.name && remote(t.shard);
                slot.stale = slot.lastShard !== Game.shard.name && !fresh(remoteReport);
                const confirmedGone = (slot.arrived && (t.shard === Game.shard.name || fresh(remoteReport))) ||
                    (slot.lastShard === Game.shard.name && slot.phase !== 'crossing');
                // A missing home creep may just have crossed the portal: preserve its reservation.
                if (confirmedGone || now > (slot.expires || now) || Game.time > (slot.until || Infinity)) {
                    slot.phase = 'missing'; slot.arrived = false; slot.assembled = false;
                    delete slot.name;
                }
            }
        }
        if (q.slots.every(s => s.arrived && s.assembled && !s.stale && s.expires > now)) complete = q;
    }
    if (t.stopped) {
        t.squads = t.squads.filter(q => q.slots.some(s => s.name));
        return;
    }
    if (complete) t.active = complete.id;
    const active = t.squads.find(q => q.id === t.active);
    if (active) for (const q of t.squads) if (q.created < active.created) q.retired = true;
    const remaining = active ? Math.min(...active.slots.map(s => s.name ? (s.expires - now) / clock().ms : 0)) : 0;
    t.lead = leadTime(t); t.remaining = Math.max(0, remaining);
    if (t.safeMode) { t.gap = false; return; }
    const latest = t.squads.filter(q => !q.retired).slice(-1)[0];
    if (!latest) newSquad(t);
    else if (latest.slots.every(s => s.name)) {
        // Long routes require pipelining before the first wave arrives. Waiting for arrival
        // would create predictable expiry gaps whenever transit exceeds service life at the post.
        const lifeLeft = Math.min(...latest.slots.map(s => (s.expires - now) / clock().ms));
        if (lifeLeft <= t.lead) newSquad(t);
    }
    t.gap = !t.squads.some(q => q.slots.every(s => s.arrived && s.name && !s.stale && s.expires > now));
    if (t.gap && (!t.warned || Game.time - t.warned >= 500)) {
        console.log('[guards] ' + key(t.shard, t.room) + ': quad coverage incomplete; replenishing from ' + t.home);
        t.warned = Game.time;
    }
    t.squads = t.squads.filter(q => !q.retired || q.slots.some(s => s.name));
}
function run() {
    const s = state(); clock();
    for (const room of Object.values(Game.rooms)) {
        if (room.controller && room.controller.my && !stage.established(room)) {
            if (room.controller.safeMode) latch(room, 'safe mode observed');
            if (Game.shard.name === 'shardX' && room.name === 'E29N36') latch(room, 'Harabi safe mode bootstrap');
        }
    }
    const e = Memory.expansion;
    if (e && e.st === 'develop' && e.t && e.sp) {
        const d = Game.map.getRoomLinearDistance ? Game.map.getRoomLinearDistance(e.sp, e.t) * 50 + 50 : 500;
        register(Game.shard.name, e.t, e.sp, undefined, d);
    }
    const xs = Game.shard.name === 'shard2' ? Memory.xs : ism.get('shard2', 'xs');
    if (xs && xs.mode === 'claim') for (const t of xs.targets || []) {
        const [shard, home] = t.h.split(':');
        if (shard === Game.shard.name) register('shardX', t.r, home, t.e, t.t);
    }
    for (const t of Object.values(s.targets)) {
        // Refresh graduation/ownership even after expansion has removed its target.
        register(t.shard, t.room, t.home, t.corner, t.distance);
        updateTarget(t);
    }
    require('system.guardBoosts').prepare();
    publish(false);
}
function spawnOrder(home) {
    for (const t of Object.values(state().targets)) {
        if (t.home !== home || t.stopped || safeModeActive(t.shard, t.room)) continue;
        const pending = t.squads.filter(q => !q.retired && q.id !== t.active);
        const candidates = pending.length ? pending : t.squads.filter(q => !q.retired);
        for (const q of candidates) {
            const slot = q.slots.find(s => !s.name);
            if (!slot) continue;
            const parts = body(Game.rooms[home].energyCapacityAvailable, slot.slot);
            if (!parts.length) continue;
            slot.phase = 'queued';
            const name = 'gq-' + Game.shard.name + '-' + (++state().serial).toString(36);
            const memory = { priority: 'roomGuard', homeRoom: home, destination: t.room,
                guardTargetShard: t.shard, guardSquad: q.id, guardSlot: slot.slot,
                guardKind: slot.slot === 3 ? 'healer' : 'ranged', guardPhase: 'boosting',
                guardDeparture: Game.time + Math.max(0, Math.floor(t.remaining - travelTicks(t, 4) - 50)),
                guardRoster: q.slots.filter(s => s.name).map(s => s.name) };
            if (!t.active) delete memory.guardDeparture;
            if (t.shard !== Game.shard.name) Object.assign(memory, { xTarget: 1, xShard: { c: t.corner } });
            return { body: parts, memory, name, target: t, squad: q, slot };
        }
    }
    return null;
}
function spawned(order) {
    order.name = order.memory.guardSpawnName || order.name;
    const waited = order.target.energyWaitAt === undefined ? 0 : Game.time - order.target.energyWaitAt;
    order.target.refillDelay = Math.ceil((order.target.refillDelay || 0) * 0.8 + waited * 0.2);
    delete order.target.energyWaitAt;
    Object.assign(order.slot, { name: order.name, memory: order.memory, phase: 'spawning',
        spawnedAt: Date.now(), until: Game.time + 1700, expires: Date.now() + 1700 * clock().ms });
    const roster = order.squad.slots.filter(s => s.name).map(s => s.name);
    for (const slot of order.squad.slots) if (slot.memory) slot.memory.guardRoster = roster;
    publish(true);
}
function report() {
    const rows = Object.values(state().targets).map(t => ({ target: key(t.shard, t.room), sponsor: t.home,
        stopped: t.stopped, safeMode: t.safeMode, gap: t.gap, replacementLead: t.lead, remaining: t.remaining,
        estimatedReplacementTicks: (() => {
            const q = t.squads.find(q => !q.retired && q.id !== t.active);
            return q ? Math.max(0, t.lead - (Game.time - q.created)) : undefined;
        })(),
        shortages: require('system.guardBoosts').shortages(t.home),
        squads: t.squads.map(q => ({ id: q.id, active: q.id === t.active, retired: !!q.retired,
            slots: q.slots.map(s => ({ slot: s.slot, name: s.name, phase: s.phase, arrived: !!s.arrived, boosts: s.boosts, blocked: s.blocked })) })) }));
    const local = {};
    for (const c of localMembers()) {
        const id = key(c.memory.guardTargetShard, c.memory.destination);
        if (rows.some(row => row.target === id)) continue;
        const row = local[id] || (local[id] = { target: id, sponsor: c.memory.homeRoom, local: true, squads: [] });
        let q = row.squads.find(q => q.id === c.memory.guardSquad);
        if (!q) { q = { id: c.memory.guardSquad, slots: [] }; row.squads.push(q); }
        q.slots.push(snapshot(c));
    }
    for (const row of Object.values(local)) {
        row.gap = !row.squads.some(q => q.slots.length === 4 && q.slots.every(s => s.phase === 'arrived' && s.assembled));
        rows.push(row);
    }
    return rows;
}
module.exports = { state, key, body, clock, latch, escalated, run, publish, adopt, spawnOrder, spawned,
    report, fresh, snapshot, movement, travelTicks, leadTime, BOOSTS_BY_PART };
