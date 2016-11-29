var spawn_BuildInstruction = {
	run: function(spawn, instruction, params, thisRoom, params2 = '') {
		switch (instruction) {
			case 'claim':
				if (spawn.canCreateCreep([MOVE, CLAIM]) == OK) {
					spawn.createCreep([MOVE, CLAIM], undefined, {
						priority: 'claimer',
						destination: params
					});
				} else {
					console.log('Could not execute claim. Spawn cannot create creep.');
				}
				break;
			case 'vandalize':
				if (spawn.canCreateCreep([TOUGH, MOVE]) == OK) {
					spawn.createCreep([TOUGH, MOVE], undefined, {
						priority: 'vandal',
						destinations: params,
						message: params2
					});
				} else {
					console.log('Could not execute vandalize. Spawn cannot create creep.');
				}
				break;
		}
	}
};

module.exports = spawn_BuildInstruction;