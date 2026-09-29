// runtime.metrics — Screeps tick subsystem.
const { DisplayBoostTotals } = require('system.visuals');

function updateCPUAverages() {
    //Total Usage - only track overall CPU usage
    Memory.CPUAverages.TotalCPU.ticks = Memory.CPUAverages.TotalCPU.ticks + 1;
    var totalCPU = Game.cpu.getUsed();
    Memory.CPUAverages.TotalCPU.CPU = Memory.CPUAverages.TotalCPU.CPU + ((totalCPU - Memory.CPUAverages.TotalCPU.CPU) / Memory.CPUAverages.TotalCPU.ticks);
}

function cleanupTickMemory() {
    //Clear observe tick, rooms have been checked.
    if (Memory.postObserveTick && Game.time % 20 != 0) {
        Memory.postObserveTick = false;
    }

    //Display War Boosts/Upgrade Boosts/Lowest Minerals
    DisplayBoostTotals();
}

// No per-phase CPU reads unless requested. Keep bounded aggregates in Memory.
function runPhases(phases) {
    if (!require('runtime.config').profilingEnabled()) {
        for (const phase of phases) phase[1]();
        return;
    }
    if (!Memory.phaseCPU) Memory.phaseCPU = {};
    for (const [name, run] of phases) {
        const start = Game.cpu.getUsed();
        run();
        const used = Game.cpu.getUsed() - start;
        const metric = Memory.phaseCPU[name] || (Memory.phaseCPU[name] = { ticks: 0, average: 0, max: 0 });
        metric.ticks++;
        metric.average += (used - metric.average) / metric.ticks;
        metric.max = Math.max(metric.max, used);
    }
}
module.exports = { updateCPUAverages, cleanupTickMemory, runPhases };
