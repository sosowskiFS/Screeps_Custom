var creep_ranger = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.memory.previousRoom != creep.room.name) {
            creep.memory.previousRoom = creep.room.name;
            creep.memory._trav = undefined;
        }

        var closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
            filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username) && eCreep.owner.username != "Nemah")
        });

        if (creep.memory.destination == creep.pos.roomName) {
            //In target room
            if (Game.time % 2 == 0) {
                creep.say("(=\uFF40\u03C9\u00B4=)", true);
            } else {
                creep.say("(=\u00B4\u2207\uFF40=)", true);
            }

            //Cancel this flag if room is in safe mode
            if (creep.room.controller.safeMode && creep.room.controller.owner.username != "Montblanc") {
                if (Game.flags[creep.memory.homeRoom + "Ranger"]) {
                    Game.flags[creep.memory.homeRoom + "Ranger"].remove();
                }
                return;
            }

            if (creep.room.controller && creep.room.controller.owner.username != "Montblanc") {
                let somethingNearby = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (structure) => (structure.structureType != STRUCTURE_ROAD)
                });
                if (somethingNearby) {
                    creep.attack(somethingNearby);
                    creep.rangedAttack(somethingNearby);
                }
            }

            let eSpawns = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                filter: (structure) => (structure.structureType == STRUCTURE_SPAWN)
            });
            let eSites = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, {
            	filter: (site) => (site.progress > 0)
            });
            if (eSpawns) {
                creep.travelTo(eSpawns, {
                    ignoreRoads: true,
                    maxRooms: 1,
                    stuckValue: 2,
                    allowSK: true
                });
                creep.attack(eSpawns);
                creep.rangedAttack(eSpawns);
            } else if (eSites && creep.room.controller.owner.username != "Montblanc") {
            	creep.travelTo(eSites, {
            		ignoreRoads: true,
            		maxRooms: 1,
            		stuckValue: 2
            	})
            } else if (closeFoe) {
                creep.moveTo(closeFoe, {
                    ignoreRoads: true,
                    maxRooms: 1,
                    allowSK: true
                });
            } else {
                let eStructures = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                    filter: (structure) => (structure.structureType != STRUCTURE_CONTROLLER && structure.structureType != STRUCTURE_WALL && structure.structureType != STRUCTURE_RAMPART && structure.structureType != STRUCTURE_KEEPER_LAIR && structure.structureType != STRUCTURE_EXTRACTOR)
                });
                if (eStructures) {
                    creep.travelTo(eStructures, {
                        ignoreRoads: true,
                        maxRooms: 1,
                        stuckValue: 2,
                        allowSK: true
                    });
                    creep.attack(eStructures);
                    creep.rangedAttack(eStructures);
                } else if (Game.flags[creep.memory.homeRoom + "Ranger"]) {
                    creep.travelTo(Game.flags[creep.memory.homeRoom + "Ranger"]);
                }
            }
        } else {
            /*if (creep.memory.destination && !creep.memory.usedPortal) {
                creep.travelTo(new RoomPosition(25, 25, creep.memory.destination))
            } else*/
            if (creep.memory.path && creep.memory.path.length) {
                if (creep.memory.path[0] == creep.room.name) {
                    creep.memory.path.splice(0, 1);
                }
                creep.travelTo(new RoomPosition(25, 25, creep.memory.path[0]), {
                    stuckValue: 2,
                    allowSK: true
                });
            } else {
                creep.travelTo(new RoomPosition(25, 25, creep.memory.destination), {
                    stuckValue: 2,
                    allowSK: true
                });
            }
        }

        if (closeFoe) {
            var lookResult = closeFoe.pos.lookFor(LOOK_STRUCTURES);
            let inRampart = false;
            if (lookResult.length) {
                for (let d = 0; d < lookResult.length; d++) {
                    if (lookResult[d].structureType == STRUCTURE_RAMPART) {
                        inRampart = true;
                        break;
                    }
                }
                if (inRampart) {
                    creep.rangedMassAttack();
                } else {
                    creep.rangedAttack(closeFoe);
                    creep.attack(closeFoe);
                }
            } else {
                creep.rangedAttack(closeFoe);
                creep.attack(closeFoe);
            }
        } else if (creep.hits < creep.hitsMax) {
        	creep.heal(creep);
        }

        
    }

};

module.exports = creep_ranger;