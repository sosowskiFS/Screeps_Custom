// system.hunt — a standing guard-quad order against one player in a room that is not ours.
//
// HUNTS: shardX E25N38, where Harabi has been attacking Bezoka (E25N37) and border-hopping into
// E25N38. One boosted quad at a time from E32N39 (shard2) only, through the E30N40 portal; it parks
// at the south border of the room (PARK) and fights there with the normal quad combat logic.
//   - Bezoka (WHITELIST) is on the whitelist on every shard: neither he nor his structures are
//     targets, and his rooms are no longer avoided as claimed by a hostile player.
//   - A squad that loses two or more members well before their life runs out (KILLED_MARGIN) lost
//     its fight. LOSSES of those in a row delay the next squad by DELAY ticks.
//   - shardX records when it last saw the player in the room (InterShardMemory 'hunt'). Not seen for
//     two quad lifespans (UNSEEN_LIVES x 1,500 ticks, counted from the order's start at the
//     latest): the order ends, no more squads are sent (Memory.hunt.done).
//   - AVOID: rooms the quad never routes through (E26N38: walled off). Members carry the list
//     (memory.guardAvoid, also in their manifests for the far side of the portal).
// system.guardSquads keeps the target (t.hunt): no ownership, claim or safe-mode rules apply to it.
const HUNTS = [
    { shard: 'shardX', room: 'E25N38', player: 'Harabi', home: 'E32N39', homeShard: 'shard2', corner: 'E30N40', distance: 400,
        park: { x: 25, y: 45 }, avoid: ['E26N38'] },
];
const WHITELIST = ['Bezoka'];
const UNSEEN_LIVES = 2;
const LIFE = 1500;
const KILLED_MARGIN = 300;       // ticks of life left at death that count as killed, not expired
const LOSSES = 2;
const DELAY = 3000;

function state() {
    const s = Memory.hunt || (Memory.hunt = {});
    if (!s.done) s.done = {};
    if (!s.start) s.start = {};
    return s;
}

function whitelist() {
    if (!Array.isArray(Memory.whiteList)) Memory.whiteList = [];
    for (const name of WHITELIST) if (!Memory.whiteList.includes(name)) Memory.whiteList.push(name);
    // Rooms recorded as hostile-claimed by a player now whitelisted are no longer avoided.
    for (const room in Memory.badRooms || {}) if (WHITELIST.includes(Memory.badRooms[room].o)) delete Memory.badRooms[room];
}

function key(h) { return h.shard + ':' + h.room; }

// shardX: when the player was last seen in each hunt room (ms, Date.now()).
function runTarget() {
    const ism = require('runtime.ism');
    const seen = Object.assign({}, ism.getLocal('hunt') || {});
    let changed = false;
    for (const h of HUNTS) {
        if (h.shard !== Game.shard.name) continue;
        const room = Game.rooms[h.room];
        if (!room) continue;
        if (room.find(FIND_HOSTILE_CREEPS).some(c => c.owner && c.owner.username === h.player)) {
            seen[h.room] = Date.now();
            changed = true;
        }
    }
    if (changed && Game.time % 10 === 0) ism.setLocal('hunt', seen);
}

// Home shard: keep the guard target for each live order; end orders whose player stays away.
function runHome() {
    const s = state(), squads = require('system.guardSquads');
    const seen = require('runtime.ism').get('shardX', 'hunt') || {};
    for (const h of HUNTS) {
        if (h.homeShard !== Game.shard.name || s.done[key(h)]) continue;
        if (!s.start[key(h)]) s.start[key(h)] = Date.now();
        const last = Math.max(s.start[key(h)], seen[h.room] || 0);
        if (Date.now() - last > UNSEEN_LIVES * LIFE * squads.clock().ms) {
            s.done[key(h)] = Date.now();
            delete squads.state().targets[squads.key(h.shard, h.room)];
            const text = '[hunt] ' + h.player + ' not seen in ' + h.room + ' for ' + UNSEEN_LIVES + ' quad lifespans: order ended';
            console.log(text);
            Game.notify(text);
            continue;
        }
        const t = squads.register(h.shard, h.room, h.home, h.corner, h.distance, true);
        if (!t) continue;
        t.hunt = { player: h.player, park: h.park, avoid: h.avoid || [] };
        // Members and manifests made before the avoid list changed get the current one.
        for (const q of t.squads) for (const slot of q.slots) {
            if (slot.memory) slot.memory.guardAvoid = t.hunt.avoid;
            const c = slot.name && Game.creeps[slot.name];
            if (c && JSON.stringify(c.memory.guardAvoid) !== JSON.stringify(t.hunt.avoid)) {
                c.memory.guardAvoid = t.hunt.avoid;
                delete c.memory.guardStaging; delete c.memory._trav;
            }
        }
        t.desired = 1;
        t.helper = null;                  // this home only
        t.helperAt = Game.time;
    }
}

function run() {
    whitelist();
    if (Game.shard.name === 'shardX') runTarget();
    else runHome();
}

module.exports = { run, HUNTS, WHITELIST, KILLED_MARGIN, LOSSES, DELAY, UNSEEN_LIVES, state };
