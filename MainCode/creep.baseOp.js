var creep_baseOp = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (!creep.memory.initialSetup) {
            setupCreepMemory(creep);
        }
        //Resource generation
        var totalOps = creep.carry[RESOURCE_OPS];
        if (!totalOps) {
            totalOps = 0;
        }
        if (totalOps < 600 && creep.memory.cooldowns.GENERATE_OPS <= Game.time) {
            if (creep.usePower(PWR_GENERATE_OPS) == OK) {
                creep.memory.cooldowns.GENERATE_OPS = Game.time + 50;
                totalOps = totalOps + 6;
            }
        }

        //Note - Empowered sources generate 7,000 per 300 ticks (lvl 4)

        //LIMITED ACTIONS (Due to Ops expenses)
        //When under attack - OPERATE_TOWER/OPERATE_SPAWN
        //When RunningAssault flag exists - OPERATE_SPAWN
        //if creep.memory.cooldowns.OPERATE_SPAWN <= Game.time && totalOps >= 100 && checkForSpawnNeed(creep)

        if (!creep.memory.jobFocus) {
            //Try to find work that needs doing
            creep.memory.jobFocus = findNeededWork(creep, totalOps);
            if (creep.memory.jobFocus) {
                creep.memory.structureTarget = undefined;
            }
        }

        //Main work loop
        //Should change to focus on a job until it's done (Exception : Keeping creep alive)
        if (creep.ticksToLive <= 100 && Memory.powerSpawnList[creep.room.name]) {
            var powerSpawnTarget = Game.getObjectById(Memory.powerSpawnList[creep.room.name][0]);
            if (powerSpawnTarget) {
                var renewResult = creep.renew(powerSpawnTarget);
                if (renewResult == ERR_NOT_IN_RANGE) {
                    creep.travelTo(powerSpawnTarget, {
                        ignoreRoads: true,
                        maxRooms: 1
                    });
                }
            }
        } else if (creep.memory.jobFocus == 'OPERATE_EXTENSION') {
            var useResult = creep.usePower(PWR_OPERATE_EXTENSION, creep.room.storage);
            if (useResult == ERR_NOT_IN_RANGE) {
                creep.travelTo(creep.room.storage, {
                    range: 3,
                    ignoreRoads: true,
                    maxRooms: 1
                });
            } else if (useResult == OK) {
                creep.memory.cooldowns.OPERATE_EXTENSION = Game.time + 50;
                totalOps = totalOps - 2;
                creep.memory.jobFocus = undefined;
            }
        } else if (creep.memory.jobFocus == 'REGEN_SOURCE') {
            var targetSource;
            if (creep.memory.empoweredSources[0] <= Game.time) {
                targetSource = Game.getObjectById(creep.memory.sources[0]);
            } else {
                targetSource = Game.getObjectById(creep.memory.sources[1]);
            }

            var useResult = creep.usePower(PWR_REGEN_SOURCE, targetSource);
            if (useResult == ERR_NOT_IN_RANGE) {
                creep.travelTo(targetSource, {
                    range: 3,
                    ignoreRoads: true,
                    maxRooms: 1
                });
            } else if (useResult == OK) {
                creep.memory.cooldowns.REGEN_SOURCE = Game.time + 100;
                if (targetSource.id == creep.memory.sources[0]) {
                    creep.memory.empoweredSources[0] = Game.time + 300;
                } else {
                    creep.memory.empoweredSources[1] = Game.time + 300;
                }
                creep.memory.jobFocus = undefined;
            }
        } else if (creep.memory.jobFocus == 'OPERATE_LAB') {
            var targetLab = getNeededLab(creep);
            //Creep will do nothing if lab is undefined, add handling?
            if (targetLab) {
                var useResult = creep.usePower(PWR_OPERATE_LAB, targetLab);
                if (useResult == ERR_NOT_IN_RANGE) {
                    creep.travelTo(targetLab, {
                        range: 3,
                        ignoreRoads: true,
                        maxRooms: 1
                    });
                } else if (useResult == OK) {
                    creep.memory.cooldowns.OPERATE_LAB = Game.time + 50;
                    updateLabBoost(creep);
                    creep.memory.jobFocus = undefined;
                }
            }
        } else if (creep.memory.jobFocus == 'FILL_SPAWNS') {
            //Power only fills extentions, fill spawns.
            if (!creep.carry[RESOURCE_ENERGY]) {
                let neededAmount = 2000 - creep.carry[RESOURCE_ENERGY];
                if (creep.carry[RESOURCE_OPS]) {
                    neededAmount = (creep.carryCapacity - creep.carry[RESOURCE_OPS]) - creep.carry[RESOURCE_ENERGY] - 6;
                }
                creep.memory.structureTarget = undefined;
                //Get from storage
                //Check overflow link first
                var linkTarget = undefined;
                if (creep.memory.linkSource) {
                    linkTarget = Game.getObjectById(creep.memory.linkSource)
                }
                if (linkTarget && linkTarget.energy >= 400) {
                    if (creep.withdraw(linkTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(linkTarget, {
                            ignoreRoads: true,
                            maxRooms: 1
                        });
                    }
                } else {
                    var storageTarget = creep.room.storage;
                    if (creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 250000 && creep.room.terminal.store[RESOURCE_ENERGY] > 33000) {
                        storageTarget = creep.room.terminal;
                    }
                    if (storageTarget) {
                        let withdrawResult = creep.withdraw(storageTarget, RESOURCE_ENERGY, neededAmount)
                        if (withdrawResult == ERR_NOT_IN_RANGE) {
                            creep.travelTo(storageTarget, {
                                ignoreRoads: true,
                                maxRooms: 1
                            });
                        } else if (withdrawResult == ERR_NOT_ENOUGH_RESOURCES) {
                            creep.withdraw(storageTarget, RESOURCE_ENERGY)
                        }
                    }
                }
            } else {
                let savedTarget = Game.getObjectById(creep.memory.structureTarget);
                var getNewStructure = false;
                if (savedTarget && savedTarget.energy < savedTarget.energyCapacity) {
                    if (creep.transfer(savedTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(savedTarget, {
                            ignoreRoads: true,
                            maxRooms: 1
                        });
                    } else {
                        creep.memory.jobFocus = undefined;
                        creep.memory.structureTarget = undefined;
                    }
                } else {
                    creep.memory.structureTarget = undefined;
                }
                if (!creep.memory.structureTarget) {
                    var target = undefined;
                    target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                        filter: (structure) => {
                            return (structure.structureType == STRUCTURE_SPAWN || structure.structureType == STRUCTURE_LAB) && structure.energy < structure.energyCapacity;
                        }
                    });

                    if (!target) {
                        //Find closest by path will not return anything if path is blocked
                        target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                            filter: (structure) => {
                                return (structure.structureType == STRUCTURE_SPAWN || structure.structureType == STRUCTURE_LAB) && structure.energy < structure.energyCapacity;
                            }
                        });
                    }

                    if (target) {
                        if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(target, {
                                ignoreRoads: true,
                                maxRooms: 1
                            });
                            creep.memory.structureTarget = target.id;
                        } else {
                            //OK
                            creep.memory.jobFocus = undefined;
                            creep.memory.structureTarget = undefined;
                        }
                    } else {
                        creep.memory.jobFocus = undefined;
                        creep.memory.structureTarget = undefined;
                    }
                }
            }
        } else if (creep.memory.jobFocus == 'FILL_POWER') {
            if (!creep.carry[RESOURCE_POWER] && creep.withdraw(creep.room.storage, RESOURCE_POWER, 100) == ERR_NOT_IN_RANGE) {
                creep.travelTo(creep.room.storage, {
                    ignoreRoads: true,
                    maxRooms: 1
                });
            } else {
                var pSpawn = Game.getObjectById(Memory.powerSpawnList[creep.room.name][0]);
                if (pSpawn) {
                    var transferResult = creep.transfer(pSpawn, RESOURCE_POWER);
                    if (transferResult == ERR_NOT_IN_RANGE) {
                        creep.travelTo(pSpawn, {
                            maxRooms: 1,
                            ignoreRoads: true
                        });
                    } else if (transferResult == OK) {
                        creep.memory.jobFocus = undefined;
                        creep.memory.structureTarget = undefined;
                    }
                } else {
                    creep.memory.jobFocus = undefined;
                    creep.memory.structureTarget = undefined;
                }
            }
        } else {
            //Busywork
            if (!creep.carry[RESOURCE_ENERGY]) {
                var linkTarget = undefined;
                creep.memory.structureTarget = undefined;

                let neededAmount = 2000 - creep.carry[RESOURCE_ENERGY];
                if (creep.carry[RESOURCE_OPS]) {
                    neededAmount = (creep.carryCapacity - creep.carry[RESOURCE_OPS]) - creep.carry[RESOURCE_ENERGY] - 6;
                }

                if (creep.memory.linkSource) {
                    linkTarget = Game.getObjectById(creep.memory.linkSource)
                }
                if (linkTarget && linkTarget.energy >= 400) {
                    if (creep.withdraw(linkTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(linkTarget, {
                            ignoreRoads: true,
                            maxRooms: 1
                        });
                    }
                } else {
                    var storageTarget = creep.room.storage;
                    if (creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 250000 && creep.room.terminal.store[RESOURCE_ENERGY] > 33000) {
                        storageTarget = creep.room.terminal;
                    }
                    if (storageTarget) {
                        let withdrawResult = creep.withdraw(storageTarget, RESOURCE_ENERGY, neededAmount)
                        if (withdrawResult == ERR_NOT_IN_RANGE) {
                            creep.travelTo(storageTarget, {
                                ignoreRoads: true,
                                maxRooms: 1
                            });
                        } else if (withdrawResult == ERR_NOT_ENOUGH_RESOURCES) {
                            creep.withdraw(storageTarget, RESOURCE_ENERGY)
                        }
                    }
                }
            } else {
                //Saved Target
                if (creep.memory.structureTarget) {
                    var thisTarget = Game.getObjectById(creep.memory.structureTarget);
                    if (thisTarget) {
                        let tResult = creep.transfer(thisTarget, RESOURCE_ENERGY)
                        if (tResult == ERR_NOT_IN_RANGE) {
                            creep.travelTo(thisTarget, {
                                ignoreRoads: true,
                                maxRooms: 1
                            });
                        } else if (tResult == OK) {
                            creep.memory.structureTarget = undefined;
                        }
                    } else {
                        creep.memory.structureTarget = undefined;
                    }
                } else {
                    //Terminal
                    let foundWork = false;
                    if (creep.room.terminal) {
                        let targetEnergy = 0;
                        if (creep.room.storage) {
                            if (creep.room.storage.store[RESOURCE_ENERGY] >= 275000) {
                                targetEnergy = 60000;
                            } else if (creep.room.storage.store[RESOURCE_ENERGY] >= 50000) {
                                targetEnergy = 30000;
                            }
                        }
                        if (creep.room.terminal.store[RESOURCE_ENERGY] < targetEnergy && (creep.room.terminal.storeCapacity - 5000) > _.sum(creep.room.terminal.store)) {
                            foundWork = true;
                            creep.memory.structureTarget = creep.room.terminal.id;
                            if (creep.transfer(creep.room.terminal, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(creep.room.terminal, {
                                    ignoreRoads: true,
                                    maxRooms: 1
                                });
                            }
                        }
                    }
                    //PowerSpawn/Nuker
                    if (!foundWork && creep.room.controller.level == 8) {
                        var target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                            filter: (structure) => {
                                return (structure.structureType == STRUCTURE_POWER_SPAWN ||
                                    structure.structureType == STRUCTURE_NUKER) && structure.energy < structure.energyCapacity;
                            }
                        });
                        if (target) {
                            foundWork = true;
                            creep.memory.structureTarget = target.id;
                            if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(target, {
                                    ignoreRoads: true,
                                    maxRooms: 1
                                });
                            } else {
                                creep.memory.structureTarget = undefined;
                            }
                        }
                    }

                    //Link is checked first, so if overflow is filled then there's energy to be moved.
                    if (!foundWork && creep.room.storage && creep.transfer(creep.room.storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        var linkTarget = undefined;
                        if (creep.memory.linkSource) {
                            linkTarget = Game.getObjectById(creep.memory.linkSource)
                        }
                        if (linkTarget && linkTarget.energy >= 400 && creep.transfer(creep.room.storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.memory.structureTarget = creep.room.storage.id;
                            creep.travelTo(creep.room.storage, {
                                ignoreRoads: true,
                                maxRooms: 1
                            });
                        }
                    }
                }

            }
        }

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

        if (creep.room.controller && !creep.room.controller.isPowerEnabled) {
            if (creep.enableRoom(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.travelTo(creep.room.controller, {
                    ignoreRoads: true,
                    maxRooms: 1
                })
            }
        }
    }
};

function setupCreepMemory(creep) {
    var cooldownObject = {};
    cooldownObject.GENERATE_OPS = Game.time;
    cooldownObject.OPERATE_SPAWN = Game.time;
    cooldownObject.OPERATE_TOWER = Game.time;
    cooldownObject.OPERATE_LAB = Game.time;
    cooldownObject.OPERATE_EXTENSION = Game.time;
    cooldownObject.REGEN_SOURCE = Game.time;
    creep.memory.cooldowns = cooldownObject;

    creep.memory.sources = Memory.sourceList[creep.room.name];
    creep.memory.empoweredSources = [Game.time, Game.time];

    creep.memory.spawnList = [];
    creep.memory.empoweredSpawns = [];
    var roomSpawns = creep.room.find(FIND_MY_STRUCTURES, {
        filter: {
            structureType: STRUCTURE_SPAWN
        }
    });
    for (var thisSpawn in roomSpawns) {
        creep.memory.spawnList.push(roomSpawns[thisSpawn].id);
        creep.memory.empoweredSpawns.push(Game.time);
    }

    //Can ignore first 3 labs, never set to run reactions
    creep.memory.empoweredLabs = [Game.time, Game.time, Game.time, Game.time, Game.time]

    if (!Game.flags[creep.room.name + "RoomOperator"]) {
        Game.rooms[creep.room.name].createFlag(46, 2, creep.room.name + "RoomOperator");
    }

    if (Memory.linkList[creep.room.name].length >= 4) {
        creep.memory.linkSource = Memory.linkList[creep.room.name][3];
    }

    creep.memory.jobFocus = undefined;

    creep.memory.initialSetup = true;
}

function findNeededWork(creep, totalOps) {
    if (creep.memory.cooldowns.OPERATE_EXTENSION <= Game.time && totalOps >= 2 && creep.room.storage && creep.room.energyAvailable < creep.room.energyCapacityAvailable) {
        return 'OPERATE_EXTENSION';
    } else if (creep.memory.cooldowns.REGEN_SOURCE <= Game.time && (creep.memory.empoweredSources[0] - 15 <= Game.time || creep.memory.empoweredSources[1] - 15 <= Game.time)) {
        return 'REGEN_SOURCE';
    } else if (!Game.flags[creep.room.name + "WarBoosts"] && creep.memory.cooldowns.OPERATE_LAB <= Game.time && totalOps >= 10 && checkForLabNeed(creep)) {
        return 'OPERATE_LAB';
    } else if (creep.room.energyAvailable < creep.room.energyCapacityAvailable) {
        return 'FILL_SPAWNS';
    }

    if (creep.room.storage.store[RESOURCE_POWER] && creep.room.storage.store[RESOURCE_POWER] >= 100 && Memory.powerSpawnList[creep.room.name]) {
        var powerSpawnTarget = Game.getObjectById(Memory.powerSpawnList[creep.room.name][0]);
        if (powerSpawnTarget && powerSpawnTarget.power == 0) {
            return 'FILL_POWER';
        }
    }
    return undefined;
}

function checkForLabNeed(creep) {
    for (var thisLab in creep.memory.empoweredLabs) {
        if (creep.memory.empoweredLabs[thisLab] <= Game.time) {
            return true;
        }
    }
    return false;
}

function getNeededLab(creep) {
    var labIndex = 5;
    for (var thisLab in creep.memory.empoweredLabs) {
        if (creep.memory.empoweredLabs[thisLab] <= Game.time) {
            var thisLab = Game.getObjectById(Memory.labList[creep.room.name][labIndex]);
            if (thisLab) {
                return thisLab;
            }
        }
        labIndex++;
    }
    return undefined;
}

function updateLabBoost(creep) {
    for (var thisLab in creep.memory.empoweredLabs) {
        if (creep.memory.empoweredLabs[thisLab] <= Game.time) {
            creep.memory.empoweredLabs[thisLab] = Game.time + 1000;
            break;
        }
    }
}

function checkForSpawnNeed(creep) {
    for (var thisSpawnCD in creep.memory.empoweredSpawns) {
        if (creep.memory.empoweredSpawns[thisSpawnCD] <= Game.time) {
            return true;
        }
    }
    return false;
}

module.exports = creep_baseOp;