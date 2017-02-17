var creep_looter = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.room.name != creep.memory.destination && _.sum(creep.carry) <= 500) {
            creep.moveTo(new RoomPosition(25, 25, creep.memory.destination));
        } else if (creep.room.name != creep.memory.homeRoom && _.sum(creep.carry) > 500) {
            creep.moveTo(new RoomPosition(25, 25, creep.memory.homeRoom));
        } else {
            if (_.sum(creep.carry) <= 500) {
                //In far room, loot container
                if (creep.room.storage) {
                    if (_.sum(creep.room.storage.store) <= 0) {
                        //Nothing left to loot
                        if (Game.flags["Loot"]) {
                            Game.flags["Loot"].remove();
                        }
                        creep.suicide();
                    } else {
                        if (creep.withdraw(creep.room.storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(creep.room.storage, {
                                reusePath: 20
                            });
                        }
                    }
                }
            } else {
                //In home room, drop off energy
                if (creep.room.storage) {
                    if (creep.transfer(creep.room.storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(creep.room.storage, {
                            reusePath: 5
                        });
                    }
                }
            }
        }
    }
};

module.exports = creep_looter;