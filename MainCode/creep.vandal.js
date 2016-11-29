var creep_vandal = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.destinations.length > 0) {
            if (creep.room.name != creep.memory.destinations[0]) {
                creep.moveTo(new RoomPosition(34, 47, creep.memory.destinations[0]));
            } else {
                var signResult = creep.signController(creep.room.controller, creep.memory.message);
                if (signResult == ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller);
                } else if (signResult == OK) {
                    //Controller signed, remove destination and proceed
                    creep.memory.destinations = creep.memory.destinations.splice(0, 1);
                    if (creep.memory.destinations == 0) {
                        //You're fuckin' done, kiddo.
                        creep.suicide();
                    }
                }
            }
        }
    }
};

module.exports = creep_vandal;