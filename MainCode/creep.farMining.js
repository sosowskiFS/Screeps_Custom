var creep_farMining = {

	/** @param {Creep} creep **/
	run: function(creep) {
		if (creep.memory.priority == 'farClaimer') {
			var farIndex = Memory.FarCreeps[creep.memory.homeRoom].indexOf(creep.memory.priority);
			if (creep.ticksToLive <= 20 && farIndex > -1) {
				//Remove yourself from the list of farCreeps
				Memory.FarCreeps[creep.memory.homeRoom].splice(farIndex, 1);
			} else if (farIndex == -1) {
				Memory.FarCreeps[creep.memory.homeRoom].push('farClaimer')
			}

			if (creep.room.name != creep.memory.destination) {
				creep.moveTo(new RoomPosition(25, 25, creep.memory.destination));
			} else {
				if (creep.room.controller.reservation && (creep.room.name == creep.memory.destination)) {
					if (creep.room.controller.reservation.ticksToEnd <= 1000) {
						Memory.FarClaimerNeeded[creep.memory.homeRoom] = true;
					} else {
						Memory.FarClaimerNeeded[creep.memory.homeRoom] = false;
					}
				} else if (creep.room.name == creep.memory.destination) {
					Memory.FarClaimerNeeded[creep.memory.homeRoom] = true;
				}

				if (creep.reserveController(creep.room.controller) == ERR_NOT_IN_RANGE) {
					creep.moveTo(creep.room.controller);
				}
			}
		} else if (creep.memory.priority == 'farMiner') {
			var farIndex = Memory.FarCreeps[creep.memory.homeRoom].indexOf(creep.memory.priority);
			if (creep.ticksToLive <= 60 && farIndex > -1) {
				//Remove yourself from the list of farCreeps
				Memory.FarCreeps[creep.memory.homeRoom].splice(farIndex, 1);
			} else if (farIndex == -1) {
				Memory.FarCreeps[creep.memory.homeRoom].push('farMiner');
			}

			if (creep.room.name != creep.memory.destination) {
				creep.moveTo(new RoomPosition(25, 25, creep.memory.destination));
			} else {
				if (creep.room.controller.reservation && (creep.room.name == creep.memory.destination)) {
					if (creep.room.controller.reservation.ticksToEnd <= 1000) {
						Memory.FarClaimerNeeded[creep.memory.homeRoom] = true;
					} else {
						Memory.FarClaimerNeeded[creep.memory.homeRoom] = false;
					}
				} else if (creep.room.name == creep.memory.destination) {
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
			if (creep.ticksToLive <= 150 && farIndex > -1) {
				//Remove yourself from the list of farCreeps
				Memory.FarCreeps[creep.memory.homeRoom].splice(farIndex, 1);
			} else if (farIndex == -1) {
				Memory.FarCreeps[creep.memory.homeRoom].push('farMule');
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
						Memory.FarClaimerNeeded[creep.memory.homeRoom] = true;
					} else {
						Memory.FarClaimerNeeded[creep.memory.homeRoom] = false;
					}
				} else if (creep.room.name == creep.memory.destination) {
					Memory.FarClaimerNeeded[creep.memory.homeRoom] = true;
				}

				if (_.sum(creep.carry) <= 900) {
					var droppedSources = creep.pos.findInRange(FIND_DROPPED_ENERGY, 3);
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
								if (creep.withdraw(thisContainer, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
									creep.moveTo(thisContainer, {
										reusePath: 20,
										ignoreRoads: true
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
										reusePath: 20,
										ignoreRoads: true
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
									creep.moveTo(thisSource, {
										reusePath: 20,
										ignoreRoads: true
									});
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
		} else if (creep.memory.priority == 'farGuard') {
			var farIndex = Memory.FarCreeps[creep.memory.homeRoom].indexOf(creep.memory.priority);
			if (creep.ticksToLive <= 70 && farIndex > -1) {
				//Remove yourself from the list of farCreeps
				Memory.FarCreeps[creep.memory.homeRoom].splice(farIndex, 1);
			} else if (farIndex == -1) {
				Memory.FarCreeps[creep.memory.homeRoom].push('farGuard');
			}

			if (creep.room.name != creep.memory.destination) {
				creep.moveTo(new RoomPosition(25, 25, creep.memory.destination));
			} else {

				if (creep.room.controller.reservation && (creep.room.name == creep.memory.destination)) {
					if (creep.room.controller.reservation.ticksToEnd <= 1000) {
						Memory.FarClaimerNeeded[creep.memory.homeRoom] = true;
					} else {
						Memory.FarClaimerNeeded[creep.memory.homeRoom] = false;
					}
				} else if (creep.room.name == creep.memory.destination) {
					Memory.FarClaimerNeeded[creep.memory.homeRoom] = true;
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
					creep.moveTo(Game.flags[creep.memory.homeRoom + "FarGuard"].pos);
				}
			}
		}
	}
};

module.exports = creep_farMining;