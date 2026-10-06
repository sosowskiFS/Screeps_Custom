// base.planner — room layout planner.
//
// Pure: works on plain arrays (terrain, existing structures, sources...), never touches the Game
// API, so it is testable and its CPU is predictable: a handful of breadth-first passes over the
// 2,500 tiles, no PathFinder. base.builder feeds it and stores/applies the result.
//
// Layout
//   core   the only fixed requirement: a free 3x3 next to a source. Supply tile in the centre (the
//          supplier stands there and reaches everything), ring of storage, spawn and 6 towers.
//          The storageMiner tile sits just outside, touching both the storage and the source.
//          The storage keeps one more free neighbour for haulers, the spawn one for its creeps.
//   labs   3x3 stamp: 7 reaction labs around a road tile, one ring tile left as the entrance.
//          Every output is within range 2 of both inputs, and the lab worker reaches all 7
//          from the centre tile. The 3 boost labs are separate, next to the spawns.
//   rest   a diagonal road lattice anchored on the core: roads where (dx+dy)%4==0 or
//          (dx-dy)%4==0. 62.5% of tiles are buildable and every one of them touches a road.
//          Structures fill these slots nearest-first (breadth-first from the core), so the base
//          stays compact and only uses space connected to the core.
//   paths  tiles from the core to the controller, both sources, the mineral and every exit are
//          kept free of structures so nothing can cut them off. They are not built as roads here:
//          system.roads routes and builds the roads creeps actually use.
//   links  placed so system.industry's automatic roles read them correctly: controller link
//          within 2 of the controller, storage link within 3 of the storage (and more than 4
//          from the controller), source links beside the upgradeMiner tile away from both.

const N = 2500;
const I = (x, y) => x * 50 + y;
const X = i => (i / 50) | 0;
const Y = i => i % 50;
const cheb = (a, b) => Math.max(Math.abs(X(a) - X(b)), Math.abs(Y(a) - Y(b)));
// Range to something that may be absent (no controller in a test room): absent = far away.
const rangeTo = (a, b) => b === undefined ? 99 : cheb(a, b);
const OFFSETS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

const COUNTS = { spawn: 3, tower: 6, extension: 60, lab: 10, link: 4, terminal: 1, factory: 1, powerSpawn: 1, nuker: 1, observer: 1 };

function neighbors(i) {
    const x = X(i), y = Y(i), out = [];
    for (const [dx, dy] of OFFSETS) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx <= 49 && ny >= 0 && ny <= 49) out.push(I(nx, ny));
    }
    return out;
}

// Structures stay 2 tiles off the room edge (exit tiles and the row beside them stay open).
function inBuild(i) {
    const x = X(i), y = Y(i);
    return x >= 2 && x <= 47 && y >= 2 && y <= 47;
}

function square(center) {
    const out = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.push(I(X(center) + dx, Y(center) + dy));
    return out;
}

// Breadth-first distances over `passable` tiles from `seeds`.
function bfs(seeds, passable) {
    const dist = new Int16Array(N).fill(-1);
    const parent = new Int16Array(N).fill(-1);
    const order = [];
    for (const s of seeds) {
        if (dist[s] !== -1 || !passable(s)) continue;
        dist[s] = 0;
        order.push(s);
    }
    for (let head = 0; head < order.length; head++) {
        const i = order[head];
        for (const n of neighbors(i)) {
            if (dist[n] !== -1 || !passable(n)) continue;
            dist[n] = dist[i] + 1;
            parent[n] = i;
            order.push(n);
        }
    }
    return { dist, parent, order };
}

// Free-tile counts in squares, O(1) per query.
function prefixSums(free) {
    const pre = new Int32Array(51 * 51);
    for (let x = 0; x < 50; x++) {
        for (let y = 0; y < 50; y++) {
            pre[(x + 1) * 51 + y + 1] = (free(I(x, y)) ? 1 : 0) + pre[x * 51 + y + 1] + pre[(x + 1) * 51 + y] - pre[x * 51 + y];
        }
    }
    return (center, r) => {
        const x0 = Math.max(0, X(center) - r), x1 = Math.min(49, X(center) + r);
        const y0 = Math.max(0, Y(center) - r), y1 = Math.min(49, Y(center) + r);
        return pre[(x1 + 1) * 51 + y1 + 1] - pre[x0 * 51 + y1 + 1] - pre[(x1 + 1) * 51 + y0] + pre[x0 * 51 + y0];
    };
}

// Best core: centre C, storage T on the ring, miner tile M outside the core touching T and a
// source. Existing spawn/towers/storage on matching core tiles and an existing Supply flag
// are kept (old generator layouts, a hand-placed first spawn).
function chooseCore(ctx) {
    const { walls, typeAt, sources, controller, supply, requireStorage } = ctx;
    const free = i => !walls[i] && !typeAt[i];
    const open = prefixSums(free);
    let best = null;
    for (const source of sources) {
        for (const m of neighbors(source)) {
            if (!free(m) || !inBuild(m)) continue;
            for (const t of neighbors(m)) {
                if (t === source || walls[t] || !inBuild(t) || (typeAt[t] && typeAt[t] !== 'storage')) continue;
                // Migration target: the core must form around the existing storage.
                if (requireStorage !== undefined && t !== requireStorage) continue;
                for (const c of neighbors(t)) {
                    const cx = X(c), cy = Y(c);
                    if (cx < 3 || cx > 46 || cy < 3 || cy > 46 || !free(c)) continue;
                    const core = square(c);
                    if (core.includes(m)) continue;
                    const inCore = new Set(core);
                    let ok = true;
                    for (const tile of core) {
                        if (walls[tile]) { ok = false; break; }
                    }
                    if (!ok) continue;
                    const ring = core.filter(tile => tile !== c);
                    const outside = tile => neighbors(tile).filter(n => !inCore.has(n) && n !== m && free(n));
                    // Haulers need a way to the storage besides the miner's tile.
                    if (!outside(t).length) continue;
                    // Spawn: a ring tile with a free tile outside the core for its creeps.
                    let spawn = ring.find(tile => tile !== t && typeAt[tile] === 'spawn' && outside(tile).length);
                    if (!spawn) {
                        let bestOut = 0;
                        for (const tile of ring) {
                            if (tile === t || typeAt[tile]) continue;
                            const exits = outside(tile).length * 10 + cheb(tile, m);
                            if (outside(tile).length && exits > bestOut) { bestOut = exits; spawn = tile; }
                        }
                    }
                    if (!spawn) continue;
                    const towers = ring.filter(tile => tile !== t && tile !== spawn);
                    if (towers.some(tile => typeAt[tile] && typeAt[tile] !== 'tower')) continue;
                    let score = open(c, 6) - (controller === undefined ? 0 : cheb(c, controller)) * 0.5;
                    if (typeAt[t] === 'storage') score += 500;
                    if (typeAt[spawn] === 'spawn') score += 500;
                    score += towers.filter(tile => typeAt[tile] === 'tower').length * 100;
                    if (supply === c) score += 2000;
                    if (!best || score > best.score) best = { score, center: c, storage: t, miner: m, source, spawn, towers };
                }
            }
        }
    }
    return best;
}

// Roads of the lattice anchored on the core centre.
function latticeRoad(i, center) {
    const dx = X(i) - X(center), dy = Y(i) - Y(center);
    return ((dx + dy) % 4 + 4) % 4 === 0 || ((dx - dy) % 4 + 4) % 4 === 0;
}

// Trace the BFS parents from `target` back to a seed.
function trace(parent, dist, target) {
    const path = [];
    if (target === undefined || dist[target] < 0) return path;
    for (let i = target; i !== -1; i = parent[i]) path.push(i);
    return path;
}

/**
 * ctx: {
 *   walls: array/Uint8Array[2500] (truthy = wall),
 *   typeAt: object idx -> own structure kind already built (spawn, tower, storage, extension...),
 *           anything not road/container/rampart; plans route around them
 *   sources: [idx], controller: idx, mineral: idx|undefined, supply: idx|undefined (Supply flag),
 *   requireStorage: idx|undefined  migration target: plan as if the room were empty except for
 *                  immovables (typeAt), with the core around this existing storage
 * }
 * Returns null when no core fits, else the plan (tile indices; see base.builder for storage).
 */
function plan(ctx) {
    const { walls, typeAt, controller, mineral } = ctx;
    const sources = ctx.sources || [];
    let mode = 'fresh';
    let core = null;
    const storageAt = Object.keys(typeAt).map(Number).find(i => typeAt[i] === 'storage');
    if (storageAt !== undefined) {
        // Adopt an established room: its storage stays. A valid core around it is kept as is.
        const chosen = chooseCore(ctx);
        if (chosen && chosen.storage === storageAt && (ctx.supply === undefined || ctx.supply === chosen.center)) {
            core = chosen;
        } else {
            mode = 'adopt';
        }
    } else {
        core = chooseCore(ctx);
        if (!core) return null;
    }

    // Tiles no plan may use for anything else.
    const obstacle = new Uint8Array(N);
    for (const key in typeAt) obstacle[key] = 1;
    let anchor, coreTiles = [];
    if (core) {
        coreTiles = square(core.center);
        for (const tile of coreTiles) obstacle[tile] = 1;
        anchor = core.center;
    } else {
        anchor = ctx.supply !== undefined ? ctx.supply : storageAt;
        obstacle[anchor] = 1;
    }
    const passable = i => !walls[i] && !obstacle[i];
    const seeds = [];
    for (const tile of (core ? coreTiles : [anchor, storageAt])) {
        for (const n of neighbors(tile)) if (passable(n)) seeds.push(n);
    }
    const reach = bfs(seeds, passable);
    const { dist, parent, order } = reach;

    // Reserved for creeps: around sources and the mineral (miners), around the controller
    // (upgraders). Roads may pass; structures may not (links are placed separately).
    const reserved = new Uint8Array(N);
    for (const source of sources) for (const n of neighbors(source)) reserved[n] = 1;
    if (mineral !== undefined) for (const n of neighbors(mineral)) reserved[n] = 1;
    if (controller !== undefined) {
        for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
            const x = X(controller) + dx, y = Y(controller) + dy;
            if (x >= 0 && x <= 49 && y >= 0 && y <= 49) reserved[I(x, y)] = 1;
        }
    }

    const forced = new Set();   // tiles that must stay free of structures
    const roads = new Set();    // roads to build: core access, lab stamp, lattice beside structures
    const flags = {};
    if (core) {
        flags.Supply = core.center;
        flags.storageMiner = core.miner;
        reserved[core.miner] = 1;
        const inCore = new Set(coreTiles);
        const access = (tile) => neighbors(tile).filter(n => !inCore.has(n) && n !== core.miner && passable(n))
            .sort((a, b) => dist[a] - dist[b])[0];
        const storageAccess = access(core.storage);
        const spawnExit = access(core.spawn);
        for (const tile of [storageAccess, spawnExit]) {
            if (tile === undefined) continue;
            forced.add(tile);
            roads.add(tile);
        }
    }

    // The storage miner's source is the core's (adopted rooms: the one nearest the storage, as
    // system.industry orders them); the upgrade miner works the other one, from its tile
    // nearest the core.
    const byStorage = sources.slice().sort((a, b) => cheb(a, storageAt !== undefined ? storageAt : anchor) - cheb(b, storageAt !== undefined ? storageAt : anchor));
    const mainSource = core ? core.source : byStorage[0];
    const otherSource = byStorage.find(source => source !== mainSource);
    let upgradeMiner;
    if (otherSource !== undefined) {
        upgradeMiner = neighbors(otherSource).filter(n => dist[n] >= 0 && inBuild(n)).sort((a, b) => dist[a] - dist[b])[0];
        if (upgradeMiner !== undefined) {
            flags.upgradeMiner = upgradeMiner;
            reserved[upgradeMiner] = 1;
        }
    }

    // Paths that must stay open.
    const nearestTo = (test) => {
        for (const i of order) if (test(i)) return i;
        return undefined;
    };
    const targets = [];
    let upgradeSpot;
    if (controller !== undefined) {
        upgradeSpot = nearestTo(i => cheb(i, controller) <= 3);
        targets.push(upgradeSpot);
    }
    if (core) targets.push(core.miner);
    if (upgradeMiner !== undefined) targets.push(upgradeMiner);
    for (const source of sources) if (source !== mainSource && source !== otherSource) targets.push(nearestTo(i => cheb(i, source) === 1));
    if (mineral !== undefined) targets.push(nearestTo(i => cheb(i, mineral) === 1));
    for (const side of [i => X(i) === 0, i => X(i) === 49, i => Y(i) === 0, i => Y(i) === 49]) targets.push(nearestTo(side));
    for (const target of targets) {
        for (const tile of trace(parent, dist, target)) {
            if (tile !== core?.miner && tile !== upgradeMiner) forced.add(tile);
        }
    }

    const planned = new Map();  // tile -> kind
    const free = i => inBuild(i) && passable(i) && !reserved[i] && !forced.has(i) && !planned.has(i) && dist[i] >= 0;

    // Reaction labs: first 3x3 stamp (nearest the core) whose tiles are all free.
    const labs = { boost: [], input: [], output: [] };
    for (const c of order) {
        if (dist[c] < 2) continue;
        const stamp = square(c);
        if (!stamp.every(free)) continue;
        const inStamp = new Set(stamp);
        let entrance, entranceDist = Infinity;
        for (const tile of stamp) {
            if (tile === c) continue;
            for (const n of neighbors(tile)) {
                if (inStamp.has(n) || !passable(n) || dist[n] < 0 || planned.has(n)) continue;
                if (dist[n] < entranceDist) { entranceDist = dist[n]; entrance = tile; }
            }
        }
        if (entrance === undefined) continue;
        // A 3x3 has diameter 2, so any two of the 7 work as inputs for the other five.
        const ring = stamp.filter(tile => tile !== c && tile !== entrance);
        labs.input = ring.slice(0, 2);
        labs.output = ring.slice(2);
        for (const tile of ring) planned.set(tile, 'lab');
        roads.add(c);
        roads.add(entrance);
        forced.add(c);
        forced.add(entrance);
        break;
    }

    // Lattice slots, nearest the core first.
    const slots = order.filter(i => free(i) && !latticeRoad(i, anchor));
    const taken = new Set();
    const seedSet = new Set(seeds);
    const roadOk = (n) => passable(n) && dist[n] >= 0 && !planned.has(n) &&
        (latticeRoad(n, anchor) || forced.has(n) || seedSet.has(n));
    const accessible = (i) => neighbors(i).some(roadOk);
    const pickNext = () => {
        for (const i of slots) if (!taken.has(i) && !planned.has(i) && accessible(i)) { taken.add(i); return i; }
        return undefined;
    };
    const pickNear = (target, penalty) => {
        let best, bestScore = Infinity;
        for (const i of slots) {
            if (taken.has(i) || planned.has(i) || !accessible(i)) continue;
            const score = cheb(i, target) + (penalty ? penalty(i) : 0);
            if (score < bestScore) { bestScore = score; best = i; }
        }
        if (best !== undefined) taken.add(best);
        return best;
    };

    const out = { spawn: [], tower: [], extension: [], link: [], terminal: [], factory: [], powerSpawn: [], nuker: [], observer: [] };
    const storage = core ? core.storage : storageAt;
    if (core) {
        out.storage = [core.storage];
        out.spawn.push(core.spawn);
        out.tower.push(...core.towers);
    }
    const place = (kind, tile) => {
        if (tile === undefined) return;
        planned.set(tile, kind);
        out[kind].push(tile);
    };
    for (let n = out.spawn.length; n < COUNTS.spawn; n++) place('spawn', pickNext());
    for (let n = out.tower.length; n < COUNTS.tower; n++) place('tower', pickNear(storage));
    place('terminal', pickNear(storage));
    // Storage link: near the storage but more than 4 from the controller (else it reads as the
    // controller link).
    const storageLink = pickNear(storage, i => (cheb(i, storage) > 3 ? 50 : 0) + (rangeTo(i, controller) <= 4 ? 100 : 0));
    place('factory', pickNear(storage));
    place('powerSpawn', pickNear(storage));
    const spawnHub = out.spawn[0] !== undefined ? out.spawn[0] : storage;
    if (labs.input.length) {
        for (let n = 0; n < 3; n++) {
            const tile = pickNear(spawnHub);
            if (tile !== undefined) { planned.set(tile, 'lab'); labs.boost.push(tile); }
        }
    }
    for (let n = 0; n < COUNTS.extension; n++) place('extension', pickNext());
    place('nuker', pickNext());
    place('observer', pickNext());
    if (storageLink !== undefined) planned.set(storageLink, 'link');

    // Links read by role (system.industry): source 1, controller, source 2, storage.
    let controllerLink;
    if (controller !== undefined) {
        let bestScore = Infinity;
        for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
            const i = I(X(controller) + dx, Y(controller) + dy);
            if (!inBuild(i) || !passable(i) || forced.has(i) || planned.has(i) || i === upgradeMiner || dist[i] < 0) continue;
            const score = (upgradeSpot !== undefined ? cheb(i, upgradeSpot) : 0) * 10 + dist[i];
            if (score < bestScore) { bestScore = score; controllerLink = i; }
        }
    }
    const sourceLinks = [];
    if (upgradeMiner !== undefined) {
        const candidates = neighbors(upgradeMiner).filter(i => inBuild(i) && passable(i) && !forced.has(i) && !planned.has(i) &&
            i !== controllerLink && !sources.includes(i));
        candidates.sort((a, b) => {
            const bad = i => (rangeTo(i, controller) <= 4 ? 10 : 0) + (storage !== undefined && cheb(i, storage) <= 3 ? 10 : 0);
            return bad(a) - bad(b) || dist[b] - dist[a];
        });
        sourceLinks.push(...candidates.slice(0, 2));
    }
    for (const tile of [sourceLinks[0], controllerLink, sourceLinks[1], storageLink]) {
        if (tile === undefined) continue;
        planned.set(tile, 'link');
        out.link.push(tile);
    }
    out.lab = [...labs.boost, ...labs.input, ...labs.output];

    // Every planned structure must touch a tile creeps can reach once everything is built (a
    // structure in a 1-wide gap can cut off what lies behind it). Drop the ones that do not and
    // refill from the next slots; a couple of rounds settle it.
    const coreSet = new Set(coreTiles);
    for (let round = 0; round < 4; round++) {
        const after = bfs(seeds, i => !walls[i] && !obstacle[i] && !coreSet.has(i) && !planned.has(i));
        const reachable = i => neighbors(i).some(n => after.dist[n] >= 0);
        let dropped = 0;
        for (const kind of Object.keys(out)) {
            if (kind === 'storage' || kind === 'link' || kind === 'lab') continue;
            out[kind] = out[kind].filter(tile => {
                if (coreSet.has(tile) || reachable(tile)) return true;
                planned.delete(tile);
                dropped++;
                return false;
            });
        }
        if (!dropped) break;
        for (const kind of ['spawn', 'tower', 'extension', 'terminal', 'factory', 'powerSpawn', 'nuker', 'observer']) {
            for (let n = out[kind].length; n < COUNTS[kind]; n++) {
                const tile = pickNext();
                if (tile === undefined) break;
                place(kind, tile);
            }
        }
    }

    // Roads: required paths, the lab stamp, and lattice roads beside a planned structure.
    for (const i of order) {
        if (!latticeRoad(i, anchor) || planned.has(i) || reserved[i]) continue;
        if (X(i) < 1 || X(i) > 48 || Y(i) < 1 || Y(i) > 48) continue;
        if (neighbors(i).some(n => planned.has(n))) roads.add(i);
    }
    for (const tile of roads) if (X(tile) === 0 || X(tile) === 49 || Y(tile) === 0 || Y(tile) === 49) roads.delete(tile);

    const paths = [...forced].filter(tile => !roads.has(tile));
    return { mode, anchor, flags, structures: out, roads: [...roads], paths, labRoles: { boost: labs.boost.length, input: labs.input.length } };
}

module.exports = { plan, chooseCore, latticeRoad, bfs, neighbors, I, X, Y, cheb, COUNTS };
