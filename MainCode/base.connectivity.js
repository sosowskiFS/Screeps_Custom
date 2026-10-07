// base.connectivity — never let a construction site cut a room's paths.
//
// A layout plan is drawn for the finished room. While a room is still being built or migrated,
// the walls of old structures can make a planned tile the only way through (a link site in a
// 1-wide corridor trapped every creep of a room in one corner). So before any site that blocks
// movement goes down, it is checked against the room as it stands right now:
//   - each spawn can still reach a room exit
//   - the storage, sources, mineral and controller stay reachable from the exits (the part of
//     the room haulers walk; the enclosed Supply tile touching the storage does not count)
// Anything that was reachable before the site must still be reachable with it. Existing sites
// that already cut such a path are found and removed (base.builder).
//
// Pure: works on a walkability grid (Uint8Array[2500], index x*50+y, 1 = a creep can stand
// there), so it is testable and cheap (one breadth-first pass per spawn and candidate).
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
 *         controller: tile|undefined }
 * Returns { perSpawn: [{ seeds, groups }], shared: { seeds, groups } } where each group is a list
 * of tiles (reachable = any of them reached).
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
    const perSpawnGroups = [exits];
    const shared = [];
    if (room.storage !== undefined) shared.push(around(room.storage, 1));
    for (const source of room.sources || []) shared.push(around(source, 1));
    if (room.mineral !== undefined) shared.push(around(room.mineral, 1));
    if (room.controller !== undefined) shared.push(around(room.controller, 3));
    const spawnSeeds = (room.spawns || []).map(spawn => around(spawn, 1));
    return {
        perSpawn: spawnSeeds.map(seeds => ({ seeds, groups: perSpawnGroups })),
        shared: { seeds: exits, groups: shared },
    };
}

// Which groups are reachable: a flat list of booleans in a fixed order.
function status(walkable, req) {
    const out = [];
    for (const { seeds, groups } of req.perSpawn) {
        const seen = reach(walkable, seeds);
        for (const group of groups) out.push(group.some(t => seen[t]));
    }
    const seen = reach(walkable, req.shared.seeds);
    for (const group of req.shared.groups) out.push(group.some(t => seen[t]));
    return out;
}

// Everything reachable in `before` is still reachable in `after`.
function keeps(before, after) {
    return before.every((ok, i) => !ok || after[i]);
}

// Would blocking `tile` cut anything? (walkable is restored before returning.)
function blocks(walkable, req, before, tile) {
    if (!walkable[tile]) return false;
    walkable[tile] = 0;
    const ok = keeps(before, status(walkable, req));
    walkable[tile] = 1;
    return !ok;
}

module.exports = { requirements, status, keeps, blocks, reach };
