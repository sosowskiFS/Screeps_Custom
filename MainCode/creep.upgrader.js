var creep_upgrader = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'upgraderNearDeath') {
            creep.memory.priority = 'upgraderNearDeath';
        }

        if (!creep.memory.hasBoosted && creep.room.controller.level >= 6 && Memory.labList[creep.room.name].length >= 3 && !creep.memory.previousPriority) {
            var mineralCost = creep.getActiveBodyparts(WORK) * LAB_BOOST_MINERAL;
            var energyCost = creep.getActiveBodyparts(WORK) * LAB_BOOST_ENERGY;
            var upgradeLab = creep.room.find(FIND_MY_STRUCTURES, {
                filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_GHODIUM_ACID)
            });
            if (upgradeLab.length && upgradeLab[0].mineralAmount >= mineralCost && upgradeLab[0].energy >= energyCost) {
                creep.travelTo(upgradeLab[0]);
                if (upgradeLab[0].boostCreep(creep) == OK) {
                    creep.memory.hasBoosted = true;
                } else {
                    creep.memory.hasBoosted = false;
                }
            } else {
                creep.memory.hasBoosted = true;
            }
        } else {
            if (!creep.memory.hasBoosted) {
                creep.memory.hasBoosted = true;
            }

            const carriedEnergy = getCarriedEnergy(creep);
            const controllerFlag = Game.flags[creep.room.name + "Controller"];

            let attemptedTravel = false
            if (carriedEnergy > 0) {
                if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    if (controllerFlag) {
                        attemptedTravel = true;
                        creep.travelTo(controllerFlag, {
                            maxRooms: 1,
                            stuckValue: 4
                        });
                    } else {
                        attemptedTravel = true;
                        creep.travelTo(creep.room.controller, {
                            maxRooms: 1,
                            stuckValue: 4
                        });
                    }
                } else {
                    if (Game.time % 2 == 0) {
                        creep.say("\u261D\uD83D\uDE3C", true);
                    } else {
                        creep.say("\uD83D\uDC4C\uD83D\uDE39", true);
                    }
                    clearTravelMemory(creep);
                }
            }

            if (carriedEnergy <= creep.getActiveBodyparts(WORK) && !attemptedTravel) {
                var linkTarget = Game.getObjectById(creep.memory.linkSource);
                if (linkTarget && creep.withdraw(linkTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.travelTo(linkTarget, {
                        maxRooms: 1,
                        stuckValue: 4
                    });
                }

                if (!creep.memory.travelDistance && creep.memory._trav && creep.memory._trav.path) {
                    creep.memory.travelDistance = creep.memory._trav.path.length;
                    creep.memory.deathWarn = (creep.memory.travelDistance + _.size(creep.body) * 3) + 15;
                }
            }

            if (Game.time % 5 == 0) {
                let talkingCreeps = creep.pos.findInRange(FIND_MY_CREEPS, 1, {
                    filter: (thisCreep) => (creep.id != thisCreep.id && thisCreep.saying && thisCreep.saying != "\u261D\uD83D\uDE3C" && thisCreep.saying != "\uD83D\uDC4C\uD83D\uDE39")
                })
                if (talkingCreeps.length) {
                    let coords = talkingCreeps[0].saying.split(";");
                    if (coords.length == 2 && creep.pos.x == parseInt(coords[0]) && creep.pos.y == parseInt(coords[1])) {
                        //Standing in the way of a creep
                        let thisDirection = creep.pos.getDirectionTo(talkingCreeps[0].pos);
                        creep.move(thisDirection);
                        creep.say("\uD83D\uDCA6", true);
                    }
                }
            }

            if (Game.time % 3 == 0 && creep.memory._trav && creep.memory._trav.path && creep.memory._trav.path.length) {
                placeRoadOnPath(creep);
            }
        }
    }
};

function placeRoadOnPath(creep) {
    // Only attempt if we have an active travel path
    if (!creep.memory._trav || !creep.memory._trav.path || creep.memory._trav.path.length === 0) {
        return;
    }

    let path = creep.memory._trav.path;
    let nextDir = parseInt(path[0], 10);
    let nextPos = nextDir ? positionAtDirection(creep.pos, nextDir) : undefined;
    let nextNextPos = undefined;
    if (nextPos && path.length > 1) {
        let nextNextDir = parseInt(path[1], 10);
        if (nextNextDir) {
            nextNextPos = positionAtDirection(nextPos, nextNextDir);
        }
    }

    tryCreateRoadAt(creep.pos, nextPos);
    if (nextPos) {
        tryCreateRoadAt(nextPos, nextNextPos);
    }
}

function getCarriedEnergy(creep) {
    if (creep.store && creep.store.getUsedCapacity) {
        return creep.store.getUsedCapacity(RESOURCE_ENERGY) || 0;
    }
    return creep.carry[RESOURCE_ENERGY] || 0;
}

function tryCreateRoadAt(pos, nextPosAfterTarget) {
    if (!pos || !pos.roomName) {
        return;
    }

    const terrain = pos.lookFor(LOOK_TERRAIN);
    if (terrain && terrain.includes("wall")) {
        return;
    }

    let structures = pos.lookFor(LOOK_STRUCTURES);
    if (structures.length && !structures.every(s => s.structureType === STRUCTURE_ROAD || s.structureType === STRUCTURE_RAMPART)) {
        return;
    }

    let sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
    if (sites.length) {
        return;
    }

    // If the next position after this target already has a road/site,
    // avoid placing a road here when there is another road/site adjacent
    // that is not the next position.
    if (nextPosAfterTarget && hasRoadOrSiteAt(nextPosAfterTarget)) {
        let adjacentPositions = getAdjacentPositions(pos);
        let hasOtherAdjacentRoad = adjacentPositions.some((adj) => {
            if (nextPosAfterTarget && adj.isEqualTo(nextPosAfterTarget)) {
                return false;
            }
            return hasRoadOrSiteAt(adj);
        });
        if (hasOtherAdjacentRoad) {
            return;
        }
    }

    pos.createConstructionSite(STRUCTURE_ROAD);
}

function hasRoadOrSiteAt(pos) {
    if (!pos || !pos.roomName) {
        return false;
    }

    let structures = pos.lookFor(LOOK_STRUCTURES);
    if (structures.some(s => s.structureType === STRUCTURE_ROAD)) {
        return true;
    }

    let sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
    return sites.some(s => s.structureType === STRUCTURE_ROAD);
}

function getAdjacentPositions(pos) {
    const offsets = [
        { x: 0, y: -1 },
        { x: 1, y: -1 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
        { x: -1, y: 1 },
        { x: -1, y: 0 },
        { x: -1, y: -1 }
    ];

    let positions = [];
    for (let i = 0; i < offsets.length; i++) {
        let x = pos.x + offsets[i].x;
        let y = pos.y + offsets[i].y;
        if (x >= 0 && x <= 49 && y >= 0 && y <= 49) {
            positions.push(new RoomPosition(x, y, pos.roomName));
        }
    }
    return positions;
}

function positionAtDirection(pos, direction) {
    const offsets = {
        1: { x: 0, y: -1 },
        2: { x: 1, y: -1 },
        3: { x: 1, y: 0 },
        4: { x: 1, y: 1 },
        5: { x: 0, y: 1 },
        6: { x: -1, y: 1 },
        7: { x: -1, y: 0 },
        8: { x: -1, y: -1 }
    };

    let offset = offsets[direction];
    if (!offset) {
        return undefined;
    }

    let x = pos.x + offset.x;
    let y = pos.y + offset.y;
    if (x < 0 || x > 49 || y < 0 || y > 49) {
        return undefined;
    }

    return new RoomPosition(x, y, pos.roomName);
}

function clearTravelMemory(creep) {
    if (creep.memory && creep.memory._trav) {
        delete creep.memory._trav;
    }
}

module.exports = creep_upgrader;