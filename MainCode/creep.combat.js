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
					creep.say('REEEEEEEEE', true);
					if (creep.pos.getRangeTo(Foe) > 1) {
						creep.moveTo(Foe);
						creep.attack(Foe);
					} else {
						creep.attack(Foe);
					}
				} else {
					//Move towards rampart
					var flagName = creep.room.name + 'Rampart';
					var flagCounter = 1;
					while (Game.flags[flagName + flagCounter.toString()]) {
						if (Game.flags[flagName + flagCounter.toString()].pos == creep.pos) {
							break;
						} else if (Game.flags[flagName + flagCounter.toString()].pos.lookFor(LOOK_CREEPS).length == 0) {
							creep.moveTo(Game.flags[flagName + flagCounter.toString()]);
							break;
						} else {
							flagCounter++;
						}
					}
				}
			} else {
				//Have ranged partner. Go on the offense.
				var Foe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
				if (Foe) {
					creep.say('REEEEEEEEE', true);
					if (creep.pos.getRangeTo(Foe) > 1) {
						creep.moveTo(Foe);
						creep.attack(Foe);
					} else {
						creep.attack(Foe);
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
						creep.say('REEEEEEEEE', true);
						if (creep.pos.getRangeTo(Foe) > 3) {
							creep.moveTo(Foe);
							creep.rangedAttack(Foe);
						} else {
							creep.rangedAttack(Foe);
						}
					} else {
						//Move towards rampart
						var flagName = creep.room.name + 'Rampart';
						var flagCounter = 1;
						while (Game.flags[flagName + flagCounter.toString()]) {
							if (Game.flags[flagName + flagCounter.toString()].pos == creep.pos) {
								break;
							} else if (Game.flags[flagName + flagCounter.toString()].pos.lookFor(LOOK_CREEPS).length == 0) {
								creep.moveTo(Game.flags[flagName + flagCounter.toString()]);
								break;
							} else {
								flagCounter++;
							}
						}
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
						creep.say('REEEEEEEEE', true);
						if (creep.pos.getRangeTo(Foe) > 3) {
							creep.moveTo(Foe);
							creep.rangedAttack(Foe);
						} else {
							creep.rangedAttack(Foe);
						}
					}
				}
			}
		} else {
			//Not under attack, move to red flags marking ramparts
			var flagName = creep.room.name + 'Rampart';
			var flagCounter = 1;
			while (Game.flags[flagName + flagCounter.toString()]) {
				if (Game.flags[flagName + flagCounter.toString()].pos == creep.pos) {
					break;
				} else if (Game.flags[flagName + flagCounter.toString()].pos.lookFor(LOOK_CREEPS).length == 0) {
					creep.moveTo(Game.flags[flagName + flagCounter.toString()]);
					break;
				} else {
					flagCounter++;
				}
			}
		}
	}
};

module.exports = creep_combat;