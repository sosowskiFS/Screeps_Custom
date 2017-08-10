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
                var thisPortal = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (structure) => (structure.structureType == STRUCTURE_PORTAL)
                });
            }
            if (thisPortal) {
                if (creep.memory.path.length && creep.memory.path[0] == creep.room.name) {
                    creep.memory.path.splice(0, 1);
                }

                creep.moveTo(thisPortal, {
                    ignoreRoads: true
                });
            } else if (creep.memory.path && creep.memory.path.length) {
                if (creep.memory.path[0] == creep.room.name) {
                    creep.memory.path.splice(0, 1);
                }
                creep.moveTo(new RoomPosition(25, 25, creep.memory.path[0]), {
                    ignoreRoads: true
                });
            } else {
                creep.moveTo(new RoomPosition(25, 25, creep.memory.destination), {
                    ignoreRoads: true
                });
            }
        } else {
            if (creep.claimController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, {
                    ignoreRoads: true
                });
            } else if (creep.claimController(creep.room.controller) == OK) {
                Memory.claimSpawn = false;
                creep.suicide();
            }
        }
    }
};

module.exports = creep_claimer;
