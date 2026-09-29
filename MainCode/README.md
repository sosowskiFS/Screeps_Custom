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

Compare live averages over the same number of ticks and similar creep/room populations; include 50/1,000/5,000/10,000-tick maintenance boundaries. Reset averages between comparisons. This workspace has no live shard connection, so no production CPU percentage or deployment success is claimed.

## Validation

With Node 18+ (no dependencies):

```sh
npm test
npm run check
```

The suite covers 12,096 legacy role-dispatch scenarios and 864 legacy logistics action/state scenarios, link and lab intents, multi-spawn energy reservations, fresh Memory/global resets, power-creep-only attacks, cache invalidation, road placement ordering, and Traveler topology changes. Reference fixtures were extracted from commit `145bf440da2204774a2483ab7c57ef01195754f0`; they are test data, never runtime imports.

Deterministic operation-count checks show 30 typed queries over 200 structures reducing type inspections from 6,000 to 200, and a stable room over 11 ticks allocating one structure matrix rather than eleven. Road generation obtains terrain once per pass instead of up to 2,304 times. These are workload reductions, not measurements of server CPU. Tests use Screeps API mocks, so they do not simulate engine pathfinding, combat resolution, or live market contention.
