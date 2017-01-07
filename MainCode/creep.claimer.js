var creep_claimer = {

    /** @param {Creep} creep **/
    run: function(creep) {
        /*if (creep.room.name != creep.memory.destination) {
            creep.moveTo(new RoomPosition(34, 47, creep.memory.destination));
        } else {
            if (creep.claimController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller);
            }
        }*/

        if (creep.memory.destinations.length > 0) {
            if (creep.room.name != creep.memory.destinations[0]) {
                creep.moveTo(new RoomPosition(25, 25, creep.memory.destinations[0]));
            } else {
                creep.memory.destinations.splice(0, 1);
                if (creep.memory.destinations.length == 0) {
                    if (creep.claimController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(creep.room.controller);
                    }
                }
            }
        } else {
            if (creep.claimController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller);
            }
        }
    }
};

module.exports = creep_claimer;