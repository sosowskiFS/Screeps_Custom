var tower_Operate = {
	run: function(tower) {
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
    	}

    	var closestDamagedCreep = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
    		filter: (creep) => creep.hits < creep.hitsMax
    	});
    	if(closestDamagedCreep) {
    		tower.heal(closestDamagedCreep);
    	}
	};
module.exports = tower_Operate;