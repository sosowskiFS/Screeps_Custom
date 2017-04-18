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

				if (creep.ticksToLive <= creep.memory.deathWarn) {
					creep.memory.priority = 'minerNearDeath';
					creep.memory.jobSpecific = creep.memory.jobSpecific + 'NearDeath';
					creep.room.visual.text("\u2620\u26CF", creep.pos.x, creep.pos.y, {
						align: 'left',
						color: '#7DE3B5'
					});
				} else {
					creep.room.visual.text("\u26CF", creep.pos.x, creep.pos.y, {
						align: 'left',
						color: '#7DE3B5'
					});
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
					if (creep.transfer(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
						if (creep.carry.energy > 0) {
							creep.moveTo(storageTarget, {
								reusePath: 5,
								ignoreRoads: ignoreRoadsValue
							});
						} else {
							if (creep.harvest(mineTarget) == ERR_NOT_IN_RANGE) {
								creep.moveTo(mineTarget, {
									reusePath: 5,
									ignoreRoads: ignoreRoadsValue
								});
							}
						}
					} else if (creep.harvest(mineTarget) == ERR_NOT_IN_RANGE) {
						creep.moveTo(mineTarget, {
							reusePath: 5,
							ignoreRoads: ignoreRoadsValue
						});
					}

					/*if ((creep.pos.isNearTo(storageTarget) && !creep.pos.isNearTo(mineTarget))) {
					    var thisDirection = creep.pos.getDirectionTo(mineTarget);
					    creep.move(thisDirection);
					} else if (!creep.pos.isNearTo(storageTarget) && creep.pos.isNearTo(mineTarget)) {
					    var thisDirection = creep.pos.getDirectionTo(storageTarget);
					    creep.move(thisDirection);
					}*/
				}
				break;
			case 'upgrader':
			case 'upgraderNearDeath':
				if (!creep.memory.deathWarn) {
					creep.memory.deathWarn = _.size(creep.body) * 4;
				}

				if (creep.ticksToLive <= creep.memory.deathWarn) {
					creep.memory.priority = 'upgraderNearDeath';
					creep.room.visual.text("\u2620\uD83D\uDC46", creep.pos.x, creep.pos.y, {
						align: 'left',
						color: '#7DE3B5'
					});
				} else {
					creep.room.visual.text("\uD83D\uDC46", creep.pos.x, creep.pos.y, {
						align: 'left',
						color: '#7DE3B5'
					});
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
				break;
			case 'mule':
			case 'muleNearDeath':
				if (!creep.memory.deathWarn) {
					creep.memory.deathWarn = _.size(creep.body) * 4;
				}

				if (creep.ticksToLive <= creep.memory.deathWarn) {
					creep.memory.priority = 'muleNearDeath';
					creep.room.visual.text("\u2620\uD83D\uDC02", creep.pos.x, creep.pos.y, {
						align: 'left',
						color: '#7DE3B5'
					});
				} else {
					creep.room.visual.text("\uD83D\uDC02", creep.pos.x, creep.pos.y, {
						align: 'left',
						color: '#7DE3B5'
					});
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
							if (Object.keys(creep.carry).length > 1) {
								if (creep.transfer(creep.room.terminal, Object.keys(creep.carry)[1]) == ERR_NOT_IN_RANGE) {
									creep.moveTo(creep.room.terminal, {
										reusePath: 5
									});
								}
							} else if (creep.transfer(creep.room.terminal, Object.keys(creep.carry)[0]) == ERR_NOT_IN_RANGE) {
								creep.moveTo(creep.room.terminal, {
									reusePath: 5
								});
							}
						} else if (!creep.room.terminal && creep.room.storage) {
							if (Object.keys(creep.carry).length > 1) {
								if (creep.transfer(creep.room.storage, Object.keys(creep.carry)[1]) == ERR_NOT_IN_RANGE) {
									creep.moveTo(creep.room.storage, {
										reusePath: 5
									});
								}
							} else if (creep.transfer(creep.room.storage, Object.keys(creep.carry)[0]) == ERR_NOT_IN_RANGE) {
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
									//Storing in spawn/extension/tower
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
											if (terminalTarget.store[RESOURCE_ENERGY] < 100000 && creep.room.storage && creep.room.storage.store[RESOURCE_ENERGY] >= 50000) {
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
				break;
			case 'repair':
			case 'repairNearDeath':
				if (!creep.memory.deathWarn) {
					creep.memory.deathWarn = _.size(creep.body) * 4;
				}

				if (creep.ticksToLive <= creep.memory.deathWarn) {
					creep.memory.priority = 'repairNearDeath';
					creep.room.visual.text("\u2620\uD83D\uDEE0", creep.pos.x, creep.pos.y, {
						align: 'left',
						color: '#7DE3B5'
					});
				} else {
					creep.room.visual.text("\uD83D\uDEE0", creep.pos.x, creep.pos.y, {
						align: 'left',
						color: '#7DE3B5'
					});
				}

				if (_.sum(creep.carry) == 0) {
					creep.memory.structureTarget = undefined;
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
							creep.room.visual.circle(thisStructure.pos, {
								fill: 'transparent',
								stroke: 'green',
								radius: 0.75
							});
							var formattedNumber = thisStructure.hits.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
							creep.room.visual.text(formattedNumber, thisStructure.pos.x + 1, thisStructure.pos.y, {
								align: 'left',
								font: '0.7 Courier New',
								color: '#FFFFFF',
								stroke: '#000000',
								strokeWidth: 0.15
							});
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
				break;
			case 'supplier':
			case 'supplierNearDeath':
				if (!creep.memory.deathWarn) {
					creep.memory.deathWarn = _.size(creep.body) * 4;
				}

				if (creep.ticksToLive <= creep.memory.deathWarn) {
					creep.memory.priority = 'supplierNearDeath';
					creep.room.visual.text("\u2620\uD83D\uDEF5", creep.pos.x, creep.pos.y, {
						align: 'left',
						color: '#7DE3B5'
					});
				} else {
					creep.room.visual.text("\uD83D\uDEF5", creep.pos.x, creep.pos.y, {
						align: 'left',
						color: '#7DE3B5'
					});
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

				if (creep.ticksToLive <= creep.memory.deathWarn) {
					creep.memory.priority = 'distributorNearDeath';
					creep.room.visual.text("\u2620\uD83D\uDC5F", creep.pos.x, creep.pos.y, {
						align: 'left',
						color: '#7DE3B5'
					});
				} else {
					creep.room.visual.text("\uD83D\uDC5F", creep.pos.x, creep.pos.y, {
						align: 'left',
						color: '#7DE3B5'
					});
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
				creep.room.visual.text("\u26CF\uD83D\uDDFB", creep.pos.x, creep.pos.y, {
					align: 'left',
					color: '#7DE3B5'
				});

				var thisMineral = Game.getObjectById(creep.memory.mineralID);
				if (thisMineral.mineralAmount == 0) {
					//Nothing left to do
					creep.suicide();
				} else {
					//Creep will immediately harvest and store mined materials
					var storageTarget = creep.room.terminal;
					var thisExtractor = Game.getObjectById(creep.memory.extractorID);
					if (storageTarget && thisExtractor) {
						if (thisExtractor.cooldown == 0) {
							if (creep.harvest(thisMineral) == ERR_NOT_IN_RANGE) {
								creep.moveTo(thisMineral, {
									reusePath: 25
								});
							}
						}
						if (creep.transfer(storageTarget, thisMineral.mineralType) == ERR_NOT_IN_RANGE) {
							//This should never actually fire, if ideal.
							creep.moveTo(storageTarget);
						}
					}
				}
				break;
			case 'salvager':
				creep.room.visual.text("\uD83D\uDCB2", creep.pos.x, creep.pos.y, {
					align: 'left',
					color: '#7DE3B5'
				});
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
				creep.room.visual.text("\uD83D\uDD2C", creep.pos.x, creep.pos.y, {
					align: 'left',
					color: '#7DE3B5'
				});

				var lab1 = Game.getObjectById(creep.memory.lab1);
				var lab2 = Game.getObjectById(creep.memory.lab2);
				var lab3 = Game.getObjectById(creep.memory.lab3);
				var lab4 = undefined;
				var lab5 = undefined;
				var lab6 = undefined;
				if (creep.memory.lab4) {
					lab4 = Game.getObjectById(creep.memory.lab4);
					lab5 = Game.getObjectById(creep.memory.lab5);
					lab6 = Game.getObjectById(creep.memory.lab6);
				}
				var checkForMoreWork = false;
				if (lab1 && lab2 && lab3) {
					if (_.sum(creep.carry) == 0) {
						var min1Amount = creep.memory.mineral1 in creep.room.terminal.store;
						var min2Amount = creep.memory.mineral2 in creep.room.terminal.store;
						var min3Amount = lab3.mineralAmount;
						if (min3Amount >= 250) {
							if (creep.withdraw(lab3, creep.memory.mineral3) == ERR_NOT_IN_RANGE) {
								creep.moveTo(lab3, {
									reusePath: 5
								});
							}
						} else if (min1Amount > 0 && lab1.mineralAmount < lab1.mineralCapacity - 250) {
							if (creep.withdraw(creep.room.terminal, creep.memory.mineral1) == ERR_NOT_IN_RANGE) {
								creep.moveTo(creep.room.terminal, {
									reusePath: 5
								});
							}
						} else if (min2Amount > 0 && lab2.mineralAmount < lab2.mineralCapacity - 250) {
							if (creep.withdraw(creep.room.terminal, creep.memory.mineral2) == ERR_NOT_IN_RANGE) {
								creep.moveTo(creep.room.terminal, {
									reusePath: 5
								});
							}
						} else {
							checkForMoreWork = true;
						}
					} else {
						if (creep.carry[creep.memory.mineral1]) {
							if (creep.transfer(lab1, creep.memory.mineral1) == ERR_NOT_IN_RANGE) {
								creep.moveTo(lab1, {
									reusePath: 5
								});
							}
						} else if (creep.carry[creep.memory.mineral2]) {
							if (creep.transfer(lab2, creep.memory.mineral2) == ERR_NOT_IN_RANGE) {
								creep.moveTo(lab2, {
									reusePath: 5
								});
							}
						} else if (creep.carry[creep.memory.mineral3]) {
							if (creep.transfer(creep.room.terminal, creep.memory.mineral3) == ERR_NOT_IN_RANGE) {
								creep.moveTo(creep.room.terminal, {
									reusePath: 5
								});
							}
						}
					}
				}

				if (checkForMoreWork && lab4 && lab5 && lab6) {
					var min4Amount = creep.memory.mineral4 in creep.room.terminal.store;
					var min5Amount = creep.memory.mineral5 in creep.room.terminal.store;
					var min6Amount = creep.memory.mineral6 in creep.room.terminal.store;
					var min4Lab = lab4.mineralAmount;
					var min5Lab = lab4.mineralAmount;
					var min6Lab = lab4.mineralAmount;
					if (_.sum(creep.carry) == 0) {
						if (min4Lab <= 500 && min4Amount > 0) {
							if (creep.withdraw(creep.room.terminal, creep.memory.mineral4) == ERR_NOT_IN_RANGE) {
								creep.moveTo(creep.room.terminal, {
									reusePath: 5
								});
							}
						} else if (min5Lab <= 500 && min5Amount > 0) {
							if (creep.withdraw(creep.room.terminal, creep.memory.mineral5) == ERR_NOT_IN_RANGE) {
								creep.moveTo(creep.room.terminal, {
									reusePath: 5
								});
							}
						} else if (min6Lab <= 500 && min6Amount > 0) {
							if (creep.withdraw(creep.room.terminal, creep.memory.mineral6) == ERR_NOT_IN_RANGE) {
								creep.moveTo(creep.room.terminal, {
									reusePath: 5
								});
							}
						} else {
							checkForMoreWork = true;
						}
					} else {
						if (creep.carry[creep.memory.mineral4]) {
							if (creep.transfer(lab4, creep.memory.mineral4) == ERR_NOT_IN_RANGE) {
								creep.moveTo(lab4, {
									reusePath: 5
								});
							}
						} else if (creep.carry[creep.memory.mineral5]) {
							if (creep.transfer(lab5, creep.memory.mineral5) == ERR_NOT_IN_RANGE) {
								creep.moveTo(lab5, {
									reusePath: 5
								});
							}
						} else if (creep.carry[creep.memory.mineral6]) {
							if (creep.transfer(lab6, creep.memory.mineral6) == ERR_NOT_IN_RANGE) {
								creep.moveTo(lab6, {
									reusePath: 5
								});
							}
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