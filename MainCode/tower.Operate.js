var tower_Operate = {
    run: function(tower) {
        var thisTower = Game.getObjectById(tower);

        var closestHostile = thisTower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        if (closestHostile) {
            thisTower.attack(closestHostile);
        } else {
            var closestDamagedStructure = thisTower.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (structure) => structure.hits < structure.hitsMax
            });
            if (closestDamagedStructure) {
                thisTower.repair(closestDamagedStructure);
            } else {
                var closestDamagedCreep = thisTower.pos.findClosestByRange(FIND_MY_CREEPS, {
                    filter: (creep) => creep.hits < creep.hitsMax
                });
                if (closestDamagedCreep) {
                    thisTower.heal(closestDamagedCreep);
                }
            }
        }

    }
};

module.exports = tower_Operate;