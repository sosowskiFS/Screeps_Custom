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
        if (creep.ticksToLive <= 50 && Memory.powerSpawnList[creep.room.name]) {
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
        }
    }

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
};

module.exports = creep_baseOp;