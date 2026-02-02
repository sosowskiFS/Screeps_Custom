var creep_upSupplier = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'upSupplierNearDeath') {
            creep.memory.priority = 'upSupplierNearDeath';
        }

        if (_.sum(creep.carry) == 0) {
            //Get from storage
            //Get power if available and powerSpawn is empty
            var storageTarget = creep.room.storage;
            if (storageTarget) {
                var getPower = false;
                var powerAmount = 100;
                if (Memory.powerSpawnList[creep.room.name].length && creep.room.storage.store[RESOURCE_POWER] > 0) {
                    var pSpawn = Game.getObjectById(Memory.powerSpawnList[creep.room.name][0]);
                    if (pSpawn && pSpawn.power == 0) {
                        getPower = true;
                        if (creep.room.storage.store[RESOURCE_POWER] < 100) {
                            powerAmount = creep.room.storage.store[RESOURCE_POWER];
                        }
                    }
                }
                if (getPower) {
                    var withdrawResult = creep.withdraw(storageTarget, RESOURCE_POWER, powerAmount);
                    if (withdrawResult == ERR_NOT_IN_RANGE) {
                        creep.travelTo(storageTarget, {
                            ignoreRoads: true,
                            maxRooms: 1
                        });
                    } else if (withdrawResult == OK) {
                        locateSupplierTarget("POWER", creep);
                    }
                } else {
                    if (creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 250000 && creep.room.terminal.store[RESOURCE_ENERGY] > 31000) {
                        storageTarget = creep.room.terminal
                    }
                    var withdrawResult = creep.withdraw(storageTarget, RESOURCE_ENERGY);
                    if (withdrawResult == ERR_NOT_IN_RANGE) {
                        creep.travelTo(storageTarget, {
                            ignoreRoads: true,
                            maxRooms: 1
                        });
                    } else if (withdrawResult == OK) {
                        locateSupplierTarget("ENERGY", creep);
                    }
                }
            }
        } else {
            if (creep.carry[RESOURCE_POWER] > 0) {
                //Drop off in power Spawn
                var pSpawn = Game.getObjectById(Memory.powerSpawnList[creep.room.name][0]);
                if (pSpawn) {
                    var transferResult = creep.transfer(pSpawn, RESOURCE_POWER);
                    if (transferResult == ERR_NOT_IN_RANGE) {
                        creep.travelTo(pSpawn, {
                            maxRooms: 1
                        });
                    } else if (transferResult == OK) {
                        determineIfEmptyPower(pSpawn, creep);
                    }
                    handleMovementCoordination(creep);
                }
            } else {
                //Drop off in upgrader link
                var upLink = Game.getObjectById(creep.memory.linkTarget);
                if (upLink) {
                    var transferResult = creep.transfer(upLink, RESOURCE_ENERGY);
                    if (transferResult == ERR_NOT_IN_RANGE) {
                        creep.travelTo(upLink, {
                            maxRooms: 1
                        });
                    } else if (transferResult == OK){
                        determineIfEmptyEnergy(upLink, creep);
                    }
                    handleMovementCoordination(creep);
                }
            }
        }
    }
};

function locateSupplierTarget(targetType, creep) {
    if (targetType == "POWER") {
        var pSpawn = Game.getObjectById(Memory.powerSpawnList[creep.room.name][0]);
        if (pSpawn) {
            creep.travelTo(pSpawn, {
                maxRooms: 1
            });
        }
    } else {
        //Energy
        var upLink = Game.getObjectById(creep.memory.linkTarget);
        if (upLink) {
            creep.travelTo(upLink, {
                maxRooms: 1
            });
        }
    }
}

//Below functions are only fired when OK is returned
function determineIfEmptyPower(thisSpawn, creep) {
    if (_.sum(creep.carry) <= thisSpawn.powerCapacity - thisSpawn.power) {
        var storageTarget = creep.room.storage;
        if (storageTarget) {
            creep.travelTo(storageTarget, {
                ignoreRoads: true,
                maxRooms: 1
            });
        }
    }
}

function determineIfEmptyEnergy(thisLink, creep) {
    if (_.sum(creep.carry) <= thisLink.energyCapacity - thisLink.energy) {
        var storageTarget = creep.room.storage;
        if (storageTarget) {
            creep.travelTo(storageTarget, {
                ignoreRoads: true,
                maxRooms: 1
            });
            handleMovementCoordination(creep);
        }
    }
}

function handleMovementCoordination(creep) {
    // Listen for movement requests only from upgrader-priority creeps
    let talkingCreeps = creep.pos.findInRange(FIND_MY_CREEPS, 1, {
        filter: (thisCreep) => (creep.id != thisCreep.id && thisCreep.saying && thisCreep.memory &&
            (thisCreep.memory.priority == 'upgrader' || thisCreep.memory.priority == 'upgraderNearDeath'))
    });

    if (talkingCreeps.length) {
        let coords = talkingCreeps[0].saying.split(";");
        if (coords.length == 2 &&
            creep.pos.x == parseInt(coords[0]) &&
            creep.pos.y == parseInt(coords[1])) {
            // Standing in the way of an upgrader-priority creep
            let thisDirection = creep.pos.getDirectionTo(talkingCreeps[0].pos);
            creep.move(thisDirection);
            creep.say("\uD83D\uDCA6", true);
        }
    }
}

module.exports = creep_upSupplier;