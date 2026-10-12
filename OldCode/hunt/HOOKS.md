# Retired: hunt order (shardX E25N38, 2026-10-11 to 2026-10-12)

A standing guard-quad order against Harabi in shardX E25N38 (he border-hopped there while attacking Bezoka at E25N37). One T3 quad at a time from E32N39 (shard2), parked at the south border; delayed after lost fights, ended after 3,000 ticks without a sighting. Retired at the user's request: the order failed.

Files here: `system.hunt.js` (the order), `hunt.test.js` (its tests). Below, the hooks it had in the running code, as they were when it was retired. To restore: copy both files back into MainCode (and tests/), add `['hunt', () => require('system.hunt').run()],` before `guardSquads` in main.js, and put these hooks back.

Kept in the running code (general, not hunt-only): killability-based focus (`combat.intel.killTime` / `score`), group choice by kill time (`creep.guardQuad.engagement`), duel verdict (`creep.guardQuad.duel` / `survival`). Bezoka stays on `Memory.whiteList` (it is in Memory on every shard).

## combat.bodies.js: hunter body
```js
// The hunt quad (system.hunt) against Harabi's T3 quads (2 rangers: 35 RANGED, 5 HEAL; 2 healers:
// 8 TOUGH, 32 HEAL; all boosted): 2,800 damage, up to 3,552 healing on one creep. Per member at full
// size: 9 TOUGH (900 boosted hits absorb a whole 2,800 volley, 840 after the 70% cut, with nothing
// spilling over), 5 HEAL (960 across the quad covers that 840), 26 RANGED (4,160 across the quad, above
// his 3,552: a ranger of a full quad dies in about 8 ticks), 10 MOVE (boosted: full speed). The
// standard member (22 RANGED, 3,520) could never out-damage his healing.
function hunterQuad(energyCapacity) {
    for (let n = 10; n >= 1; n--) {
        const tough = Math.round(0.9 * n), heal = Math.round(0.5 * n), ranged = 4 * n - tough - heal;
        const body = [].concat(Array(tough).fill(TOUGH), Array(ranged).fill(RANGED_ATTACK), Array(n).fill(MOVE), Array(heal).fill(HEAL));
        if (cost(body) <= energyCapacity) return order(body);
    }
    return [];
}
```

## system.guardSquads.js: body by target
```js
// t: the target; a hunt (system.hunt) gets the hunter body (combat.bodies.hunterQuad).
function body(capacity, slot, t) {
    const bodies = require('combat.bodies');
    return t && t.hunt ? bodies.hunterQuad(capacity) : bodies.quadMember(capacity);
}
```

## system.guardSquads.js: killed members (updateTarget slot loop)
```js
                if (confirmedGone || now > (slot.expires || now) || Game.time > (slot.until || Infinity)) {
                    // A hunt counts members killed (gone with life left), not expired (system.hunt).
                    if (t.hunt && confirmedGone && slot.spawnedAt && (slot.expires || 0) - now > require('system.hunt').KILLED_MARGIN * clock().ms) {
                        q.killed = (q.killed || 0) + 1;
                    }
```

## system.guardSquads.js: scoring and exemptions (updateTarget)
```js
    if (t.hunt) scoreHunt(t);
    // A shardX room is only guarded during a claim attempt: shardX switched on, in claim (or done)
    // mode, with the room still one of its targets. Otherwise (switched off, scouting, reset) the
    // target is dropped once its squads are recalled, so a later scout run never restarts quads.
    // A hunt (system.hunt) is not our room: no ownership or claim rules; it ends there.
    if (t.hunt) { t.stopped = false; t.lost = false; }
    const switchedOff = t.shard === 'shardX' && !t.hunt && !claimTarget(t.room);
```

## system.guardSquads.js: scoreHunt
```js
// A hunt squad with nobody left is scored once: two or more members killed is a lost fight, and
// LOSSES lost in a row hold the next squad for DELAY ticks (system.hunt).
function scoreHunt(t) {
    const hunt = require('system.hunt');
    for (const q of t.squads) {
        if (q.scored || q.slots.some(s => s.name) || !q.slots.some(s => s.spawnedAt)) continue;
        q.scored = true;
        t.lostStreak = (q.killed || 0) >= 2 ? (t.lostStreak || 0) + 1 : 0;
        if (t.lostStreak >= hunt.LOSSES) {
            t.holdUntil = Game.time + hunt.DELAY;
            t.lostStreak = 0;
            console.log('[hunt] ' + key(t.shard, t.room) + ': ' + hunt.LOSSES + ' squads lost in a row; next one held until ' + t.holdUntil);
        }
    }
}
// Squads for shardX rooms dropped from the targets (shardX('focus')) that are still entirely on this
```

## system.guardSquads.js: followManifests avoid list
```js
        if (!shard || shard === Game.shard.name) continue;
        const r = remote(shard), m = r && r.manifests && r.manifests[c.name];
        if (m && JSON.stringify(m.guardAvoid || []) !== JSON.stringify(c.memory.guardAvoid || [])) {
            c.memory.guardAvoid = m.guardAvoid;
            delete c.memory.guardStaging; delete c.memory._trav;
        }
```

## system.guardSquads.js: spawnOrder hold and member memory
```js
        if (t.holdUntil && Game.time < t.holdUntil) continue;          // hunt: after lost fights
            if (t.hunt && t.hunt.park) memory.guardPark = t.hunt.park;
            if (t.hunt && t.hunt.avoid && t.hunt.avoid.length) memory.guardAvoid = t.hunt.avoid;
```

## creep.guardQuad.js: avoid list in snake and stagingRoom, parking spot in defend
```js
    const options = { range: post ? 1 : 0, maxRooms: post ? 1 : 16 };
    const first = ordered(members)[0];
    // Rooms this squad never routes through (system.hunt AVOID: walled off): out of the room route
    // and out of every tile search, the wider fallbacks included.
    const avoid = first.memory.guardAvoid || [];
    if (avoid.length && !post) {
        options.routeCallback = name => (avoid.includes(name) && name !== first.room.name ? Infinity : undefined);
        options.roomCallback = name => (avoid.includes(name) && name !== first.room.name ? false : undefined);
    }
    if (post) options.roomCallback = name => {
...
    if (from !== target) {
        const Traveler = require('traveler').Traveler;
        const avoid = m.guardAvoid || [];
        const route = Game.map.findRoute(from, target, {
            routeCallback: name => (avoid.includes(name) && name !== from ? Infinity :
                name === target || name === from || !Traveler.checkAvoid(name) ? 1 : Infinity),
        });
        if (Array.isArray(route) && route.length >= 2) room = route[route.length - 2].room;
...
        }
    }
    // A hunt quad (system.hunt) parks at its spot (the south border of E25N38), others by the controller.
    const park = leader.memory.guardPark;
    const goal = park ? position(park.x, park.y, room.name) : room.controller ? room.controller.pos : leader.pos;
    // An idle, formed squad needs no path search or footprint rebuild.
```

## system.guardBoosts.js: boosts reserved for the target's body
addSquad(need, room, t) and squads.body(capacity, slot, t) in prepare().

## README section (removed)
- **Hunt order** (`system.hunt`): shardX E25N38, where Harabi attacks Bezoka (E25N37) and border-hops into E25N38. One boosted quad at a time from **E32N39 on shard2 only** (no helper home; shard3 can't do it), through the E30N40 portal.
  - **Posting:** it parks at the south border of E25N38 (25,45) and fights with the normal quad combat logic. The target is exempt from the claim, ownership and safe-mode rules for our own rooms.
  - **Hunter body** (`combat.bodies.hunterQuad`): 9 TOUGH, 26 RANGED, 10 MOVE, 5 HEAL per member, all T3. Built against a snapshot of Harabi's T3 quads: 2 rangers (35 RANGED, 5 HEAL) and 2 healers (8 TOUGH, 32 HEAL), 2,800 damage and up to 3,552 healing on one creep.
    - **Can't be killed by one of his quads:** his 2,800 is 840 through our 9 T3 TOUGH, which takes it whole, and our 960 healing covers it.
    - **Can kill:** our 4,160 out-damages his 3,552 healing; a ranger of a full quad dies in about 8 ticks. The standard member (22 RANGED, 3,520) never could.
    - **Split pairs:** a ranger pair split from its healers across a border (he border-hops) has 480 healing and dies in about 2 ticks.
  - **Targeting (all fighters):** focus goes to the target we kill fastest against the healing that reaches it; targets we can't out-damage come after those we can. Threat alone used to pick his T3-TOUGH healers.
  - **Group choice (quads):** the group that loses a member to us soonest (kill time plus the walk there), so split pairs come first. The group chased is kept unless another dies 30% sooner.
  - **Duel verdict (quads):** retreat is decided as a duel: our fastest kill on the group against their fastest kill on one of us. A member whose boosted TOUGH takes each whole volley, with our healing covering what gets through, can't be killed. Side totals called the fight with a full Harabi quad lost.
  - **No-go rooms:** the quad never routes through E26N38 (walled off). Members carry the list (`guardAvoid`, in their manifests too). It is kept out of the staging choice, the room route and every tile search, Traveler's wider fallbacks included.
  - **Whitelist:** Bezoka is on the whitelist on every shard, so he and his structures are never targets, and his rooms are no longer avoided as hostile-claimed. His towers still treat us as hostile, and the quad's verdict doesn't count them.
  - **Lost fights:** a squad that loses 2 or more members with 300+ ticks of life left lost its fight. Two lost in a row hold the next squad for 3,000 ticks.
  - **End:** shardX records when it last sees Harabi in E25N38. Not seen for two quad lifespans (3,000 ticks, counted from the order's start at the latest), the order ends for good (`Memory.hunt.done`). Squads already out live out their lives.
  - **Boosts:** like any quad, members leave only with MOVE boosted. E32N39 had no XZHO2 when this was written; the boost reservation pulls it there by terminal first.
