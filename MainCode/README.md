# Screeps framework

This is a flat CommonJS Screeps World project. Upload **all root-level `.js` files together**, including the new `runtime.*`, `system.*`, `config.*`, and role modules. No bundler, package installation, or Memory wipe is needed. `tests/` and `tools/` are local development files, not game modules.

## Where to make changes

| Responsibility | Module |
| --- | --- |
| Tick order and phase registration | `main.js` |
| Role aliases, CPU throttling and fallback selection | `creep.registry.js` |
| Creep and power-creep execution | `system.creeps.js` |
| Mature-room hauling and mineral harvesting | `creep.mule.js`, `creep.distributor.js`, `creep.mineralMiner.js` |
| Shared energy actions, road placement, travel cleanup | `creep.logistics.js`, `creep.movement.js` |
| Room economy and maintenance | `system.rooms.js` |
| Towers, hostile detection, ramparts | `system.defense.js`, `tower.Operate.js` |
| Spawn sequencing, commands and population census | `system.spawning.js` |
| Spawn reservations and shared energy accounting | `spawn.state.js` |
| Spawn bodies and staffing policies | Existing `spawn.Build*` modules |
| Links, labs, power processing, factories and nukers | `system.industry.js` |
| Reaction planning (what each room's labs make) | `system.labs.js` |
| Observers and remote opportunity detection | `system.observers.js` |
| Market policy and room trading | `system.market.js`, `market.FindBuyers.js` |
| Flags and periodic empire state | `system.flags.js`, `system.state.js` |
| Base layout planning and building | `base.planner.js` (pure planner), `base.builder.js` (Memory, sites, visuals), `base.migrate.js` (moving established rooms onto it) |
| Construction scheduling and extension roads | `system.construction.js` |
| Visuals and CPU measurements | `system.visuals.js`, `runtime.metrics.js` |
| Memory initialization and shared tick queries | `runtime.memory.js`, `runtime.cache.js` |

Add a role module with `run(creep)`, register its existing/new priority names in `creep.registry.js`, and add its spawning policy to the appropriate spawn module. Aliases such as `NearDeath` remain explicit. Add empire work as a named phase in `main.js`; phase order matters because defense, room management, spawning and role execution share decisions. Room management remains at its original point in spawn traversal.

## Tick efficiency and cache contracts

- `runtime.cache.find(room, FIND_*, options)` shares a tick snapshot and indexes object-style `structureType` filters. Results are independent arrays, so sorting or splicing one query cannot corrupt another. Function filters are reevaluated on every call, including mutable creep-memory predicates. Construction-site queries stay native to preserve reads after planner mutations.
- `homeCreeps(roomName)` builds one empire index on demand during spawning. It includes remote and spawning creeps. Treat its arrays as read-only. Use it **before role execution**, since roles may change home assignments.
- Market searches request `{ resourceType, type }` from the engine, then apply the original price, distance, energy and filled-order restrictions. Raw orders are shared only within the current tick; filtered results are independent. Screeps documents this indexed API as the fast alternative to callback-only queries: [market API](https://docs.screeps.com/api/#Game.market.getAllOrders).
- Traveler retains structure matrices and primitive topology records across ticks. It checks positions, types, ownership, public-rampart state and construction sites before reuse. Creep matrices remain tick-local; callbacks and obstacle overlays clone base matrices. Unused topology entries expire during periodic cleanup. Do not mutate a matrix returned by `getStructureMatrix` directly; clone it first.
- Live room-creep lists live in the heap, never in persistent Memory. No private `RawMemory._parsed` memory hack is used. Durable configuration and creep state keep their existing names.
- Population census runs only when a spawn can act. Empty structure lists are valid results. Tower road repair selects the first lowest-hit target once per room instead of sorting for each tower. Extension-road generation builds occupancy and adjacency grids once and preserves the original x/y placement order and site-cap exit.
- Production recipes load once per global reset. Shared movement helpers replace duplicate worker/lab-worker implementations.

Room structure lists refresh every 50 ticks, including rooms with no links; missing lists rebuild immediately. Empty observer lists refresh every 50 ticks, while established observers retain the 5,000-tick refresh. These replace every-tick empty-list scans, so newly built structures in previously empty rooms can take up to 49 ticks to be discovered. The `resetLinks` flag still forces rebuilding. Existing creep priorities, body policies, economic thresholds, combat decisions, remote throttles, and other operation schedules are retained.

Initialization now works on a fresh Memory and preserves observer pointers across global resets. Scratch spawn accounting resets at tick start so CPU interruption cannot carry a stale room energy budget into the next tick. A power-creep-only attack no longer dereferences a nonexistent ordinary hostile. These are explicit robustness fixes.

## Creep CPU settings

Every successful creep action, including `creep.say`, is billed (~0.2 CPU). To keep creep CPU low, these cosmetic features are **off by default**:

```js
// Decorative/status speech (upgrader emotes, guard idles, lab-worker debug codes, ✖️ throttle marks):
Memory.settings = Object.assign(Memory.settings || {}, { creepSpeech: true });
// Traveler path lines and stuck/fatigue circles (global.TRAVELER_VISUALIZE still overrides):
Memory.settings.travelerVisuals = true;
```

Movement-coordination speech (`x;y` step-aside requests and the 💦 reply) always stays on because creeps read it.

Role-level CPU behavior worth knowing when debugging:
- Mules, distributors and post-withdraw refills choose the next spawn/extension/lab **by range** from a per-tick typed list (`findEnergySink` in `creep.logistics.js`); Traveler still does the real pathing.
- Far mules parked at a container wait until it holds enough to fill them (or half a container, 25 ticks, or low TTL) instead of withdrawing every tick.
- Pre-RCL5 workers look for energy by range and back off 5 ticks when nothing qualifies.
- Lab workers that find no work sleep 10 ticks (still stepping aside for others).
- `placeRoadOnPath` stops after one lookup on existing roads and checks each tile once per tick.
- Traveler caches `findRoute` results for 300 ticks (except calls with a custom `routeCallback`).
- Rooms with nothing to repair rescan every 50 ticks instead of every tick.
- One creep throwing no longer stops the rest: errors are caught per creep and logged once per role per 100 ticks.

## Remote combat

`combat.intel.js` assesses each creep and room once per tick. It counts only working body parts, applies boosts (boosted TOUGH raises effective HP), adds enemy towers in hostile-owned rooms, and compares how fast each side kills the other. The resulting verdict is `win`, `even` or `lose`; one side must be 1.3× faster to count as decisive. Source Keepers are ignored; the SK roles handle them.

`combat.tactics.js` turns that into behavior:
- **Fighters** (`farGuard`, ranger/`PowerGuard`) share one focus target per room per tick: anything killable this tick first, then the target with the most (damage + 2×healing) per effective HP, so healers behind boosted tanks get focused. Ramparted enemies and `TANK` bait are skipped.
- **Modes**: `engage` (winning: close in, kiters stay at range 3 unless the target is unarmed), `hold` (even: don't advance into melee) and `retreat` (losing, or under 35% HP / about to die). A retreat flees all nearby threats in one pathfinding search, then heads home and regroups for 50 ticks. A losing fight marks the room in `Memory.FarRoomsOutmatched` for 1,500 ticks, and the far-creep spawner sends a second guard while it is set.
- **Actions never cancel each other**: heal before damage lands, attack + ranged attack, or heal + ranged attack. Mass attack when it out-damages a single shot. Melee gives way to healing only when the creep (or an adjacent ally) is below half health after incoming damage.
- **Civilians** (remote miners, haulers, claimers, remote mineral miners, power collectors) step out of reach of armed hostiles. They leave or wait outside a room whose fight isn't clearly `win`, and keep treating it as dangerous for 50 ticks after last seeing it. Danger also adds the room to `Memory.FarRoomsUnderAttack`, which is what triggers guard spawns.
- **Power banks**: rival players at the bank create the `PowerGuard` flag and record `Memory.powerContested[homeRoom]`. The attackers abandon the bank if the verdict is `lose`. They also hold the final hits while rivals are present and none of our collectors are in the room. Rooms contested in the last 20,000 ticks get the escort flag together with the next `PowerAttack` flag.

### Damaged highway units

Damage disables body parts front to back, and creeps never regenerate. A unit whose working parts are all disabled used to stand still until it died, and since it still counted as alive it also blocked its replacement. Helpers in `combat.tactics.js`: `crippled(creep, type)`, `stranded`, `seekRepair`, `repaired`.
- **Deposit miner** (`farMineralMiner`, WORK-first body): with every WORK part disabled it unloads at home, then waits by storage for the towers to heal it and goes back. It suicides instead if the home has no towers or it has under 200 ticks to live. A full terminal falls back to storage. A deposit that decayed, or got too slow, is unloaded once and then the miner suicides; it no longer waits in the room center or flips between states.
- **Power healer:** picks one heal per tick, because a later self-heal used to cancel the attacker's heal. Order: itself below 50%, then its attacker (ranged at 2–3 tiles), then the most damaged friend within 3, then itself. With every HEAL part disabled it suicides (unless a healer is next to it) so a new healer spawns.
- **Power collector:** when damaged, walks to the nearest power healer in the room that can still heal, and waits beside it until fully healed. Healers heal it whenever their attacker has 1,000 hits to spare. Once the bank falls, healers stay to heal damaged collectors in the room, and only suicide when nobody there needs healing.
- **Any of these with every MOVE part disabled** waits if a healer is within 3 tiles (a collector waits for any working power healer in the room), otherwise suicides so a replacement spawns (its cargo stays in the tombstone for collectors). The power attacker waiting below 2,500 hits for its healers is unchanged.

## Automatic remote mining

`system.remoteMining.js` (phase `remoteMining`) places remote-mining flags for every home room with storage.

- **Intel.** Rooms within 2 of a home are summarised in `Memory.remoteIntel`: sources, owner, reservation, keeper lairs, hostile towers. Vision comes from observer sweeps, our own creeps (visible rooms refresh every 1,000 ticks), or a 1-MOVE scout (50 energy). The scout spawns automatically for homes without an observer when nearby intel is missing or older than 20,000 ticks. A `MineScout` flag still forces one.
- **Selection.** A source qualifies when one max-size far mule (capacity scales with the home's energy) can carry at least 85% of a reserved source's 10 energy/tick home. The round trip comes from a terrain path from home storage that pays swamp cost when loaded, and is cached per source. Excluded: owned rooms, player-reserved rooms, Source Keeper rooms, rooms with towers, `Memory.blockedRooms`, rooms in a different novice/respawn area, sources another home mines, and rooms with 4+ strikes.
- **Flags.** Qualifying sources fill free `FarMining` slots nearest-first, so the 25M/50M rampart caps drop the farthest first. Each mined room gets one `FarGuard` flag at its centre. Manual flags are never moved or removed. Auto flags are tracked in `Memory.remoteAuto` and removed when their source leaves the plan. Plans refresh every 2,000 ticks, at most one home and 10 new path searches per tick.
- **Vision.** Flags can only be created in visible rooms. A room waiting for a flag is queued, the home's observer looks at it (or its scout includes it in the route), and the flags are placed on the first tick it's visible.
- **Opt out:** `Memory.settings.autoRemote = false` (all homes) or a `<home>NoAutoRemote` flag (one home).

**Remote bodies.**
- **Far mules:** CARRY/MOVE 1:1 (full speed on unpaved plains even when full) with no ATTACK part. They're sized to the planned round trip: 10 energy/tick × trip × 1.15, between 4 and 25 pairs. Manually flagged sources get the maximum.
- **Reservers:** CLAIM/MOVE pairs only.
- **Guards are sized to the threat:** `Memory.remoteThreat[room]` records the strongest enemy force seen in each remote room (damage, healing, effective HP, whether players; kept 1,500 ticks). For any recorded force, players or invaders, the spawner sends the cheapest full-speed ranged/heal kiter that `verdictFor` says wins, or two of them if one can't. If even two max-size guards would lose, nothing is sent. Disabled rooms only get guards when such a plan exists. With no recorded force, the default small melee/ranged guard goes.
- **No war mode:** the empire-wide "war mode" switch is gone. It was set when remote miners were attacked, after a long home attack, or by the `ToggleWar` flag, and stayed on for up to 1,000 ticks. While on, every remote guard was built from big fixed bodies whether a threat was still there or not. Guards now follow the recorded threat for their own room. The two early-room worker behaviours it switched (keeping towers fed, not chasing dropped energy) now apply while that room is under attack.
- **Harassers:** 2-8 ATTACK/MOVE pairs plus a HEAL/MOVE pair. They hunt reservers first, then haulers carrying energy, then miners. Armed defenders go through the shared fight logic (engage only when winning, otherwise retreat and regroup). The CPU governor never thins them while hostiles are in their room.

**Recovering lost resources.**
- In their mining room, far mules first collect spilled energy, tombstones and ruins holding at least 200 energy (one shared lookup per room per tick). That covers spill from a late mule and haulers killed in PvP.
- Home logistics creeps (mule, distributor, lab worker, controller supplier, supplier, scraper, salvager) spend their last 30 ticks depositing their load into storage (or the terminal) when they can still reach it. That includes minerals and power.
- RCL8 and maintenance rooms also get the on-demand salvager, which retires after 100 idle ticks.

**Disabling unsafe remotes** (`Memory.remoteStatus`). A strike is registered when a player attacks a miner, when player fighters appear and our forces there aren't clearly winning, or when the room is claimed. Repeats within 100 ticks count as the same incident. A strike disables the **whole room**: every source, mule, reserver and guard. The back-off doubles per strike (1,500 → 3,000 → 6,000 … up to 50,000 ticks). Remote creeps assigned to a disabled room wait at home instead of walking in.

When the back-off ends, the room stays disabled until it has been seen clear: the observer looks first, otherwise a scout checks, or any passing creep. Seen hostile again means another strike. Strikes reset after 30,000 quiet ticks; at 4 strikes the planner drops the room (and its auto flags) until then. Legacy `FarMiningN;tick` flags from the old system are still restored as before.

## Automatic expansion

`system.expansion.js` claims a new room on its own when the shard has CPU to spare. It runs one expansion at a time on each shard, against that shard's own CPU limit. Run `expansion()` in the console to see the CPU budget, what is in progress and the ranked candidates with the reason each one is rejected. To switch it off, set `Memory.settings.autoExpand = false`; the manual `ClaimThis` / `SendHelper` flags still work either way.

- **CPU check** (every 500 ticks): shard average (governor EMA) − harasser CPU + one average room must be ≤ 85% of `Game.cpu.limit`.
  - Harasser CPU is tracked in its own bucket (`~harasser` in the room CPU table) rather than its home room's, since harassers are a bonus role that only uses free CPU.
  - Room averages need 100+ samples before they count.
  - A claim refused for GCL backs off for 20,000 ticks.
- **Sponsors:** rooms at RCL6+ with 50k+ storage energy, a spawn, and not under attack. The sponsor nearest the target by route (at most 10 rooms) sends the claimer, then 6 helpers at a time until the new room has built its terminal. After that the room develops itself.
  - Helpers fill spawns and extensions first while the young room is below half its spawn energy.
  - If the sponsor stops qualifying, another one takes over.
- **Candidates must:**
  - have a controller that nobody owns or reserves (except us), 2+ sources, and no source keepers;
  - have no room owned by us or a whitelisted player within 2 rooms;
  - not be next to (including diagonally) a room claimed by anyone else. Reserved neighbours are fine. All 8 neighbours must have been scouted;
  - be one where the base planner fits a full layout (storage plus every structure count) from terrain and the recorded source, controller and mineral positions;
  - be reachable without crossing claimed rooms.
- **Ranking:** linear distance to our nearest room, capped at 6 (farther spreads territory), plus free remote sources in the bordering rooms. Free means not owned, not reserved by others, and not source-keeper rooms.
- **Intel:** `Memory.expandIntel` is recorded from any vision, only while the CPU check passes, so a CPU-capped shard spends nothing on it.
  - Observers in sponsor rooms look at unknown rooms within 7.
  - Sponsors without an observer send a 1-MOVE scout every 1,500 ticks.
  - Entries expire after 100,000 ticks.
- **Failures:** a target is dropped and skipped for 100,000 ticks if the claimer hasn't claimed it within 5,000 ticks, if someone else claims or reserves it, or if the new room is lost.

## One creep per job with several spawns

Every spawn in a room runs its spawn checks on the same tick, but a creep ordered with `spawnCreep` only shows up in `Game.creeps` on the next tick. Each spawn used to see the job as unfilled, so a room with 3 spawns could order 3 remote miners for one source. The remote-spawn check that was meant to stop this compared a space-joined list with `!=` and never matched.

`spawn.state.js` wraps `StructureSpawn.prototype.spawnCreep` once per global. After a successful order (dry runs excluded), it calls `runtime.cache.notePending`, which adds a placeholder creep (`pending: true`, `id: ''`, the ordered memory) to every census for the rest of the tick:
- `homeCreeps(room)`: remote, power, scout, claimer, ranger, harasser and other special spawns
- the room creep list used by the room spawners
- the per-role counts in `buildSpawnRoleCache`

So a job one spawn already took counts as filled for the other spawns, for every role, including roles added later. Assault healers are never paired with a placeholder (it has no id yet). The `creepInQue` queue still blocks repeated orders until the spawn finishes.

**Opaque creep names.** Creep names are public, and the spawn modules name creeps `<role>_<spawn>_<tick>`, which tells an opponent what each creep does and where it came from. The same `spawnCreep` wrapper replaces every real order's name with 8 random letters and digits. Names are unique against living creeps, leftover creep memory and names already ordered this tick. The role stays in creep memory, which only we can read. Dry runs keep their name. Creeps spawned before this change keep their old names until they die.

## Room staffing (RCL5+)

**Essentials always spawn first** (`spawn.essentials.js`). A room with a storage needs three kinds of creep to keep its energy chain alive:
- a distributor or mule, which refills spawns and extensions from the storage
- a tower supplier, if it has towers
- a storage miner, except in maintenance mode

While any of these is missing:
- **Other spawn paths stand down:** flag commands (power, claims, assaults, rangers), remote mining, scouts, highway patrol and observer harassers. Previously a harasser could take the first energy a collapsing room scraped together.
- **Missing roles go first:** the room's staffing spawns them in this order: refill, supplier, miner.
- **Body size:** bodies are sized to the energy actually in the spawns and extensions, not the room's capacity. Previously an RCL8 room with near-empty extensions waited forever for a 1,600-energy mule while it had no supplier.

Counts are kept low by putting work into bodies, not creeps:
- Upgraders turn extra count into 12-WORK modules on one body (`GetUpgraderConfig`), so a higher upgrader count usually means larger upgraders, not more of them.
- Repairers use a full 50-part body (16 WORK / 17 CARRY / 17 MOVE) once storage is at 450k+ and the room can afford it. Operator rooms with 700k+ storage staff 3 of them, matching the old 4 × 12 WORK.
- The distributor (32 CARRY / 16 MOVE) and supplier (8 CARRY / 4 MOVE) scale with room energy, for fewer round trips per refill.
- The second mule (storage ≥ 225k) is staffed only while there are construction sites.
- The salvager (RCL5-7) is staffed only when there's something to collect: tombstones with ≥ 200 resources, ≥ 1,000 dropped resources, or a weak attack in progress (`roomsPrepSalvager`).

Rooms below RCL5 are limited by spawn energy rather than creep count. Their worker bodies already use nearly all available energy, so they keep the existing counts.

## Automatic base layout

Every owned room is laid out automatically. Rooms no longer opt in. `base.planner.js` is a pure planner: it works on terrain and structure arrays only, with no PathFinder. `base.builder.js` stores the plan and places sites. `tool.generateBase.js`, the old 2,500-line generator, is now a small wrapper.

- **Only hard requirement:** a free 3x3 next to a source.
  - Centre: the Supply tile, where the supplier stands.
  - Ring: storage, spawn and 6 towers. The spawn keeps a free tile outside the core for its other creeps; the supplier spawns straight onto the Supply tile.
  - Outside the core: the storageMiner tile, touching both the storage and the source.
  - The storage also keeps a free neighbour for haulers.

  Every placement that fits is scored by the open space around it and its distance to the controller. A Supply flag, a hand-placed first spawn, or core towers/storage already on matching tiles are kept.
- **Everything else is packed into the space connected to the core:**
  - A diagonal road lattice anchored on the core: roads where (dx+dy)%4 or (dx−dy)%4 is 0. That makes 62.5% of tiles buildable, and every buildable tile touches a road.
  - Structures take the nearest free slots, found by flooding outward from the core, so walls just shape the base instead of ruling the room out.
  - Spawns go first, then towers, terminal, storage link, factory and power spawn near the storage, boost labs near the spawn, 60 extensions, nuker and observer.
  - A final reachability check drops and refills any structure that a 1-wide gap would cut off.
- **Kept-clear paths:** from the core to the controller, both sources, the mineral and every exit, so no structure can block them. They are not built as roads here; `system.roads` routes and builds those.
- **Labs:**
  - **Reaction labs:** a 3x3 stamp of 7 labs around a road tile, with one ring tile left as the entrance. Every output is within range 2 of both inputs, and the lab worker reaches all 7 from the centre.
  - **Boost labs:** 3 separate labs.
  - **Lab list order:** `labList` follows the plan's roles: boost 0–2, reagents 3–4, outputs 5+. This only applies when every lab in the room is a planned one, so hand-built lab sets keep their order.
- **Links** are placed so `updateRoomStructureLists` assigns their roles correctly:
  - controller link within 2 of the controller
  - storage link within 3 of the storage and more than 4 from the controller
  - two source links beside the upgradeMiner tile, more than 4 from the controller and more than 3 from the storage
- **Building:**
  - Sites for whatever the RCL allows, in priority order, at most 10 per pass, leaving headroom under the 100-site cap.
  - Base roads only beside built or planned structures.
  - The Supply, storageMiner and upgradeMiner flags.
  - Ramparts over finished planned structures and the core's creep tiles, from RCL 2 as before.
  - The extractor from RCL 6.
- **What it never touches:** existing structures are never destroyed. The one exception, in fresh layouts only, is a road on a tile reserved for a building.
- **Rooms with a storage are adopted:** the storage and core stay, flags aren't moved, and the plan only fills gaps around existing structures. Their roads are never removed.
- **CPU:** a plan is computed once and kept in `Memory.basePlan` (a few ms per room). At most one room is planned per tick, and only when the CPU governor allows path-heavy work, so a deploy with every room unplanned spreads over several ticks. At most one room is built per tick: on an RCL change, otherwise every ~1,000 ticks (staggered). Both are charged to the room's CPU. A room where no core fits is retried after 20,000 ticks.
- **Flags:**
  - `RemoveAutobuildRoom`: opt this room out.
  - `AddAutobuildRoom`: opt it back in.
  - `InitAutoBuild`: replan now.
  - `VisualizeBase`: draw the plan, including a preview for rooms not owned yet. It no longer runs the generator every tick.
  - `Memory.settings.basePlanning = false` turns the whole system off.

**Never seal a path** (`base.connectivity.js`). A plan is drawn for the finished room, but while a room is being built or migrated, old structures can make a planned tile the only way through. A link site on such a tile once trapped every creep of a room in one corner. Every construction site that blocks movement is now checked against the room as it stands: each spawn must still reach a room exit, and the storage, sources, mineral and controller must stay reachable from the exits. Anything that was reachable before must still be reachable afterwards.
- **Builder:** skips a planned tile that would cut a path; it gets built later, once the way around exists.
- **Existing sites:** any site that already cuts a path is removed. Every room is checked every 100 ticks (staggered), as well as on each build pass.
- **Migration:** a structure is only removed when its replacement can go down without cutting a path.

### Migrating established rooms

Rooms with a storage start out adopted (see above), and then move onto the layout one structure at a time (`base.migrate.js`).

- **Target:** planned once per room, as if the room were empty. Only immovables count: the storage (the core forms around it; a full storage can't realistically be moved), the nuker (its energy and ghodium can't be taken out), walls, sources and the controller. If no core fits around the storage, the room stays adopted and is retried after 20,000 ticks.
- **One step at a time per room:**
  1. Pick an out-of-place structure. Blockers go first: those on a tile the plan needs for something else, on a core creep tile, or on a kept-clear path.
  2. Terminals, factories and labs that hold goods are emptied into the storage first, by the lab worker.
  3. The structure is destroyed. The builder places the replacement site at its planned tile on the next tick.
  4. Once the replacement is built, a 300-tick cooldown runs before the next step.

  Stray construction sites of movable kinds are removed. Empire-wide, a new step starts at most every 20 ticks. A step that can't empty its target within 3,000 ticks is abandoned and retried later.
- **Safety:**
  - Nothing moves while hostiles are in the room, when construction sites are short (90+), or without twice the rebuild cost plus 30k energy in storage.
  - A structure only goes if its replacement has a free planned tile. The exception is cheap blockers (extension, link, observer, lab, container), which may be cleared to make way.
  - Spawns: never the last one, never one that is spawning.
  - Towers: at least 2 always stay up.
  - Spawns, towers, terminal, factory and power spawn only move when the room has no other construction sites, so builders rebuild them first.
  - The power spawn only moves while the room's operator has 2,500+ ticks to live, enough to cover the rebuild.
  - Terminal and factory only move if the storage can take their contents.
- **Layout flags:** Supply and storageMiner move once their planned tile is clear. upgradeMiner moves once its new link is built. The miners are sent to the new spot, and the upgrade miner gets the new link.

  **Tower supplier:** auto-build rooms with 3+ spawns make the supplier in the spawn beside the Supply flag, but only while such a spawn exists. Mid-migration (old spawn moved, new one not built) or with no Supply flag, any spawn makes it. The builder never places a missing Supply flag on a tile a structure still covers. The supplier fills towers on foot while its Supply tile is blocked, and walks to the flag again whenever it moves.
- **Off switch:** `Memory.settings.baseMigration = false` stops it. Progress is kept in `Memory.baseMigrate`.

## Planned roads

`system.roads.js` (phase `roads`) keeps a road plan per owned room in `Memory.roadPlan[room]`. It's refreshed every 5,000 ticks, at most one room per tick, and only when the CPU governor allows path-heavy work.

- **Core:** existing roads next to our structures, i.e. the generated base layout (extension/lab fields, storage and spawn surroundings).
- **Routes:** paths from storage (or a spawn) to every spawn, tower, lab, terminal, factory, power spawn, nuker and link, to extensions with no adjacent road, to the controller (range 3), sources, the mineral, and this room's `FarMining` flags. Existing roads cost 1, plains 3 and swamps 15, and each path lowers the cost of the tiles it uses, so routes merge into shared trunks.
- **Repair** (tower road repair, early-room workers) only touches planned roads. Everything else decays: about 50k ticks on plains, much longer on swamp/wall tiles.
- **Building:** missing route tiles get road sites, 10 per pass, never on wall tiles, and only while there are under 90 construction sites in total.
- **Walking creeps** no longer drop road sites in planned rooms. Rooms without a plan keep the old behavior.
- **No tunnels:** a road on a wall tile costs 150x a plain road to build and maintain. Such tiles are never routed through, built, kept or repaired (towers, workers, helpers), in any room, so existing tunnels decay away.
- `Memory.settings.roadCleanup = true` removes up to 20 off-plan roads per pass instead of waiting for decay (not while under attack).
- `Memory.settings.roadPlanning = false` turns the system off.

## RCL8 maintenance mode and controller upkeep

`system.maintenance.js` (evaluated during room management, `Memory.roomMode[room]`):
- **Established:** RCL8, no construction sites, all spawns/extensions/towers/storage/terminal built, and every rampart at 25M+ hits (two nukes on the same tile).
- **Maintenance:** established, storage energy ≥ 300k to enter (stays until it drops below 150k), not under attack, no nukes inbound. An attack or nuke ends it at once; everything else is re-checked every 100 ticks.

In maintenance:
- No miners (storage pays until 150k, then miners return) and no repairers.
- One hauler instead of hauler + distributor (an operator covers it where present).
- Supplier, lab worker and mineral miner are unchanged.
- Spawn checks run every 50 ticks, and tower maintenance repair every 100.

Remote mining and its path-heavy planning/scouting are skipped for any **established** room unless storage is below 100k. The dashboard labels the room pie `Room CPU (M)`.

**Controller upkeep (all RCL8 rooms).** GCL isn't a goal, so there's no permanent upgrader. When `ticksToDowngrade` falls below 150k (of 200k), a 1-WORK upgrader (900 energy) draws from storage and tops the timer up at 100 ticks per upgrade tick, then retires about 1,000 short of full. Keeping the timer above half also keeps safe mode available. The controller supplier is then only spawned while there's power to process.

Settings:
- `Memory.settings.gclFocus = true` restores full-time upgraders.
- `Memory.settings.maintenanceMode = false` (or a `<room>NoMaintenance` flag) disables maintenance mode.

## Power creep (base operator)

`creep.baseOp.js` runs one job at a time from a priority list. Conditions are checked lazily, and an idle operator re-checks every 5 ticks (every tick while the room is under attack):

1. `OPERATE_TOWER` (under attack)
2. `OPERATE_EXTENSION`
3. `FILL_SPAWNS` (level-5 extensions: only when *spawns* lack energy)
4. `OPERATE_SPAWN`
5. `REGEN_SOURCE`
6. `OPERATE_LAB`
7. `OPERATE_POWER`
8. `FILL_POWER`

With no job it does busywork: terminal, labs, factory, overflow link to storage, power spawn/nuker. It rests 5 ticks when nothing needs energy.

Intents are never doubled. Ops are generated only on ticks no other power was used, and a finished job hands over to the next one on the following tick. Armed hostiles in reach are handled last, so they override the job's movement: hold position on a rampart, else move to the nearest rampart without crossing hostile reach, else flee every threat. Renewal is postponed while threatened unless TTL < 60.

Spawn staffing (`configurePowerCreepRoom`, mule/miner rules) and the lab worker's switch to distributor use `operatorPresent(room)`: the room's operator spawned there with TTL > 100. The `RoomOperator` flag alone no longer counts, so a dead or deleted operator no longer leaves the room without haulers.

## Power processing without an operator

Rooms without an operator in them get power into the power spawn in two ways:
- **upSupplier** (RCL8, staffed while storage + terminal hold 100+ power): refills power whenever the power spawn has 50+ free, from storage or else the terminal.
  - It only fetches energy when the upgrader link has room (or the power spawn is low on energy and has power to burn).
  - Energy it can't deliver goes back to storage.
  - Previously, with no upgrader at RCL8, it sat holding energy for the full link and never made another power run.
- **Distributor**, once the room's spawns and extensions are full: it fetches power the same way, delivers anything it carries, and tops up the power spawn's energy below 4,000 while it has power. Power it can't deliver goes back to storage.

## Lab reactions

`system.labs.js` replaces the per-room producer flags (`<room>XGHO2Producer` and the rest). The Overhaul branch ignores those flags, so they can stay for the Nightmare branch.

- **Plan:** every 100 ticks the planner adds up terminal, storage and lab contents across all rooms and compares them with a target per lab room (T3 boosts, plus G for nukers; `TARGET_PER_ROOM`). It takes the end products furthest below target first and walks each one's recipe tree. Every reaction in that tree whose two inputs are in stock is a candidate.
- **Assign:** each room with at least 6 labs (labs 4 and 5 are the reagents, 6+ are outputs) gets one reaction in `Memory.labJobs[room]`. A room keeps its reaction while it is still a candidate, or while its labs still hold a batch, so labs are not flushed every check. New assignments prefer reactions whose inputs are already in that room's terminal, which saves shipping. A product goes to at most 2 rooms, plus 1 room for every 6,000 missing.
- **Surplus:** when every target is met and nothing is blocked, idle labs make T3 up to 2× target. The market sells anything above 1.5× target.
- **Run:** the lab worker follows the room's current reaction every tick. When it changes, labs still holding the old minerals are emptied into the terminal. It no longer swaps flags, suicides to pick up a new recipe, or places sell orders. Terminal logistics request only the current reagents and withdraw requests for old ones.
- **Manual:** `Memory.labOverride[room] = RESOURCE_...` pins a room to one product. `WarBoosts` still swaps the boost labs.

## Mineral budget

`system.mineralBudget.js` keeps rooms from clogging with assorted minerals. A full storage can't bank energy, and haulers end up shuffling goods between full containers.
- **Limits:**
  - **Storage:** at least 100k free, and at most 300k of non-energy goods.
  - **Terminal:** at least 30k free, unless the storage can take the overflow.
  - **Factory:** at least 5k free, unless the storage or terminal can take it.
- **Dumping:** anything above that is dumped on the floor by the lab worker, one load at a time, and the pile decays. It goes cheapest first: base minerals, then factory goods, then compounds by reaction depth, T3 boosts last.
- **Floors:** no resource goes below 10k (room total, storage + terminal), or 30k for the room's reaction inputs, its boost-lab minerals and ghodium. Energy, power and ops are never dumped.
- **Dumped piles:** dumped types are remembered for 3,000 ticks. Salvagers and scrapers leave those piles alone, and they don't trigger salvager spawns.
- **No more shuffling:**
  - Terminal-overflow cleanup no longer puts a load back into the terminal it is clearing; with the storage full, the load is dumped.
  - The salvager delivers to the terminal when the storage is full, and drops goods when neither has room, instead of retrying a full storage forever.
- **Storage counts for reactions:**
  - **Lab feeding:** the lab worker feeds reaction and boost labs from the storage when the terminal lacks the mineral.
  - **Planner:** inputs held in storage count as local, and a room is only skipped when neither its terminal nor its storage has room.
  - **Mineral requests:** a room no longer asks other rooms for minerals its storage already holds.

## Market

- **Sell orders** (surplus T3, pixels): one order per resource for the whole empire. Our own orders are recognised by order id, so rooms never undercut each other.
- **Pricing by depth:** other sellers' orders are walked cheapest first. Our price goes 0.001 under the level where their combined amount reaches 25% of our largest order (10,000 for a 40,000 order). A token order, e.g. 500 units placed a tick under us to pull our price down, no longer sets our price: buyers clear it in one deal and then pay ours. Many small orders that together add up to real volume still count. With no meaningful competition, the price holds, or recovers to the recent average if a bait order had dragged it below that.
- **Price changes:** cuts are free and immediate. A raise costs 5% of the increase × remaining amount (about 766,000 credits to lift a 40,000 order by 383), so it only happens when the gap is at least 1%. All raises in a pass share one credit budget that never touches the 5,000-credit reserve, smallest orders first, so a short budget still moves as many orders as possible. Prices never go below 70% of the market history's volume-weighted average, or 0.5 for compounds.
- **Pixels:** listed as a sell order instead of dumped into the highest buy order. A buy order within 5% of our ask is sold into directly.
- **CPU unlocks:** a filled bid really costs bid × 1.05 (the order fee), so the market buys asks at or below that, or below the recent average, outright. That buys up to 3 asks per run, as many units as credits allow (5,000 credits are kept for fees). Otherwise it keeps one bid (5 units) 0.001 above the best other bid. The bid stays below the cheapest ask and never above 105% of the recent average, so the bot doesn't join bidding wars. A bid left higher than needed is cut for free.
- **Shards:** intershard items (CPU unlocks, pixels, access keys) belong to the account, not a shard. Only shard2 (`MARKET_SHARD`) buys, sells, reprices or cleans up their orders, and spends the daily unlock. Before, every shard acted on the same orders in the same tick: overlapping price changes and duplicate fees. Room resources are still traded by each shard for its own rooms, and every shard still generates pixels from its own bucket.
- **Cleanup:** filled orders are cancelled so they stop taking order slots. The daily unlock isn't attempted (or notified) without a token.

## Room defense

`defense.watch.js` keeps a small per-room record (`Memory.defenseWatch`) of how hostiles use the room. It tracks entries, ticks present, and ticks with every hostile within 3 tiles of an exit. A room is **draining** when hostiles stay at the border at least 80% of the time and have re-entered 3+ times or loitered 50+ ticks. A hostile that pushes deeper, or uses WORK/ATTACK against a wall or our structure, ends drain mode immediately.

While draining:
- No defenders are spawned, and the economy is not locked out of spawning.
- The bouncer does not advance the empire-wide war-mode timer.
- Towers ignore drain bait: creeps within 2 tiles of an exit that they can't kill within 2 ticks, unless the creep is damaging structures.

Always, not only while draining:
- A room leaves "under attack" only after 20 quiet ticks, so ramparts no longer open and close on every bounce.
- "Towers have no target" requests defenders only if a hostile is inside the room or sieging.
- Boosted player attackers are now recognised (`determineCreepThreat` used to always return false), so defenders spawn for them straight away.

Defenders (`creep.combat.js`) fight from ramparts. Each claims the free walkable rampart closest to the towers' current target; posts are claimed once per room per tick, and a defender keeps its post unless another is clearly better. They path only along ramparts or through tiles out of hostile reach. They leave the ramparts only to hunt unarmed intruders, and never while draining. Actions use the shared combat logic.

Tower fixes:
- Power-creep OPERATE/DISRUPT_TOWER effects are now applied to damage estimates.
- A remembered target that left the room or reached the border is dropped immediately.

## Travel

`traveler.js` (all `travelTo` calls) changes from stock Traveler:
- **Room route first:** every trip into another room plans its room route before the tile path, not only trips of 3+ rooms. Without it, a creep stepping off an exit tile could be routed back through the room it just left and bounce at the border. Roles no longer wipe their path when they change rooms (harasser, highway patrol, ranger, distant supplier, assault units).
- **Widening:** if walls cut off the rooms on the route, the search is widened to neighbouring rooms, then run without a room restriction (twice the ops) before giving up. Long, winding trips get a full path instead of a partial one that is walked back and forth.
- **Head-on blocks:** a creep stuck behind one of our own creeps swaps places with it, as long as the other creep isn't moving this tick and isn't parked at a work spot (miners, the tower supplier, anything `atSpot`/`onPoint`). This clears head-on deadlocks in 1-wide corridors.
- **No ping-pong:** a creep that was just swapped out of the way while waiting near a spot (`range` > 1, e.g. idle by the spawn) stays there for 3 ticks instead of walking straight back. Idle mules, distributors and repairers wait within 3 tiles of their spawn rather than on the tiles next to it. Two idle creeps wanting the same tile used to swap places every tick until spawning gave one of them work.
- **Unreachable targets** (`system.reachability.js`): special spawns check for a route from the home room avoiding claimed rooms before spawning. This covers observer harassers and flag commands (claim, helper, rangers, power, loot, supply, assault).
  - No route: the spawn is skipped and `Memory.unreachable["HOME>TARGET"]` holds it off for 10,000 ticks before the next check. A flag in an unreachable room no longer holds up the flag commands after it.
  - A harasser already on its way checks every 25 ticks; if its target has become unreachable it goes home and recycles.
- **Haulers turn back on their last delivery:** mules, distributors (including young-room ones) and the operator filling spawns work out what is left after a transfer (the store only updates next tick). When the load is spent, they start walking back to their link, storage or container on the same tick instead of stepping on toward the next sink. Shared helper: `returnIfEmptied` in `creep.logistics.js`.
- **Stuck repaths:** after `stuckValue` ticks the creep looks for a way around the other creeps. If none reaches the goal, it keeps its real path and waits/swaps instead of walking off and straight back. (Previously this repath happened at random, and the partial path that came back produced the "move, wait, move back" loop.)

### Bad rooms

`system.badRooms.js` keeps `Memory.badRooms[room] = { o: owner, t: last seen }` for rooms whose controller is **claimed** by a player not on `Memory.whiteList`. Reserved rooms don't count.
- **Updates:** every visible room is checked every 5 ticks, plus each observer sweep and scout visit. Rooms that are no longer claimed (or are claimed by a friend) are dropped.
- **Routing:** multi-room routes and path searches never enter a bad room; only the trip's own start or destination room may be one (attackers). The route cache refreshes when the list changes.
- **Re-checks:** a bad room nobody has seen for 20,000 ticks is looked at again. An observer within 10 rooms picks it up after remote-mining requests. Otherwise the nearest home sends a 1-MOVE scout (checked every 500 ticks, up to 6 rooms away), so a room that lost its owner becomes passable again.

## Console debugging

`runtime.console.js` defines these commands on `global` at load, so they work in the game console after every reset. Output is split into console-sized lines.

- `mem()`: every top-level Memory key with its size, largest first.
- `mem('basePlan.E14N18')`: one Memory path (dot separated), printed in full.
- `mem('*')`: all of Memory. This is large and costs noticeable CPU on big Memory.
- `memCreeps()`: creep memory size by field and by role, to see what to trim.
- `roomReport('E14N18')`: everything about one room:
  - **Live state:** controller, energy, storage/terminal, structure and construction-site counts, spawns and what they're spawning, tower energy, lowest rampart, hostiles, creeps in the room.
  - **Maintenance mode:** whether the room is in it, and every reason it doesn't qualify (`system.maintenance.diagnose`).
  - **Memory:** every entry keyed by the room or listing it, including its `creepInQue` records.
  - **Creeps homed there:** role, TTL, and where they are.
  - **Flags:** in the room or named after it.

## Memory cleanup

Memory is serialized at the end of every tick and parsed at the start of the next, so its size costs CPU on every tick. (The Nightmare branch is no longer a rollback target, so none of this keeps its keys.)

**Heap-only keys** (`runtime.heapMemory.js`): data rebuilt from the game every few ticks never goes through Memory. That covers the structure ID lists (`labList`, `linkList`, `sourceList`, `mineralList`, `extractorList`, `powerSpawnList`, `factoryList`, `nukerList`, `observerList`), `roomConfigs`, `structureScanTick`, `repairTarget`, the tower caches, `mineralTotals`, `remotePlan`, `roomCPU` and `isSpawning`.
- **During the tick:** the main loop attaches them to `Memory` at the start (the same objects every tick, so all code still uses `Memory.labList` etc.) and detaches them before Memory is saved.
- **After a global reset:** they start out missing and their owners rebuild them. Room scans run before creeps act.
- **Console:** `mem()` and `roomReport()` still show them, marked "heap only".

**Cleanup pass** (`runtime.memoryCleanup.js`, every 1,000 ticks) removes:
- **Unused top-level keys:** the old base generator's keys, old CPU counters, `FarGuardNeeded`, `FarCreeps`, `hasFired`, `energyCap`, `ClosedrampartList`, `roomCreeps`, `hostileEnterTicks` and `flagCount`. The init no longer creates any of them, and the dead flag-count code is gone.
- **Creep fields nothing reads**, plus any creep field holding `false` or `null`. No code compares memory to `false`/`null` exactly, so a missing field reads the same.
- **Fields only some roles read** (`slimCreep`, also applied to every new creep at spawn):
  - `fromSpawn` is kept only by defenders, distributors, mules, repairers and lab workers.
  - `terminalID` is kept only by mules.
  - Lab workers derive `lab1..10` / `mineral1..10` every tick from the room's lab list, boost config and lab planner job; a short `rx` key notices reaction changes.
- **Operator lists:** the power creep operator's `towerList` / `spawnList`. It looks its towers and spawns up each tick from the per-tick structure cache.
- **Idle travel data:** `_trav` records of creeps with no path left.
- **Expired entries:** remote threats, "outmatched" marks, cached remote round trips, and the trip caches of homes no longer owned.
- **Old intel:** remote intel more than 3 rooms from every home, or not seen in 100,000 ticks.
- **Empty records:** empty `Memory.rooms` / `Memory.flags` entries.

The console command `memCreeps()` shows where creep memory goes: characters per field and per role.

## Measure in-game CPU

Normal behavior and existing visuals remain enabled by default. In the Screeps console:

```js
Memory.settings = Object.assign(Memory.settings || {}, { profile: true });
// Inspect after representative ticks:
JSON.stringify(Memory.phaseCPU);
// Stop profiling; turn off informational dashboards if desired:
Memory.settings.profile = false;
Memory.settings.visuals = false;
// Reset phase measurements:
delete Memory.phaseCPU;
```

Each phase records count, average and maximum CPU. Profiling adds no per-phase CPU reads when disabled. `spawningAndRooms` includes room management and its terminal trading; the `market` phase is empire account-resource trading. Total CPU averaging now includes final dashboard rendering. The visuals setting controls the empire/room dashboards; explicit tower/base debug visualizations and role speech keep their existing controls. Low-energy notifications remain active when dashboards are disabled.

### CPU governor (low-CPU behavior)

`runtime.cpuGovernor.js` replaces the old bucket thresholds (the odd-tick skip at bucket < 1,000, and the 500/750/2,000/3,000 cut-offs). It steers on **average CPU vs. the limit**, not the bucket level:
- **Average.** `Memory.cpuGov.ema` is a ~100-tick moving average of CPU used per tick.
- **Shed level.** `shed` (0-3) moves at most one step per 100 ticks: up while the average is over the limit, down once it's under 90% of the limit. Between those it holds, so it can't flip-flop.
- **Emergency.** A bucket under 500 with no recent pixel jumps straight to 3.
- **Pixels** are generated only with a full 10,000 bucket, `shed` at 0, the average at or under 90% of the limit, and no room under attack. For 2,000 ticks after a pixel a low bucket is treated as expected, not as an emergency.

| Creep tier | Runs on (of every 4 ticks) at shed 0 / 1 / 2 / 3 |
|---|---|
| essential: miners, upgraders, mules, distributors, suppliers, defenders, guards, combat/power roles, young-room workers, keeper-room miners | 4 / 4 / 4 / 4 |
| economy: far mules/miners/claimers, mineral miners, helpers, scouts | 4 / 4 / 3 / 2 |
| optional: repairers, lab worker, controller supplier, scrapers, salvagers, patrols, harassers | 4 / 3 / 2 / 1 |

Thinned creeps are staggered by name so each tick sheds about the same share. Some creeps are promoted to essential when their work is urgent: repairers while the room is under attack, the lab worker while boosts are staged (`WarBoosts`/`RunningAssault`), and the controller supplier when the controller is under 20,000 ticks from downgrading.

Features stop as the shed level rises:
- **Shed 1:** road placement and remote-hauler re-scans stop.
- **Shed 2:** scouting, harasser spawns and remote planning stop.
- **Shed 3:** remote spawning stops.

Planning and scouting also wait for a 1,000 bucket so a spike can't exceed the tick limit. While shedding, the dashboard shows `CPU SHED n : average` above the TIME box.

### Per-room CPU

`runtime.roomCpu.js` charges CPU to the room that owns the work and keeps `Memory.roomCPU[room] = { a, n, l }` (average, samples, last tick charged):
- **Creeps and power creeps** → `memory.homeRoom` (remote creeps count toward their base).
- **Towers and defense** (rampart control, threat detection) → the tower's room.
- **Spawns and room management** (links, labs, power spawn, factory, nuker, observer, terminal market, spawn logic) → the spawn's room.
- **Base auto-build** → the room being built.

Shared work (flags, empire state, account market, dashboards, Memory parsing) isn't attributed, so room averages add up to somewhat less than the shard Average. The average is a plain mean for the first 500 samples, then an exponential average over ~500 ticks; idle ticks count as zero. Rooms unused for 10,000 ticks are dropped, and the `ResetAverages` flag clears them.

Each base room's dashboard shows a **Room CPU** pie next to the shard **Average** pie (same CPU-limit scale). Measuring costs one `Game.cpu.getUsed()` per creep/tower/spawn; disable it with `Memory.settings.roomCpu = false`.

```js
JSON.stringify(_.mapValues(Memory.roomCPU, r => r.a)); // all rooms at a glance
```

Compare live averages over the same number of ticks and similar creep/room populations; include 50/1,000/5,000/10,000-tick maintenance boundaries. Reset averages between comparisons. This workspace has no live shard connection, so no production CPU percentage or deployment success is claimed.

## Validation

With Node 18+ (no dependencies):

```sh
npm test
npm run check
```

The suite covers 12,096 legacy role-dispatch scenarios and 864 legacy logistics action/state scenarios, link and lab intents, multi-spawn energy reservations, fresh Memory/global resets, power-creep-only attacks, cache invalidation, road placement ordering, and Traveler topology changes. Reference fixtures were extracted from commit `145bf440da2204774a2483ab7c57ef01195754f0`; they are test data, never runtime imports.

Deterministic operation-count checks show 30 typed queries over 200 structures reducing type inspections from 6,000 to 200, and a stable room over 11 ticks allocating one structure matrix rather than eleven. Road generation obtains terrain once per pass instead of up to 2,304 times. These are workload reductions, not measurements of server CPU. Tests use Screeps API mocks, so they do not simulate engine pathfinding, combat resolution, or live market contention.
