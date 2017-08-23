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
            } else if (creep.memory.path) {
                if (creep.memory.path[0] == creep.room.name) {
                    creep.memory.path.splice(0, 1);
                }
                //creep.travelTo(new RoomPosition(25, 25, creep.memory.path[0]));
                creep.travelTo(new RoomPosition(25, 25, creep.memory.destination));
            } else {
                creep.travelTo(new RoomPosition(25, 25, creep.memory.destination));
            }
        } else {
            creep.memory.priority = 'harvester';
            creep.travelTo(creep.room.controller);
        }
    }
};

module.exports = creep_Helper;
