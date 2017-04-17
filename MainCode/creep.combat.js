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
			var lookResult = creep.pos.lookFor(LOOK_STRUCTURES);
			var Foe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 50, {
				filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
			});
			var closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
				filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
			});

			if (Foe.length) {
				Foe.sort(targetOther);
			}
			if (closeFoe) {
				creep.rangedAttack(closeFoe);
				var attackResult = creep.attack(closeFoe);
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
			}
		} else {
			var lookResult = creep.pos.lookFor(LOOK_STRUCTURES);
			var homeSpawn = Game.getObjectById(creep.memory.fromSpawn)
			if (lookResult.length && lookResult[0].structureType == STRUCTURE_RAMPART) {

			} else if (homeSpawn) {
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