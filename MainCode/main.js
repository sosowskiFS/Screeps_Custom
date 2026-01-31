//Creeps
var creep_work = require('creep.work');
var creep_workV2 = require('creep.workV2');
var creep_work5 = require('creep.work5');
var creep_salvager = require('creep.salvager');
var creep_supplier = require('creep.supplier');
var creep_upSupplier = require('creep.upsupplier');
var creep_miner = require('creep.miner');
var creep_upgrader = require('creep.upgrader');
var creep_repair = require('creep.repair');
var creep_labWorker = require('creep.labWorker');

var creep_baseOp = require('creep.baseOp');

var creep_farMining = require('creep.farMining');
var creep_farMule = require('creep.farMule');
var creep_farMiner = require('creep.farMiner');
var creep_farMinerSK = require('creep.farMinerSK');
var creep_combat = require('creep.combat');
var creep_claimer = require('creep.claimer');
var creep_vandal = require('creep.vandal');
var creep_Helper = require('creep.helper');
var creep_looter = require('creep.looter');
var creep_assattacker = require('creep.assattacker');
var creep_asshealer = require('creep.asshealer');
var creep_assranger = require('creep.assranger');
var creep_powerAttack = require('creep.powerAttack');
var creep_powerHeal = require('creep.powerHeal');
var creep_powerPickup = require('creep.powerCollect');
var creep_scraper = require('creep.scraper');
var creep_distantSupplier = require('creep.distantSupplier');
var creep_ranger = require('creep.ranger');
var creep_farScout = require('creep.farScout');
var creep_highwayPatrol = require('creep.highwayPatrol');
var creep_harasser = require('creep.harasser');

//Spawning
var spawn_BuildCreeps = require('spawn.BuildCreeps');
var spawn_BuildCreeps5 = require('spawn.BuildCreeps5');
var spawn_BuildInstruction = require('spawn.BuildInstruction');
var spawn_BuildFarCreeps = require('spawn.BuildFarCreeps');
var Traveler = require('traveler');
var bestWorkerConfig = [WORK, CARRY, MOVE, MOVE];
//var roomReference = Game.spawns['Spawn_Capital'].room;

//Base Generator
var tool_generateBase = require('tool.generateBase');

//Towers
var tower_Operate = require('tower.Operate');

//Market
var market_buyers = require('market.FindBuyers');

//const profiler = require('screeps-profiler');

//Ctrl+Alt+f to autoformat documents.

//Constants : http://support.screeps.com/hc/en-us/articles/203084991-API-Reference
//Creep calculator : http://codepen.io/findoff/full/RPmqOd/
//Profiler commands : https://github.com/gdborton/screeps-profiler
//Emoji Unicode converter : https://r12a.github.io/app-conversion/
//Traveler API : https://github.com/bonzaiferroni/Traveler/wiki/Traveler-API

global.lastMemoryTick = undefined;

// Initialize spawn tracking system if needed
function initializeSpawnTracking() {
    if (!Memory.isSpawning || typeof Memory.isSpawning !== 'object' || Array.isArray(Memory.isSpawning)) {
        Memory.isSpawning = {};
    }
}

// Spawn tracking helper functions
function setSpawnStatus(spawn, isSpawning) {
    initializeSpawnTracking();
    const roomName = spawn.room.name;
    if (!Memory.isSpawning[roomName]) {
        Memory.isSpawning[roomName] = {};
    }
    Memory.isSpawning[roomName][spawn.id] = isSpawning;
}

// Global helper function for spawn scripts to mark spawn as busy
global.setSpawnBusy = function(spawn) {
    initializeSpawnTracking();
    const roomName = spawn.room.name;
    if (!Memory.isSpawning[roomName]) {
        Memory.isSpawning[roomName] = {};
    }
    Memory.isSpawning[roomName][spawn.id] = true;
}

// Global helper function to check if spawn is busy
global.isSpawnBusy = function(spawn) {
    // Check if spawn is actually spawning or marked as busy in memory
    if (spawn.spawning) return true;
    
    initializeSpawnTracking();
    const roomName = spawn.room.name;
    return Memory.isSpawning[roomName] && Memory.isSpawning[roomName][spawn.id];
}

function isSpawnBusy(spawn) {
    // Check if spawn is actually spawning or marked as busy in memory
    if (spawn.spawning) return true;
    
    initializeSpawnTracking();
    const roomName = spawn.room.name;
    return Memory.isSpawning[roomName] && Memory.isSpawning[roomName][spawn.id];
}

function isAnySpawnBusyInRoom(roomName) {
    initializeSpawnTracking();
    if (!Memory.isSpawning[roomName]) return false;
    return Object.values(Memory.isSpawning[roomName]).some(busy => busy);
}

function getAvailableSpawnsInRoom(roomName) {
    const room = Game.rooms[roomName];
    if (!room) return [];
    
    const spawns = room.find(FIND_MY_SPAWNS);
    return spawns.filter(spawn => spawn.isActive() && !spawn.spawning && !isSpawnBusy(spawn));
}

function cleanupSpawnTracking() {
    // Initialize spawn tracking if needed
    initializeSpawnTracking();
    
    // Clean up spawn tracking for dead spawns and rooms we no longer control
    for (const roomName in Memory.isSpawning) {
        const room = Game.rooms[roomName];
        if (!room || !room.controller || !room.controller.my) {
            delete Memory.isSpawning[roomName];
            continue;
        }
        
        for (const spawnId in Memory.isSpawning[roomName]) {
            const spawn = Game.getObjectById(spawnId);
            if (!spawn) {
                // Spawn no longer exists
                delete Memory.isSpawning[roomName][spawnId];
            } else if (!spawn.spawning && Memory.isSpawning[roomName][spawnId]) {
                // Spawn is no longer actually spawning, clear the memory flag
                delete Memory.isSpawning[roomName][spawnId];
            }
        }
        
        // Remove empty room entries
        if (Object.keys(Memory.isSpawning[roomName]).length === 0) {
            delete Memory.isSpawning[roomName];
        }
    }
}

//profiler.enable();
// Main game loop
module.exports.loop = function() {
    //tryInitSameMemory();
    //profiler.wrap(function() {
    
    // Initialize spawn tracking system first
    initializeSpawnTracking();
    
    // Clean up memory for dead creeps
    cleanupCreepMemory();
    
    // Clean up spawn tracking
    cleanupSpawnTracking();
    
    // Handle CPU unlocking for shard2
    handleCPUUnlocking();
    
    // Handle various game flags and commands
    handleGameFlags();
    
    // Initialize game state and display info
    initializeGameState();
    
    // Handle towers and room operations
    handleTowersAndRooms();
    
    // Handle spawning operations
    handleSpawning();
    
    // Handle market operations
    handleMarketOperations();
    
    // Handle all creep operations
    handleCreepOperations();
    
    // Handle mineral flag distribution
    handleMineralFlagDistribution();
    
    // Handle autoBuildRooms regeneration (one room per tick)
    handleAutoBuildRoomsRegeneration();
    
    // Generate pixel if bucket is high enough
    if (Game.cpu.bucket >= 9000) {
        Game.cpu.generatePixel();
    }
    
    // Update CPU averages and cleanup - call Game.cpu.getUsed() only once here
    updateCPUAverages();
    cleanupTickMemory();
}

// Clean up memory for dead creeps
function cleanupCreepMemory() {
    for (var name in Memory.creeps) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
            //console.log('Clearing non-existing creep memory:', name);
        }
    }
}

// Handle CPU unlocking for shard2
function handleCPUUnlocking() {
    if (Game.shard.name == 'shard2') {
        let today = new Date();
        if ((Game.cpu.unlockedTime - 600000) <= today.valueOf()) {
            Game.cpu.unlock()
            
            let date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate() + ' | ' + today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
            Game.notify('CPU Token Used. ' + date);
        }
    }
}

// Handle various game flags and commands
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
    const visualizeBaseFlag = flags["VisualizeBase"];

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
		if (Memory.autoBuildRooms.indexOf(addAutobuildFlag.room.name) == -1) {
			Memory.autoBuildRooms.push(addAutobuildFlag.room.name)
		}
		addAutobuildFlag.remove();
	}

	if (removeAutobuildFlag) {	
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
		var allStruct = wipeRoomFlag.room.find(FIND_STRUCTURES);
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

    // Visualize base plan for debugging - now integrated into main generation function
    if (visualizeBaseFlag) {
        const roomName = visualizeBaseFlag.pos.roomName;
        const roomLevel = parseInt(visualizeBaseFlag.name.split('_')[1]) || 8; // Extract level from flag name or default to 8
        
        // Check if room exists and run the unified generation function
        const room = Game.rooms[roomName];
        if (room) {
            console.log(`Visualizing base plan for ${roomName} at controller level ${roomLevel}`);
            // Create a mock room with the specified controller level for visualization
            const mockRoom = {
                ...room,
                controller: {
                    ...room.controller,
                    level: roomLevel
                },
                // Ensure the find method is available for the mock room
                find: room.find.bind(room)
            };
            tool_generateBase.run(mockRoom);
        } else {
            console.log(`Cannot visualize ${roomName} - no room access. Try running the base generation tool in a room you have vision of.`);
        }
        
        // Don't remove flag automatically - let user remove it manually when done viewing
        console.log(`Base visualization complete. Remove the VisualizeBase flag to stop visualization and return to normal base generation.`);
    }
}

// Initialize game state and display info
function initializeGameState() {
    // Mineral timer countdowns
    for (var x in Memory.SKMineralTimers) {
        if (Memory.SKMineralTimers[x] > 0) {
            Memory.SKMineralTimers[x] = Memory.SKMineralTimers[x] - 1;
        }
    }

    // Check for timed out far mining flags
    if (Game.time % 250 == 0) {
        checkTimedOutFlags();
    }

    if (Game.time % 1000 == 0) {
        Memory.ordersFilled = [];
        Memory.warMode = false;
    }

    // Display general pie graphs
    displayGeneralPieGraphs();

    // Reset mineral flag totals before spawning loop
    if (Game.time % 5000 == 0) {
        resetMineralFlagCounts();
    }

    // Reset mineral totals periodically
    if (Game.time % 50 == 0) {
        resetMineralTotals();
    }

    // Maintain list of rooms at RCL5+ with storage and >=2 links infrequently
    if (Game.time % 500 == 0) {
        updateRoomsAt5List();
    }
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

function displayGeneralPieGraphs() {
    let vis = new RoomVisual();
    // GCL
    drawPie(vis, Math.round(Game.gcl.progress), Game.gcl.progressTotal, 'GCL ' + Game.gcl.level, getColourByPercentage(Game.gcl.progress / Game.gcl.progressTotal, true), 2, 0.5);
    // Bucket
    drawPie(vis, Game.cpu.bucket, 10000, 'Bucket', getColourByPercentage(Math.min(1, Game.cpu.bucket / 10000), true), 5, 0.5);
    // CPU Average
    drawPie(vis, Math.round(Memory.CPUAverages.TotalCPU.CPU * 100) / 100, Game.cpu.limit, 'Average', getColourByPercentage(Math.min(1, Memory.CPUAverages.TotalCPU.CPU / Game.cpu.limit), false), 2, 1.5);
}

function resetMineralFlagCounts() {
    for (let i = 1; i <= 9; i++) {
        Memory.flagCount[i.toString()] = 0;
    }
}

function resetMineralTotals() {
    const minerals = [
        RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM, RESOURCE_LEMERGIUM,
        RESOURCE_KEANIUM, RESOURCE_ZYNTHIUM, RESOURCE_CATALYST, RESOURCE_GHODIUM,
        RESOURCE_HYDROXIDE, RESOURCE_ZYNTHIUM_KEANITE, RESOURCE_UTRIUM_LEMERGITE,
        RESOURCE_UTRIUM_HYDRIDE, RESOURCE_UTRIUM_OXIDE, RESOURCE_KEANIUM_HYDRIDE,
        RESOURCE_KEANIUM_OXIDE, RESOURCE_LEMERGIUM_HYDRIDE, RESOURCE_LEMERGIUM_OXIDE,
        RESOURCE_ZYNTHIUM_HYDRIDE, RESOURCE_ZYNTHIUM_OXIDE, RESOURCE_GHODIUM_HYDRIDE,
        RESOURCE_GHODIUM_OXIDE, RESOURCE_UTRIUM_ACID, RESOURCE_UTRIUM_ALKALIDE,
        RESOURCE_KEANIUM_ACID, RESOURCE_KEANIUM_ALKALIDE, RESOURCE_LEMERGIUM_ACID,
        RESOURCE_LEMERGIUM_ALKALIDE, RESOURCE_ZYNTHIUM_ACID, RESOURCE_ZYNTHIUM_ALKALIDE,
        RESOURCE_GHODIUM_ACID, RESOURCE_GHODIUM_ALKALIDE, RESOURCE_CATALYZED_UTRIUM_ACID,
        RESOURCE_CATALYZED_UTRIUM_ALKALIDE, RESOURCE_CATALYZED_KEANIUM_ACID,
        RESOURCE_CATALYZED_KEANIUM_ALKALIDE, RESOURCE_CATALYZED_LEMERGIUM_ACID,
        RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE, RESOURCE_CATALYZED_ZYNTHIUM_ACID,
        RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE, RESOURCE_CATALYZED_GHODIUM_ACID,
        RESOURCE_CATALYZED_GHODIUM_ALKALIDE
    ];
    
    Memory.mineralTotals = {};
    minerals.forEach(mineral => {
        Memory.mineralTotals[mineral] = 0;
    });
}

// Infrequent scan to keep Memory.RoomsAt5 accurate based on criteria:
// 1) Controller level >= 5; 2) Has storage; 3) At least 2 link structures.
function updateRoomsAt5List() {
    if (!Memory.RoomsAt5) {
        Memory.RoomsAt5 = [];
    }

    const qualified = [];
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room || !room.controller || !room.controller.my) continue; // only my controlled rooms
        if (room.controller.level < 5) continue;
        if (!room.storage) continue;
        const links = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LINK });
        if (links.length >= 2) {
            qualified.push(roomName);
        }
    }

    Memory.RoomsAt5 = qualified;
}

// Handle towers and room operations
function handleTowersAndRooms() {
    var towers = _.filter(Game.structures, (structure) => structure.structureType == STRUCTURE_TOWER);
    if (towers.length) {
        var alreadySearched = [];
        for (var y = 0; y < towers.length; y++) {
            if (towers[y].room.controller.owner && towers[y].room.controller.owner.username == "Montblanc") {
                if (alreadySearched.indexOf(towers[y].room.name) < 0) {
                    processTowerRoom(towers[y]);
                    alreadySearched.push(towers[y].room.name);
                }
                tower_Operate.run(towers[y], Memory.attackDuration, y);
            }
        }
    }
}

function processTowerRoom(tower) {
    //Populate the room creeps memory.
    Memory.roomCreeps[tower.room.name] = tower.room.find(FIND_MY_CREEPS);
    var RampartDirection = ""
    //Check for hostiles in this room
    let hostiles = tower.room.find(FIND_HOSTILE_CREEPS, {
        filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
    });
    let pHostiles = tower.room.find(FIND_HOSTILE_POWER_CREEPS, {
        filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
    });
    
    RampartDirection = handleHostileDetection(tower.room, hostiles, pHostiles);
    handleRampartControl(tower.room, hostiles, pHostiles);
    controlRamparts(RampartDirection, tower);
}

function handleHostileDetection(room, hostiles, pHostiles) {
    const roomName = room.name;
    let RampartDirection = "";
    
    if ((hostiles.length > 0 || pHostiles.length > 0) && Memory.roomsUnderAttack.indexOf(roomName) === -1) {
        Memory.roomsUnderAttack.push(roomName);
        if (!determineCreepThreat(hostiles[0], hostiles.length)) {
            Memory.roomsPrepSalvager.push(roomName);
        }
    } else if ((hostiles.length == 0 && pHostiles.length == 0) && Memory.roomsUnderAttack.indexOf(roomName) != -1) {
        var UnderAttackPos = Memory.roomsUnderAttack.indexOf(roomName);
        var salvagerPos = Memory.roomsPrepSalvager.indexOf(roomName);
        var nukes = room.find(FIND_NUKES);
        if (UnderAttackPos >= 0) {
            Memory.roomsUnderAttack.splice(UnderAttackPos, 1);
            if (!nukes.length) {
                RampartDirection = "Open"
            }
        }
        if (salvagerPos >= 0) {
            Memory.roomsPrepSalvager.splice(salvagerPos, 1);
        }
    }

    if (Memory.roomsUnderAttack.indexOf(roomName) > -1 && !room.controller.safeMode) {
        if (hostiles.length && (hostiles[0].owner.username != 'Invader')) {
            Memory.attackDuration = Memory.attackDuration + 1;
            if (Memory.attackDuration >= 250 && !Memory.warMode) {
                Memory.warMode = true;
                Game.notify('War mode was enabled due to a long attack at ' + roomName + '.');
                Memory.LastNotification = Game.time.toString() + ' : War mode was enabled due to a long attack at ' + roomName + '.'
            }
        }
    } else if (Memory.roomsUnderAttack.indexOf(roomName) == -1 && Memory.attackDuration >= 250 && Memory.roomsUnderAttack.length > 0) {
        const eFarGuardFlag = Game.flags[roomName + "eFarGuard"];
        if (!eFarGuardFlag) {
            //if (Game.map.getRoomLinearDistance(roomName, Game.rooms(Memory.roomsUnderAttack[0].name)) <= 5) {
            //Game.rooms[Memory.roomsUnderAttack[0]].createFlag(25, 25, roomName + "eFarGuard");
            //}
        }
    } else if (Memory.roomsUnderAttack.length == 0) {
        Memory.attackDuration = 0;
        const eFarGuardFlag = Game.flags[roomName + "eFarGuard"];
        if (eFarGuardFlag) {
            eFarGuardFlag.remove();
        }
    }

    if (Game.time % 500 == 0) {
        var nukes = room.find(FIND_NUKES);
        if (nukes.length) {
            RampartDirection = "Closed";
        }
    }
    
    return RampartDirection;
}

function handleRampartControl(room, hostiles, pHostiles) {
    if (hostiles.length > 0 || pHostiles.length > 0) {
        if (!Memory.ClosedRampartList[room.name]) {
            Memory.ClosedRampartList[room.name] = [];
        }

        let LockedThisTick = [];
        //Assemble list of ramparts that need to be locked
        for (let q = 0; q < hostiles.length; q++) {
            let nearbyRamparts = hostiles[q].pos.findInRange(FIND_MY_STRUCTURES, 4, {
                filter: {
                    structureType: STRUCTURE_RAMPART
                }
            })
            for (let p = 0; p < nearbyRamparts.length; p++) {
                if (nearbyRamparts[p].isPublic) {
                    nearbyRamparts[p].setPublic(false);
                }
                if (Memory.ClosedRampartList[room.name].indexOf(nearbyRamparts[p].id) == -1) {
                    Memory.ClosedRampartList[room.name].push(nearbyRamparts[p].id);
                }
                LockedThisTick.push(nearbyRamparts[p].id);
            }
        }
        for (let t = 0; t < pHostiles.length; t++) {
            let nearbyRamparts = pHostiles[t].pos.findInRange(FIND_MY_STRUCTURES, 4, {
                filter: {
                    structureType: STRUCTURE_RAMPART
                }
            })
            for (let g = 0; g < nearbyRamparts.length; g++) {
                if (nearbyRamparts[g].isPublic) {
                    nearbyRamparts[g].setPublic(false);
                }
                if (Memory.ClosedRampartList[room.name].indexOf(nearbyRamparts[g].id) == -1) {
                    Memory.ClosedRampartList[room.name].push(nearbyRamparts[g].id);
                }
                LockedThisTick.push(nearbyRamparts[g].id);
            }
        }
        //Compare ramparts locked this tick with previously locked ramparts
        for (let z = 0; z < Memory.ClosedRampartList[room.name].length; z++) {
            if (LockedThisTick.indexOf(Memory.ClosedRampartList[room.name][z]) == -1) {
                let thisRampart = Game.getObjectById(Memory.ClosedRampartList[room.name][z]);
                if (thisRampart) {
                    thisRampart.setPublic(true);
                    let tempIndex = Memory.ClosedRampartList[room.name].indexOf(thisRampart.id);
                    Memory.ClosedRampartList[room.name].splice(tempIndex, 1);
                }
            }
        }
    }
}

// Handle spawning operations
function handleSpawning() {
    //Reset mineral flag totals before going into loop
    if (Game.time % 5000 == 0) {
        resetMineralFlagCounts();
    }

    //Reset mineral totals
    if (Game.time % 50 == 0) {
        resetMineralTotals();
    }

    for (const i in Game.spawns) {
        processSpawn(Game.spawns[i]);
    }
    
    processSpawningCleanup();
}

function processSpawn(spawn) {
    var thisRoom = spawn.room;
    if (thisRoom.controller.owner) {
        var controllerLevel = thisRoom.controller.level;

        if (Memory.RoomsRun.indexOf(thisRoom.name) < 0) {
            processRoomManagement(thisRoom);
            Memory.RoomsRun.push(thisRoom.name);
        }

        processSpawnLogic(spawn, thisRoom);

        // Only mark room as no spawn needed if NO spawns in the room are spawning or busy
        const roomSpawns = thisRoom.find(FIND_MY_SPAWNS);
        const anySpawnActive = roomSpawns.some(s => s.spawning || isSpawnBusy(s));
        
        if (!anySpawnActive && Memory.NoSpawnNeeded.indexOf(thisRoom.name) < 0) {
            Memory.NoSpawnNeeded.push(thisRoom.name);
        }
    }
}

function processSpawnLogic(spawn, thisRoom) {
    var delay = thisRoom.controller.level == 8 ? 15 : 10;
    const runningAssaultFlag = Game.flags[thisRoom.name + "RunningAssault"];
    if (runningAssaultFlag) {
        delay = 3;
    }

    // Check if this specific spawn should run (don't block based on room-wide NoSpawnNeeded)
    if (Game.time % delay == 0 && spawn.isActive() && !spawn.spawning) {
        handleSpawnEnergyTracking(thisRoom);
        
        // Clear any completed entries for this spawn from the queue
        for (let i = Memory.creepInQue.length - 4; i >= 0; i -= 4) {
            if (Memory.creepInQue[i + 3] === spawn.name) {
                Memory.creepInQue.splice(i, 4);
            }
        }

        var energyIndex = getEnergyIndex(thisRoom);
        processSpawnCommands(spawn, thisRoom, energyIndex);
    }
}

function handleSpawnEnergyTracking(thisRoom) {
    //build routines that perform on the same tick assume the same energy level even after the first spawn used the energy
    //Set energy level into memory per room, wipe memory when done with tick.
    //Have build rountines check memory to get the current room energy level after builds
    var energyIndex = Memory.CurrentRoomEnergy.indexOf(thisRoom.name);
    if (energyIndex < 0) {
        Memory.CurrentRoomEnergy.push(thisRoom.name);
        Memory.CurrentRoomEnergy.push(thisRoom.energyAvailable);
    }
}

function getEnergyIndex(thisRoom) {
    var energyIndex = Memory.CurrentRoomEnergy.indexOf(thisRoom.name);
    if (energyIndex < 0) {
        Memory.CurrentRoomEnergy.push(thisRoom.name);
        Memory.CurrentRoomEnergy.push(thisRoom.energyAvailable);
        energyIndex = Memory.CurrentRoomEnergy.indexOf(thisRoom.name) + 1;
    } else {
        energyIndex++;
    }
    return energyIndex;
}

function processSpawnCommands(spawn, thisRoom, energyIndex) {
    // Process various spawn commands
    processSpecialSpawnCommands(spawn, thisRoom, energyIndex);
    
    // Check if this specific spawn is busy, not the global flag
    if (!isSpawnBusy(spawn)) {
        processNormalSpawning(spawn, thisRoom, energyIndex);
    }

    if (!isSpawnBusy(spawn) && thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] <= 900000 && Game.cpu.bucket >= 1000) {
        processFarMiningSpawn(spawn, thisRoom, energyIndex);
    }
    
    // Check for highway patrol unit spawning (every 1350 ticks, energy >= 400,000)
    if (!isSpawnBusy(spawn) && thisRoom.storage && Game.time % 1350 === 0 && thisRoom.storage.store[RESOURCE_ENERGY] >= 400000) {
        spawn_BuildInstruction.run(spawn, 'highwayPatrol', '', energyIndex, thisRoom.name);
    }
}

function processSpecialSpawnCommands(spawn, thisRoom, energyIndex) {
    const roomName = thisRoom.name;
    
    // Special handling for PowerAttack - check if units need spawning even when PowerPickup exists
    const powerAttackFlag = Game.flags[roomName + "PowerAttack"];
    const powerPickupFlag = Game.flags[roomName + "PowerPickup"];
    
    if (powerAttackFlag && powerPickupFlag) {
        // Both flags exist - check if PowerAttack units need spawning
        const powerAttackers = _.filter(Game.creeps, (creep) => 
            creep.memory.priority == 'powerAttack' && creep.memory.homeRoom == roomName
        );
        const powerHealers = _.filter(Game.creeps, (creep) => 
            creep.memory.priority == 'powerHeal' && creep.memory.homeRoom == roomName
        );
        
        // If PowerAttack units are missing, prioritize spawning them over PowerPickup
        if (powerAttackers.length < 1 || powerHealers.length < 2) {
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
                    var powerBanks = flag.room.find(FIND_STRUCTURES, {
                        filter: (struct) => struct.structureType === STRUCTURE_POWER_BANK
                    });
                    if (powerBanks.length) {
                        extra = Math.ceil(powerBanks[0].power / 1650); // Mule capacity = 1650
                    } else {
                        // No power bank found, look for dropped power resources
                        var droppedPower = flag.room.find(FIND_DROPPED_RESOURCES, {
                            filter: (resource) => resource.resourceType === RESOURCE_POWER
                        });
                        if (droppedPower.length) {
                            let totalPower = droppedPower.reduce((sum, drop) => sum + drop.amount, 0);
                            extra = Math.ceil(totalPower / 1650); // Mule capacity = 1650
                        } else {
                            // Look for ruins and tombstones with power
                            var powerRuins = flag.room.find(FIND_RUINS, {
                                filter: (ruin) => ruin.store[RESOURCE_POWER] > 0
                            });
                            var powerTombstones = flag.room.find(FIND_TOMBSTONES, {
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
        if (!Memory.roomCreeps[thisRoom.name]) {
            Memory.roomCreeps[thisRoom.name] = thisRoom.find(FIND_MY_CREEPS);
        }
        
        if (Memory.RoomsAt5.indexOf(thisRoom.name) == -1) {
            spawn_BuildCreeps.run(spawn, bestWorkerConfig, thisRoom, Memory.roomCreeps[thisRoom.name], energyIndex);
        } else {
            spawn_BuildCreeps5.run(spawn, thisRoom, Memory.roomCreeps[thisRoom.name], energyIndex);
        }
    }
}

function processFarMiningSpawn(spawn, thisRoom, energyIndex) {
    const roomName = thisRoom.name;
    
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
            var attackers = _.filter(Game.creeps, (creep) => 
                (creep.memory.priority == 'assattacker' || creep.memory.priority == 'assranger') && 
                creep.memory.homeRoom == roomName
            );
            var healerlessAttackers = _.filter(Game.creeps, (creep) => 
                (creep.memory.priority == 'assattacker' || creep.memory.priority == 'assranger') && 
                !creep.memory.healerID && 
                creep.memory.homeRoom == roomName && 
                !creep.memory.isReserved
            );
            
            if (attackers.length >= 1 && !healerlessAttackers.length) {
                spawn_BuildFarCreeps.run(spawn, thisRoom, energyIndex);
            }
        } else {
            spawn_BuildFarCreeps.run(spawn, thisRoom, energyIndex);
        }
    }
}

function processRoomManagement(thisRoom) {
    // All the room management code from the original function
    // This includes: pie graphs, link lists, source lists, mineral lists, etc.
    // [The existing room management code would go here - truncated for brevity]
    displayRoomInfo(thisRoom);
    manageRoomStructures(thisRoom);
    handleRoomFlags(thisRoom);
    handleRoomOperations(thisRoom);
}

function displayRoomInfo(thisRoom) {
    let roomVis = new RoomVisual(thisRoom.name);

    //Controller Progress + Storage Amount + CPU Average
    if (thisRoom.storage) {
        if (thisRoom.controller.level < 8) {
            drawPie(roomVis, Math.round(thisRoom.controller.progress), thisRoom.controller.progressTotal, 'RCL ' + thisRoom.controller.level, getColourByPercentage(thisRoom.controller.progress / thisRoom.controller.progressTotal, true), 2, 3.5);
            if (thisRoom.storage) {
                drawPie(roomVis, Math.round(thisRoom.storage.store[RESOURCE_ENERGY]), thisRoom.storage.store.getCapacity(), 'Energy', getColourByPercentage(thisRoom.storage.store[RESOURCE_ENERGY] / thisRoom.storage.store.getCapacity(), true), 2, 2.5);
                if (thisRoom.storage.store[RESOURCE_ENERGY] <= 40000) {
                    Memory.LastNotification = Game.time.toString() + ' : ' + thisRoom.name + ' Energy levels are critically low!'
                }
            }
        } else if (thisRoom.storage) {
            drawPie(roomVis, Math.round(thisRoom.storage.store[RESOURCE_ENERGY]), thisRoom.storage.store.getCapacity(), 'Energy', getColourByPercentage(thisRoom.storage.store[RESOURCE_ENERGY] / thisRoom.storage.store.getCapacity(), true), 2, 2.5);
            if (thisRoom.storage.store[RESOURCE_ENERGY] <= 40000) {
                Memory.LastNotification = Game.time.toString() + ' : ' + thisRoom.name + ' Energy levels are critically low!'
            }
        }
        Game.map.visual.text("\u{26A1}" + formatNumber(Math.round(thisRoom.storage.store[RESOURCE_ENERGY])), new RoomPosition(1, 1, thisRoom.name), { color: '#FFFFFF', backgroundColor: '#000000' })
        if (thisRoom.storage.store[RESOURCE_POWER]) {
           Game.map.visual.text("\u{2622}" + formatNumber(Math.round(thisRoom.storage.store[RESOURCE_POWER])), new RoomPosition(49, 49, thisRoom.name), { color: '#FFFFFF', backgroundColor: '#000000' }) 
        }
        if (Memory.repairTarget[thisRoom.name]) {
        	let damagedStructure = Game.getObjectById(Memory.repairTarget[thisRoom.name]);
			if (damagedStructure && damagedStructure.structureType != STRUCTURE_CONTAINER) {
				Game.map.visual.text("\u{1F6E1}" + formatNumber(Math.round(damagedStructure.hits)), new RoomPosition(1, 49, thisRoom.name), { color: '#FFFFFF', backgroundColor: '#000000' })           				
			}
        }
    }
}

function processSpawningCleanup() {
    Memory.RoomsRun = [];
    Memory.NoSpawnNeeded = [];
    Memory.CurrentRoomEnergy = [];
    Memory.roomCreeps = new Object();
}

// Handle market operations
function handleMarketOperations() {
    if (Game.time % 50 == 0) {
        //Periodically place buy orders for CPU unlocks
        //Check for existing order, ignore orders that have already been filled.
        let existingOrder = _.findKey(Game.market.orders, function(thisOrder) {
            return thisOrder.resourceType == CPU_UNLOCK && thisOrder.type == "buy" && thisOrder.remainingAmount >= 1
        });
        let existingPrice = undefined;
        let didDeal = false;
        if (existingOrder) {
            existingPrice = Game.market.orders[existingOrder].price;

            let sellOrders = Game.market.getAllOrders(order => order.resourceType == CPU_UNLOCK && order.type == ORDER_SELL && order.price <= existingPrice);
            //Something is lower than our current offer
            if (sellOrders.length) {
                sellOrders.sort(orderBuyCompare);
                Game.market.deal(sellOrders[0].id, 1);
                didDeal = true;
            }
        }
        if (!didDeal){
            //Look for highest buy order, ignoring existing order.
            let comparableOrders = Game.market.getAllOrders(order => order.resourceType == CPU_UNLOCK && order.type == ORDER_BUY);
            let targetPrice = 0;
            if (comparableOrders.length > 0) {
                comparableOrders.sort(orderSellCompare);
                targetPrice = comparableOrders[0].price;
                if (existingOrder && existingPrice <= targetPrice) {
                    //Current offer is lower, raise it.
                    //Determine if this is affordable
                    targetPrice += 0.001
                    if (Game.market.credits >= (targetPrice - existingPrice) * 0.05) {
                        Game.market.changeOrderPrice(existingOrder, targetPrice);
                    }                   
                } else if (!existingOrder) {
                    //Determine if you can afford to compete
                    targetPrice += 0.001;
                    if (Game.market.credits >= (targetPrice * 0.05) + targetPrice) {
                        //Create new order better than highest comparable one
                        Game.market.createOrder({
                            type: ORDER_BUY,
                            resourceType: CPU_UNLOCK,
                            price: targetPrice + 0.001,
                            totalAmount: 1
                        })
                    }       
                }
            }
        }   

        //Sell Pixels
        if (Game.resources[PIXEL] >= 100) {
            let PixelOrders = Game.market.getAllOrders(order => order.resourceType == PIXEL && order.type == ORDER_BUY);
            if (PixelOrders.length > 0) {
                PixelOrders.sort(orderSellCompare);
                let sellAmount = Game.resources[PIXEL];
                if (sellAmount > PixelOrders[0].amount) {
                    sellAmount = PixelOrders[0].amount;
                }
                Game.market.deal(PixelOrders[0].id, sellAmount)
            }
        }
    }
}

// Handle all creep operations
function handleCreepOperations() {
    // Remote creep CPU throttle: if bucket is low (<1000), skip execution for
    // heavy remote roles every other tick to reduce CPU usage.
    const remoteThrottleActive = (Game.cpu.bucket < 1000) && (Game.time % 2 === 1);
    for (var name in Game.creeps) {
        var creep = Game.creeps[name];
        if (!creep.spawning) {
            switch (creep.memory.priority) {
                case 'farMule':
                case 'farMuleNearDeath':
                    var doExcessWork = true;
                    if (Game.cpu.bucket < 500) {
                        doExcessWork = false;
                    }
                    creep_farMule.run(creep, doExcessWork);
                    break;
                case 'farMiner':
                case 'farMinerNearDeath':
                    if (remoteThrottleActive) { break; }
                    //Change to if (creep.memory.jobSpecific) after new wave is out
                    if (creep.getActiveBodyparts(HEAL) > 0) {
                        //SK Miner (TEMP, MAKE OWN FILE)
                        //Make new memory detail on SK miner spawn too, so don't have to make this check
                        creep_farMinerSK.run(creep);
                    } else {
                        //Normal miner
                        creep_farMiner.run(creep);
                    }
                    break;
                case 'farClaimer':
                case 'farGuard':
                case 'SKAttackGuard':
                case 'SKHealGuard':
                case 'farClaimerNearDeath':
                case 'farGuardNearDeath':
                case 'SKAttackGuardNearDeath':
                case 'SKHealGuardNearDeath':
                case 'farMineralMiner':
                    if (remoteThrottleActive) { break; }
                    var doExcessWork = true;
                    if (Game.cpu.bucket < 500) {
                        doExcessWork = false;
                    }
                    creep_farMining.run(creep, doExcessWork);
                    break;
                case 'miner':
                case 'minerNearDeath':
                    if (Memory.RoomsAt5.indexOf(creep.room.name) != -1) {
                        creep_miner.run(creep);
                    } else {
                        creep_workV2.run(creep, 25);
                    }
                    break;
                case 'upgrader':
                case 'upgraderNearDeath':
                    if (Memory.RoomsAt5.indexOf(creep.room.name) != -1) {
                        creep_upgrader.run(creep);
                    } else {
                        creep_workV2.run(creep, 25);
                    }
                    break;
                case 'repair':
                case 'repairNearDeath':
                    if (remoteThrottleActive) { break; }
                    if (Memory.RoomsAt5.indexOf(creep.room.name) != -1) {
                        creep_repair.run(creep);
                    } else {
                        creep_workV2.run(creep, 25);
                    }
                    break;
                case 'scraper':
                case 'scraperNearDeath':
                    if (remoteThrottleActive) { break; }
                    creep_scraper.run(creep);
                    break;
                case 'salvager':
                case 'salvagerNearDeath':
                    if (remoteThrottleActive) { break; }
                    creep_salvager.run(creep);
                    break;
                case 'supplier':
                case 'supplierNearDeath':
                    creep_supplier.run(creep);
                    break;
                case 'upSupplier':
                case 'upSupplierNearDeath':
                    if (remoteThrottleActive) { break; }
                    creep_upSupplier.run(creep);
                    break;
                case 'labWorker':
                case 'labWorkerNearDeath':
                    if (remoteThrottleActive) { break; }
                    creep_labWorker.run(creep);
                    break;
                case 'claimer':
                    creep_claimer.run(creep);
                    break;
                case 'looter':
                    creep_looter.run(creep);
                    break;
                case 'vandal':
                    creep_vandal.run(creep);
                    break;
                case 'helper':
                    creep_Helper.run(creep);
                    break;
                case 'defender':
                    creep_combat.run(creep);
                    break;
                case 'assattacker':
                case 'assattackerNearDeath':
                    creep_assattacker.run(creep);
                    break;
                case 'assranger':
                case 'assrangerNearDeath':
                    creep_assranger.run(creep);
                    break;
                case 'asshealer':
                case 'asshealerNearDeath':
                case 'targetlessHealer':
                    creep_asshealer.run(creep);
                    break;
                case 'powerAttack':
                case 'powerAttackNearDeath':
                    creep_powerAttack.run(creep);
                    break;
                case 'powerHeal':
                case 'powerHealNearDeath':
                    creep_powerHeal.run(creep);
                    break;
                case 'powerCollector':
                    creep_powerPickup.run(creep);
                    break;
                case 'distantSupplier':
                    creep_distantSupplier.run(creep);
                    break;
                case 'ranger':
                case 'ranger2':
                case 'PowerGuard':
                case 'rangerNearDeath':
                    creep_ranger.run(creep);
                    break;
                case 'farScout':
                    creep_farScout.run(creep);
                    break;
                case 'highwayPatrol':
                case 'highwayPatrolNearDeath':
                    creep_highwayPatrol.run(creep);
                    break;
                case 'harasser':
                case 'harasserNearDeath':
                    if (Game.cpu.bucket >= 750) {
                        creep_harasser.run(creep);
                    } else {
                        creep.say("\u2716\uFE0F", false);
                    }
                    break;
                default:
                    if (!creep.memory.priority) {
                        creep.memory.priority = 'helper';
                        var creepPath = 'E30N43;E29N43'.split(";");
                        creep.memory.path = creepPath;
                        creep.memory.destination = 'E29N43';
                        creep.memory.homeRoom = 'E29N43';
                        creep.memory.previousPriority = 'helper';
                    }
                    if (Memory.RoomsAt5.indexOf(creep.room.name) === -1) {
                        if (!remoteThrottleActive || Memory.warMode) {
                            creep_workV2.run(creep, 25);
                        } else {
                            creep.say("\u2716\uFE0F", false);
                        }
                    } else {
                        if (creep.memory.priority == 'harvester' || creep.memory.priority == 'builder') {
                            //In case of emergency
                            creep_workV2.run(creep, 25);
                        } else {
                            if ((!remoteThrottleActive || Memory.warMode) || creep.memory.priority == 'upgrader' || creep.memory.priority == 'upgraderNearDeath' || creep.memory.priority == 'miner' || creep.memory.priority == 'minerNearDeath') {
                                creep_work5.run(creep);
                            } else {
                                creep.say("\u2716\uFE0F", false);
                            }
                        }
                    }
                    break;
            }
        }
    }
    for (let pName in Game.powerCreeps) {
        let creep = Game.powerCreeps[pName];
        if (creep.shard == Game.shard.name) {
            switch (creep.memory.priority) {
                case 'baseOp':
                    creep_baseOp.run(creep);
                    break;
                default:
                    //Only one style for now.
                    creep.memory.priority = 'baseOp';
                    break;
            }
        }
    }
}

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

function DisplayBoostTotals() {
    //Left Box (T3 Boosts)
    let fillColor = '#2d68a0';
    if (Memory.warMode) {
        fillColor = '#9c2d34';
    }

    new RoomVisual().rect(0, 39, 6, 9.5, {
        fill: fillColor,
        stroke: '#FFFFFF',
        opacity: 0.15,
        strokeWidth: 0.15
    });

    let defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#33D5F6', stroke: '#000000', strokeWidth: 0.15 };
    new RoomVisual().text("SMACK : " + formatNumber(Memory.mineralTotals[RESOURCE_CATALYZED_UTRIUM_ACID]), 0.5, 40, defaultSettings);
    defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#a16df8', stroke: '#000000', strokeWidth: 0.15 };
    new RoomVisual().text("SHOOT : " + formatNumber(Memory.mineralTotals[RESOURCE_CATALYZED_KEANIUM_ALKALIDE]), 0.5, 41, defaultSettings);
    defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#00f4a7', stroke: '#000000', strokeWidth: 0.15 };
    new RoomVisual().text("REPAR : " + formatNumber(Memory.mineralTotals[RESOURCE_CATALYZED_LEMERGIUM_ACID]), 0.5, 47, defaultSettings);
    new RoomVisual().text("HEAL  : " + formatNumber(Memory.mineralTotals[RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE]), 0.5, 42, defaultSettings);
    defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#ffd38e', stroke: '#000000', strokeWidth: 0.15 };
    new RoomVisual().text("DECON : " + formatNumber(Memory.mineralTotals[RESOURCE_CATALYZED_ZYNTHIUM_ACID]), 0.5, 43, defaultSettings);
    new RoomVisual().text("MOVE  : " + formatNumber(Memory.mineralTotals[RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE]), 0.5, 44, defaultSettings);
    defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#ffffff', stroke: '#000000', strokeWidth: 0.15 };
    new RoomVisual().text("TOUGH : " + formatNumber(Memory.mineralTotals[RESOURCE_CATALYZED_GHODIUM_ALKALIDE]), 0.5, 45, defaultSettings);
    new RoomVisual().text("UPGRA : " + formatNumber(Memory.mineralTotals[RESOURCE_CATALYZED_GHODIUM_ACID]), 0.5, 48, defaultSettings);

    //Show time for debugging
    new RoomVisual().rect(36.5, 46, 8, 1, {
        fill: fillColor,
        stroke: '#FFFFFF',
        opacity: 0.15,
        strokeWidth: 0.15
    });
    new RoomVisual().text("TIME : " + Game.time.toString(), 36.7, 46.7, {
        align: 'left',
        font: '0.7 Courier New',
        color: '#FFFFFF',
        stroke: '#000000',
        strokeWidth: 0.15
    });

    if (Memory.warMode) {
        new RoomVisual().rect(6.5, 46, 7.1, 1, {
            fill: fillColor,
            stroke: '#FFFFFF',
            opacity: 0.15,
            strokeWidth: 0.15
        });
        new RoomVisual().text("WAR MODE ENABLED", 6.7, 46.7, {
            align: 'left',
            font: '0.7 Courier New',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeWidth: 0.15
        });
    }

    //Middle Box (Last Notification)
    new RoomVisual().rect(6.5, 47.5, 38, 1, {
        fill: fillColor,
        stroke: '#FFFFFF',
        opacity: 0.15,
        strokeWidth: 0.15
    });
    if (!Memory.LastNotification) {
        defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#00f4a7', stroke: '#000000', strokeWidth: 0.15 };
        new RoomVisual().text("This is where news would go. IF I HAD ANY.", 6.7, 48.2, defaultSettings);
    } else {
        defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#FFFFFF', stroke: '#000000', strokeWidth: 0.15 };
        if (Memory.LastNotification.includes("tresspassing") || Memory.LastNotification.includes("attack") || Memory.LastNotification.includes("critically")) {
            defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#ff7a7b', stroke: '#000000', strokeWidth: 0.15 };
        }
        new RoomVisual().text(Memory.LastNotification, 6.7, 48.2, defaultSettings);
    }


    //Right Box (Minerals)
    new RoomVisual().rect(45, 41, 4, 7.5, {
        fill: fillColor,
        stroke: '#FFFFFF',
        opacity: 0.15,
        strokeWidth: 0.15
    });

    defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#FFFFFF', stroke: '#000000', strokeWidth: 0.15 };
    new RoomVisual().text("H : " + formatNumber(Memory.mineralTotals[RESOURCE_HYDROGEN]), 45.3, 42, defaultSettings);
    new RoomVisual().text("O : " + formatNumber(Memory.mineralTotals[RESOURCE_OXYGEN]), 45.3, 43, defaultSettings);
    defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#ffd38e', stroke: '#000000', strokeWidth: 0.15 };
    new RoomVisual().text("Z : " + formatNumber(Memory.mineralTotals[RESOURCE_ZYNTHIUM]), 45.3, 44, defaultSettings);
    defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#a16df8', stroke: '#000000', strokeWidth: 0.15 };
    new RoomVisual().text("K : " + formatNumber(Memory.mineralTotals[RESOURCE_KEANIUM]), 45.3, 45, defaultSettings);
    defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#33D5F6', stroke: '#000000', strokeWidth: 0.15 };
    new RoomVisual().text("U : " + formatNumber(Memory.mineralTotals[RESOURCE_UTRIUM]), 45.3, 46, defaultSettings);
    defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#00f4a7', stroke: '#000000', strokeWidth: 0.15 };
    new RoomVisual().text("L : " + formatNumber(Memory.mineralTotals[RESOURCE_LEMERGIUM]), 45.3, 47, defaultSettings);
    defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#ff7a7b', stroke: '#000000', strokeWidth: 0.15 };
    new RoomVisual().text("X : " + formatNumber(Memory.mineralTotals[RESOURCE_CATALYST]), 45.3, 48, defaultSettings);
}

// Placeholder functions that need to be implemented with the full room management code
function manageRoomStructures(thisRoom) {
    const roomName = thisRoom.name;
    
    // Initialize room structure lists if they don't exist
    if (!Memory.linkList[roomName]) {
        Memory.linkList[roomName] = [];
    }
    if (!Memory.labList[roomName]) {
        Memory.labList[roomName] = [];
    }
    if (!Memory.powerSpawnList[roomName]) {
        Memory.powerSpawnList[roomName] = [];
    }
    if (!Memory.factoryList[roomName]) {
        Memory.factoryList[roomName] = [];
    }
    
    // Manage energy need rooms - check if room needs energy assistance
    if (Game.time % 50 == 0 && thisRoom.terminal && thisRoom.storage) {
        if (Memory.energyNeedRooms.indexOf(thisRoom.name) === -1 && thisRoom.storage.store[RESOURCE_ENERGY] < 250000 && thisRoom.terminal.store[RESOURCE_ENERGY] < 50000) {
            if (thisRoom.storage.store[RESOURCE_ENERGY] < 100000) {
                Memory.energyNeedRooms.unshift(thisRoom.name);
            } else {
                Memory.energyNeedRooms.push(thisRoom.name);
            }
        } else if (Memory.energyNeedRooms.indexOf(thisRoom.name) != -1 && (thisRoom.storage.store[RESOURCE_ENERGY] >= 255000 || thisRoom.terminal.store[RESOURCE_ENERGY] >= 50000)) {
            let tempIndex = Memory.energyNeedRooms.indexOf(thisRoom.name);
            Memory.energyNeedRooms.splice(tempIndex, 1);
        }
    }
    
    // Review market data, sell to buy orders, and catalog mineral stockpiles
    if (Game.time % 50 == 0 && thisRoom.terminal) {
        market_buyers.run(thisRoom, thisRoom.terminal, Memory.mineralList[thisRoom.name]);

        if (thisRoom.terminal.store.getFreeCapacity() < 5000) {
            Memory.LastNotification = Game.time.toString() + ' : ' + thisRoom.name + " terminal is overloaded!"
        }

        var roomMinerals = _.keys(thisRoom.terminal.store);
        for (let p = 0; p < roomMinerals.length; p++) {
            if (roomMinerals[p] == RESOURCE_ENERGY || roomMinerals[p] == RESOURCE_POWER) {
                //Not caring about this
                continue;
            }
            Memory.mineralTotals[roomMinerals[p]] += thisRoom.terminal.store[roomMinerals[p]]
        }
    }
    
    // Update structure lists every 50 ticks or if lists are empty
    if (Game.time % 50 == 0 || Memory.linkList[roomName].length == 0) {
        updateRoomStructureLists(thisRoom);
    }
    
    // Manage links
    manageLinkOperations(thisRoom);
    
    // Manage labs
    manageLabOperations(thisRoom);
    
    // Manage power spawn
    managePowerSpawnOperations(thisRoom);
    
    // Manage factory
    manageFactoryOperations(thisRoom);
    
    // Manage nuker
    manageNukerOperations(thisRoom);
    
    // Find repair target for room
    if (Game.time % 1000 == 0 || !Memory.repairTarget[thisRoom.name]) {
        Memory.repairTarget[thisRoom.name] = "";
        let mostDamagedStructure = thisRoom.find(FIND_STRUCTURES, {
            filter: (structure) => (structure.structureType != STRUCTURE_ROAD && structure.structureType != STRUCTURE_CONTAINER && structure.hitsMax - structure.hits >= 200) || (structure.structureType == STRUCTURE_CONTAINER && structure.hitsMax - structure.hits >= 50000)
        });
        if (mostDamagedStructure.length > 0) {
            mostDamagedStructure.sort(repairCompare);
            Memory.repairTarget[thisRoom.name] = mostDamagedStructure[0].id;
            //Cap energy harvesting if room meets certain minimums
            if (mostDamagedStructure[0].structureType == STRUCTURE_RAMPART) {
                if (mostDamagedStructure[0].hits >= 50000000 && !Game.flags[thisRoom.name + "50mCap"]) {
                    if (Game.flags[thisRoom.name + "25mCap"]) {
                        Game.flags[thisRoom.name + "25mCap"].remove();
                    }
                    Game.rooms[thisRoom.name].createFlag(47, 4, thisRoom.name + "50mCap");
                } else if (mostDamagedStructure[0].hits >= 25000000 && !Game.flags[thisRoom.name + "25mCap"] && !Game.flags[thisRoom.name + "50mCap"]) {
                    Game.rooms[thisRoom.name].createFlag(47, 4, thisRoom.name + "25mCap");
                }
                if (mostDamagedStructure[0].hits < 25000000) {
                    if (Game.flags[thisRoom.name + "25mCap"]) {
                        Game.flags[thisRoom.name + "25mCap"].remove();
                    }
                    if (Game.flags[thisRoom.name + "50mCap"]) {
                        Game.flags[thisRoom.name + "50mCap"].remove();
                    }
                }
            }
        }
    }
    
    // Clear road construction sites every 1000 ticks if at construction site cap
    if ((Game.time + 1) % 1000 == 0 && !Game.flags["DoNotClear"]) {
        const siteCount = Object.keys(Game.constructionSites).length;
        if (siteCount >= MAX_CONSTRUCTION_SITES) {
            const roadSites = thisRoom.find(FIND_CONSTRUCTION_SITES, {
                filter: (site) => site.structureType === STRUCTURE_ROAD && site.progress === 0
            });
            roadSites.forEach(site => site.remove());
        }
    }
    
    // Check all structures for ramparts, add if missing
    if (Game.time % 10000 == 0) {
        let constructionLimitReached = false;
        
        // Find structures that need rampart protection based on room level
        const excludedTypes = thisRoom.controller.level == 8 
            ? [STRUCTURE_RAMPART, STRUCTURE_WALL, STRUCTURE_CONTROLLER, STRUCTURE_EXTRACTOR, STRUCTURE_CONTAINER]
            : [STRUCTURE_RAMPART, STRUCTURE_WALL, STRUCTURE_CONTROLLER, STRUCTURE_EXTRACTOR, STRUCTURE_CONTAINER, STRUCTURE_EXTENSION];
        
        const structuresNeedingRamparts = thisRoom.find(FIND_MY_STRUCTURES, {
            filter: (structure) => !excludedTypes.includes(structure.structureType)
        });
        
        // Check each structure for rampart coverage
        for (const structure of structuresNeedingRamparts) {
            const structuresAtPos = structure.pos.lookFor(LOOK_STRUCTURES);
            const hasRampart = structuresAtPos.some(s => s.structureType === STRUCTURE_RAMPART);
            
            if (!hasRampart) {
                const result = thisRoom.createConstructionSite(structure.pos.x, structure.pos.y, STRUCTURE_RAMPART);
                if (result === ERR_FULL) {
                    constructionLimitReached = true;
                    break; // Stop if construction site limit reached
                } else if (result === OK) {
                    Memory.LastNotification = `${Game.time} : Rampart generated in ${thisRoom.name}.`;
                }
            }
        }
        
        // Generate ramparts around controller (8 adjacent tiles)
        if (!constructionLimitReached) {
            const controllerPos = thisRoom.controller.pos;
            outer: for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue; // Skip controller position itself
                    
                    const x = controllerPos.x + dx;
                    const y = controllerPos.y + dy;
                    
                    // Check if position is within room bounds
                    if (x >= 1 && x <= 48 && y >= 1 && y <= 48) {
                        const pos = new RoomPosition(x, y, thisRoom.name);
                        const structuresAtPos = pos.lookFor(LOOK_STRUCTURES);
                        const hasRampart = structuresAtPos.some(s => s.structureType === STRUCTURE_RAMPART);
                        const isWall = structuresAtPos.some(s => s.structureType === STRUCTURE_WALL);
                        
                        if (!hasRampart && !isWall) {
                            const result = thisRoom.createConstructionSite(x, y, STRUCTURE_RAMPART);
                            if (result === ERR_FULL) {
                                constructionLimitReached = true;
                                break outer; // Stop if construction site limit reached
                            }
                        }
                    }
                }
            }
        }
        
        // Generate roads in empty tiles surrounded by at least 2 extensions
        if (!constructionLimitReached) {
            outer: for (let x = 1; x <= 48; x++) {
                for (let y = 1; y <= 48; y++) {
                    const pos = new RoomPosition(x, y, thisRoom.name);
                    const terrain = Game.map.getRoomTerrain(thisRoom.name);
                    
                    // Skip if tile is not walkable (wall)
                    if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                    
                    // Check if position already has structures or construction sites
                    const structuresAtPos = pos.lookFor(LOOK_STRUCTURES);
                    const constructionSitesAtPos = pos.lookFor(LOOK_CONSTRUCTION_SITES);
                    
                    // Skip if already has structures or construction sites
                    if (structuresAtPos.length > 0 || constructionSitesAtPos.length > 0) continue;
                    
                    // Count adjacent extensions within range 1
                    let adjacentExtensions = 0;
                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            if (dx === 0 && dy === 0) continue; // Skip center position
                            
                            const adjX = x + dx;
                            const adjY = y + dy;
                            
                            // Check bounds
                            if (adjX >= 1 && adjX <= 48 && adjY >= 1 && adjY <= 48) {
                                const adjPos = new RoomPosition(adjX, adjY, thisRoom.name);
                                const adjStructures = adjPos.lookFor(LOOK_STRUCTURES);
                                
                                // Count extensions at this adjacent position
                                const extensionsHere = adjStructures.filter(s => s.structureType === STRUCTURE_EXTENSION);
                                adjacentExtensions += extensionsHere.length;
                            }
                        }
                    }
                    
                    // Generate road if surrounded by at least 2 extensions
                    if (adjacentExtensions >= 2) {
                        const result = thisRoom.createConstructionSite(x, y, STRUCTURE_ROAD);
                        if (result === ERR_FULL) {
                            constructionLimitReached = true;
                            break outer; // Stop if construction site limit reached
                        }
                    }
                }
            }
        }
    }
}

function handleRoomFlags(thisRoom) {
    // This would contain room-specific flag handling
    // For now, keeping this as a placeholder to maintain functionality  
}

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
    if ((Game.time % 5000 === 0 || !Memory.observerList[roomName] || Memory.observerList[roomName].length === 0)) {
        updateObserverList(thisRoom, roomName);
    }

    // Operate observers every 20 ticks
    if (Game.time % 20 === 0 && observationPointer && Memory.observerList[roomName] && Memory.observerList[roomName].length > 0) {
        operateObserver(roomName, observedRoomName);
    }

    // Monitor for power creep operators and respawn if needed
    if (Game.time % 100 === 0 && Game.flags[roomName + "RoomOperator"] && Memory.powerSpawnList[roomName] && Memory.powerSpawnList[roomName].length > 0) {
        handlePowerCreepRespawn(thisRoom, roomName);
    }
}

function handleObservedRoomOperations(thisRoom, observedRoom, roomName, observedRoomName) {
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
            filter: (struct) => struct.structureType === STRUCTURE_POWER_BANK
        });
        if (!powerBanks.length) {
            powerAttackFlag.remove();
        }
    } else if (thisRoom.storage && (!thisRoom.storage.store[RESOURCE_POWER] || thisRoom.storage.store[RESOURCE_POWER] <= 200000)) {
        // Search for new power banks in observed room
        const powerBanks = observedRoom.find(FIND_STRUCTURES, {
            filter: (struct) => struct.structureType === STRUCTURE_POWER_BANK && struct.ticksToDecay >= 4500
        });
        if (powerBanks.length > 0) {
            const powerBank = powerBanks[0];
            observedRoom.createFlag(powerBank.pos.x, powerBank.pos.y, roomName + "PowerAttack");
        }
    }
}

function handleResourceDepositOperations(thisRoom, observedRoom, roomName, observedRoomName) {
    const deposits = observedRoom.find(FIND_DEPOSITS, {
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
        const existingHarasser = _.find(Game.creeps, (creep) => 
            creep.memory.priority === 'harasser' && 
            creep.memory.destination === observedRoomName &&
            creep.memory.homeRoom === roomName
        );
        
        // Also check if there's already a harasser in the observed room
        const harasserInRoom = observedRoom.find(FIND_MY_CREEPS, {
            filter: (creep) => creep.memory.priority === 'harasser'
        });
        
        if (!existingHarasser && harasserInRoom.length === 0 && Game.cpu.bucket >= 750) {
            // Spawn a harasser to disrupt the reservation
            const spawns = thisRoom.find(FIND_MY_STRUCTURES, {
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
    const observers = thisRoom.find(FIND_MY_STRUCTURES, {
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
    const powerCreepsInRoom = thisRoom.find(FIND_MY_POWER_CREEPS);
    
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

function handleMineralFlagDistribution() {
    //If room lacks mineral flag, calculate what flag to give it
    if (Game.time % 5000 == 0 && Memory.flagCount["NeedFlag"].length) {
        let flagWeights = [
            { tier: 1, weight: Memory.flagCount["1"] },
            { tier: 2, weight: Memory.flagCount["2"] },
            { tier: 3, weight: Memory.flagCount["3"] },
            { tier: 4, weight: Memory.flagCount["4"] * 2 },
            { tier: 5, weight: Memory.flagCount["5"] * 2 },
            { tier: 6, weight: Memory.flagCount["6"] * 2 },
            { tier: 7, weight: Memory.flagCount["7"] * 2 },
            { tier: 8, weight: Memory.flagCount["8"] * 2 },
            { tier: 9, weight: Memory.flagCount["9"] * 2 },
        ];

        let SetCompleted = (Memory.flagCount["1"] == Memory.flagCount["2"] == Memory.flagCount["3"] == (Memory.flagCount["4"] * 2) == (Memory.flagCount["5"] * 2) == (Memory.flagCount["6"] * 2) == (Memory.flagCount["7"] * 2) == (Memory.flagCount["8"] * 2) == (Memory.flagCount["9"] * 2))

        flagWeights.sort(flagWeightCompare);

        if (SetCompleted) {
            Game.rooms[Memory.flagCount["NeedFlag"][0]].createFlag(2, 24, Memory.flagCount["NeedFlag"][0] + "XGHO2Producer");
            Memory.flagCount["NeedFlag"].splice(0, 1);
            Memory.flagCount["1"] = Memory.flagCount["1"] + 1;
        } else {
            switch (flagWeights[0].tier) {
                case 1:
                    Game.rooms[Memory.flagCount["NeedFlag"][0]].createFlag(2, 24, Memory.flagCount["NeedFlag"][0] + "XGHO2Producer");
                    Memory.flagCount["NeedFlag"].splice(0, 1);
                    Memory.flagCount["1"] = Memory.flagCount["1"] + 1;
                    break;
                case 2:
                    Game.rooms[Memory.flagCount["NeedFlag"][0]].createFlag(2, 24, Memory.flagCount["NeedFlag"][0] + "XZHO2Producer");
                    Memory.flagCount["NeedFlag"].splice(0, 1);
                    Memory.flagCount["2"] = Memory.flagCount["2"] + 1;
                    break;
                case 3:
                    Game.rooms[Memory.flagCount["NeedFlag"][0]].createFlag(2, 24, Memory.flagCount["NeedFlag"][0] + "XLH2OProducer");
                    Memory.flagCount["NeedFlag"].splice(0, 1);
                    Memory.flagCount["3"] = Memory.flagCount["3"] + 1;
                    break;
                case 4:
                    Game.rooms[Memory.flagCount["NeedFlag"][0]].createFlag(2, 24, Memory.flagCount["NeedFlag"][0] + "GHO2Producer");
                    Memory.flagCount["NeedFlag"].splice(0, 1);
                    Memory.flagCount["4"] = Memory.flagCount["4"] + 1;
                    break;
                case 5:
                    Game.rooms[Memory.flagCount["NeedFlag"][0]].createFlag(2, 24, Memory.flagCount["NeedFlag"][0] + "ZHO2Producer");
                    Memory.flagCount["NeedFlag"].splice(0, 1);
                    Memory.flagCount["5"] = Memory.flagCount["5"] + 1;
                    break;
                case 6:
                    Game.rooms[Memory.flagCount["NeedFlag"][0]].createFlag(2, 24, Memory.flagCount["NeedFlag"][0] + "UH2OProducer");
                    Memory.flagCount["NeedFlag"].splice(0, 1);
                    Memory.flagCount["6"] = Memory.flagCount["6"] + 1;
                    break;
                case 7:
                    Game.rooms[Memory.flagCount["NeedFlag"][0]].createFlag(2, 24, Memory.flagCount["NeedFlag"][0] + "UHProducer");
                    Memory.flagCount["NeedFlag"].splice(0, 1);
                    Memory.flagCount["7"] = Memory.flagCount["7"] + 1;
                    break;
                case 8:
                    Game.rooms[Memory.flagCount["NeedFlag"][0]].createFlag(2, 24, Memory.flagCount["NeedFlag"][0] + "ZHProducer");
                    Memory.flagCount["NeedFlag"].splice(0, 1);
                    Memory.flagCount["8"] = Memory.flagCount["8"] + 1;
                    break;
                case 9:
                    Game.rooms[Memory.flagCount["NeedFlag"][0]].createFlag(2, 24, Memory.flagCount["NeedFlag"][0] + "ULProducer");
                    Memory.flagCount["NeedFlag"].splice(0, 1);
                    Memory.flagCount["9"] = Memory.flagCount["9"] + 1;
                    break;
            }
        }
    }
}

// Handle autoBuildRooms regeneration - process one room per tick to avoid CPU spikes
function handleAutoBuildRoomsRegeneration() {
    // Initialize memory objects if they don't exist
    if (!Memory.autoBuildRooms) {
        Memory.autoBuildRooms = [];
    }
    if (!Memory.autoBuildRegenIndex) {
        Memory.autoBuildRegenIndex = 0;
    }
    if (!Memory.lastAutoBuildRegen) {
        Memory.lastAutoBuildRegen = 0;
    }
    
    // Early return if no autoBuildRooms exist
    if (Memory.autoBuildRooms.length === 0) {
        return;
    }
    
    // Run regeneration every 5000 ticks (offset from the main rampart/road generation)
    if (Game.time - Memory.lastAutoBuildRegen >= 5000) {
        // Get the current room to process
        const roomName = Memory.autoBuildRooms[Memory.autoBuildRegenIndex];
        const room = Game.rooms[roomName];
        
        // Only process if we have vision of the room
        if (room && room.controller && room.controller.my) {
            console.log(`AutoBuild regeneration: Processing ${roomName} (${Memory.autoBuildRegenIndex + 1}/${Memory.autoBuildRooms.length})`);
            
            // Clear existing road construction sites before regenerating
            const roadSites = room.find(FIND_CONSTRUCTION_SITES, {
                filter: { structureType: STRUCTURE_ROAD }
            });
            roadSites.forEach(site => site.remove());
            
            // Run the base generation tool
            tool_generateBase.run(room);
        } else if (room) {
            console.log(`AutoBuild regeneration: Skipping ${roomName} - no controller ownership`);
        } else {
            console.log(`AutoBuild regeneration: Skipping ${roomName} - no room vision`);
        }
        
        // Move to next room index
        Memory.autoBuildRegenIndex++;
        
        // Reset index if we've processed all rooms
        if (Memory.autoBuildRegenIndex >= Memory.autoBuildRooms.length) {
            Memory.autoBuildRegenIndex = 0;
            Memory.lastAutoBuildRegen = Game.time;
            console.log(`AutoBuild regeneration cycle completed. Next cycle in ${50000} ticks.`);
        }
    }
}

function updateRoomStructureLists(thisRoom) {
    const roomName = thisRoom.name;
    
    // Find and store all structure IDs
    const links = thisRoom.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_LINK }
    });
    
    const sortedLinks = [];
    const controllerLinks = [];
    const storageLinks = [];
    const sourceLinks = [];
    const otherLinks = [];
    
    Memory.linkList[roomName] = [];
    // Categorize links by their function
    for (let link of links) {
        // Check if near controller (within 4 range)
        if (link.pos.getRangeTo(thisRoom.controller) <= 4) {
            controllerLinks.push(link);
        }
        // Check if near storage (within 3 range - increased from 2)
        else if (thisRoom.storage && link.pos.getRangeTo(thisRoom.storage) <= 3) {
            storageLinks.push(link);
        }
        // Check if near sources (within 3 range - increased from 2)
        else {
            const nearSources = link.pos.findInRange(FIND_SOURCES, 3);
            if (nearSources.length > 0) {
                sourceLinks.push(link);
            } else {
                // This link doesn't fit standard categories, but include it anyway
                otherLinks.push(link);
            }
        }
    }

     // Add first source link
    if (sourceLinks.length > 0) {
        Memory.linkList[roomName].push(sourceLinks[0].id);
    }

    //Add the controller link
    if (controllerLinks.length > 0) {
        Memory.linkList[roomName].push(controllerLinks[0].id);
    }

    //Add the second source link
    if (sourceLinks.length > 1) {
        Memory.linkList[roomName].push(sourceLinks[1].id);
    }

    //Add the storage link
    if (storageLinks.length > 0) {
        Memory.linkList[roomName].push(storageLinks[0].id);
    }

    //If there's 'other' links, just add em
    for (let link of otherLinks) { 
        Memory.linkList[roomName].push(link.id);
    }
    
    const labs = thisRoom.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_LAB }
    });
    Memory.labList[roomName] = labs.map(lab => lab.id);
    
    const powerSpawns = thisRoom.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_POWER_SPAWN }
    });
    Memory.powerSpawnList[roomName] = powerSpawns.map(ps => ps.id);
    
    const factories = thisRoom.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_FACTORY }
    });
    Memory.factoryList[roomName] = factories.map(factory => factory.id);
    
    const nukers = thisRoom.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_NUKER }
    });
    Memory.nukerList[roomName] = nukers.map(nuker => nuker.id);
    
    // Update sources and mineral lists
    const sources = thisRoom.find(FIND_SOURCES);
    if (sources.length > 0) {
        // Sort sources by distance to storage (closest first)
        if (thisRoom.storage) {
            sources.sort((a, b) => {
                const distA = a.pos.getRangeTo(thisRoom.storage);
                const distB = b.pos.getRangeTo(thisRoom.storage);
                return distA - distB;
            });
        }
        Memory.sourceList[roomName] = sources.map(source => source.id);
    }
    
    const minerals = thisRoom.find(FIND_MINERALS);
    if (minerals.length > 0) {
        Memory.mineralList[roomName] = [minerals[0].id]; // Store as array for consistency
    }
    
    const extractors = thisRoom.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_EXTRACTOR }
    });
    if (extractors.length > 0) {
        Memory.extractorList[roomName] = extractors[0].id;
    }
}

function manageLinkOperations(thisRoom) {
    const roomName = thisRoom.name;
    const linkIds = Memory.linkList[roomName];
    
    if (!linkIds || linkIds.length < 2) return;
    
    // Get all active links using the ordered memory array
    const links = linkIds.map(id => Game.getObjectById(id)).filter(link => link);
    
    if (links.length < 2) return;
    
    // Links are ordered as:
    // Index 0: First source link
    // Index 1: Controller link
    // Index 2: Second source link
    // Index 3: Storage link
    // Index 4+: Other links
    
    const sourceLink1 = links[0]; // Index 0: First source link
    const controllerLink = links[1]; // Index 1: Controller link
    const sourceLink2 = links[2]; // Index 2: Second source link (if exists)
    const storageLink = links[3]; // Index 3: Storage link (if exists)
    
    // Transfer from first source link (index 0)
    if (sourceLink1 && sourceLink1.energy >= 400 && sourceLink1.cooldown == 0) {
        let targetLink = null;
        
        // Priority 1: Controller link if it needs energy
        if (controllerLink && controllerLink.energy < 400) {
            targetLink = controllerLink;
        }
        // Priority 2: Storage link if controller link is full
        else if (storageLink && storageLink.energy < 400) {
            targetLink = storageLink;
        }
        
        if (targetLink) {
            const result = sourceLink1.transferEnergy(targetLink);
            if (Game.time % 100 === 0 && result === OK) {
                console.log(`${roomName}: Source link 1 -> ${targetLink === controllerLink ? 'controller' : 'storage'} link`);
            }
        }
    }
    
    // Transfer from second source link (index 2) if it exists
    if (sourceLink2 && sourceLink2.energy >= 400 && sourceLink2.cooldown == 0) {
        let targetLink = null;
        
        // Priority 1: Controller link if it needs energy
        if (controllerLink && controllerLink.energy < 400) {
            targetLink = controllerLink;
        }
        // Priority 2: Storage link if controller link is full
        else if (storageLink && storageLink.energy < 400) {
            targetLink = storageLink;
        }
        
        if (targetLink) {
            const result = sourceLink2.transferEnergy(targetLink);
            if (Game.time % 100 === 0 && result === OK) {
                console.log(`${roomName}: Source link 2 -> ${targetLink === controllerLink ? 'controller' : 'storage'} link`);
            }
        }
    }
}

function manageLabOperations(thisRoom) {
    const roomName = thisRoom.name;
    const labIds = Memory.labList[roomName];
    
    if (!labIds || labIds.length < 3) return;
    
    const labs = labIds.map(id => Game.getObjectById(id)).filter(lab => lab);
    
    if (labs.length < 3) return;
    
    // Check for production flags to determine what to produce
    const flags = Game.flags;
    let productionType = null;
    
    // Check for various producer flags
    const producerFlags = [
        // Tier 1 - T3 Catalyzed compounds
        { flag: roomName + "XGHO2Producer", resource: RESOURCE_CATALYZED_GHODIUM_ALKALIDE, inputs: [RESOURCE_GHODIUM_ALKALIDE, RESOURCE_CATALYST] },
        { flag: roomName + "XGH2OProducer", resource: RESOURCE_CATALYZED_GHODIUM_ACID, inputs: [RESOURCE_GHODIUM_ACID, RESOURCE_CATALYST] },
        { flag: roomName + "XUH2OProducer", resource: RESOURCE_CATALYZED_UTRIUM_ACID, inputs: [RESOURCE_UTRIUM_ACID, RESOURCE_CATALYST] },
        
        // Tier 2 - T3 Catalyzed compounds
        { flag: roomName + "XZHO2Producer", resource: RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE, inputs: [RESOURCE_ZYNTHIUM_ALKALIDE, RESOURCE_CATALYST] },
        { flag: roomName + "XZH2OProducer", resource: RESOURCE_CATALYZED_ZYNTHIUM_ACID, inputs: [RESOURCE_ZYNTHIUM_ACID, RESOURCE_CATALYST] },
        { flag: roomName + "XKHO2Producer", resource: RESOURCE_CATALYZED_KEANIUM_ALKALIDE, inputs: [RESOURCE_KEANIUM_ALKALIDE, RESOURCE_CATALYST] },
        
        // Tier 3 - T3 Catalyzed compounds  
        { flag: roomName + "XLH2OProducer", resource: RESOURCE_CATALYZED_LEMERGIUM_ACID, inputs: [RESOURCE_LEMERGIUM_ACID, RESOURCE_CATALYST] },
        { flag: roomName + "XLHO2Producer", resource: RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE, inputs: [RESOURCE_LEMERGIUM_ALKALIDE, RESOURCE_CATALYST] },
        { flag: roomName + "OHProducer(3)", resource: RESOURCE_HYDROXIDE, inputs: [RESOURCE_HYDROGEN, RESOURCE_OXYGEN] },
        
        // Tier 4 - T2 compounds
        { flag: roomName + "GProducer(4)", resource: RESOURCE_GHODIUM, inputs: [RESOURCE_ZYNTHIUM_KEANITE, RESOURCE_UTRIUM_LEMERGITE] },
        { flag: roomName + "GHO2Producer", resource: RESOURCE_GHODIUM_ALKALIDE, inputs: [RESOURCE_GHODIUM_OXIDE, RESOURCE_HYDROXIDE] },
        { flag: roomName + "GH2OProducer", resource: RESOURCE_GHODIUM_ACID, inputs: [RESOURCE_GHODIUM_HYDRIDE, RESOURCE_HYDROXIDE] },
        
        // Tier 5 - T2 compounds
        { flag: roomName + "ZHO2Producer", resource: RESOURCE_ZYNTHIUM_ALKALIDE, inputs: [RESOURCE_ZYNTHIUM_OXIDE, RESOURCE_HYDROXIDE] },
        { flag: roomName + "ZH2OProducer", resource: RESOURCE_ZYNTHIUM_ACID, inputs: [RESOURCE_ZYNTHIUM_HYDRIDE, RESOURCE_HYDROXIDE] },
        { flag: roomName + "KHO2Producer", resource: RESOURCE_KEANIUM_ALKALIDE, inputs: [RESOURCE_KEANIUM_OXIDE, RESOURCE_HYDROXIDE] },
        
        // Tier 6 - T2 compounds
        { flag: roomName + "UH2OProducer", resource: RESOURCE_UTRIUM_ACID, inputs: [RESOURCE_UTRIUM_HYDRIDE, RESOURCE_HYDROXIDE] },
        { flag: roomName + "LH2OProducer", resource: RESOURCE_LEMERGIUM_ACID, inputs: [RESOURCE_LEMERGIUM_HYDRIDE, RESOURCE_HYDROXIDE] },
        { flag: roomName + "LHO2Producer", resource: RESOURCE_LEMERGIUM_ALKALIDE, inputs: [RESOURCE_LEMERGIUM_OXIDE, RESOURCE_HYDROXIDE] },
        
        // Tier 7 - T1 compounds
        { flag: roomName + "UHProducer", resource: RESOURCE_UTRIUM_HYDRIDE, inputs: [RESOURCE_UTRIUM, RESOURCE_HYDROGEN] },
        { flag: roomName + "GHProducer", resource: RESOURCE_GHODIUM_HYDRIDE, inputs: [RESOURCE_GHODIUM, RESOURCE_HYDROGEN] },
        { flag: roomName + "GOProducer", resource: RESOURCE_GHODIUM_OXIDE, inputs: [RESOURCE_GHODIUM, RESOURCE_OXYGEN] },
        { flag: roomName + "KOProducer", resource: RESOURCE_KEANIUM_OXIDE, inputs: [RESOURCE_KEANIUM, RESOURCE_OXYGEN] },
        
        // Tier 8 - T1 compounds
        { flag: roomName + "ZHProducer", resource: RESOURCE_ZYNTHIUM_HYDRIDE, inputs: [RESOURCE_ZYNTHIUM, RESOURCE_HYDROGEN] },
        { flag: roomName + "ZOProducer", resource: RESOURCE_ZYNTHIUM_OXIDE, inputs: [RESOURCE_ZYNTHIUM, RESOURCE_OXYGEN] },
        { flag: roomName + "LOProducer", resource: RESOURCE_LEMERGIUM_OXIDE, inputs: [RESOURCE_LEMERGIUM, RESOURCE_OXYGEN] },
        { flag: roomName + "LHProducer", resource: RESOURCE_LEMERGIUM_HYDRIDE, inputs: [RESOURCE_LEMERGIUM, RESOURCE_HYDROGEN] },
        
        // Tier 9 - Base compounds
        { flag: roomName + "ULProducer", resource: RESOURCE_UTRIUM_LEMERGITE, inputs: [RESOURCE_UTRIUM, RESOURCE_LEMERGIUM] },
        { flag: roomName + "ZKProducer", resource: RESOURCE_ZYNTHIUM_KEANITE, inputs: [RESOURCE_ZYNTHIUM, RESOURCE_KEANIUM] },
        { flag: roomName + "GProducer(9)", resource: RESOURCE_GHODIUM, inputs: [RESOURCE_ZYNTHIUM_KEANITE, RESOURCE_UTRIUM_LEMERGITE] },
        { flag: roomName + "OHProducer(9)", resource: RESOURCE_HYDROXIDE, inputs: [RESOURCE_HYDROGEN, RESOURCE_OXYGEN] }
    ];
    
    for (let producer of producerFlags) {
        if (flags[producer.flag]) {
            productionType = producer;
            break;
        }
    }
    
    if (!productionType) return;
    
    // Skip first 3 labs, use labs 4 and 5 as input labs (indices 3 and 4), rest as output labs
    if (labs.length < 6) return; // Need at least 6 labs (skip 3, use 2 for input, 1+ for output)
    
    const inputLabs = labs.slice(3, 5); // Labs 4 and 5 (indices 3 and 4)
    const outputLabs = labs.slice(5);   // Labs 6+ (indices 5+)
    
    // Check if input labs have correct resources
    const input1 = productionType.inputs[0];
    const input2 = productionType.inputs[1];
    
    if (inputLabs[0].mineralType != input1 || inputLabs[1].mineralType != input2) {
        // Need to load correct inputs - this would be handled by lab worker creeps
        return;
    }
    
    // Run reactions in output labs
    for (let outputLab of outputLabs) {
        if (outputLab.cooldown == 0 && 
            inputLabs[0].mineralAmount >= LAB_REACTION_AMOUNT &&
            inputLabs[1].mineralAmount >= LAB_REACTION_AMOUNT &&
            outputLab.mineralAmount < outputLab.mineralCapacity - LAB_REACTION_AMOUNT) {
            
            outputLab.runReaction(inputLabs[0], inputLabs[1]);
        }
    }
}

function managePowerSpawnOperations(thisRoom) {
    const roomName = thisRoom.name;
    const powerSpawnIds = Memory.powerSpawnList[roomName];
    
    if (!powerSpawnIds || powerSpawnIds.length == 0) return;
    
    const powerSpawn = Game.getObjectById(powerSpawnIds[0]);
    if (!powerSpawn) return;
    
    // Process power if we have both power and energy (need 50 energy per 1 power)
    // Power spawns don't have cooldown - processPower() can be called every tick
    if (powerSpawn.power > 0 && powerSpawn.energy >= POWER_SPAWN_ENERGY_RATIO) {
        const result = powerSpawn.processPower();
    }
}

function manageFactoryOperations(thisRoom) {
    const roomName = thisRoom.name;
    const factoryIds = Memory.factoryList[roomName];
    
    if (!factoryIds || factoryIds.length == 0) return;
    
    const factory = Game.getObjectById(factoryIds[0]);
    if (!factory) return;
    
    // Factory operations would be handled here
    // This is a placeholder for now as factory logic can be quite complex
    if (factory.cooldown == 0) {
        // Determine what to produce based on available resources
        // This would need more sophisticated logic based on your needs
    }
}

function manageNukerOperations(thisRoom) {
    const roomName = thisRoom.name;
    const nukerIds = Memory.nukerList[roomName];
    
    if (!nukerIds || nukerIds.length == 0) return;
    
    const nuker = Game.getObjectById(nukerIds[0]);
    if (!nuker) return;
    
    // Nuker operations would be handled here
    // This is typically manual/flag-based operation for targeting
    const nukeFlag = Game.flags[roomName + "NukeTarget"];
    if (nukeFlag && nuker.energy >= NUKER_ENERGY_CAPACITY && nuker.ghodium >= NUKER_GHODIUM_CAPACITY && nuker.cooldown == 0) {
        const result = nuker.launchNuke(nukeFlag.pos);
        if (result == OK) {
            nukeFlag.remove();
            Game.notify('Nuke launched from ' + roomName + ' to ' + nukeFlag.pos.roomName + '!');
        }
    }
}

function recalculateBestWorker(thisEnergyCap) {
    //Move : 50
    //Work : 100
    //Carry : 50 (50 resource/per)
    //Attack : 80
    //Ranged_Attack : 150
    //Heal : 250
    //Claim : 600 (Don't automate)
    //Tough : 10

    //1 Full balanced worker module : MOVE, CARRY, WORK - 200pts
    var EnergyRemaining = thisEnergyCap;
    bestWorkerConfig = [];
    while ((EnergyRemaining / 200) >= 1 || bestWorkerConfig.length >= 21) {
        bestWorkerConfig.push(MOVE, CARRY, WORK);
        if (bestWorkerConfig.length > 21) {
            while (bestWorkerConfig.length > 21) {
                bestWorkerConfig.splice(-1, 1)
            }
            break;
        }
        EnergyRemaining = EnergyRemaining - 200;
    }
    //Make the modules pretty
    bestWorkerConfig.sort();
}

function memCheck() {
    if (!Memory.RoomsRun) {
        Memory.RoomsRun = [];
        console.log('RoomsRun Defaulted');
    }
    if (!Memory.NoSpawnNeeded) {
        Memory.NoSpawnNeeded = [];
        console.log('NoSpawnNeeded Defaulted');
    }
    if (!Memory.CurrentRoomEnergy) {
        Memory.CurrentRoomEnergy = [];
        console.log('CurrentRoomEnergy Defaulted');
    }
    if (!Memory.creepInQue) {
        Memory.creepInQue = [];
        console.log('creepInQue Defaulted');
    }
    if (!Memory.roomsUnderAttack) {
        Memory.roomsUnderAttack = [];
        console.log('roomsUnderAttack Defaulted');
    }
    if (!Memory.SKRoomsUnderAttack) {
        Memory.SKRoomsUnderAttack = [];
    }
    if (!Memory.FarRoomsUnderAttack) {
        Memory.FarRoomsUnderAttack = [];
    }
    if (!Memory.roomsPrepSalvager) {
        Memory.roomsPrepSalvager = [];
        console.log('roomsPrepSalvager Defaulted');
    }
    if (!Memory.RoomsAt5) {
        Memory.RoomsAt5 = [];
    }
    if (!Memory.hasFired) {
        Memory.hasFired = [];
    }
    if (!Memory.ordersFilled) {
        Memory.ordersFilled = [];
    }
    Memory.whiteList = ['DomNomNom', 'Kotarou', 'ICED_COFFEE', 'demawi', 'o4kapuk', 'ben2', 'Jibol', 'szumi', 'Xist', 'Xolym', 'SirFrump', 'ART999', 'ThyReaper', 'Aundine', 'Fritee', 'Jumpp', 'mute', 'shadow_bird', 'szumi', 'TiffanyTrump', 'iceburg', 'Robalian', 'Digital'];
    if (!Memory.blockedRooms) {
        Memory.blockedRooms = ['E84N87', 'E83N88', 'E82N87', 'E83N86', 'E81N84', 'E82N83', 'E81N81', 'E84N82', 'E86N81', 'E88N81'];
    }
    if (!Memory.energyNeedRooms) {
        Memory.energyNeedRooms = [];
    }
    if (!Memory.scoutedMiningRooms) {
        Memory.scoutedMiningRooms = [];
    }
	if (!Memory.autoBuildRooms) {
		Memory.autoBuildRooms = [];
	}
    // Spawn tracking - initialize as object structure
    if (!Memory.isSpawning) {
        Memory.isSpawning = {};
    }
    //Boolean
    if (Memory.warMode == null) {
        Memory.warMode = false;
    }
    if (Memory.guardType == null) {
        Memory.guardType = false;
    }
    if (Memory.postObserveTick == null) {
        Memory.postObserveTick = false;
    }
    //Decimal
    if (!Memory.averageUsedCPU) {
        Memory.averageUsedCPU = 0.0;
    }
    if (!Memory.averageUsedSpawnCPU) {
        Memory.averageUsedSpawnCPU = 0.0;
    }
    if (!Memory.averageUsedCreepCPU) {
        Memory.averageUsedSpawnCPU = 0.0;
    }
    //Integer
    if (!Memory.totalTicksRecorded) {
        Memory.totalTicksRecorded = 0;
    }
    if (!Memory.totalTicksSpawnRecorded) {
        Memory.totalTicksSpawnRecorded = 0;
    }
    if (!Memory.totalTicksCreepRecorded) {
        Memory.totalTicksSpawnRecorded = 0;
    }
    if (!Memory.attackDuration) {
        Memory.attackDuration = 0;
    }
    //Object
    if (!Memory.SKMineralTimers) {
        Memory.SKMineralTimers = new Object();
    }
    if (!Memory.ClosedRampartList) {
        Memory.ClosedRampartList = new Object();
    }
    /*if (!Memory.TerminalCollection) {
        Memory.TerminalCollection = new Object();
    }*/
    if (!Memory.FarClaimerNeeded) {
        Memory.FarClaimerNeeded = new Object();
    }
    if (!Memory.FarGuardNeeded) {
        Memory.FarGuardNeeded = new Object();
    }
    if (!Memory.FarCreeps) {
        Memory.FarCreeps = new Object();
    }
    if (!Memory.PriceList) {
        Memory.PriceList = new Object();
    }
    if (!Memory.sourceList) {
        Memory.sourceList = new Object();
    }
    if (!Memory.linkList) {
        Memory.linkList = new Object();
    }
    if (!Memory.mineralList) {
        Memory.mineralList = new Object();
    }
    if (!Memory.extractorList) {
        Memory.extractorList = new Object();
    }
    if (!Memory.powerSpawnList) {
        Memory.powerSpawnList = new Object();
    }
    Memory.observationPointers = new Object();

    if (!Memory.observerList) {
        Memory.observerList = new Object();
    }
    if (!Memory.nukerList) {
        Memory.nukerList = new Object();
    }
    if (!Memory.energyCap) {
        Memory.energyCap = new Object();
    }
    if (!Memory.roomCreeps) {
        Memory.roomCreeps = new Object();
    }
    if (!Memory.towerNeedEnergy) {
        Memory.towerNeedEnergy = new Object();
    }
    if (!Memory.towerPickedTarget) {
        Memory.towerPickedTarget = new Object();
    }
    if (!Memory.mineralNeed) {
        Memory.mineralNeed = new Object();
    }
    if (!Memory.labList) {
        Memory.labList = new Object();
    }
    if (!Memory.repairTarget) {
        Memory.repairTarget = new Object();
    }
    if (!Memory.factoryList) {
        Memory.factoryList = new Object();
    }
    if (!Memory.flagCount) {
        Memory.flagCount = new Object();
        //Count by track
        //First 3 groupings should have 2 instances for 1 of each below
        //1- XGHO2/XGH2O/XUH2O
        //2- XZHO2/XZH2O/XKHO2
        //3- XLH2O/XLHO2/OH

        //4- G/GHO2/GH2O
        //5- ZHO2/ZH2O/KHO2
        //6- UH2O/LH2O/LHO2
        //7- UH/KO/GH/GO
        //8- ZH/ZO/LO/LH
        //9- UL/ZK/G/OH
        Memory.flagCount["1"] = 0;
        Memory.flagCount["2"] = 0;
        Memory.flagCount["3"] = 0;
        Memory.flagCount["4"] = 0;
        Memory.flagCount["5"] = 0;
        Memory.flagCount["6"] = 0;
        Memory.flagCount["7"] = 0;
        Memory.flagCount["8"] = 0;
        Memory.flagCount["9"] = 0;
        Memory.flagCount["NeedFlag"] = [];
    }
    if (!Memory.CPUAverages) {
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
    }
    if (!Memory.mineralTotals) {
        Memory.mineralTotals = new Object();
        Memory.mineralTotals[RESOURCE_HYDROGEN] = 0;
        Memory.mineralTotals[RESOURCE_OXYGEN] = 0;
        Memory.mineralTotals[RESOURCE_UTRIUM] = 0;
        Memory.mineralTotals[RESOURCE_LEMERGIUM] = 0;
        Memory.mineralTotals[RESOURCE_KEANIUM] = 0;
        Memory.mineralTotals[RESOURCE_ZYNTHIUM] = 0;
        Memory.mineralTotals[RESOURCE_CATALYST] = 0;
        Memory.mineralTotals[RESOURCE_GHODIUM] = 0;

        Memory.mineralTotals[RESOURCE_HYDROXIDE] = 0;
        Memory.mineralTotals[RESOURCE_ZYNTHIUM_KEANITE] = 0;
        Memory.mineralTotals[RESOURCE_UTRIUM_LEMERGITE] = 0;

        Memory.mineralTotals[RESOURCE_UTRIUM_HYDRIDE] = 0;
        Memory.mineralTotals[RESOURCE_UTRIUM_OXIDE] = 0;
        Memory.mineralTotals[RESOURCE_KEANIUM_HYDRIDE] = 0;
        Memory.mineralTotals[RESOURCE_KEANIUM_OXIDE] = 0;
        Memory.mineralTotals[RESOURCE_LEMERGIUM_HYDRIDE] = 0;
        Memory.mineralTotals[RESOURCE_LEMERGIUM_OXIDE] = 0;
        Memory.mineralTotals[RESOURCE_ZYNTHIUM_HYDRIDE] = 0;
        Memory.mineralTotals[RESOURCE_ZYNTHIUM_OXIDE] = 0;
        Memory.mineralTotals[RESOURCE_GHODIUM_HYDRIDE] = 0;
        Memory.mineralTotals[RESOURCE_GHODIUM_OXIDE] = 0;

        Memory.mineralTotals[RESOURCE_UTRIUM_ACID] = 0;
        Memory.mineralTotals[RESOURCE_UTRIUM_ALKALIDE] = 0;
        Memory.mineralTotals[RESOURCE_KEANIUM_ACID] = 0;
        Memory.mineralTotals[RESOURCE_KEANIUM_ALKALIDE] = 0;
        Memory.mineralTotals[RESOURCE_LEMERGIUM_ACID] = 0;
        Memory.mineralTotals[RESOURCE_LEMERGIUM_ALKALIDE] = 0;
        Memory.mineralTotals[RESOURCE_ZYNTHIUM_ACID] = 0;
        Memory.mineralTotals[RESOURCE_ZYNTHIUM_ALKALIDE] = 0;
        Memory.mineralTotals[RESOURCE_GHODIUM_ACID] = 0;
        Memory.mineralTotals[RESOURCE_GHODIUM_ALKALIDE] = 0;

        Memory.mineralTotals[RESOURCE_CATALYZED_UTRIUM_ACID] = 0;
        Memory.mineralTotals[RESOURCE_CATALYZED_UTRIUM_ALKALIDE] = 0;
        Memory.mineralTotals[RESOURCE_CATALYZED_KEANIUM_ACID] = 0;
        Memory.mineralTotals[RESOURCE_CATALYZED_KEANIUM_ALKALIDE] = 0;
        Memory.mineralTotals[RESOURCE_CATALYZED_LEMERGIUM_ACID] = 0;
        Memory.mineralTotals[RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE] = 0;
        Memory.mineralTotals[RESOURCE_CATALYZED_ZYNTHIUM_ACID] = 0;
        Memory.mineralTotals[RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE] = 0;
        Memory.mineralTotals[RESOURCE_CATALYZED_GHODIUM_ACID] = 0;
        Memory.mineralTotals[RESOURCE_CATALYZED_GHODIUM_ALKALIDE] = 0;
    }
	
	if (!Memory.genBestDirection) { 
        Memory.genBestDirection = new Object();
    }
    if (!Memory.genBestCenterCoords) {
        Memory.genBestCenterCoords = new Object();
    }
    if (!Memory.genBestSourceID) {
        Memory.genBestSourceID = new Object();
    }
}

function orderPriceCompare(a, b) {
    if (a.price < b.price)
        return 1;
    if (a.price > b.price)
        return -1;
    return 0;
}

function orderPriceCompareBuying(a, b) {
    if (a.price < b.price)
        return -1;
    if (a.price > b.price)
        return 1;
    return 0;
}

function flagWeightCompare(a, b) {
    if (a.weight < b.weight)
        return -1;
    if (a.weight > b.weight)
        return 1;
    return 0;
}

function drawPie(vis, val, max, title, colour, centerx, centery, inner) {
    //const vis = new RoomVisual(from.roomName);
    if (vis.getSize() < 512000) {
        if (!inner) inner = val;

        let p = 1;
        if (max !== 0) p = val / max;
        const r = 1; // radius
        var center = {
            x: centerx,
            y: centery * r * 4.5
        };
        vis.circle(center, {
            radius: r + 0.1,
            fill: '#000000',
            stroke: 'rgba(255, 255, 255, 0.8)',
        });
        var pfix = p;
        if (p >= 1) {
            pfix = pfix + 0.01;
        }
        const poly = [center];
        const tau = 2 * Math.PI;
        const surf = tau * (pfix);
        const offs = -Math.PI / 2;
        const step = tau / 32;
        for (let i = 0; i <= surf; i += step) {
            poly.push({
                x: center.x + Math.cos(i + offs),
                y: center.y - Math.cos(i),
            });
        }
        poly.push(center);
        vis.poly(poly, {
            fill: colour,
            opacity: 1,
            stroke: colour,
            strokeWidth: 0.05,
        });
        vis.text(Number.isFinite(inner) ? formatNumber(inner) : inner, center.x, center.y + 0.33, {
            color: '#FFFFFF',
            font: '1 Courier New',
            align: 'center',
            stroke: 'rgba(0, 0, 0, 0.8)',
            strokeWidth: 0.15,
        });
        let yoff = 0.7;
        if (0.35 < p && p < 0.65) yoff += 0.3;
        vis.text(title, center.x, center.y + r + yoff, {
            color: '#FFFFFF',
            font: '0.6 Courier New',
            align: 'center',
        });
        const lastpol = poly[poly.length - 2];
        vis.text('' + Math.floor(p * 100) + '%', lastpol.x + (lastpol.x - center.x) * 0.7, lastpol.y + (lastpol.y - center.y) * 0.4 + 0.1, {
            color: '#FFFFFF',
            font: '0.4 Courier New',
            align: 'center',
        });
    }

}

const getColourByPercentage = (percentage, reverse) => {
    const value = reverse ? percentage : 1 - percentage;
    const hue = (value * 120).toString(10);
    return `hsl(${hue}, 100%, 50%)`;
};

function formatNumber(number) {
    let ld = Math.log10(number) / 3;
    if (!number) return number;
    let n = number.toString();
    if (ld < 1) {
        return n;
    }
    if (ld < 2) {
        return n.substring(0, n.length - 3) + 'k';
    }
    if (ld < 3) {
        return n.substring(0, n.length - 6) + 'M';
    }
    if (ld < 4) {
        return n.substring(0, n.length - 9) + 'B';
    }
    return number.toString();
}

function tryInitSameMemory() {
    if (lastMemoryTick && global.LastMemory && Game.time == (lastMemoryTick + 1)) {
        delete global.Memory
        global.Memory = global.LastMemory
        RawMemory._parsed = global.LastMemory
    } else {
        Memory;
        global.LastMemory = RawMemory._parsed
    }
    lastMemoryTick = Game.time
}

function controlRamparts(RampartDirection, thisTower) {
    if (RampartDirection == "Closed") {
        var roomRamparts = thisTower.room.find(FIND_MY_STRUCTURES, {
            filter: {
                structureType: STRUCTURE_RAMPART
            }
        });
        for (var n = 0; n < roomRamparts.length; n++) {
            if (roomRamparts[n].isPublic) {
                roomRamparts[n].setPublic(false);
            }
        }
        Memory.ClosedRampartList[thisTower.room.name] = [];
    } else if (RampartDirection == "Open") {
        var nukes = thisTower.room.find(FIND_NUKES);
        if (!nukes.length) {
            var roomRamparts = thisTower.room.find(FIND_MY_STRUCTURES, {
                filter: {
                    structureType: STRUCTURE_RAMPART
                }
            });
            for (var n = 0; n < roomRamparts.length; n++) {
                if (!roomRamparts[n].isPublic) {
                    roomRamparts[n].setPublic(true);
                }
            }
        }
        Memory.ClosedRampartList[thisTower.room.name] = [];
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

function repairCompare(a, b) {
    if (a.hits < b.hits)
        return -1;
    if (a.hits > b.hits)
        return 1;
    return 0;
}


function hiHitCompare(a, b) {
    if (a.hits < b.hits)
        return 1;
    if (a.hits > b.hits)
        return -1;
    return 0;
}

function orderSellCompare(a, b) {
    if (a.price < b.price)
        return 1;
    if (a.price > b.price)
        return -1;
    return 0;
}

function orderBuyCompare(a, b) {
    if (a.price < b.price)
        return -1;
    if (a.price > b.price)
        return 1;
    return 0;
}


function determineCreepThreat(eCreep, totalHostiles) {
    if ((eCreep.owner.username == 'Invader' || eCreep.name.indexOf('Drainer') >= 0) || (eCreep.hitsMax <= 1000 && totalHostiles <= 1)) {
        return false;
    } else {
        //Determine if this creep is boosted.
        eCreep.body.forEach(function(thisPart) {
            if (thisPart.boost) {
                return true;
            }
        });
        //unboosted threat, not a problem.
        return false;
    }
}

function getRoomAtOffset(xOffset, yOffset, roomName) {
    //Returns the name of the room that is x,y away from the submitted origin room name

    //Get origin room coordinates in numerical format
    let xx = parseInt(roomName.substr(1), 10);
    let verticalPos = 2;
    if (xx >= 100) {
        verticalPos = 4;
    } else if (xx >= 10) {
        verticalPos = 3;
    }
    let yy = parseInt(roomName.substr(verticalPos + 1), 10);
    let horizontalDir = roomName.charAt(0);
    let verticalDir = roomName.charAt(verticalPos);
    if (horizontalDir === 'W' || horizontalDir === 'w') {
        xx = -xx - 1;
    }
    if (verticalDir === 'N' || verticalDir === 'n') {
        yy = -yy - 1;
    }

    //Apply offset
    xx = xx + xOffset
    yy = yy + yOffset

    //Convert coordinates back to room name format
    let xName = ''
    let yName = ''
    if (xx >= 0) {
        xName = "E" + xx.toString()
    } else {
        xName = "W" + (-xx - 1).toString()
    }

    if (yy >= 0) {
        yName = "S" + yy.toString()
    } else {
        yName = "N" + (-yy - 1).toString()
    }

    return xName + yName;
}