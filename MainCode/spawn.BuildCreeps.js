var spawn_BuildCreeps = {
	run: function(spawn, bestWorker) {
		for(var name in Memory.creeps) {
        	if(!Game.creeps[name]) {
            	delete Memory.creeps[name];
            	console.log('Clearing non-existing creep memory:', name);
        	}
    	}

		var harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester');
		var builders = _.filter(Game.creeps, (creep) => creep.memory.role == 'builder');
		var upgraders = _.filter(Game.creeps, (creep) => creep.memory.role == 'upgrader');

		if((harvesters.length < 3 || builders.length < 4 || upgraders.length < 2) && spawn.canCreateCreep(bestWorker) == OK) {
			var prioritizedRole = 'harvester';
			if(harvesters.length < 3){
				prioritizedRole = 'harvester';
			}
			else if(upgraders.length < 2) {
				prioritizedRole = 'upgrader';
			} 
			else if (builders.length < 4) {
				prioritizedRole = 'builder';
			}

			spawn.createCreep(bestWorker, undefined, {role: prioritizedRole});
		}
	}
};

module.exports = spawn_BuildCreeps;