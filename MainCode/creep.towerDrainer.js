var creep_towerDrainer = {
	run: function(creep) {
		//Should just bounce around on the border healing itself.
		creep.heal(creep);

		if (creep.room.name != creep.memory.destination) {
			creep.moveTo(new RoomPosition(25, 25, creep.memory.destination));
		}
	}
};

module.exports = creep_towerDrainer;