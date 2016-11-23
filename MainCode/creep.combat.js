var creep_combat = {

	/** @param {Creep} creep **/
	run: function(creep, thisRoom, thisSpawn) {
		//Defensive-focused attack
		//Only run this code if the room is being invaded, remain offline otherwise.
		//(Saves running excess finds in peacetime)
		if (creep.memory.priority == 'melee' && Memory.roomsUnderAttack.indexOf(thisRoom.name) != -1) {
			var friendlyRanged = creep.pos.findInRange(FIND_MY_CREEPS, 10, {
				filter: function(object) {
					return object.getActiveBodyparts(RANGED_ATTACK) > 0;
				}
			});

			if (friendlyRanged.length == 0) {
				//Do not have a ranged partner. Play defensively.
				var Foe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 5);
				if (Foe[0]) {
					if (creep.attack(Foe) == ERR_NOT_IN_RANGE) {
						creep.moveTo(Foe);
						creep.attack(Foe);
					}
				} else {
					creep.moveTo(thisSpawn);
				}
			} else {
				//Have ranged partner. Go on the offense.
				var Foe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
				if (Foe) {
					if (creep.attack(Foe) == ERR_NOT_IN_RANGE) {
						creep.moveTo(Foe);
						creep.attack(Foe);
					}
				} else {
					//There is no threat, stand down.
					var UnderAttackPos = Memory.roomsUnderAttack.indexOf(thisRoom.name);
					if (UnderAttackPos >= 0) {
						Memory.roomsUnderAttack.splice(UnderAttackPos, 1);
					}
				}
			}
		} else if (creep.memory.priority == 'ranged' && Memory.roomsUnderAttack.indexOf(thisRoom.name) != -1) {
			var friendlyMelee = creep.pos.findInRange(FIND_MY_CREEPS, 10, {
				filter: function(object) {
					return object.getActiveBodyparts(ATTACK) > 0;
				}
			});

			if (friendlyMelee.length == 0) {
				//Do not have a melee partner. Play defensively.
				var FoeTooClose = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 2);
				if (FoeTooClose[0]) {
					//Target getting into melee range, kite it.
					creep.moveTo(thisRoom.controller);
					creep.rangedMassAttack();
				} else {
					var Foe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 5);
					if (Foe[0]) {
						if (creep.rangedAttack(Foe) == ERR_NOT_IN_RANGE) {
							creep.moveTo(Foe);
						}
					} else {
						creep.moveTo(thisSpawn);
					}
				}
			} else {
				//Have melee partner. Go on the offense.
				var FoeTooClose = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 2);
				if (FoeTooClose[0]) {
					//Target getting into melee range, kite it.
					creep.moveTo(thisRoom.controller);
					creep.rangedAttack(FoeTooClose[0]);
				} else {
					var Foe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
					if (Foe) {
						if (creep.rangedAttack(Foe) == ERR_NOT_IN_RANGE) {
							creep.moveTo(Foe);
						}
					} else {
						//There is no threat, stand down.
						var UnderAttackPos = Memory.roomsUnderAttack.indexOf(thisRoom.name);
						if (UnderAttackPos >= 0) {
							Memory.roomsUnderAttack.splice(UnderAttackPos, 1);
						}
					}
				}
			}
		}

	}
};

module.exports = creep_combat;