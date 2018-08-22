var tower_Operate = {
	run: function(tower, attackDuration, towerNum) {
		var thisRoom = tower.room;

		if (!Memory.towerNeedEnergy[thisRoom.name]) {
			Memory.towerNeedEnergy[thisRoom.name] = [];
		}
		if (!Memory.towerPickedTarget[thisRoom.name] || Game.time % 5 == 0) {
			//Recalc target every 5 ticks
			Memory.towerPickedTarget[thisRoom.name] = '';
		}

		var checkDelay = 10;
		if (thisRoom.storage) {
			if (thisRoom.storage.store[RESOURCE_ENERGY] >= 425000) {
				checkDelay = 10;
			} else if (thisRoom.storage.store[RESOURCE_ENERGY] >= 225000) {
				checkDelay = 25;
			} else if (thisRoom.storage.store[RESOURCE_ENERGY] < 100000) {
				checkDelay = 500;
			} else if (thisRoom.storage.store[RESOURCE_ENERGY] < 225000) {
				checkDelay = 50;
			}
		} else {
			checkDelay = 50000;
		}

		var UnderAttackPos = Memory.roomsUnderAttack.indexOf(thisRoom.name);
		if (UnderAttackPos >= 0 && tower.energy > 0) {
			//Memory.roomCreeps[thisRoom.name];
			//Only if no salvager flag
			var didHeal = false
			let ignoreRangeFlag = false;
				//var salvagerPos = Memory.roomsPrepSalvager.indexOf(thisRoom.name);
			if (Memory.roomCreeps[thisRoom.name]) {
				var defenders = _.filter(Memory.roomCreeps[thisRoom.name], (creep) => creep.memory.priority == 'defender');
				if (defenders.length) {
					for (var y = 0; y < defenders.length; y++) {
						if (defenders[y].hits < defenders[y].hitsMax) {
							tower.heal(defenders[y]);
							didHeal = true;
							break;
						}
					}
					ignoreRangeFlag = true;
				}
			}

			if (!didHeal) {
				var shootRandom = false;
				var closestHostile = Game.getObjectById(Memory.towerPickedTarget[thisRoom.name]);
				if (!closestHostile) {
					closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
						filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
					});
					shootRandom = true;
				}
				if (closestHostile) {
					if (closestHostile.owner.username != "Invader") {
						Game.notify('ROOM DEFENCE : ' + closestHostile.owner.username + ' is tresspassing in ' + thisRoom.name);
					}
					Memory.towerPickedTarget[thisRoom.name] = closestHostile.id;
					if (shootRandom) {
						var randomTarget = tower.room.find(FIND_HOSTILE_CREEPS);
						if (randomTarget.length) {
							if (randomTarget.length == 1 && !determineThreat(randomTarget[0]) && randomTarget[0].hitsMax >= 500 && !thisRoom.controller.safeMode) {
								//Only a healer, don't waste energy
								Memory.towerPickedTarget[thisRoom.name] = '';
							} else {
								if (tower.room.controller.level >= 7 || thisRoom.controller.safeMode) {
									tower.attack(randomTarget[Math.floor(Math.random() * randomTarget.length)]);
								} else {
									let range = tower.pos.getRangeTo(closestHostile);
									if (range <= 10 || ignoreRangeFlag) {
										tower.attack(closestHostile);
									}
								}
							}
						}
					} else {
						if (tower.room.controller.level < 7 || !thisRoom.controller.safeMode) {
							let range = tower.pos.getRangeTo(closestHostile);
							if (range <= 10 || ignoreRangeFlag) {
								tower.attack(closestHostile);
							}
							if (range <= 5 && closestHostile.owner.username != 'Invader' ) {
								//Too close for comfort
								tower.room.controller.activateSafeMode();
							}
						} else {
							tower.attack(closestHostile);
						}
					}
					//Keep target for defenders to lock on
				} else if (tower.energy > (tower.energyCapacity * 0.5)) {
					//Save 50% of the tower's energy to use on repelling attackers
					var closestDamagedCreep = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
						filter: (creep) => creep.hits < creep.hitsMax - 50
					});
					if (closestDamagedCreep) {
						tower.heal(closestDamagedCreep);
					}
				}
			}
		} else if ((tower.energy > (tower.energyCapacity * 0.5)) && (Game.time % checkDelay == 0)) {
			var criticalRoads = tower.room.find(FIND_STRUCTURES, {
				filter: (structure) => (structure.structureType == STRUCTURE_ROAD && structure.hits < (structure.hitsMax / 2))
			});
			if (criticalRoads.length) {
				criticalRoads.sort(repairCompare);
				tower.repair(criticalRoads[0]);
			} else {
				var decayingRampart = tower.pos.findInRange(FIND_MY_STRUCTURES, 5, {
					filter: (structure) => ((structure.structureType == STRUCTURE_RAMPART || structure.structureType == STRUCTURE_WALL) && structure.hits < structure.hitsMax)
				});
				if (decayingRampart.length) {
					decayingRampart.sort(repairCompare);
					tower.repair(decayingRampart[0]);
				}
			}
		}

		if (tower.energy <= tower.energyCapacity - 150 && Memory.towerNeedEnergy[thisRoom.name].indexOf(tower.id) == -1) {
			Memory.towerNeedEnergy[thisRoom.name].push(tower.id);
		} else if (tower.energy > tower.energyCapacity - 150 && Memory.towerNeedEnergy[thisRoom.name].indexOf(tower.id) > -1) {
			var thisTowerIndex = Memory.towerNeedEnergy[thisRoom.name].indexOf(tower.id)
			Memory.towerNeedEnergy[thisRoom.name].splice(thisTowerIndex, 1);
		}
		//Enable to see tower coverage
		//thisRoom.visual.rect(thisTower.pos.x - 15, thisTower.pos.y - 15, 30, 30, {fill: '#ff0019', opacity: 0.2});
		//wew
	}
};

function repairCompare(a, b) {
	if (a.hits < b.hits)
		return -1;
	if (a.hits > b.hits)
		return 1;
	return 0;
}

function determineThreat(thisCreep) {
	let returnValue = false;
	thisCreep.body.forEach(function(thisPart) {
		if (thisPart.type == ATTACK) {
			returnValue = true;
		} else if (thisPart.type == RANGED_ATTACK) {
			returnValue = true;
		} else if (thisPart.type == WORK) {
			returnValue = true;
		}
	});
	return returnValue
}

module.exports = tower_Operate;