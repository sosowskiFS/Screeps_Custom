var creep_farScout = {

    /** @param {Creep} creep **/

    //Need : creep.memory.homeRoom
    run: function(creep) {
        if (!creep.memory.path) {
            let roomExits = Game.map.describeExits(creep.room.name);
            let destArray = [];
            if (roomExits[TOP]) {
                destArray.push(roomExits[TOP]);
            }
            if (roomExits[LEFT]) {
                destArray.push(roomExits[LEFT]);
            }
            if (roomExits[RIGHT]) {
                destArray.push(roomExits[RIGHT]);
            }
            if (roomExits[BOTTOM]) {
                destArray.push(roomExits[BOTTOM]);
            }
            creep.memory.path = destArray;
        }

        //Check all rooms in path, flag remote sources if unclaimed.
        if (creep.memory.path && creep.memory.path.length) {
            if (creep.room.name != creep.memory.path[0]) {
                creep.travelTo(new RoomPosition(25, 25, creep.memory.path[0]));
            } else {
                //In destination
                if (!creep.room.controller) {
                    //Not a room to mine
                    creep.memory.path.splice(0, 1);
                    creep.travelTo(new RoomPosition(25, 25, creep.memory.homeRoom));
                } else if (creep.room.controller.reservation || creep.room.controller.owner) {
                    //Reserved/Owned. Not a room to mine.
                    creep.memory.path.splice(0, 1);
                    creep.travelTo(new RoomPosition(25, 25, creep.memory.homeRoom));
                } else {
                    //Flag sources, remove room from path, step back.
                    let roomSources = creep.room.find(FIND_SOURCES);
                    let sourceCounter = 0;
                    while (roomSources[sourceCounter]) {
                        CreateNewMiningFlag(creep, roomSources[sourceCounter].pos.x, roomSources[sourceCounter].pos.y)
                        sourceCounter++;
                    }
                    creep.memory.path.splice(0, 1);
                    creep.travelTo(new RoomPosition(25, 25, creep.memory.homeRoom));
                }
            }
        } else {
            //Done, suicide. Mark global var that scouting is done.
            Memory.scoutedMiningRooms.push(creep.memory.homeRoom);
            if (Game.flags[thisRoom.name + "MineScout"]) {
                Game.flags[thisRoom.name + "MineScout"].remove();
            }
            creep.suicide();
        }
    }
};

function CreateNewMiningFlag(creep, x, y) {
    if (!Game.flags[creep.memory.homeRoom.name + "FarMining"]) {
        creep.room.createFlag(x, y, creep.memory.homeRoom.name + "FarMining");
    } else if (!Game.flags[creep.memory.homeRoom.name + "FarMining2"]) {
        creep.room.createFlag(x, y, creep.memory.homeRoom.name + "FarMining2");
    } else if (!Game.flags[creep.memory.homeRoom.name + "FarMining3"]) {
        creep.room.createFlag(x, y, creep.memory.homeRoom.name + "FarMining3");
    } else if (!Game.flags[creep.memory.homeRoom.name + "FarMining4"]) {
        creep.room.createFlag(x, y, creep.memory.homeRoom.name + "FarMining4");
    } else if (!Game.flags[creep.memory.homeRoom.name + "FarMining5"]) {
        creep.room.createFlag(x, y, creep.memory.homeRoom.name + "FarMining5");
    } else if (!Game.flags[creep.memory.homeRoom.name + "FarMining6"]) {
        creep.room.createFlag(x, y, creep.memory.homeRoom.name + "FarMining6");
    } else if (!Game.flags[creep.memory.homeRoom.name + "FarMining7"]) {
        creep.room.createFlag(x, y, creep.memory.homeRoom.name + "FarMining7");
    } else if (!Game.flags[creep.memory.homeRoom.name + "FarMining8"]) {
        creep.room.createFlag(x, y, creep.memory.homeRoom.name + "FarMining8");
    } else if (!Game.flags[creep.memory.homeRoom.name + "FarMining9"]) {
        creep.room.createFlag(x, y, creep.memory.homeRoom.name + "FarMining9");
    }
}

module.exports = creep_farScout;