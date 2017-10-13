var creep_looter = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.carryCapacity == 0){
            //YER DED TO ME
            creep.suicide();
        }
        if (creep.room.name != creep.memory.destination && _.sum(creep.carry) <= creep.carryCapacity - 100) {
            if (Game.rooms[creep.memory.destination] && Game.rooms[creep.memory.destination].storage) {
                creep.travelTo(Game.rooms[creep.memory.destination].storage);
            } else {
                creep.travelTo(new RoomPosition(25, 25, creep.memory.destination));
            }
        } else if (creep.room.name != creep.memory.homeRoom && _.sum(creep.carry) > creep.carryCapacity - 100) {
            if (Game.rooms[creep.memory.homeRoom] && Game.rooms[creep.memory.homeRoom].storage) {
                creep.travelTo(Game.rooms[creep.memory.homeRoom].storage);
            } else {
                creep.travelTo(new RoomPosition(25, 25, creep.memory.homeRoom));
            }
        } else {
            if (_.sum(creep.carry) <= creep.carryCapacity - 100) {
                //In far room, loot container
                if (creep.room.storage) {
                    if (_.sum(creep.room.storage.store) <= 0) {
                        //Nothing left to loot
                        if (Game.flags[creep.memory.homeRoom + "Loot"]) {
                            Game.flags[creep.memory.homeRoom + "Loot"].remove();
                        }
                        if (Memory.lootSpawn) {
                            Memory.lootSpawn = undefined;
                        }
                        creep.suicide();
                    } else {
                        if (creep.withdraw(creep.room.storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(creep.room.storage);
                        }
                    }
                }
            } else {
                //In home room, drop off energy
                if (creep.room.storage) {
                    if (creep.transfer(creep.room.storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(creep.room.storage);
                    }
                }
            }
        }
    }
};

module.exports = creep_looter;
