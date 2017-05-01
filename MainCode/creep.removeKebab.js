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
            var somethingNearby = creep.pos.findClosestByRange(FIND_STRUCTURES);
            if (somethingNearby) {
                creep.dismantle(somethingNearby);
            }

            if (creep.memory.targetSpawn) {
                var thisSpawn = Game.getObjectById(creep.memory.targetSpawn);
                if (thisSpawn) {
                    creep.moveTo(thisSpawn, {
                        maxRooms: 1
                    });
                    creep.dismantle(thisSpawn);
                } else {
                    creep.memory.targetSpawn = undefined;
                }
            } else {
                var eExt = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                    filter: (structure) => (structure.structureType == STRUCTURE_EXTENSION)
                });
                if (eExt) {
                    creep.moveTo(eExt, {
                        maxRooms: 1
                    });
                    creep.dismantle(eExt);
                } else {
                    var eSpawns = creep.room.find(FIND_HOSTILE_SPAWNS);
                    if (eSpawns.length) {
                        creep.memory.targetSpawn = eSpawns[Math.floor(Math.random() * eSpawns.length)].id;
                        var thisSpawn = Game.getObjectById(creep.memory.targetSpawn);
                        if (thisSpawn) {
                            creep.moveTo(thisSpawn, {
                                maxRooms: 1
                            });
                            creep.dismantle(thisSpawn);
                        }
                    } else {
                        //Assume we're done here.
                        if (Game.flags["RemoveKebab"]) {
                            Game.flags["RemoveKebab"].remove();
                        }                   
                    }
                }
            }
        }
    }
};

module.exports = creep_Kebab;