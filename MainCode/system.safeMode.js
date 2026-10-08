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
// It also fires, before any damage, when another player's creep with CLAIM parts has an open path to
// a tile next to the controller: once the controller is attacked, safe mode is blocked.
// Only with a charge available, no cooldown, and no other room of ours on this shard already in
// safe mode (the game allows one at a time). tower.Operate's proximity rule skips these rooms.
const stage = require('room.stage');

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

// A hostile claimer that can walk up to the controller (structures in the way count; creeps move).
function claimerApproaching(room) {
    const controller = room.controller;
    for (const creep of require('system.claimDefense').claimers(room)) {
        const ret = PathFinder.search(creep.pos, { pos: controller.pos, range: 1 }, {
            maxRooms: 1, plainCost: 2, swampCost: 10,
            roomCallback: name => (name === room.name ? require('traveler').Traveler.getStructureMatrix(room) : false),
        });
        if (!ret.incomplete) return creep.owner.username + '\'s claimer has an open path to the controller';
    }
    return null;
}

function threat(room) {
    const controller = room.controller;
    if (!controller || !controller.my || stage.established(room)) return null;
    return attackedBy(room) || claimerApproaching(room);
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
        if (!c || !c.my || c.safeMode || !c.safeModeAvailable || c.safeModeCooldown) continue;
        const reason = threat(room);
        if (!reason || safeModeActiveElsewhere(name)) continue;
        const result = c.activateSafeMode();
        const text = 'SAFE MODE ' + (result === OK ? 'activated' : 'failed (' + result + ')') + ' in ' + name + ' (under construction): ' + reason;
        console.log('[safeMode] ' + text);
        if (result === OK) {
            Game.notify(text);
            Memory.LastNotification = Game.time + ' : ' + text;
        }
    }
}

module.exports = { run, threat, attackedBy };
