var creep_looter = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.carryCapacity == 0) {
            //YER DED TO ME
            creep.suicide();
        }
        if (creep.room.name != creep.memory.destination && creep.store.getFreeCapacity() >= 100) {
            if (Game.rooms[creep.memory.destination] && Game.rooms[creep.memory.destination].storage) {
                creep.travelTo(Game.rooms[creep.memory.destination].storage);
            } else {
                creep.travelTo(new RoomPosition(25, 25, creep.memory.destination));
            }
        } else if (creep.room.name != creep.memory.homeRoom && creep.store.getFreeCapacity() < 100) {
            if (Game.rooms[creep.memory.homeRoom] && Game.rooms[creep.memory.homeRoom].storage) {
                creep.travelTo(Game.rooms[creep.memory.homeRoom].storage);
            } else {
                creep.travelTo(new RoomPosition(25, 25, creep.memory.homeRoom));
            }
        } else {
            if (creep.store.getFreeCapacity() >= 100) {
                //In far room, loot container
                //Check for ruins first
                let ruins = creep.pos.findClosestByRange(FIND_RUINS, {
                    filter: (thisRuin) => (thisRuin.store.getUsedCapacity() > 0)
                });
                if (ruins) {
                    if (creep.withdraw(ruins, Object.keys(ruins.store)[0]) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(ruins, {
                            maxRooms: 1
                        });
                    }
                } else if (creep.room.storage && creep.room.storage.owner.username != "Montblanc") {
                    if (creep.room.storage.store.getUsedCapacity() == 0) {
                        if (creep.room.terminal && creep.room.terminal.store.getUsedCapacity() > 0) {
                            if (Object.keys(creep.room.terminal).length > 1) {
                                if (creep.withdraw(creep.room.terminal, Object.keys(creep.room.terminal.store)[1]) == ERR_NOT_IN_RANGE) {
                                    creep.travelTo(creep.room.terminal);
                                }
                            } else {
                                if (creep.withdraw(creep.room.terminal, Object.keys(creep.room.terminal.store)[0]) == ERR_NOT_IN_RANGE) {
                                    creep.travelTo(creep.room.terminal);
                                }
                            }
                        } else {
                            //Nothing left to loot
                            if (Game.flags[creep.memory.homeRoom + "Loot"]) {
                                Game.flags[creep.memory.homeRoom + "Loot"].remove();
                            }
                            if (Memory.lootSpawn) {
                                Memory.lootSpawn = undefined;
                            }
                            creep.suicide();
                        }
                    } else {
                    	let withdrawResult = undefined;
                    	if (Object.keys(creep.room.storage).length > 1) {
                    		withdrawResult = creep.withdraw(creep.room.storage, Object.keys(creep.room.storage.store)[1])
                    	} else {
                    		withdrawResult = creep.withdraw(creep.room.storage, Object.keys(creep.room.storage.store)[0])
                    	}
                        if (withdrawResult == ERR_NOT_IN_RANGE) {
                            creep.travelTo(creep.room.storage);
                        } else if (withdrawResult == OK) {
                            if (Game.rooms[creep.memory.homeRoom] && Game.rooms[creep.memory.homeRoom].storage) {
                                creep.travelTo(Game.rooms[creep.memory.homeRoom].storage);
                            } else {
                                creep.travelTo(new RoomPosition(25, 25, creep.memory.homeRoom));
                            }
                        }
                    }
                } else if (creep.room.terminal && creep.room.terminal.owner.username != "Montblanc" && creep.room.terminal.store.getUsedCapacity() > 0) {
                    if (Object.keys(creep.room.terminal).length > 1) {
                        if (creep.withdraw(creep.room.terminal, Object.keys(creep.room.terminal.store)[1]) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(creep.room.terminal);
                        }
                    } else {
                        if (creep.withdraw(creep.room.terminal, Object.keys(creep.room.terminal.store)[0]) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(creep.room.terminal);
                        }
                    }
                } else {
                    //Nothing left to loot
                    if (Game.flags[creep.memory.homeRoom + "Loot"]) {
                        Game.flags[creep.memory.homeRoom + "Loot"].remove();
                    }
                    if (Memory.lootSpawn) {
                        Memory.lootSpawn = undefined;
                    }
                    creep.suicide();
                }
            } else {
                //In home room, drop off energy
                if (creep.room.storage) {
                    let transferResult = undefined;
                    if (Object.keys(creep.carry).length > 1) {
                        transferResult = creep.transfer(creep.room.storage, Object.keys(creep.carry)[1])
                    } else {
                        transferResult = creep.transfer(creep.room.storage, Object.keys(creep.carry)[0])
                    }
                    if (transferResult == ERR_NOT_IN_RANGE) {
                        creep.travelTo(creep.room.storage);
                    }
                }
            }
        }
    }
};

module.exports = creep_looter;