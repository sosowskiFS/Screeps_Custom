//Instructions:
//require('special').specialInstruction('claim', 'RoomName');
//require('special').specialInstruction('vandalize', [ArrayOfRooms], 'message');
//require('special').specialInstruction('construct', 'constructionID', 'RoomName');

//Creeps
var creep_work = require('creep.work');
var creep_work5 = require('creep.work5');
var creep_combat = require('creep.combat');
var creep_claimer = require('creep.claimer');
var creep_vandal = require('creep.vandal');
var creep_constructor = require('creep.constructor');

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

//Initalize Memory vars
Memory.roomsUnderAttack = [];
Memory.roomsPrepSalvager = [];
//Manually add room names to this array when links have been constructed
//Remember to update creeps5+ with link/storage/source IDs
Memory.roomsReadyFor5 = ['E3N61', 'E4N61'];
Memory.E3N61Towers = ['5835c6ded8b12ea315a3b72a', '583af7158d788e033383c644'];
Memory.E3N61RepairRange = 20;
Memory.E3N61EnergyCap = -1;
//Format - [0] = send [1] = receive
Memory.E3N61Links = ['583adab41b9ba6bd6923fc74', '583af8fa827c44087d11fca1'];
Memory.E4N61Links = ['5846b97fa223c8f26df40a15', '5846c2f5b4d42f365e1c0d50'];
Memory.E4N61Towers = ['583fb149392f104960ed133f', '584791ab582cb9b014b7957a'];
Memory.E4N61RepairRange = 50;
Memory.E4N61EnergyCap = -1;

const profiler = require('screeps-profiler');

//Ctrl+Alt+f to autoformat documents.

//Constants : http://support.screeps.com/hc/en-us/articles/203084991-API-Reference
//Creep calculator : http://codepen.io/findoff/full/RPmqOd/
//Profiler commands : https://github.com/gdborton/screeps-profiler

profiler.enable();
module.exports.loop = function() {
    profiler.wrap(function() {
        for (var name in Memory.creeps) {
            if (!Game.creeps[name]) {
                delete Memory.creeps[name];
                console.log('Clearing non-existing creep memory:', name);
            }
        }

        //Loop through all spawns
        for (var i in Game.spawns) {
            var thisRoom = Game.spawns[i].room;
            var controllerLevel = thisRoom.controller.level;

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
                }
            }

            //Check for hostiles in this room
            var hostiles = thisRoom.find(FIND_HOSTILE_CREEPS);
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
                    case 'E4N61':
                        previousEnergyCap = Memory.E4N61EnergyCap;
                }
                if (thisRoom.energyCapacityAvailable != previousEnergyCap) {
                    previousEnergyCap = thisRoom.energyCapacityAvailable;
                    recalculateBestWorker(previousEnergyCap);
                    switch (thisRoom.name) {
                        case 'E4N61':
                            Memory.E4N61EnergyCap = previousEnergyCap;
                    }
                }
            }

            //Expansion not finished : Low priority. Can do manually for now.

            /*if(lastControllerLevel != roomReference.controller.level){
                spawn_AutoExpand.run(Game.spawns['Spawn_Capital'], roomReference.controller.level);
                lastControllerLevel = roomReference.controller.level;
            }*/

            if (Memory.roomsReadyFor5.indexOf(thisRoom.name) === -1) {
                spawn_BuildCreeps.run(Game.spawns[i], bestWorkerConfig, thisRoom);
            } else {
                spawn_BuildCreeps5.run(Game.spawns[i], thisRoom);
            }

            //Find is moderately expensive, run it only every 100 ticks for new tower detection.
            /*if (Game.time % 100 == 0) {
                Memory.towerList = thisRoom.find(FIND_MY_STRUCTURES, {
                    filter: {
                        structureType: STRUCTURE_TOWER
                    }
                });
            }*/
            var towerList;
            var repairRange = 20;
            switch (thisRoom.name) {
                case 'E3N61':
                    towerList = Memory.E3N61Towers;
                    repairRange = Memory.E3N61RepairRange;
                    var sendLink = Game.getObjectById(Memory.E3N61Links[0]);
                    var receiveLink = Game.getObjectById(Memory.E3N61Links[1]);
                    if (sendLink) {
                        if (sendLink.energy >= 120 && sendLink.cooldown == 0) {
                            sendLink.transferEnergy(receiveLink);
                        }
                    }
                    break;
                case 'E4N61':
                    towerList = Memory.E4N61Towers;
                    repairRange = Memory.E4N61RepairRange;
                    var sendLink = Game.getObjectById(Memory.E4N61Links[0]);
                    var receiveLink = Game.getObjectById(Memory.E4N61Links[1]);
                    if (sendLink) {
                        if (sendLink.energy >= 120 && sendLink.cooldown == 0) {
                            sendLink.transferEnergy(receiveLink);
                        }
                    }
                    break;
            }
            if (towerList) {
                if (towerList.length > 0) {
                    towerList.forEach(function(thisTower) {
                        //tower_Operate.run(thisTower.id, RAMPART_HITS_MAX[controllerLevel], thisRoom);
                        tower_Operate.run(thisTower, thisRoom, repairRange);
                    });
                }
            }
        }

        //Globally controlls all creeps in all rooms
        for (var name in Game.creeps) {
            var creep = Game.creeps[name];
            if (creep.memory.priority == 'claimer') {
                creep_claimer.run(creep);
            } else if (creep.memory.priority == 'vandal') {
                creep_vandal.run(creep);
            } else if (creep.memory.priority == 'constructor') {
                creep_constructor.run(creep);
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
                        if (creep.memory.fromSpawn) {
                            creep_work5.run(creep, creep.memory.fromSpawn);
                        } else {
                            creep_work5.run(creep, Game.spawns[i]);
                        }
                    }
                }
            }
        }
    });
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