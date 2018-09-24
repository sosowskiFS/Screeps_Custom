var creep_ranger = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.memory.previousRoom != creep.room.name) {
            creep.memory.previousRoom = creep.room.name;
            creep.memory._trav = undefined;
        }

        let flagName = 'Ranger';
        if (creep.memory.flagName == 'ranger2') {
            flagName = 'Ranger2';
        }

        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'rangerNearDeath') {
            creep.memory.priority = 'rangerNearDeath';
        }

        var closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
            filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
        });

        var foeCount = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 5, {
            filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
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
                if (Game.flags[creep.memory.homeRoom + flagName]) {
                    Game.flags[creep.memory.homeRoom + flagName].remove();
                }
                return;
            }

            if (creep.room.controller && creep.room.controller.owner && creep.room.controller.owner.username != "Montblanc") {
                let somethingNearby = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (structure) => (structure.structureType != STRUCTURE_ROAD && structure.structureType != STRUCTURE_POWER_BANK)
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
                } else if (Game.flags[creep.memory.homeRoom + flagName]) {
                    creep.travelTo(Game.flags[creep.memory.homeRoom + flagName]);
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

            if (!creep.memory.travelDistance && creep.memory._trav && creep.memory._trav.path) {
                creep.memory.travelDistance = creep.memory._trav.path.length;
                creep.memory.deathWarn = (creep.memory.travelDistance + _.size(creep.body) * 3) + 15;
            }
        }

        if (closeFoe) {
            let closeRange = creep.pos.getRangeTo(closeFoe);
            if (closeRange <= 3) {
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
                if (closeRange <= 2 && (foeCount.length > 1 || determineThreat(closeFoe))){
                    //Dodge away from foe
                    let foeDirection = creep.pos.getDirectionTo(closeFoe);
                    let y = 0;
                    let x = 0;
                    switch (foeDirection) {
                        case TOP:
                            y = 5;
                            break;
                        case TOP_RIGHT:
                            y = 5;
                            x = -5;
                            break;
                        case RIGHT:
                            x = -5;
                            break;
                        case BOTTOM_RIGHT:
                            y = -5;
                            x = -5;
                            break;
                        case BOTTOM:
                            y = -5;
                            break;
                        case BOTTOM_LEFT:
                            y = -5;
                            x = 5;
                            break;
                        case LEFT:
                            x = 5;
                            break;
                        case TOP_LEFT:
                            y = 5;
                            x = 5;
                            break;
                    }
                    x = creep.pos.x + x;
                    y = creep.pos.y + y;
                    if (x < 0) {
                        x = 0;
                        if (y < 25 && y > 0) {
                            y = y - 1;
                        } else if (y < 49) {
                            y = y + 1;
                        }
                    } else if (x > 49) {
                        x = 49;
                        if (y < 25 && y > 0) {
                            y = y - 1;
                        } else if (y < 49) {
                            y = y + 1;
                        }
                    }
                    if (y < 0) {
                        y = 0;
                        if (x < 25 && x > 0) {
                            x = x - 1;
                        } else if (x < 49) {
                            x = x + 1;
                        }
                    } else if (y > 49) {
                        y = 49;
                        if (x < 25 && x > 0) {
                            x = x - 1;
                        } else if (x < 49) {
                            x = x + 1;
                        }
                    }

                    creep.moveTo(x, y, {
                        ignoreRoads: true
                    });
                }             
            } else {
                creep.heal(creep);
            }
        } else if (creep.hits < creep.hitsMax) {
            creep.heal(creep);
        }

        //Only works with no attack parts
        creep.heal(creep);

    }

};

function determineThreat(thisCreep) {
	thisCreep.body.forEach(function(thisPart) {
		if (thisPart.type == ATTACK) {
			return true;
		} else if (thisPart.type == RANGED_ATTACK) {
			return true;
		}
	});
	return false;
}

module.exports = creep_ranger;