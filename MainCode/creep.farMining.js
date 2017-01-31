var creep_farMining = {

	/** @param {Creep} creep **/
	run: function(creep) {
		if (creep.memory.priority == 'farClaimer' || creep.memory.priority == 'farClaimerNearDeath') {
			if (creep.ticksToLive <= 20) {
				creep.memory.priority == 'farClaimerNearDeath';
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
					creep.moveTo(creep.room.controller);
				}
			}
		} else if (creep.memory.priority == 'farMiner' || creep.memory.priority == 'farMinerNearDeath') {
			if (creep.ticksToLive <= 60) {
				creep.memory.priority == 'farMinerNearDeath';
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

				var mineTarget = "";

				if (creep.memory.mineSource) {
					mineTarget = Game.getObjectById(creep.memory.mineSource);
					if (mineTarget && _.sum(creep.carry) <= 35) {
						if (creep.harvest(mineTarget) == ERR_NOT_IN_RANGE) {
							creep.moveTo(mineTarget, {
								reusePath: 5
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
					if (mineTarget) {
						if (creep.pos.inRangeTo(mineTarget, 5)) {
							var containers = creep.pos.findInRange(FIND_STRUCTURES, 5, {
								filter: (structure) => structure.structureType == STRUCTURE_CONTAINER
							});
							if (containers.length) {
								if (creep.transfer(containers[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
									creep.moveTo(containers[0]);
								}
								creep.memory.storageUnit = containers[0].id;
							} else {
								var sites = creep.pos.findInRange(FIND_CONSTRUCTION_SITES, 5)
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
				}
			}
		} else if (creep.memory.priority == 'farMule' || creep.memory.priority == 'farMuleNearDeath') {
			if (creep.ticksToLive <= 170) {
				creep.memory.priority = 'farMuleNearDeath';
			}

			if (creep.room.name != creep.memory.destination && _.sum(creep.carry) <= 900) {
				var droppedSources = creep.pos.findInRange(FIND_DROPPED_ENERGY, 3);
				if (droppedSources.length) {
					//Pick up dropped energy from dead mules, etc.
					if (creep.pickup(droppedSources[0]) == ERR_NOT_IN_RANGE) {
						creep.moveTo(droppedSources[0]);
					}
				} else {
					creep.moveTo(new RoomPosition(25, 25, creep.memory.destination));
				}
			} else if (creep.room.name != creep.memory.homeRoom && _.sum(creep.carry) > 900) {
				creep.moveTo(new RoomPosition(25, 25, creep.memory.homeRoom));
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

				if (_.sum(creep.carry) <= 900) {
					var droppedSources = creep.pos.findInRange(FIND_DROPPED_ENERGY, 10);
					if (droppedSources.length) {
						//Pick up dropped energy from dead mules, etc.
						if (creep.pickup(droppedSources[0]) == ERR_NOT_IN_RANGE) {
							creep.moveTo(droppedSources[0]);
						}
					} else {
						//in farRoom, pick up container contents
						if (creep.memory.containerTarget) {
							var thisContainer = Game.getObjectById(creep.memory.containerTarget);
							if (thisContainer) {
								if (thisContainer.store[RESOURCE_ENERGY] > 0) {
									if (creep.withdraw(thisContainer, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
										creep.moveTo(thisContainer, {
											reusePath: 20,
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
									reusePath: 20,
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
												reusePath: 20,
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
								reusePath: 20,
								ignoreRoads: true
							});
						}
					}
				}
			}
		} else if (creep.memory.priority == 'farGuard' || creep.memory.priority == 'farGuardNearDeath') {
			if (creep.ticksToLive <= 70) {
				creep.memory.priority == 'farGuardNearDeath';
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

				var Foe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
				if (Foe) {
					creep.say('REEEEEEEEE', true);
					if (creep.pos.getRangeTo(Foe) > 3) {
						creep.moveTo(Foe);
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
						creep.rangedAttack(Foe);
					}
				} else {
					creep.moveTo(Game.flags[creep.memory.targetFlag].pos);
				}
			}
		}
	}
};

module.exports = creep_farMining;