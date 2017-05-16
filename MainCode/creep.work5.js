var creep_work5 = {

	/** @param {Creep} creep **/
	run: function(creep) {

		//wew lad
		/*if (!creep.room.controller.sign) {
		    if(creep.pos.isNearTo(creep.room.controller)) {
		        creep.signController(creep.room.controller, 'This is, by far, the most kupo room I\'ve ever seen!');
		    }
		}*/

		var ignoreRoadsValue = false;
		if (Memory.IgnoreRoadRooms == creep.room.name) {
			ignoreRoadsValue = true;
		}

		if (creep.carry.energy > 0 && creep.memory.priority != 'miner' && creep.memory.priority != 'minerNearDeath') {
			//All creeps check for road under them and repair if needed.
			var someStructure = creep.pos.lookFor(LOOK_STRUCTURES);
			if (someStructure.length && (someStructure[0].hitsMax - someStructure[0].hits >= 600) && someStructure[0].structureType == STRUCTURE_ROAD) {
				creep.repair(someStructure[0]);
			}
		}

		switch (creep.memory.priority) {
			case 'miner':
			case 'minerNearDeath':
				if (!creep.memory.deathWarn) {
					creep.memory.deathWarn = _.size(creep.body) * 4;
				}

				if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'minerNearDeath') {
					creep.memory.priority = 'minerNearDeath';
					creep.memory.jobSpecific = creep.memory.jobSpecific + 'NearDeath';
				}

				//Creep will immediately harvest and store mined materials
				var storageTarget = Game.getObjectById(creep.memory.linkSource);
				var mineTarget = Game.getObjectById(creep.memory.mineSource);
				if (mineTarget && storageTarget) {
					if (storageTarget.structureType == STRUCTURE_LINK) {
						if (storageTarget.energy == storageTarget.energyCapacity) {
							return;
						}
					}

					if (mineTarget.energy > 0) {
						if (creep.harvest(mineTarget) == ERR_NOT_IN_RANGE) {
							creep.moveTo(mineTarget, {
								reusePath: 5
							});
						}
					}

					if (creep.carry.energy >= 48) {
						if (creep.transfer(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
							creep.moveTo(storageTarget, {
								reusePath: 5
							});
						}
					}

					/*if (creep.transfer(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
						if (creep.carry.energy > 0) {
							creep.moveTo(storageTarget, {
								reusePath: 5
							});
						} else {
							if (creep.harvest(mineTarget) == ERR_NOT_IN_RANGE) {
								creep.moveTo(mineTarget, {
									reusePath: 5
								});
							}
						}
					} else if (creep.harvest(mineTarget) == ERR_NOT_IN_RANGE) {
						creep.moveTo(mineTarget, {
							reusePath: 5
						});
					}*/
				}
				break;
			case 'upgrader':
			case 'upgraderNearDeath':
				if (!creep.memory.deathWarn) {
					creep.memory.deathWarn = _.size(creep.body) * 4;
				}

				if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'upgraderNearDeath') {
					creep.memory.priority = 'upgraderNearDeath';
				}

				if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
					if (Game.flags[creep.room.name + "Controller"]) {
						creep.moveTo(Game.flags[creep.room.name + "Controller"], {
							reusePath: 25
						});
					} else {
						creep.moveTo(creep.room.controller, {
							reusePath: 25
						});
					}
				}

				var linkTarget = Game.getObjectById(creep.memory.linkSource);
				if (linkTarget) {
					if (creep.withdraw(linkTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
						creep.moveTo(linkTarget, {
							reusePath: 25
						});
					}
				}

				if (!creep.memory.hasBoosted && creep.room.controller.level >= 7 && Memory.labList[creep.room.name].length >= 6 && !creep.memory.previousPriority) {
					var mineralCost = creep.getActiveBodyparts(WORK) * LAB_BOOST_MINERAL;
					var energyCost = creep.getActiveBodyparts(WORK) * LAB_BOOST_ENERGY;
					var upgradeLab = Game.getObjectById(Memory.labList[creep.room.name][4]);
					if (upgradeLab && upgradeLab.mineralAmount >= mineralCost && upgradeLab.energy >= energyCost) {
						creep.moveTo(upgradeLab);
						if (upgradeLab.boostCreep(creep) == OK) {
							creep.memory.hasBoosted = true;
						} else {
							creep.memory.hasBoosted = false;
						}
					} else {
						creep.memory.hasBoosted = true;
					}
				} else {
					creep.memory.hasBoosted = true;
				}
				break;
			case 'mule':
			case 'muleNearDeath':
				if (!creep.memory.deathWarn) {
					creep.memory.deathWarn = _.size(creep.body) * 4;
				}

				if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'muleNearDeath') {
					creep.memory.priority = 'muleNearDeath';
				}
				if (_.sum(creep.carry) == 0) {
					creep.memory.structureTarget = undefined;
					var storageTarget = creep.room.storage;
					if (storageTarget) {
						if (storageTarget.store[RESOURCE_ENERGY] >= 50) {
							//Get from container
							if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
								creep.moveTo(storageTarget, {
									reusePath: 5
								});
							}
						} else {
							var spawnTarget = Game.getObjectById(creep.memory.fromSpawn);
							if (spawnTarget) {
								if (!creep.pos.isNearTo(spawnTarget)) {
									creep.moveTo(spawnTarget, {
										reusePath: 5
									});
								}
							}
						}
					}
				} else if (_.sum(creep.carry) > 0) {
					if (creep.carry[RESOURCE_ENERGY] == 0) {
						if (creep.room.terminal) {
							var currentlyCarrying = _.findKey(creep.carry);
							if (creep.transfer(creep.room.terminal, currentlyCarrying) == ERR_NOT_IN_RANGE) {
								creep.moveTo(creep.room.terminal, {
									reusePath: 5
								});
							}
						} else if (!creep.room.terminal && creep.room.storage) {
							var currentlyCarrying = _.findKey(creep.carry);
							if (creep.transfer(creep.room.storage, currentlyCarrying) == ERR_NOT_IN_RANGE) {
								creep.moveTo(creep.room.storage, {
									reusePath: 5
								});
							}
						}
					} else {
						var savedTarget = Game.getObjectById(creep.memory.structureTarget)
						var getNewStructure = false;
						if (savedTarget) {
							if (creep.build(savedTarget) == ERR_INVALID_TARGET) {
								//Only other blocker is build.
								creep.repair(savedTarget);

								if (creep.memory.lookForNewRampart) {
									creep.memory.structureTarget = undefined;
									creep.memory.lookForNewRampart = undefined;
									var newRampart = creep.pos.findClosestByRange(FIND_STRUCTURES, {
										filter: (structure) => (structure.structureType == STRUCTURE_RAMPART) && (structure.hits == 1)
									});
									if (newRampart) {
										creep.memory.structureTarget = newRampart.id;
										if (creep.repair(newRampart) == ERR_NOT_IN_RANGE) {
											creep.moveTo(newRampart, {
												reusePath: 5
											});
										}
									}
								} else if (savedTarget.structureType != STRUCTURE_CONTAINER && savedTarget.structureType != STRUCTURE_STORAGE && savedTarget.structureType != STRUCTURE_CONTROLLER) {
									//Storing in spawn/extension/tower/link
									if (creep.transfer(savedTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE && savedTarget.energy < savedTarget.energyCapacity) {
										creep.moveTo(savedTarget, {
											reusePath: 5
										});
									} else {
										//assumed OK, drop target
										creep.memory.structureTarget = undefined;
										getNewStructure = true;
									}
								} else {
									//Upgrading controller
									if (creep.upgradeController(savedTarget) == ERR_NOT_IN_RANGE) {
										if (Game.flags[creep.room.name + "Controller"]) {
											creep.moveTo(Game.flags[creep.room.name + "Controller"], {
												reusePath: 20
											});
										} else {
											creep.moveTo(savedTarget, {
												reusePath: 20
											});
										}
									} else {
										//Check for nearby link and fill it if possible.
										if (Memory.linkList[creep.room.name].length > 1) {
											var upgraderLink = Game.getObjectById(Memory.linkList[creep.room.name][1]);
											if (upgraderLink && upgraderLink.energy < 100) {
												if (creep.transfer(upgraderLink, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
													creep.moveTo(upgraderLink);
												}
											}
										}
									}
									//Do repair for new ramparts
									creep.repair(savedTarget);
								}
							} else {
								if (creep.build(savedTarget) == ERR_NOT_IN_RANGE) {
									creep.moveTo(savedTarget, {
										reusePath: 5
									});
								} else if (creep.build(savedTarget) != OK) {
									creep.memory.structureTarget = undefined;
								}
							}
						} else {
							creep.memory.structureTarget = undefined;
						}
						//Immediately find a new target if previous transfer worked
						if (!creep.memory.structureTarget) {
							var targets = undefined;
							if (getNewStructure) {
								targets = creep.pos.findClosestByPath(FIND_STRUCTURES, {
									filter: (structure) => {
										return (structure.structureType == STRUCTURE_EXTENSION ||
											structure.structureType == STRUCTURE_SPAWN ||
											structure.structureType == STRUCTURE_LAB) && structure.energy < structure.energyCapacity && structure.id != savedTarget.id;
									}
								});
							} else {
								targets = creep.pos.findClosestByPath(FIND_STRUCTURES, {
									filter: (structure) => {
										return (structure.structureType == STRUCTURE_EXTENSION ||
											structure.structureType == STRUCTURE_SPAWN ||
											structure.structureType == STRUCTURE_LAB) && structure.energy < structure.energyCapacity;
									}
								});
							}

							if (targets) {
								creep.memory.structureTarget = targets.id;
								if (creep.transfer(targets, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
									creep.moveTo(targets);
								} else {
									creep.memory.structureTarget = undefined;
								}
							} else {
								//Level8 Structures
								var targets2;
								if (creep.room.controller.level == 8) {
									targets2 = creep.pos.findClosestByRange(FIND_STRUCTURES, {
										filter: (structure) => {
											return (structure.structureType == STRUCTURE_POWER_SPAWN ||
												structure.structureType == STRUCTURE_NUKER) && structure.energy < structure.energyCapacity;
										}
									});
								}
								if (targets2) {
									creep.memory.structureTarget = targets2.id;
									if (creep.transfer(targets2, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
										creep.moveTo(targets2);
									} else {
										creep.memory.structureTarget = undefined;
									}
								} else {
									//Build
									targets2 = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
									if (targets2) {
										creep.memory.structureTarget = targets2.id;
										if (targets2.structureType == STRUCTURE_RAMPART) {
											creep.memory.lookForNewRampart = true;
										}

										if (creep.build(targets2) == ERR_NOT_IN_RANGE) {
											creep.moveTo(targets2, {
												reusePath: 20
											});
										} else if (creep.build(targets2) == ERR_NO_BODYPART) {
											creep.suicide();
										}
									} else {
										//Store in terminal
										var terminalTarget = Game.getObjectById(creep.memory.terminalID)
										if (terminalTarget) {
											if (terminalTarget.store[RESOURCE_ENERGY] < 50000 && creep.room.storage && creep.room.storage.store[RESOURCE_ENERGY] >= 50000) {
												creep.memory.structureTarget = terminalTarget.id;
												if (creep.transfer(terminalTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
													creep.moveTo(terminalTarget, {
														reusePath: 20
													});
												}
											} else {
												terminalTarget = undefined;
											}
										}

										if (!terminalTarget) {
											//Upgrade
											if (creep.room.controller.level == 8) {
												//Check for nearby link and fill it if possible.
												if (Memory.linkList[creep.room.name].length > 1) {
													var upgraderLink = Game.getObjectById(Memory.linkList[creep.room.name][1]);
													if (upgraderLink && upgraderLink.energy < 200) {
														creep.memory.structureTarget = upgraderLink;
														if (creep.transfer(upgraderLink, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
															creep.moveTo(upgraderLink);
														}
													} else {
														//Turn into a repair worker temporarily
														creep.memory.priority = 'repair';
														creep.memory.previousPriority = 'mule';
													}
												}
											} else {
												creep.memory.structureTarget = creep.room.controller.id;
												if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
													if (Game.flags[creep.room.name + "Controller"]) {
														creep.moveTo(Game.flags[creep.room.name + "Controller"], {
															reusePath: 20
														});
													} else {
														creep.moveTo(creep.room.controller, {
															reusePath: 20
														});
													}
												} else if (creep.upgradeController(creep.room.controller) == ERR_NO_BODYPART) {
													creep.suicide();
												}
											}
										}
									}
								}
							}
						}
					}
				}
				break;
			case 'repair':
			case 'repairNearDeath':
				if (!creep.memory.deathWarn) {
					creep.memory.deathWarn = _.size(creep.body) * 4;
				}

				if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'repairNearDeath') {
					creep.memory.priority = 'repairNearDeath';
				}

				if (_.sum(creep.carry) == 0) {
					creep.memory.structureTarget = undefined;
					if (creep.memory.previousPriority && creep.memory.previousPriority == 'mule') {
						creep.memory.priority = "mule";
					} else {
						//Get from storage
						var storageTarget = creep.room.storage;
						if (storageTarget) {
							if (storageTarget.store[RESOURCE_ENERGY] >= 200) {
								if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
									creep.moveTo(storageTarget, {
										reusePath: 25,
										maxRooms: 1
									});
								}
							} else {
								var spawnTarget = Game.getObjectById(creep.memory.fromSpawn);
								if (spawnTarget) {
									if (!creep.pos.isNearTo(spawnTarget)) {
										creep.moveTo(spawnTarget, {
											reusePath: 25,
											maxRooms: 1
										});
									}
								}
							}
						}
					}
				} else if (creep.memory.structureTarget) {
					var thisStructure = Game.getObjectById(creep.memory.structureTarget);
					if (thisStructure) {
						if (thisStructure.hits == thisStructure.hitsMax) {
							creep.memory.structureTarget = undefined;
						} else {
							if (creep.repair(thisStructure) == ERR_NOT_IN_RANGE) {
								creep.moveTo(thisStructure, {
									reusePath: 25,
									maxRooms: 1
								});
							}
						}
					} else {
						creep.memory.structureTarget = undefined;
					}
				} else {
					var closestDamagedStructure = [];
					closestDamagedStructure = creep.room.find(FIND_STRUCTURES, {
						filter: (structure) => (structure.structureType != STRUCTURE_ROAD) && (structure.hitsMax - structure.hits >= 200)
					});

					if (closestDamagedStructure.length > 0) {
						closestDamagedStructure.sort(repairCompare);
						creep.memory.structureTarget = closestDamagedStructure[0].id;
						if (creep.repair(closestDamagedStructure[0]) == ERR_NOT_IN_RANGE) {
							creep.moveTo(closestDamagedStructure[0], {
								reusePath: 25,
								maxRooms: 1
							});
						}
					}
				}

				if (!creep.memory.hasBoosted && creep.room.controller.level >= 7 && Memory.labList[creep.room.name].length >= 6 && !creep.memory.previousPriority) {
					var mineralCost = creep.getActiveBodyparts(WORK) * LAB_BOOST_MINERAL;
					var energyCost = creep.getActiveBodyparts(WORK) * LAB_BOOST_ENERGY;
					var repairLab = Game.getObjectById(Memory.labList[creep.room.name][5]);
					if (repairLab && repairLab.mineralAmount >= mineralCost && repairLab.energy >= energyCost) {
						creep.moveTo(repairLab);
						if (repairLab.boostCreep(creep) == OK) {
							creep.memory.hasBoosted = true;
						} else {
							creep.memory.hasBoosted = false;
						}
					} else {
						creep.memory.hasBoosted = true;
					}
				} else {
					creep.memory.hasBoosted = true;
				}
				break;
			case 'supplier':
			case 'supplierNearDeath':
				if (!creep.memory.deathWarn) {
					creep.memory.deathWarn = _.size(creep.body) * 4;
				}

				if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'supplierNearDeath') {
					creep.memory.priority = 'supplierNearDeath';
				}

				if (_.sum(creep.carry) == 0) {
					//Get from storage
					var storageTarget = creep.room.storage;
					if (storageTarget) {
						if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
							creep.moveTo(storageTarget, {
								reusePath: 2
							});
						}
					}
				} else {
					if (Memory.towerNeedEnergy[creep.room.name].length) {
						var target = Game.getObjectById(Memory.towerNeedEnergy[creep.room.name][0]);
						if (target) {
							if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
								creep.moveTo(target);
							}
						}
					} else if (Game.flags[creep.room.name + "Supply"] && creep.pos != Game.flags[creep.room.name + "Supply"].pos) {
						creep.moveTo(Game.flags[creep.room.name + "Supply"]);
					}
				}
				break;
			case 'distributor':
			case 'distributorNearDeath':
				if (!creep.memory.deathWarn) {
					creep.memory.deathWarn = _.size(creep.body) * 4;
				}

				if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'distributorNearDeath') {
					creep.memory.priority = 'distributorNearDeath';
				}

				if (_.sum(creep.carry) == 0) {
					//Get from storage
					var storageTarget = creep.room.storage;
					if (storageTarget) {
						if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
							creep.moveTo(storageTarget, {
								reusePath: 2
							});
						}
					}
				} else if (creep.room.energyAvailable < creep.room.energyCapacityAvailable) {
					var savedTarget = Game.getObjectById(creep.memory.structureTarget);
					var getNewStructure = false;
					if (savedTarget && savedTarget.energy < savedTarget.energyCapacity) {
						if (creep.transfer(savedTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
							creep.moveTo(savedTarget);
						} else {
							getNewStructure = true;
							creep.memory.structureTarget = undefined;
						}
					} else if (savedTarget) {
						getNewStructure = true;
						creep.memory.structureTarget = undefined;
					}
					if (!creep.memory.structureTarget) {
						var target = undefined;
						if (getNewStructure) {
							target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
								filter: (structure) => {
									return (structure.structureType == STRUCTURE_EXTENSION ||
										structure.structureType == STRUCTURE_SPAWN) && structure.energy < structure.energyCapacity && structure.id != savedTarget.id;
								}
							});
						} else {
							target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
								filter: (structure) => {
									return (structure.structureType == STRUCTURE_EXTENSION ||
										structure.structureType == STRUCTURE_SPAWN) && structure.energy < structure.energyCapacity;
								}
							});
						}

						if (target) {
							if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
								creep.moveTo(target);
								creep.memory.structureTarget = target.id;
							}
						}
					}
				} else if (_.sum(creep.carry) < creep.carryCapacity) {
					//Get from storage
					var storageTarget = creep.room.storage;
					if (storageTarget) {
						if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
							creep.moveTo(storageTarget, {
								reusePath: 2
							});
						}
					}
				} else {
					var homeSpawn = Game.getObjectById(creep.memory.fromSpawn)
					if (homeSpawn && !creep.pos.isNearTo(homeSpawn)) {
						creep.moveTo(homeSpawn);
					}
				}
				break;
			case 'mineralMiner':
				var thisMineral = Game.getObjectById(creep.memory.mineralID);
				if (thisMineral.mineralAmount == 0 && _.sum(creep.carry) == 0) {
					//Nothing left to do
					creep.suicide();
				} else {
					//Creep will immediately harvest and store mined materials
					var storageTarget = creep.room.terminal;
					if (!creep.pos.isNearTo(thisMineral)) {
						creep.moveTo(thisMineral, {
							reusePath: 25
						});
					} else if (storageTarget && Game.time % 6 == 0) {
						if (creep.harvest(thisMineral) == ERR_NOT_IN_RANGE) {
							creep.moveTo(thisMineral, {
								reusePath: 25
							});
						}
					}
					if (_.sum(creep.carry) > 0) {
						if (creep.transfer(storageTarget, thisMineral.mineralType) == ERR_NOT_IN_RANGE) {
							//This should never actually fire, if ideal.
							creep.moveTo(storageTarget);
						}
					}
				}
				break;
			case 'salvager':
				var sources = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
				if (!sources && _.sum(creep.carry) == 0) {
					//There's nothing left to do
					//creep.suicide();
				} else if (sources && _.sum(creep.carry) < creep.carryCapacity) {
					if (creep.pickup(sources) == ERR_NOT_IN_RANGE) {
						creep.moveTo(sources, {
							reusePath: 25
						});
					}
				}
				if (!sources && _.sum(creep.carry) > 0 || _.sum(creep.carry) > 100) {
					var storageTarget = creep.room.storage;
					if (Object.keys(creep.carry).length > 1) {
						if (creep.transfer(storageTarget, Object.keys(creep.carry)[1]) == ERR_NOT_IN_RANGE) {
							creep.moveTo(storageTarget, {
								reusePath: 25
							});
						}
					} else if (creep.transfer(storageTarget, Object.keys(creep.carry)[0]) == ERR_NOT_IN_RANGE) {
						creep.moveTo(storageTarget, {
							reusePath: 25
						});
					}
				}
				break;
			case 'labWorker':
			case 'labWorkerNearDeath':
				if (!creep.memory.deathWarn) {
					creep.memory.deathWarn = _.size(creep.body) * 4;
				}
				if (creep.memory.isMoving == null) {
					creep.memory.isMoving = false;
				}
				if (creep.memory.movingOtherMineral == null) {
					creep.memory.movingOtherMineral = false;
				}
				if (creep.memory.movingOtherMineral2 == null) {
					creep.memory.movingOtherMineral2 = false;
				}

				if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'labWorkerNearDeath') {
					creep.memory.priority = 'labWorkerNearDeath';
				}

				if (Game.time % 5 == 0 || creep.memory.isMoving) {
					if (creep.memory.mineral4 == creep.memory.mineral3 || creep.memory.mineral5 == creep.memory.mineral3 || creep.memory.mineral6 == creep.memory.mineral3) {
						creep.memory.storeProduced = true;
					} else {
						creep.memory.storeProduced = false;
					}

					var lab1 = Game.getObjectById(creep.memory.lab1);
					var lab2 = Game.getObjectById(creep.memory.lab2);
					var lab3 = Game.getObjectById(creep.memory.lab3);
					var lab4 = undefined;
					var lab5 = undefined;
					var lab6 = undefined;
					var lab7 = undefined;
					var lab8 = undefined;
					var lab9 = undefined;
					if (creep.memory.lab4) {
						lab4 = Game.getObjectById(creep.memory.lab4);
						lab5 = Game.getObjectById(creep.memory.lab5);
						lab6 = Game.getObjectById(creep.memory.lab6);
					}
					if (creep.memory.lab7) {
						lab7 = Game.getObjectById(creep.memory.lab7);
						lab8 = Game.getObjectById(creep.memory.lab8);
						lab9 = Game.getObjectById(creep.memory.lab9);
					}
					var checkForMoreWork = false;
					if (creep.memory.movingOtherMineral || (lab1 && lab2 && lab3 && ((lab1.mineralAmount > 0 && lab1.mineralType != creep.memory.mineral1) || (lab2.mineralAmount > 0 && lab2.mineralType != creep.memory.mineral2) || (lab3.mineralAmount > 0 && lab3.mineralType != creep.memory.mineral3)))) {
						if (_.sum(creep.carry) == 0) {
							if (lab1.mineralAmount > 0 && lab1.mineralType != creep.memory.mineral1) {
								var withdrawResult = creep.withdraw(lab1, lab1.mineralType)
								if (withdrawResult == ERR_NOT_IN_RANGE) {
									creep.moveTo(lab1, {
										reusePath: 5
									});
									creep.memory.isMoving = true;
								} else {
									creep.memory.isMoving = false;
									creep.memory.movingOtherMineral = true;
								}
							} else if (lab2.mineralAmount > 0 && lab2.mineralType != creep.memory.mineral2) {
								var withdrawResult = creep.withdraw(lab2, lab2.mineralType)
								if (withdrawResult == ERR_NOT_IN_RANGE) {
									creep.moveTo(lab2, {
										reusePath: 5
									});
									creep.memory.isMoving = true;
								} else {
									creep.memory.isMoving = false;
									creep.memory.movingOtherMineral = true;
								}
							} else if (lab3.mineralAmount > 0 && lab3.mineralType != creep.memory.mineral3) {
								var withdrawResult = creep.withdraw(lab3, lab3.mineralType)
								if (withdrawResult == ERR_NOT_IN_RANGE) {
									creep.moveTo(lab3, {
										reusePath: 5
									});
									creep.memory.isMoving = true;
								} else {
									creep.memory.isMoving = false;
									creep.memory.movingOtherMineral = true;
								}
							}
						} else {
							//Drop off "unknown" mineral in terminal
							var currentlyCarrying = _.findKey(creep.carry);
							var transferResult = creep.transfer(creep.room.terminal, currentlyCarrying)
							if (transferResult == ERR_NOT_IN_RANGE) {
								creep.moveTo(creep.room.terminal, {
									reusePath: 25
								});
								creep.memory.isMoving = true;
							} else {
								creep.memory.isMoving = false;
							}
						}
					} else if (lab1 && lab2 && lab3 && (creep.room.terminal.store[creep.memory.mineral3] < 40000 || !creep.room.terminal.store[creep.memory.mineral3])) {
						if (_.sum(creep.carry) == 0 && creep.memory.priority != 'labWorkerNearDeath') {
							var min1Amount = creep.memory.mineral1 in creep.room.terminal.store;
							var min2Amount = creep.memory.mineral2 in creep.room.terminal.store;
							var min3Amount = lab3.mineralAmount;
							if (min3Amount >= 250) {
								var withdrawResult = creep.withdraw(lab3, creep.memory.mineral3)
								if (withdrawResult == ERR_NOT_IN_RANGE) {
									creep.moveTo(lab3, {
										reusePath: 5
									});
									creep.memory.isMoving = true;
								} else {
									creep.memory.isMoving = false;
								}
							} else if (min1Amount > 0 && lab1.mineralAmount < lab1.mineralCapacity - 250) {
								var withdrawResult = creep.withdraw(creep.room.terminal, creep.memory.mineral1)
								if (withdrawResult == ERR_NOT_IN_RANGE) {
									creep.moveTo(creep.room.terminal, {
										reusePath: 5
									});
									creep.memory.isMoving = true;
								} else {
									creep.memory.isMoving = false;
								}
							} else if (min2Amount > 0 && lab2.mineralAmount < lab2.mineralCapacity - 250) {
								var withdrawResult = creep.withdraw(creep.room.terminal, creep.memory.mineral2)
								if (withdrawResult == ERR_NOT_IN_RANGE) {
									creep.moveTo(creep.room.terminal, {
										reusePath: 5
									});
									creep.memory.isMoving = true;
								} else {
									creep.memory.isMoving = false;
								}
							} else {
								checkForMoreWork = true;
							}
						} else {
							if (creep.carry[creep.memory.mineral1]) {
								var transferResult = creep.transfer(lab1, creep.memory.mineral1)
								if (transferResult == ERR_NOT_IN_RANGE) {
									creep.moveTo(lab1, {
										reusePath: 5
									});
									creep.memory.isMoving = true;
								} else {
									creep.memory.isMoving = false;
								}
							} else if (creep.carry[creep.memory.mineral2]) {
								var transferResult = creep.transfer(lab2, creep.memory.mineral2)
								if (transferResult == ERR_NOT_IN_RANGE) {
									creep.moveTo(lab2, {
										reusePath: 5
									});
									creep.memory.isMoving = true;
								} else {
									creep.memory.isMoving = false;
								}
							} else if (creep.carry[creep.memory.mineral3]) {
								if (creep.memory.storeProduced && lab4 && lab5 && lab6) {
									if (creep.memory.mineral4 == creep.memory.mineral3 && lab4.mineralAmount <= 2500) {
										checkForMoreWork = true;
									} else if (creep.memory.mineral5 == creep.memory.mineral3 && lab5.mineralAmount <= 2500) {
										checkForMoreWork = true;
									} else if (creep.memory.mineral6 == creep.memory.mineral3 && lab6.mineralAmount <= 2500) {
										checkForMoreWork = true;
									} else if (creep.transfer(creep.room.terminal, creep.memory.mineral3) == ERR_NOT_IN_RANGE) {
										creep.moveTo(creep.room.terminal, {
											reusePath: 5
										});
										creep.memory.isMoving = true;
									} else if (transferResult == OK) {
										creep.memory.isMoving = false;
									}
								} else if (creep.transfer(creep.room.terminal, creep.memory.mineral3) == ERR_NOT_IN_RANGE) {
									creep.moveTo(creep.room.terminal, {
										reusePath: 5
									});
									creep.memory.isMoving = true;
								} else {
									creep.memory.isMoving = false;
								}
							} else {
								checkForMoreWork = true;
							}
						}
					} else if (creep.room.terminal.store[creep.memory.mineral3] >= 40000) {
						checkForMoreWork = true;
					}

					if (checkForMoreWork && ((lab7 && lab8 && lab9 && creep.memory.movingOtherMineral2) || (lab7 && lab8 && lab9 && ((lab7.mineralAmount > 0 && lab7.mineralType != creep.memory.mineral7) || (lab8.mineralAmount > 0 && lab8.mineralType != creep.memory.mineral8) || (lab9.mineralAmount > 0 && lab9.mineralType != creep.memory.mineral9))))) {
						if (_.sum(creep.carry) == 0) {
							if (lab7.mineralAmount > 0 && lab7.mineralType != creep.memory.mineral7) {
								var withdrawResult = creep.withdraw(lab7, lab7.mineralType)
								if (withdrawResult == ERR_NOT_IN_RANGE) {
									creep.moveTo(lab7, {
										reusePath: 5
									});
									creep.memory.isMoving = true;
								} else {
									creep.memory.isMoving = false;
									creep.memory.movingOtherMineral2 = true;
								}
							} else if (lab8.mineralAmount > 0 && lab8.mineralType != creep.memory.mineral8) {
								var withdrawResult = creep.withdraw(lab8, lab8.mineralType)
								if (withdrawResult == ERR_NOT_IN_RANGE) {
									creep.moveTo(lab8, {
										reusePath: 5
									});
									creep.memory.isMoving = true;
								} else {
									creep.memory.isMoving = false;
									creep.memory.movingOtherMineral2 = true;
								}
							} else if (lab9.mineralAmount > 0 && lab9.mineralType != creep.memory.mineral9) {
								var withdrawResult = creep.withdraw(lab9, lab9.mineralType)
								if (withdrawResult == ERR_NOT_IN_RANGE) {
									creep.moveTo(lab9, {
										reusePath: 5
									});
									creep.memory.isMoving = true;
								} else {
									creep.memory.isMoving = false;
									creep.memory.movingOtherMineral2 = true;
								}
							}
						} else {
							//Drop off "unknown" mineral in terminal
							var currentlyCarrying = _.findKey(creep.carry);
							var transferResult = creep.transfer(creep.room.terminal, currentlyCarrying)
							if (transferResult == ERR_NOT_IN_RANGE) {
								creep.moveTo(creep.room.terminal, {
									reusePath: 25
								});
								creep.memory.isMoving = true;
							} else {
								creep.memory.isMoving = false;
							}
						}
					} else if (checkForMoreWork && lab7 && lab8 && lab9 && (creep.room.terminal.store[creep.memory.mineral9] < 40000 || !creep.room.terminal.store[creep.memory.mineral9])) {
						if (_.sum(creep.carry) == 0 && creep.memory.priority != 'labWorkerNearDeath') {
							var min1Amount = creep.memory.mineral7 in creep.room.terminal.store;
							var min2Amount = creep.memory.mineral8 in creep.room.terminal.store;
							var min3Amount = lab9.mineralAmount;
							if (min3Amount >= 250) {
								var withdrawResult = creep.withdraw(lab9, creep.memory.mineral9)
								if (withdrawResult == ERR_NOT_IN_RANGE) {
									creep.moveTo(lab9, {
										reusePath: 5
									});
									creep.memory.isMoving = true;
								} else {
									creep.memory.isMoving = false;
								}
							} else if (min1Amount > 0 && lab7.mineralAmount < lab7.mineralCapacity - 250) {
								var withdrawResult = creep.withdraw(creep.room.terminal, creep.memory.mineral7)
								if (withdrawResult == ERR_NOT_IN_RANGE) {
									creep.moveTo(creep.room.terminal, {
										reusePath: 5
									});
									creep.memory.isMoving = true;
								} else {
									creep.memory.isMoving = false;
								}
							} else if (min2Amount > 0 && lab8.mineralAmount < lab8.mineralCapacity - 250) {
								var withdrawResult = creep.withdraw(creep.room.terminal, creep.memory.mineral8)
								if (withdrawResult == ERR_NOT_IN_RANGE) {
									creep.moveTo(creep.room.terminal, {
										reusePath: 5
									});
									creep.memory.isMoving = true;
								} else {
									creep.memory.isMoving = false;
								}
							} else {
								checkForMoreWork = true;
							}
						} else {
							if (creep.carry[creep.memory.mineral7]) {
								var transferResult = creep.transfer(lab7, creep.memory.mineral7)
								if (transferResult == ERR_NOT_IN_RANGE) {
									creep.moveTo(lab7, {
										reusePath: 5
									});
									creep.memory.isMoving = true;
								} else {
									creep.memory.isMoving = false;
								}
							} else if (creep.carry[creep.memory.mineral8]) {
								var transferResult = creep.transfer(lab8, creep.memory.mineral8)
								if (transferResult == ERR_NOT_IN_RANGE) {
									creep.moveTo(lab8, {
										reusePath: 5
									});
									creep.memory.isMoving = true;
								} else {
									creep.memory.isMoving = false;
								}
							} else if (creep.carry[creep.memory.mineral9]) {
								if (creep.memory.storeProduced && lab4 && lab5 && lab6) {
									if (creep.memory.mineral4 == creep.memory.mineral9 && lab4.mineralAmount <= 2500) {
										checkForMoreWork = true;
									} else if (creep.memory.mineral5 == creep.memory.mineral9 && lab5.mineralAmount <= 2500) {
										checkForMoreWork = true;
									} else if (creep.memory.mineral6 == creep.memory.mineral9 && lab6.mineralAmount <= 2500) {
										checkForMoreWork = true;
									} else if (creep.transfer(creep.room.terminal, creep.memory.mineral9) == ERR_NOT_IN_RANGE) {
										creep.moveTo(creep.room.terminal, {
											reusePath: 5
										});
										creep.memory.isMoving = true;
									} else if (transferResult == OK) {
										creep.memory.isMoving = false;
									}
								} else if (creep.transfer(creep.room.terminal, creep.memory.mineral9) == ERR_NOT_IN_RANGE) {
									creep.moveTo(creep.room.terminal, {
										reusePath: 5
									});
									creep.memory.isMoving = true;
								} else {
									creep.memory.isMoving = false;
								}
							} else {
								checkForMoreWork = true;
							}
						}
					} else if (creep.room.terminal.store[creep.memory.mineral9] >= 40000) {
						checkForMoreWork = true;
					}

					if (checkForMoreWork && lab4 && lab5 && lab6) {
						checkForMoreWork = false;
						var min4Amount = creep.memory.mineral4 in creep.room.terminal.store;
						var min5Amount = creep.memory.mineral5 in creep.room.terminal.store;
						var min6Amount = creep.memory.mineral6 in creep.room.terminal.store;
						var min4Lab = lab4.mineralAmount;
						var min5Lab = lab5.mineralAmount;
						var min6Lab = lab6.mineralAmount;
						if (_.sum(creep.carry) == 0 && creep.memory.priority != 'labWorkerNearDeath') {
							if (min4Lab <= 2500 && min4Amount > 0) {
								var withdrawResult = creep.withdraw(creep.room.terminal, creep.memory.mineral4);
								if (withdrawResult == ERR_NOT_IN_RANGE) {
									creep.moveTo(creep.room.terminal, {
										reusePath: 5
									});
									creep.memory.isMoving = true;
								} else {
									creep.memory.isMoving = false;
								}
							} else if (min5Lab <= 2500 && min5Amount > 0) {
								var withdrawResult = creep.withdraw(creep.room.terminal, creep.memory.mineral5);
								if (withdrawResult == ERR_NOT_IN_RANGE) {
									creep.moveTo(creep.room.terminal, {
										reusePath: 5
									});
									creep.memory.isMoving = true;
								} else {
									creep.memory.isMoving = false;
								}
							} else if (min6Lab <= 2500 && min6Amount > 0) {
								var withdrawResult = creep.withdraw(creep.room.terminal, creep.memory.mineral6);
								if (withdrawResult == ERR_NOT_IN_RANGE) {
									creep.moveTo(creep.room.terminal, {
										reusePath: 5
									});
									creep.memory.isMoving = true;
								} else {
									creep.memory.isMoving = false;
								}
							} else {
								checkForMoreWork = true;
							}
						} else {
							if (creep.carry[creep.memory.mineral4]) {
								if (min4Lab > 2500) {
									var transferResult = creep.transfer(creep.room.terminal, creep.memory.mineral4);
									if (transferResult == ERR_NOT_IN_RANGE) {
										creep.moveTo(creep.room.terminal, {
											reusePath: 5
										});
										creep.memory.isMoving = true;
									} else {
										creep.memory.isMoving = false;
									}
								} else {
									var transferResult = creep.transfer(lab4, creep.memory.mineral4);
									if (transferResult == ERR_NOT_IN_RANGE) {
										creep.moveTo(lab4, {
											reusePath: 5
										});
										creep.memory.isMoving = true;
									} else {
										creep.memory.isMoving = false;
									}
								}
							} else if (creep.carry[creep.memory.mineral5]) {
								if (min5Lab > 2500) {
									var transferResult = creep.transfer(creep.room.terminal, creep.memory.mineral5);
									if (transferResult == ERR_NOT_IN_RANGE) {
										creep.moveTo(creep.room.terminal, {
											reusePath: 5
										});
										creep.memory.isMoving = true;
									} else {
										creep.memory.isMoving = false;
									}
								} else {
									var transferResult = creep.transfer(lab5, creep.memory.mineral5);
									if (transferResult == ERR_NOT_IN_RANGE) {
										creep.moveTo(lab5, {
											reusePath: 5
										});
										creep.memory.isMoving = true;
									} else {
										creep.memory.isMoving = false;
									}
								}
							} else if (creep.carry[creep.memory.mineral6]) {
								if (min6Lab > 2500) {
									var transferResult = creep.transfer(creep.room.terminal, creep.memory.mineral6);
									if (transferResult == ERR_NOT_IN_RANGE) {
										creep.moveTo(creep.room.terminal, {
											reusePath: 5
										});
										creep.memory.isMoving = true;
									} else {
										creep.memory.isMoving = false;
									}
								} else {
									var transferResult = creep.transfer(lab6, creep.memory.mineral6);
									if (transferResult == ERR_NOT_IN_RANGE) {
										creep.moveTo(lab6, {
											reusePath: 5
										});
										creep.memory.isMoving = true;
									} else {
										creep.memory.isMoving = false;
									}
								}
							} else {
								checkForMoreWork = true;
							}
						}
					}

					if (checkForMoreWork && creep.room.terminal) {
						if (creep.room.storage && _.sum(creep.room.storage.store) != creep.room.storage.store[RESOURCE_ENERGY]) {
							if (Object.keys(creep.room.storage.store).length > 1 && Object.keys(creep.room.storage.store)[1] != RESOURCE_ENERGY){
								var withdrawResult = creep.withdraw(creep.room.storage.store, Object.keys(creep.room.storage.store)[1]);
								if (withdrawResult == ERR_NOT_IN_RANGE) {
									creep.moveTo(creep.room.storage.store);
									creep.memory.isMoving = true;
								} else if (withdrawResult == OK) {
									creep.moveTo(creep.room.terminal);
									creep.memory.isMoving = true;
									creep.memory.movingOtherMineral = true;
								}
							}						
						} else if (!creep.pos.isNearTo(creep.room.terminal)) {
							creep.moveTo(creep.room.terminal, {
								reusePath: 5
							});
							creep.memory.isMoving = true;
						} else {
							creep.memory.isMoving = false;
						}
					}
				}

				break;
		}

		if (Memory.roomsUnderAttack.indexOf(creep.room.name) > -1) {
			var Foe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 7, {
				filter: (eCreep) => ((eCreep.getActiveBodyparts(ATTACK) > 0 || eCreep.getActiveBodyparts(RANGED_ATTACK) > 0) && !Memory.whiteList.includes(eCreep.owner.username))
			});

			if (Foe.length) {
				if (creep.memory.fromSpawn) {
					var thisSpawn = Game.getObjectById(creep.memory.fromSpawn);
					if (thisSpawn) {
						creep.moveTo(spawnTarget);
					}
				} else {
					var spawnTarget = creep.pos.findClosestByRange(FIND_STRUCTURES, {
						filter: (structure) => {
							return structure.structureType == STRUCTURE_SPAWN;
						}
					});
					if (spawnTarget) {
						creep.moveTo(spawnTarget);
					}
				}
			}
		}
	}
};

module.exports = creep_work5;

function repairCompare(a, b) {
	if (a.hits < b.hits)
		return -1;
	if (a.hits > b.hits)
		return 1;
	return 0;
}