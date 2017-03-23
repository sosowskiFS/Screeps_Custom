var spawn_BuildInstruction = {
	run: function(spawn, instruction, params, thisRoom = '', params2 = '') {
		switch (instruction) {
			case 'claim':
				var claimers = _.filter(Game.creeps, (creep) => creep.memory.priority == 'claimer');
				if (claimers.length < 1) {
					if (spawn.canCreateCreep([MOVE, CLAIM]) == OK) {
						spawn.createCreep([MOVE, CLAIM], undefined, {
							priority: 'claimer',
							destination: params
						});
						Memory.isSpawning = true;
						console.log('Claim executed from ' + spawn.room.name);
						if (Game.flags["ClaimThis"]) {
							Game.flags["ClaimThis"].remove();
						}
					} else {
						//console.log('Could not execute claim. Spawn cannot create creep.');
					}
				}
				break;
			case 'vandalize':
				var vandals = _.filter(Game.creeps, (creep) => creep.memory.priority == 'vandal');
				if (vandals.length < 1) {
					if (spawn.canCreateCreep([TOUGH, MOVE]) == OK) {
						spawn.createCreep([TOUGH, MOVE], undefined, {
							priority: 'vandal',
							message: "I come in peace, PM to chat! Member of OCS."
						});
						Memory.isSpawning = true;
						console.log('Vandalize executed from ' + spawn.room.name);
					} else {
						//console.log('Could not execute vandalize. Spawn cannot create creep.');
					}
				}
				break;
			case 'construct':
				var constructors = _.filter(Game.creeps, (creep) => creep.memory.priority == 'constructor');
				if (constructors.length < 3) {
					var constructorConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY];
					if (spawn.room.energyCapacityAvailable >= 2000) {
						constructorConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];
					}
					if (spawn.canCreateCreep(constructorConfig) == OK) {
						spawn.createCreep(constructorConfig, undefined, {
							priority: 'constructor',
							siteID: params,
							destination: params2
						});
						Memory.isSpawning = true;
						console.log('Construct executed from ' + spawn.room.name);
					} else {
						//console.log('Could not execute constructor. Spawn cannot create creep.');
					}
				}
				break;
			case 'removeKebab':
				var kebabers = _.filter(Game.creeps, (creep) => creep.memory.priority == 'removeKebab');
				if (kebabers.length < 1) {
					var kebabConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK];
					if (spawn.room.energyCapacityAvailable >= 2990) {
						kebabConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK];
					}
					if (spawn.canCreateCreep(kebabConfig) == OK) {
						spawn.createCreep(kebabConfig, undefined, {
							priority: 'removeKebab',
							destination: params
						});
						Memory.isSpawning = true;
						console.log('Kebab executed from ' + spawn.room.name);
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
					var drainCreep = [TOUGH, MOVE, MOVE, MOVE, HEAL, HEAL];
					if (spawn.room.energyCapacityAvailable >= 1260) {
						drainCreep = [TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL];
					}
					if (spawn.room.energyCapacityAvailable >= 6300) {
						drainCreep = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
					}
					if (spawn.canCreateCreep(drainCreep) == OK) {
						spawn.createCreep(drainCreep, undefined, {
							priority: 'TowerDrainer',
							destination: params,
							homeRoom: spawn.room.name
						});
						//if (Game.flags["DrainTurret"]) {
						//Game.flags["DrainTurret"].remove();
						//}
						Memory.isSpawning = true;
						console.log('Tower Drain Executed from ' + spawn.room.name);
					}
				}
				break;
			case 'helper':
				var helpers = _.filter(Game.creeps, (creep) => creep.memory.previousPriority == 'helper');
				if (helpers.length < 3) {
					var helperConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];
					if (spawn.room.energyCapacityAvailable >= 2000) {
						helperConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];
					}
					if (spawn.canCreateCreep(helperConfig) == OK) {
						spawn.createCreep(helperConfig, undefined, {
							priority: 'helper',
							destination: params,
							previousPriority: 'helper'
						});
						Memory.isSpawning = true;
						console.log('Helper executed from ' + spawn.room.name);
						/*if (Game.flags[spawn.room.name + "SendHelper"]) {
							Game.flags[spawn.room.name + "SendHelper"].remove();
						}*/
					} else {
						//console.log('Could not execute constructor. Spawn cannot create creep.');
					}
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
						Memory.isSpawning = true;
						console.log('Looter executed from ' + spawn.room.name);
					} else {
						//console.log('Could not execute constructor. Spawn cannot create creep.');
					}
				}
				break;
		}
	}
};

module.exports = spawn_BuildInstruction;