//Instructions:
//require('special').specialInstruction('claim', [PathOfRooms]);
//require('special').specialInstruction('vandalize', [ArrayOfRooms], 'message');
//require('special').specialInstruction('construct', 'constructionID', [PathOfRooms]);
//require('special').specialInstruction('removeKebab', 'enemySpawnID', [PathOfRooms]);

//require('special').specialInstruction('construct', '584c12a6b14a695e0d9653e4', ['E3N60', 'E3N60', 'E2N61', 'E1N61', 'E0N61', 'E0N62', 'E0N63', 'E1N63'])

//require('special').specialInstruction('removeKebab', '58366a7b84afc9937e209535', ['E3N60', 'E2N60', 'E2N61', 'E1N61', 'E0N61', 'E0N62', 'E0N63', 'E1N63', 'E2N63']);

//Creeps
var creep_work = require('creep.work');
var creep_work5 = require('creep.work5');
var creep_combat = require('creep.combat');
var creep_claimer = require('creep.claimer');
var creep_vandal = require('creep.vandal');
var creep_constructor = require('creep.constructor');
var creep_Kebab = require('creep.removeKebab');

//Spawning
var spawn_BuildCreeps = require('spawn.BuildCreeps');
var spawn_BuildCreeps5 = require('spawn.BuildCreeps5');
var spawn_BuildInstruction = require('spawn.BuildInstruction');
var bestWorkerConfig = [WORK, CARRY, MOVE];
//var roomReference = Game.spawns['Spawn_Capital'].room;

//Expansion
var spawn_AutoExpand = require('spawn.AutoExpand');
var lastControllerLevel = 1;

//Towers
var tower_Operate = require('tower.Operate');

//Market
var market_buyers = require('market.FindBuyers');

//Initalize Memory vars

//Manually add room names to this array when links have been constructed
//Remember to update creeps5+ with link/storage/source IDs
//Memory.roomsReadyFor5 = ['E3N61', 'E4N61', 'E1N63'];
Memory.E3N61EnergyCap = -1;
//Format - [0] = send [1] = receive
//Memory.E3N61Links = ['583adab41b9ba6bd6923fc74', '583af8fa827c44087d11fca1'];
Memory.E3N61Terminals = ['58424a6ef6e01c883e9feb4b'];
Memory.E3N61SellOre = RESOURCE_ZYNTHIUM;
//Memory.E4N61Links = ['5846b97fa223c8f26df40a15', '5846c2f5b4d42f365e1c0d50'];
Memory.E4N61EnergyCap = -1;
Memory.E4N61Terminals = ['58511f42a4bd711272b69517'];
Memory.E4N61SellOre = RESOURCE_HYDROGEN;

Memory.E1N63EnergyCap = -1;
//Memory.E1N63Links = ['5851389331781392518d42f7', '5851488b9937b63f665b2f57'];
Memory.E1N63Terminals = ['5859644c969e3a483fff380a'];
Memory.E1N63SellOre = RESOURCE_LEMERGIUM;


//These will be checked, and defaults set only if undefined
//Memory.RoomsRun;
//Memory.creepInQue;
//Memory.roomsUnderAttack;
//Memory.roomsPrepSalvager;
//Memory.E1N63FarRoles;
//Boolean
//Memory.E1N63ClaimerNeeded;

//const profiler = require('screeps-profiler');

//Ctrl+Alt+f to autoformat documents.

//Constants : http://support.screeps.com/hc/en-us/articles/203084991-API-Reference
//Creep calculator : http://codepen.io/findoff/full/RPmqOd/
//Profiler commands : https://github.com/gdborton/screeps-profiler

//profiler.enable();
module.exports.loop = function() {
    //profiler.wrap(function() {
        for (var name in Memory.creeps) {
            if (!Game.creeps[name]) {
                delete Memory.creeps[name];
                console.log('Clearing non-existing creep memory:', name);
            }
        }

        //Set defaults on various memory values
        memCheck();

        //Loop through all spawns
        for (var i in Game.spawns) {
            var thisRoom = Game.spawns[i].room;
            var controllerLevel = thisRoom.controller.level;

            if (Memory.RoomsRun.indexOf(thisRoom.name) < 0) {
                //Execute special instruction written into console
                if (Memory.Instruction) {
                    switch (Memory.Instruction) {
                        case 'claim':
                        spawn_BuildInstruction.run(Game.spawns[i], Memory.Instruction, Memory.InstructionOps, thisRoom);
                        delete Memory.Instruction;
                        delete Memory.InstructionOps;
                        break;
                        case 'vandalize':
                        spawn_BuildInstruction.run(Game.spawns[i], Memory.Instruction, Memory.InstructionOps, thisRoom, Memory.InstructionOps2);
                        delete Memory.Instruction;
                        delete Memory.InstructionOps;
                        delete Memory.InstructionOps2;
                        break;
                        case 'construct':
                        spawn_BuildInstruction.run(Game.spawns[i], Memory.Instruction, Memory.InstructionOps, thisRoom, Memory.InstructionOps2);
                        delete Memory.Instruction;
                        delete Memory.InstructionOps;
                        delete Memory.InstructionOps2;
                        break;
                        case 'removeKebab':
                        spawn_BuildInstruction.run(Game.spawns[i], Memory.Instruction, Memory.InstructionOps, thisRoom, Memory.InstructionOps2);
                        delete Memory.Instruction;
                        delete Memory.InstructionOps;
                        delete Memory.InstructionOps2;
                        break;
                    }
                }

                //Check for hostiles in this room
                var hostiles = thisRoom.find(FIND_HOSTILE_CREEPS, {
                    filter: (creep) => (creep.getActiveBodyparts(WORK) > 0 || creep.getActiveBodyparts(CARRY) > 0 || creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0 || creep.getActiveBodyparts(HEAL) > 0) || (creep.hits <= 500)
                });
                if (hostiles.length > 0 && Memory.roomsUnderAttack.indexOf(thisRoom.name) === -1) {
                    Memory.roomsUnderAttack.push(thisRoom.name);
                    if (hostiles[0].owner.username == 'Invader') {
                        Memory.roomsPrepSalvager.push(thisRoom.name);
                    }
                } else if (hostiles.length == 0) {
                    var UnderAttackPos = Memory.roomsUnderAttack.indexOf(thisRoom.name);
                    var salvagerPos = Memory.roomsPrepSalvager.indexOf(thisRoom.name);
                    if (UnderAttackPos >= 0) {
                        Memory.roomsUnderAttack.splice(UnderAttackPos, 1);
                    }
                    if (salvagerPos >= 0) {
                        Memory.roomsPrepSalvager.splice(salvagerPos, 1);
                    }
                }

                //Update creep configs if energy cap has changed
                if (Memory.roomsReadyFor5.indexOf(thisRoom.name) === -1) {
                    var previousEnergyCap = -1;
                    switch (thisRoom.name) {
                        case 'E1N61':
                        previousEnergyCap = Memory.E1N63EnergyCap;
                    }
                    if (thisRoom.energyCapacityAvailable != previousEnergyCap) {
                        previousEnergyCap = thisRoom.energyCapacityAvailable;
                        recalculateBestWorker(previousEnergyCap);
                        switch (thisRoom.name) {
                            case 'E1N61':
                            Memory.E1N63EnergyCap = previousEnergyCap;
                        }
                    }
                }

                //Keep the towerList object updated
                if (Game.time % 100 == 0 || !Memory.towerList[thisRoom.name]) {
                    if (!Memory.towerList[thisRoom.name]) {
                        Memory.towerList[thisRoom.name] = [];
                    }
                    var roomTowers = thisRoom.find(FIND_MY_STRUCTURES, {
                        filter: { structureType: STRUCTURE_TOWER }
                    });
                    if (roomTowers){
                        var towerCounter = 0;
                        while (roomTowers[towerCounter]) {
                            if (Memory.towerList[thisRoom.name].indexOf(roomTowers[towerCounter].id) == -1) {
                                Memory.towerList[thisRoom.name].push(roomTowers[towerCounter].id)
                            }
                            towerCounter++;
                        }
                    }
                }

                //Get list of Sources
                if (Game.time % 250 == 0 || !Memory.sourceList[thisRoom.name]) {
                    Memory.sourceList[thisRoom.name] = [];
                    var roomSources = thisRoom.find(FIND_SOURCES);
                    var reverseFlag = false;
                    if(roomSources) {
                        var sourceCounter = 0;
                        while (roomSources[sourceCounter]) {
                            if (Memory.sourceList[thisRoom.name].indexOf(roomSources[sourceCounter].id) == -1) {
                                Memory.sourceList[thisRoom.name].push(roomSources[sourceCounter].id)
                            }
                            //If there is no storage unit nearby, this should not be #1
                            var nearContainers = roomSources[sourceCounter].pos.findInRange(FIND_MY_STRUCTURES, 3, {
                                filter : { structureType: STRUCTURE_STORAGE }
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
                if (Game.time % 250 == 0 || !Memory.linkList[thisRoom.name]) {
                    Memory.linkList[thisRoom.name] = [];
                    var roomLinks = thisRoom.find(FIND_MY_STRUCTURES, {
                        filter: { structureType: STRUCTURE_LINK }
                    });
                    var reverseFlag = false;
                    if(roomLinks) {
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

                //Get list of Storage Units
                if (Game.time % 250 == 0 || !Memory.storageList[thisRoom.name]) {
                    Memory.storageList[thisRoom.name] = [];
                    var storageUnits = thisRoom.find(FIND_MY_STRUCTURES, {
                        filter: { structureType: STRUCTURE_STORAGE }
                    });
                    if(storageUnits) {
                        if (storageUnits.length > 0) {
                            Memory.storageList[thisRoom.name].push(storageUnits[0].id);
                        }
                    }
                }

                //Get list of Minerals
                if (Game.time % 250 == 0 || !Memory.mineralList[thisRoom.name]) {
                    Memory.mineralList[thisRoom.name] = [];
                    var mineralLocations = thisRoom.find(FIND_MINERALS);
                    if(mineralLocations) {
                        if (mineralLocations.length > 0) {
                            Memory.mineralList[thisRoom.name].push(mineralLocations[0].id);
                        }
                    }
                }

                //Get list of Terminals
                if (Game.time % 250 == 0 || !Memory.terminalList[thisRoom.name]) {
                    Memory.terminalList[thisRoom.name] = [];
                    var terminalLocations = thisRoom.find(FIND_MY_STRUCTURES, {
                        filter: { structureType: STRUCTURE_TERMINAL }
                    });
                    if(terminalLocations) {
                        if (terminalLocations.length > 0) {
                            Memory.terminalList[thisRoom.name].push(terminalLocations[0].id);
                        }
                    }
                }

                //Review market data and sell to buy orders
                if (Game.time % 1000 == 0 && Memory.terminalList[thisRoom.name][0]) {
                    market_buyers.run(thisRoom, Game.getObjectById(Memory.terminalList[thisRoom.name][0]), Memory.mineralList[thisRoom.name]);
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
                
                //Handle Towers
                if (Memory.towerList[thisRoom.name]) {
                    if (Memory.towerList[thisRoom.name].length > 0) {
                        Memory.towerList[thisRoom.name].forEach(function(thisTower) {
                            //tower_Operate.run(thisTower.id, RAMPART_HITS_MAX[controllerLevel], thisRoom);
                            if (thisTower) {
                                tower_Operate.run(thisTower, thisRoom);
                            }
                        });
                    }
                }
            }

            if (Memory.storageList[thisRoom.name].length == 0 || Memory.linkList[thisRoom.name].length < 2) {
                spawn_BuildCreeps.run(Game.spawns[i], bestWorkerConfig, thisRoom);
            } else {
                spawn_BuildCreeps5.run(Game.spawns[i], thisRoom);
            }

            Memory.RoomsRun.push(thisRoom.name);
        }

        Memory.RoomsRun = [];
        //Memory.creepInQue = [];

        //Globally controlls all creeps in all rooms
        for (var name in Game.creeps) {
            var creep = Game.creeps[name];
            if (creep.memory.priority == 'farClaimer' || creep.memory.priority == 'farMiner' || creep.memory.priority == 'farMule') {
                creep_work5.run(creep);
            } else if (creep.memory.priority == 'claimer') {
                creep_claimer.run(creep);
            } else if (creep.memory.priority == 'vandal') {
                creep_vandal.run(creep);
            } else if (creep.memory.priority == 'constructor') {
                creep_constructor.run(creep);
            } else if (creep.memory.priority == 'removeKebab') {
                creep_Kebab.run(creep);
            } else if (creep.memory.priority == 'melee' || creep.memory.priority == 'ranged') {
                if (creep.memory.fromSpawn) {
                    creep_combat.run(creep, thisRoom, creep.memory.fromSpawn);
                } else {
                    creep_combat.run(creep, thisRoom, Game.spawns[i]);
                }
            } else {
                if (Memory.roomsReadyFor5.indexOf(creep.room.name) === -1) {
                    creep_work.run(creep);
                } else {
                    if (creep.memory.priority == 'harvester' || creep.memory.priority == 'builder') {
                        //In case of emergency
                        creep_work.run(creep);
                    } else {
                        creep_work5.run(creep);
                    }
                }
            }
        }
    //});
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
    while ((EnergyRemaining / 200) >= 1 || bestWorkerConfig.length >= 50) {
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
    if (!Memory.E1N63FarRoles) {
        Memory.E1N63FarRoles = [];
        console.log('E1N63FarRoles Defaulted');
    }
    //Boolean
    if (typeof Memory.E1N63ClaimerNeeded === 'undefined') {
        Memory.E1N63ClaimerNeeded = true;
        console.log('E1N63ClaimerNeeded Defaulted');
    }
    //Object
    if (!Memory.towerList) {
        Memory.towerList = new Object();
    }
    if (!Memory.sourceList) {
        Memory.sourceList = new Object();
    }
    if (!Memory.linkList) {
        Memory.linkList = new Object();
    }
    if (!Memory.storageList) {
        Memory.storageList = new Object();
    }
    if (!Memory.mineralList) {
        Memory.mineralList = new Object();
    }
    if (!Memory.terminalList) {
        Memory.terminalList = new Object();
    }
    if (!Memory.extractorList) {
        Memory.extractorList = new Object();
    }
}