var creep_trump = {

	/** @param {Creep} creep **/
	run: function(creep) {
		if (creep.memory.building && creep.carry.energy == 0) {
			delete creep.memory.building;
		} else if (_.sum(creep.carry) == creep.carryCapacity && !creep.memory.building) {
			creep.memory.building = true;
		}

		if (!creep.memory.building) {
			if (creep.room.name != creep.memory.destination) {
				creep.moveTo(new RoomPosition(25, 25, creep.memory.destination));
			} else {
				sources = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);

				if (sources) {
					if (creep.harvest(sources) == ERR_NOT_IN_RANGE) {
						creep.moveTo(sources);
					}
				}
			}
		} else {
			if (creep.room.controller.level < 2) {
				//Upgrade the controller
				if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
					creep.moveTo(creep.room.controller);
				}
			} else {
				var targets = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
				if (targets) {
					if (creep.build(targets) == ERR_NOT_IN_RANGE) {
						creep.moveTo(targets);
					}
				} else {
					var closestDamagedStructure = [];
					closestDamagedStructure = creep.room.find(FIND_STRUCTURES, {
						filter: (structure) => (structure.structureType != STRUCTURE_ROAD) && (structure.hits < 100000)
					});

					if (closestDamagedStructure.length > 0) {
						closestDamagedStructure.sort(repairCompare);
						creep.memory.structureTarget = closestDamagedStructure[0].id;
						if (creep.repair(closestDamagedStructure[0]) == ERR_NOT_IN_RANGE) {
							creep.moveTo(closestDamagedStructure[0], {
								reusePath: 25,
								maxRooms: 1
							});
						}
					} else {
						//America has been made great again.
						if (Game.flags["WallThis"]) {
							Game.flags["WallThis"].remove();
						} else {
							//creep.suicide();
						}
					}
				}
			}
		}
	}
};

function repairCompare(a, b) {
	if (a.hits < b.hits)
		return -1;
	if (a.hits > b.hits)
		return 1;
	return 0;
}

module.exports = creep_trump;