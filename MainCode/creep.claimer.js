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

        if (creep.room.name != creep.memory.destination) {
            if (creep.memory.path.length) {
                if (creep.memory.path[0] == creep.room.name) {
                    creep.memory.path.splice(0, 1);
                }
                creep.moveTo(new RoomPosition(25, 25, creep.memory.path[0]));
            } else {
                creep.moveTo(new RoomPosition(25, 25, creep.memory.destination));
            }
        } else {
            if (creep.claimController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller);
            } else if (creep.claimController(creep.room.controller) == OK) {
                Memory.claimSpawn = false;
                creep.suicide();
            }
        }
    }
};

module.exports = creep_claimer;
