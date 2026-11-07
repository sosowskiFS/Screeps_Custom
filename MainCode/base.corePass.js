// base.corePass — a way past the base core where it fills a narrow passage.
//
// The core is 3x3: the Supply tile, the storage, the first spawn and 6 towers. In open ground creeps walk
// round it. Where it fills a gap in the terrain it is a wall: shard2 E39N37's stands in a passage 3 tiles
// high, and a spawn 3 tiles from the storage was an 89-tile walk across the room; shard1 E38N44's made it 26.
//
// When the finished plan makes such a detour, the cheapest lane through what is planned is kept clear:
// a path search over the plan where free tiles cost little and each structure costs by how much it matters.
// What stood on the lane goes elsewhere: the first spawn back beside the Supply tile if it can (a tower gives
// way), the rest on the nearest free tiles. Towers off the core are out of the supplier's reach from its
// tile: it walks to them (creep.supplier), which is the price, and only rooms that need it pay it. Rooms
// with no such detour are left exactly as they are, and measuring one costs a few breadth-first passes;
// a room that does need a lane costs a few hundred ms of searching, once (base.builder waits for the bucket).
//
// Pure, like base.planner: works on plain data and returns the changed plan or null.
const DETOUR_WORST = 15;         // a structure this much further than the terrain makes it...
const DETOUR_COUNT = 5;          // ...and this many of them...
const DETOUR_MEAN = 8.5;          // ...and this far on average over the whole base, or no lane: a room with a few
                                 // long walks keeps its full core (its supplier reaches all 6 towers)
const TARGETS_TRIED = 3;         // worst structures, and furthest ones, a lane is tried towards
const MAX_MOVED = 6;             // structures a lane may displace
const MAX_LANES = 2;
const WORTH = 0.6;               // a lane must bring the mean detour down to this share of what it was
const COST_FREE = 1;
// What a structure on the way counts for, times the scale being tried. Others (links, labs, the nuker) are
// never moved for a lane.
const WEIGHT = { extension: 0.6, observer: 0.6, tower: 1, spawn: 1, terminal: 1.2, factory: 1.2, powerSpawn: 1.2 };
const WEIGHT_FIRST_SPAWN = 1.6;
const SCALES = [3, 12];
const SERVED_KINDS = ['spawn', 'extension', 'tower', 'lab', 'link', 'terminal', 'factory', 'powerSpawn', 'nuker', 'observer'];

const X = t => (t / 50) | 0, Y = t => t % 50;
const cheb = (a, b) => Math.max(Math.abs(X(a) - X(b)), Math.abs(Y(a) - Y(b)));
function neighbors(t) {
    const x = X(t), y = Y(t), out = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx <= 49 && ny >= 0 && ny <= 49) out.push(nx * 50 + ny);
    }
    return out;
}

// Steps from these tiles: solid tiles are reached, not walked through.
function walk(walls, solid, from) {
    const dist = new Int16Array(2500).fill(-1), queue = from.slice();
    for (const t of from) dist[t] = 0;
    for (let head = 0; head < queue.length; head++) {
        for (const n of neighbors(queue[head])) {
            if (walls[n] || dist[n] >= 0) continue;
            dist[n] = dist[queue[head]] + 1;
            if (!solid.has(n)) queue.push(n);
        }
    }
    return dist;
}

function solidOf(s, structures) {
    const solid = new Set();
    for (const kind in structures) for (const t of structures[kind]) solid.add(t);
    for (const name in s.flags || {}) solid.add(s.flags[name]);
    for (const t of s.fixed) solid.add(t);
    return solid;
}

// How much further the plan makes each target than the terrain does, from the tiles where creeps get at
// the storage (s.origins): a creep cannot walk through the storage, so a way past the core has to start there. What
// touches a parked work tile (the core towers behind the supplier, the miner's link) is served from there.
function measure(s, structures) {
    const open = walk(s.walls, new Set(s.fixed), s.origins), planned = walk(s.walls, solidOf(s, structures), s.origins);
    const parked = new Set(Object.values(s.flags || {}));
    const targets = [];
    for (const kind of SERVED_KINDS) for (const t of structures[kind] || []) if (!neighbors(t).some(n => parked.has(n))) targets.push(t);
    for (const t of s.fixed) targets.push(t);
    let worst = 0, count = 0, cut = false, total = 0;
    const far = [];
    for (const t of targets) {
        if (open[t] < 0) continue;
        if (planned[t] < 0) { cut = true; worst = Infinity; count++; far.push([Infinity, t]); total += open[t]; continue; }
        const extra = planned[t] - open[t];
        total += extra;
        if (extra >= DETOUR_WORST) count++;
        if (extra > worst) worst = extra;
        if (extra > 0) far.push([extra, t]);
    }
    // Worst first, and the furthest of the badly placed: the worst can stand just behind the block, with the
    // rest of what is cut off further in (shard2 E39N37's lane has to get past its spawns too).
    far.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    const deep = far.filter(e => e[0] >= DETOUR_WORST).sort((a, b) => open[b[1]] - open[a[1]] || a[1] - b[1]);
    const tried = [...new Set(far.slice(0, TARGETS_TRIED).concat(deep.slice(0, TARGETS_TRIED)).map(e => e[1]))];
    return { worst, far: tried, count, cut, mean: targets.length ? total / targets.length : 0 };
}

// The cheapest walk from the storage to a target with structures counted at this scale: small scales go
// round them, large ones through. Returns the tiles to clear: those structures and a free tile either side.
function laneTo(s, structures, target, scale) {
    const kindAt = new Map();
    for (const kind in structures) for (const t of structures[kind]) kindAt.set(t, kind);
    const flags = new Set(Object.values(s.flags || {}));
    const fixed = new Set(s.fixed);
    const firstSpawn = (structures.spawn || [])[0];
    const stepCost = t => {
        if (s.walls[t] || flags.has(t) || fixed.has(t) || s.nearFixed.has(t)) return Infinity;
        if (X(t) < 1 || Y(t) < 1 || X(t) > 48 || Y(t) > 48) return Infinity;
        const kind = kindAt.get(t);
        if (kind === undefined) return COST_FREE;
        if (t === firstSpawn) return COST_FREE + WEIGHT_FIRST_SPAWN * scale;
        return WEIGHT[kind] === undefined ? Infinity : COST_FREE + WEIGHT[kind] * scale;
    };
    const best = new Float64Array(2500).fill(Infinity), from = new Int16Array(2500).fill(-1);
    for (const t of s.origins) best[t] = 0;
    const storage = structures.storage[0];
    // A small grid and few runs: plain relaxation is enough.
    for (let changed = true; changed;) {
        changed = false;
        for (let t = 0; t < 2500; t++) {
            if (best[t] === Infinity) continue;
            for (const n of neighbors(t)) {
                if (n === storage) continue;
                const c = best[t] + stepCost(n);
                if (c < best[n]) { best[n] = c; from[n] = t; changed = true; }
            }
        }
    }
    let end = -1, endCost = Infinity;
    for (const t of neighbors(target)) {
        if (best[t] < endCost) { endCost = best[t]; end = t; }
    }
    if (end < 0) return null;
    const path = [];
    for (let t = end; t >= 0; t = from[t]) path.unshift(t);
    const hits = path.map((t, i) => (kindAt.has(t) ? i : -1)).filter(i => i >= 0);
    if (!hits.length) return null;
    return path.slice(Math.max(0, hits[0] - 1), hits[hits.length - 1] + 2);
}

function rehome(s, structures, lane, kept) {
    const moved = [];
    const kindAt = new Map();
    for (const kind in structures) for (const t of structures[kind]) kindAt.set(t, kind);
    const supply = s.flags && s.flags.Supply;
    const out = {};
    for (const kind in structures) out[kind] = structures[kind].slice();
    const queue = [];
    for (const t of lane) if (kindAt.has(t)) queue.push({ kind: kindAt.get(t), from: t, first: t === structures.spawn[0] });
    for (const d of queue) out[d.kind] = out[d.kind].filter(t => t !== d.from);
    // The first spawn stays beside the Supply tile: a tower there gives way.
    const first = queue.find(d => d.first);
    if (first) {
        const tower = supply === undefined ? undefined : out.tower.find(t => cheb(t, supply) === 1 && !lane.includes(t));
        if (tower === undefined) return null;
        out.tower = out.tower.filter(t => t !== tower);
        out.spawn.unshift(tower);
        moved.push(['spawn', first.from, tower]);
        queue.splice(queue.indexOf(first), 1);
        queue.push({ kind: 'tower', from: tower });
    }
    const taken = new Set(kept);
    for (const t of lane) taken.add(t);
    const usable = t => X(t) >= 2 && X(t) <= 47 && Y(t) >= 2 && Y(t) <= 47 && !s.walls[t] && !taken.has(t) && !s.nearFixed.has(t);
    // Towers and spawns first, nearest: each can push an extension further out, and the extensions go last.
    const order = d => (d.kind === 'extension' ? 2 : d.kind === 'tower' ? 0 : 1);
    while (queue.length) {
        queue.sort((a, b) => order(a) - order(b));
        const d = queue.shift();
        const solid = solidOf(s, out);
        const dist = walk(s.walls, solid, s.origins);
        const before = measure(s, out);
        const free = [];
        for (let t = 0; t < 2500; t++) if (dist[t] > 0 && !solid.has(t) && usable(t)) free.push(t);
        free.sort((a, b) => dist[a] - dist[b] || a - b);
        // A tower or spawn stays as near the Supply tile as it can (the supplier walks to it), on an
        // extension's tile if that is nearer than free ground; the extension moves further out.
        const nearSupply = t => (supply === undefined ? dist[t] : cheb(t, supply) * 4 + dist[t]);
        if (d.kind !== 'extension') {
            free.sort((a, b) => nearSupply(a) - nearSupply(b) || a - b);
            const swap = (out.extension || []).filter(t => dist[t] > 0).sort((a, b) => nearSupply(a) - nearSupply(b) || a - b)[0];
            if (swap !== undefined && (!free.length || nearSupply(swap) < nearSupply(free[0]))) {
                out.extension = out.extension.filter(t => t !== swap);
                out[d.kind] = out[d.kind].concat(swap);
                moved.push([d.kind, d.from, swap]);
                queue.push({ kind: 'extension', from: swap });
                continue;
            }
        }
        let placed;
        for (const t of free.slice(0, 30)) {
            out[d.kind] = out[d.kind].concat(t);
            const after = measure(s, out);
            if (!after.cut && after.worst <= before.worst) { placed = t; break; }
            out[d.kind] = out[d.kind].slice(0, -1);
        }
        if (placed === undefined) return null;
        taken.add(placed);
        moved.push([d.kind, d.from, placed]);
    }
    return { structures: out, moved };
}

/**
 * s = { walls, structures: {kind: [tile]}, roads: [tile], paths: [tile], flags: {name: tile},
 *       sources: [tile], mineral, controller }
 * Returns { structures, roads, paths, lane, moved: [[kind, from, to]], before, after } or null.
 */
function corePass(s0) {
    if (!s0.structures.storage || !s0.structures.storage.length || !(s0.structures.spawn || []).length) return null;
    const fixed = (s0.sources || []).concat(s0.mineral === undefined ? [] : [s0.mineral], s0.controller === undefined ? [] : [s0.controller]);
    const nearFixed = new Set();
    for (const t of (s0.sources || []).concat(s0.mineral === undefined ? [] : [s0.mineral])) for (const n of neighbors(t)) nearFixed.add(n);
    if (s0.controller !== undefined) for (let t = 0; t < 2500; t++) if (cheb(t, s0.controller) <= 2) nearFixed.add(t);
    const s = Object.assign({}, s0, { fixed, nearFixed });
    let structures = s.structures;
    const solid0 = solidOf(s, structures);
    s.origins = neighbors(structures.storage[0]).filter(t => !s.walls[t] && !solid0.has(t));
    if (!s.origins.length) return null;
    const first = measure(s, structures);
    if (first.worst < DETOUR_WORST || first.count < DETOUR_COUNT || first.mean < DETOUR_MEAN) return null;
    const lane = [], moved = [];
    let now = first;
    for (let n = 0; n < MAX_LANES && (now.cut || (now.worst >= DETOUR_WORST && now.count >= DETOUR_COUNT)); n++) {
        const solid = solidOf(s, structures);
        const kept = new Set([...solid, ...(s.roads || []), ...(s.paths || []), ...lane]);
        const tried = new Set();
        let pick = null;
        for (const target of now.far) for (const scale of SCALES) {
            const tiles = laneTo(s, structures, target, scale);
            if (!tiles || tried.has(tiles.join())) continue;
            tried.add(tiles.join());
            if (tiles.filter(t => solid.has(t)).length + moved.length > MAX_MOVED) continue;
            const result = rehome(s, structures, tiles, kept);
            if (!result) continue;
            const after = measure(s, result.structures);
            if (after.mean > now.mean * WORTH) continue;
            // Fewest towers off the core among those nearly as good.
            const score = after.mean + result.moved.filter(e => e[0] === 'tower').length;
            if (!pick || score < pick.score) pick = { tiles, result, after, score };
        }
        if (!pick) break;
        structures = pick.result.structures;
        moved.push(...pick.result.moved);
        lane.push(...pick.tiles);
        now = pick.after;
    }
    if (!lane.length) return null;
    const clear = new Set(lane);
    return {
        structures, lane, moved,
        roads: (s.roads || []).filter(t => !clear.has(t)).concat(lane),
        paths: (s.paths || []).filter(t => !clear.has(t)),
        before: { worst: first.worst, count: first.count, mean: first.mean },
        after: { worst: now.worst, count: now.count, mean: now.mean },
    };
}

module.exports = { corePass, measure, DETOUR_WORST, DETOUR_COUNT };
