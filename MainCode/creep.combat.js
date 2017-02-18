var creep_combat = {

	/** @param {Creep} creep **/
	run: function(creep) {
		//Defensive-focused attack
		//Only run this code if the room is being invaded, remain offline otherwise.
		//(Saves running excess finds in peacetime)
		if (Memory.roomsUnderAttack.indexOf(creep.room.name) != -1) {
			//Move towards rampart
			var flagName = creep.room.name + 'Rampart';
			var flagCounter = 1;
			var GotIt = false;
			while (Game.flags[flagName + flagCounter.toString()]) {
				if (Game.flags[flagName + flagCounter.toString()].pos.x == creep.pos.x && Game.flags[flagName + flagCounter.toString()].pos.y == creep.pos.y) {
					GotIt = true;
					break;
				} else if (Game.flags[flagName + flagCounter.toString()].pos.lookFor(LOOK_CREEPS).length == 0) {
					creep.moveTo(Game.flags[flagName + flagCounter.toString()]);
					GotIt = true;
					break;
				} else {
					flagCounter++;
				}
			}

			var Foe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
			if (Foe) {
				creep.say('REEEEEEEEE', true);
				creep.rangedAttack(Foe);
				creep.attack(Foe);
				if(!GotIt){
					creep.moveTo(Foe);
				}
			}
		} else {
			//Not under attack, move to red flags marking ramparts
			var flagName = creep.room.name + 'Rampart';
			var flagCounter = 1;
			while (Game.flags[flagName + flagCounter.toString()]) {
				if (Game.flags[flagName + flagCounter.toString()].pos.x == creep.pos.x && Game.flags[flagName + flagCounter.toString()].pos.y == creep.pos.y) {
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