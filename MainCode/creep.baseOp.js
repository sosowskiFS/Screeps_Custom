var creep_baseOp = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (!creep.memory.initialSetup) {
            setupCreepMemory(creep);
        }
        //Resource generation
        var totalOps = creep.carry[RESOURCE_OPS];
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

        //Main work loop
        //Focus on one action at a time for now, implement multiple later
        //Keep creep alive (Better than resetting ops)
        if (creep.ticksToLive <= 100 && Memory.powerSpawnList[creep.room.name]) {
            var powerSpawnTarget = Game.getObjectById(Memory.powerSpawnList[creep.room.name][0]);
            if (powerSpawnTarget) {
                var renewResult = creep.renew(powerSpawnTarget);
                if (renewResult == ERR_NOT_IN_RANGE) {
                    creep.travelTo(powerSpawnTarget);
                }
            }
        } else if (creep.memory.cooldowns.OPERATE_EXTENSION <= Game.time && totalOps >= 2 && creep.room.storage && creep.room.energyAvailable < creep.room.energyCapacityAvailable) {
            var useResult = creep.usePower(PWR_OPERATE_EXTENSION, creep.room.storage);
            if (useResult == ERR_NOT_IN_RANGE) {
                creep.travelTo(creep.room.storage, {
                    range: 3
                });
            } else if (useResult == OK) {
                creep.memory.cooldowns.OPERATE_EXTENSION = Game.time + 50;
                totalOps = totalOps - 2;
            }
        } else if (creep.memory.cooldowns.REGEN_SOURCE <= Game.time && (creep.memory.empoweredSources[0] <= Game.time || creep.memory.empoweredSources[1] <= Game.time)) {
            var targetSource;
            if (creep.memory.empoweredSources[0] <= Game.time) {
                targetSource = Game.getObjectById(creep.memory.sources[0]);
            } else {
                targetSource = Game.getObjectById(creep.memory.sources[1]);
            }

            var useResult = creep.usePower(PWR_REGEN_SOURCE, targetSource);
            if (useResult == ERR_NOT_IN_RANGE) {
                creep.travelTo(targetSource, {
                    range: 3
                });
            } else if (useResult == OK) {
                creep.memory.cooldowns.REGEN_SOURCE = Game.time + 100;
                if (targetSource.id == creep.memory.sources[0]) {
                    creep.memory.empoweredSources[0] = Game.time + 300;
                } else {
                    creep.memory.empoweredSources[1] = Game.time + 300;
                }
            }
        } else if (!Game.flags[creep.room.name + "WarBoosts"] && creep.memory.cooldowns.OPERATE_LAB <= Game.time && totalOps >= 10 && checkForLabNeed(creep)) {
            var targetLab = getNeededLab(creep);
            //Creep will do nothing if lab is undefined, add handling?
            if (targetLab) {
                var useResult = creep.usePower(PWR_OPERATE_LAB, targetLab);
                if (useResult == ERR_NOT_IN_RANGE) {
                    creep.travelTo(targetLab, {
                        range: 3
                    });
                } else if (useResult == OK) {
                    creep.memory.cooldowns.OPERATE_LAB = Game.time + 50;
                    updateLabBoost(creep);
                }
            }
        } else if (creep.room.energyAvailable < creep.room.energyCapacityAvailable) {
            //Power only fills extentions, fill spawns.
            if (creep.carry[RESOURCE_ENERGY] <= 900) {
                let neededAmount = 2000 - creep.carry[RESOURCE_ENERGY];
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
                            ignoreRoads: true
                        });
                    }
                } else {
                    var storageTarget = creep.room.storage;
                    if (creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 250000 && creep.room.terminal.store[RESOURCE_ENERGY] > 31000) {
                        storageTarget = creep.room.terminal;
                    }
                    if (storageTarget) {
                        let withdrawResult = creep.withdraw(storageTarget, RESOURCE_ENERGY, neededAmount)
                        if (withdrawResult == ERR_NOT_IN_RANGE) {
                            creep.travelTo(storageTarget, {
                                ignoreRoads: true
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
                        creep.travelTo(savedTarget);
                    } else {
                        getNewStructure = true;
                        creep.memory.structureTarget = undefined;
                    }
                }
                if (!creep.memory.structureTarget) {
                    var target = undefined;
                    if (getNewStructure) {
                        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                            filter: (structure) => {
                                return (structure.structureType == STRUCTURE_SPAWN) && structure.energy < structure.energyCapacity && structure.id != savedTarget.id;
                            }
                        });
                    } else {
                        target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                            filter: (structure) => {
                                return (structure.structureType == STRUCTURE_SPAWN) && structure.energy < structure.energyCapacity;
                            }
                        });
                    }
                    if (!target) {
                        //Find closest by path will not return anything if path is blocked
                        if (getNewStructure) {
                            target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                                filter: (structure) => {
                                    return (structure.structureType == STRUCTURE_SPAWN) && structure.energy < structure.energyCapacity && structure.id != savedTarget.id;
                                }
                            });
                        } else {
                            target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                                filter: (structure) => {
                                    return (structure.structureType == STRUCTURE_SPAWN) && structure.energy < structure.energyCapacity;
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
            }
        } else {
            //Busywork - dump overflow link into storage
            if (creep.carry[RESOURCE_ENERGY] <= 1200) {
                var linkTarget = undefined;
                if (creep.memory.linkSource) {
                    linkTarget = Game.getObjectById(creep.memory.linkSource)
                }
                if (linkTarget && linkTarget.energy >= 400) {
                    if (creep.withdraw(linkTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(linkTarget, {
                            ignoreRoads: true
                        });
                    }
                }
            } else if (creep.room.storage && creep.transfer(creep.room.storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                creep.travelTo(savedTarget);
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
    creep.memory.empoweredLabs = [Game.time, Game.time, Game.time, Game.time, Game.time, Game.time, Game.time]

    if (!Game.flags[creep.room.name + "RoomOperator"]) {
        Game.rooms[creep.room.name].createFlag(47, 2, creep.room.name + "RoomOperator");
    }

    if (Memory.linkList[creep.room.name].length >= 4) {
        creep.memory.linkSource = Memory.linkList[creep.room.name][3];
    }

    creep.memory.initialSetup = true;
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
    var labIndex = 3;
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