// Persistent room defense. Tick counters are local; remote deadlines use wall time.
const ism = require('runtime.ism');
const stage = require('room.stage');
const SOURCES = ['shard0', 'shard1', 'shard2', 'shard3', 'shardX'];
const DESIRED_SQUADS = 2;       // a latched developing room was attacked: hold two quads, not one
const PREDEPLOY_MARGIN = 250;   // arrive during safe mode, when hostile attacks and healing are disabled
const SIEGE_RAMPART_HITS = 250000;
const BOOSTS_BY_PART = () => ({ [TOUGH]: RESOURCE_CATALYZED_GHODIUM_ALKALIDE,
    [MOVE]: RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE, [RANGED_ATTACK]: RESOURCE_CATALYZED_KEANIUM_ALKALIDE,
    [HEAL]: RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE });
function state() {
    return Memory.guardSquads || (Memory.guardSquads = { rooms: {}, targets: {}, serial: 0 });
}
function key(shard, room) { return shard + ':' + room; }
// Every member is the same (combat.bodies.quadMember): TOUGH, RANGED_ATTACK and HEAL about 4:1,
// MOVE, in that order. (slot is kept for callers; the dedicated healer is gone.)
function body(capacity, slot) {
    return require('combat.bodies').quadMember(capacity);
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
    return safeModeRemaining(shard, room) > 0;
}
function safeModeRemaining(shard, room) {
    if (shard === Game.shard.name) {
        const r = Game.rooms[room];
        return r && r.controller ? Math.max(0, r.controller.safeMode || 0) : 0;
    }
    const report = remote(shard), r = report && report.rooms && report.rooms[room];
    if (!r || !(r.safeMode > 0) || !report.at) return 0;
    const elapsed = Math.max(0, Date.now() - report.at) / Math.max(100, report.ms || 3000);
    return Math.max(0, Math.ceil(r.safeMode - elapsed));
}
function protectedRampart(room, rampart) {
    if (!room || !rampart || !rampart.pos || rampart.structureType !== STRUCTURE_RAMPART) return false;
    const x = rampart.pos.x, y = rampart.pos.y;
    const supply = Game.flags[room.name + 'Supply'];
    if (supply && supply.pos.x === x && supply.pos.y === y) return true;
    return require('runtime.cache').find(room, FIND_MY_STRUCTURES).some(s => s.pos &&
        (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_TOWER) && s.pos.x === x && s.pos.y === y);
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
function register(shard, room, home, corner, distance, force) {
    const s = state(), id = key(shard, room);
    if (!force && !escalated(shard, room) && !s.targets[id]) return;
    let t = s.targets[id];
    if (!t) t = s.targets[id] = { shard, room, home, corner, distance, squads: [], samples: {} };
    t.home = home; t.corner = corner; t.distance = distance;
    t.safeModeRemaining = safeModeRemaining(shard, room);
    t.safeMode = t.safeModeRemaining > 0;
    if (!t.desired) t.desired = DESIRED_SQUADS;
    const r = shard === Game.shard.name ? Game.rooms[room] : null;
    const report = shard === Game.shard.name ? null : remote(shard);
    const rr = report && report.rooms && report.rooms[room];
    t.stopped = !!(r && (!r.controller || !r.controller.my || stage.established(r))) ||
        !!(fresh(report) && rr && (rr.owned === false || rr.established));
    // Lost (no longer ours), as opposed to graduated: squads still on their way are recalled.
    t.lost = !!(r && (!r.controller || !r.controller.my)) || !!(fresh(report) && rr && rr.owned === false);
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
// Squad homes. One room boosting both quads could not keep up (shardX W1N22: E1N16 built every
// squad while E3N18, as close to the W0N20 portal, built none). The sponsor builds one quad; a
// helper home, the nearest room to the portal corner (or to the target) able to build and boost
// the same quad, builds the other. Each new squad goes to whichever of the two has fewer squads
// that will still be alive when it arrives (ties: the sponsor). No helper: the sponsor builds all.
const HELPER_RECHECK = 1000;   // ticks between helper-home choices
const HELPER_SLACK = 3;        // a helper may be at most this many rooms farther than the sponsor
function canBuildQuads(name, sponsor) {
    const room = Game.rooms[name], s = Game.rooms[sponsor];
    if (!room || !room.controller || !room.controller.my || !room.storage || !room.terminal) return false;
    if (require('system.retire').retiring(name)) return false;
    if (!((Memory.labList && Memory.labList[name]) || []).length) return false;
    if (!Object.values(Game.spawns).some(sp => sp.room.name === name)) return false;
    return !s || room.energyCapacityAvailable >= s.energyCapacityAvailable;
}
function helperHome(t) {
    if (t.helperAt !== undefined && Game.time - t.helperAt < HELPER_RECHECK && (!t.helper || canBuildQuads(t.helper, t.home))) return t.helper || null;
    if (!Game.map.getRoomLinearDistance) return null;
    const goal = t.corner || t.room, far = name => Game.map.getRoomLinearDistance(name, goal);
    const limit = far(t.home) + HELPER_SLACK;
    let best = null;
    for (const name in Game.rooms) {
        if (name === t.home || !canBuildQuads(name, t.home) || far(name) > limit) continue;
        if (!best || far(name) < far(best)) best = name;
    }
    t.helper = best;
    t.helperAt = Game.time;
    return best;
}
function chooseHome(t, others) {
    const helper = helperHome(t);
    const pool = helper ? [t.home, helper] : [t.home];
    const load = {};
    for (const h of pool) load[h] = 0;
    for (const q of others) if ((q.home || t.home) in load) load[q.home || t.home]++;
    return pool.reduce((best, h) => (load[h] < load[best] ? h : best), pool[0]);
}
function homeOf(t, q) { return q.home || t.home; }
// Squads made before homes were assigned: one already spawning stays where it started; an
// empty one gets a home now.
function assignHomes(t) {
    for (const q of t.squads) {
        if (q.home) continue;
        const started = q.slots.find(s => s.memory && s.memory.homeRoom);
        q.home = started ? started.memory.homeRoom : chooseHome(t, t.squads.filter(o => o !== q && o.home && !o.retired));
    }
}
function newSquad(t, others = []) {
    const s = state();
    const id = Game.shard.name + '/' + t.room + '/' + (++s.serial);
    const q = { id, created: Game.time, home: chooseHome(t, others), slots: [0, 1, 2, 3].map(slot => ({ slot, phase: 'missing' })) };
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
    assignHomes(t);
    const complete = [];
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
        q.complete = q.slots.every(s => s.arrived && s.assembled && !s.stale && s.expires > now);
        q.remaining = q.complete ? Math.min(...q.slots.map(s => (s.expires - now) / clock().ms)) : 0;
        if (q.complete) complete.push(q);
    }
    // A shardX room is only guarded during a claim attempt: shardX switched on, in claim (or done)
    // mode, with the room still one of its targets. Otherwise (switched off, scouting, reset) the
    // target is dropped once its squads are recalled, so a later scout run never restarts quads.
    const switchedOff = t.shard === 'shardX' && !claimTarget(t.room);
    if (switchedOff) t.stopped = true;
    if (t.stopped) {
        // Lost, or shardX switched off: squads bound for it go home, unboost and recycle
        // (creep.recall) instead of walking on (shardX E29N36 was lost while two quads were on
        // their way). A room that graduated keeps the squads already posted or travelling.
        // (A shardX room still being claimed is being reclaimed: its squads stay.)
        if ((t.lost && !(t.shard === 'shardX' && claimTarget(t.room))) || switchedOff) {
            for (const c of localMembers()) {
                if (c.memory.destination === t.room && c.memory.guardTargetShard === t.shard) c.memory.guardRecall = 1;
            }
        }
        t.squads = t.squads.filter(q => q.slots.some(s => s.name));
        if (switchedOff) delete state().targets[key(t.shard, t.room)];
        return;
    }
    const desired = t.desired || DESIRED_SQUADS;
    t.lead = leadTime(t);
    complete.sort((a, b) => b.created - a.created);
    const active = complete.slice(0, desired);
    t.active = active.map(q => q.id);
    t.remaining = active.length ? Math.max(0, Math.min(...active.map(q => q.remaining))) : 0;
    // Once newer replacements are fully posted, old squads may finish their lives without
    // reserving another generation of replacements.
    for (const q of complete.slice(desired)) q.retired = true;

    // Do not burn creep life through the whole safe-mode window. Begin early enough to finish
    // spawning, boosting and travelling, with time to kill staged hostiles while they cannot heal.
    if (t.safeMode && t.safeModeRemaining > t.lead + PREDEPLOY_MARGIN) {
        t.gap = false;
        return;
    }

    // Pending/travelling squads count toward future coverage; an expiring posted squad does not,
    // which pipelines its successor before a gap opens.
    const future = t.squads.filter(q => !q.retired && (!q.complete || q.remaining > t.lead));
    // Allocate at most one manifest per tick. This keeps publication and lab reservations
    // deterministic while still filling both formations long before a meaningful deadline.
    if (future.length < desired) newSquad(t, future);

    t.gap = complete.length < desired;
    if (t.gap && (!t.warned || Game.time - t.warned >= 500)) {
        console.log('[guards] ' + key(t.shard, t.room) + ': quad coverage incomplete; replenishing from ' +
            Array.from(new Set(t.squads.map(q => homeOf(t, q)))).join(' and '));
        t.warned = Game.time;
    }
    t.squads = t.squads.filter(q => !q.retired || q.slots.some(s => s.name));
}
function claimTarget(room) {
    const xs = Game.shard.name === 'shard2' ? Memory.xs : ism.get('shard2', 'xs');
    return !!(require('system.shardX').enabled() && xs && (xs.mode === 'claim' || xs.mode === 'done') &&
        (xs.targets || []).some(t => t.r === room));
}
// Forget every guard target on a shard (shardX('reset')): squads still on this shard go home and
// recycle. Returns the number of creeps recalled.
function forget(shard) {
    const s = state();
    let recalled = 0;
    for (const id of Object.keys(s.targets)) {
        const t = s.targets[id];
        if (t.shard !== shard) continue;
        for (const c of localMembers()) {
            if (c.memory.destination === t.room && c.memory.guardTargetShard === t.shard && !c.memory.guardRecall) {
                c.memory.guardRecall = 1;
                recalled++;
            }
        }
        delete s.targets[id];
    }
    if (shard === Game.shard.name) for (const name of Object.keys(s.rooms)) delete s.rooms[name];
    return recalled;
}
function run() {
    const s = state(); clock();
    // An attacked-room latch outlives the room: drop it once the room is no longer ours (owned
    // rooms are always visible). Otherwise a lost room stays "escalated" and re-arms quads later.
    for (const name of Object.keys(s.rooms)) {
        const room = Game.rooms[name];
        if (!room || !room.controller || !room.controller.my) delete s.rooms[name];
    }
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
    if (xs && xs.mode === 'claim' && require('system.shardX').enabled()) for (const t of xs.targets || []) {
        const [shard, home] = t.h.split(':');
        // A room that was ours and was declaimed is reclaimed with quads first: always a target.
        const p = (ism.get('shardX', 'xs') || {}).progress || {};
        if (shard === Game.shard.name) register('shardX', t.r, home, t.e, t.t, !!(p[t.r] && p[t.r].lost));
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
        if (t.stopped || !t.squads.some(q => homeOf(t, q) === home)) continue;
        const remaining = safeModeRemaining(t.shard, t.room);
        if (remaining > (t.lead || leadTime(t)) + PREDEPLOY_MARGIN) continue;
        const activeIds = Array.isArray(t.active) ? t.active : t.active ? [t.active] : [];
        const pending = t.squads.filter(q => !q.retired && !activeIds.includes(q.id));
        const candidates = (pending.length ? pending : t.squads.filter(q => !q.retired)).filter(q => homeOf(t, q) === home);
        for (const q of candidates) {
            const slot = q.slots.find(s => !s.name);
            if (!slot) continue;
            const parts = body(Game.rooms[home].energyCapacityAvailable, slot.slot);
            if (!parts.length) continue;
            // A member waits at home until its MOVE is boosted: never spawn one this home cannot
            // boost (no XZHO2 lab leased, or not enough XZHO2).
            if (!require('system.guardBoosts').moveReady(home, parts)) {
                t.moveBlocked = home;
                continue;
            }
            delete t.moveBlocked;
            slot.phase = 'queued';
            const name = 'gq-' + Game.shard.name + '-' + (++state().serial).toString(36);
            const memory = { priority: 'roomGuard', homeRoom: home, destination: t.room,
                guardTargetShard: t.shard, guardSquad: q.id, guardSlot: slot.slot,
                guardKind: 'quad', guardPhase: 'boosting',
                guardDeparture: Game.time + Math.max(0, Math.floor(t.remaining - travelTicks(t, 4) - 50)),
                guardRoster: q.slots.filter(s => s.name).map(s => s.name) };
            if (!activeIds.length) delete memory.guardDeparture;
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
    const rows = Object.values(state().targets).map(t => ({ target: key(t.shard, t.room), sponsor: t.home, helper: t.helper,
        stopped: t.stopped, safeMode: t.safeMode, gap: t.gap, replacementLead: t.lead, remaining: t.remaining,
        estimatedReplacementTicks: (() => {
            const q = t.squads.find(q => !q.retired && q.id !== t.active);
            return q ? Math.max(0, t.lead - (Game.time - q.created)) : undefined;
        })(),
        shortages: require('system.guardBoosts').shortages(t.home),
        squads: t.squads.map(q => ({ id: q.id, home: homeOf(t, q), active: Array.isArray(t.active) ? t.active.includes(q.id) : q.id === t.active, retired: !!q.retired,
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
module.exports = { chooseHome, helperHome, homeOf, forget, claimTarget, state, key, body, clock, latch, escalated, run, publish, adopt, spawnOrder, spawned,
    report, fresh, snapshot, movement, travelTicks, leadTime, safeModeRemaining, protectedRampart,
    DESIRED_SQUADS, SIEGE_RAMPART_HITS, BOOSTS_BY_PART };
