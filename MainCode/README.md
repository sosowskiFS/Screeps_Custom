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
| Lab recipes and producer-flag priority | `config.production.js` |
| Observers and remote opportunity detection | `system.observers.js` |
| Market policy and room trading | `system.market.js`, `market.FindBuyers.js` |
| Flags and periodic empire state | `system.flags.js`, `system.state.js`, `system.minerals.js` |
| Construction scheduling and extension roads | `system.construction.js`, `tool.generateBase.js` |
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

## Automatic remote mining

`system.remoteMining.js` (phase `remoteMining`) places remote-mining flags for every home room with storage.

- **Intel.** Rooms within 2 of a home are summarised in `Memory.remoteIntel`: sources, owner, reservation, keeper lairs, hostile towers. Vision comes from observer sweeps, our own creeps (visible rooms refresh every 1,000 ticks), or a 1-MOVE scout (50 energy). The scout spawns automatically for homes without an observer when nearby intel is missing or older than 20,000 ticks. A `MineScout` flag still forces one.
- **Selection.** A source qualifies when one max-size far mule (capacity scales with the home's energy) can carry at least 85% of a reserved source's 10 energy/tick home. The round trip comes from a terrain path from home storage that pays swamp cost when loaded, and is cached per source. Excluded: owned rooms, player-reserved rooms, Source Keeper rooms, rooms with towers, `Memory.blockedRooms`, rooms in a different novice/respawn area, sources another home mines, and rooms with 4+ strikes.
- **Flags.** Qualifying sources fill free `FarMining` slots nearest-first, so the 25M/50M rampart caps drop the farthest first. Each mined room gets one `FarGuard` flag at its centre. Manual flags are never moved or removed. Auto flags are tracked in `Memory.remoteAuto` and removed when their source leaves the plan. Plans refresh every 2,000 ticks, at most one home and 10 new path searches per tick.
- **Opt out:** `Memory.settings.autoRemote = false` (all homes) or a `<home>NoAutoRemote` flag (one home).

**Disabling unsafe remotes** (`Memory.remoteStatus`). A strike is registered when a player attacks a miner, when player fighters appear and our forces there aren't clearly winning, or when the room is claimed. Repeats within 100 ticks count as the same incident. A strike disables the **whole room**: every source, mule, reserver and guard. The back-off doubles per strike (1,500 → 3,000 → 6,000 … up to 50,000 ticks). Remote creeps assigned to a disabled room wait at home instead of walking in.

When the back-off ends, the room stays disabled until it has been seen clear: the observer looks first, otherwise a scout checks, or any passing creep. Seen hostile again means another strike. Strikes reset after 30,000 quiet ticks; at 4 strikes the planner drops the room (and its auto flags) until then. Legacy `FarMiningN;tick` flags from the old system are still restored as before.

## Room staffing (RCL5+)

Counts are kept low by putting work into bodies, not creeps:
- Upgraders turn extra count into 12-WORK modules on one body (`GetUpgraderConfig`), so a higher upgrader count usually means larger upgraders, not more of them.
- Repairers use a full 50-part body (16 WORK / 17 CARRY / 17 MOVE) once storage is at 450k+ and the room can afford it. Operator rooms with 700k+ storage staff 3 of them, matching the old 4 × 12 WORK.
- The distributor (32 CARRY / 16 MOVE) and supplier (8 CARRY / 4 MOVE) scale with room energy, for fewer round trips per refill.
- The second mule (storage ≥ 225k) is staffed only while there are construction sites.
- The salvager (RCL5-7) is staffed only when there's something to collect: tombstones with ≥ 200 resources, ≥ 1,000 dropped resources, or a weak attack in progress (`roomsPrepSalvager`).

Rooms below RCL5 are limited by spawn energy rather than creep count. Their worker bodies already use nearly all available energy, so they keep the existing counts.

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
