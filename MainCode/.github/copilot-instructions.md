# Project Guidelines

This workspace contains automation scripts for the coding game **Screeps World**. Treat code as tick-driven game logic, not a conventional Node web/service app.

## Code Style
- Use CommonJS modules (`require`, `module.exports`) and match existing role-object patterns.
- Keep edits stylistically consistent with nearby files (mixed `var`/`let`/`const` and pragmatic comparisons are already in use).
- Follow existing filename domains and module ids: `creep.*`, `spawn.*`, `tower.*`, `market.*`, `system.*`, `runtime.*`, `config.*` (see `main.js`).
- Prefer small, surgical changes in the target module over broad refactors.

Examples:
- `main.js` (module wiring + central tick loop)
- `creep.work.js`, `creep.labWorker.js` (role `run` logic + creep memory state)
- `spawn.BuildCreeps.js`, `spawn.BuildCreeps5.js` (spawn composition by room/RCL)
- `tower.Operate.js` (tower behavior contract)

## Architecture
- Entry point is `module.exports.loop` in `main.js`; it orchestrates room/tower ops, spawn planning, market behavior, and per-creep dispatch.
- Creep behavior is dispatched by `system.creeps.js` through `creep.registry.js`; keep spawn-assigned priorities and NearDeath aliases aligned. Mature logistics roles are split into `creep.mule`, `creep.distributor`, and `creep.mineralMiner`.
- Spawn flow is multi-phase (base, RCL5+, far/mining specialists) and room-state dependent (`spawn.BuildCreeps*.js`, `spawn.BuildFarCreeps.js`).
- Room flags and room memory are core control inputs for operations and remote activities.

## Build and Test
Run `npm test` for mocked Screeps regression tests and `npm run check` for all runtime syntax/module references. No package installation is needed. Tests include frozen legacy dispatch, logistics, and industry fixtures; keep those unchanged as behavioral references.

Use syntax validation before handoff:
- `node --check main.js`
- `node --check spawn.BuildCreeps.js`
- `node --check tower.Operate.js`
- PowerShell bulk check: `Get-ChildItem -Filter *.js | ForEach-Object { node --check $_.FullName }`

## Project Conventions
- Assume Screeps globals exist at runtime (`Game`, `Memory`, `RawMemory`, constants like `WORK`, `CARRY`, `MOVE`). Do not replace them with browser/Node alternatives.
- Keep `creep.memory.priority` string values stable across spawn modules and main dispatch.
- Preserve room-flag naming patterns used in operations (room-based prefix/suffix conventions in `main.js` and `spawn.BuildFarCreeps.js`).
- CPU and bucket-aware throttling in `creep.registry.js` is intentional. Use `runtime.cache` for shared tick queries; dynamic predicates must be reevaluated and construction-site membership must remain live. Never persist Game objects across ticks. See README.md for cache contracts and phase profiling.

## Integration Points
- `traveler.js` provides travel/pathing behavior used by creeps (`travelTo` integration).
- `screeps-profiler.js` is vendored and optional instrumentation.
- `market.FindBuyers.js` + market logic in `main.js` handle order/deal decisions.
- `tool.generateBase.js` is used for base planning/generation workflows.

## Security
- `Memory` and room-level state are high-impact; validate assumptions before writing/changing shared keys.
- Market operations can spend credits quickly; keep trade logic guarded and conservative.
- Flag-triggered operations can start expensive behaviors; keep command conditions explicit. Recipe definitions and priority order are in `config.production.js`.
- Be careful with performance-sensitive memory/CPU optimizations (e.g., `RawMemory` usage patterns in `main.js`).
