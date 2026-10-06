// Tick orchestration only. Subsystems own policy; runtime modules own shared data.
require('traveler');
const memory = require('runtime.memory');
const spawnState = require('spawn.state');
const flags = require('system.flags');
const state = require('system.state');
const defense = require('system.defense');
const spawning = require('system.spawning');
const market = require('system.market');
const creeps = require('system.creeps');
const minerals = require('system.minerals');
const construction = require('system.construction');
const remoteMining = require('system.remoteMining');
const metrics = require('runtime.metrics');
const governor = require('runtime.cpuGovernor');

const phases = [
    ['flags', flags.handleGameFlags],
    ['state', state.initializeGameState],
    ['defense', defense.handleTowersAndRooms],
    ['spawningAndRooms', spawning.handleSpawning],
    ['market', market.handleMarketOperations],
    ['creeps', creeps.handleCreepOperations],
    ['remoteMining', remoteMining.run],
    ['minerals', minerals.handleMineralFlagDistribution],
    ['construction', construction.handleAutoBuildRoomsRegeneration],
];
module.exports.loop = function () {
    memory.ensureInitialized();
    // Reinitialize scratch accounting even if the previous tick exhausted CPU.
    Memory.RoomsRun = [];
    Memory.NoSpawnNeeded = [];
    Memory.CurrentRoomEnergy = [];
    spawnState.initializeSpawnTracking();
    memory.cleanupCreepMemory();
    spawnState.cleanupSpawnTracking();
    market.handleCPUUnlocking();
    metrics.runPhases(phases);
    // Only with a full bucket, nothing shed, CPU comfortably under the limit and no fight on.
    governor.maybeGeneratePixel();
    metrics.cleanupTickMemory();
    metrics.updateCPUAverages();
};
