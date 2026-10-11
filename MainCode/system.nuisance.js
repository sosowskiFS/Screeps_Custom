// system.nuisance — cheap pests in rooms Harabi reserves on shardX.
//
// HarabiBot (reviewed: github.com/sy-harabi/screeps-harabibot_v2) treats any foreign creep with a
// CARRY part on its remote rooms or remote paths as a threat (its remote rooms turn unsafe, a
// remote-defense mission opens). So for every shardX room last seen reserved by PLAYER, and by
// nobody else, one CARRY+MOVE creep (creep.xNuisance, 100 energy) is sent there: it empties the
// room's containers onto the ground next to them, and flees anything that can damage it.
//   - Rooms: Memory.expandIntel on shardX, reservation by PLAYER seen within RECENT ticks. The home
//     that scouted the room (Memory.xs.tag: fastest trip, its corner) sends the creep.
//   - One creep per room at a time; a room that is no longer PLAYER's reservation is let go (the
//     creep retires when it sees that).
//   - CPU: none sent while shardX's governor sheds anything or its bucket is low (as for bait).
// shardX reports the rooms (nz: [{ r, h, e, n }]) every 100 ticks; the homes order the creeps
// (system.shardX scheduleNuisance).
const PLAYER = 'Harabi';
const RECENT = 10000;
const MAX_ROOMS = 15;
const GAP = 300;                  // between orders for one room
const BODY = [CARRY, MOVE];

function creeps() {
    return Object.values(Game.creeps).filter(c => c.memory.priority === 'xNuisance');
}

// shardX: the rooms to pester.
function report() {
    const bait = require('system.bait');
    if ((Game.cpu && Game.cpu.bucket < bait.BUCKET_MIN) || require('runtime.cpuGovernor').shedLevel() > 0) return [];
    const intel = Memory.expandIntel || {}, tags = (Memory.xs && Memory.xs.tag) || {};
    const live = creeps(), out = [];
    for (const name in intel) {
        const entry = intel[name], tag = tags[name];
        if (entry.r !== PLAYER || entry.o || Game.time - (entry.t || 0) > RECENT || !tag || !tag.h) continue;
        const room = Game.rooms[name], c = room && room.controller;
        if (c && !(c.reservation && c.reservation.username === PLAYER)) continue;     // seen otherwise now
        out.push({ r: name, h: tag.h, e: tag.e, k: tag.t, n: live.filter(cr => cr.memory.destination === name).length });
    }
    out.sort((a, b) => (a.k || 0) - (b.k || 0));
    return out.slice(0, MAX_ROOMS);
}

// Home shard: orders for rooms this shard's homes scouted that have no pest yet. busy: homes with
// an order already waiting (one per home); last: per-room order times (updated).
function due(nz, here, homes, inFlight, queued, last, busy = []) {
    const used = new Set(busy), out = [];
    for (const z of nz || []) {
        const [shard, home] = String(z.h).split(':');
        if (shard !== here || !homes.includes(home) || used.has(home)) continue;
        if (z.n || inFlight.some(c => c.memory.destination === z.r) || queued.includes(z.r)) continue;
        if (Game.time - (last['z:' + z.r] || 0) < GAP) continue;
        last['z:' + z.r] = Game.time;
        used.add(home);
        out.push({ home, memory: { priority: 'xNuisance', destination: z.r, homeRoom: home, xShard: { c: z.e } } });
    }
    return out;
}

function body() {
    return BODY.slice();
}

module.exports = { PLAYER, report, due, body, GAP, RECENT };
