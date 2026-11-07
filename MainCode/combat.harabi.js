// combat.harabi — reading Harabi's squads by what they say, for our main opponent only.
//
// Recorded in shardX E23N31 (256 ticks, 2026-11-07): one creep of each squad speaks in public every tick, and
// its emojis match what the squad does:
//   🔫🛑  holds still at about range 3, firing (152 ticks: it sat there wearing the wall down)
//   🌀    holds still beside the wall, mass attacking, while nothing hurts it
//   💨    retreats a tile or two to heal (💨🚑; 💨🚨 after a big hit), then 👣🎲 steps straight back in,
//         often to the tile it left, almost every other tick
//   👣    moving (🔍 retarget, 🔄 repath, 🐢 slowed, 🚪 an exit)
// Steady damage it heals (about 600 a tick for 100+ ticks) never moved it; a single hit of about 1,000-2,400,
// or a member under about 3,700 of 5,000, made it retreat. So against him:
//   - towers do not trickle: they fire only when the towers and the defenders in range land at least
//     BURST_MIN on one member this tick (or kill it), on the member taking the most (towerOrder). Below
//     that they keep their energy. Defenders' fire costs nothing and goes on.
//   - after a retreat the defenders take posts by the tile it left (returnTile), ready for its return.
// Safeguards: all of this only while the speech keeps matching what it predicts (trusted): a 🔫🛑 speaker
// (or 🌀) stays put, a 💨 one moves off and comes back within RETURN_TICKS ticks, a burst is followed by a retreat
// within BURST_TICKS (the whole point of it), and it keeps speaking. Fewer
// than TRUST of the last CHECKS predictions right, any other player armed in the room, or towers held for
// HOLD_MAX ticks without his squad retreating once, and it is normal defence (the last for COOLDOWN ticks).
// Memory.settings.harabiTactics = false turns it off.
//
// One squad at a time (commitSquad): with two of his squads in the room the defenders went back and forth
// between them as each retreated in turn, and got little done at either. They commit to the squad the whole
// force (every defender, and the towers) beats by the most over its healing, and keep it COMMIT_TICKS at
// least. A burst or a long hold only counts against the logic once the force is there (fullForce:
// FULL_SHARE of the defenders in range of the target): it used to give up while most were still on the way.
const runtimeCache = require('runtime.cache');
const combatIntel = require('combat.intel');

const NAME = 'Harabi';
const BURST_MIN = 1000;
const CHECKS = 20;
const MIN_CHECKS = 6;
const TRUST = 0.75;
const SILENT = 3;            // ticks without his speaker's speech that count as a miss
const RETURN_TICKS = 3;
const BURST_TICKS = 3;
const BURST_MISSES = 3;     // bursts in a row with no retreat: it does not work here, normal defence
const HOLD_MAX = 150;
const COOLDOWN = 300;
const SQUAD_RANGE = 3;
const COMMIT_TICKS = 40;
const SWITCH_FACTOR = 1.3;   // another squad must be this much easier to switch to it
const FULL_SHARE = 0.6;

const rooms = Object.create(null);   // heap: room -> state

function stanceOf(message) {
    const m = String(message || '');
    if (m.includes('💨')) return 'retreat';
    if (m.includes('🔫🛑')) return 'hold';
    if (m.includes('🌀')) return 'mass';
    if (m.includes('👣')) return 'move';
    return 'other';
}

function enabled() {
    return !(Memory.settings && Memory.settings.harabiTactics === false);
}

function note(st, ok) {
    st.checks.push(ok ? 1 : 0);
    if (st.checks.length > CHECKS) st.checks.shift();
}
function trustOf(st) {
    if (st.checks.length < MIN_CHECKS) return false;
    return st.checks.reduce((a, b) => a + b, 0) / st.checks.length >= TRUST;
}
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

// This tick's reading of the room: null without Harabi squads, or { trusted, speakers: [{ creep, stance }],
// returnTiles: [{x, y}] }. Run once per room per tick.
function observe(room) {
    if (!room) return null;
    const tick = runtimeCache.current();
    const cache = tick.harabi || (tick.harabi = Object.create(null));
    if (cache[room.name] !== undefined) return cache[room.name];
    const intel = combatIntel.roomIntel(room);
    const his = intel.threats.filter(t => t.owner && t.owner.username === NAME);
    if (!his.length || !enabled()) {
        delete rooms[room.name];
        return (cache[room.name] = null);
    }
    const st = rooms[room.name] || (rooms[room.name] = { checks: [], seen: Object.create(null), off: 0, holdSince: null, lastRetreat: Game.time, silent: 0, on: false });
    const others = intel.threats.some(t => !(t.owner && t.owner.username === NAME));
    const speakers = his.filter(t => t.saying).map(creep => ({ creep, stance: stanceOf(creep.saying) }));
    // Checks against last tick's reading.
    if (!speakers.length) {
        if (++st.silent >= SILENT) { note(st, false); st.silent = 0; }
    } else st.silent = 0;
    // A burst fired is a prediction too: a retreat within BURST_TICKS.
    if (st.burst) {
        if (speakers.some(sp => sp.stance === 'retreat')) { note(st, true); st.burst = null; st.burstMisses = 0; }
        else if (Game.time > st.burst) {
            note(st, false);
            st.burst = null;
            // Holds keep being right while bursts move nothing: those alone decide it.
            st.burstMisses = (st.burstMisses || 0) + 1;
            if (st.burstMisses >= BURST_MISSES) {
                st.off = Game.time + COOLDOWN;
                st.burstMisses = 0;
                console.log('[harabi] ' + room.name + ': ' + BURST_MISSES + ' bursts in a row made no retreat; normal defence for ' + COOLDOWN);
            }
        }
    }
    const returnTiles = [];
    for (const { creep, stance } of speakers) {
        const prev = st.seen[creep.id];
        if (prev && prev.t === Game.time - 1) {
            // Both holding stances mean standing still (🌀 is its stance by the wall; it spent most of a
            // later fight there, and with only 🔫🛑 checked the logic never had the checks to switch on).
            if (prev.stance === 'hold' || prev.stance === 'mass') note(st, creep.pos.x === prev.x && creep.pos.y === prev.y);
            if (prev.stance === 'retreat' && !prev.back) {
                // Away from where it was, then back by that tile within RETURN_TICKS.
                prev.back = { x: prev.from.x, y: prev.from.y, by: Game.time + RETURN_TICKS };
            }
        }
        const pending = prev && prev.back;
        if (pending) {
            if (cheb(creep.pos, pending) <= 1 && stance !== 'retreat') { note(st, true); delete prev.back; }
            else if (Game.time > pending.by) { note(st, false); delete prev.back; }
        }
        const from = prev && stance === 'retreat' && prev.stance !== 'retreat' ? { x: prev.x, y: prev.y } : (prev && prev.from);
        if (stance === 'retreat') st.lastRetreat = Game.time;
        st.seen[creep.id] = { t: Game.time, x: creep.pos.x, y: creep.pos.y, stance, from: stance === 'retreat' ? from || { x: creep.pos.x, y: creep.pos.y } : undefined, back: pending && prev.back };
        if (stance === 'retreat' && st.seen[creep.id].from) returnTiles.push(st.seen[creep.id].from);
    }
    for (const id in st.seen) if (Game.time - st.seen[id].t > 50) delete st.seen[id];
    let trusted = !others && trustOf(st) && Game.time >= st.off;
    // Held too long with no retreat out of it: this is not working, back to normal for a while.
    if (trusted && st.holdSince !== null && Game.time - st.holdSince > HOLD_MAX && Game.time - st.lastRetreat > HOLD_MAX) {
        st.off = Game.time + COOLDOWN;
        st.holdSince = null;
        trusted = false;
        console.log('[harabi] ' + room.name + ': towers held ' + HOLD_MAX + ' ticks with no retreat; normal defence for ' + COOLDOWN);
    }
    if (!Memory.harabiStatus) Memory.harabiStatus = {};
    Memory.harabiStatus[room.name] = { on: trusted ? 1 : 0, right: st.checks.reduce((a, b) => a + b, 0), of: st.checks.length, t: Game.time };
    if (trusted !== st.on) {
        st.on = trusted;
        console.log('[harabi] ' + room.name + ': speech-read defence ' + (trusted ? 'on' : 'off') + ' (' + st.checks.reduce((a, b) => a + b, 0) + '/' + st.checks.length + ' predictions right)');
    }
    return (cache[room.name] = { trusted, speakers, returnTiles, his });
}

function towersOf(room) {
    return runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } })
        .filter(t => (t.store ? t.store[RESOURCE_ENERGY] || 0 : t.energy || 0) >= 10);
}
function defendersOf(room) {
    return runtimeCache.find(room, FIND_MY_CREEPS).filter(c => c.memory && c.memory.priority === 'defender' && !c.spawning);
}
// Damage landing on t this tick: the towers, and the defenders within `reach` of it (3: in range now; more:
// the whole force once it closes in), through its boosted TOUGH.
function damageOn(room, t, reach) {
    const staffing = require('defense.staffing');
    let hit = towersOf(room).reduce((n, tw) => n + staffing.towerDamage(cheb(tw.pos, t.pos)), 0);
    for (const d of defendersOf(room)) if (cheb(d.pos, t.pos) <= reach) hit += combatIntel.assess(d).ranged;
    return hit * staffing.toughFactor(t);
}

// His squads: each speaker and his creeps within SQUAD_RANGE of it; any left over join the nearest speaker.
function squadsOf(o) {
    const squads = o.speakers.map(sp => ({ speaker: sp.creep, stance: sp.stance, members: [] }));
    if (!squads.length) return [];
    for (const t of o.his) {
        let best = squads[0], d = Infinity;
        for (const sq of squads) { const r = cheb(sq.speaker.pos, t.pos); if (r < d) { d = r; best = sq; } }
        best.members.push(t);
    }
    return squads;
}

// The squad the whole force works on: the one it beats by the most over its healing, kept COMMIT_TICKS
// at least and then only given up for one SWITCH_FACTOR easier. Each squad: its easiest member.
function commitSquad(room, o) {
    const st = rooms[room.name];
    const intel = combatIntel.roomIntel(room);
    const squads = squadsOf(o).map(sq => {
        let target = null, net = -Infinity;
        for (const t of sq.members) {
            if (combatIntel.onExit(t.pos)) continue;
            const n = damageOn(room, t, 50) - combatIntel.supportHealing(t, intel);
            if (n > net) { net = n; target = t; }
        }
        return Object.assign(sq, { target, net });
    }).filter(sq => sq.target);
    if (!squads.length) return null;
    const best = squads.reduce((a, b) => (b.net > a.net ? b : a));
    const current = st.commit && squads.find(sq => sq.speaker.id === st.commit.id);
    if (current && (Game.time - st.commit.since < COMMIT_TICKS || !(best.net > Math.max(current.net, 1) * SWITCH_FACTOR))) return current;
    if (!current || best !== current) st.commit = { id: best.speaker.id, since: Game.time };
    return best;
}

function fullForce(room, t) {
    const defenders = defendersOf(room);
    if (!defenders.length) return true;   // the towers are all there is
    const near = defenders.filter(d => cheb(d.pos, t.pos) <= 3).length;
    return near >= Math.max(1, Math.ceil(defenders.length * FULL_SHARE));
}

// What the towers should do against him this tick: null for normal targeting, else { target } (fire at
// it, every tower) or { target: null } (hold fire). His committed squad only, unless another creep of his
// can be killed this tick.
function towerOrder(room) {
    const o = observe(room);
    if (!o || !o.trusted) return null;
    const st = rooms[room.name];
    const squad = commitSquad(room, o);
    const intel = combatIntel.roomIntel(room);
    let best = null, bestHit = 0;
    for (const t of o.his) {
        if (combatIntel.onExit(t.pos)) continue;
        const ours = squad && squad.members.includes(t);
        let hit = damageOn(room, t, 3);
        const kills = hit - combatIntel.supportHealing(t, intel) >= t.hits;
        if (!ours && !kills) continue;
        if (kills) hit += 1e6;
        if (hit > bestHit) { bestHit = hit; best = t; }
    }
    const full = best && fullForce(room, best);
    if (best && bestHit >= BURST_MIN) {
        st.holdSince = null;
        // Only a burst the whole force took part in tests the retreat rule.
        if (!st.burst && full) st.burst = Game.time + BURST_TICKS;
        return { target: best };
    }
    // Waiting for the force to close in is not a fruitless hold.
    if (!full) st.holdSince = null;
    else if (st.holdSince === null) st.holdSince = Game.time;
    return { target: null };
}

// Where defenders should be: by the tile his committed squad's speaker left as it retreated (it comes
// straight back), else by that squad's easiest member. null when the speech is not trusted.
function anchor(room) {
    const o = observe(room);
    if (!o || !o.trusted) return null;
    const squad = commitSquad(room, o);
    if (!squad) return null;
    const st = rooms[room.name];
    const seen = st.seen[squad.speaker.id];
    if (squad.stance === 'retreat' && seen && seen.from) return { pos: { x: seen.from.x, y: seen.from.y }, target: squad.target };
    return { pos: squad.target.pos, target: squad.target };
}
function returnTile(room) {
    const a = anchor(room);
    return a && a.target && (a.pos.x !== a.target.pos.x || a.pos.y !== a.target.pos.y) ? { x: a.pos.x, y: a.pos.y } : null;
}

function state(roomName) {
    return rooms[roomName];
}

module.exports = { observe, towerOrder, anchor, returnTile, commitSquad, stanceOf, state, BURST_MIN, HOLD_MAX, COOLDOWN, MIN_CHECKS, COMMIT_TICKS };
