var creep_farMining = {

	/** @param {Creep} creep **/
	run: function(creep) {
		if (creep.memory.priority == 'farClaimer' || creep.memory.priority == 'farClaimerNearDeath') {
			if (creep.ticksToLive <= 20) {
				creep.memory.priority == 'farClaimerNearDeath';
				creep.room.visual.text("\u2620\u27A1\uD83D\uDEA9", creep.pos.x, creep.pos.y, {
					align: 'left',
					color: '#7DE3B5'
				});
			} else {
				creep.room.visual.text("\u27A1\uD83D\uDEA9", creep.pos.x, creep.pos.y, {
					align: 'left',
					color: '#7DE3B5'
				});
			}

			if (creep.room.name != creep.memory.destination) {
				creep.moveTo(new RoomPosition(25, 25, creep.memory.destination));
			} else {
				if (creep.room.controller.reservation && (creep.room.name == creep.memory.destination)) {
					if (creep.room.controller.reservation.ticksToEnd <= 1000) {
						Memory.FarClaimerNeeded[creep.room.name] = true;
					} else {
						Memory.FarClaimerNeeded[creep.room.name] = false;
					}
				} else if (creep.room.name == creep.memory.destination) {
					Memory.FarClaimerNeeded[creep.room.name] = true;
				}

				if (creep.reserveController(creep.room.controller) == ERR_NOT_IN_RANGE) {
					creep.moveTo(creep.room.controller, {
						reusePath: 25
					});
				}
			}
		} else if (creep.memory.priority == 'farMiner' || creep.memory.priority == 'farMinerNearDeath') {
			if (creep.ticksToLive <= 60) {
				creep.memory.priority == 'farMinerNearDeath';
				creep.room.visual.text("\u2620\u27A1\u26CF", creep.pos.x, creep.pos.y, {
					align: 'left',
					color: '#7DE3B5'
				});
			} else {
				creep.room.visual.text("\u27A1\u26CF", creep.pos.x, creep.pos.y, {
					align: 'left',
					color: '#7DE3B5'
				});
			}

			if (creep.room.name != creep.memory.destination) {
				creep.moveTo(new RoomPosition(25, 25, creep.memory.destination), {
					reusePath: 25
				});
			} else {
				if (creep.room.controller.reservation && (creep.room.name == creep.memory.destination)) {
					if (creep.room.controller.reservation.ticksToEnd <= 1000) {
						Memory.FarClaimerNeeded[creep.room.name] = true;
					} else {
						Memory.FarClaimerNeeded[creep.room.name] = false;
					}
				} else if (creep.room.name == creep.memory.destination) {
					Memory.FarClaimerNeeded[creep.room.name] = true;
				}

				var mineTarget = "";

				if (creep.memory.mineSource) {
					mineTarget = Game.getObjectById(creep.memory.mineSource);
					if (mineTarget && _.sum(creep.carry) <= 35) {
						if (creep.harvest(mineTarget) == ERR_NOT_IN_RANGE) {
							creep.moveTo(mineTarget, {
								reusePath: 25
							});
						}
					}
				} else {
					//Get the source ID while in the room
					var markedSources = [];
					if (Game.flags[creep.memory.targetFlag]) {
						markedSources = Game.flags[creep.memory.targetFlag].pos.lookFor(LOOK_SOURCES);
					}
					if (markedSources.length) {
						creep.memory.mineSource = markedSources[0].id;
					}
					mineTarget = Game.getObjectById(creep.memory.mineSource);
					if (mineTarget) {
						if (creep.harvest(mineTarget) == ERR_NOT_IN_RANGE) {
							creep.moveTo(mineTarget, {
								reusePath: 25
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
								creep.moveTo(thisUnit, {
									reusePath: 25
								});
							}
						}
					}
				} else {
					if (mineTarget) {
						if (creep.pos.inRangeTo(mineTarget, 5)) {
							var containers = creep.pos.findInRange(FIND_STRUCTURES, 5, {
								filter: (structure) => structure.structureType == STRUCTURE_CONTAINER
							});
							if (containers.length) {
								if (creep.transfer(containers[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
									creep.moveTo(containers[0], {
										reusePath: 25
									});
								}
								creep.memory.storageUnit = containers[0].id;
							} else {
								var sites = creep.pos.findInRange(FIND_CONSTRUCTION_SITES, 5)
								if (sites.length) {
									if (creep.build(sites[0]) == ERR_NOT_IN_RANGE) {
										creep.moveTo(sites[0], {
											reusePath: 25
										});
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
				}
			}
		} else if (creep.memory.priority == 'farMule' || creep.memory.priority == 'farMuleNearDeath') {
			if (creep.ticksToLive <= 170) {
				creep.memory.priority = 'farMuleNearDeath';
				creep.room.visual.text("\u2620\u27A1\uD83D\uDC02", creep.pos.x, creep.pos.y, {
					align: 'left',
					color: '#7DE3B5'
				});
			} else {
				creep.room.visual.text("\u27A1\uD83D\uDC02", creep.pos.x, creep.pos.y, {
					align: 'left',
					color: '#7DE3B5'
				});
			}

			if (creep.room.name != creep.memory.destination && _.sum(creep.carry) <= 600) {
				var droppedSources = creep.pos.findInRange(FIND_DROPPED_ENERGY, 3);
				if (droppedSources.length) {
					//Pick up dropped energy from dead mules, etc.
					if (creep.pickup(droppedSources[0]) == ERR_NOT_IN_RANGE) {
						creep.moveTo(droppedSources[0], {
							reusePath: 25
						});
					}
				} else {
					creep.moveTo(new RoomPosition(25, 25, creep.memory.destination), {
						reusePath: 25
					});
				}
			} else if (creep.room.name != creep.memory.homeRoom && _.sum(creep.carry) > 600) {
				creep.moveTo(new RoomPosition(25, 25, creep.memory.homeRoom), {
					reusePath: 25
				});
			} else {
				if (creep.room.controller.reservation && (creep.room.name == creep.memory.destination)) {
					if (creep.room.controller.reservation.ticksToEnd <= 1000) {
						Memory.FarClaimerNeeded[creep.room.name] = true;
					} else {
						Memory.FarClaimerNeeded[creep.room.name] = false;
					}
				} else if (creep.room.name == creep.memory.destination) {
					Memory.FarClaimerNeeded[creep.room.name] = true;
				}

				if (_.sum(creep.carry) <= 600) {
					var droppedSources = creep.pos.findInRange(FIND_DROPPED_ENERGY, 10);
					if (droppedSources.length) {
						//Pick up dropped energy from dead mules, etc.
						if (creep.pickup(droppedSources[0]) == ERR_NOT_IN_RANGE) {
							creep.moveTo(droppedSources[0], {
								reusePath: 25
							});
						}
					} else {
						//in farRoom, pick up container contents
						if (creep.memory.containerTarget) {
							var thisContainer = Game.getObjectById(creep.memory.containerTarget);
							if (thisContainer) {
								if (thisContainer.store[RESOURCE_ENERGY] > 0) {
									if (creep.withdraw(thisContainer, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
										creep.moveTo(thisContainer, {
											reusePath: 25,
											ignoreRoads: true
										});
									}
								} else {
									//Wait by controller
									creep.moveTo(creep.room.controller);
								}

							}
						} else {
							//No container yet, move to be near source
							if (!creep.memory.mineSource) {
								var markedSources = [];
								if (Game.flags[creep.memory.targetFlag]) {
									markedSources = Game.flags[creep.memory.targetFlag].pos.lookFor(LOOK_SOURCES);
								}
								if (markedSources.length) {
									creep.memory.mineSource = markedSources[0].id;
								}
							}

							var thisSource = Game.getObjectById(creep.memory.mineSource);
							if (thisSource) {
								creep.moveTo(thisSource, {
									reusePath: 25,
									ignoreRoads: true
								});
								if (creep.pos.inRangeTo(thisSource, 5)) {
									//Search for container
									var containers = creep.pos.findInRange(FIND_STRUCTURES, 5, {
										filter: (structure) => structure.structureType == STRUCTURE_CONTAINER
									});
									if (containers.length) {
										creep.memory.containerTarget = containers[0].id;
										if (creep.withdraw(containers[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
											creep.moveTo(containers[0], {
												reusePath: 25,
												ignoreRoads: true
											});
										}
									}
								}
							}
						}
					}
				} else {
					//in home room, drop off energy
					var storageUnit = Game.getObjectById(creep.memory.storageSource)
					if (storageUnit) {
						if (creep.transfer(storageUnit, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
							creep.moveTo(storageUnit, {
								reusePath: 25,
								ignoreRoads: true
							});
						}
					}
				}
			}
		} else if (creep.memory.priority == 'farGuard' || creep.memory.priority == 'farGuardNearDeath') {
			creep.notifyWhenAttacked(false);
			if (creep.ticksToLive <= 70) {
				creep.memory.priority == 'farGuardNearDeath';
				creep.room.visual.text("\u2620\u27A1\u2694", creep.pos.x, creep.pos.y, {
					align: 'left',
					color: '#7DE3B5'
				});
			} else {
				creep.room.visual.text("\u27A1\u2694", creep.pos.x, creep.pos.y, {
					align: 'left',
					color: '#7DE3B5'
				});
			}

			if (creep.hits < creep.hitsMax) {
				creep.heal(creep);
			}


			if (creep.room.controller.reservation && (creep.room.name == creep.memory.destination)) {
				if (creep.room.controller.reservation.ticksToEnd <= 1000) {
					Memory.FarClaimerNeeded[creep.room.name] = true;
				} else {
					Memory.FarClaimerNeeded[creep.room.name] = false;
				}
			} else if (creep.room.name == creep.memory.destination) {
				Memory.FarClaimerNeeded[creep.room.name] = true;
			}

			var Foe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);

			if (creep.room.controller.owner && creep.room.controller.owner.username != "Montblanc" && creep.room.name != creep.memory.destination) {
				creep.moveTo(new RoomPosition(25, 25, creep.memory.destination), {
					reusePath: 25
				});
			} else if (Foe) {
				if (creep.pos.getRangeTo(Foe) > 3 || (Foe.getActiveBodyparts(ATTACK) == 0) || (creep.getActiveBodyparts(RANGED_ATTACK) == 0)) {
					creep.moveTo(Foe, {
							maxRooms = 1
						});
					creep.attack(Foe);
					creep.rangedAttack(Foe);
				} else {
					var foeDirection = creep.pos.getDirectionTo(Foe);
					var evadeDirection = TOP;
					switch (foeDirection) {
						case TOP:
							evadeDirection = BOTTOM;
							break;
						case TOP_RIGHT:
							evadeDirection = BOTTOM_LEFT;
							break;
						case RIGHT:
							evadeDirection = LEFT;
							break;
						case BOTTOM_RIGHT:
							evadeDirection = TOP_LEFT;
							break;
						case BOTTOM:
							evadeDirection = TOP;
							break;
						case BOTTOM_LEFT:
							evadeDirection = TOP_RIGHT;
							break;
						case LEFT:
							evadeDirection = RIGHT;
							break;
						case TOP_LEFT:
							evadeDirection = BOTTOM_RIGHT;
							break;
					}
					creep.move(evadeDirection);
					creep.attack(Foe);
					creep.rangedAttack(Foe);
				}
			} else if (creep.room.controller.owner && creep.room.controller.owner.username != "Montblanc") {
				var hSpawn = creep.pos.findClosestByRange(FIND_HOSTILE_SPAWNS);
				if (hSpawn) {
					creep.moveTo(hSpawn);
					creep.attack(hSpawn);
					creep.rangedAttack(hSpawn);
				} else {
					try {
						creep.moveTo(Game.flags[creep.memory.targetFlag].pos);
					} catch (e) {
						//Eat it
					}
				}
			} else if (creep.room.name != creep.memory.destination) {
				creep.moveTo(new RoomPosition(25, 25, creep.memory.destination), {
					reusePath: 25
				});
			} else if (Game.flags[creep.memory.targetFlag]) {
				if (creep.pos != Game.flags[creep.memory.targetFlag].pos) {
					creep.moveTo(Game.flags[creep.memory.targetFlag]);
				}
			}
		}
	}
};
module.exports = creep_farMining;