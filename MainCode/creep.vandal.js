var creep_vandal = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (Game.flags["SignThis"]) {
            if (creep.room.name != Game.flags["SignThis"].pos.roomName) {
                creep.moveTo(new RoomPosition(25, 25, Game.flags["SignThis"].pos.roomName));
            } else {
                var signResult = creep.signController(creep.room.controller, creep.memory.message);
                if (signResult == ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller);
                } else if (signResult == OK) {
                    //Controller signed, done
                    if (creep.memory.destinations == 0) {
                        //You're fuckin' done, kiddo.
                        Game.flags["SignThis"].remove();
                        creep.suicide();
                    }
                }
            }
        } else {
            creep.suicide();
        }
    }
};

module.exports = creep_vandal;