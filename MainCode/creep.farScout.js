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
                    CreateNewGuardFlag(creep);
                    creep.memory.path.splice(0, 1);
                    creep.travelTo(new RoomPosition(25, 25, creep.memory.homeRoom));
                }
            }
        } else {
            //Done, suicide. Mark global var that scouting is done.
            Memory.scoutedMiningRooms.push(creep.memory.homeRoom);
            creep.suicide();
        }
    }
};

function CreateNewMiningFlag(creep, x, y) {
    if (!Game.flags[creep.memory.homeRoom + "FarMining"]) {
        creep.room.createFlag(x, y, creep.memory.homeRoom + "FarMining");
    } else if (!Game.flags[creep.memory.homeRoom + "FarMining2"]) {
        creep.room.createFlag(x, y, creep.memory.homeRoom + "FarMining2");
    } else if (!Game.flags[creep.memory.homeRoom + "FarMining3"]) {
        creep.room.createFlag(x, y, creep.memory.homeRoom + "FarMining3");
    } else if (!Game.flags[creep.memory.homeRoom + "FarMining4"]) {
        creep.room.createFlag(x, y, creep.memory.homeRoom + "FarMining4");
    } else if (!Game.flags[creep.memory.homeRoom + "FarMining5"]) {
        creep.room.createFlag(x, y, creep.memory.homeRoom + "FarMining5");
    } else if (!Game.flags[creep.memory.homeRoom + "FarMining6"]) {
        creep.room.createFlag(x, y, creep.memory.homeRoom + "FarMining6");
    } else if (!Game.flags[creep.memory.homeRoom + "FarMining7"]) {
        creep.room.createFlag(x, y, creep.memory.homeRoom + "FarMining7");
    } else if (!Game.flags[creep.memory.homeRoom + "FarMining8"]) {
        creep.room.createFlag(x, y, creep.memory.homeRoom + "FarMining8");
    } else if (!Game.flags[creep.memory.homeRoom + "FarMining9"]) {
        creep.room.createFlag(x, y, creep.memory.homeRoom + "FarMining9");
    }
}

function CreateNewGuardFlag(creep) {
	if (!Game.flags[creep.memory.homeRoom + "FarGuard"]) {
        creep.room.createFlag(25, 25, creep.memory.homeRoom + "FarGuard");
    } else if (!Game.flags[creep.memory.homeRoom + "FarGuard2"]) {
        creep.room.createFlag(25, 25, creep.memory.homeRoom + "FarGuard2");
    } else if (!Game.flags[creep.memory.homeRoom + "FarGuard3"]) {
        creep.room.createFlag(25, 25, creep.memory.homeRoom + "FarGuard3");
    } else if (!Game.flags[creep.memory.homeRoom + "FarGuard4"]) {
        creep.room.createFlag(25, 25, creep.memory.homeRoom + "FarGuard4");
    } else if (!Game.flags[creep.memory.homeRoom + "FarGuard5"]) {
        creep.room.createFlag(25, 25, creep.memory.homeRoom + "FarGuard5");
    } else if (!Game.flags[creep.memory.homeRoom + "FarGuard6"]) {
        creep.room.createFlag(25, 25, creep.memory.homeRoom + "FarGuard6");
    } else if (!Game.flags[creep.memory.homeRoom + "FarGuard7"]) {
        creep.room.createFlag(25, 25, creep.memory.homeRoom + "FarGuard7");
    } else if (!Game.flags[creep.memory.homeRoom + "FarGuard8"]) {
        creep.room.createFlag(25, 25, creep.memory.homeRoom + "FarGuard8");
    } else if (!Game.flags[creep.memory.homeRoom + "FarGuard9"]) {
        creep.room.createFlag(25, 25, creep.memory.homeRoom + "FarGuard9");
    }
}

module.exports = creep_farScout;