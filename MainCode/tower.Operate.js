var tower_Operate = {
    run: function(tower, improveMax) {
        var thisTower = Game.getObjectById(tower);

        var closestHostile = thisTower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        if (closestHostile) {
            thisTower.attack(closestHostile);
        } else if (thisTower.energy > (thisTower.energyCapacity * 0.75)) {
            //Save 75% of the tower's energy to use on repelling attackers
            var closestDamagedStructure = thisTower.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (structure) => (structure.hits < structure.hitsMax) && (structure.hits < improveMax)
            });
            if (closestDamagedStructure) {
                thisTower.repair(closestDamagedStructure);
            } else {
                //Renable this later if it becomes needed
                /*var closestDamagedCreep = thisTower.pos.findClosestByRange(FIND_MY_CREEPS, {
                    filter: (creep) => creep.hits < creep.hitsMax
                });
                if (closestDamagedCreep) {
                    thisTower.heal(closestDamagedCreep);
                }*/
            }
        }

    }
};

module.exports = tower_Operate;