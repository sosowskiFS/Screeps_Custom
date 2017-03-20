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

			var Foe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 50);
			var closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);

			var closestTower = creep.pos.findInRange(FIND_STRUCTURES, 8, {
				filter: (structure) => {
					return (structure.structureType == STRUCTURE_TOWER);
				}
			});
			if (Foe.length) {
				Foe.sort(targetOther);
			}
			if (closeFoe && closestTower.length) {
				creep.rangedAttack(closeFoe);
				var attackResult = creep.attack(closeFoe);
				var lookResult = creep.pos.lookFor(LOOK_STRUCTURES);
				if (lookResult.length) {
					if (Foe[0].getActiveBodyparts(ATTACK) == 0 && Foe[0].getActiveBodyparts(RANGED_ATTACK) == 0) {
						creep.moveTo(Foe[0], {
							maxRooms: 1
						});
					} else if (lookResult[0].structureType != STRUCTURE_RAMPART) {
						creep.moveTo(closeFoe, {
							maxRooms: 1
						});
					}
				} else if (attackResult == ERR_NOT_IN_RANGE) {
					creep.moveTo(closeFoe, {
						maxRooms: 1
					});
				}
			} else if (Foe.length) {
				creep.rangedAttack(closeFoe);
				creep.attack(closeFoe);
				creep.rangedAttack(Foe[0]);
				creep.attack(Foe[0]);
				var homeSpawn = Game.getObjectById(creep.memory.fromSpawn);
				var lookResult = creep.pos.lookFor(LOOK_STRUCTURES);
				if (homeSpawn) {
					if (Foe[0].getActiveBodyparts(ATTACK) == 0 && Foe[0].getActiveBodyparts(RANGED_ATTACK) == 0) {
						creep.moveTo(Foe[0], {
							maxRooms: 1
						});
					} else {
						creep.moveTo(homeSpawn, {
							maxRooms: 1
						});
					}
				}
			} else {
				var homeSpawn = Game.getObjectById(creep.memory.fromSpawn)
				if (homeSpawn) {
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
};

function targetOther(a, b) {
	if (a.getActiveBodyparts(HEAL) > b.getActiveBodyparts(HEAL))
		return 1;
	if (a.getActiveBodyparts(HEAL) < b.getActiveBodyparts(HEAL))
		return -1;
	return 0;
}

module.exports = creep_combat;