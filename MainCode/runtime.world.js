// runtime.world — which world the code runs in, and what that world offers.
//
// The Seasonal World (screeps.com/season, shard "shardSeason") is a separate, temporary server:
//   - one shard only: no other shards to share InterShardMemory with, no intershard portals,
//     no shard CPU limits to manage (CPU is a fixed amount there)
//   - no market trading: no NPC orders, and deals and terminal sends between different players
//     are not processed (our own terminals still send to each other; the market API is still
//     there, so calcTransactionCost works)
//   - no pixels (Game.cpu.generatePixel is not a function) and no account resources to trade or
//     use (CPU unlocks)
//   - each season may change constants and add mechanics (handled per season, not here)
// Systems ask here instead of assuming the persistent MMO. Memory.settings.world = 'season'
// forces season behaviour (a private server running a season mod); = 'mmo' forces the reverse.
function isSeason() {
    const forced = Memory.settings && Memory.settings.world;
    if (forced === 'season') return true;
    if (forced === 'mmo') return false;
    return !!(Game.shard && /season/i.test(Game.shard.name || ''));
}

// Trading with other players: orders, deals, prices.
function market() {
    return !isSeason() && typeof Game.market === 'object' && !!Game.market && typeof Game.market.deal === 'function';
}

// Generating pixels from the CPU bucket.
function pixels() {
    return !isSeason() && !!Game.cpu && typeof Game.cpu.generatePixel === 'function';
}

// Account resources (pixels, CPU unlocks) and Game.cpu.unlock().
function accountResources() {
    return !isSeason() && !!Game.resources && !!Game.cpu && typeof Game.cpu.unlock === 'function';
}

// Other shards to coordinate with through InterShardMemory and portals.
function multiShard() {
    return !isSeason() && typeof InterShardMemory !== 'undefined';
}

// Energy a terminal pays to send `amount` between two rooms: the game's formula when the market
// API offers it, else the same formula computed here.
function transactionCost(amount, fromRoom, toRoom) {
    if (Game.market && typeof Game.market.calcTransactionCost === 'function') return Game.market.calcTransactionCost(amount, fromRoom, toRoom);
    const distance = Game.map.getRoomLinearDistance(fromRoom, toRoom, true);
    return Math.ceil(amount * (1 - Math.exp(-distance / 30)));
}

module.exports = { isSeason, market, pixels, accountResources, multiShard, transactionCost };
