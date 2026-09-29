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
const metrics = require('runtime.metrics');

const phases = [
    ['flags', flags.handleGameFlags],
    ['state', state.initializeGameState],
    ['defense', defense.handleTowersAndRooms],
    ['spawningAndRooms', spawning.handleSpawning],
    ['market', market.handleMarketOperations],
    ['creeps', creeps.handleCreepOperations],
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
    if (Game.cpu.bucket >= 9000) Game.cpu.generatePixel();
    metrics.cleanupTickMemory();
    metrics.updateCPUAverages();
};
