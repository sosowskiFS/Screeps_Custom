var creep_assattacker = {

    /** @param {Creep} creep **/
    run: function(creep) {

        var healerSquad = creep.pos.findInRange(FIND_MY_CREEPS, 2, {
            filter: (mCreep) => (mCreep.memory.priority == "asshealer")
        });
        var closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
            filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
        });
        if (closeFoe) {
            //This attack will be overridden if attacking a structure
            creep.attack(closeFoe);
        }

        if (healerSquad.length && healerSquad.length < 2) {
            if (Game.flags["RallyHere"] && Game.flags["RallyHere"].pos.roomName != creep.pos.roomName) {
                //Probably in a new room, hold.
                if (creep.pos.x == 0 || creep.pos.x == 49 || creep.pos.y == 0 || creep.pos.y == 49) {
                    creep.moveTo(25, 25);
                }
            } else {
                creep.moveTo(Game.flags["RallyHere"]);
            }
        } else {
            if (Game.flags["Assault"] && Game.flags["Assault"].pos.roomName != creep.pos.roomName) {
                creep.moveTo(new RoomPosition(25, 25, Game.flags["Assault"].pos.roomName));
            } else {
                //In target room
                var eTowers = creep.room.find(FIND_HOSTILE_STRUCTURES, {
                    filter: (structure) => (structure.structureType == STRUCTURE_TOWER)
                });
                if (eTowers.length) {
                    creep.moveTo(eTowers[0]);
                    creep.attack(eTowers[0]);
                } else {
                    var eSpawns = creep.room.find(FIND_HOSTILE_SPAWNS)
                    if (eSpawns.length) {
                        creep.moveTo(eSpawns[0]);
                        creep.attack(eSpawns[0]);
                    } else {
                        var eStructures = creep.room.find(FIND_HOSTILE_STRUCTURES)
                        if (eStructures.length) {
                            creep.moveTo(eStructures[0]);
                            creep.attack(eStructures[0]);
                        } else if (closeFoe) {
                            creep.moveTo(closeFoe);
                        }
                    }
                }
            }
        }

    }

};

module.exports = creep_assattacker;