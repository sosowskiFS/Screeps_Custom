const runtimeCache = require('runtime.cache');
// system.flags â€” Screeps tick subsystem.
const { memCheck } = require('runtime.memory');
const tool_generateBase = require('tool.generateBase');
const baseBuilder = require('base.builder');
const roomCpu = require('runtime.roomCpu');

function handleGameFlags() {
    // Cache flags to avoid repeated Game.flags lookups
    const flags = Game.flags;
    const checkMemoryFlag = flags["CheckMemory"];
    const attackFlag = flags["AttackFlags"];
    const rAttackFlag = flags["RAttackFlags"];
    const dAttackFlag = flags["DAttackFlags"];
    const initAutoBuildFlag = flags["InitAutoBuild"];
    const addAutobuildFlag = flags["AddAutobuildRoom"];
    const removeAutobuildFlag = flags["RemoveAutobuildRoom"];
    const removeMineralFlag = flags["RemoveMineralFlags"];
    const wipeRoomFlag = flags["WipeRoomBuildings"];
    const spawnOperatorFlag = flags["SpawnOperator"];
    const resetAveragesFlag = flags["ResetAverages"];
    const resetAttackFlag = flags["ResetAttackFlags"];
    const removeSitesFlag = flags["RemoveSites"];
    const toggleWarFlag = flags["ToggleWar"];
    const resetLinksFlag = flags["resetLinks"];

    //Set defaults on various memory values
    if (Game.time % 10000 == 0 || checkMemoryFlag) {
        memCheck();
        if (checkMemoryFlag) {
            checkMemoryFlag.remove();
        }
    }

    if (attackFlag) {
        const room = attackFlag.room;
        room.createFlag(attackFlag.pos, room.name + "RallyHere");
        room.createFlag(2, 16, room.name + "DoBoost");
        room.createFlag(2, 18, room.name + "WarBoosts");
        room.createFlag(2, 20, room.name + "MeleeStyle");
        attackFlag.remove();
    }

    if (rAttackFlag) {
        const room = rAttackFlag.room;
        room.createFlag(rAttackFlag.pos, room.name + "RallyHere");
        room.createFlag(2, 16, room.name + "DoBoost");
        room.createFlag(2, 18, room.name + "WarBoosts");
        room.createFlag(2, 20, room.name + "RangedStyle");
        rAttackFlag.remove();
    }

    if (dAttackFlag) {
        const room = dAttackFlag.room;
        room.createFlag(dAttackFlag.pos, room.name + "RallyHere");
        room.createFlag(2, 16, room.name + "DoBoost");
        room.createFlag(2, 18, room.name + "WarBoosts");
        room.createFlag(2, 20, room.name + "DisassembleStyle");
        dAttackFlag.remove();
    }

    if (initAutoBuildFlag) {
        // Initialize autoBuild process for this room
        const room = initAutoBuildFlag.room;
        console.log(`Initializing autoBuild for room ${room.name}`);

        // Run the base generation tool to find suitable space and generate initial structures
        tool_generateBase.run(room);

        // The room will be automatically added to Memory.autoBuildRooms by the tool if suitable space is found
        initAutoBuildFlag.remove();
    }

    if (addAutobuildFlag) {
        // Opt back in to automatic layout (every room is in by default).
        if (Memory.baseBuildOff) delete Memory.baseBuildOff[addAutobuildFlag.room.name];
        if (Memory.autoBuildRooms.indexOf(addAutobuildFlag.room.name) == -1) {
            Memory.autoBuildRooms.push(addAutobuildFlag.room.name)
        }
        addAutobuildFlag.remove();
    }

    if (removeAutobuildFlag) {
        // Opt this room out of automatic layout.
        baseBuilder.optOut(removeAutobuildFlag.room.name);
        if (Memory.autoBuildRooms.indexOf(removeAutobuildFlag.room.name) != -1) {
            var thisRoomIndex = Memory.autoBuildRooms.indexOf(removeAutobuildFlag.room.name)
            Memory.autoBuildRooms.splice(thisRoomIndex, 1);
        }
        removeAutobuildFlag.remove();
    }

    if (removeMineralFlag) {
        //Clear all production flags for replacing
        RemoveMineralFlags();
        removeMineralFlag.remove();
    }

    if (wipeRoomFlag) {
        //Delete all of this room's controlled structures (for autobuild purposes)
        var allStruct = runtimeCache.find(wipeRoomFlag.room, FIND_STRUCTURES);
        for (var n = 0; n < allStruct.length; n++) {
            allStruct[n].destroy();
        }
        wipeRoomFlag.remove();
    }

    if (spawnOperatorFlag) {
        let foundOne = false;
        for (let pName in Game.powerCreeps) {
            if (!Game.powerCreeps[pName].shard && Game.powerCreeps[pName].className == POWER_CLASS.OPERATOR && !Game.powerCreeps[pName].memory.priority) {
                //This is an unspawned pCreep
                if (Memory.powerSpawnList[spawnOperatorFlag.room.name].length > 0) {
                    Game.powerCreeps[pName].spawn(Game.getObjectById(Memory.powerSpawnList[spawnOperatorFlag.room.name][0]));
                    Game.powerCreeps[pName].memory.priority = 'baseOp';
                    spawnOperatorFlag.remove();
                    foundOne = true;
                } else {
                    console.log("Error: No power spawn in requested room");
                }
                break;
            }
        }
        if (!foundOne) {
            spawnOperatorFlag.remove();
            console.log("Error: No free operators");
        }
    }

    //Reset average CPU usage records on request
    if (resetAveragesFlag || Memory.CPUAverages.TotalCPU.ticks >= 50000) {
        Memory.CPUAverages = new Object();
        Memory.CPUAverages.TotalCPU = new Object();
        Memory.CPUAverages.TotalCPU.ticks = 0;
        Memory.CPUAverages.TotalCPU.CPU = 0;
        Memory.CPUAverages.CreepCPU = new Object();
        Memory.CPUAverages.CreepCPU.ticks = 0;
        Memory.CPUAverages.CreepCPU.CPU = 0;
        Memory.CPUAverages.RemoteMiningCPU = new Object();
        Memory.CPUAverages.RemoteMiningCPU.ticks = 0;
        Memory.CPUAverages.RemoteMiningCPU.CPU = 0;
        Memory.CPUAverages.Pre5CPU = new Object();
        Memory.CPUAverages.Pre5CPU.ticks = 0;
        Memory.CPUAverages.Pre5CPU.CPU = 0;
        Memory.CPUAverages.Post5CPU = new Object();
        Memory.CPUAverages.Post5CPU.ticks = 0;
        Memory.CPUAverages.Post5CPU.CPU = 0;
        Memory.CPUAverages.SpawnCPU = new Object();
        Memory.CPUAverages.SpawnCPU.ticks = 0;
        Memory.CPUAverages.SpawnCPU.CPU = 0;
        if (resetAveragesFlag) {
            roomCpu.reset(); // ResetAverages also clears the per-room averages
            resetAveragesFlag.remove();
        }
    }

    if (resetAttackFlag) {
        Memory.roomsUnderAttack = [];
        Memory.attackDuration = 0;
        resetAttackFlag.remove();
    }

    //Clean up crappy construction sites
    //--Only clears roads.
    if (removeSitesFlag) {
        for (var s in Game.constructionSites) {
            if (Game.constructionSites[s].structureType == STRUCTURE_ROAD) {
                Game.constructionSites[s].remove();
            }
        }
        removeSitesFlag.remove();
    }

    // Handle toggle war separately in initializeGameState where it's already checked
    if (toggleWarFlag) {
        Memory.warMode = !Memory.warMode;
        toggleWarFlag.remove();
    }

    // Reset link lists and force update next tick
    if (resetLinksFlag) {
        Memory.linkList = {};
        console.log('Link lists have been wiped. Structure lists will be rebuilt next tick.');
        resetLinksFlag.remove();
    }

    // VisualizeBase: base.builder draws the room's plan (cheap; previews rooms not yet owned).
}

function checkTimedOutFlags() {
    for (let TF in Game.flags) {
        if (Game.flags[TF].name && Game.flags[TF].name.includes(';')) {
            let splitList = Game.flags[TF].name.split(';');
            if (splitList.length > 1) {
                let timeToCheck = splitList[1];
                if (Game.time >= parseInt(timeToCheck)) {
                    try {
                        Game.flags[TF].pos.createFlag(splitList[0]);
                        Game.flags[TF].remove();
                    } catch (error) {
                        if (Memory.FarRoomsUnderAttack.indexOf(Game.flags[TF].pos.roomName) == -1) {
                            Memory.FarRoomsUnderAttack.push(Game.flags[TF].pos.roomName);
                        }
                        Game.notify('Could not create flag ' + splitList[0] + '.');
                    }
                }
            }
        }
    }
}

function RemoveMineralFlags() {
    //Loop through all rooms, remove production flags
    //Game.rooms is all visible rooms, only need home rooms
    const flags = Game.flags;
    for (let j in Game.spawns) {
        let thisRoom = Game.spawns[j].room;
        const roomName = thisRoom.name;

        // Check all possible producer flags for this room
        const producerFlags = [
            roomName + "XGHO2Producer", roomName + "XGH2OProducer", roomName + "XUH2OProducer",
            roomName + "XZHO2Producer", roomName + "XZH2OProducer", roomName + "XKHO2Producer",
            roomName + "XLH2OProducer", roomName + "XLHO2Producer", roomName + "OHProducer(3)",
            roomName + "GProducer(4)", roomName + "GHO2Producer", roomName + "GH2OProducer",
            roomName + "ZHO2Producer", roomName + "ZH2OProducer", roomName + "KHO2Producer",
            roomName + "UH2OProducer", roomName + "LH2OProducer", roomName + "LHO2Producer",
            roomName + "UHProducer", roomName + "GHProducer", roomName + "GOProducer",
            roomName + "KOProducer", roomName + "ZHProducer", roomName + "ZOProducer",
            roomName + "LOProducer", roomName + "LHProducer", roomName + "ULProducer",
            roomName + "ZKProducer", roomName + "GProducer(9)", roomName + "OHProducer(9)"
        ];

        for (let flagName of producerFlags) {
            const flag = flags[flagName];
            if (flag) {
                flag.remove();
                break; // Only one flag per room, so we can break early
            }
        }
    }
}

module.exports = { handleGameFlags, checkTimedOutFlags, RemoveMineralFlags };
