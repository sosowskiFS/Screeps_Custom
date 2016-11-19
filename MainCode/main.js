//Creeps
var creep_work = require('creep.work');

//Spawning
var spawn_BuildCreeps = require('spawn.BuildCreeps');
var previousEnergyCap = -1;
var bestWorkerConfig = [WORK, CARRY, MOVE];
//var roomReference = Game.spawns['Spawn_Capital'].room;

//Expansion
var spawn_AutoExpand = require('spawn.AutoExpand');
var lastControllerLevel = 1;

//Towers
var tower_Operate = require('tower.Operate');

//Ctrl+Alt+f to autoformat documents.

//Constants : http://support.screeps.com/hc/en-us/articles/203084991-API-Reference

module.exports.loop = function() {
    //Loop through all spawns
    for (var i in Game.spawns) {
        var thisRoom = Game.spawns[i].room;
        var controllerLevel = thisRoom.controller.level;

        //Update creep configs if energy cap has changed
        if (thisRoom.energyCapacityAvailable != previousEnergyCap) {
            previousEnergyCap = thisRoom.energyCapacityAvailable;
            recalculateBestWorker();
        }

        //Expansion not finished : Low priority. Can do manually for now.

        /*if(lastControllerLevel != roomReference.controller.level){
            spawn_AutoExpand.run(Game.spawns['Spawn_Capital'], roomReference.controller.level);
            lastControllerLevel = roomReference.controller.level;
        }*/

        spawn_BuildCreeps.run(Game.spawns[i], bestWorkerConfig);

        //Find is moderately expensive, run it only every 100 ticks for new tower detection.
        if (Game.time % 100 == 0) {
            Memory.towerList = thisRoom.find(FIND_MY_STRUCTURES, {
                filter: {
                    structureType: STRUCTURE_TOWER
                }
            });
        }
        if (Memory.towerList) {
            if (Memory.towerList.length > 0) {
                Memory.towerList.forEach(function(thisTower, RAMPART_HITS_MAX(controllerLevel)) {
                    tower_Operate.run(thisTower.id);
                });
            }
        }
    }

    //Globally controlls all creeps in all rooms
    for (var name in Game.creeps) {
        var creep = Game.creeps[name];
        creep_work.run(creep);
    }
}

function recalculateBestWorker() {
    //Move : 50
    //Work : 100
    //Carry : 50 (50 resource/per)
    //Attack : 80
    //Ranged_Attack : 150
    //Heal : 250
    //Claim : 600 (Don't automate)
    //Tough : 10

    //1 Full balanced worker module : MOVE, CARRY, WORK - 200pts
    var EnergyRemaining = previousEnergyCap;
    bestWorkerConfig = [];
    while ((EnergyRemaining / 200) >= 1) {
        bestWorkerConfig.push(MOVE, CARRY, WORK);
        if (bestWorkerConfig.length > 50) {
            while (bestWorkerConfig.length > 50) {
                bestWorkerConfig.splice(-1, 1)
            }
            break;
        }
        EnergyRemaining = EnergyRemaining - 200;
    }
    //Make the modules pretty
    bestWorkerConfig.sort();
}