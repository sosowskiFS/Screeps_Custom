var spawn_BuildInstruction = {
	run: function(spawn, instruction, params, thisRoom, params2 = '') {
		switch (instruction) {
			case 'claim':
				if (spawn.canCreateCreep([MOVE, CLAIM]) == OK) {
					spawn.createCreep([MOVE, CLAIM], undefined, {
						priority: 'claimer',
						destination: params
					});
					console.log('Claim executed');
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
					console.log('Vandalize executed');
				} else {
					console.log('Could not execute vandalize. Spawn cannot create creep.');
				}
				break;
			case 'construct':
				if (spawn.canCreateCreep([MOVE,MOVE,MOVE,MOVE,MOVE,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY]) == OK) {
					spawn.createCreep([MOVE,MOVE,MOVE,MOVE,MOVE,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY], undefined, {
						priority: 'constructor',
						siteID: params,
						targetRoom: params2
					});
					console.log('Construct executed');
				} else {
					console.log('Could not execute constructor. Spawn cannot create creep.');
				}
				break;
		}
	}
};

module.exports = spawn_BuildInstruction;