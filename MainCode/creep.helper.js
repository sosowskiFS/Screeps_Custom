var creep_Helper = {
    run: function(creep) {
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
                creep.travelTo(thisPortal)
            } else if (creep.memory.path && creep.memory.path.length) {
                if (creep.memory.path[0] == creep.room.name) {
                    creep.memory.path.splice(0, 1);
                }
                creep.travelTo(new RoomPosition(25, 25, creep.memory.path[0]));
                //creep.travelTo(new RoomPosition(25, 25, creep.memory.destination));
            } else {
                creep.travelTo(new RoomPosition(25, 25, creep.memory.destination));
            }

            if (creep.room.controller && !creep.room.controller.my) {
                if (creep.room.controller.reservation && creep.room.controller.reservation.username == "Montblanc") {
                    //Soak
                } else {
                    var somethingNearby = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: (structure) => (structure.structureType != STRUCTURE_ROAD)
                    });
                    if (somethingNearby) {
                        creep.dismantle(somethingNearby);
                    }
                }
            }
        } else {
            if (!creep.memory.currentState) {
                creep.memory.currentState = 1;
            }

            if (creep.memory.currentState == 1) {
                if (creep.memory.targetSource) {
                    let thisSource = Game.getObjectById(creep.memory.targetSource);
                    if (thisSource) {
                        if (creep.harvest(thisSource) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(thisSource);
                        }
                        if (thisSource.energy <= 25) {
                            creep.memory.targetSource = undefined;
                        }
                    }
                } else {
                    let roomSources = creep.room.find(FIND_SOURCES, {
                        filter: (tSource) => (tSource.energy >= creep.carryCapacity)
                    });
                    if (roomSources.length) {
                        creep.memory.targetSource = roomSources[0].id;
                        if (creep.harvest(roomSources[0]) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(roomSources[0]);
                        }
                    }
                }

                if (_.sum(creep.carry) + (creep.getActiveBodyparts(WORK) * 2) >= creep.carryCapacity) {
                    creep.memory.currentState = 2;
                }
            } else {
                if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    creep.travelTo(creep.room.controller, {
                        maxRooms: 1,
                        stuckValue: 2
                    });
                }

                if (_.sum(creep.carry) <= 0) {
                    creep.memory.currentState = 1;
                }
            }
        }
    }
};

module.exports = creep_Helper;