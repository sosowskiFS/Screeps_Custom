const runtimeCache = require('runtime.cache');
// system.spawning — Screeps tick subsystem.
const { isSpawnBusy, handleSpawnEnergyTracking, getEnergyIndex } = require('spawn.state');
const { processRoomManagement } = require('system.rooms');
const spawn_BuildCreeps = require('spawn.BuildCreeps');
const spawn_BuildCreeps5 = require('spawn.BuildCreeps5');
const spawn_BuildInstruction = require('spawn.BuildInstruction');
const spawn_BuildFarCreeps = require('spawn.BuildFarCreeps');
const remoteMining = require('system.remoteMining');
const roomCpu = require('runtime.roomCpu');
const governor = require('runtime.cpuGovernor');
const maintenance = require('system.maintenance');
const bestWorkerConfig = [WORK, CARRY, MOVE, MOVE];

function handleSpawning() {
    const spawnRoleCache = null; // Build census only on ticks when a spawn can act.
    const roomSpawnCache = {};

    for (const spawnName in Game.spawns) {
        const roomName = Game.spawns[spawnName].room.name;
        if (!roomSpawnCache[roomName]) {
            roomSpawnCache[roomName] = [];
        }
        roomSpawnCache[roomName].push(Game.spawns[spawnName]);
    }

    // Room management (links, labs, power spawn, factory, nuker, observer, terminal market)
    // and spawn logic are charged to the spawn's room.
    const cpu = roomCpu.timer();
    for (const i in Game.spawns) {
        processSpawn(Game.spawns[i], spawnRoleCache, roomSpawnCache);
        cpu.lap(Game.spawns[i].room.name);
    }

    processSpawningCleanup();
}

function processSpawn(spawn, spawnRoleCache, roomSpawnCache) {
    var thisRoom = spawn.room;
    if (thisRoom.controller.owner) {
        var controllerLevel = thisRoom.controller.level;

        if (Memory.RoomsRun.indexOf(thisRoom.name) < 0) {
            processRoomManagement(thisRoom);
            Memory.RoomsRun.push(thisRoom.name);
        }

        processSpawnLogic(spawn, thisRoom, spawnRoleCache);

        // Only mark room as no spawn needed if NO spawns in the room are spawning or busy
        const roomSpawns = roomSpawnCache[thisRoom.name] || [];
        const anySpawnActive = roomSpawns.some(s => s.spawning || isSpawnBusy(s));

        if (!anySpawnActive && Memory.NoSpawnNeeded.indexOf(thisRoom.name) < 0) {
            Memory.NoSpawnNeeded.push(thisRoom.name);
        }
    }
}

function processSpawnLogic(spawn, thisRoom, spawnRoleCache) {
    var delay = thisRoom.controller.level == 8 ? 15 : 10;
    if (maintenance.inMaintenance(thisRoom.name)) {
        delay = 50; // staffing barely changes in maintenance; check spawns less often
    }
    const runningAssaultFlag = Game.flags[thisRoom.name + "RunningAssault"];
    if (runningAssaultFlag) {
        delay = 3;
    }

    // Check if this specific spawn should run (don't block based on room-wide NoSpawnNeeded)
    if (Game.time % delay == 0 && spawn.isActive() && !spawn.spawning) {
        spawnRoleCache = spawnRoleCache || runtimeCache.current().spawnRoles ||
            (runtimeCache.current().spawnRoles = buildSpawnRoleCache());
        handleSpawnEnergyTracking(thisRoom);

        // Clear any completed entries for this spawn from the queue
        for (let i = Memory.creepInQue.length - 4; i >= 0; i -= 4) {
            if (Memory.creepInQue[i + 3] === spawn.name) {
                Memory.creepInQue.splice(i, 4);
            }
        }

        var energyIndex = getEnergyIndex(thisRoom);
        processSpawnCommands(spawn, thisRoom, energyIndex, spawnRoleCache);
    }
}

function processSpawnCommands(spawn, thisRoom, energyIndex, spawnRoleCache) {
    // Process various spawn commands
    processSpecialSpawnCommands(spawn, thisRoom, energyIndex, spawnRoleCache);

    // Check if this specific spawn is busy, not the global flag
    if (!isSpawnBusy(spawn)) {
        processNormalSpawning(spawn, thisRoom, energyIndex);
    }

    if (!isSpawnBusy(spawn) && thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] <= 900000 && governor.allows('remoteSpawning')) {
        processFarMiningSpawn(spawn, thisRoom, energyIndex, spawnRoleCache);
    }

    // Remote-mining intel: a 1-MOVE scout when nearby rooms are unknown/stale or a disabled
    // remote is due its safety check (homes with an observer use that instead).
    if (!isSpawnBusy(spawn) && remoteMining.needsScout(thisRoom)) {
        spawn_BuildInstruction.run(spawn, 'farScout', '', energyIndex, thisRoom.name);
    }

    // Check for highway patrol unit spawning (every 1350 ticks, energy >= 400,000)
    if (!isSpawnBusy(spawn) && thisRoom.storage && Game.time % 1350 === 0 && thisRoom.storage.store[RESOURCE_ENERGY] >= 400000) {
        spawn_BuildInstruction.run(spawn, 'highwayPatrol', '', energyIndex, thisRoom.name);
    }
}

function processSpecialSpawnCommands(spawn, thisRoom, energyIndex, spawnRoleCache) {
    const roomName = thisRoom.name;

    // Special handling for PowerAttack - check if units need spawning even when PowerPickup exists
    const powerAttackFlag = Game.flags[roomName + "PowerAttack"];
    const powerPickupFlag = Game.flags[roomName + "PowerPickup"];

    if (powerAttackFlag && powerPickupFlag) {
        // Both flags exist - check if PowerAttack units need spawning
        const powerAttackers = getRoomRoleCount(spawnRoleCache, roomName, 'powerAttack');
        const powerHealers = getRoomRoleCount(spawnRoleCache, roomName, 'powerHeal');

        // If PowerAttack units are missing, prioritize spawning them over PowerPickup
        if (powerAttackers < 1 || powerHealers < 2) {
            handleSpecificSpawnCommand(spawn, thisRoom, energyIndex, {
                flagName: roomName + "PowerAttack",
                type: 'powerAttack',
                flag: powerAttackFlag
            });
            return;
        }
    }

    const commandMap = [
        { flagName: roomName + "PowerPickup", type: 'powerPickup' }, // Top priority for power collection
        { flagName: roomName + "ClaimThis", type: 'claim' },
        { flagName: roomName + "RunningAssault", type: 'assault' },
        { flagName: roomName + "SendHelper", type: 'helper' },
        { flagName: roomName + "Ranger", type: 'ranger' },
        { flagName: roomName + "Ranger2", type: 'ranger2' },
        { flagName: roomName + "PowerGuard", type: 'PowerGuard' },
        { flagName: roomName + "PowerAttack", type: 'powerAttack' },
        { flagName: roomName + "Loot", type: 'loot' },
        { flagName: roomName + "supplyEnergy", type: 'supplyEnergy' },
        { flagName: roomName + "MineScout", type: 'farScout' }
    ];

    for (let command of commandMap) {
        const flag = Game.flags[command.flagName];
        if (flag) {
            command.flag = flag;
            handleSpecificSpawnCommand(spawn, thisRoom, energyIndex, command);
            break;
        }
    }
}

function handleSpecificSpawnCommand(spawn, thisRoom, energyIndex, command) {
    const flag = command.flag;
    let targetRoom = flag ? flag.pos.roomName : '';
    const useDefinedRouteFlag = Game.flags["UseDefinedRoute"];
    let route = useDefinedRouteFlag ? getDefinedRoute(command.type) : '';
    let extra = '';

    switch (command.type) {
        case 'assault':
            if (!flag) {
                for (let j = 2; j < 6; j++) {
                    let altFlag = Game.flags[thisRoom.name + "Assault" + j];
                    if (altFlag) {
                        targetRoom = altFlag.pos.roomName;
                        break;
                    }
                }
            }
            break;
        case 'powerPickup':
            // PowerPickup flag is in the target room where power needs to be collected
            if (flag) {
                targetRoom = flag.pos.roomName;
                // Look for power bank structures in the same room as the PowerPickup flag
                if (flag.room) {
                    var powerBanks = runtimeCache.find(flag.room, FIND_STRUCTURES, {
                        filter: { structureType: STRUCTURE_POWER_BANK }
                    });
                    if (powerBanks.length) {
                        extra = Math.ceil(powerBanks[0].power / 1650); // Mule capacity = 1650
                    } else {
                        // No power bank found, look for dropped power resources
                        var droppedPower = runtimeCache.find(flag.room, FIND_DROPPED_RESOURCES, {
                            filter: (resource) => resource.resourceType === RESOURCE_POWER
                        });
                        if (droppedPower.length) {
                            let totalPower = droppedPower.reduce((sum, drop) => sum + drop.amount, 0);
                            extra = Math.ceil(totalPower / 1650); // Mule capacity = 1650
                        } else {
                            // Look for ruins and tombstones with power
                            var powerRuins = runtimeCache.find(flag.room, FIND_RUINS, {
                                filter: (ruin) => ruin.store[RESOURCE_POWER] > 0
                            });
                            var powerTombstones = runtimeCache.find(flag.room, FIND_TOMBSTONES, {
                                filter: (tomb) => tomb.store[RESOURCE_POWER] > 0
                            });

                            let totalPowerStorage = 0;
                            powerRuins.forEach(ruin => totalPowerStorage += ruin.store[RESOURCE_POWER]);
                            powerTombstones.forEach(tomb => totalPowerStorage += tomb.store[RESOURCE_POWER]);

                            if (totalPowerStorage > 0) {
                                extra = Math.ceil(totalPowerStorage / 1650);
                            } else {
                                extra = 2; // Minimum collectors for pickup
                            }
                        }
                    }
                } else {
                    // No room vision, use default
                    extra = 3; // Default number of collectors
                }
            }
            break;
        case 'supplyEnergy':
            extra = 2;
            break;
        case 'loot':
            extra = spawn.room.name;
            break;
    }

    if (targetRoom || command.type === 'farScout') {
        spawn_BuildInstruction.run(spawn, command.type, targetRoom, energyIndex, '', extra || route);
    }
}

function getDefinedRoute(type) {
    const routes = {
        'claim': 'E50N24;E51N23',
        'helper': 'E18N43;E18N45;E18N46;E19N47;E17N47'
    };
    return routes[type] || '';
}

function processNormalSpawning(spawn, thisRoom, energyIndex) {
    const doNotBuildFlag = Game.flags["DoNotBuild"];
    if (!doNotBuildFlag) {
        if (!runtimeCache.current().roomCreeps[thisRoom.name]) {
            runtimeCache.current().roomCreeps[thisRoom.name] = runtimeCache.find(thisRoom, FIND_MY_CREEPS);
        }

        if (Memory.RoomsAt5.indexOf(thisRoom.name) == -1) {
            spawn_BuildCreeps.run(spawn, bestWorkerConfig, thisRoom, runtimeCache.current().roomCreeps[thisRoom.name], energyIndex);
        } else {
            spawn_BuildCreeps5.run(spawn, thisRoom, runtimeCache.current().roomCreeps[thisRoom.name], energyIndex);
        }
    }
}

function processFarMiningSpawn(spawn, thisRoom, energyIndex, spawnRoleCache) {
    const roomName = thisRoom.name;

    // Established RCL8 rooms run on local sources; remote mining (path-heavy) only when short.
    if (!maintenance.remoteMiningWanted(thisRoom)) {
        return;
    }

    // Block far mining creep production if storage energy exceeds 300,000
    if (thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] > 300000) {
        return; // Skip far mining creep production to reduce CPU usage
    }

    const farMiningFlags = [
        "FarMining", "FarGuard", "FarMining2", "FarMining3",
        "FarMining4", "FarMining5", "FarMining6", "FarMining7", "FarMining8"
    ];

    const hasFarMiningFlag = farMiningFlags.some(flag => Game.flags[roomName + flag]);

    if (hasFarMiningFlag) {
        const runningAssaultFlag = Game.flags[roomName + "RunningAssault"];
        if (runningAssaultFlag) {
            var attackers = getRoomRoleCount(spawnRoleCache, roomName, 'assattacker') + getRoomRoleCount(spawnRoleCache, roomName, 'assranger');
            var healerlessAttackers = getRoomHealerlessAssaultCount(spawnRoleCache, roomName);

            if (attackers >= 1 && healerlessAttackers === 0) {
                spawn_BuildFarCreeps.run(spawn, thisRoom, energyIndex);
            }
        } else {
            spawn_BuildFarCreeps.run(spawn, thisRoom, energyIndex);
        }
    }
}

function buildSpawnRoleCache() {
    const roleByRoom = {};
    const healerlessAssaultByRoom = {};

    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        if (!creep || !creep.memory) {
            continue;
        }

        const homeRoom = creep.memory.homeRoom;
        const role = creep.memory.priority;
        if (!homeRoom || !role) {
            continue;
        }

        if (!roleByRoom[homeRoom]) {
            roleByRoom[homeRoom] = {};
        }

        if (!roleByRoom[homeRoom][role]) {
            roleByRoom[homeRoom][role] = 0;
        }
        roleByRoom[homeRoom][role]++;

        if ((role == 'assattacker' || role == 'assranger') && !creep.memory.healerID && !creep.memory.isReserved) {
            if (!healerlessAssaultByRoom[homeRoom]) {
                healerlessAssaultByRoom[homeRoom] = 0;
            }
            healerlessAssaultByRoom[homeRoom]++;
        }
    }

    return {
        roleByRoom: roleByRoom,
        healerlessAssaultByRoom: healerlessAssaultByRoom
    };
}

function getRoomRoleCount(spawnRoleCache, roomName, roleName) {
    if (!spawnRoleCache || !spawnRoleCache.roleByRoom || !spawnRoleCache.roleByRoom[roomName]) {
        return 0;
    }
    return spawnRoleCache.roleByRoom[roomName][roleName] || 0;
}

function getRoomHealerlessAssaultCount(spawnRoleCache, roomName) {
    if (!spawnRoleCache || !spawnRoleCache.healerlessAssaultByRoom) {
        return 0;
    }
    return spawnRoleCache.healerlessAssaultByRoom[roomName] || 0;
}

function processSpawningCleanup() {
    Memory.RoomsRun = [];
    Memory.NoSpawnNeeded = [];
    Memory.CurrentRoomEnergy = [];
}

module.exports = { handleSpawning, processSpawn, processSpawnLogic, processSpawnCommands, processSpecialSpawnCommands, handleSpecificSpawnCommand, getDefinedRoute, processNormalSpawning, processFarMiningSpawn, buildSpawnRoleCache, getRoomRoleCount, getRoomHealerlessAssaultCount, processSpawningCleanup };
