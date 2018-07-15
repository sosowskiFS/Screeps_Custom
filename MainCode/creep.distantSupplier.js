var creep_distantSupplier = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.carryCapacity == 0){
            //YER DED TO ME
            creep.suicide();
        }
        
        if (creep.memory.previousRoom != creep.room.name) {
            creep.memory.previousRoom = creep.room.name;
            creep.memory._trav = undefined;
        }

        if (creep.room.name != creep.memory.homeRoom && _.sum(creep.carry) <= 0) {
            //Empty, go back to home and refill

            if (Game.rooms[creep.memory.homeRoom] && Game.rooms[creep.memory.homeRoom].storage) {
                creep.travelTo(Game.rooms[creep.memory.homeRoom].storage);
            } else {
                creep.travelTo(new RoomPosition(25, 25, creep.memory.homeRoom));
            }
        } else if (creep.room.name != creep.memory.destination && _.sum(creep.carry) >= creep.carryCapacity - 100) {
            //Full, go to target
            if (Game.rooms[creep.memory.destination] && Game.rooms[creep.memory.destination].storage) {
                creep.travelTo(Game.rooms[creep.memory.destination].storage);
                if (!creep.memory.travelDistance && creep.memory._trav && creep.memory._trav.path) {
                    creep.memory.travelDistance = creep.memory._trav.path.length;
                }
            } else {
                creep.travelTo(new RoomPosition(25, 25, creep.memory.destination));
            }
        } else {
            if (_.sum(creep.carry) >= creep.carryCapacity - 100) {
                //In target, deposit
                if (creep.room.storage) {
                    if (creep.transfer(creep.room.storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(creep.room.storage);
                    }
                }
            } else {
                //In home room, get energy
                if (creep.room.controller && creep.room.controller.owner && creep.room.controller.owner.username == "Montblanc" && creep.room.storage) {
                    if (creep.memory.travelDistance && creep.memory.travelDistance > creep.ticksToLive) {
                        //Will not be able to make the journey, suicide
                        creep.suicide();
                    }
                    if (creep.withdraw(creep.room.storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(creep.room.storage);
                    }
                } else {
                    creep.travelTo(new RoomPosition(25, 25, creep.memory.homeRoom));
                }
            }
        }
    }
};

module.exports = creep_distantSupplier;
