//Creeps
var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');

//Spawning
var spawn_BuildCreeps = require('spawn.BuildCreeps');
var previousEnergyCap = -1;
var bestWorkerConfig = [WORK,CARRY,MOVE];
var roomReference = Game.spawns['Spawn_Capital'].room;

//Expansion
var spawn_AutoExpand = require('spawn.AutoExpand');
var lastControllerLevel = 1;

//Towers
var tower_Operate = require('tower.Operate');
var towers = [];

var currentTick = 0;

module.exports.loop = function () {

    //TODO: Cycle creep role in memory if creep is unable to do job? If creep lands on upgrading they'll never leave, maybe pass that.

    //Update creep configs if energy cap has changed
    if(roomReference.energyCapacityAvailable != previousEnergyCap){
        previousEnergyCap = roomReference.energyCapacityAvailable;
        recalculateBestWorker();       
    }

    //Expansion not finished : Low priority. Can do manually for now.

    /*if(lastControllerLevel != roomReference.controller.level){
        spawn_AutoExpand.run(Game.spawns['Spawn_Capital'], roomReference.controller.level);
        lastControllerLevel = roomReference.controller.level;
    }*/

    spawn_BuildCreeps.run(Game.spawns['Spawn_Capital'], bestWorkerConfig);

    //TODO : Rewrite creeps to write targets to memory instead of using .find every tick.
    for(var name in Game.creeps) {
        var creep = Game.creeps[name];
        if(creep.memory.role == 'harvester') {
            roleHarvester.run(creep);
        }
        if(creep.memory.role == 'upgrader') {
            roleUpgrader.run(creep);
        }
        if(creep.memory.role == 'builder') {
            roleBuilder.run(creep);
        }
    }

    //Find is moderately expensive, run it only every 100 ticks for new tower detection.
    //Something's fucky with tick measuring. See if there's a better way to measure time.
    //if ( currentTick == 100 ){
        var towers = roomReference.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_TOWER }
        });
    //}
    
    if(towers.length > 0) {
        towers.forEach(function(thisTower) {
            tower_Operate.run(thisTower);
        });
    }

    /*currentTick++;
    if( currentTick >= 100 ) {
        currentTick = 0;
    }*/
}

function recalculateBestWorker(){
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
    while((EnergyRemaining / 200) >= 1){
        bestWorkerConfig.push(MOVE,CARRY,WORK);
        EnergyRemaining = EnergyRemaining - 200;
    }
}