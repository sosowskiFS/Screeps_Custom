var creep_combat = {

	/** @param {Creep} creep **/
	run: function(creep, thisRoom) {
		//Defensive-focused attack
		//Only run this code if the room is being invaded, remain offline otherwise.
		//(Saves running excess finds in peacetime)
		if (creep.memory.priority == 'melee' && Memory.roomsUnderAttack.indexOf(thisRoom.name) != -1) {
			var friendlyRanged = creep.room.find(FIND_MY_CREEPS, {
				filter: function(object) {
					return object.getActiveBodyparts(RANGED_ATTACK) == 0;
				}
			});

			if (!friendlyRanged) {
				//Do not have a ranged partner. Play defensively.
				var Foe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 5);
				if (Foe) {
					if (creep.attack(Foe) == ERR_NOT_IN_RANGE) {
						creep.moveTo(Foe);
						creep.attack(Foe);
					}
				}
			} else {
				//Have ranged partner. Go on the offense.
				var Foe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
				if (Foe) {
					if (creep.attack(Foe) == ERR_NOT_IN_RANGE) {
						creep.moveTo(Foe);
						creep.attack(Foe);
					}
				}
			}
		} else if (creep.memory.priority == 'ranged' && Memory.roomsUnderAttack.indexOf(thisRoom.name) != -1) {
			var friendlyMelee = creep.room.find(FIND_MY_CREEPS, {
				filter: function(object) {
					return object.getActiveBodyparts(ATTACK) == 0;
				}
			});

			if (!friendlyMelee) {
				//Do not have a melee partner. Play defensively.
				var FoeTooClose = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 2);
				if (FoeTooClose) {
					//Target getting into melee range, kite it.
					creep.moveTo(thisRoom.controller);
					creep.rangedMassAttack();
				} else {
					var Foe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 5);
					if (Foe) {
						if (creep.attack(Foe) == ERR_NOT_IN_RANGE) {
							creep.moveTo(Foe);
							creep.rangedMassAttack();
						}
					}
				}
			} else {
				//Have melee partner. Go on the offense.
				var FoeTooClose = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 2);
				if (FoeTooClose) {
					//Target getting into melee range, kite it.
					creep.moveTo(thisRoom.controller);
					creep.rangedMassAttack();
				} else {
					var Foe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
					if (Foe) {
						if (creep.attack(Foe) == ERR_NOT_IN_RANGE) {
							creep.moveTo(Foe);
							creep.rangedMassAttack();
						}
					}
				}
			}
		}

	}
};

module.exports = creep_combat;