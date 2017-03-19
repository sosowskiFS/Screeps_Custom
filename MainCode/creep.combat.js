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
			var closestTower = creep.pos.findInRange(FIND_STRUCTURES, 8, {
				filter: (structure) => {
					return (structure.structureType == STRUCTURE_TOWER);
				}
			});
			if (Foe && closestTower.length) {
				creep.rangedAttack(Foe);
				var attackResult = creep.attack(Foe);
				var lookResult = creep.pos.lookFor(LOOK_STRUCTURES);
				if (lookResult.length) {
					if (lookResult[0].structureType != STRUCTURE_RAMPART) {
						creep.moveTo(Foe);
					}
				} else if (attackResult == ERR_NOT_IN_RANGE) {
					creep.moveTo(Foe);
				}
			} else if (Foe) {
				creep.rangedAttack(Foe);
				creep.attack(Foe);
				var homeSpawn = Game.getObjectById(creep.memory.fromSpawn);
				var lookResult = creep.pos.lookFor(LOOK_STRUCTURES);
				if (homeSpawn) {
					if (lookResult.length && lookResult[0].structureType != STRUCTURE_RAMPART) {
						creep.moveTo(homeSpawn);
					}
				}
			} else {
				var homeSpawn = Game.getObjectById(creep.memory.fromSpawn)
				if (homeSpawn) {
					creep.moveTo(homeSpawn);
				}
			}
		}
	}
};

module.exports = creep_combat;