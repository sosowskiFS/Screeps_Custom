// spawn.essentials — the creeps a room cannot do without, and whether any are missing.
//
// A room whose energy chain is broken (nobody refilling spawns/extensions, nobody feeding the
// towers, nobody mining) collapses if its spawns spend energy on anything else first. While
// something is missing:
//   - every non-essential spawn path stands down: flag commands (power, claims, assaults,
//     rangers...), remote mining, scouts, highway patrol and observer harassers
//     (system.spawning, system.observers)
//   - the room's own staffing spawns the missing roles first, sized to the energy actually in
//     the spawns and extensions instead of waiting for full-size bodies (spawn.BuildCreeps5)
//
// Essentials (rooms with a storage):
//   refill   a distributor or mule: they refill spawns and extensions from the storage
//   supplier with towers built: keeps them fed for defense
//   miner    a storage miner, except in maintenance mode (no miners by design there)
// Rooms without a storage only need creeps at all (their staffing is harvester-based).
const runtimeCache = require('runtime.cache');
const maintenance = require('system.maintenance');

const REFILL = new Set(['distributor', 'distributorNearDeath', 'mule', 'muleNearDeath']);
const SUPPLIER = new Set(['supplier', 'supplierNearDeath']);
const MINER = new Set(['miner', 'minerNearDeath']);

// Missing essential roles for this room ('refill', 'supplier', 'miner'), cached per tick.
// Creeps ordered earlier this tick count (runtime.cache placeholders).
function missing(room) {
    const cache = runtimeCache.current();
    const memo = cache.essentials || (cache.essentials = Object.create(null));
    // Re-evaluated when another spawn ordered a creep this tick.
    const ordered = cache.pending ? cache.pending.length : 0;
    if (memo[room.name] && memo[room.name].n === ordered) return memo[room.name].out;
    const out = [];
    const creeps = runtimeCache.homeCreeps(room.name);
    if (!room.storage) {
        if (!creeps.length) out.push('any');
    } else {
        const has = roles => creeps.some(c => c.memory && roles.has(c.memory.priority));
        if (!has(REFILL)) out.push('refill');
        const towers = runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });
        if (towers.length && !has(SUPPLIER)) out.push('supplier');
        if (!maintenance.inMaintenance(room.name) && runtimeCache.find(room, FIND_SOURCES).length && !has(MINER)) out.push('miner');
    }
    memo[room.name] = { n: ordered, out };
    return out;
}

function ok(room) {
    return missing(room).length === 0;
}

module.exports = { missing, ok };
