var spawn_BuildCreeps = {
	run: function(spawn) {
		var harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester');
		var builders = _.filter(Game.creeps, (creep) => creep.memory.role == 'builder');
		var upgraders = _.filter(Game.creeps, (creep) => creep.memory.role == 'upgrader');

		if((harvesters.length < 2 || builders.length < 2 || upgraders.length < 2) && spawn.canCreateCreep([WORK,CARRY,MOVE]) == 'OK') {
			var prioritizedRole = 'harvester';
			if(builders.length < 2) {
				prioritizedRole = 'builder';
			} 
			else if (upgraders.length < 2) {
				prioritizedRole = 'upgrader';
			}

			spawn.createCreep([WORK,CARRY,MOVE], undefined, {role: prioritizedRole});
		}
	}
}