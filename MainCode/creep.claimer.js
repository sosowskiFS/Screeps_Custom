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
            var thisPortal = undefined;
            if (Game.flags["TakePortal"] && Game.flags["TakePortal"].pos.roomName == creep.pos.roomName) {
                var thisPortal = Game.flags["TakePortal"].pos.look(LOOK_STRUCTURES);
            }
            if (thisPortal && thisPortal.length) {
                if (creep.memory.path.length && creep.memory.path[0] == creep.room.name) {
                    creep.memory.path.splice(0, 1);
                }

                creep.travelTo(Game.flags["TakePortal"], {
                    ignoreRoads: true,
                    offRoad: true
                });
            } else if (creep.memory.path && creep.memory.path.length) {
                if (creep.memory.path[0] == creep.room.name) {
                    creep.memory.path.splice(0, 1);
                }
                creep.travelTo(new RoomPosition(25, 25, creep.memory.path[0]), {
                    ignoreRoads: true,
                    offRoad: true
                });
            } else {
                if (Game.flags["ClaimThis"] && Game.flags["ClaimThis"].pos) {
                    creep.travelTo(Game.flags["ClaimThis"], {
                        ignoreRoads: true,
                        offRoad: true
                    });
                } else {
                    creep.travelTo(new RoomPosition(25, 25, creep.memory.destination), {
                        ignoreRoads: true,
                        offRoad: true
                    });
                }
            }
        } else {
            if (creep.claimController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.travelTo(creep.room.controller, {
                    ignoreRoads: true,
                    offRoad: true
                });
            } else if (creep.claimController(creep.room.controller) == OK) {
                Memory.claimSpawn = false;
                creep.suicide();
            }
        }
    }
};

module.exports = creep_claimer;