var creep_constructor = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.memory.building && creep.carry.energy == 0) {
            delete creep.memory.building;
        } else if (_.sum(creep.carry) == creep.carryCapacity && !creep.memory.building) {
            creep.memory.building = true;
        }

        if (!creep.memory.building) {
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
                    creep.travelTo(new RoomPosition(25, 25, creep.memory.path[0]));
                } else {
                    creep.travelTo(new RoomPosition(25, 25, creep.memory.destination));
                }

                if (creep.room.controller && !creep.room.controller.my) {
                	if (creep.room.controller.reservation && creep.room.controller.reservation.username == "Montblanc"){
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
                var sources = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
                if (sources) {
                    if (creep.pickup(sources) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(sources, {
                            reusePath: 25
                        });
                    }
                } else {
                    sources = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
                    if (sources) {
                        if (creep.harvest(sources) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(sources);
                        }
                    }
                }
            }
        } else {
            if ((creep.carry.energy <= 20 && creep.hits < 2500 && creep.room.controller.level < 2)) {
                //Upgrade the controller
                if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    creep.travelTo(creep.room.controller);
                }
            } else if (creep.build(Game.getObjectById(creep.memory.siteID)) == ERR_NOT_IN_RANGE) {
                creep.travelTo(Game.getObjectById(creep.memory.siteID));
            } else if (creep.build(Game.getObjectById(creep.memory.siteID)) == ERR_INVALID_TARGET) {
                if (Game.flags["BuildThis"]) {
                    Game.flags["BuildThis"].remove();
                }
                //creep.memory.priority = 'harvester';
                creep.memory.priority = 'helper';          
                if (creep.memory.homeRoom && creep.room.name == creep.memory.destination && !Game.flags[creep.memory.homeRoom + "SendHelper"]) {
                    creep.pos.createFlag(creep.memory.homeRoom + "SendHelper");
                }
                creep.memory.homeRoom = creep.room.name;
            }
        }
    }
};

module.exports = creep_constructor;