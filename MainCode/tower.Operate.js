var tower_Operate = {
	run: function(tower, thisRoom, attackDuration) {
		var thisTower = Game.getObjectById(tower);
		var towerRange = 70;

		var UnderAttackPos = Memory.roomsUnderAttack.indexOf(thisRoom.name);
		var salvagerPrepPos = Memory.roomsPrepSalvager.indexOf(thisRoom.name);
		if (salvagerPrepPos >= 0) {
			towerRange = 70;
		}
		if (UnderAttackPos >= 0 && thisTower.energy > 0) {
			var maxRange = 20;
			if (attackDuration >= 100) {
				maxRange = 10;
			} else if (attackDuration >= 50) {
				maxRange = 15;
			}
			if (Memory.hasFired.indexOf(tower) > -1) {
				maxRange = maxRange + 5;
				
				var towerPos = Memory.hasFired.indexOf(tower);
				if (towerPos >= 0) {
					Memory.hasFired.splice(towerPos, 1);
				}
			}
			var closestHostile = thisTower.pos.findInRange(FIND_HOSTILE_CREEPS, maxRange);
			if (closestHostile.length) {
				//Target healing creeps first
				closestHostile.sort(targetOther);
				//closestHostile.sort(targetHealer);
				if (closestHostile[0].getActiveBodyparts(HEAL) >= 2 && thisTower.pos.getRangeTo(closestHostile[0]) > 15 && closestHostile[0].hits == closestHostile[0].hitsMax) {
					//Probably a healer
					if (closestHostile[1] && (closestHostile[1].getActiveBodyparts(HEAL) < 2 || thisTower.pos.getRangeTo(closestHostile[1]) < 15)) {
						thisTower.attack(closestHostile[1]);
						Memory.hasFired.push(tower);
					} else if (thisTower.energy > (thisTower.energyCapacity * 0.5)) {
						var closestDamagedCreep = thisTower.pos.findClosestByRange(FIND_MY_CREEPS, {
							filter: (creep) => creep.hits < creep.hitsMax - 50
						});
						if (closestDamagedCreep) {
							thisTower.heal(closestDamagedCreep);
						}
					}
				} else {
					thisTower.attack(closestHostile[0]);
					Memory.hasFired.push(tower);
				}
			} else if (thisTower.energy > (thisTower.energyCapacity * 0.5)) {
				//Save 50% of the tower's energy to use on repelling attackers
				var closestDamagedCreep = thisTower.pos.findClosestByRange(FIND_MY_CREEPS, {
					filter: (creep) => creep.hits < creep.hitsMax - 50
				});
				if (closestDamagedCreep) {
					thisTower.heal(closestDamagedCreep);
				}
			}
		} else if ((thisTower.energy > (thisTower.energyCapacity * 0.5)) && (Game.time % 10 == 0)) {
			//Save 50% of the tower's energy to use on repelling attackers
			var closestDamagedCreep = thisTower.pos.findClosestByRange(FIND_MY_CREEPS, {
				filter: (creep) => creep.hits < creep.hitsMax - 150
			});
			if (closestDamagedCreep) {
				thisTower.heal(closestDamagedCreep);
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
	if (a.hits < b.hits)
		return -1;
	if (a.hits > b.hits)
		return 1;
	return 0;
}