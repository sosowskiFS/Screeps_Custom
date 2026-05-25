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
                    updateRoomThreatFlags(creep.room);
                    let roomSources = creep.room.find(FIND_SOURCES);
                    for (let sourceCounter = 0; sourceCounter < roomSources.length; sourceCounter++) {
                        CreateNewMiningFlag(creep, roomSources[sourceCounter].pos.x, roomSources[sourceCounter].pos.y);
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

const REMOTE_OPERATION_SUFFIXES = ['', '2', '3', '4', '5', '6', '7', '8', '9'];

function CreateNewMiningFlag(creep, x, y) {
    const flagName = getFirstAvailableRemoteFlag(creep.memory.homeRoom, "FarMining");
    if (flagName) {
        creep.room.createFlag(x, y, flagName);
    }
}

function CreateNewGuardFlag(creep) {
    const flagName = getFirstAvailableRemoteFlag(creep.memory.homeRoom, "FarGuard");
    if (flagName) {
        creep.room.createFlag(25, 25, flagName);
    }
}

function getFirstAvailableRemoteFlag(homeRoomName, prefix) {
    for (let i = 0; i < REMOTE_OPERATION_SUFFIXES.length; i++) {
        const candidate = homeRoomName + prefix + REMOTE_OPERATION_SUFFIXES[i];
        if (!Game.flags[candidate]) {
            return candidate;
        }
    }
    return '';
}

function updateRoomThreatFlags(room) {
    const roomName = room.name;
    const skRoomFlag = Game.flags[roomName + "SKRoom"];
    const noSkRoomFlag = Game.flags[roomName + "NoSKRoom"];
    const shouldBeSkRoom = isSourceKeeperRoomName(roomName);
    const anchorPos = room.controller ? room.controller.pos : new RoomPosition(25, 25, roomName);

    if (shouldBeSkRoom) {
        if (!skRoomFlag) {
            room.createFlag(anchorPos.x, anchorPos.y, roomName + "SKRoom");
        }
        if (noSkRoomFlag) {
            noSkRoomFlag.remove();
        }
    } else {
        if (!noSkRoomFlag) {
            room.createFlag(anchorPos.x, anchorPos.y, roomName + "NoSKRoom");
        }
        if (skRoomFlag) {
            skRoomFlag.remove();
        }
    }
}

function isSourceKeeperRoomName(roomName) {
    const roomMatch = /^([WE])(\d+)([NS])(\d+)$/.exec(roomName);
    if (!roomMatch) return false;

    let x = parseInt(roomMatch[2], 10);
    let y = parseInt(roomMatch[4], 10);
    if (roomMatch[1] === 'W') x = -x - 1;
    if (roomMatch[3] === 'N') y = -y - 1;

    const xMod = Math.abs(x) % 10;
    const yMod = Math.abs(y) % 10;
    return xMod >= 4 && xMod <= 6 && yMod >= 4 && yMod <= 6;
}

module.exports = creep_farScout;
