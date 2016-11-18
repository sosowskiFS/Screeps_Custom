//Creeps
var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');

//Structures
var spawn_BuildCreeps = require('spawn.BuildCreeps')
var previousEnergyCap = -1;
var bestWorkerConfig = [WORK,CARRY,MOVE];

module.exports.loop = function () {

    /*var tower = Game.getObjectById('TOWER_ID');
    if(tower) {
        var closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (structure) => structure.hits < structure.hitsMax
        });
        if(closestDamagedStructure) {
            tower.repair(closestDamagedStructure);
        }

        var closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        if(closestHostile) {
            tower.attack(closestHostile);
        }
    }*/

    //Update creep configs if energy cap has changed
    if(Game.spawns['Spawn_Capital'].energyCapacity != previousEnergyCap){
        previousEnergyCap = Game.spawns['Spawn_Capital'].energyCapacity;
        recalculateBestWorker();       
    }

    spawn_BuildCreeps.run(Game.spawns['Spawn_Capital'], bestWorkerConfig);

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