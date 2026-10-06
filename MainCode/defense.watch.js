// defense.watch — tracks how hostiles use a room's borders, to recognise energy-drain tactics.
//
// The classic drain: a tough creep steps onto (or just inside) the border, soaks tower fire
// or triggers defender spawns, then steps out to be healed and comes back. Signs:
//   * every hostile stays within BORDER_ZONE tiles of an exit, and
//   * it keeps re-entering (or has loitered at the edge for a long time).
// A room is NOT draining if any hostile pushes deeper or is actively damaging structures.
//
// Memory.defenseWatch[room] = { first, last, entries, present, border, deep, siege }
// Small, per room, and removed after a long quiet period.
const BORDER_ZONE = 3;        // tiles from an exit that count as "at the border"
const QUIET_TICKS = 20;       // hostiles absent this long = the visit is over (rooms stop flapping)
const WINDOW_RESET = 300;     // absent this long = start counting a fresh incident
const FORGET_TICKS = 1500;    // delete the record entirely
const MIN_ENTRIES = 3;        // re-entries before bouncing is assumed...
const MIN_LOITER = 50;        // ...or ticks spent loitering at the edge
const BORDER_RATIO = 0.8;     // share of present ticks spent border-only

function edgeDistance(pos) {
    return Math.min(pos.x, pos.y, 49 - pos.x, 49 - pos.y);
}

// Hostile actively damaging walls/ramparts/structures: never treat that as a harmless drain.
function isSieging(hostile) {
    if (!hostile.body) return false; // power creeps have no body parts
    if (hostile.getActiveBodyparts(WORK) === 0 && hostile.getActiveBodyparts(ATTACK) === 0) return false;
    return hostile.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: s => s.structureType !== STRUCTURE_ROAD && s.structureType !== STRUCTURE_CONTAINER &&
            (s.my || s.structureType === STRUCTURE_WALL)
    }).length > 0;
}

// Call once per tick per room (from the tower/defense phase) with the room's hostiles.
function update(room, hostiles) {
    if (!Memory.defenseWatch) Memory.defenseWatch = {};
    let watch = Memory.defenseWatch[room.name];
    if (!hostiles.length) {
        if (watch && Game.time - watch.last > FORGET_TICKS) delete Memory.defenseWatch[room.name];
        return watch;
    }
    if (!watch || Game.time - watch.last > WINDOW_RESET) {
        // `last` two ticks back so this first sighting counts as an entry.
        watch = Memory.defenseWatch[room.name] = { first: Game.time, last: Game.time - 2, entries: 0, present: 0, border: 0 };
    }
    if (watch.last !== Game.time - 1) watch.entries++;
    watch.present++;
    let deepest = 0;
    let siege = false;
    for (const hostile of hostiles) {
        deepest = Math.max(deepest, edgeDistance(hostile.pos));
        if (!siege && isSieging(hostile)) siege = true;
    }
    if (deepest <= BORDER_ZONE) watch.border++;
    watch.deep = deepest > BORDER_ZONE;
    watch.siege = siege;
    watch.last = Game.time;
    return watch;
}

// Hostiles are using the border to drain us: hold ramparts, let towers decide, spawn nothing.
function isDraining(roomName) {
    const watch = Memory.defenseWatch && Memory.defenseWatch[roomName];
    if (!watch || watch.deep || watch.siege) return false;
    if (Game.time - watch.last > QUIET_TICKS) return false;
    if (watch.border < watch.present * BORDER_RATIO) return false;
    return watch.entries >= MIN_ENTRIES || watch.present >= MIN_LOITER;
}

// A hostile is in the room right now and is past the border zone or damaging structures.
// Needs no bounce history, so it applies from the first sighting. False while the room is
// empty (e.g. the tick a bouncer is outside being healed).
function hasInnerHostile(roomName) {
    const watch = Memory.defenseWatch && Memory.defenseWatch[roomName];
    return !!watch && watch.last === Game.time && (watch.deep || watch.siege);
}

// No hostile seen for the quiet period (true if never seen).
function isQuiet(roomName) {
    const watch = Memory.defenseWatch && Memory.defenseWatch[roomName];
    return !watch || Game.time - watch.last >= QUIET_TICKS;
}

module.exports = { BORDER_ZONE, QUIET_TICKS, edgeDistance, isSieging, update, isDraining, hasInnerHostile, isQuiet };
