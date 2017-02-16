var creep_Helper = {
	run: function(creep) {
		if (creep.room.name != creep.memory.destination) {
			creep.moveTo(new RoomPosition(25, 25, creep.memory.destination));
		} else {
			creep.memory.priority = 'harvester';
			creep.moveTo(creep.room.controller);
		}
	}
};

module.exports = creep_Helper;