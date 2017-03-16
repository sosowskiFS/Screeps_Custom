var creep_farMining = {

	/** @param {Creep} creep **/
	run: function(creep) {
		switch (creep.memory.priority) {
			case 'farClaimer':
			case 'farClaimerNearDeath':
				if (creep.ticksToLive <= 20) {
					creep.memory.priority = 'farClaimerNearDeath';
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
				break;
			case 'farMiner':
			case 'farMinerNearDeath':
				if (creep.ticksToLive <= 60) {
					creep.memory.priority = 'farMinerNearDeath';
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

				if (creep.hits < 750) {
					//Determine if attacker is player, if so, delete flag.
					var hostiles = creep.room.find(FIND_HOSTILE_CREEPS, {
						filter: (creep) => (creep.getActiveBodyparts(WORK) > 0 || creep.getActiveBodyparts(CARRY) > 0 || creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0 || creep.getActiveBodyparts(HEAL) > 0) || (creep.hits <= 500)
					});
					if (hostiles.length > 0 && hostiles[0].owner.username != 'Invader' && Game.flags[creep.memory.targetFlag]) {
						Game.flags[creep.memory.targetFlag].remove();
						Game.notify(creep.memory.tragetFlag + ' was removed due to an attack by ' + hostiles[0].owner.username);
						if (!Memory.warMode) {
							Memory.warMode = true;
							Game.notify('War mode has been enabled.');
						}
					}
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
							if (creep.pos.inRangeTo(mineTarget, 2)) {
								var containers = creep.pos.findInRange(FIND_STRUCTURES, 2, {
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
									var sites = creep.pos.findInRange(FIND_CONSTRUCTION_SITES, 2)
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
				break;
			case 'farMule':
			case 'farMuleNearDeath':
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
				break;
			case 'farGuard':
			case 'farGuardNearDeath':
				creep.notifyWhenAttacked(false);
				if (creep.ticksToLive <= 70) {
					creep.memory.priority = 'farGuardNearDeath';
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

				//Recall guard into home room if it's under attack
				if (Memory.roomsUnderAttack.indexOf(creep.memory.homeRoom) > -1 && Memory.attackDuration >= 100 && Game.flags[creep.memory.targetFlag] && !Game.flags[creep.memory.targetFlag + "TEMP"]) {
					Game.flags[creep.memory.targetFlag].pos.createFlag(creep.memory.targetFlag + "TEMP");
					Game.flags[creep.memory.targetFlag].remove();
					var homePosition = new RoomPosition(25, 25, creep.memory.homeRoom);
					homePosition.createFlag(creep.memory.targetFlag);
				} else if (Memory.roomsUnderAttack.indexOf(creep.memory.homeRoom) > -1 && Memory.attackDuration >= 100 && !Game.flags[creep.memory.targetFlag] && Game.flags[creep.memory.targetFlag + "TEMP"]) {
					var homePosition = new RoomPosition(25, 25, creep.memory.homeRoom);
					homePosition.createFlag(creep.memory.targetFlag);
				} else if (Game.flags[creep.memory.targetFlag + "TEMP"] && Memory.roomsUnderAttack.indexOf(creep.memory.homeRoom) == -1) {
					if (Game.flags[creep.memory.targetFlag]) {
						Game.flags[creep.memory.targetFlag].remove();
					}
					Game.flags[creep.memory.targetFlag + "TEMP"].pos.createFlag(creep.memory.targetFlag);
					if (Game.flags[creep.memory.targetFlag] && Game.flags[creep.memory.targetFlag].pos == Game.flags[creep.memory.targetFlag + "TEMP"].pos) {
						Game.flags[creep.memory.targetFlag + "TEMP"].remove();
					}
				}

				if (Game.flags[creep.memory.targetFlag]) {
					if (Game.flags[creep.memory.targetFlag].pos.roomName != creep.memory.destination) {
						creep.memory.destination = Game.flags[creep.memory.targetFlag].pos.roomName;
					}
				}

				if (creep.room.controller && creep.room.controller.reservation && (creep.room.name == creep.memory.destination)) {
					if (creep.room.controller.reservation.ticksToEnd <= 1000) {
						Memory.FarClaimerNeeded[creep.room.name] = true;
					} else {
						Memory.FarClaimerNeeded[creep.room.name] = false;
					}
				} else if (creep.room.name == creep.memory.destination) {
					Memory.FarClaimerNeeded[creep.room.name] = true;
				}

				var Foe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);

				if (creep.room.controller && creep.room.controller.owner && creep.room.controller.owner.username != "Montblanc" && creep.room.name != creep.memory.destination) {
					creep.moveTo(new RoomPosition(25, 25, creep.memory.destination), {
						reusePath: 25
					});
					if (creep.hits < creep.hitsMax) {
						creep.heal(creep);
					}
				} else if (creep.room.controller && Foe) {
					if (creep.hits < creep.hitsMax) {
						creep.heal(creep);
					} else {
						var hurtAlly = creep.pos.findInRange(FIND_MY_CREEPS, 1, {
							filter: (thisCreep) => thisCreep.hits < thisCreep.hitsMax
						});
						if (hurtAlly.length > 0) {
							creep.heal(hurtAlly[0]);
						}
					}

					if (creep.pos.getRangeTo(Foe) > 3 || (Foe.getActiveBodyparts(ATTACK) == 0) || (creep.getActiveBodyparts(RANGED_ATTACK) == 0) || (creep.room.controller && creep.room.controller.safeMode)) {
						creep.moveTo(Foe, {
							maxRooms: 1
						});
						creep.attack(Foe);
						creep.rangedAttack(Foe);
					} else {
						var foeDirection = creep.pos.getDirectionTo(Foe);
						var y = 0;
						var x = 0;
						switch (foeDirection) {
							case TOP:
								y = -3;
								break;
							case TOP_RIGHT:
								y = -3;
								x = -3;
								break;
							case RIGHT:
								x = -3;
								break;
							case BOTTOM_RIGHT:
								y = 3;
								x = -3;
								break;
							case BOTTOM:
								y = 3;
								break;
							case BOTTOM_LEFT:
								y = 3;
								x = 3;
								break;
							case LEFT:
								x = 3;
								break;
							case TOP_LEFT:
								y = -3;
								x = 3
								break;
						}
						x = creep.pos.x + x;
						if (x < 0) {
							x = 0;
						} else if (x > 49) {
							x = 49;
						}
						y = creep.pos.y + y;
						if (y < 0) {
							y = 0;
						} else if (y > 49) {
							y = 49;
						}

						creep.moveTo(x, y, {
							maxRooms: 1
						});
						creep.attack(Foe);
						creep.rangedAttack(Foe);
					}
				} else if (creep.room.controller && creep.room.controller.owner && creep.room.controller.owner.username != "Montblanc") {
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
					if (creep.hits < creep.hitsMax) {
						creep.heal(creep);
					}
				} else if (creep.room.name != creep.memory.destination) {
					creep.moveTo(new RoomPosition(25, 25, creep.memory.destination), {
						reusePath: 25
					});
					if (creep.hits < creep.hitsMax) {
						creep.heal(creep);
					}
				} else if (Game.flags[creep.memory.targetFlag]) {
					if (creep.hits < creep.hitsMax) {
						creep.heal(creep);
						if (creep.pos != Game.flags[creep.memory.targetFlag].pos) {
							creep.moveTo(Game.flags[creep.memory.targetFlag], {
								maxRooms: 1
							});
						}
					} else {
						var hurtAlly = creep.room.find(FIND_MY_CREEPS, {
							filter: (thisCreep) => thisCreep.hits < thisCreep.hitsMax
						});
						if (hurtAlly.length > 0) {
							creep.moveTo(hurtAlly[0]);
							creep.heal(hurtAlly[0]);
						} else if (creep.pos != Game.flags[creep.memory.targetFlag].pos) {
							creep.moveTo(Game.flags[creep.memory.targetFlag], {
								maxRooms: 1
							});
						}
					}
				} else if (creep.hits < creep.hitsMax) {
					creep.heal(creep);
				}
				break;
		}
	}
};
module.exports = creep_farMining;