var creep_Kebab = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (Game.flags["RemoveKebab"] && Game.flags["RemoveKebab"].pos.roomName != creep.pos.roomName) {
            if (creep.memory.path) {
                creep.moveTo(new RoomPosition(25, 25, creep.memory.path[0]));
                if (creep.memory.path[0] == creep.room.name) {
                    creep.memory.path.splice(0, 1);
                    if (creep.memory.path.length == 0) {
                        creep.memory.path = undefined;
                    }
                }
            } else {
                if (Game.flags["WallFlag"] && Game.flags["WallFlag"].pos) {
                    creep.moveTo(Game.flags["WallFlag"], {
                        reusePath: 25
                    });
                } else if (Game.flags["RemoveKebab"].pos) {
                    creep.moveTo(Game.flags["RemoveKebab"], {
                        reusePath: 25
                    });
                } else {
                    creep.moveTo(new RoomPosition(25, 25, Game.flags["RemoveKebab"].pos.roomName), {
                        reusePath: 25
                    });
                }
            }
        } else if (Game.flags["RemoveKebab"]) {
            //In target room
            var somethingNearby = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (structure) => (structure.structureType != STRUCTURE_ROAD)
            });
            if (somethingNearby) {
                creep.dismantle(somethingNearby);
            }

            if (Game.flags["WallFlag"]) {
                var thisWall = Game.flags["WallFlag"].pos.lookFor(LOOK_STRUCTURES);
                if (thisWall.length) {
                    creep.moveTo(thisWall[0]);
                    creep.dismantle(thisWall[0]);
                } else {
                    Game.flags["WallFlag"].remove();
                }
            } else if (creep.memory.targetSpawn) {
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
                    filter: (structure) => (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_TOWER)
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
                        var eExt2 = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                            filter: (structure) => (structure.structureType != STRUCTURE_CONTROLLER)
                        });
                        if (eExt2) {
                            creep.moveTo(eExt2, {
                                maxRooms: 1
                            });
                            creep.dismantle(eExt2);
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
    }
};

module.exports = creep_Kebab;
