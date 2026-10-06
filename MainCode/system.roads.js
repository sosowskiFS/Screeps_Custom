// system.roads — a planned road network per owned room; everything else is left to decay.
//
// Planned ("priority") roads:
//   core    existing roads next to our structures (the base layout: extension/lab fields,
//           storage/spawn surroundings), so generated layouts are always kept
//   routes  paths from storage (or a spawn) to every key structure, to extensions with no road
//           beside them, the controller (range 3), sources, mineral and remote-mining flags.
//           Paths strongly prefer existing roads and each one makes later ones cheaper, so they
//           merge into shared trunks instead of parallel lanes.
//
// Only planned roads are repaired (towers, workers) and only planned route tiles are built
// (a few sites per pass). In planned rooms creeps stop dropping road sites wherever they walk.
// Other roads simply decay (~50k ticks on plains). Memory.settings.roadCleanup = true removes
// them instead (useful for swamp/wall roads, which take much longer to decay).
//
// Memory.roadPlan[room] = { t: tick planned, s: all priority tiles, b: route tiles to build }
// Tile sets are packed one character per tile (x*50+y offset into printable range).
const runtimeCache = require('runtime.cache');
const governor = require('runtime.cpuGovernor');

const PLAN_INTERVAL = 5000;
const BUILD_INTERVAL = 1000;
const SITES_PER_PASS = 10;
const SITE_HEADROOM = 90;           // leave room under the 100-site cap for everything else
const CLEANUP_PER_PASS = 20;
const ROAD_COST = 1, PLAIN_COST = 3, SWAMP_COST = 15;
const CORE_TYPES = new Set([STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_STORAGE, STRUCTURE_TERMINAL,
    STRUCTURE_LINK, STRUCTURE_LAB, STRUCTURE_FACTORY, STRUCTURE_POWER_SPAWN, STRUCTURE_NUKER, STRUCTURE_OBSERVER]);
const ROUTE_TYPES = [STRUCTURE_SPAWN, STRUCTURE_TOWER, STRUCTURE_LAB, STRUCTURE_TERMINAL, STRUCTURE_FACTORY,
    STRUCTURE_POWER_SPAWN, STRUCTURE_NUKER, STRUCTURE_LINK];
const OFFSET = 48;

function pack(indices) {
    let out = '';
    for (const index of indices) out += String.fromCharCode(index + OFFSET);
    return out;
}

function unpack(text) {
    const set = new Set();
    for (let i = 0; i < (text || '').length; i++) set.add(text.charCodeAt(i) - OFFSET);
    return set;
}

// Parsed plans, cached per plan version.
const parsed = Object.create(null);
function planSet(roomName) {
    const plan = Memory.roadPlan && Memory.roadPlan[roomName];
    if (!plan) return null;
    const cached = parsed[roomName];
    if (cached && cached.t === plan.t) return cached.set;
    const set = unpack(plan.s);
    parsed[roomName] = { t: plan.t, set };
    return set;
}

function hasPlan(roomName) {
    return !!(Memory.roadPlan && Memory.roadPlan[roomName]);
}

// Should the road at x,y be kept (repaired / built)? Rooms without a plan keep everything.
function isPriority(roomName, x, y) {
    const set = planSet(roomName);
    return !set || set.has(x * 50 + y);
}

function ownedRooms() {
    const rooms = [];
    const seen = new Set();
    for (const name in Game.spawns) {
        const room = Game.spawns[name].room;
        if (!seen.has(room.name) && room.controller && room.controller.my) {
            seen.add(room.name);
            rooms.push(room);
        }
    }
    return rooms;
}

function planRoom(room) {
    const anchor = room.storage || runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_SPAWN } })[0];
    if (!anchor) return;
    const terrain = Game.map.getRoomTerrain(room.name);
    const costs = new PathFinder.CostMatrix();
    const structures = runtimeCache.find(room, FIND_STRUCTURES);
    const roadTiles = [];
    for (const structure of structures) {
        const { x, y } = structure.pos;
        if (structure.structureType === STRUCTURE_ROAD) {
            if (costs.get(x, y) !== 0xff) costs.set(x, y, ROAD_COST);
            roadTiles.push(structure);
        } else if (structure.structureType !== STRUCTURE_CONTAINER &&
            !(structure.structureType === STRUCTURE_RAMPART && (structure.my || structure.isPublic))) {
            costs.set(x, y, 0xff);
        }
    }
    for (const site of runtimeCache.find(room, FIND_MY_CONSTRUCTION_SITES)) {
        if (site.structureType !== STRUCTURE_ROAD && site.structureType !== STRUCTURE_CONTAINER && site.structureType !== STRUCTURE_RAMPART) {
            costs.set(site.pos.x, site.pos.y, 0xff);
        }
    }

    // Core: existing roads beside our structures (base layout).
    const coreTypes = new Set();
    const priority = new Set();
    const nearCore = new Uint8Array(2500);
    for (const structure of structures) {
        if (!CORE_TYPES.has(structure.structureType) || !structure.my) continue;
        coreTypes.add(structure.structureType);
        const { x, y } = structure.pos;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const nx = x + dx, ny = y + dy;
                if (nx >= 0 && nx <= 49 && ny >= 0 && ny <= 49) nearCore[nx * 50 + ny] = 1;
            }
        }
    }
    for (const road of roadTiles) {
        if (nearCore[road.pos.x * 50 + road.pos.y]) priority.add(road.pos.x * 50 + road.pos.y);
    }

    // Routes from the anchor.
    const targets = [];
    for (const type of ROUTE_TYPES) {
        for (const structure of runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: type } })) {
            if (structure.id !== anchor.id) targets.push({ pos: structure.pos, range: 1 });
        }
    }
    for (const extension of runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_EXTENSION } })) {
        if (!extension.pos.findInRange(FIND_STRUCTURES, 1, { filter: { structureType: STRUCTURE_ROAD } }).length) {
            targets.push({ pos: extension.pos, range: 1 });
        }
    }
    if (room.controller) targets.push({ pos: room.controller.pos, range: 3 });
    for (const source of runtimeCache.find(room, FIND_SOURCES)) targets.push({ pos: source.pos, range: 1 });
    for (const mineral of runtimeCache.find(room, FIND_MINERALS)) targets.push({ pos: mineral.pos, range: 1 });
    for (const name in Game.flags) {
        if (name.startsWith(room.name + 'FarMining')) targets.push({ pos: Game.flags[name].pos, range: 1, remote: true });
    }

    const routes = new Set();
    for (const target of targets) {
        const result = PathFinder.search(anchor.pos, { pos: target.pos, range: target.range }, {
            plainCost: PLAIN_COST,
            swampCost: SWAMP_COST,
            maxRooms: target.remote ? 3 : 1,
            maxOps: target.remote ? 6000 : 3000,
            roomCallback: roomName => roomName === room.name ? costs : undefined,
        });
        if (result.incomplete) continue;
        for (const step of result.path) {
            if (step.roomName !== room.name) continue;
            if (step.x <= 0 || step.x >= 49 || step.y <= 0 || step.y >= 49) continue; // exits can't hold roads
            const index = step.x * 50 + step.y;
            priority.add(index);
            routes.add(index);
            // Later paths merge onto this one instead of laying a parallel road.
            if (costs.get(step.x, step.y) !== 0xff) costs.set(step.x, step.y, ROAD_COST);
        }
    }

    if (!Memory.roadPlan) Memory.roadPlan = {};
    Memory.roadPlan[room.name] = { t: Game.time, s: pack(priority), b: pack(routes) };
    return { priority, routes, roadTiles, terrain };
}

// Build missing planned route roads, a few per pass, never on walls (tunnels cost 50x).
function buildMissing(room) {
    const plan = Memory.roadPlan && Memory.roadPlan[room.name];
    if (!plan) return 0;
    const siteCount = Object.keys(Game.constructionSites).length;
    if (siteCount >= SITE_HEADROOM) return 0;
    const occupied = new Set();
    for (const structure of runtimeCache.find(room, FIND_STRUCTURES)) occupied.add(structure.pos.x * 50 + structure.pos.y);
    for (const site of runtimeCache.find(room, FIND_CONSTRUCTION_SITES)) occupied.add(site.pos.x * 50 + site.pos.y);
    const terrain = Game.map.getRoomTerrain(room.name);
    let placed = 0;
    for (const index of unpack(plan.b)) {
        if (placed >= SITES_PER_PASS || siteCount + placed >= SITE_HEADROOM) break;
        if (occupied.has(index)) continue;
        const x = Math.floor(index / 50), y = index % 50;
        if (terrain.get(x, y) & TERRAIN_MASK_WALL) continue;
        if (room.createConstructionSite(x, y, STRUCTURE_ROAD) === OK) placed++;
    }
    return placed;
}

// Opt-in: remove off-plan roads instead of waiting for them to decay.
function cleanup(room) {
    if (!(Memory.settings && Memory.settings.roadCleanup)) return 0;
    if (Memory.roomsUnderAttack && Memory.roomsUnderAttack.indexOf(room.name) !== -1) return 0;
    const set = planSet(room.name);
    if (!set) return 0;
    let removed = 0;
    for (const road of runtimeCache.find(room, FIND_STRUCTURES, { filter: { structureType: STRUCTURE_ROAD } })) {
        if (removed >= CLEANUP_PER_PASS) break;
        if (!set.has(road.pos.x * 50 + road.pos.y) && road.destroy() === OK) removed++;
    }
    return removed;
}

function run() {
    if (Memory.settings && Memory.settings.roadPlanning === false) return;
    const rooms = ownedRooms();
    let planned = false;
    for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];
        const plan = Memory.roadPlan && Memory.roadPlan[room.name];
        // At most one plan per tick, and only when the governor allows path-heavy work.
        if (!planned && (!plan || Game.time - plan.t >= PLAN_INTERVAL) && governor.allows('planning')) {
            planRoom(room);
            planned = true;
            buildMissing(room);
            cleanup(room);
        } else if (plan && (Game.time + i * 37) % BUILD_INTERVAL === 0) {
            buildMissing(room);
            cleanup(room);
        }
    }
}

module.exports = { run, planRoom, buildMissing, cleanup, isPriority, hasPlan, pack, unpack };
