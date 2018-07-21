var creep_work5 = {

    /** @param {Creep} creep **/
    run: function(creep) {

        if (creep.carry.energy > 0 && creep.memory.priority != 'miner' && creep.memory.priority != 'minerNearDeath') {
            //All creeps check for road under them and repair if needed.
            var someStructure = creep.pos.lookFor(LOOK_STRUCTURES);
            if (someStructure.length && (someStructure[0].hitsMax - someStructure[0].hits >= 600) && someStructure[0].structureType == STRUCTURE_ROAD) {
                creep.repair(someStructure[0]);
            }
        }

        switch (creep.memory.priority) {
            case 'mule':
            case 'muleNearDeath':
                if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'muleNearDeath') {
                    creep.memory.priority = 'muleNearDeath';
                }

                if (_.sum(creep.carry) <= 50) {
                    creep.memory.structureTarget = undefined;
                    let storageTarget = creep.room.storage;
                    if (Memory.roomsUnderAttack.indexOf(creep.room.name) == -1 && creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 350000 && creep.room.terminal.store[RESOURCE_ENERGY] > 31000) {
                        storageTarget = creep.room.terminal;
                    }
                    if (storageTarget) {
                        if (storageTarget.store[RESOURCE_ENERGY] >= 50) {
                            //Get from container
                            if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(storageTarget);
                            }
                        } else {
                            var spawnTarget = Game.getObjectById(creep.memory.fromSpawn);
                            if (spawnTarget) {
                                if (!creep.pos.isNearTo(spawnTarget)) {
                                    creep.travelTo(spawnTarget);
                                }
                            }
                        }
                    }
                } else {
                    if (creep.carry[RESOURCE_ENERGY] == 0) {
                        if (creep.room.terminal) {
                            var currentlyCarrying = _.findKey(creep.carry);
                            if (creep.transfer(creep.room.terminal, currentlyCarrying) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(creep.room.terminal);
                            }
                        } else if (!creep.room.terminal && creep.room.storage) {
                            var currentlyCarrying = _.findKey(creep.carry);
                            if (creep.transfer(creep.room.storage, currentlyCarrying) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(creep.room.storage);
                            }
                        }
                    } else {
                        var savedTarget = Game.getObjectById(creep.memory.structureTarget)
                        var getNewStructure = false;
                        if (savedTarget) {
                            if (creep.build(savedTarget) == ERR_INVALID_TARGET) {
                                //Only other blocker is build.
                                creep.repair(savedTarget);

                                if (creep.memory.lookForNewRampart) {
                                    creep.memory.structureTarget = undefined;
                                    creep.memory.lookForNewRampart = undefined;
                                    var newRampart = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                                        filter: (structure) => (structure.structureType == STRUCTURE_RAMPART) && (structure.hits == 1)
                                    });
                                    if (newRampart) {
                                        creep.memory.structureTarget = newRampart.id;
                                        if (creep.repair(newRampart) == ERR_NOT_IN_RANGE) {
                                            creep.travelTo(newRampart);
                                        }
                                    }
                                } else if (savedTarget.structureType != STRUCTURE_CONTAINER && savedTarget.structureType != STRUCTURE_STORAGE && savedTarget.structureType != STRUCTURE_CONTROLLER) {
                                    //Storing in spawn/extension/tower/link
                                    if (creep.transfer(savedTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE && savedTarget.energy < savedTarget.energyCapacity) {
                                        creep.travelTo(savedTarget);
                                    } else {
                                        //assumed OK, drop target
                                        creep.memory.structureTarget = undefined;
                                        getNewStructure = true;
                                    }
                                } else {
                                    //Upgrading controller
                                    if (Memory.linkList[creep.room.name].length > 1) {
                                        var upgraderLink = Game.getObjectById(Memory.linkList[creep.room.name][1]);
                                        if (upgraderLink && upgraderLink.energy < 100) {
                                            if (creep.transfer(upgraderLink, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                                creep.travelTo(upgraderLink, {
                                                    maxRooms: 1
                                                });
                                            }
                                        } else if (creep.upgradeController(savedTarget) == ERR_NOT_IN_RANGE) {
                                            if (Game.flags[creep.room.name + "Controller"]) {
                                                creep.travelTo(Game.flags[creep.room.name + "Controller"], {
                                                    maxRooms: 1
                                                });
                                            } else {
                                                creep.travelTo(savedTarget, {
                                                    maxRooms: 1
                                                });
                                            }
                                        }
                                    }
                                    //Do repair for new ramparts
                                    creep.repair(savedTarget);
                                }
                            } else {
                                if (creep.build(savedTarget) == ERR_NOT_IN_RANGE) {
                                    creep.travelTo(savedTarget);
                                } else if (creep.build(savedTarget) != OK) {
                                    creep.memory.structureTarget = undefined;
                                }
                            }
                        } else {
                            creep.memory.structureTarget = undefined;
                        }
                        //Immediately find a new target if previous transfer worked
                        if (!creep.memory.structureTarget) {
                            var targets = undefined;
                            if (Memory.warMode) {
                                if (getNewStructure) {
                                    targets = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                                        filter: (structure) => {
                                            return (structure.structureType == STRUCTURE_EXTENSION ||
                                                structure.structureType == STRUCTURE_SPAWN ||
                                                structure.structureType == STRUCTURE_LAB ||
                                                structure.structureType == STRUCTURE_TOWER) && structure.energy < structure.energyCapacity && structure.id != savedTarget.id;
                                        }
                                    });
                                } else {
                                    targets = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                                        filter: (structure) => {
                                            return (structure.structureType == STRUCTURE_EXTENSION ||
                                                structure.structureType == STRUCTURE_SPAWN ||
                                                structure.structureType == STRUCTURE_LAB ||
                                                structure.structureType == STRUCTURE_TOWER) && structure.energy < structure.energyCapacity;
                                        }
                                    });
                                }
                            } else {
                                if (getNewStructure) {
                                    targets = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                                        filter: (structure) => {
                                            return (structure.structureType == STRUCTURE_EXTENSION ||
                                                structure.structureType == STRUCTURE_SPAWN ||
                                                structure.structureType == STRUCTURE_LAB) && structure.energy < structure.energyCapacity && structure.id != savedTarget.id;
                                        }
                                    });
                                } else {
                                    targets = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                                        filter: (structure) => {
                                            return (structure.structureType == STRUCTURE_EXTENSION ||
                                                structure.structureType == STRUCTURE_SPAWN ||
                                                structure.structureType == STRUCTURE_LAB) && structure.energy < structure.energyCapacity;
                                        }
                                    });
                                }
                            }

                            if (targets) {
                                creep.memory.structureTarget = targets.id;
                                if (getNewStructure) {
                                    creep.travelTo(targets);
                                } else if (creep.transfer(targets, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                    creep.travelTo(targets);
                                } else {
                                    creep.memory.structureTarget = undefined;
                                }
                            } else {
                                //Store in terminal
                                var terminalTarget = Game.getObjectById(creep.memory.terminalID)
                                if (terminalTarget) {
                                    let targetEnergy = 0;
                                    if (creep.room.storage) {
                                        if (creep.room.storage.store[RESOURCE_ENERGY] >= 350000) {
                                            targetEnergy = 60000;
                                        } else if (creep.room.storage.store[RESOURCE_ENERGY] >= 50000) {
                                            targetEnergy = 30000;
                                        }
                                    }
                                    if (terminalTarget.store[RESOURCE_ENERGY] < targetEnergy && (terminalTarget.storeCapacity - 5000) > _.sum(terminalTarget.store)) {
                                        creep.memory.structureTarget = terminalTarget.id;
                                        if (creep.transfer(terminalTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                            creep.travelTo(terminalTarget);
                                        }
                                    } else {
                                        terminalTarget = undefined;
                                    }
                                }

                                if (!terminalTarget) {
                                    //Level8 Structures
                                    var targets2;
                                    if (creep.room.controller.level == 8) {
                                        targets2 = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                                            filter: (structure) => {
                                                return (structure.structureType == STRUCTURE_POWER_SPAWN ||
                                                    structure.structureType == STRUCTURE_NUKER) && structure.energy < structure.energyCapacity;
                                            }
                                        });
                                    }
                                    if (targets2) {
                                        creep.memory.structureTarget = targets2.id;
                                        if (creep.transfer(targets2, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                            creep.travelTo(targets2);
                                        } else {
                                            creep.memory.structureTarget = undefined;
                                        }
                                    } else {
                                        //Build
                                        targets2 = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
                                        if (targets2) {
                                            creep.memory.structureTarget = targets2.id;
                                            if (targets2.structureType == STRUCTURE_RAMPART) {
                                                creep.memory.lookForNewRampart = true;
                                            }

                                            if (creep.build(targets2) == ERR_NOT_IN_RANGE) {
                                                creep.travelTo(targets2);
                                            } else if (creep.build(targets2) == ERR_NO_BODYPART) {
                                                creep.suicide();
                                            }
                                        } else {
                                            //Upgrade
                                            if (creep.room.controller.level == 8) {
                                                //Check for nearby link and fill it if possible.
                                                if (Memory.linkList[creep.room.name].length > 1) {
                                                    var upgraderLink = Game.getObjectById(Memory.linkList[creep.room.name][1]);
                                                    if (upgraderLink && upgraderLink.energy < 200) {
                                                        creep.memory.structureTarget = upgraderLink.id;
                                                        if (creep.transfer(upgraderLink, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                                            creep.travelTo(upgraderLink, {
                                                                maxRooms: 1
                                                            });
                                                        }
                                                    } else {
                                                        //Turn into a repair worker temporarily
                                                        creep.memory.priority = 'repair';
                                                        creep.memory.previousPriority = 'mule';
                                                    }
                                                }
                                            } else {
                                                creep.memory.structureTarget = creep.room.controller.id;
                                                if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                                                    if (Game.flags[creep.room.name + "Controller"]) {
                                                        creep.travelTo(Game.flags[creep.room.name + "Controller"], {
                                                            maxRooms: 1
                                                        });
                                                    } else {
                                                        creep.travelTo(creep.room.controller, {
                                                            maxRooms: 1
                                                        });
                                                    }
                                                } else if (creep.upgradeController(creep.room.controller) == ERR_NO_BODYPART) {
                                                    creep.suicide();
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                break;
            case 'distributor':
            case 'distributorNearDeath':
                if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'distributorNearDeath') {
                    creep.memory.priority = 'distributorNearDeath';
                }

                if (_.sum(creep.carry) <= 0) {
                    if (creep.memory.previousPriority == 'labWorker' && creep.memory.hasDistributed){
                        creep.memory.priority = 'labWorker';
                        break;
                    }
                    //Get from storage
                    //Check 4th link first just in case
                    var linkTarget = undefined;
                    if (creep.memory.linkSource) {
                        linkTarget = Game.getObjectById(creep.memory.linkSource)
                    }
                    if (linkTarget && linkTarget.energy >= 200) {
                        if (creep.withdraw(linkTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(linkTarget, {
                                ignoreRoads: true
                            });
                        }
                    } else {
                        var storageTarget = creep.room.storage;
                        if (Memory.roomsUnderAttack.indexOf(creep.room.name) == -1 && creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 700000 && creep.room.terminal.store[RESOURCE_ENERGY] > 31000) {
                            storageTarget = creep.room.terminal;
                        }
                        if (storageTarget) {
                            if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(storageTarget, {
                                    ignoreRoads: true
                                });
                            }
                        }
                    }
                } else if (creep.room.energyAvailable < creep.room.energyCapacityAvailable) {
                    if (creep.memory.previousPriority == 'labWorker' && !creep.memory.hasDistributed){
                        creep.memory.hasDistributed = true;
                    }
                    var savedTarget = Game.getObjectById(creep.memory.structureTarget);
                    var getNewStructure = false;
                    if (savedTarget && savedTarget.energy < savedTarget.energyCapacity) {
                        if (creep.transfer(savedTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(savedTarget);
                        } else {
                            getNewStructure = true;
                            creep.memory.structureTarget = undefined;
                        }
                    } else if (savedTarget) {
                        getNewStructure = true;
                        creep.memory.structureTarget = undefined;
                    }
                    if (!creep.memory.structureTarget) {
                        var target = undefined;
                        if (getNewStructure) {
                            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                                filter: (structure) => {
                                    return (structure.structureType == STRUCTURE_EXTENSION ||
                                        structure.structureType == STRUCTURE_SPAWN) && structure.energy < structure.energyCapacity && structure.id != savedTarget.id;
                                }
                            });
                        } else {
                            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                                filter: (structure) => {
                                    return (structure.structureType == STRUCTURE_EXTENSION ||
                                        structure.structureType == STRUCTURE_SPAWN) && structure.energy < structure.energyCapacity;
                                }
                            });
                        }
                        if (!target) {
                            //Find closest by path will not return anything if path is blocked
                            if (getNewStructure) {
                            target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                                filter: (structure) => {
                                    return (structure.structureType == STRUCTURE_EXTENSION ||
                                        structure.structureType == STRUCTURE_SPAWN) && structure.energy < structure.energyCapacity && structure.id != savedTarget.id;
                                }
                                });
                            } else {
                                target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                                    filter: (structure) => {
                                        return (structure.structureType == STRUCTURE_EXTENSION ||
                                            structure.structureType == STRUCTURE_SPAWN) && structure.energy < structure.energyCapacity;
                                    }
                                });
                            }
                        }

                        if (target) {
                            if (getNewStructure) {
                                creep.travelTo(target);
                                creep.memory.structureTarget = target.id;
                            } else if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(target);
                                creep.memory.structureTarget = target.id;
                            }
                        }
                    }
                } else if (Memory.roomsUnderAttack.indexOf(creep.room.name) == -1 && creep.room.terminal && creep.room.storage && creep.room.storage.store[RESOURCE_ENERGY] < 700000 && creep.room.terminal.store[RESOURCE_ENERGY] > 31000) {
                    //Being supplied, drop in storage
                    if (creep.memory.previousPriority == 'labWorker' && !creep.memory.hasDistributed){
                        creep.memory.hasDistributed = true;
                    }
                    if (creep.transfer(creep.room.storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(creep.room.storage);
                    }
                } else if (creep.room.controller.level != 8 && Memory.linkList[creep.room.name].length > 1) {
                    if (creep.memory.previousPriority == 'labWorker' && !creep.memory.hasDistributed){
                        creep.memory.hasDistributed = true;
                    }
                    var upLink = Game.getObjectById(Memory.linkList[creep.room.name][1])
                    if (upLink) {
                        if (creep.transfer(upLink, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(upLink);
                        }
                    }
                } else if (_.sum(creep.carry) < creep.carryCapacity) {
                    if (creep.memory.previousPriority == 'labWorker' && !creep.memory.hasDistributed){
                        creep.memory.hasDistributed = true;
                    }
                    //Get from storage
                    //Check 4th link first just in case
                    var linkTarget = undefined;
                    if (creep.memory.linkSource) {
                        linkTarget = Game.getObjectById(creep.memory.linkSource)
                    }
                    if (linkTarget && linkTarget.energy >= 200) {
                        if (creep.withdraw(linkTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(linkTarget);
                        }
                    } else {
                        var storageTarget = creep.room.storage;
                        if (Memory.roomsUnderAttack.indexOf(creep.room.name) == -1 && creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 700000 && creep.room.terminal.store[RESOURCE_ENERGY] > 31000) {
                            storageTarget = creep.room.terminal;
                        }
                        if (storageTarget) {
                            if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(storageTarget);
                            }
                        }
                    }
                } else {
                    if (creep.memory.previousPriority == 'labWorker' && !creep.memory.hasDistributed){
                        creep.memory.hasDistributed = true;
                    }
                    var homeSpawn = Game.getObjectById(creep.memory.fromSpawn)
                    if (homeSpawn) {
                        if (!creep.pos.isNearTo(homeSpawn)) {
                            creep.travelTo(homeSpawn);
                        } else {
                            //Make sure you're not in the way
                            let talkingCreeps = creep.pos.findInRange(FIND_MY_CREEPS, 1, {
                                filter: (thisCreep) => (creep.id != thisCreep.id && thisCreep.saying)
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
                    }
                }
                break;
            case 'mineralMiner':
                var thisMineral = Game.getObjectById(creep.memory.mineralID);
                if (!creep.memory.nextMine) {
                    creep.memory.nextMine = Game.time + 6;
                }

                if (thisMineral.mineralAmount == 0 && _.sum(creep.carry) == 0) {
                    //Nothing left to do
                    creep.suicide();
                } else {
                	let triedTravel = false;
                	let storageTarget = creep.room.terminal;
                	if (storageTarget && _.sum(creep.carry) > (creep.carryCapacity - creep.getActiveBodyparts(WORK))) {
                        if (creep.transfer(storageTarget, thisMineral.mineralType) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(storageTarget);
                            triedTravel = true;
                        }
                    } 

                    if (Game.time >= creep.memory.nextMine) {
                    	let harvestResult = creep.harvest(thisMineral);
						if (harvestResult == ERR_NOT_IN_RANGE && !triedTravel) {
                            creep.travelTo(thisMineral);
                        } else if (harvestResult == OK) {
                            creep.memory.nextMine = Game.time + 6;
                        }
                    }                          
                }
                break;
        }
    }
};

module.exports = creep_work5;

function repairCompare(a, b) {
    if (a.hits < b.hits)
        return -1;
    if (a.hits > b.hits)
        return 1;
    return 0;
}

function orderPriceCompareBuying(a, b) {
    if (a.price < b.price)
        return -1;
    if (a.price > b.price)
        return 1;
    return 0;
}