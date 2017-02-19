var creep_towerDrainer = {
	run: function(creep) {
		//Should just bounce around on the border healing itself.
		if (creep.hits < creep.hitsMax) {
			creep.heal(creep);
		}
		if (!creep.memory.lastHP) {
			creep.memory.lastHP = creep.hits;
		}
		creep.notifyWhenAttacked(false);

		if (creep.room.name != creep.memory.destination && creep.hits == creep.hitsMax) {
			creep.moveTo(new RoomPosition(25, 25, creep.memory.destination));
		} else {
			if (creep.hits == creep.hitsMax) {
				if (Game.flags["DrainTurret"]) {
					creep.moveTo(Game.flags["DrainTurret"].pos);
				} else {
					creep.moveTo(creep.room.controller);
				}
			} else {
				//Drawing fire
				if (creep.memory.lastHP > creep.hits) {
					creep.moveTo(new RoomPosition(25, 25, creep.memory.homeRoom));
				}
			}
			creep.memory.lastHP = creep.hits;
		}
	}
};

module.exports = creep_towerDrainer;