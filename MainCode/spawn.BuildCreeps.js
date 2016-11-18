var spawn_BuildCreeps = {
	run: function(spawn) {
		for(var name in Memory.creeps) {
        	if(!Game.creeps[name]) {
            	delete Memory.creeps[name];
            	console.log('Clearing non-existing creep memory:', name);
        	}
    	}

		var harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester');
		var builders = _.filter(Game.creeps, (creep) => creep.memory.role == 'builder');
		var upgraders = _.filter(Game.creeps, (creep) => creep.memory.role == 'upgrader');

		if((harvesters.length < 3 || builders.length < 4 || upgraders.length < 4) && spawn.canCreateCreep([WORK,CARRY,MOVE]) == OK) {
			var prioritizedRole = 'harvester';
			if(harvesters.length < 3){
				prioritizedRole = 'harvester';
			}
			else if(upgraders.length < 4) {
				prioritizedRole = 'upgrader';
			} 
			else if (builders.length < 4) {
				prioritizedRole = 'builder';
			}

			spawn.createCreep([WORK,CARRY,MOVE], undefined, {role: prioritizedRole});
		}
	}
};

module.exports = spawn_BuildCreeps;