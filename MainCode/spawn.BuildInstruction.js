var spawn_BuildInstruction = {
	run: function(spawn, instruction, params, thisRoom = '', params2 = '') {
		switch (instruction) {
			case 'claim':
				if (spawn.canCreateCreep([MOVE, CLAIM]) == OK) {
					spawn.createCreep([MOVE, CLAIM], undefined, {
						priority: 'claimer',
						destination: params
					});
					console.log('Claim executed');
					if (Game.flags["ClaimThis"]) {
						Game.flags["ClaimThis"].remove();
					}
				} else {
					//console.log('Could not execute claim. Spawn cannot create creep.');
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
					//console.log('Could not execute vandalize. Spawn cannot create creep.');
				}
				break;
			case 'construct':
				var constructors = _.filter(Game.creeps, (creep) => creep.memory.priority == 'constructor');
				if (constructors.length < 3) {
					if (spawn.canCreateCreep([MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY]) == OK) {
						spawn.createCreep([MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY], undefined, {
							priority: 'constructor',
							siteID: params,
							destination: params2
						});
						console.log('Construct executed');
					} else {
						//console.log('Could not execute constructor. Spawn cannot create creep.');
					}
				}
				break;
			case 'removeKebab':
				if (spawn.canCreateCreep([MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK]) == OK) {
					spawn.createCreep([MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK], undefined, {
						priority: 'removeKebab',
						targetID: params,
						destination: params2
					});
					console.log('Kebab executed');
					if (Game.flags["RemoveKebab"]) {
						Game.flags["RemoveKebab"].remove();
					}
				} else {
					//console.log('Could not execute constructor. Spawn cannot create creep.');
				}
				break;
			case 'tDrain':
				if (spawn.canCreateCreep([TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL]) == OK) {
					spawn.createCreep([TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL], undefined, {
						priority: 'TowerDrainer',
						destination: params
					});
					if (Game.flags["DrainTurret"]) {
						Game.flags["DrainTurret"].remove();
					}
					console.log('Tower Drain Executed');
				}
				break;
		}
	}
};

module.exports = spawn_BuildInstruction;