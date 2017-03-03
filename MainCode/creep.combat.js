var creep_combat = {

	/** @param {Creep} creep **/
	run: function(creep) {
		//Defensive-focused attack
		//Only run this code if the room is being invaded, remain offline otherwise.
		//(Saves running excess finds in peacetime)
		if (creep.hits < creep.hitsMax) {
			creep.heal(creep);
		}

		if (Memory.roomsUnderAttack.indexOf(creep.room.name) != -1) {
			//Move towards Foe, stop at rampart

			var Foe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
			if (Foe) {
				creep.rangedAttack(Foe);
				var attackResult = creep.attack(Foe);
				var lookResult = creep.pos.lookFor(LOOK_STRUCTURES);
				if (attackResult == OK && lookResult.length) {
					if (lookResult[0].structureType != STRUCTURE_RAMPART) {
						creep.moveTo(Foe);
					}
				} else if (attackResult == ERR_NOT_IN_RANGE) {
					creep.moveTo(Foe);
				}
			}
		}
	}
};

module.exports = creep_combat;