const runtimeCache = require('runtime.cache');
// system.observers — Screeps tick subsystem.
const { getEnergyIndex } = require('spawn.state');
const { getRoomAtOffset } = require('util.common');
const spawn_BuildInstruction = require('spawn.BuildInstruction');
const remoteMining = require('system.remoteMining');
const governor = require('runtime.cpuGovernor');
const essentials = require('spawn.essentials');
const badRooms = require('system.badRooms');

function handleRoomOperations(thisRoom) {
    const roomName = thisRoom.name;

    // Initialize observation pointers if they don't exist
    if (!Memory.observationPointers[roomName]) {
        Memory.observationPointers[roomName] = [-2, -2, getRoomAtOffset(-2, -2, roomName)];
    }

    // Cache commonly used values
    const observationPointer = Memory.observationPointers[roomName];
    const observedRoomName = observationPointer[2];
    const observedRoom = Game.rooms[observedRoomName];

    // Handle observer operations - only process if we have vision of the observed room
    if (Memory.postObserveTick && observedRoom) {
        handleObservedRoomOperations(thisRoom, observedRoom, roomName, observedRoomName);
        updateObservationPointer(roomName, observationPointer);
    }

    // Get observer list if not initialized or periodically refresh
    if ((Game.time % 5000 === 0 || !Memory.observerList[roomName] || (Game.time % 50 === 0 && Memory.observerList[roomName].length === 0))) {
        updateObserverList(thisRoom, roomName);
    }

    // Operate observers every 20 ticks
    if (Game.time % 20 === 0 && observationPointer && Memory.observerList[roomName] && Memory.observerList[roomName].length > 0) {
        // A disabled remote due its safety check takes priority over the normal sweep.
        // ...then a claimed room nobody has looked at for a while (system.badRooms).
        operateObserver(roomName, remoteMining.observeRequest(roomName) || badRooms.observeRequest(roomName) || observedRoomName);
    }

    // Monitor for power creep operators and respawn if needed
    if (Game.time % 100 === 0 && Game.flags[roomName + "RoomOperator"] && Memory.powerSpawnList[roomName] && Memory.powerSpawnList[roomName].length > 0) {
        handlePowerCreepRespawn(thisRoom, roomName);
    }
}

function handleObservedRoomOperations(thisRoom, observedRoom, roomName, observedRoomName) {
    badRooms.record(observedRoom);
    // Feed remote-mining intel (sources, owner, reservation) from every observer sweep.
    remoteMining.recordIntel(observedRoom);

    // Handle power bank operations
    handlePowerBankOperations(thisRoom, observedRoom, roomName);

    // Handle resource deposit operations
    handleResourceDepositOperations(thisRoom, observedRoom, roomName, observedRoomName);

    // Handle harasser operations for reserved controllers
    handleHarasserOperations(thisRoom, observedRoom, roomName, observedRoomName);
}

function handlePowerBankOperations(thisRoom, observedRoom, roomName) {
    const powerAttackFlag = Game.flags[roomName + "PowerAttack"];

    if (powerAttackFlag && Game.rooms[powerAttackFlag.pos.roomName]) {
        // Check if existing power bank flag is still valid
        const powerBanks = Game.rooms[powerAttackFlag.pos.roomName].find(FIND_STRUCTURES, {
            filter: { structureType: STRUCTURE_POWER_BANK }
        });
        if (!powerBanks.length) {
            powerAttackFlag.remove();
        }
    } else if (thisRoom.storage && (!thisRoom.storage.store[RESOURCE_POWER] || thisRoom.storage.store[RESOURCE_POWER] <= 200000)) {
        // Search for new power banks in observed room
        const powerBanks = runtimeCache.find(observedRoom, FIND_STRUCTURES, {
            filter: (struct) => struct.structureType === STRUCTURE_POWER_BANK && struct.ticksToDecay >= 4500
        });
        if (powerBanks.length > 0) {
            const powerBank = powerBanks[0];
            observedRoom.createFlag(powerBank.pos.x, powerBank.pos.y, roomName + "PowerAttack");
            // Rivals contested one of this room's banks recently: send the escort with the first
            // wave instead of after they show up (the ranger spawns before the attackers).
            const lastContested = Memory.powerContested && Memory.powerContested[roomName];
            if (lastContested && Game.time - lastContested < 20000 && !Game.flags[roomName + "PowerGuard"]) {
                observedRoom.createFlag(25, 25, roomName + "PowerGuard");
            }
        }
    }
}

function handleResourceDepositOperations(thisRoom, observedRoom, roomName, observedRoomName) {
    const deposits = runtimeCache.find(observedRoom, FIND_DEPOSITS, {
        filter: (deposit) => deposit.lastCooldown < 28
    });

    if (deposits.length === 0 || !thisRoom.terminal) return;

    const deposit = deposits[0];
    const depositType = deposit.depositType;

    // Check terminal capacity for this resource type (cap: 5,000)
    if (thisRoom.terminal.store[depositType] && thisRoom.terminal.store[depositType] >= 5000) return;

    // Check if any existing mineral flags target this room
    const mineralFlags = [
        roomName + "FarMineral",
        roomName + "FarMineral2",
        roomName + "FarMineral3"
    ];

    const hasExistingFlag = mineralFlags.some(flagName => {
        const flag = Game.flags[flagName];
        return flag && flag.pos.roomName === observedRoomName;
    });

    if (!hasExistingFlag) {
        // Find the first available mineral flag slot
        for (const flagName of mineralFlags) {
            if (!Game.flags[flagName]) {
                observedRoom.createFlag(deposit.pos.x, deposit.pos.y, flagName);
                break;
            }
        }
    }
}

function updateObservationPointer(roomName, observationPointer) {
    let [xPointer, yPointer] = observationPointer;

    if (xPointer >= 2) {
        xPointer = -2;
        yPointer = yPointer >= 2 ? -2 : yPointer + 1;
    } else {
        xPointer += 1;
    }

    Memory.observationPointers[roomName] = [xPointer, yPointer, getRoomAtOffset(xPointer, yPointer, roomName)];
}

function handleHarasserOperations(thisRoom, observedRoom, roomName, observedRoomName) {
    // Check if the observed room has a controller that is reserved by a non-whitelisted player
    if (!observedRoom.controller) return;

    const controller = observedRoom.controller;

    // Check if controller is reserved and by a non-whitelisted player
    // Exclude reservations by Montblanc (player) and Invader (NPC)
    if (controller.reservation &&
        controller.reservation.username &&
        !Memory.whiteList.includes(controller.reservation.username) &&
        controller.reservation.username !== 'Montblanc' &&
        controller.reservation.username !== 'Invader') {

        // Check if there's already a harasser in that room
        const existingHarasser = _.find(runtimeCache.homeCreeps(roomName), (creep) =>
            creep.memory.priority === 'harasser' &&
            creep.memory.destination === observedRoomName &&
            creep.memory.homeRoom === roomName
        );

        // Also check if there's already a harasser in the observed room
        const harasserInRoom = runtimeCache.find(observedRoom, FIND_MY_CREEPS, {
            filter: (creep) => creep.memory.priority === 'harasser'
        });

        // Never while the home room is missing its refill/supplier/miner creeps.
        if (!existingHarasser && harasserInRoom.length === 0 && governor.allows('harasser') && essentials.ok(thisRoom)) {
            // Spawn a harasser to disrupt the reservation
            const spawns = runtimeCache.find(thisRoom, FIND_MY_STRUCTURES, {
                filter: { structureType: STRUCTURE_SPAWN }
            });

            if (spawns.length > 0) {
                const spawn = spawns[0];
                const energyIndex = getEnergyIndex(thisRoom);

                // Use spawn instruction to create harasser
                spawn_BuildInstruction.run(spawn, 'harasser', observedRoomName, energyIndex, roomName);

                console.log(`Observer detected reserved controller in ${observedRoomName} by ${controller.reservation.username}, spawning harasser from ${roomName}`);
            }
        }
    }
}

function updateObserverList(thisRoom, roomName) {
    Memory.observerList[roomName] = [];
    const observers = runtimeCache.find(thisRoom, FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_OBSERVER }
    });

    if (observers.length > 0) {
        Memory.observerList[roomName].push(observers[0].id);
    }
}

function operateObserver(roomName, observedRoomName) {
    const observerId = Memory.observerList[roomName][0];
    const observer = Game.getObjectById(observerId);

    if (observer) {
        observer.observeRoom(observedRoomName);
        if (!Memory.postObserveTick) {
            Memory.postObserveTick = true;
        }
    }
}

function handlePowerCreepRespawn(thisRoom, roomName) {
    const powerCreepsInRoom = runtimeCache.find(thisRoom, FIND_MY_POWER_CREEPS);

    if (powerCreepsInRoom.length === 0) {
        // Find power creep assigned to this room and respawn it
        for (const pName in Game.powerCreeps) {
            const powerCreep = Game.powerCreeps[pName];
            if (powerCreep.memory.homeRoom === roomName) {
                const powerSpawnId = Memory.powerSpawnList[roomName][0];
                const powerSpawn = Game.getObjectById(powerSpawnId);
                if (powerSpawn) {
                    powerCreep.spawn(powerSpawn);
                }
                break;
            }
        }
    }
}

module.exports = { handleRoomOperations, handleObservedRoomOperations, handlePowerBankOperations, handleResourceDepositOperations, updateObservationPointer, handleHarasserOperations, updateObserverList, operateObserver, handlePowerCreepRespawn };
