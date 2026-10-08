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
const labs = require('system.labs');
const construction = require('system.construction');
const remoteMining = require('system.remoteMining');
const roads = require('system.roads');
const badRooms = require('system.badRooms');
const expansion = require('system.expansion');
const retire = require('system.retire');
const powerCreeps = require('system.powerCreeps');
const shardX = require('system.shardX');
const memoryCleanup = require('runtime.memoryCleanup');
const metrics = require('runtime.metrics');
const governor = require('runtime.cpuGovernor');
const heapMemory = require('runtime.heapMemory');
require('runtime.console');   // console commands: mem(), roomReport()

const phases = [
    ['flags', flags.handleGameFlags],
    ['state', state.initializeGameState],
    ['defense', defense.handleTowersAndRooms],
    ['spawningAndRooms', spawning.handleSpawning],
    ['market', market.handleMarketOperations],
    ['shardX', shardX.run],   // before creeps: creeps arriving on shardX get their memory first
    ['creeps', creeps.handleCreepOperations],
    ['remoteMining', remoteMining.run],
    ['minerals', labs.run],
    ['construction', construction.handleAutoBuildRoomsRegeneration],
    ['roads', roads.run],
    ['badRooms', badRooms.update],
    ['expansion', expansion.run],
    ['retire', retire.run],
    ['powerCreeps', powerCreeps.run],
    ['memoryCleanup', memoryCleanup.run],
];
module.exports.loop = function () {
    memory.ensureInitialized();
    heapMemory.attach();   // rebuildable caches live in heap only (runtime.heapMemory)
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
    heapMemory.detach();
};
