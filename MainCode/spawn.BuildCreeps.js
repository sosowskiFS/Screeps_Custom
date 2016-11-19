var spawn_BuildCreeps = {
	run: function(spawn, bestWorker) {
		for (var name in Memory.creeps) {
			if (!Game.creeps[name]) {
				delete Memory.creeps[name];
				console.log('Clearing non-existing creep memory:', name);
			}
		}

		//TODO : Count creeps by room, not globally.
		var harvesters = _.filter(Game.creeps, (creep) => creep.memory.role == 'harvester');
		var builders = _.filter(Game.creeps, (creep) => creep.memory.role == 'builder');
		var upgraders = _.filter(Game.creeps, (creep) => creep.memory.role == 'upgrader');

		var bareMinConfig = [WORK, CARRY, MOVE];

		if ((harvesters.length == 0 && builders.length == 0 && upgraders.length == 0) && spawn.canCreateCreep(bareMinConfig) == OK) {
			//In case of complete destruction, make a minimum viable worker
			spawn.createCreep(bareMinConfig, undefined, {
				role: 'harvester'
			});
		}

		if ((harvesters.length < 2 || builders.length < 2 || upgraders.length < 2) && spawn.canCreateCreep(bestWorker) == OK) {
			var prioritizedRole = 'harvester';
			if (harvesters.length < 2) {
				prioritizedRole = 'harvester';
			} else if (upgraders.length < 2) {
				prioritizedRole = 'upgrader';
			} else if (builders.length < 2) {
				prioritizedRole = 'builder';
			}

			spawn.createCreep(bestWorker, undefined, {
				role: prioritizedRole
			});
		}
	}
};

module.exports = spawn_BuildCreeps;