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
					} else {
						if (creep.room.controller.sign && creep.room.controller.sign.username != "Montblanc") {
							creep.signController(creep.room.controller, "Remote mining this! Not a fan of me being here? Let me know instead of obliterating me!");
						} else if (!creep.room.controller.sign) {
							creep.signController(creep.room.controller, "Remote mining this! Not a fan of me being here? Let me know instead of obliterating me!");
						}
					}
				}

				evadeAttacker(creep);
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

				if (creep.hits < 400) {
					//Determine if attacker is player, if so, delete flag.
					var hostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 5, {
						filter: (creep) => (creep.getActiveBodyparts(WORK) > 0 || creep.getActiveBodyparts(CARRY) > 0 || creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0 || creep.getActiveBodyparts(HEAL) > 0) || (creep.hits <= 500)
					});
					if (hostiles.length > 0 && hostiles[0].owner.username != 'Invader' && Game.flags[creep.memory.targetFlag]) {
						Game.notify(creep.memory.tragetFlag + ' was removed due to an attack by ' + hostiles[0].owner.username);
						if (!Memory.warMode) {
							Memory.warMode = true;
							Game.notify('War mode has been enabled.');
						}
						Game.flags[creep.memory.targetFlag].remove();
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
				evadeAttacker(creep);
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

				if (creep.carry.energy > 0) {
					//All creeps check for road under them and repair if needed.
					var someSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
					if (someSite) {
						creep.build(someSite);
					} else {
						var someStructure = creep.pos.lookFor(LOOK_STRUCTURES);
						if (someStructure.length && (someStructure[0].hitsMax - someStructure[0].hits >= 100) && someStructure[0].structureType == STRUCTURE_ROAD) {
							creep.repair(someStructure[0]);
						}
					}
				}

				if (creep.room.name != creep.memory.destination && _.sum(creep.carry) <= creep.carryCapacity - 300) {
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
					evadeAttacker(creep);
				} else if (creep.room.name != creep.memory.homeRoom && _.sum(creep.carry) > creep.carryCapacity - 300) {
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

					if (_.sum(creep.carry) <= creep.carryCapacity - 300) {
						var droppedSources = creep.pos.findInRange(FIND_DROPPED_ENERGY, 7);
						if (droppedSources.length && !Memory.warMode) {
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
						evadeAttacker(creep);
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
						evadeAttacker(creep);
					}
				}
				break;
			case 'farGuard':
			case 'farGuardNearDeath':
				creep.notifyWhenAttacked(false);
				if (Memory.warMode) {
					if (creep.ticksToLive <= 150) {
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
				} else {
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
					if (Game.flags[creep.memory.targetFlag] && Game.flags[creep.memory.targetFlag + "TEMP"]) {
						if (Game.flags[creep.memory.targetFlag].pos.roomName == Game.flags[creep.memory.targetFlag + "TEMP"].pos.roomName && Game.flags[creep.memory.targetFlag].pos.x == Game.flags[creep.memory.targetFlag + "TEMP"].pos.x && Game.flags[creep.memory.targetFlag].pos.y == Game.flags[creep.memory.targetFlag + "TEMP"].pos.y) {
							Game.flags[creep.memory.targetFlag + "TEMP"].remove();
						} else {
							Game.flags[creep.memory.targetFlag].remove();
						}
					} else if (!Game.flags[creep.memory.targetFlag] && Game.flags[creep.memory.targetFlag + "TEMP"]) {
						try {
							Game.flags[creep.memory.targetFlag + "TEMP"].pos.createFlag(creep.memory.targetFlag);
						} catch (e) {

						}
					}
				}

				if (Game.flags[creep.memory.targetFlag]) {
					if (Game.flags[creep.memory.targetFlag].pos.roomName != creep.memory.destination) {
						creep.memory.destination = Game.flags[creep.memory.targetFlag].pos.roomName;
					}
				} else if (Game.flags[creep.memory.targetFlag + "TEMP"]) {
					if (Game.flags[creep.memory.targetFlag + "TEMP"].pos.roomName != creep.memory.destination) {
						creep.memory.destination = Game.flags[creep.memory.targetFlag + "TEMP"].pos.roomName;
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

				var Foe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3, {
					filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
				});
				var closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
					filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
				});
				if (Foe.length) {
					Foe.sort(targetAttacker);
				}

				if (creep.room.controller && creep.room.controller.owner && creep.room.controller.owner.username != "Montblanc" && creep.room.name != creep.memory.destination) {
					creep.moveTo(new RoomPosition(25, 25, creep.memory.destination), {
						reusePath: 25
					});
					if (creep.hits < creep.hitsMax) {
						creep.heal(creep);
					}
				} else if (creep.room.controller && closeFoe) {
					var closeRangeResult = creep.rangedAttack(closeFoe);
					creep.attack(closeFoe);
					if (Foe.length) {
						creep.attack(Foe[0]);
						creep.rangedAttack(Foe[0]);
					}
					if (creep.hits < creep.hitsMax) {
						creep.heal(creep);
					} else {
						var hurtAlly = creep.pos.findInRange(FIND_MY_CREEPS, 3, {
							filter: (thisCreep) => thisCreep.hits < thisCreep.hitsMax
						});
						if (hurtAlly.length > 0) {
							if (closeRangeResult != OK) {
								creep.rangedHeal(hurtAlly[0]);
							}
							creep.heal(hurtAlly[0]);
						}
					}

					if (creep.pos.getRangeTo(closeFoe) > 3 || (closeFoe.getActiveBodyparts(ATTACK) == 0) || (creep.getActiveBodyparts(RANGED_ATTACK) == 0) || (creep.room.controller && creep.room.controller.safeMode)) {
						if (Foe.length && Foe[0].getActiveBodyparts(ATTACK) > creep.getActiveBodyparts(ATTACK) && creep.pos.getRangeTo(Foe[0]) <= 3) {
							var foeDirection = creep.pos.getDirectionTo(Foe[0]);
							var y = 0;
							var x = 0;
							switch (foeDirection) {
								case TOP:
									y = -2;
									break;
								case TOP_RIGHT:
									y = -2;
									x = -2;
									break;
								case RIGHT:
									x = -2;
									break;
								case BOTTOM_RIGHT:
									y = 2;
									x = -2;
									break;
								case BOTTOM:
									y = 2;
									break;
								case BOTTOM_LEFT:
									y = 2;
									x = 2;
									break;
								case LEFT:
									x = 2;
									break;
								case TOP_LEFT:
									y = -2;
									x = 2
									break;
							}
							x = creep.pos.x + x;
							y = creep.pos.y + y;
							if (x < 1) {
								x = 1;
								if (y < 25 && y > 1) {
									y = y - 1;
								} else if (y < 48) {
									y = y + 1;
								}
							} else if (x > 48) {
								x = 48;
								if (y < 25 && y > 1) {
									y = y - 1;
								} else if (y < 48) {
									y = y + 1;
								}
							}
							if (y < 1) {
								y = 1;
								if (x < 25 && x > 1) {
									x = x - 1;
								} else if (x < 48) {
									x = x + 1;
								}
							} else if (y > 48) {
								y = 48;
								if (x < 25 && x > 1) {
									x = x - 1;
								} else if (x < 48) {
									x = x + 1;
								}
							}

							creep.moveTo(x, y, {
								maxRooms: 1
							});
						} else {
							creep.moveTo(closeFoe, {
								maxRooms: 1
							});
						}
					} else {
						var foeDirection = creep.pos.getDirectionTo(closeFoe);
						var y = 0;
						var x = 0;
						switch (foeDirection) {
							case TOP:
								y = -2;
								break;
							case TOP_RIGHT:
								y = -2;
								x = -2;
								break;
							case RIGHT:
								x = -2;
								break;
							case BOTTOM_RIGHT:
								y = 2;
								x = -2;
								break;
							case BOTTOM:
								y = 2;
								break;
							case BOTTOM_LEFT:
								y = 2;
								x = 2;
								break;
							case LEFT:
								x = 2;
								break;
							case TOP_LEFT:
								y = -2;
								x = 2
								break;
						}
						x = creep.pos.x + x;
						y = creep.pos.y + y;
						if (x < 1) {
							x = 1;
							if (y < 25 && y > 1) {
								y = y - 1;
							} else if (y < 48) {
								y = y + 1;
							}
						} else if (x > 48) {
							x = 48;
							if (y < 25 && y > 1) {
								y = y - 1;
							} else if (y < 48) {
								y = y + 1;
							}
						}
						if (y < 1) {
							y = 1;
							if (x < 25 && x > 1) {
								x = x - 1;
							} else if (x < 48) {
								x = x + 1;
							}
						} else if (y > 48) {
							y = 48;
							if (x < 25 && x > 1) {
								x = x - 1;
							} else if (x < 48) {
								x = x + 1;
							}
						}

						creep.moveTo(x, y, {
							maxRooms: 1
						});
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
							creep.rangedHeal(hurtAlly[0]);
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

function evadeAttacker(creep) {
	var Foe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 5, {
		filter: (eCreep) => ((eCreep.getActiveBodyparts(ATTACK) > 0 || eCreep.getActiveBodyparts(RANGED_ATTACK) > 0) && !Memory.whiteList.includes(eCreep.owner.username))
	});

	if (Foe.length) {
		var closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
			filter: (eCreep) => ((eCreep.getActiveBodyparts(ATTACK) > 0 || eCreep.getActiveBodyparts(RANGED_ATTACK) > 0) && !Memory.whiteList.includes(eCreep.owner.username))
		});
		var foeDirection = creep.pos.getDirectionTo(closeFoe);
		var y = 0;
		var x = 0;
		switch (foeDirection) {
			case TOP:
				y = -2;
				break;
			case TOP_RIGHT:
				y = -2;
				x = -2;
				break;
			case RIGHT:
				x = -2;
				break;
			case BOTTOM_RIGHT:
				y = 2;
				x = -2;
				break;
			case BOTTOM:
				y = 2;
				break;
			case BOTTOM_LEFT:
				y = 2;
				x = 2;
				break;
			case LEFT:
				x = 2;
				break;
			case TOP_LEFT:
				y = -2;
				x = 2
				break;
		}
		x = creep.pos.x + x;
		y = creep.pos.y + y;
		if (x < 0) {
			x = 0;
			if (y < 25 && y > 0) {
				y = y - 1;
			} else if (y < 49) {
				y = y + 1;
			}
		} else if (x > 49) {
			x = 49;
			if (y < 25 && y > 0) {
				y = y - 1;
			} else if (y < 49) {
				y = y + 1;
			}
		}
		if (y < 0) {
			y = 0;
			if (x < 25 && x > 0) {
				x = x - 1;
			} else if (x < 49) {
				x = x + 1;
			}
		} else if (y > 49) {
			y = 49;
			if (x < 25 && x > 0) {
				x = x - 1;
			} else if (x < 49) {
				x = x + 1;
			}
		}

		creep.moveTo(x, y);
	}
}

function targetAttacker(a, b) {
	if (a.getActiveBodyparts(ATTACK) > b.getActiveBodyparts(ATTACK))
		return -1;
	if (a.getActiveBodyparts(ATTACK) < b.getActiveBodyparts(ATTACK))
		return 1;
	return 0;
}

module.exports = creep_farMining;