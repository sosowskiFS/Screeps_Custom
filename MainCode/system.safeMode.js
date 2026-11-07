// system.safeMode — safe mode for rooms under construction.
//
// A room still being built (ours, no terminal yet: room.stage) has few or no defenses. Safe mode
// is saved for when it is actually needed: it fires only when the room's event log (last tick)
// shows another player hurting us:
//   - one of our creeps damaged by an attack (melee, ranged, ranged mass);
//   - a structure in the room damaged, dismantling included;
//   - our controller attacked (CLAIM).
// Hostiles merely being in the room do not count: a quad stuck on a room exit next door marched in
// and out of shardX's E29N36 without touching anything. Invaders, source keepers and whitelisted
// players never count; nor does an attacker that is already gone (owner unknown).
// It also fires, before any damage, when another player's creep with CLAIM parts is within
// CLAIMER_RANGE of the controller with an open path to a tile next to it: once the controller is
// attacked, safe mode is blocked. Further off the towers have time to kill it (shard2 E42N31 spent a
// charge on one lone claimer nowhere near its controller).
// Only with a charge available, no cooldown, and no other room of ours on this shard already in
// safe mode (the game allows one at a time). tower.Operate's proximity rule skips these rooms.
// An attacked room that cannot have safe mode (another room has it, no charge, cooldown, blocked
// controller) is still flagged as attacked, so guard quads are sent (system.guardSquads).
//
// Built rooms (a terminal) had no automatic safe mode at all; tower.Operate's proximity rule only
// covers RCL < 7, so shardX W1N9 (RCL7, the shard's one developed room) would have watched a breach.
// lastResort() fires, against another player's armed creeps, before the base can be wrecked:
//   - breach: the rampart/wall ring was seen closed (no spawn, storage, terminal or tower reachable
//     from the exits) and now one is reachable;
//   - breach imminent: a barrier being worn down (net hits lost a tick, repairs included, over the
//     last BREACH_WINDOW ticks) falls within BREACH_LEAD ticks, and its loss would open the ring;
//   - a spawn, storage, terminal or tower hit by a player and under half its hits;
//   - the controller attacked, or a claimer close with an open path to it (as for young rooms).
// A creep with only CLAIM parts can do nothing to the base: it never counts as a breach.
// Rooms that never had a closed ring get only the last two (and tower.Operate's proximity rule).
//
// Reserved safe mode: the game allows one room in safe mode per shard at a time, for 20,000 ticks.
// Where one room is clearly the shard's most developed (the only one at the top RCL, RCL6+), the
// shard's safe mode is kept for it: no other room there activates one (they latch guard squads
// instead). Memory.safeModeReserve = a room name overrides the choice; false turns it off.
const stage = require('room.stage');
const runtimeCache = require('runtime.cache');

const BREACH_LEAD = 30;
const BREACH_WINDOW = 20;
const RING_EVERY = 3;
const CORE = () => new Set([STRUCTURE_SPAWN, STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_TOWER]);
const OBSTACLE = () => new Set([STRUCTURE_WALL, STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_LINK, STRUCTURE_STORAGE, STRUCTURE_TOWER,
    STRUCTURE_OBSERVER, STRUCTURE_POWER_SPAWN, STRUCTURE_LAB, STRUCTURE_TERMINAL, STRUCTURE_NUKER, STRUCTURE_FACTORY, STRUCTURE_CONTROLLER, STRUCTURE_EXTRACTOR]);

const NPC = new Set(['Invader', 'Source Keeper']);

function hostilePlayer(object) {
    const owner = object && object.owner && object.owner.username;
    if (!owner || object.my || NPC.has(owner)) return null;
    if (Memory.whiteList && Memory.whiteList.includes(owner)) return null;
    return owner;
}

function hurtsUs(target, room) {
    if (!target) return false;
    if (target.my) return true;                                      // our creeps and structures
    return !!(target.structureType && target.pos && target.pos.roomName === room.name && !target.owner);   // roads, containers, walls here
}

// Who attacked what last tick in this room: a reason string, or null.
function attackedBy(room) {
    let log;
    try {
        log = room.getEventLog();
    } catch (e) {
        return null;
    }
    for (const entry of log) {
        if (entry.event !== EVENT_ATTACK && entry.event !== EVENT_ATTACK_CONTROLLER) continue;
        const player = hostilePlayer(Game.getObjectById(entry.objectId));
        if (!player) continue;
        if (entry.event === EVENT_ATTACK_CONTROLLER) return player + ' attacked the controller';
        const target = Game.getObjectById(entry.data && entry.data.targetId);
        if (!hurtsUs(target, room)) continue;
        const what = target.structureType ? target.structureType : 'creep ' + target.name;
        return player + ' damaged ' + what + ' (' + ((entry.data && entry.data.damage) || 0) + ')';
    }
    return null;
}

// A hostile claimer close to the controller that can walk up to it (structures in the way count; creeps
// move). Our ramparts stop it, public ones too: the shared matrix is for our own creeps, who walk through
// them, and system.defense closes any within 4 of a hostile before it could step on one.
const CLAIMER_RANGE = 5;
function hostileMatrix(room) {
    const matrix = require('traveler').Traveler.getStructureMatrix(room).clone();
    for (const s of runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_RAMPART } })) matrix.set(s.pos.x, s.pos.y, 255);
    return matrix;
}
function claimerApproaching(room) {
    const controller = room.controller;
    for (const creep of require('system.claimDefense').claimers(room)) {
        if (Math.max(Math.abs(creep.pos.x - controller.pos.x), Math.abs(creep.pos.y - controller.pos.y)) > CLAIMER_RANGE) continue;
        const ret = PathFinder.search(creep.pos, { pos: controller.pos, range: 1 }, {
            maxRooms: 1, plainCost: 2, swampCost: 10,
            roomCallback: name => (name === room.name ? hostileMatrix(room) : false),
        });
        if (!ret.incomplete) return creep.owner.username + '\'s claimer is close, with an open path to the controller';
    }
    return null;
}

function threat(room) {
    const controller = room.controller;
    if (!controller || !controller.my) return null;
    if (stage.established(room)) return lastResort(room);
    return attackedBy(room) || claimerApproaching(room);
}

// ---------------------------------------------------------------- built rooms: the last resort

// Another player's creeps that can hurt the base (attack, ranged, dismantle, claim).
function armedPlayers(room) {
    const armed = new Set([ATTACK, RANGED_ATTACK, WORK, CLAIM]);
    return runtimeCache.find(room, FIND_HOSTILE_CREEPS).filter(c => hostilePlayer(c) && (c.body || []).some(p => p.hits > 0 && armed.has(p.type)));
}

// Tiles hostiles reach from the exits without crossing our ramparts or walls (structures are
// reached, not walked through). open: a core structure is reached. without: a barrier tile
// (x * 50 + y) treated as gone.
function flood(room, without) {
    const terrain = room.getTerrain();
    const block = new Uint8Array(2500);
    for (let x = 0; x < 50; x++) for (let y = 0; y < 50; y++) if (terrain.get(x, y) & TERRAIN_MASK_WALL) block[x * 50 + y] = 1;
    const obstacle = OBSTACLE(), core = CORE(), coreTiles = [];
    const structures = runtimeCache.find(room, FIND_STRUCTURES);
    for (const s of structures) {
        const k = s.pos.x * 50 + s.pos.y;
        if (obstacle.has(s.structureType) && s.structureType !== STRUCTURE_WALL && !block[k]) block[k] = 2;
        if (s.my && core.has(s.structureType)) coreTiles.push(k);
    }
    // Our ramparts and walls are barriers, whatever stands under them.
    for (const s of structures) {
        const k = s.pos.x * 50 + s.pos.y;
        if (k !== without && ((s.structureType === STRUCTURE_RAMPART && s.my) || s.structureType === STRUCTURE_WALL)) block[k] = 1;
    }
    const outside = new Uint8Array(2500);
    const queue = [];
    for (let i = 0; i < 50; i++) for (const [x, y] of [[i, 0], [i, 49], [0, i], [49, i]]) {
        const k = x * 50 + y;
        if (!block[k] && !outside[k]) { outside[k] = 1; queue.push(k); }
    }
    while (queue.length) {
        const k = queue.pop(), x = Math.floor(k / 50), y = k % 50;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx > 49 || ny > 49) continue;
            const n = nx * 50 + ny;
            if (outside[n] || block[n] === 1) continue;
            outside[n] = 1;
            if (block[n] !== 2) queue.push(n);
        }
    }
    // A core structure is exposed when hostiles reach it or a tile next to it (its own rampart, at
    // RCL8, is then all that is left).
    const exposed = k => {
        const x = Math.floor(k / 50), y = k % 50;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx <= 49 && ny <= 49 && outside[nx * 50 + ny]) return true;
        }
        return false;
    };
    return { open: coreTiles.some(exposed), outside };
}

// ---------------------------------------------------------------- exposed tiles

// A tile ranged attackers outside the walls can hit: no rampart of ours on it, and a tile they can
// reach from the exits within RANGED_REACH. Below RCL8 the base's structures have no ramparts of
// their own, and shardX W1N9's builders kept rebuilding extensions 2-3 tiles inside the ring while
// a ranged quad shot them from outside. Cached EXPOSED_TTL ticks per room.
const RANGED_REACH = 3;
const EXPOSED_TTL = 10;
const exposure = Object.create(null);
function exposedTiles(room) {
    const e = exposure[room.name];
    if (e && Game.time - e.t < EXPOSED_TTL) return e.tiles;
    const { outside } = flood(room);
    const covered = new Set(runtimeCache.find(room, FIND_STRUCTURES)
        .filter(s => s.structureType === STRUCTURE_RAMPART && s.my).map(s => s.pos.x * 50 + s.pos.y));
    const tiles = new Uint8Array(2500);
    for (let k = 0; k < 2500; k++) {
        if (!outside[k]) continue;
        const x = Math.floor(k / 50), y = k % 50;
        for (let dx = -RANGED_REACH; dx <= RANGED_REACH; dx++) for (let dy = -RANGED_REACH; dy <= RANGED_REACH; dy++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx <= 49 && ny <= 49) tiles[nx * 50 + ny] = 1;
        }
    }
    for (const k of covered) tiles[k] = 0;
    exposure[room.name] = { t: Game.time, tiles };
    return tiles;
}
function exposed(room, x, y) {
    return exposedTiles(room)[x * 50 + y] === 1;
}
// Another player's armed creeps are in the room.
function underFire(room) {
    return armedPlayers(room).length > 0;
}
// Not worth building (or repairing) at this tile now: under fire and exposed (ramparts and walls
// excepted: they are the cover). Exposed covers everything outside the ring, so this holds back roads
// and structures out there too: base.builder, system.roads, roads laid by walking creeps (creep.movement),
// tower road repairs and sites placed before the attack (base.builder removes them). Energy went into
// rebuilding what the attackers outside kept breaking.
function buildHeld(room, pos, structureType) {
    if (structureType === STRUCTURE_RAMPART || structureType === STRUCTURE_WALL) return false;
    return underFire(room) && exposed(room, pos.x, pos.y);
}

// Heap: per room the ring's state ({ t, open, closedSeen }) and the barriers players are wearing
// down ({ id: [[tick, hits], ...] }).
const rings = Object.create(null);
const wear = Object.create(null);

function ringState(room) {
    let r = rings[room.name];
    if (!r || Game.time - r.t >= RING_EVERY) {
        const open = flood(room).open;
        r = rings[room.name] = { t: Game.time, open, closedSeen: (r && r.closedSeen) || !open };
    }
    return r;
}

// Hit samples of every barrier players hit, the last BREACH_WINDOW ticks.
function noteWear(room, log) {
    const w = wear[room.name] || (wear[room.name] = {});
    for (const entry of log) {
        if (entry.event !== EVENT_ATTACK || !hostilePlayer(Game.getObjectById(entry.objectId))) continue;
        const id = entry.data && entry.data.targetId;
        const target = id && Game.getObjectById(id);
        if (target && (target.structureType === STRUCTURE_RAMPART || target.structureType === STRUCTURE_WALL) && !w[id]) w[id] = [];
    }
    for (const id in w) {
        const s = Game.getObjectById(id);
        if (!s) { delete w[id]; continue; }
        const samples = w[id];
        if (!samples.length || samples[samples.length - 1][0] !== Game.time) samples.push([Game.time, s.hits]);
        while (samples.length > 2 && Game.time - samples[0][0] > BREACH_WINDOW) samples.shift();
    }
    return w;
}

// Ticks until a barrier falls at its net loss over the window (repairs included).
function breachEta(samples, hits) {
    if (samples.length < 2) return Infinity;
    const [t0, h0] = samples[0];
    const rate = (h0 - hits) / Math.max(1, Game.time - t0);
    return rate > 0 ? hits / rate : Infinity;
}

function lastResort(room) {
    const armed = armedPlayers(room);
    if (!armed.length) {
        delete wear[room.name];
        if (Game.time % 50 === 0) ringState(room);      // learn the ring while quiet
        return null;
    }
    const who = armed[0].owner.username;
    let log = [];
    try { log = room.getEventLog(); } catch (e) { log = []; }
    for (const entry of log) {
        if (entry.event === EVENT_ATTACK_CONTROLLER && hostilePlayer(Game.getObjectById(entry.objectId))) return who + ' attacked the controller';
    }
    const claimer = claimerApproaching(room);
    if (claimer) return claimer;
    // Claimers alone: the rest of this is about what can hurt the base.
    const fighter = new Set([ATTACK, RANGED_ATTACK, WORK]);
    if (!armed.some(c => (c.body || []).some(p => p.hits > 0 && fighter.has(p.type)))) return null;
    const core = CORE();
    for (const entry of log) {
        if (entry.event !== EVENT_ATTACK || !hostilePlayer(Game.getObjectById(entry.objectId))) continue;
        const target = Game.getObjectById(entry.data && entry.data.targetId);
        if (target && target.my && core.has(target.structureType) && target.hits < target.hitsMax / 2) {
            return who + ' has the ' + target.structureType + ' at ' + target.hits + ' hits';
        }
    }
    const ring = ringState(room);
    if (!ring.closedSeen) return null;
    if (ring.open) return 'breach: ' + who + ' can reach the core';
    const w = noteWear(room, log);
    for (const id in w) {
        const s = Game.getObjectById(id);
        if (!(breachEta(w[id], s.hits) <= BREACH_LEAD)) continue;
        if (flood(room, s.pos.x * 50 + s.pos.y).open) {
            return 'breach within ' + BREACH_LEAD + ' ticks: ' + s.structureType + ' at ' + s.pos.x + ',' + s.pos.y + ' (' + s.hits + ' hits)';
        }
    }
    return null;
}

// ---------------------------------------------------------------- the shard's reserved safe mode

// The room the shard's safe mode is kept for, or null.
function reservedRoom() {
    if (Memory.safeModeReserve === false) return null;
    if (typeof Memory.safeModeReserve === 'string' && Game.rooms[Memory.safeModeReserve]) return Memory.safeModeReserve;
    let top = 0, at = [];
    for (const name in Game.rooms) {
        const c = Game.rooms[name].controller;
        if (!c || !c.my || require('system.bait').isBait(name)) continue;
        const level = c.level || 0;
        if (level > top) { top = level; at = [name]; } else if (level === top) at.push(name);
    }
    return top >= 6 && at.length === 1 ? at[0] : null;
}
function mayActivate(room) {
    const reserved = reservedRoom();
    return !reserved || reserved === room.name;
}

function safeModeActiveElsewhere(roomName) {
    for (const name in Game.rooms) {
        const c = Game.rooms[name].controller;
        if (name !== roomName && c && c.my && c.safeMode) return true;
    }
    return false;
}

function run() {
    for (const name in Game.rooms) {
        const room = Game.rooms[name];
        const c = room.controller;
        if (!c || !c.my || c.safeMode) continue;
        // Decoy rooms (system.bait) never take the shard's one safe mode from the real rooms.
        if (require('system.bait').isBait(name)) continue;
        const reason = threat(room);
        if (!reason) continue;
        if (!mayActivate(room)) {
            require('system.guardSquads').latch(room, 'attacked; safe mode kept for ' + reservedRoom() + ': ' + reason);
            continue;
        }
        // An attacked controller (upgradeBlocked) cannot enter safe mode until the block ends.
        if (!c.safeModeAvailable || c.safeModeCooldown || c.upgradeBlocked > 0 || safeModeActiveElsewhere(name)) {
            require('system.guardSquads').latch(room, 'attacked without safe mode: ' + reason);
            continue;
        }
        const result = c.activateSafeMode();
        const text = 'SAFE MODE ' + (result === OK ? 'activated' : 'failed (' + result + ')') + ' in ' + name +
            (stage.established(room) ? ' (last resort): ' : ' (under construction): ') + reason;
        console.log('[safeMode] ' + text);
        if (result === OK) {
            require('system.guardSquads').latch(room, 'automatic safe mode: ' + reason);
            Game.notify(text);
            Memory.LastNotification = Game.time + ' : ' + text;
        }
    }
}

module.exports = { run, threat, attackedBy, lastResort, claimerApproaching, CLAIMER_RANGE, flood, reservedRoom, mayActivate, BREACH_LEAD, exposed, underFire, buildHeld };
