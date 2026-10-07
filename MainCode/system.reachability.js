// system.reachability — can a creep from this home actually get to that room?
//
// Traveler never routes through rooms claimed by non-whitelisted players (system.badRooms), so a
// target can become unreachable: every way in crosses a claimed room. Special spawns (harassers,
// flag commands) check here first, so no creep is spawned for a trip it cannot make.
//
// Unreachable pairs are remembered in Memory.unreachable['HOME>TARGET'] = tick checked and not
// retried for RECHECK ticks (claims change rarely; a fresh bad-room scout can also clear them).
// Reachable answers are not stored: Traveler caches its routes.
const { Traveler } = require('traveler');

const RECHECK = 10000;

function key(home, target) {
    return home + '>' + target;
}

function reachable(home, target) {
    if (!home || !target || home === target) return true;
    const table = Memory.unreachable || (Memory.unreachable = {});
    const id = key(home, target);
    const checked = table[id];
    if (checked !== undefined && Game.time - checked < RECHECK) return false;
    if (Traveler.findRoute(home, target)) {
        delete table[id];
        return true;
    }
    if (checked === undefined) {
        console.log('No route from ' + home + ' to ' + target + ' avoiding claimed rooms: spawning for it paused, rechecked every ' + RECHECK + ' ticks');
    }
    table[id] = Game.time;
    return false;
}

// Drop expired entries (they would be rechecked anyway). Returns the number removed.
function prune() {
    const table = Memory.unreachable;
    if (!table) return 0;
    let removed = 0;
    for (const id in table) {
        if (Game.time - table[id] >= RECHECK) {
            delete table[id];
            removed++;
        }
    }
    if (!Object.keys(table).length) delete Memory.unreachable;
    return removed;
}

module.exports = { reachable, prune, RECHECK };
