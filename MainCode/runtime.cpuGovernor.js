// runtime.cpuGovernor — one feedback loop deciding how much optional work to shed.
//
// It steers on *average CPU vs. the limit*, not on the bucket level: a low bucket right after
// a pixel is generated is expected and harmless while average usage stays under the limit.
//
//   ema   ~100-tick moving average of CPU used per tick (updated at the end of each tick)
//   shed  0..3, adjusted at most one step every ADJUST_EVERY ticks (no flip-flopping):
//           +1 while the average is over the limit (the bucket is draining)
//           -1 once the average is below 90% of the limit
//         Emergency: bucket under EMERGENCY_BUCKET without a recent pixel -> straight to 3.
//
// Creeps are tiered (creep.registry):
//   essential  always runs (spawn energy, towers, defenders, miners, upgraders, SK/combat roles)
//   economy    remote income: thinned only at shed >= 2
//   optional   repairers, lab worker, scrapers, salvagers, controller supplier, patrols: thinned from shed 1
// Thinned creeps run on a fixed share of ticks, staggered by name so the saving is spread evenly
// across ticks instead of every creep skipping the same odd ticks.
//
// Optional features are gated by shed level (see FEATURES). Pixels are generated only with a
// full bucket, nothing shed, average comfortably under the limit and no room under attack.
const ADJUST_EVERY = 100;
const EMA_TICKS = 100;
const EMERGENCY_BUCKET = 500;
const PIXEL_RECOVERY = 2000;   // ticks after a pixel during which a low bucket is expected
const PIXEL_HEADROOM = 0.9;    // generate pixels only when averaging under 90% of the limit
const SPIKE_BUCKET = 1000;     // spiky optional work (path-heavy planning) waits for this much

// Run slots out of 4 ticks for each tier at each shed level.
const RUN_SLOTS = {
    essential: [4, 4, 4, 4],
    economy:   [4, 4, 3, 2],
    optional:  [4, 3, 2, 1],
};

// Highest shed level at which a feature still runs.
const FEATURES = {
    roads: 0,            // creeps placing road construction sites while walking
    excessScans: 0,      // remote haulers re-scanning for containers every tick
    scouting: 1,         // remote-mining scouts
    harasser: 1,         // observer-triggered harasser spawns
    planning: 1,         // remote-mining source planning (path searches)
    remoteSpawning: 2,   // far miner/mule/claimer/guard spawning
};
// Path-heavy features also wait for a minimal bucket so a spike cannot exceed the tick limit.
const SPIKY = new Set(['planning', 'scouting']);

function state() {
    return Memory.cpuGov || (Memory.cpuGov = { ema: 0, shed: 0, adjusted: 0, pixel: 0 });
}

function recentPixel(gov) {
    return gov.pixel > 0 && Game.time - gov.pixel < PIXEL_RECOVERY;
}

// End of tick: feed in this tick's CPU and adjust the shed level.
function update(usedThisTick) {
    const gov = state();
    const limit = Game.cpu.limit;
    gov.ema = gov.ema > 0 ? gov.ema + (usedThisTick - gov.ema) / EMA_TICKS : usedThisTick;
    gov.ema = Math.round(gov.ema * 1000) / 1000;

    const bucket = Game.cpu.bucket;
    const expectedLow = recentPixel(gov) && gov.ema < limit;
    if (bucket < EMERGENCY_BUCKET && !expectedLow) {
        if (gov.shed < 3) {
            gov.shed = 3;
            gov.adjusted = Game.time;
        }
        return;
    }
    if (Game.time - gov.adjusted < ADJUST_EVERY) return;
    if (gov.ema > limit && gov.shed < 3) {
        gov.shed++;
        gov.adjusted = Game.time;
    } else if (gov.ema < limit * 0.9 && gov.shed > 0) {
        gov.shed--;
        gov.adjusted = Game.time;
    }
}

function shedLevel() {
    return state().shed;
}

function allows(feature) {
    const gov = state();
    if (gov.shed > FEATURES[feature]) return false;
    return !(SPIKY.has(feature) && Game.cpu.bucket < SPIKE_BUCKET);
}

function nameSlot(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i)) & 0xffff;
    return hash;
}

// Whether a creep of this tier runs this tick. Stagger by name so each tick sheds about the same.
function shouldRun(name, tier) {
    const slots = (RUN_SLOTS[tier] || RUN_SLOTS.essential)[state().shed];
    if (slots >= 4) return true;
    return (Game.time + nameSlot(name)) % 4 < slots;
}

function maybeGeneratePixel() {
    if (typeof Game.cpu.generatePixel !== 'function') return;
    const cost = typeof PIXEL_CPU_COST !== 'undefined' ? PIXEL_CPU_COST : 10000;
    if (Game.cpu.bucket < cost) return;
    const gov = state();
    if (gov.shed > 0 || gov.ema > Game.cpu.limit * PIXEL_HEADROOM) return;
    if (Memory.roomsUnderAttack && Memory.roomsUnderAttack.length) return; // keep the buffer for defence
    if (Game.cpu.generatePixel() === OK) {
        gov.pixel = Game.time;
    }
}

module.exports = { update, shedLevel, allows, shouldRun, maybeGeneratePixel, RUN_SLOTS, FEATURES };
