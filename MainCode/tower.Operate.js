var tower_Operate = {
	run: function(tower, attackDuration) {
		var thisRoom = tower.room;

		var UnderAttackPos = Memory.roomsUnderAttack.indexOf(thisRoom.name);
		if (UnderAttackPos >= 0 && tower.energy > 0) {
			var closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
				filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
			});
			if (closestHostile) {
				tower.attack(closestHostile);
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