// base.connectivity — never let a construction site cut a room's paths.
//
// A layout plan is drawn for the finished room. While a room is still being built or migrated,
// the walls of old structures can make a planned tile the only way through (a link site in a
// 1-wide corridor trapped every creep of a room in one corner). So before any site that blocks
// movement goes down, it is checked against the room as it stands right now:
//   - every free tile next to a spawn (where a new creep can appear) can still reach a room
//     exit; a structure placed on that tile itself is fine (no creep spawns there then)
//   - the storage, sources, mineral and controller stay reachable from the exits (the part of
//     the room haulers walk; the enclosed Supply tile touching the storage does not count)
//   - every structure a hauler has to reach (extensions, spawns, towers, labs, links, terminal,
//     factory, power spawn, nuker) keeps a free neighbour reachable from the exits, unless it
//     touches a parked work tile (Supply, storageMiner, upgradeMiner: the creep there serves it). A new site for such a
//     structure must itself be reachable that way (blocks(..., needsAccess)).
// Anything that was reachable before the site must still be reachable with it. Existing sites
// that already cut such a path are found and removed (base.builder).
//
// Pure: works on a walkability grid (Uint8Array[2500], index x*50+y, 1 = a creep can stand
// there), so it is testable and cheap: one connected-component pass per check.
const OFFSETS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

function neighbors(i) {
    const x = (i / 50) | 0, y = i % 50, out = [];
    for (const [dx, dy] of OFFSETS) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx <= 49 && ny >= 0 && ny <= 49) out.push(nx * 50 + ny);
    }
    return out;
}

function reach(walkable, seeds) {
    const seen = new Uint8Array(2500);
    const queue = [];
    for (const s of seeds) {
        if (walkable[s] && !seen[s]) { seen[s] = 1; queue.push(s); }
    }
    for (let head = 0; head < queue.length; head++) {
        for (const n of neighbors(queue[head])) {
            if (walkable[n] && !seen[n]) { seen[n] = 1; queue.push(n); }
        }
    }
    return seen;
}

/**
 * The places that must stay reachable.
 * room: { spawns: [tile], storage: tile|undefined, sources: [tile], mineral: tile|undefined,
 *         controller: tile|undefined, serviced: [tile], service: [tile] (parked work tiles) }
 * Returns { perSpawn: [{ seeds, groups, tile }], shared: { seeds, groups } } where each group is a
 * list of tiles (reachable = any of them reached). perSpawn has one entry per free tile next to a
 * spawn (tile = that tile).
 */
function requirements(walkable, room) {
    const exits = [];
    for (let k = 0; k < 50; k++) {
        for (const i of [k, 49 * 50 + k, k * 50, k * 50 + 49]) if (walkable[i]) exits.push(i);
    }
    const around = (tile, range) => {
        const out = [];
        if (tile === undefined) return out;
        const x = (tile / 50) | 0, y = tile % 50;
        for (let dx = -range; dx <= range; dx++) for (let dy = -range; dy <= range; dy++) {
            const nx = x + dx, ny = y + dy;
            if ((dx || dy) && nx >= 0 && nx <= 49 && ny >= 0 && ny <= 49) out.push(nx * 50 + ny);
        }
        return out;
    };
    const service = new Set(room.service || []);
    const perSpawnGroups = [exits];
    const shared = [];
    if (room.storage !== undefined) shared.push(around(room.storage, 1));
    for (const source of room.sources || []) shared.push(around(source, 1));
    if (room.mineral !== undefined) shared.push(around(room.mineral, 1));
    if (room.controller !== undefined) shared.push(around(room.controller, 3));
    for (const tile of room.serviced || []) {
        const next = around(tile, 1);
        if (next.some(t => service.has(t))) continue;
        shared.push(next);
    }
    const perSpawn = [];
    const seen = new Set();
    for (const spawn of room.spawns || []) {
        for (const tile of around(spawn, 1)) {
            if (!walkable[tile] || seen.has(tile)) continue;
            seen.add(tile);
            perSpawn.push({ seeds: [tile], groups: perSpawnGroups, tile });
        }
    }
    return { perSpawn, shared: { seeds: exits, groups: shared }, service };
}

// Connected-component label of every walkable tile (0 = not walkable).
function components(walkable) {
    const label = new Int32Array(2500);
    const queue = new Int32Array(2500);
    let next = 0;
    for (let start = 0; start < 2500; start++) {
        if (!walkable[start] || label[start]) continue;
        next++;
        label[start] = next;
        let head = 0, tail = 0;
        queue[tail++] = start;
        while (head < tail) {
            for (const n of neighbors(queue[head++])) {
                if (walkable[n] && !label[n]) { label[n] = next; queue[tail++] = n; }
            }
        }
    }
    return label;
}

// Which groups are reachable: a flat list of booleans in a fixed order.
function status(walkable, req, label = components(walkable)) {
    const linked = (seeds, group) => {
        const ids = new Set();
        for (const s of seeds) if (walkable[s]) ids.add(label[s]);
        return group.some(t => walkable[t] && ids.has(label[t]));
    };
    const out = [];
    for (const { seeds, groups, tile } of req.perSpawn) {
        // Built over: no creep can appear on this tile any more, so it cannot be trapped.
        const covered = tile !== undefined && !walkable[tile];
        for (const group of groups) out.push(covered || linked(seeds, group));
    }
    for (const group of req.shared.groups) out.push(linked(req.shared.seeds, group));
    return out;
}

// Everything reachable in `before` is still reachable in `after`.
function keeps(before, after) {
    return before.every((ok, i) => !ok || after[i]);
}

// Can a creep serve a structure on `tile`: a free neighbour connected to the room exits, or a
// parked work tile next to it?
function accessible(walkable, req, tile, label = components(walkable)) {
    const exitIds = new Set();
    for (const e of req.shared.seeds) if (walkable[e]) exitIds.add(label[e]);
    return neighbors(tile).some(n => req.service.has(n) || (walkable[n] && exitIds.has(label[n])));
}

// Would blocking `tile` cut anything? With needsAccess, also refuse when the structure placed
// there could not be reached itself. (walkable is restored before returning.)
function blocks(walkable, req, before, tile, needsAccess = false) {
    if (!walkable[tile]) return false;
    walkable[tile] = 0;
    const label = components(walkable);
    const cut = !keeps(before, status(walkable, req, label)) || (needsAccess && !accessible(walkable, req, tile, label));
    walkable[tile] = 1;
    return cut;
}

module.exports = { requirements, status, keeps, blocks, reach, accessible, components };
