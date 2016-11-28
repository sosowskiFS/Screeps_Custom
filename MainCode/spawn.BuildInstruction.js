var spawn_BuildInstruction = {
	run: function(spawn, instruction, params, thisRoom) {
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
		}
	}
};

module.exports = spawn_BuildInstruction;