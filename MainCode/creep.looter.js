var creep_looter = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.room.name != creep.memory.destination && _.sum(creep.carry) <= 500) {
            if (Game.rooms[creep.memory.destination] && Game.rooms[creep.memory.destination].storage) {
                creep.moveTo(Game.rooms[creep.memory.destination].storage, {
                    reusePath: 25
                });
            } else {
                creep.moveTo(new RoomPosition(25, 25, creep.memory.destination), {
                    reusePath: 25
                });
            }
        } else if (creep.room.name != creep.memory.homeRoom && _.sum(creep.carry) > 500) {
            if (Game.rooms[creep.memory.homeRoom] && Game.rooms[creep.memory.homeRoom].storage) {
                creep.moveTo(Game.rooms[creep.memory.homeRoom].storage, {
                    reusePath: 25
                });
            } else {
                creep.moveTo(new RoomPosition(25, 25, creep.memory.homeRoom), {
                    reusePath: 25
                });
            }
        } else {
            if (_.sum(creep.carry) <= 500) {
                //In far room, loot container
                if (creep.room.storage) {
                    if (_.sum(creep.room.storage.store) <= 0) {
                        //Nothing left to loot
                        if (Game.flags["Loot"]) {
                            Game.flags["Loot"].remove();
                        }
                        if (Memory.lootSpawn) {
                            Memory.lootSpawn = undefined;
                        }
                        creep.suicide();
                    } else {
                        if (creep.withdraw(creep.room.storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(creep.room.storage, {
                                reusePath: 25
                            });
                        }
                    }
                }
            } else {
                //In home room, drop off energy
                if (creep.room.storage) {
                    if (creep.transfer(creep.room.storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(creep.room.storage, {
                            reusePath: 25
                        });
                    }
                }
            }
        }
    }
};

module.exports = creep_looter;
