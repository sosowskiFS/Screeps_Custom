var tower_Operate = {
	run: function(tower, attackDuration) {
		var thisRoom = tower.room;
		var towerRange = 70;
		var healerRange = 10;

		var UnderAttackPos = Memory.roomsUnderAttack.indexOf(thisRoom.name);
		var salvagerPrepPos = Memory.roomsPrepSalvager.indexOf(thisRoom.name);
		if (salvagerPrepPos >= 0) {
			towerRange = 70;
		}
		if (UnderAttackPos >= 0 && tower.energy > 0) {
			var maxRange = 50;
			if (attackDuration >= 100) {
				maxRange = 10;
			} else if (attackDuration >= 50) {
				maxRange = 15;
			} else if (attackDuration >= 35) {
				maxRange = 20;
			} else if (attackDuration >= 20) {
				maxRange = 30;
			} else if (attackDuration >= 10) {
				maxRange = 40;
			}
			if (Memory.hasFired.indexOf(thisRoom.name) > -1) {
				if (maxRange <= 15) {
					maxRange = maxRange + 10;
				} else {
					maxRange = maxRange + 5;
				}

				var towerPos = Memory.hasFired.indexOf(thisRoom.name);
				if (towerPos >= 0) {
					Memory.hasFired.splice(towerPos, 1);
				}
			}
			if (thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] >= 50000) {
				maxRange = maxRange + 10;
				healerRange = 15;
			}
			var closestHostile = tower.pos.findInRange(FIND_HOSTILE_CREEPS, maxRange, {
				filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
			});
			if (closestHostile.length) {
				//Target healing creeps first
				//closestHostile.sort(targetOther);
				//closestHostile.sort(targetHealer);
				closestHostile = _.sortBy(closestHostile, h => tower.pos.getRangeTo(h));
				for (var i in closestHostile) {
					if (closestHostile[i].getActiveBodyparts(HEAL) >= 4 && closestHostile[i].getActiveBodyparts(ATTACK) == 0 && tower.pos.getRangeTo(closestHostile[i]) > healerRange && closestHostile[i].hits == closestHostile[i].hitsMax) {
						//Probably a healer, continue loop
					} else {
						tower.attack(closestHostile[i]);
						Memory.hasFired.push(thisRoom.name);
						break;
					}
				}

				if (Memory.hasFired.indexOf(thisRoom.name) == -1 && tower.energy > (tower.energyCapacity * 0.5)) {
					var closestDamagedCreep = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
						filter: (creep) => creep.hits < creep.hitsMax - 50
					});
					if (closestDamagedCreep) {
						tower.heal(closestDamagedCreep);
					}
				}
			} else if (tower.energy > (tower.energyCapacity * 0.5)) {
				//Save 50% of the tower's energy to use on repelling attackers
				var closestDamagedCreep = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
					filter: (creep) => creep.hits < creep.hitsMax - 50
				});
				if (closestDamagedCreep) {
					tower.heal(closestDamagedCreep);
				}
			}
		} else if ((tower.energy > (tower.energyCapacity * 0.5)) && (Game.time % 10 == 0)) {
			//Save 50% of the tower's energy to use on repelling attackers
			var closestDamagedCreep = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
				filter: (creep) => creep.hits < creep.hitsMax - 150
			});
			if (closestDamagedCreep) {
				tower.heal(closestDamagedCreep);
			}
		}
		//Enable to see tower coverage
		//thisRoom.visual.rect(thisTower.pos.x - 15, thisTower.pos.y - 15, 30, 30, {fill: '#ff0019', opacity: 0.2});
		//wew
	}
};

module.exports = tower_Operate;

function targetHealer(a, b) {
	if (a.getActiveBodyparts(HEAL) < b.getActiveBodyparts(HEAL))
		return 1;
	if (a.getActiveBodyparts(HEAL) > b.getActiveBodyparts(HEAL))
		return -1;
	return 0;
}

function targetOther(a, b) {
	if ((a.getActiveBodyparts(HEAL) > b.getActiveBodyparts(HEAL)) && (a.hits > b.hits))
		return 1;
	if ((a.getActiveBodyparts(HEAL) > b.getActiveBodyparts(HEAL)) && (a.hits < b.hits))
		return 1;
	if ((a.getActiveBodyparts(HEAL) == b.getActiveBodyparts(HEAL)) && (a.hits > b.hits))
		return 1;
	if ((a.getActiveBodyparts(HEAL) == b.getActiveBodyparts(HEAL)) && (a.hits < b.hits))
		return -1;
	if ((a.getActiveBodyparts(HEAL) < b.getActiveBodyparts(HEAL)) && (a.hits > b.hits))
		return -1;
	if ((a.getActiveBodyparts(HEAL) < b.getActiveBodyparts(HEAL)) && (a.hits < b.hits))
		return -1;
	return 0;
}