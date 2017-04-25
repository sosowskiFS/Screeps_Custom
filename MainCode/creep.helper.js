var creep_Helper = {
	run: function(creep) {
		if (creep.room.name != creep.memory.destination) {
			if (creep.memory.path) {
				if (creep.memory.path[0] == creep.room.name) {
					creep.memory.path.splice(0, 1);
				}
				creep.moveTo(new RoomPosition(25, 25, creep.memory.path[0]));
			} else {
				creep.moveTo(new RoomPosition(25, 25, creep.memory.destination));
			}
		} else {
			creep.memory.priority = 'harvester';
			creep.moveTo(creep.room.controller);
		}
	}
};

module.exports = creep_Helper;