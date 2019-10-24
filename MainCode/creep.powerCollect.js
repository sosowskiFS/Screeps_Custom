var creep_powerCollect = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (!creep.memory.mode) {
            creep.memory.mode = 0;
        }
        if (creep.memory.mode == 0) {
            //Pick up
            if (creep.room.name != creep.memory.destination) {
                //Travel to room
                if (Game.flags[creep.memory.homeRoom + "PowerGather"] && Game.flags[creep.memory.homeRoom + "PowerGather"]) {
                    creep.travelTo(Game.flags[creep.memory.homeRoom + "PowerGather"]);
                } else {
                    creep.travelTo(new RoomPosition(25, 25, creep.memory.destination));
                }
            } else {
                //Main loop
                if (Game.flags[creep.memory.homeRoom + "PowerGather"]) {
                    //Bank still active, hold.
                    creep.travelTo(Game.flags[creep.memory.homeRoom + "PowerGather"], {
                        range: 3
                    });
                } else {
                    //Pick up
                    if (Game.flags[creep.memory.homeRoom + "PowerCollect"]) {
                        Game.flags[creep.memory.homeRoom + "PowerCollect"].remove();
                    }

                    if (creep.store.getFreeCapacity() > 0) {
                        let ruins = creep.pos.findClosestByRange(FIND_RUINS, {
                            filter: (thisRuin) => (thisRuin.store.getUsedCapacity() > 0)
                        });
                        if (ruins) {
                            if (creep.withdraw(ruins, Object.keys(ruins.store)[0]) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(ruins, {
                                    maxRooms: 1
                                });
                            }
                        } else {
                            let something = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 30);
                            if (something.length) {
                                let pickupResult = creep.pickup(something[0]);
                                if (pickupResult == ERR_NOT_IN_RANGE) {
                                    creep.travelTo(something[0]);
                                } else if (pickupResult == OK && something[0].amount >= creep.store.getFreeCapacity()) {
                                    creep.memory.mode = 1;
                                    if (Game.rooms[creep.memory.homeRoom] && Game.rooms[creep.memory.homeRoom].storage) {
                                        creep.travelTo(Game.rooms[creep.memory.homeRoom].storage);
                                    } else {
                                        creep.travelTo(new RoomPosition(25, 25, creep.memory.homeRoom));
                                    }
                                }
                            } else {
                                returnObject = creep.pos.findClosestByRange(FIND_TOMBSTONES, {
                                    filter: (thisTombstone) => (_.sum(thisTombstone.store) > 0)
                                });
                                if (returnObject) {
                                    if (creep.withdraw(returnObject, Object.keys(returnObject.store)[0]) == ERR_NOT_IN_RANGE) {
                                        creep.travelTo(returnObject, {
                                            maxRooms: 1
                                        });
                                    }
                                } else if (creep.store.getUsedCapacity() > 0) {
                                    creep.memory.mode = 1;
                                } else {
                                    //carrying nothing, nothing to pick up
                                    creep.suicide();
                                }
                            }
                        }
                    } else {
                        creep.memory.mode = 1;
                    }
                }
            }
        } else {
            //Deposit
            if (creep.room.name != creep.memory.homeRoom) {
                //Travel to room
                if (Game.rooms[creep.memory.homeRoom] && Game.rooms[creep.memory.homeRoom].storage) {
                    creep.travelTo(Game.rooms[creep.memory.homeRoom].storage);
                } else {
                    creep.travelTo(new RoomPosition(25, 25, creep.memory.homeRoom));
                }
            } else if (_.sum(creep.carry) > 0) {
                if (creep.room.storage) {
                    if (Object.keys(creep.carry).length > 1) {
                        if (creep.transfer(creep.room.storage, Object.keys(creep.carry)[1]) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(creep.room.storage);
                        }
                    } else if (creep.transfer(creep.room.storage, Object.keys(creep.carry)[0]) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(creep.room.storage);
                    }
                }
            } else {
                //Done
                creep.suicide();
            }
        }
    }
};

module.exports = creep_powerCollect;