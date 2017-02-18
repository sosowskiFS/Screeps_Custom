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
				var kebabers = _.filter(Game.creeps, (creep) => creep.memory.priority == 'removeKebab');
				if (kebabers.length < 1) {
					if (spawn.canCreateCreep([MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK]) == OK) {
						spawn.createCreep([MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK], undefined, {
							priority: 'removeKebab',
							destination: params
						});
						console.log('Kebab executed');
						//if (Game.flags["RemoveKebab"]) {
						//Game.flags["RemoveKebab"].remove();
						//}
					} else {
						//console.log('Could not execute constructor. Spawn cannot create creep.');
					}
				}
				break;
			case 'tDrain':
				var tDrainers = _.filter(Game.creeps, (creep) => creep.memory.priority == 'TowerDrainer');
				if (tDrainers.length < 1) {
					if (spawn.canCreateCreep([TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL]) == OK) {
						spawn.createCreep([TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL], undefined, {
							priority: 'TowerDrainer',
							destination: params,
							homeRoom: spawn.room.name
						});
						//if (Game.flags["DrainTurret"]) {
						//Game.flags["DrainTurret"].remove();
						//}
						console.log('Tower Drain Executed');
					}
				}
				break;
			case 'helper':
				if (spawn.canCreateCreep([MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY]) == OK) {
					spawn.createCreep([MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY], undefined, {
						priority: 'helper',
						destination: params
					});
					console.log('Helper executed');
					if (Game.flags[spawn.room.name + "SendHelper"]) {
						Game.flags[spawn.room.name + "SendHelper"].remove();
					}
				} else {
					//console.log('Could not execute constructor. Spawn cannot create creep.');
				}
				break;
			case 'loot':
				var looters = _.filter(Game.creeps, (creep) => creep.memory.priority == 'looter');
				if (looters.length < 3) {
					var looterConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];
					if (spawn.room.energyCapacityAvailable >= 2500) {
						looterConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];
					}
					if (spawn.canCreateCreep(looterConfig) == OK) {
						spawn.createCreep(looterConfig, undefined, {
							priority: 'looter',
							destination: params,
							homeRoom: params2
						});
						console.log('Looter executed');
					} else {
						//console.log('Could not execute constructor. Spawn cannot create creep.');
					}
				}
				break;
		}
	}
};

module.exports = spawn_BuildInstruction;