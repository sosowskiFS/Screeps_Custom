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
			if (someStructure.length && (someStructure[0].hitsMax - someStructure[0].hits >= 600)) {
				creep.repair(someStructure[0]);
			}
		}

		if (creep.memory.priority == 'miner' || creep.memory.priority == 'minerNearDeath') {
			if (creep.ticksToLive <= 60) {
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
				if (creep.transfer(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
					creep.moveTo(storageTarget, {
						reusePath: 5,
						ignoreRoads: ignoreRoadsValue
					});
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
		} else if (creep.memory.priority == 'upgrader' || creep.memory.priority == 'upgraderNearDeath') {
			if (creep.ticksToLive <= 60) {
				creep.memory.priority = 'upgraderNearDeath';
			}

			if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
				creep.moveTo(creep.room.controller, {
					reusePath: 20
				});
			}

			var linkTarget = Game.getObjectById(creep.memory.linkSource);
			if (linkTarget) {
				if (creep.withdraw(linkTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
					creep.moveTo(linkTarget, {
						reusePath: 20
					});
				}
			}
		} else if (creep.memory.priority == 'mule' || creep.memory.priority == 'muleNearDeath') {
			if (creep.ticksToLive <= 60) {
				creep.memory.priority = 'muleNearDeath';
			}
			if (_.sum(creep.carry) == 0) {
				creep.memory.structureTarget = undefined;
				var storageTarget = Game.getObjectById(creep.memory.storageSource);
				if (storageTarget) {
					if (storageTarget.store[RESOURCE_ENERGY] >= 50) {
						//Get from container
						if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
							creep.moveTo(storageTarget, {
								reusePath: 5
							});
						}
					} else {
						if (!creep.pos.isNearTo(storageTarget)) {
							creep.moveTo(storageTarget, {
								reusePath: 5
							});
						}

					}
				}
			} else if (_.sum(creep.carry) > 0) {
				var savedTarget = Game.getObjectById(creep.memory.structureTarget)

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
							if (creep.transfer(savedTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
								creep.moveTo(savedTarget, {
									reusePath: 5
								});
							} else {
								//assumed OK, drop target
								creep.memory.structureTarget = undefined;
							}
						} else {
							//Upgrading controller
							if (creep.upgradeController(savedTarget) == ERR_NOT_IN_RANGE) {
								creep.moveTo(savedTarget, {
									reusePath: 20
								});
							} else {
								//Check for nearby link and fill it if possible.
								var links = creep.pos.findInRange(FIND_STRUCTURES, 3, {
									filter: {
										structureType: STRUCTURE_LINK
									}
								});
								if (links) {
									if (links.length > 0) {
										if (links[0].energy < 400) {
											if (creep.transfer(links[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
												creep.moveTo(links[0]);
											}
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
					var targets = creep.pos.findClosestByRange(FIND_STRUCTURES, {
						filter: (structure) => {
							return (structure.structureType == STRUCTURE_EXTENSION ||
								structure.structureType == STRUCTURE_SPAWN) && structure.energy < structure.energyCapacity;
						}
					});
					if (targets) {
						creep.memory.structureTarget = targets.id;
						if (creep.transfer(targets, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
							creep.moveTo(targets);
						} else {
							creep.memory.structureTarget = undefined;
						}
					} else {
						targets3 = creep.pos.findClosestByRange(FIND_STRUCTURES, {
							filter: (structure) => {
								return (structure.structureType == STRUCTURE_TOWER) && (structure.energy < structure.energyCapacity);
							}
						});
						if (targets3) {
							creep.memory.structureTarget = targets3.id;
							if (creep.transfer(targets3, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
								creep.moveTo(targets3);
							} else {
								creep.memory.structureTarget = undefined;
							}
						} else {
							//Store in terminal
							terminalTarget = Game.getObjectById(creep.memory.terminalID)
							if (terminalTarget) {
								if (terminalTarget.store[RESOURCE_ENERGY] < 50000) {
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
								//Build
								var targets2 = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
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
									//Upgrade
									creep.memory.structureTarget = creep.room.controller.id;
									if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
										creep.moveTo(creep.room.controller, {
											reusePath: 20
										});
									} else if (creep.upgradeController(creep.room.controller) == ERR_NO_BODYPART) {
										creep.suicide();
									}
								}
							}
						}
					}
				}
			}
		} else if (creep.memory.priority == 'repair' || creep.memory.priority == 'repairNearDeath') {
			if (creep.ticksToLive <= 60) {
				creep.memory.priority = 'repairNearDeath';
			}

			if (_.sum(creep.carry) == 0) {
				creep.memory.structureTarget = undefined;
				//Get from storage
				var storageTarget = Game.getObjectById(creep.memory.storageSource);
				if (storageTarget) {
					if (storageTarget.store[RESOURCE_ENERGY] >= 120) {
						if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
							creep.moveTo(storageTarget, {
								reusePath: 20
							});
						}
					} else {
						if (!creep.pos.isNearTo(storageTarget)) {
							creep.moveTo(storageTarget, {
								reusePath: 20
							});
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
								reusePath: 20
							});
						}
					}
				} else {
					creep.memory.structureTarget = undefined;
				}
			} else {
				var closestDamagedStructure = creep.room.find(FIND_STRUCTURES, {
					filter: (structure) => (structure.structureType != STRUCTURE_ROAD) && (structure.hitsMax - structure.hits >= 200)
				});
				if (closestDamagedStructure.length > 0) {
					closestDamagedStructure.sort(repairCompare);
					creep.memory.structureTarget = closestDamagedStructure[0].id;
					if (creep.repair(closestDamagedStructure[0]) == ERR_NOT_IN_RANGE) {
						creep.moveTo(closestDamagedStructure[0], {
							reusePath: 20
						});
					}
				}
			}

		} else if (creep.memory.priority == 'mineralMiner') {
			var thisMineral = Game.getObjectById(creep.memory.mineralID);
			if (thisMineral.mineralAmount == 0) {
				//Nothing left to do
				creep.suicide();
			} else {
				//Creep will immediately harvest and store mined materials
				var storageTarget = Game.getObjectById(creep.memory.terminalID);
				var thisExtractor = Game.getObjectById(creep.memory.extractorID);
				if (storageTarget && thisExtractor) {
					if (thisExtractor.cooldown == 0) {
						if (creep.harvest(thisMineral) == ERR_NOT_IN_RANGE) {
							creep.moveTo(thisMineral, {
								reusePath: 20
							});
						}
					}
					if (creep.transfer(storageTarget, thisMineral.mineralType) == ERR_NOT_IN_RANGE) {
						//This should never actually fire, if ideal.
						creep.moveTo(storageTarget);
					}

					/*if ((creep.pos.isNearTo(storageTarget) && !creep.pos.isNearTo(thisExtractor))) {
					    var thisDirection = creep.pos.getDirectionTo(thisExtractor);
					    creep.move(thisDirection);
					} else if (!creep.pos.isNearTo(storageTarget) && creep.pos.isNearTo(thisExtractor)) {
					    var thisDirection = creep.pos.getDirectionTo(storageTarget);
					    creep.move(thisDirection);
					}*/
				}
			}
		} else if (creep.memory.priority == 'salvager') {
			var sources = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
			if (!sources && _.sum(creep.carry) == 0) {
				//There's nothing left to do
				creep.suicide();
			} else if (sources && _.sum(creep.carry) < creep.carryCapacity) {
				if (creep.pickup(sources) == ERR_NOT_IN_RANGE) {
					creep.moveTo(sources);
				}
			}
			if (!sources && _.sum(creep.carry) > 0 || _.sum(creep.carry) > 100) {
				var storageTarget = Game.getObjectById(creep.memory.storageTarget);
				if (Object.keys(creep.carry).length > 1) {
					if (creep.transfer(storageTarget, Object.keys(creep.carry)[1]) == ERR_NOT_IN_RANGE) {
						creep.moveTo(storageTarget);
					}
				} else if (creep.transfer(storageTarget, Object.keys(creep.carry)[0]) == ERR_NOT_IN_RANGE) {
					creep.moveTo(storageTarget);
				}
			}
		} else if (creep.memory.priority == 'farClaimer') {
			var farIndex = Memory.FarCreeps[creep.memory.homeRoom].indexOf(creep.memory.priority);
			if (creep.ticksToLive <= 5 && farIndex > -1) {
				//Remove yourself from the list of farCreeps
				Memory.FarCreeps[creep.memory.homeRoom].splice(farIndex, 1);
			} else if (farIndex == -1) {
				Memory.FarCreeps[creep.memory.homeRoom].push('farClaimer')
			}

			if (creep.room.name != creep.memory.destination) {
				creep.moveTo(new RoomPosition(25, 25, creep.memory.destination));
			} else {
				if (creep.room.controller.reservation) {
					if (creep.room.controller.reservation.ticksToEnd <= 1000) {
						Memory.FarClaimerNeeded[creep.memory.homeRoom] = true;
					} else {
						Memory.FarClaimerNeeded[creep.memory.homeRoom] = false;
					}
				} else {
					Memory.FarClaimerNeeded[creep.memory.homeRoom] = true;
				}

				if (creep.reserveController(creep.room.controller) == ERR_NOT_IN_RANGE) {
					creep.moveTo(creep.room.controller);
				}
			}
		} else if (creep.memory.priority == 'farMiner') {
			var farIndex = Memory.FarCreeps[creep.memory.homeRoom].indexOf(creep.memory.priority);
			if (creep.ticksToLive <= 5 && farIndex > -1) {
				//Remove yourself from the list of farCreeps
				Memory.FarCreeps[creep.memory.homeRoom].splice(farIndex, 1);
			} else if (farIndex == -1) {
				Memory.FarCreeps[creep.memory.homeRoom].push('farMiner');
			}

			if (creep.room.name != creep.memory.destination) {
				creep.moveTo(new RoomPosition(25, 25, creep.memory.destination));
			} else {
				if (creep.room.controller.reservation) {
					if (creep.room.controller.reservation.ticksToEnd <= 1000) {
						Memory.FarClaimerNeeded[creep.memory.homeRoom] = true;
					} else {
						Memory.FarClaimerNeeded[creep.memory.homeRoom] = false;
					}
				} else {
					Memory.FarClaimerNeeded[creep.memory.homeRoom] = true;
				}

				var mineTarget = "";

				if (creep.memory.mineSource) {
					mineTarget = Game.getObjectById(creep.memory.mineSource);
					if (mineTarget) {
						if (creep.harvest(mineTarget) == ERR_NOT_IN_RANGE) {
							creep.moveTo(mineTarget, {
								reusePath: 5
							});
						}
					}
				} else {
					//Get the source ID while in the room
					var markedSources = [];
					if (Game.flags[creep.memory.homeRoom + "FarMining"]) {
						markedSources = Game.flags[creep.memory.homeRoom + "FarMining"].pos.lookFor(LOOK_SOURCES);
					}
					if (markedSources.length) {
						creep.memory.mineSource = markedSources[0].id;
					}
					mineTarget = Game.getObjectById(creep.memory.mineSource);
					if (mineTarget) {
						if (creep.harvest(mineTarget) == ERR_NOT_IN_RANGE) {
							creep.moveTo(mineTarget, {
								reusePath: 5
							});
						}
					}
				}

				if (creep.memory.storageUnit) {
					var thisUnit = Game.getObjectById(creep.memory.storageUnit);
					if (thisUnit) {
						if (thisUnit.hits < thisUnit.hitsMax) {
							creep.repair(thisUnit);
						} else {
							if (creep.transfer(thisUnit, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
								creep.moveTo(thisUnit);
							}
						}
					}
				} else {
					var containers = creep.pos.findInRange(FIND_STRUCTURES, 50, {
						filter: (structure) => structure.structureType == STRUCTURE_CONTAINER
					});
					if (containers.length) {
						if (creep.transfer(containers[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
							creep.moveTo(containers[0]);
						}
						creep.memory.storageUnit = containers[0].id;
					} else {
						var sites = creep.pos.findInRange(FIND_CONSTRUCTION_SITES, 50)
						if (sites.length) {
							if (creep.build(sites[0]) == ERR_NOT_IN_RANGE) {
								creep.moveTo(sites[0]);
							}
						} else {
							//Create new container
							if (creep.pos.isNearTo(mineTarget)) {
								creep.room.createConstructionSite(creep.pos, STRUCTURE_CONTAINER)
							}
						}
					}
				}
			}
		} else if (creep.memory.priority == 'farMule') {
			var farIndex = Memory.FarCreeps[creep.memory.homeRoom].indexOf(creep.memory.priority);
			if (creep.ticksToLive <= 5 && farIndex > -1) {
				//Remove yourself from the list of farCreeps
				Memory.FarCreeps[creep.memory.homeRoom].splice(farIndex, 1);
			} else if (farIndex == -1) {
				Memory.FarCreeps[creep.memory.homeRoom].push('farMule')
			}

			if (creep.room.name != creep.memory.destination && _.sum(creep.carry) <= 150) {
				creep.moveTo(new RoomPosition(25, 25, creep.memory.destination));
			} else if (creep.room.name != creep.memory.homeRoom && _.sum(creep.carry) > 150) {
				creep.moveTo(new RoomPosition(25, 25, creep.memory.homeRoom));
			} else {
				if (creep.room.controller.reservation) {
					if (creep.room.controller.reservation.ticksToEnd <= 1000) {
						Memory.FarClaimerNeeded[creep.memory.homeRoom] = true;
					} else {
						Memory.FarClaimerNeeded[creep.memory.homeRoom] = false;
					}
				} else {
					Memory.FarClaimerNeeded[creep.memory.homeRoom] = true;
				}

				if (_.sum(creep.carry) <= 150) {
					//in farRoom, pick up container contents
					if (creep.memory.containerTarget) {
						var thisContainer = Game.getObjectById(creep.memory.containerTarget);
						if (thisContainer) {
							if (creep.withdraw(thisContainer, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
								creep.moveTo(thisContainer, {
									reusePath: 20
								});
							}
						}
					} else {
						var containers = creep.pos.findInRange(FIND_STRUCTURES, 50, {
							filter: (structure) => structure.structureType == STRUCTURE_CONTAINER
						});
						if (containers.length) {
							creep.memory.containerTarget = containers[0].id;
							if (creep.withdraw(containers[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
								creep.moveTo(containers[0], {
									reusePath: 20
								});
							}
						} else {
							//No container yet, move to be near source
							if (!creep.memory.mineSource) {
								var markedSources = [];
								if (Game.flags[creep.memory.homeRoom + "FarMining"]) {
									markedSources = Game.flags[creep.memory.homeRoom + "FarMining"].pos.lookFor(LOOK_SOURCES);
								}
								if (markedSources.length) {
									creep.memory.mineSource = markedSources[0].id;
								}
							}

							var thisSource = Game.getObjectById(creep.memory.mineSource);
							if (thisSource) {
								creep.moveTo(thisSource);
							}
						}
					}
				} else {
					//in home room, drop off energy
					var storageUnit = Game.getObjectById(creep.memory.storageSource)
					if (storageUnit) {
						if (creep.transfer(storageUnit, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
							creep.moveTo(storageUnit, {
								reusePath: 20
							});
						}
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