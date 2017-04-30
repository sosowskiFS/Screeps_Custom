var creep_Kebab = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (Game.flags["RemoveKebab"] && Game.flags["RemoveKebab"].pos.roomName != creep.pos.roomName) {
            if (creep.memory.path) {
                if (creep.memory.path[0] == creep.room.name) {
                    creep.memory.path.splice(0, 1);
                    if (creep.memory.path.length == 0) {
                        creep.memory.path = undefined;
                    }
                }
                creep.moveTo(new RoomPosition(25, 25, creep.memory.path[0]));
            } else {
                creep.moveTo(new RoomPosition(25, 25, Game.flags["RemoveKebab"].pos.roomName));
            }
        } else {
            //In target room
            var eExt = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                filter: (structure) => (structure.structureType == STRUCTURE_EXTENSION)
            });
            if (eExt) {
                creep.moveTo(eExt, {
                    maxRooms: 1
                });
                creep.dismantle(eExt);
            } else {
                var eSpawns = creep.pos.findClosestByRange(FIND_HOSTILE_SPAWNS);
                if (!creep.memory.moveTimer) {
                    creep.memory.moveTimer = 0;
                }
                if (eSpawns.length) {
                    if (creep.memory.moveTimer >= 5) {
                        creep.moveTo(eSpawns[0], {
                            ignoreDestructibleStructures: true,
                            maxRooms: 1
                        });
                    } else {
                        creep.moveTo(eSpawns[0], {
                            maxRooms: 1
                        });
                    }
                    creep.memory.moveTimer++;

                    creep.dismantle(eSpawns[0]);
                }
            }

        }
    }
};

module.exports = creep_Kebab;