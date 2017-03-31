//Whitelist ['cyberblast','SirLovi','Asku','Kazume','Noxeth','MrDave','Telemac','Xephael','Zoiah','fsck-u','FaceWound','forkmantis','Migaaresno','xAix1999','silentpoots','arguinyano','OokieCookie','OverlordQ','Nibinhilion','Crowsbane','Yew','BogdanBiv','s1akr','Pandabear41','Logmadr','Patrik','novice','Conquest','ofirl','GeorgeBerkeley','TTR','tynstar','K-C','Hoekynl','Sunri5e','AgOrange','distantcam','Lisp','bbdMinimbl','Twill','Logxen','miR','Spedwards','Krazyfuq','Icesory','chobobobo','deft-code','mmmd','DKPlugins','pavelnieks','buckley310','almaravarion','SSH','Perrytheplatypus','Jnesselr','ryagas','xXtheguy52Xx','SEATURTLEKING','DasBrain','C00k1e_93','Currency','Vykook','shedletsky','Aranatha','Montblanc']

//Creeps
var creep_work = require('creep.work');
var creep_work5 = require('creep.work5');
var creep_farMining = require('creep.farMining');
var creep_combat = require('creep.combat');
var creep_claimer = require('creep.claimer');
var creep_vandal = require('creep.vandal');
var creep_constructor = require('creep.constructor');
var creep_trump = require('creep.trump');
var creep_Kebab = require('creep.removeKebab');
var creep_Helper = require('creep.helper');
var creep_towerDrainer = require('creep.towerDrainer');
var creep_looter = require('creep.looter');

//Spawning
var spawn_BuildCreeps = require('spawn.BuildCreeps');
var spawn_BuildCreeps5 = require('spawn.BuildCreeps5');
var spawn_BuildInstruction = require('spawn.BuildInstruction');
var spawn_BuildFarCreeps = require('spawn.BuildFarCreeps');
var bestWorkerConfig = [WORK, CARRY, MOVE, MOVE];
//var roomReference = Game.spawns['Spawn_Capital'].room;

//Towers
var tower_Operate = require('tower.Operate');

//Market
var market_buyers = require('market.FindBuyers');

//const profiler = require('screeps-profiler');

//Ctrl+Alt+f to autoformat documents.

//Constants : http://support.screeps.com/hc/en-us/articles/203084991-API-Reference
//Creep calculator : http://codepen.io/findoff/full/RPmqOd/
//Profiler commands : https://github.com/gdborton/screeps-profiler
//Emoji Unicode converter : https://r12a.github.io/apps/conversion/

//profiler.enable();
module.exports.loop = function() {
    //profiler.wrap(function() {
    for (var name in Memory.creeps) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
            //console.log('Clearing non-existing creep memory:', name);
        }
    }

    //Set defaults on various memory values
    if (Game.time % 10000 == 0 || Game.flags["CheckMemory"]) {
        memCheck();
        if (Game.flags["CheckMemory"]) {
            Game.flags["CheckMemory"].remove();
        }
    }

    //Reset average CPU usage records on request
    if (Game.flags["ResetAverages"]) {
        Memory.totalTicksSpawnRecorded = 0;
        Memory.totalTicksCreepRecorded = 0;
        Memory.totalTicksRecorded = 0;
        Memory.averageUsedSpawnCPU = 0;
        Memory.averageUsedCreepCPU = 0;
        Memory.averageUsedCPU = 0;
        Game.flags["ResetAverages"].remove();
    }

    if (Game.flags["ToggleWar"]) {
        Memory.warMode = !Memory.warMode;
        Game.flags["ToggleWar"].remove();
    }

    if (Game.flags["ResetAttackFlags"]) {
        Memory.roomsUnderAttack = [];
        Memory.attackDuration = 0;
    }

    //Note that warMode is on
    if (Memory.warMode) {
        new RoomVisual().text("War Mode", 0, 49, {
            align: 'left',
            font: '2 Courier New',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeWidth: 0.15
        });
    }

    //Use experimental PathFinder
    PathFinder.use(true);

    var roomDist = 999;
    var roomEnergy = 0;
    var roomName = '';
    var instructionSpawn;

    //Loop through all spawns

    //Log average CPU for spawn processes in memory.
    var preSpawnCPU = Game.cpu.getUsed();

    for (var i in Game.spawns) {
        var thisRoom = Game.spawns[i].room;
        var controllerLevel = thisRoom.controller.level;

        if (Memory.RoomsRun.indexOf(thisRoom.name) < 0) {
            //Populate the room creeps memory.
            Memory.roomCreeps[thisRoom.name] = thisRoom.find(FIND_MY_CREEPS);

            //Display the remaining progress of the controller
            var remainingEnergy = thisRoom.controller.progressTotal - thisRoom.controller.progress;
            if (remainingEnergy > 0) {
                var formattedNumber = remainingEnergy.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                thisRoom.visual.text(formattedNumber, thisRoom.controller.pos.x + 1, thisRoom.controller.pos.y, {
                    align: 'left',
                    font: '1 Courier New',
                    color: '#FFFFFF',
                    stroke: '#000000',
                    strokeWidth: 0.15
                });
            }
            //Execute special instruction written into console
            if (Game.flags["ClaimThis"]) {
                var theDistance = Game.map.getRoomLinearDistance(Game.flags["ClaimThis"].pos.roomName, thisRoom.name);
                if (theDistance < roomDist || (theDistance == roomDist && thisRoom.energyCapacityAvailable > roomEnergy)) {
                    roomDist = theDistance;
                    roomName = thisRoom.name;
                    roomEnergy = thisRoom.energyCapacityAvailable;
                    instructionSpawn = Game.spawns[i];
                }
            }

            if (Game.flags["BuildThis"]) {
                var theDistance = Game.map.getRoomLinearDistance(Game.flags["BuildThis"].pos.roomName, thisRoom.name);
                if (theDistance < roomDist || (theDistance == roomDist && thisRoom.energyCapacityAvailable > roomEnergy)) {
                    roomDist = theDistance;
                    roomName = thisRoom.name;
                    roomEnergy = thisRoom.energyCapacityAvailable;
                    instructionSpawn = Game.spawns[i];
                }
            }

            if (Game.flags["DrainTurret"]) {
                var theDistance = Game.map.getRoomLinearDistance(Game.flags["DrainTurret"].pos.roomName, thisRoom.name);
                if (theDistance < roomDist || (theDistance == roomDist && thisRoom.energyCapacityAvailable > roomEnergy)) {
                    roomDist = theDistance;
                    roomName = thisRoom.name;
                    roomEnergy = thisRoom.energyCapacityAvailable;
                    instructionSpawn = Game.spawns[i];
                }
            }

            if (Game.flags["RemoveKebab"]) {
                if (thisRoom.energyCapacityAvailable >= 1300) {
                    var theDistance = Game.map.getRoomLinearDistance(Game.flags["RemoveKebab"].pos.roomName, thisRoom.name);
                    if (theDistance < roomDist || (theDistance == roomDist && thisRoom.energyCapacityAvailable > roomEnergy)) {
                        roomDist = theDistance;
                        roomName = thisRoom.name;
                        roomEnergy = thisRoom.energyCapacityAvailable;
                        instructionSpawn = Game.spawns[i];
                    }
                }
            }

            if (Game.flags["Loot"]) {
                if (thisRoom.storage) {
                    var theDistance = Game.map.getRoomLinearDistance(Game.flags["Loot"].pos.roomName, thisRoom.name);
                    if (theDistance < roomDist || (theDistance == roomDist && thisRoom.energyCapacityAvailable > roomEnergy)) {
                        roomDist = theDistance;
                        roomName = thisRoom.name;
                        roomEnergy = thisRoom.energyCapacityAvailable;
                        instructionSpawn = Game.spawns[i];
                    }
                }
            }

            if (Game.flags["SignThis"]) {
                var theDistance = Game.map.getRoomLinearDistance(Game.flags["SignThis"].pos.roomName, thisRoom.name);
                if (theDistance < roomDist || (theDistance == roomDist && thisRoom.energyCapacityAvailable > roomEnergy)) {
                    roomDist = theDistance;
                    roomName = thisRoom.name;
                    roomEnergy = thisRoom.energyCapacityAvailable;
                    instructionSpawn = Game.spawns[i];
                }
            }

            if (Game.flags["WallThis"]) {
                var theDistance = Game.map.getRoomLinearDistance(Game.flags["WallThis"].pos.roomName, thisRoom.name);
                if (theDistance < roomDist || (theDistance == roomDist && thisRoom.energyCapacityAvailable > roomEnergy)) {
                    roomDist = theDistance;
                    roomName = thisRoom.name;
                    roomEnergy = thisRoom.energyCapacityAvailable;
                    instructionSpawn = Game.spawns[i];
                }
            }

            if (Game.flags["Assault"] && thisRoom.name == 'E89N83') {
                roomDist = 0;
                roomName = thisRoom.name;
                roomEnergy = thisRoom.energyCapacityAvailable;
                instructionSpawn = Game.spawns[i];
            }

            //Get list of Sources
            if (!Memory.sourceList[thisRoom.name]) {
                Memory.sourceList[thisRoom.name] = [];
                var roomSources = thisRoom.find(FIND_SOURCES);
                var reverseFlag = false;
                if (roomSources) {
                    var sourceCounter = 0;
                    while (roomSources[sourceCounter]) {
                        if (Memory.sourceList[thisRoom.name].indexOf(roomSources[sourceCounter].id) == -1) {
                            Memory.sourceList[thisRoom.name].push(roomSources[sourceCounter].id)
                        }
                        //If there is no storage unit nearby, this should not be #1
                        var nearContainers = roomSources[sourceCounter].pos.findInRange(FIND_MY_STRUCTURES, 3, {
                            filter: {
                                structureType: STRUCTURE_STORAGE
                            }
                        });
                        if (sourceCounter == 0 && nearContainers.length == 0) {
                            reverseFlag = true;
                        }
                        sourceCounter++;
                    }
                    if (reverseFlag) {
                        Memory.sourceList[thisRoom.name].reverse();
                    }
                }
            }

            //Get list of Links
            if (Game.time % 1000 == 0 || !Memory.linkList[thisRoom.name]) {
                Memory.linkList[thisRoom.name] = [];
                var roomLinks = thisRoom.find(FIND_MY_STRUCTURES, {
                    filter: {
                        structureType: STRUCTURE_LINK
                    }
                });
                var reverseFlag = false;
                if (roomLinks) {
                    var linkCounter = 0;
                    while (roomLinks[linkCounter]) {
                        if (Memory.linkList[thisRoom.name].indexOf(roomLinks[linkCounter].id) == -1) {
                            Memory.linkList[thisRoom.name].push(roomLinks[linkCounter].id)
                        }
                        //If there is no source nearby, this should not be #1
                        var nearSources = roomLinks[linkCounter].pos.findInRange(FIND_SOURCES, 3);
                        if (linkCounter == 0 && nearSources.length == 0) {
                            reverseFlag = true;
                        }
                        linkCounter++;
                    }
                    if (reverseFlag) {
                        Memory.linkList[thisRoom.name].reverse();
                    }
                }
            }

            //Get list of Minerals
            if (!Memory.mineralList[thisRoom.name]) {
                Memory.mineralList[thisRoom.name] = [];
                var mineralLocations = thisRoom.find(FIND_MINERALS);
                if (mineralLocations) {
                    if (mineralLocations.length > 0) {
                        Memory.mineralList[thisRoom.name].push(mineralLocations[0].id);
                    }
                }
            }

            //Get list of extractors
            if (Game.time % 800 == 0 || !Memory.extractorList[thisRoom.name]) {
                Memory.extractorList[thisRoom.name] = [];
                var extractorLocations = thisRoom.find(FIND_MY_STRUCTURES, {
                    filter: {
                        structureType: STRUCTURE_EXTRACTOR
                    }
                });
                if (extractorLocations) {
                    if (extractorLocations.length > 0) {
                        Memory.extractorList[thisRoom.name].push(extractorLocations[0].id);
                    }
                }
            }

            //Get list of power spawns
            if (Game.time % 2000 == 0 || !Memory.powerSpawnList[thisRoom.name]) {
                Memory.powerSpawnList[thisRoom.name] = [];
                var powerSpawns = thisRoom.find(FIND_MY_STRUCTURES, {
                    filter: {
                        structureType: STRUCTURE_POWER_SPAWN
                    }
                });
                if (powerSpawns) {
                    if (powerSpawns.length > 0) {
                        Memory.powerSpawnList[thisRoom.name].push(powerSpawns[0].id);
                    }
                }
            }

            //Get list of nukers
            if (Game.time % 2000 == 0 || !Memory.nukerList[thisRoom.name]) {
                Memory.nukerList[thisRoom.name] = [];
                var theseNukes = thisRoom.find(FIND_MY_STRUCTURES, {
                    filter: {
                        structureType: STRUCTURE_NUKER
                    }
                });
                if (theseNukes) {
                    if (theseNukes.length > 0) {
                        Memory.nukerList[thisRoom.name].push(theseNukes[0].id);
                    }
                }
            }

            if (Memory.nukerList[thisRoom.name][0] && thisRoom.terminal && Game.time % 1000 == 0) {
                var thisNuker = Game.getObjectById(Memory.nukerList[thisRoom.name][0]);
                var thisTerminal = thisRoom.terminal

                if (thisNuker.ghodium < thisNuker.ghodiumCapacity && (thisTerminal.store[RESOURCE_GHODIUM] + thisNuker.ghodium) < thisNuker.ghodiumCapacity) {
                    //Buy more ghodium
                    var neededGhodium = thisNuker.ghodiumCapacity - (thisTerminal.store[RESOURCE_GHODIUM] + thisNuker.ghodium)
                    var terminalEnergy = thisTerminal.store[RESOURCE_ENERGY];
                    var FilteredOrders = Game.market.getAllOrders(order => order.resourceType == RESOURCE_GHODIUM && order.type == ORDER_SELL && Game.market.calcTransactionCost(neededGhodium, thisRoom.name, order.roomName) <= terminalEnergy);
                    if (FilteredOrders.length > 0) {
                        FilteredOrders.sort(orderPriceCompareBuying);
                        if (FilteredOrders[0].amount < neededGhodium) {
                            neededGhodium = FilteredOrders[0].amount;
                        }
                        Game.market.deal(FilteredOrders[0].id, neededGhodium, thisRoom.name);
                    }
                }
            }

            //Review market data and sell to buy orders
            if (Game.time % 1000 == 0 && thisRoom.terminal) {
                market_buyers.run(thisRoom, thisRoom.terminal, Memory.mineralList[thisRoom.name]);
            }

            //Handle Links
            if (Memory.linkList[thisRoom.name][0]) {
                var roomLink = Game.getObjectById(Memory.linkList[thisRoom.name][0]);
                if (roomLink) {
                    if (roomLink.energy >= 50 && roomLink.cooldown == 0) {
                        var receiveLink = Game.getObjectById(Memory.linkList[thisRoom.name][1]);
                        if (receiveLink) {
                            roomLink.transferEnergy(receiveLink);
                        }
                    }
                }
            }

            //Handle Power Spawn
            if (Memory.powerSpawnList[thisRoom.name][0]) {
                var thisPowerSpawn = Game.getObjectById(Memory.powerSpawnList[thisRoom.name][0]);
                if (thisPowerSpawn) {
                    if (thisPowerSpawn.energy >= 50 && thisPowerSpawn.power > 0) {
                        thisPowerSpawn.processPower();
                    }
                }
            }

            //Update advanced script rooms
            if ((thisRoom.storage && Memory.linkList[thisRoom.name].length == 2) && Memory.RoomsAt5.indexOf(thisRoom.name) == -1) {
                Memory.RoomsAt5.push(thisRoom.name)
            } else if ((!thisRoom.storage || Memory.linkList[thisRoom.name].length < 2) && Memory.RoomsAt5.indexOf(thisRoom.name) != -1) {
                //This room shouldn't be on this list
                var thisRoomIndex = Memory.RoomsAt5.indexOf(thisRoom.name)
                Memory.RoomsAt5.splice(thisRoomIndex, 1);
            }

            //Update creep configs if energy cap has changed
            if (Memory.RoomsAt5.indexOf(thisRoom.name) == -1) {
                Memory.energyCap[thisRoom.name] = [];
                Memory.energyCap[thisRoom.name].push(thisRoom.energyCapacityAvailable);
                recalculateBestWorker(Memory.energyCap[thisRoom.name][0]);
            }

            //Check through flags to see if far mining has been requested
            if (Game.flags[thisRoom.name + "FarMining"]) {
                if (!Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining"].pos.roomName]) {
                    Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining"].pos.roomName] = false;
                }
            }
            if (Game.flags[thisRoom.name + "FarMining2"]) {
                if (!Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining2"].pos.roomName]) {
                    Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining2"].pos.roomName] = false;
                }
            }
            if (Game.flags[thisRoom.name + "FarMining3"]) {
                if (!Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining3"].pos.roomName]) {
                    Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining3"].pos.roomName] = false;
                }
            }
            if (Game.flags[thisRoom.name + "FarMining4"]) {
                if (!Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining4"].pos.roomName]) {
                    Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining4"].pos.roomName] = false;
                }
            }
            if (Game.flags[thisRoom.name + "FarMining5"]) {
                if (!Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining5"].pos.roomName]) {
                    Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining5"].pos.roomName] = false;
                }
            }
            if (Game.flags[thisRoom.name + "FarMining6"]) {
                if (!Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining6"].pos.roomName]) {
                    Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining6"].pos.roomName] = false;
                }
            }

            //if (Game.flags[thisRoom.name + "FarGuard"]) {
            //Memory.FarGuardNeeded[thisRoom.name] = true;
            //}
        }

        if (Memory.isSpawning == null) {
            Memory.isSpawning = false;
        }

        if (Game.flags[thisRoom.name + "SendHelper"]) {
            spawn_BuildInstruction.run(Game.spawns[i], 'helper', Game.flags[thisRoom.name + "SendHelper"].pos.roomName);
        }

        if (!Memory.isSpawning) {
            if (Memory.RoomsAt5.indexOf(thisRoom.name) == -1) {
                spawn_BuildCreeps.run(Game.spawns[i], bestWorkerConfig, thisRoom, Memory.roomCreeps[thisRoom.name]);
            } else {
                spawn_BuildCreeps5.run(Game.spawns[i], thisRoom, Memory.roomCreeps[thisRoom.name]);
            }
        }

        if (!Memory.isSpawning) {
            if (Game.flags[thisRoom.name + "FarMining"] || Game.flags[thisRoom.name + "FarGuard"]) {
                //Run farMining spawn
                spawn_BuildFarCreeps.run(Game.spawns[i], thisRoom);
            }
        }

        Memory.isSpawning = false;

        Memory.RoomsRun.push(thisRoom.name);
    }

    var towers = _.filter(Game.structures, (structure) => structure.structureType == STRUCTURE_TOWER);
    if (towers.length) {
        var alreadySearched = [];
        for (var y = 0; y < towers.length; y++) {
            if (alreadySearched.indexOf(towers[y].room.name) < 0) {
                //Check for hostiles in this room
                var hostiles = towers[y].room.find(FIND_HOSTILE_CREEPS, {
                    filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
                });
                if (hostiles.length > 0 && Memory.roomsUnderAttack.indexOf(towers[y].room.name) === -1) {
                    Memory.roomsUnderAttack.push(towers[y].room.name);
                    if (hostiles[0].owner.username == 'Invader' || (hostiles[0].hitsMax <= 100 && hostiles.length == 1)) {
                        Memory.roomsPrepSalvager.push(towers[y].room.name);
                    } else if (Memory.RoomsAt5.indexOf(towers[y].room.name) == -1 && (hostiles[0].hits > 100 || hostiles.length > 1)) {
                        //No good combat code! SAFE MODE!
                        if (!towers[y].room.controller.safeMode) {
                            towers[y].room.controller.activateSafeMode();
                        }
                    }
                } else if (hostiles.length == 0) {
                    var UnderAttackPos = Memory.roomsUnderAttack.indexOf(towers[y].room.name);
                    var salvagerPos = Memory.roomsPrepSalvager.indexOf(towers[y].room.name);
                    if (UnderAttackPos >= 0) {
                        Memory.roomsUnderAttack.splice(UnderAttackPos, 1);
                    }
                    if (salvagerPos >= 0) {
                        Memory.roomsPrepSalvager.splice(salvagerPos, 1);
                    }
                }

                if (Memory.roomsUnderAttack.indexOf(towers[y].room.name) > -1 && !towers[y].room.controller.safeMode) {
                    Memory.attackDuration = Memory.attackDuration + 1;
                    if (Memory.attackDuration >= 250 && !Memory.warMode) {
                        Memory.warMode = true;
                        Game.notify('War mode was enabled due to a long attack at ' + towers[y].room.name + '.');
                    }
                } else if (Memory.roomsUnderAttack.indexOf(towers[y].room.name) == -1 && Memory.attackDuration >= 250 && Memory.roomsUnderAttack.length > 0 && !Game.flags[towers[y].room.name + "eFarGuard"]) {
                    Game.rooms[Memory.roomsUnderAttack[0]].createFlag(25, 25, towers[y].room.name + "eFarGuard");
                } else if (Memory.roomsUnderAttack.length == 0) {
                    Memory.attackDuration = 0;
                    if (Game.flags[towers[y].room.name + "eFarGuard"]) {
                        Game.flags[towers[y].room.name + "eFarGuard"].remove();
                    }
                }
                alreadySearched.push(towers[y].room.name);
            }
            tower_Operate.run(towers[y], Memory.attackDuration);
        }
    }

    //Average(new) = Average(old) + (value(new) - average(old)) / size(new)
    Memory.totalTicksSpawnRecorded = Memory.totalTicksSpawnRecorded + 1;
    var totalSpawnCPU = Game.cpu.getUsed() - preSpawnCPU;
    Memory.averageUsedSpawnCPU = Memory.averageUsedSpawnCPU + ((totalSpawnCPU - Memory.averageUsedSpawnCPU) / Memory.totalTicksSpawnRecorded)

    Memory.RoomsRun = [];
    Memory.roomCreeps = new Object();
    //Memory.creepInQue = [];

    if (Game.flags["ClaimThis"]) {
        spawn_BuildInstruction.run(instructionSpawn, 'claim', Game.flags["ClaimThis"].pos.roomName);
    }

    if (Game.flags["BuildThis"]) {
        var sitesOnTile = Game.flags["BuildThis"].pos.lookFor(LOOK_CONSTRUCTION_SITES);
        if (sitesOnTile.length) {
            spawn_BuildInstruction.run(instructionSpawn, 'construct', sitesOnTile[0].id, '', Game.flags["BuildThis"].pos.roomName);
        }
    }

    if (Game.flags["DrainTurret"]) {
        spawn_BuildInstruction.run(instructionSpawn, 'tDrain', Game.flags["DrainTurret"].pos.roomName);
    }

    if (Game.flags["RemoveKebab"]) {
        spawn_BuildInstruction.run(instructionSpawn, 'removeKebab', Game.flags["RemoveKebab"].pos.roomName);
    }

    if (Game.flags["Loot"]) {
        spawn_BuildInstruction.run(instructionSpawn, 'loot', Game.flags["Loot"].pos.roomName, '', instructionSpawn.room.name);
    }

    if (Game.flags["SignThis"]) {
        spawn_BuildInstruction.run(instructionSpawn, 'vandalize', '', '', '');
    }

    if (Game.flags["WallThis"]) {
        spawn_BuildInstruction.run(instructionSpawn, 'trump', Game.flags["WallThis"].pos.roomName, '', instructionSpawn.room.name);
    }

    if (Game.flags["Assault"]) {
        spawn_BuildInstruction.run(instructionSpawn, 'assault', Game.flags["Assault"].pos.roomName, '', instructionSpawn.room.name);
    }

    if (Game.market.credits > 1500000 && Game.time % 1000 == 0) {
        //Periodically look for cheap subscription tokens
        var availableCredits = Game.market.credits
        if (availableCredits > 2500000) {
            availableCredits = 2500000;
        }
        var FilteredOrders = Game.market.getAllOrders(order => order.resourceType == SUBSCRIPTION_TOKEN && order.type == ORDER_SELL && order.price <= availableCredits);
        if (FilteredOrders.length > 0) {
            FilteredOrders.sort(orderPriceCompare);

            if (Game.market.deal(FilteredOrders[0].id, 1) == OK) {
                Game.notify('A subscription token was purchased for ' + FilteredOrders[0].price + ' credits');
            }
        }
    }

    //Globally controlls all creeps in all rooms
    //Log average CPU for creep processes in memory.
    var preCreepCPU = Game.cpu.getUsed();
    for (var name in Game.creeps) {
        var creep = Game.creeps[name];
        switch (creep.memory.priority) {
            case 'farClaimer':
            case 'farMiner':
            case 'farMule':
            case 'farGuard':
            case 'farClaimerNearDeath':
            case 'farMinerNearDeath':
            case 'farMuleNearDeath':
            case 'farGuardNearDeath':
                creep_farMining.run(creep);
                break;
            case 'claimer':
                creep_claimer.run(creep);
                break;
            case 'TowerDrainer':
                creep_towerDrainer.run(creep);
                break;
            case 'constructor':
                creep_constructor.run(creep);
                break;
            case 'removeKebab':
                creep_Kebab.run(creep);
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
            case 'trump':
                creep_trump.run(creep);
                break;
            case 'assattacker':

                break;

            case 'asshealer':

                break
            default:
                if (Memory.RoomsAt5.indexOf(creep.room.name) === -1) {
                    if (Game.spawns.length < 5) {
                        creep_work.run(creep, 5);
                    } else {
                        creep_work.run(creep, 5);
                    }
                } else {
                    if (creep.memory.priority == 'harvester' || creep.memory.priority == 'builder') {
                        //In case of emergency
                        creep_work.run(creep, 5);
                    } else {
                        creep_work5.run(creep);
                    }
                }
        }
    }
    //});

    //Log average creep CPU usage
    Memory.totalTicksCreepRecorded = Memory.totalTicksCreepRecorded + 1;
    var totalCreepCPU = Game.cpu.getUsed() - preCreepCPU;
    Memory.averageUsedCreepCPU = Memory.averageUsedCreepCPU + ((totalCreepCPU - Memory.averageUsedCreepCPU) / Memory.totalTicksCreepRecorded)

    //Log average total CPU usage in memory.
    var thisTickCPU = Game.cpu.getUsed();
    //Average(new) = Average(old) + (value(new) - average(old)) / size(new)
    Memory.totalTicksRecorded = Memory.totalTicksRecorded + 1;
    Memory.averageUsedCPU = Memory.averageUsedCPU + ((thisTickCPU - Memory.averageUsedCPU) / Memory.totalTicksRecorded)

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
    if (!Memory.creepInQue) {
        Memory.creepInQue = [];
        console.log('creepInQue Defaulted');
    }
    if (!Memory.roomsUnderAttack) {
        Memory.roomsUnderAttack = [];
        console.log('roomsUnderAttack Defaulted');
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
    if (!Memory.whiteList) {
        Memory.whiteList = ['cyberblast', 'SirLovi', 'Asku', 'Kazume', 'Noxeth', 'MrDave', 'Telemac', 'Xephael', 'Zoiah', 'fsck-u', 'FaceWound', 'forkmantis', 'Migaaresno', 'xAix1999', 'silentpoots', 'arguinyano', 'OokieCookie', 'OverlordQ', 'Nibinhilion', 'Crowsbane', 'Yew', 'BogdanBiv', 's1akr', 'Pandabear41', 'Logmadr', 'Patrik', 'novice', 'Conquest', 'ofirl', 'GeorgeBerkeley', 'TTR', 'tynstar', 'K-C', 'Hoekynl', 'Sunri5e', 'AgOrange', 'distantcam', 'Lisp', 'bbdMinimbl', 'Twill', 'Logxen', 'miR', 'Spedwards', 'Krazyfuq', 'Icesory', 'chobobobo', 'deft-code', 'mmmd', 'DKPlugins', 'pavelnieks', 'buckley310', 'almaravarion', 'SSH', 'Perrytheplatypus', 'Jnesselr', 'ryagas', 'xXtheguy52Xx', 'SEATURTLEKING', 'DasBrain', 'C00k1e_93', 'Currency', 'Vykook', 'shedletsky', 'Aranatha', 'Montblanc'];
    }
    //Boolean
    if (Memory.warMode == null) {
        Memory.warMode = false;
    }
    if (Memory.guardType == null) {
        Memory.guardType = false;
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
    if (!Memory.nukerList) {
        Memory.nukerList = new Object();
    }
    if (!Memory.energyCap) {
        Memory.energyCap = new Object();
    }
    if (!Memory.roomCreeps) {
        Memory.roomCreeps = new Object();
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