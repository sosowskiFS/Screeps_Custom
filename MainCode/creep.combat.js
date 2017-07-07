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
				var boostFlag = false;
				if ((Foe[0].getActiveBodyparts(ATTACK) > 0 || Foe[0].getActiveBodyparts(RANGED_ATTACK) > 0 || Foe[0].getActiveBodyparts(WORK) > 0) && Foe[0].owner.username != 'Invader') {
					Foe[0].body.forEach(function(thisPart) {
						if (thisPart.boost) {
							boostFlag = true;
						}
					});
				}
				if (boostFlag && creep.room.controller.level >= 7 && Memory.labList[thisRoom.name].length >= 6) {
					var attackLab = Game.getObjectById(Memory.labList[thisRoom.name][3]);
					var mineralCost = creep.getActiveBodyparts(ATTACK) * LAB_BOOST_MINERAL;
					var energyCost = creep.getActiveBodyparts(ATTACK) * LAB_BOOST_ENERGY;
					if (attackLab && attackLab.mineralAmount >= mineralCost && attackLab.energy >= energyCost) {
						creep.memory.needBoosts = true;
					} else {
						creep.memory.needBoosts = false;
					}
				} else {
					creep.memory.needBoosts = false;
				}
			}

			var unboostedAttack = 0;
			if (creep.memory.needBoosts && creep.room.controller.level >= 7) {
				creep.body.forEach(function(thisPart) {
					if (thisPart.type == ATTACK && !thisPart.boost) {
						unboostedAttack = unboostedAttack + 1;
					}
				});
			}

			if (creep.memory.needBoosts && unboostedAttack > 0) {
				var thisLab = Game.getObjectById(Memory.labList[thisRoom.name][3]);
				if (thisLab) {
					creep.travelTo(thisLab);
					thisLab.boostCreep(creep);
				} else {
					creep.memory.needBoost = false;
				}
			} else if (closeFoe) {
				if (!creep.memory.waitingTimer) {
					creep.memory.waitingTimer = 0
				}
				var lookResult = creep.pos.lookFor(LOOK_STRUCTURES);
				if (lookResult.length && creep.memory.waitingTimer < 10) {
					var found = false;
					for (var y = 0; y < lookResult.length; y++) {
						if (lookResult[y].structureType == STRUCTURE_RAMPART) {
							creep.memory.waitingTimer = creep.memory.waitingTimer + 1;
							found = true;
							break;
						}
					}
					if (!found) {
						creep.travelTo(closeFoe, {
							maxRooms: 1
						});
					}
				} else {
					creep.memory.waitingTimer = 0;
					creep.travelTo(closeFoe, {
						maxRooms: 1
					});
				}
			}

			if (closeFoe) {
				if (creep.pos.inRangeTo(closeFoe, 3)) {
					creep.rangedMassAttack();
				}
				creep.attack(closeFoe);
			}
		} else {
			var lookResult = creep.pos.lookFor(LOOK_STRUCTURES);
			var homeSpawn = Game.getObjectById(creep.memory.fromSpawn)
			if (lookResult.length && lookResult[0].structureType == STRUCTURE_RAMPART) {

			} else if (homeSpawn) {
				creep.travelTo(homeSpawn);
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