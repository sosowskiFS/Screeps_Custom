var spawn_BuildInstruction = {
	run: function(spawn, instruction, params, thisRoom = '', params2 = '') {
		switch (instruction) {
			case 'claim':
				var claimers = _.filter(Game.creeps, (creep) => creep.memory.priority == 'claimer');
				if (claimers.length < 1) {
					if (params2 != '') {
						//Claimer with defined path
						var creepPath = params2.split(";");
						if (creepPath.length) {
							if (spawn.canCreateCreep([MOVE, CLAIM]) == OK) {
								spawn.createCreep([MOVE, CLAIM], undefined, {
									priority: 'claimer',
									destination: params,
									path: creepPath
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
					} else {
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
				}
				break;
			case 'vandalize':
				var vandals = _.filter(Game.creeps, (creep) => creep.memory.priority == 'vandal');
				if (vandals.length < 1) {
					if (spawn.canCreateCreep([TOUGH, MOVE]) == OK) {
						spawn.createCreep([TOUGH, MOVE], undefined, {
							priority: 'vandal',
							message: "Wew Lad"
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
					if (params2 != '') {
						var creepPath = params2.split(";");
						if (spawn.canCreateCreep(constructorConfig) == OK) {
							spawn.createCreep(constructorConfig, undefined, {
								priority: 'constructor',
								siteID: params,
								destination: thisRoom,
								homeRoom: spawn.room.name,
								path: creepPath
							});
							Memory.isSpawning = true;
							console.log('Construct executed from ' + spawn.room.name);
						} else {
							//console.log('Could not execute constructor. Spawn cannot create creep.');
						}
					} else {
						if (spawn.canCreateCreep(constructorConfig) == OK) {
							spawn.createCreep(constructorConfig, undefined, {
								priority: 'constructor',
								siteID: params,
								destination: thisRoom,
								homeRoom: spawn.room.name
							});
							Memory.isSpawning = true;
							console.log('Construct executed from ' + spawn.room.name);
						} else {
							//console.log('Could not execute constructor. Spawn cannot create creep.');
						}
					}

				}
				break;
			case 'removeKebab':
				var kebabers = _.filter(Game.creeps, (creep) => creep.memory.priority == 'removeKebab');
				if (kebabers.length < 2) {
					var kebabConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK];
					if (spawn.room.energyCapacityAvailable >= 3750) {
						kebabConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK];
					}
					if (params2 != '') {
						var creepPath = params2.split(";");
						if (spawn.canCreateCreep(kebabConfig) == OK) {
							spawn.createCreep(kebabConfig, undefined, {
								priority: 'removeKebab',
								destination: params,
								path: creepPath
							});
							Memory.isSpawning = true;
							console.log('Kebab executed from ' + spawn.room.name);
							//if (Game.flags["RemoveKebab"]) {
							//Game.flags["RemoveKebab"].remove();
							//}
						} else {
							//console.log('Could not execute constructor. Spawn cannot create creep.');
						}
					} else {
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
					if (params2 != '') {
						var creepPath = params2.split(";");
						if (spawn.canCreateCreep(helperConfig) == OK) {
							spawn.createCreep(helperConfig, undefined, {
								priority: 'helper',
								destination: params,
								previousPriority: 'helper',
								path: creepPath
							});
							Memory.isSpawning = true;
							console.log('Helper executed from ' + spawn.room.name);
							/*if (Game.flags[spawn.room.name + "SendHelper"]) {
								Game.flags[spawn.room.name + "SendHelper"].remove();
							}*/
						} else {
							//console.log('Could not execute constructor. Spawn cannot create creep.');
						}
					} else {
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
			case 'trump':
				var trumps = _.filter(Game.creeps, (creep) => creep.memory.priority == 'trump');
				if (trumps.length < 3) {
					var trumpConfig = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
					if (spawn.room.energyCapacityAvailable >= 1800) {
						trumpConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
					}
					if (spawn.canCreateCreep(trumpConfig) == OK) {
						spawn.createCreep(trumpConfig, undefined, {
							priority: 'trump',
							destination: params,
							homeRoom: params2
						});
						Memory.isSpawning = true;
						console.log('America will be great again thanks to ' + spawn.room.name);
					} else {
						//console.log('Could not execute constructor. Spawn cannot create creep.');
					}
				}
				break;
			case 'assault':
				var attackers = _.filter(Game.creeps, (creep) => creep.memory.priority == 'assattacker');
				var healers = _.filter(Game.creeps, (creep) => creep.memory.priority == 'asshealer');
				if (attackers.length < 1) {
					//var attackerConfig = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE];
					//Testing movement config
					var attackerConfig = [TOUGH, TOUGH, MOVE, MOVE];
					if (spawn.canCreateCreep(attackerConfig) == OK) {
						spawn.createCreep(attackerConfig, undefined, {
							priority: 'assattacker',
							destination: params,
							homeRoom: params2
						});
						Memory.isSpawning = true;
						console.log('FUCK. SHIT. UP. ' + spawn.room.name);
					} else {
						//console.log('Could not execute constructor. Spawn cannot create creep.');
					}
				} else if (healers.length < 2) {
					//var healerConfig = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
					//Testing movement config
					var healerConfig = [TOUGH, MOVE];
					var attackerName = '';
					if (attackers[0]) {
						attackerName = attackers[0].name
						if (spawn.canCreateCreep(healerConfig) == OK) {
							spawn.createCreep(healerConfig, undefined, {
								priority: 'asshealer',
								destination: params,
								homeRoom: params2,
								attackerName: attackerName
							});
							Memory.isSpawning = true;
							console.log('HEAL. SHIT. UP. ' + spawn.room.name);
						} else {
							//console.log('Could not execute constructor. Spawn cannot create creep.');
						}
					}
				}
				break;
			case 'distract':
				var distractors = _.filter(Game.creeps, (creep) => (creep.memory.priority == 'distractor' && creep.memory.homeRoom == spawn.room.name));
				if (distractors.length < 1) {
					var distractConfig = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK];
					if (spawn.canCreateCreep(distractConfig) == OK) {
						spawn.createCreep(distractConfig, undefined, {
							priority: 'distractor',
							destination: params,
							homeRoom: spawn.room.name,
							targetFlag: params2
						});
						Memory.isSpawning = true;
						console.log('Keep em busy, ' + spawn.room.name);
					} else {
						//console.log('Could not execute constructor. Spawn cannot create creep.');
					}
				}
				break;
		}
	}
};

module.exports = spawn_BuildInstruction;