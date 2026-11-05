// base.labRefit — a new place for an established room's 10 labs, every one in reaction range.
//
// An output reacts only within range 2 of both reagent labs. Older plans kept 3 boost labs by the
// spawns, out of reach, so only 5 outputs reacted. Now the lab worker loads a boost into a reaction
// lab when it is wanted (system.labLayout), so all 10 stand together. A planned room is already built:
// this keeps as many standing labs as it can (50,000 energy each), taking free tiles, roads and
// extensions for the others. A displaced extension goes to a tile a moved lab leaves, so the room
// keeps its count. Other buildings, kept-clear paths, flag tiles, creep tiles around sources and the
// controller, and tiles behind terrain are never used. Pure, like base.planner: base.builder stores the
// result, and base.migrate moves the structures.
const cheb = (a, b) => Math.max(Math.abs(((a / 50) | 0) - ((b / 50) | 0)), Math.abs(a % 50 - b % 50));
const REACH = 2;
const TRIES = 300;       // best candidates flood-filled to prove nothing gets cut off

function neighbors(t) {
    const x = (t / 50) | 0, y = t % 50, out = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx <= 49 && ny >= 0 && ny <= 49) out.push(nx * 50 + ny);
    }
    return out;
}

// Tiles creeps can walk to from the room's exits, around these solid tiles.
function flood(walls, solid) {
    const seen = new Uint8Array(2500), queue = [];
    const add = t => { if (!walls[t] && !solid.has(t) && !seen[t]) { seen[t] = 1; queue.push(t); } };
    for (let i = 0; i < 50; i++) for (const t of [i * 50, i * 50 + 49, i, 49 * 50 + i]) add(t);
    while (queue.length) for (const n of neighbors(queue.pop())) add(n);
    return seen;
}

// The 8 labs of one reagent pair, cheapest first. Ties keep the region's order (nearest the core).
function pairsOf(tiles, isTile, costOf) {
    const out = [];
    for (const a of tiles) {
        const ax = (a / 50) | 0, ay = a % 50;
        for (let bx = ax; bx <= Math.min(49, ax + REACH); bx++) {
            for (let by = Math.max(0, ay - REACH); by <= Math.min(49, ay + REACH); by++) {
                const b = bx * 50 + by;
                if (b <= a || !isTile[b]) continue;
                const region = [];
                for (let x = Math.max(0, Math.max(ax, bx) - REACH); x <= Math.min(49, Math.min(ax, bx) + REACH); x++) {
                    for (let y = Math.max(0, Math.max(ay, by) - REACH); y <= Math.min(49, Math.min(ay, by) + REACH); y++) {
                        const t = x * 50 + y;
                        if (t !== a && t !== b && isTile[t]) region.push(t);
                    }
                }
                if (region.length < 8) continue;
                region.sort((p, q) => costOf[p] - costOf[q]);
                let total = costOf[a] + costOf[b];
                for (let n = 0; n < 8; n++) total += costOf[region[n]];
                out.push({ a, b, labs: region.slice(0, 8), total });
            }
        }
    }
    return out.sort((p, q) => p.total - q.total);
}

/**
 * s = { walls, structures: {kind: [tile]}, roads: [tile], paths: [tile], flags: {name: tile},
 *       live: [{tile, type}] built structures but roads and ramparts (type: a plan kind where it has one),
 *       sources: [tile], mineral, controller, anchor, behind: tile -> behind terrain from the core }
 * Returns { lab, extension, roads, kept } or null. lab order: 3 that load a boost on demand (nearest
 * the core), the 2 reagent labs, the other 5.
 */
function refit(s) {
    const planned = new Map();
    for (const kind in s.structures) for (const t of s.structures[kind]) planned.set(t, kind);
    const clear = new Set(s.paths || []);
    for (const name in s.flags || {}) clear.add(s.flags[name]);
    const nearMine = new Set();
    for (const tile of (s.sources || []).concat(s.mineral === undefined ? [] : [s.mineral])) for (const n of neighbors(tile)) nearMine.add(n);
    const builtAt = new Map();
    for (const b of s.live || []) builtAt.set(b.tile, b.type);
    const roads = new Set(s.roads || []);

    const usable = t => {
        const x = (t / 50) | 0, y = t % 50;
        if (x < 2 || x > 47 || y < 2 || y > 47 || s.walls[t] || clear.has(t) || nearMine.has(t)) return false;
        if (s.behind && s.behind(t)) return false;
        if (s.controller !== undefined && cheb(t, s.controller) <= 2) return false;
        const kind = planned.get(t);
        if (kind !== undefined && kind !== 'lab' && kind !== 'extension') return false;
        const here = builtAt.get(t);
        return here === undefined || here === 'lab' || here === 'extension';
    };
    // A lab already standing is free. A new one costs about the same anywhere; an extension to rebuild
    // or a road to take costs a little more. Ties go to the tile nearest the core.
    const cost = t => {
        const here = builtAt.get(t);
        if (here === 'lab') return 0;
        return 1 + (here === 'extension' ? 0.3 : planned.get(t) === 'extension' ? 0.05 : 0) + (roads.has(t) ? 0.2 : 0) +
            (s.anchor === undefined ? 0 : cheb(t, s.anchor) * 0.001);
    };
    const tiles = [];
    const isTile = new Uint8Array(2500), costOf = new Float64Array(2500);
    for (let t = 0; t < 2500; t++) {
        if (!usable(t)) continue;
        tiles.push(t);
        isTile[t] = 1;
        costOf[t] = cost(t);
    }

    const oldLabs = s.structures.lab || [];
    const before = flood(s.walls, new Set(planned.keys()));
    const touches = (seen, t) => neighbors(t).some(n => seen[n]);

    for (const c of pairsOf(tiles, isTile, costOf).slice(0, TRIES)) {
        const chosen = new Set([c.a, c.b, ...c.labs]);
        const vacated = oldLabs.filter(t => !chosen.has(t));
        const displaced = (s.structures.extension || []).filter(t => chosen.has(t));
        if (displaced.length > vacated.length) continue;
        const moved = new Map(displaced.map((t, n) => [t, vacated[n]]));
        const arrivals = new Set(moved.values());
        const solid = new Set([...chosen, ...arrivals]);
        for (const [t, kind] of planned) if (kind !== 'lab' && !moved.has(t)) solid.add(t);
        const after = flood(s.walls, solid);
        // Every lab and moved extension can be served, and nothing served before is cut off.
        let fine = [...chosen, ...arrivals].every(t => touches(after, t));
        if (fine) for (const t of solid) if (touches(before, t) && !touches(after, t)) { fine = false; break; }
        if (fine) for (const t of clear) if (before[t] && !after[t]) { fine = false; break; }
        if (!fine) continue;
        const byCore = c.labs.slice().sort((p, q) => (s.anchor === undefined ? 0 : cheb(p, s.anchor) - cheb(q, s.anchor)) || p - q);
        return {
            lab: [...byCore.slice(0, 3), c.a, c.b, ...byCore.slice(3)],
            extension: (s.structures.extension || []).map(t => (moved.has(t) ? moved.get(t) : t)),
            roads: (s.roads || []).filter(t => !chosen.has(t) && !arrivals.has(t)),
            kept: [...chosen].filter(t => builtAt.get(t) === 'lab').length,
        };
    }
    return null;
}

module.exports = { refit };
