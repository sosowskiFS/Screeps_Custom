var creep_baseOp = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (!creep.memory.initialSetup || Game.time % 10000 == 0) {
            setupCreepMemory(creep);
        }
        //Resource generation
        let totalOps = creep.carry[RESOURCE_OPS];
        if (!totalOps) {
            totalOps = 0;
        }
        if (totalOps < 600 && creep.powers[PWR_GENERATE_OPS] && creep.powers[PWR_GENERATE_OPS].cooldown <= 0) {
            if (creep.usePower(PWR_GENERATE_OPS) == OK) {
                totalOps = totalOps + 6;
            }
        }

        //Note - Empowered sources generate 7,000 per 300 ticks (lvl 4)

        //LIMITED ACTIONS (Due to Ops expenses)
        //When under attack - OPERATE_TOWER/OPERATE_SPAWN
        //When RunningAssault flag exists - OPERATE_SPAWN

        if (!creep.memory.jobFocus) {
            //Try to find work that needs doing
            creep.memory.jobFocus = findNeededWork(creep, totalOps);
            if (creep.memory.jobFocus) {
                creep.memory.structureTarget = undefined;
            }
        }

        //Main work loop
        //Should change to focus on a job until it's done (Exception : Keeping creep alive)
        if (creep.ticksToLive <= 250 && Memory.powerSpawnList[creep.room.name]) {
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
                    range: 2,
                    ignoreRoads: true,
                    maxRooms: 1
                });
            } else if (useResult == OK) {
                totalOps = totalOps - 2;
                creep.memory.jobFocus = undefined;
            }
        } else if (creep.memory.jobFocus == 'OPERATE_SPAWN') {
            var targetSpawn = getNeededSpawn(creep);
            if (targetSpawn) {
                var useResult = creep.usePower(PWR_OPERATE_SPAWN, targetSpawn);
                if (useResult == ERR_NOT_IN_RANGE) {
                    creep.travelTo(targetSpawn, {
                        range: 2,
                        ignoreRoads: true,
                        maxRooms: 1
                    });
                } else if (useResult == OK) {
                    creep.memory.jobFocus = undefined;
                }
            } else {
                creep.memory.jobFocus = undefined;
            }
        } else if (creep.memory.jobFocus == 'OPERATE_TOWER') {
            var targetTower = getNeededTower(creep);
            if (targetTower) {
                var useResult = creep.usePower(PWR_OPERATE_TOWER, targetTower);
                if (useResult == ERR_NOT_IN_RANGE) {
                    creep.travelTo(targetTower, {
                        range: 2,
                        ignoreRoads: true,
                        maxRooms: 1
                    });
                } else if (useResult == OK) {
                    creep.memory.jobFocus = undefined;
                }
            } else {
                creep.memory.jobFocus = undefined;
            }
        } else if (creep.memory.jobFocus == 'REGEN_SOURCE') {
            var targetSource = getNeededSource(creep);
            var useResult = creep.usePower(PWR_REGEN_SOURCE, targetSource);
            if (useResult == ERR_NOT_IN_RANGE) {
                creep.travelTo(targetSource, {
                    range: 2,
                    ignoreRoads: true,
                    maxRooms: 1
                });
            } else if (useResult == OK) {
                creep.memory.jobFocus = undefined;
            }
        } else if (creep.memory.jobFocus == 'OPERATE_LAB') {
            var targetLab = getNeededLab(creep);
            if (targetLab) {
                var useResult = creep.usePower(PWR_OPERATE_LAB, targetLab);
                if (useResult == ERR_NOT_IN_RANGE) {
                    creep.travelTo(targetLab, {
                        range: 2,
                        ignoreRoads: true,
                        maxRooms: 1
                    });
                } else if (useResult == OK) {
                    creep.memory.jobFocus = undefined;
                }
            } else {
                creep.memory.jobFocus = undefined;
            }
        } else if (creep.memory.jobFocus == 'FILL_SPAWNS') {
            //Power only fills extentions, fill spawns.
            let checkValue = creep.room.energyCapacityAvailable - creep.room.energyAvailable;
            if (checkValue > 900) {
                checkValue = 900;
            }
            if (creep.carry[RESOURCE_ENERGY] < checkValue) {
                let neededAmount = creep.carryCapacity - (_.sum(creep.carry) + 6);
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
                    if (creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 100000 && creep.room.terminal.store[RESOURCE_ENERGY] > 0) {
                        storageTarget = creep.room.terminal;
                    } else if (creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 250000 && creep.room.terminal.store[RESOURCE_ENERGY] > 31000) {
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
                            return (structure.structureType == STRUCTURE_SPAWN) && structure.energy < structure.energyCapacity;
                        }
                    });

                    if (!target) {
                        //Find closest by path will not return anything if path is blocked
                        target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                            filter: (structure) => {
                                return (structure.structureType == STRUCTURE_SPAWN) && structure.energy < structure.energyCapacity;
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
            if (!creep.carry[RESOURCE_POWER]) {
                let withdrawResult = creep.withdraw(creep.room.storage, RESOURCE_POWER, 100);
                if (withdrawResult == ERR_NOT_IN_RANGE) {
                    creep.travelTo(creep.room.storage, {
                        ignoreRoads: true,
                        maxRooms: 1
                    });
                } else if (withdrawResult == ERR_FULL) {
                    //Shouldn't have gotten here in the first place
                    creep.memory.jobFocus = undefined;
                    creep.memory.structureTarget = undefined;
                }
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

                let neededAmount = creep.carryCapacity - (_.sum(creep.carry) + 6);

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
                    if (creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 100000 && creep.room.terminal.store[RESOURCE_ENERGY] > 0) {
                        storageTarget = creep.room.terminal;
                    } else if (creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 250000 && creep.room.terminal.store[RESOURCE_ENERGY] > 31000) {
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
                        if (creep.room.terminal.store[RESOURCE_ENERGY] < targetEnergy && creep.room.terminal.store.getFreeCapacity() > 5000) {
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
                    //Labs
                    if (!foundWork) {
                        let target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                            filter: (structure) => {
                                return (structure.structureType == STRUCTURE_LAB) && structure.energy < structure.energyCapacity;
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
                    //Factory
                    if (!foundWork) {
                        let target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                            filter: (structure) => {
                                return (structure.structureType == STRUCTURE_FACTORY) && structure.store[RESOURCE_ENERGY] < 10000;
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
                    //PowerSpawn/Nuker
                    if (!foundWork && creep.room.controller.level == 8) {
                        let target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
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

        if (Memory.roomsUnderAttack.indexOf(creep.room.name) != -1) {
            //Stay away from hostiles
            Foe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 4, {
                filter: (eCreep) => ((eCreep.getActiveBodyparts(ATTACK) > 0 || eCreep.getActiveBodyparts(RANGED_ATTACK) > 0) && !Memory.whiteList.includes(eCreep.owner.username))
            });

            if (Foe.length) {
                closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
                    filter: (eCreep) => ((eCreep.getActiveBodyparts(ATTACK) > 0 || eCreep.getActiveBodyparts(RANGED_ATTACK) > 0) && !Memory.whiteList.includes(eCreep.owner.username))
                });

                if (Memory.powerSpawnList[creep.room.name]) {
                    var powerSpawnTarget = Game.getObjectById(Memory.powerSpawnList[creep.room.name][0]);
                    if (powerSpawnTarget) {
                        creep.travelTo(powerSpawnTarget, {
                            ignoreRoads: true,
                            maxRooms: 1
                        });
                    } else {
                        creep.travelTo(closeFoe, {
                            ignoreRoads: true,
                            range: 8,
                            maxRooms: 1
                        }, true);
                    }
                } else {
                    creep.travelTo(closeFoe, {
                        ignoreRoads: true,
                        range: 8,
                        maxRooms: 1
                    }, true);
                }
            }
        }
    }
};

function setupCreepMemory(creep) {
    if (!creep.memory.spawnList || Game.time % 10000 == 0) {
        creep.memory.spawnList = [];
        var roomSpawns = creep.room.find(FIND_MY_STRUCTURES, {
            filter: {
                structureType: STRUCTURE_SPAWN
            }
        });
        for (var thisSpawn in roomSpawns) {
            creep.memory.spawnList.push(roomSpawns[thisSpawn].id);
        }
    }

    if (!creep.memory.towerList || Game.time % 10000 == 0) {
        creep.memory.towerList = [];
        var roomTowers = creep.room.find(FIND_MY_STRUCTURES, {
            filter: {
                structureType: STRUCTURE_TOWER
            }
        });
        for (var thisTower in roomTowers) {
            creep.memory.towerList.push(roomTowers[thisTower].id);
        }
    }

    if (!Game.flags[creep.room.name + "RoomOperator"]) {
        Game.rooms[creep.room.name].createFlag(46, 2, creep.room.name + "RoomOperator");
    }

    if (Memory.linkList[creep.room.name].length >= 4 || (Game.time % 10000 == 0 && Memory.linkList[creep.room.name].length >= 4)) {
        creep.memory.linkSource = Memory.linkList[creep.room.name][3];
    }

    if (!creep.memory.homeRoom) {
        creep.memory.homeRoom = creep.pos.roomName;
    }

    //Cleanup for removed memory
    /*if (creep.memory.cooldowns) {
        creep.memory.cooldowns = undefined;
    }
    if (creep.memory.sources) {
        creep.memory.sources = undefined;
    }
    if (creep.memory.empoweredSources) {
        creep.memory.empoweredSources = undefined;
    }
    if (creep.memory.empoweredSpawns) {
        creep.memory.empoweredSpawns = undefined;
    }
    if (creep.memory.empoweredLabs) {
        creep.memory.empoweredLabs = undefined;
    }
    if (creep.memory.empoweredTowers) {
        creep.memory.empoweredTowers = undefined;
    }
    */

    creep.memory.jobFocus = undefined;

    creep.memory.initialSetup = true;
}

function findNeededWork(creep, totalOps) {

    if (creep.powers[PWR_OPERATE_EXTENSION] && creep.powers[PWR_OPERATE_EXTENSION].cooldown <= 0 && totalOps >= POWER_INFO[PWR_OPERATE_EXTENSION].ops  && creep.room.storage && creep.room.energyAvailable < (creep.room.energyCapacityAvailable - 900)) {
        return 'OPERATE_EXTENSION';
    } else if (creep.powers[PWR_OPERATE_SPAWN] && (Game.flags[creep.room.name + "RunningAssault"] || totalOps >= 600) && totalOps >= 100 && creep.powers[PWR_OPERATE_SPAWN].cooldown <= 0 && getNeededSpawn(creep)) {
        return 'OPERATE_SPAWN';
    } else if (creep.powers[PWR_OPERATE_TOWER] && Memory.roomsUnderAttack.indexOf(creep.room.name) != -1 && Memory.roomsPrepSalvager.indexOf(creep.room.name) == -1 && creep.powers[PWR_OPERATE_TOWER].cooldown <= 0 && totalOps >= POWER_INFO[PWR_OPERATE_TOWER].ops && getNeededTower(creep)) {
        return 'OPERATE_TOWER'
    } else if (creep.powers[PWR_REGEN_SOURCE] && creep.powers[PWR_REGEN_SOURCE].cooldown <= 0 && getNeededSource(creep)) {
        return 'REGEN_SOURCE';
    } else if (creep.powers[PWR_OPERATE_LAB] && totalOps >= POWER_INFO[PWR_OPERATE_LAB].ops && !Game.flags[creep.room.name + "WarBoosts"] && creep.powers[PWR_OPERATE_LAB].cooldown <= 0 && getNeededLab(creep)) {
        return 'OPERATE_LAB';
    } else if (creep.room.energyAvailable < creep.room.energyCapacityAvailable) {
        return 'FILL_SPAWNS';
    }

    if (creep.room.storage.store[RESOURCE_POWER] && creep.room.storage.store[RESOURCE_POWER] >= 100 && Memory.powerSpawnList[creep.room.name] && _.sum(creep.carry) <= creep.carryCapacity - 100) {
        var powerSpawnTarget = Game.getObjectById(Memory.powerSpawnList[creep.room.name][0]);
        if (powerSpawnTarget && powerSpawnTarget.power == 0) {
            return 'FILL_POWER';
        }
    }
    return undefined;
}

function getNeededSource(creep) {
    for (let sourceID in Memory.sourceList[creep.room.name]) {
        let thisSource = Game.getObjectById(Memory.sourceList[creep.room.name][sourceID])
        if (thisSource && thisSource.effects) {
            let foundPower = false;
            for (let thisPower in thisSource.effects) {
                if (thisSource.effects[thisPower].effect == PWR_REGEN_SOURCE && thisSource.effects[thisPower].ticksRemaining > 15) {
                    //No Need
                    foundPower = true;
                }
            }
            if (!foundPower) {
                return thisSource;
            }
        } else if (thisSource && !thisSource.effects) {
            return thisSource;
        }
    }
    return undefined;
}

function getNeededTower(creep) {
    for (let towerID in creep.memory.towerList) {
        let thisTower = Game.getObjectById(creep.memory.towerList[towerID])
        if (thisTower && thisTower.effects) {
            let foundPower = false;
            for (let thisPower in thisTower.effects) {
                if (thisTower.effects[thisPower].effect == PWR_OPERATE_TOWER && thisTower.effects[thisPower].ticksRemaining > 0) {
                    //No Need
                    foundPower = true;
                }
            }
            if (!foundPower) {
                return thisTower;
            }
        } else if (thisTower && !thisTower.effects) {
            return thisTower;
        }
    }
    return undefined;
}

function getNeededLab(creep) {
    //Check to see if the two reagent labs have mats in them
        //If no, don't bother wasting OPS on boosting nothing
    if (Memory.labList[creep.room.name][3] && Memory.labList[creep.room.name][4]) {
        let regLab1 = Game.getObjectById(Memory.labList[creep.room.name][3]);
        let regLab2 = Game.getObjectById(Memory.labList[creep.room.name][4]);
        if (!regLab1 || !regLab2) {
            return undefined;
        }
        if (!regLab1.mineralType || !regLab2.mineralType) {
            return undefined;
        }
    }
    //Can ignore the first 5 labs as they only contain boosts/reagents
    for (let i = 5; i < 10; i++) {
        let labID = Memory.labList[creep.room.name][i];
        if (labID) {
            let thisLab = Game.getObjectById(labID);
            if (thisLab && thisLab.effects) {
                let foundPower = false;
                for (let thisPower in thisLab.effects) {
                    if (thisLab.effects[thisPower].effect == PWR_OPERATE_LAB && thisLab.effects[thisPower].ticksRemaining > 0) {
                        //No Need
                        foundPower = true;
                    }
                }
                if (!foundPower) {
                    return thisLab;
                }
            } else if (thisLab && !thisLab.effects) {
                return thisLab;
            }
        }
    }
    return undefined;
}

function getNeededSpawn(creep) {
    for (let spawnID in creep.memory.spawnList) {
        let thisSpawn = Game.getObjectById(creep.memory.spawnList[spawnID])
        if (thisSpawn && thisSpawn.effects) {
            let foundPower = false;
            for (let thisPower in thisSpawn.effects) {
                if (thisSpawn.effects[thisPower].effect == PWR_OPERATE_SPAWN && thisSpawn.effects[thisPower].ticksRemaining > 0) {
                    //No Need
                    foundPower = true;
                }
            }
            if (!foundPower) {
                return thisSpawn;
            }
        } else if (thisSpawn && !thisSpawn.effects) {
            return thisSpawn;
        }
    }
    return undefined;
}

module.exports = creep_baseOp;