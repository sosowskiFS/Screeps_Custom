// runtime.roomCpu — per-room CPU attribution.
//
// Work is charged to the room that "owns" it:
//   * creeps and power creeps  -> memory.homeRoom (remote miners count toward their base)
//   * towers and defence       -> the tower's room
//   * spawns + room management -> the spawn's room (links, labs, power spawn, factory, nuker,
//                                 observer, terminal market, spawn logic)
//   * base auto-build          -> the room being built
// Shared work (flags, empire state, account market, visuals, Memory parsing) stays unattributed;
// the shard-wide TotalCPU average still covers it.
//
// Measurement chains one Game.cpu.getUsed() per item: each reading ends the previous item and
// starts the next. Averages live in Memory.roomCPU[room] = { a: average, n: samples, l: last tick
// charged }: a plain mean for the first WINDOW samples, then an exponential average over ~WINDOW
// ticks, so it follows changes without unbounded counters.
const WINDOW = 500;
const FORGET_TICKS = 10000;

const tick = { time: -1, usage: Object.create(null) };

function enabled() {
    return !Memory.settings || Memory.settings.roomCpu !== false;
}

function usage() {
    if (tick.time !== Game.time) {
        tick.time = Game.time;
        tick.usage = Object.create(null);
    }
    return tick.usage;
}

function charge(roomName, cpu) {
    if (!roomName || !(cpu > 0)) return;
    const current = usage();
    current[roomName] = (current[roomName] || 0) + cpu;
}

// Chained timer: const t = timer(); ...work for A...; t.lap('A'); ...work for B...; t.lap('B')
// Returns a no-op timer when tracking is disabled, so callers need no branches.
const NOOP = { lap() {} };
function timer() {
    if (!enabled()) return NOOP;
    let last = Game.cpu.getUsed();
    return {
        lap(roomName) {
            const now = Game.cpu.getUsed();
            charge(roomName, now - last);
            last = now;
        },
    };
}

// End of tick: fold this tick's usage into each room's average. Rooms that used nothing this
// tick (e.g. every creep still spawning) still get a zero sample so their average stays honest.
function updateAverages() {
    if (!enabled()) return;
    const current = usage();
    const store = Memory.roomCPU || (Memory.roomCPU = {});
    for (const roomName in current) {
        if (!store[roomName]) store[roomName] = { a: 0, n: 0, l: Game.time };
    }
    for (const roomName in store) {
        const entry = store[roomName];
        const used = current[roomName] || 0;
        if (used > 0) entry.l = Game.time;
        else if (Game.time - entry.l > FORGET_TICKS) {
            delete store[roomName]; // lost or abandoned room
            continue;
        }
        entry.n = Math.min(entry.n + 1, WINDOW);
        entry.a = Math.round((entry.a + (used - entry.a) / entry.n) * 10000) / 10000;
    }
}

function average(roomName) {
    const entry = Memory.roomCPU && Memory.roomCPU[roomName];
    return entry ? entry.a : 0;
}

function reset() {
    delete Memory.roomCPU;
}

module.exports = { enabled, charge, timer, updateAverages, average, reset, WINDOW };
