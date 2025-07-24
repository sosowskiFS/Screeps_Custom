var spawn_BuildFarCreeps = {
    run: function(spawn, thisRoom, energyIndex) {
        if (!spawn.spawning && thisRoom.storage && Memory.roomsUnderAttack.indexOf(thisRoom.name) == -1) {
            let controlledCreeps = Game.creeps;

            let Flag25 = false;
            let Flag50 = false;
            let greatNeed = false;
            if ((thisRoom.storage.store[RESOURCE_POWER] && thisRoom.storage.store[RESOURCE_POWER] >= 100) || thisRoom.storage.store[RESOURCE_ENERGY] < 100000) {
                greatNeed = true;
            }
            if (!greatNeed && Game.flags[thisRoom.name + "25mCap"] && !Game.flags[thisRoom.name + "RunningAssault"]) {
                Flag25 = true;
            } else if (!greatNeed && Game.flags[thisRoom.name + "50mCap"] && !Game.flags[thisRoom.name + "RunningAssault"]) {
                Flag25 = true;
                if (!Memory.powerCheckList[thisRoom.name]) {
                    Flag50 = true;
                }
            }

            // Initialize mining operations data structures
            const miningOps = initializeMiningOperations(thisRoom, controlledCreeps, Flag25, Flag50);

            let farMinerConfig = [MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, ATTACK];

            //760 Points (Level 3)
            let farGuardConfig = [TOUGH, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, MOVE, HEAL];

            if (Memory.warMode) {
                if (Memory.guardType) {
                    //Ranged Guard
                    if (thisRoom.energyCapacityAvailable >= 5100) {
                        farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, ATTACK, ATTACK, HEAL];
                    } else if (thisRoom.energyCapacityAvailable >= 3100) {
                        farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, ATTACK, ATTACK, HEAL];
                    } else if (thisRoom.energyCapacityAvailable >= 2300) {
                        farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, ATTACK, ATTACK, HEAL];
                    } else if (thisRoom.energyCapacityAvailable >= 1800) {
                        farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, ATTACK, ATTACK, HEAL];
                    } else if (thisRoom.energyCapacityAvailable >= 1280) {
                        //1250 Points
                        farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, ATTACK, ATTACK, HEAL];
                    }
                } else {
                    //Melee Guard
                    if (thisRoom.energyCapacityAvailable >= 3770) {
                        farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL];
                    } else if (thisRoom.energyCapacityAvailable >= 3430) {
                        farGuardConfig = [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL];
                    } else if (thisRoom.energyCapacityAvailable >= 2300) {
                        farGuardConfig = [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, HEAL];
                    } else if (thisRoom.energyCapacityAvailable >= 1790) {
                        farGuardConfig = [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, HEAL];
                    } else if (thisRoom.energyCapacityAvailable >= 1270) {
                        //1250 Points
                        farGuardConfig = [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, HEAL];
                    }
                }
            } else {
                if (Memory.guardType) {
                    if (thisRoom.energyCapacityAvailable >= 1900) {
                        farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, ATTACK, ATTACK, HEAL];
                    } else if (thisRoom.energyCapacityAvailable >= 1280) {
                        farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, ATTACK, ATTACK, HEAL];
                    }
                } else {
                    if (thisRoom.energyCapacityAvailable >= 1790) {
                        farGuardConfig = [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, HEAL];
                    } else if (thisRoom.energyCapacityAvailable >= 1270) {
                        farGuardConfig = [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, HEAL];
                    }
                }
            }

            var prioritizedRole = '';
            var roomTarget = '';
            var flagName = '';
            var storageID = '';
            var healTarget;

            var blockedRole = '';
            // Check what roles are blocked by looking through the queue for this room
            for (let i = 0; i < Memory.creepInQue.length; i += 4) {
                if (Memory.creepInQue[i] === thisRoom.name) {
                    blockedRole += ' ' + Memory.creepInQue[i + 1];
                }
            }

            // Set up build directions, avoiding supplier spot in autobuild rooms
            let buildDirections = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
            if (Memory.autoBuildRooms.indexOf(thisRoom.name) > -1 && Game.flags[thisRoom.name + "Supply"]) {
                // Find supply flag direction and remove it from available directions
                let supplyFlag = Game.flags[thisRoom.name + "Supply"];
                if (supplyFlag.pos.isNearTo(spawn)) {
                    let supplierDirection = spawn.pos.getDirectionTo(supplyFlag);
                    let dirIndex = buildDirections.indexOf(supplierDirection);
                    if (dirIndex > -1) {
                        buildDirections.splice(dirIndex, 1);
                    }
                }
            }

            if (Memory.warMode) {
                if (miningOps.eFarGuards.length < 1 && Game.flags[thisRoom.name + "eFarGuard"] && blockedRole != 'farGuard') {
                    prioritizedRole = 'farGuard';
                    roomTarget = Game.flags[thisRoom.name + "eFarGuard"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "eFarGuard"].name;
                }
            }

            // Check far guards using condensed logic
            const guardConfigs = [
                { index: 0, flag: "FarGuard", temp: "FarGuardTEMP", condition: true },
                { index: 1, flag: "FarGuard2", temp: "FarGuard2TEMP", condition: true },
                { index: 2, flag: "FarGuard3", temp: "FarGuard3TEMP", condition: !Flag50 },
                { index: 3, flag: "FarGuard4", temp: "FarGuard4TEMP", condition: !Flag50 },
                { index: 4, flag: "FarGuard5", temp: "FarGuard5TEMP", condition: !Flag25 },
                { index: 5, flag: "FarGuard6", temp: "FarGuard6TEMP", condition: !Flag25 },
                { index: 6, flag: "FarGuard7", temp: "FarGuard7TEMP", condition: !Flag25 },
                { index: 7, flag: "FarGuard8", temp: "FarGuard8TEMP", condition: !Flag25 },
                { index: 8, flag: "FarGuard9", temp: "FarGuard9TEMP", condition: !Flag25 }
            ];

            for (let config of guardConfigs) {
                const guardFlagName = thisRoom.name + config.flag;
                const tempFlagName = thisRoom.name + config.temp;
                if (config.condition && prioritizedRole === '' && 
                    ((Game.flags[guardFlagName] && Memory.FarRoomsUnderAttack.indexOf(Game.flags[guardFlagName].pos.roomName) != -1) || Game.flags[tempFlagName])) {
                    const guards = miningOps.farGuards[config.index] || [];
                    if (guards.length < 1 && Game.flags[guardFlagName] && blockedRole != 'farGuard') {
                        prioritizedRole = 'farGuard';
                        roomTarget = Game.flags[guardFlagName].pos.roomName;
                        flagName = Game.flags[guardFlagName].name;
                        break;
                    }
                }
            }

            var jobSpecific = undefined;

            // Check mining operations using helper function
            if (prioritizedRole === '') {
                const miningConfigs = [
                    { index: 0, flag: "FarMining", condition: true },
                    { index: 1, flag: "FarMining2", condition: true },
                    { index: 2, flag: "FarMining3", condition: !Flag50 },
                    { index: 3, flag: "FarMining4", condition: !Flag50 },
                    { index: 4, flag: "FarMining5", condition: !Flag25 },
                    { index: 5, flag: "FarMining6", condition: !Flag25 },
                    { index: 6, flag: "FarMining7", condition: !Flag25 },
                    { index: 7, flag: "FarMining8", condition: !Flag25 },
                    { index: 8, flag: "FarMining9", condition: !Flag25 }
                ];

                for (let config of miningConfigs) {
                    if (config.condition && Game.flags[thisRoom.name + config.flag]) {
                        const miners = (miningOps.farMining[config.index] && miningOps.farMining[config.index].miners) || [];
                        const mules = (miningOps.farMining[config.index] && miningOps.farMining[config.index].mules) || [];
                        const claimers = (miningOps.farMining[config.index] && miningOps.farMining[config.index].claimers) || [];
                        
                        if (miners.length < 1 && blockedRole != 'farMiner') {
                            prioritizedRole = 'farMiner';
                            roomTarget = Game.flags[thisRoom.name + config.flag].pos.roomName;
                            flagName = Game.flags[thisRoom.name + config.flag].name;
                            
                            if (Game.flags[Game.flags[thisRoom.name + config.flag].pos.roomName + "SKRoom"]) {
                                jobSpecific = "SKMiner";
                                if (config.flag === "FarMining8" && Game.flags[thisRoom.name + "8Expensive"]) {
                                    farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
                                } else {
                                    farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
                                }
                            } else if (Game.flags[Game.flags[thisRoom.name + config.flag].pos.roomName + "NoSKRoom"]) {
                                farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
                            }
                            break;
                        } else if (mules.length < 1 && blockedRole != 'farMule') {
                            prioritizedRole = 'farMule';
                            roomTarget = Game.flags[thisRoom.name + config.flag].pos.roomName;
                            flagName = Game.flags[thisRoom.name + config.flag].name;
                            storageID = thisRoom.storage.id;
                            break;
                        } else if (claimers.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + config.flag].pos.roomName] && blockedRole != 'farClaimer') {
                            prioritizedRole = 'farClaimer';
                            roomTarget = Game.flags[thisRoom.name + config.flag].pos.roomName;
                            flagName = Game.flags[thisRoom.name + config.flag].name;
                            break;
                        }
                    }
                }
            }

            // Check mineral mining operations
            if (prioritizedRole === '' && thisRoom.terminal) {
                const mineralConfigs = [
                    { index: 0, flag: "FarMineral" },
                    { index: 1, flag: "FarMineral2" },
                    { index: 2, flag: "FarMineral3" }
                ];

                for (let config of mineralConfigs) {
                    const miners = miningOps.farMineralMiners[config.index] || [];
                    if (Game.flags[thisRoom.name + config.flag] && miners.length < 1 && blockedRole != 'farMineralMiner') {
                        prioritizedRole = 'farMineralMiner';
                        roomTarget = Game.flags[thisRoom.name + config.flag].pos.roomName;
                        flagName = Game.flags[thisRoom.name + config.flag].name;
                        storageID = thisRoom.terminal.id;
                        farMinerConfig = [WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE];
                        break;
                    }
                }
            }

            // Check for highway patrol unit (spawn every 2000 ticks and only if energy storage >= 400,000)
            if (prioritizedRole === '' && Game.time % 2000 === 0 && thisRoom.storage.store[RESOURCE_ENERGY] >= 400000) {
                let patrollers = _.filter(controlledCreeps, (creep) => 
                    creep.memory.priority == 'highwayPatrol' && 
                    creep.memory.homeRoom == thisRoom.name
                );
                
                if (patrollers.length < 1 && blockedRole.indexOf('highwayPatrol') === -1) {
                    prioritizedRole = 'highwayPatrol';
                    roomTarget = thisRoom.name;
                }
            }

            if (prioritizedRole != '') {
                if (prioritizedRole == 'highwayPatrol') {
                    let highwayPatrolConfig = getHighwayPatrolBuild(thisRoom.energyCapacityAvailable);
                    let configCost = calculateConfigCost(highwayPatrolConfig);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep(highwayPatrolConfig, 'hwPatrol_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: prioritizedRole,
                                homeRoom: thisRoom.name,
                                fromSpawn: spawn.id,
                                deathWarn: _.size(highwayPatrolConfig) * 8,
                                patrolDirection: 0 // Start with first highway direction
                            },
                            directions: buildDirections
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, '', spawn.name);
                    }
                } else if (prioritizedRole == 'farClaimer') {
                    var farClaimerConfig = getClaimerBuild(thisRoom.energyCapacityAvailable);
                    let configCost = calculateConfigCost(farClaimerConfig);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep(farClaimerConfig, 'reserver_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: prioritizedRole,
                                destination: roomTarget,
                                fromSpawn: spawn.id,
                                homeRoom: thisRoom.name,
                                deathWarn: _.size(farClaimerConfig) * 5,
                                targetFlag: flagName
                            },
                            directions: buildDirections
                        });
                        Memory.FarClaimerNeeded[Game.flags[flagName].pos.roomName] = false;
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, '', spawn.name);
                    }
                } else if (prioritizedRole == 'farMiner') {
                    let configCost = calculateConfigCost(farMinerConfig);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep(farMinerConfig, 'farMiner_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: prioritizedRole,
                                destination: roomTarget,
                                fromSpawn: spawn.id,
                                homeRoom: thisRoom.name,
                                deathWarn: _.size(farMinerConfig) * 8,
                                targetFlag: flagName,
                                jobSpecific: jobSpecific,
                                nextReservationCheck: 0
                            },
                            directions: buildDirections
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, '', spawn.name);
                    }
                } else if (prioritizedRole == 'farMule') {
                    var farMuleConfig = getMuleBuild(thisRoom.energyCapacityAvailable, thisRoom);
                    let configCost = calculateConfigCost(farMuleConfig);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep(farMuleConfig, 'farMule_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: prioritizedRole,
                                destination: roomTarget,
                                homeRoom: thisRoom.name,
                                storageSource: storageID,
                                fromSpawn: spawn.id,
                                deathWarn: _.size(farMuleConfig) * 6,
                                targetFlag: flagName
                            },
                            directions: buildDirections
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, '', spawn.name);
                    }
                } else if (prioritizedRole == 'farGuard') {
                    let configCost = calculateConfigCost(farGuardConfig);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        var warnMulti = 5;
                        if (Memory.warMode) {
                            warnMulti = 6;
                        }
                        spawn.spawnCreep(farGuardConfig, 'guard_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: prioritizedRole,
                                destination: roomTarget,
                                homeRoom: thisRoom.name,
                                fromSpawn: spawn.id,
                                deathWarn: _.size(farGuardConfig) * warnMulti,
                                targetFlag: flagName
                            },
                            directions: buildDirections
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, '', spawn.name);
                    }
                    Memory.guardType = !Memory.guardType;
                } else if (prioritizedRole == 'farMineralMiner') {
                    let configCost = calculateConfigCost(farMinerConfig);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep(farMinerConfig, 'mineralMiner_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: prioritizedRole,
                                destination: roomTarget,
                                homeRoom: thisRoom.name,
                                fromSpawn: spawn.id,
                                storageSource: storageID,
                                deathWarn: _.size(farMinerConfig) * 5,
                                targetFlag: flagName
                            },
                            directions: buildDirections
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, '', spawn.name);
                    }
                }
            }

        }
    }
}

function getClaimerBuild(energyCap) {
    var thisConfig = [];

    var ConfigCost = BODYPART_COST[CLAIM] + BODYPART_COST[MOVE]
    energyCap = energyCap - BODYPART_COST[ATTACK];

    while ((energyCap / ConfigCost) >= 1) {
        thisConfig.push(CLAIM);
        thisConfig.push(MOVE);
        energyCap = energyCap - ConfigCost;
        if (thisConfig.length >= 16) {
            break;
        }
    }
    thisConfig.sort();
    thisConfig.push(ATTACK);
    return thisConfig;
}

function getMuleBuild(energyCap, thisRoom) {
    var thisConfig = [CARRY, MOVE, MOVE, WORK];
    var ConfigCost = (BODYPART_COST[CARRY] * 2) + BODYPART_COST[MOVE];
    energyCap = energyCap - (BODYPART_COST[MOVE] + BODYPART_COST[MOVE] + BODYPART_COST[CARRY] + BODYPART_COST[WORK] + BODYPART_COST[ATTACK]);
    var partCap = 49;
    //initial : 1 move, 1 work, 1 carry
    //Add to each loop : 2 carry, 1 move

    while ((energyCap / ConfigCost) >= 1) {
        thisConfig.push(MOVE);
        thisConfig.push(CARRY);
        thisConfig.push(CARRY);
        energyCap = energyCap - ConfigCost;
        if (thisConfig.length >= partCap) {
            break;
        }
    }

    if (thisConfig.length > partCap) {
        while (thisConfig.length > partCap) {
            thisConfig.splice(0, 1);
        }
    }

    thisConfig.sort(); //sorting like this throws attack first
    thisConfig.push(ATTACK);
    return thisConfig;
}

function calculateConfigCost(bodyConfig) {
    var totalCost = 0;
    for (let thisPart of bodyConfig) {
        totalCost = totalCost + BODYPART_COST[thisPart];
    }
    return totalCost;
}

function initializeMiningOperations(thisRoom, controlledCreeps, Flag25, Flag50) {
    const roomName = thisRoom.name;
    const result = {
        eFarGuards: [],
        farMining: [],
        farGuards: [],
        farMineralMiners: []
    };

    // Initialize eFarGuards for war mode
    if (Memory.warMode) {
        result.eFarGuards = _.filter(controlledCreeps, (creep) => 
            creep.memory.priority == 'farGuard' && 
            creep.memory.homeRoom == roomName && 
            creep.memory.targetFlag == roomName + "eFarGuard"
        );
    }

    // Mining operations configurations
    const miningConfigs = [
        { suffix: "", condition: true },
        { suffix: "2", condition: true },
        { suffix: "3", condition: !Flag50 },
        { suffix: "4", condition: !Flag50 },
        { suffix: "5", condition: !Flag25 },
        { suffix: "6", condition: !Flag25 },
        { suffix: "7", condition: !Flag25 },
        { suffix: "8", condition: !Flag25 },
        { suffix: "9", condition: !Flag25 }
    ];

    // Initialize mining operations
    for (let i = 0; i < miningConfigs.length; i++) {
        const config = miningConfigs[i];
        const miningFlag = roomName + "FarMining" + config.suffix;
        
        result.farMining[i] = { mules: [], claimers: [], miners: [] };
        
        if (config.condition && Game.flags[miningFlag]) {
            result.farMining[i].mules = _.filter(controlledCreeps, (creep) => 
                creep.memory.priority == 'farMule' && 
                creep.memory.homeRoom == roomName && 
                creep.memory.targetFlag == miningFlag
            );
            
            result.farMining[i].claimers = _.filter(controlledCreeps, (creep) => 
                creep.memory.priority == 'farClaimer' && 
                creep.memory.homeRoom == roomName && 
                creep.memory.destination == Game.flags[miningFlag].pos.roomName
            );
            
            result.farMining[i].miners = _.filter(controlledCreeps, (creep) => 
                creep.memory.priority == 'farMiner' && 
                creep.memory.homeRoom == roomName && 
                creep.memory.targetFlag == miningFlag
            );
        }
    }

    // Guard operations configurations
    const guardConfigs = [
        { suffix: "", condition: true },
        { suffix: "2", condition: true },
        { suffix: "3", condition: !Flag50 },
        { suffix: "4", condition: !Flag50 },
        { suffix: "5", condition: !Flag25 },
        { suffix: "6", condition: !Flag25 },
        { suffix: "7", condition: !Flag25 },
        { suffix: "8", condition: !Flag25 },
        { suffix: "9", condition: !Flag25 }
    ];

    // Initialize guard operations
    for (let i = 0; i < guardConfigs.length; i++) {
        const config = guardConfigs[i];
        const guardFlag = roomName + "FarGuard" + config.suffix;
        const tempFlag = roomName + "FarGuard" + config.suffix + "TEMP";
        
        result.farGuards[i] = [];
        
        if (config.condition && (Game.flags[guardFlag] || Game.flags[tempFlag])) {
            result.farGuards[i] = _.filter(controlledCreeps, (creep) => 
                creep.memory.priority == 'farGuard' && 
                creep.memory.homeRoom == roomName && 
                creep.memory.targetFlag == guardFlag
            );
        }
    }

    // Mineral mining operations
    const mineralConfigs = ["", "2", "3"];
    for (let i = 0; i < mineralConfigs.length; i++) {
        const mineralFlag = roomName + "FarMineral" + mineralConfigs[i];
        
        result.farMineralMiners[i] = [];
        
        if (Game.flags[mineralFlag]) {
            result.farMineralMiners[i] = _.filter(controlledCreeps, (creep) => 
                creep.memory.priority == 'farMineralMiner' && 
                creep.memory.homeRoom == roomName && 
                creep.memory.targetFlag == mineralFlag
            );
        }
    }

    return result;
}

function getHighwayPatrolBuild(energyCap) {
    // 2 HEAL, 2 ATTACK, rest RANGED_ATTACK + MOVE
    var thisConfig = [HEAL, HEAL, ATTACK, ATTACK];
    var totalCost = BODYPART_COST[HEAL] * 2 + BODYPART_COST[ATTACK] * 2;
    
    energyCap = energyCap - totalCost;
    
    // Add RANGED_ATTACK and MOVE parts (need equal amounts for no movement penalty)
    var rangedAttackCost = BODYPART_COST[RANGED_ATTACK] + BODYPART_COST[MOVE];
    
    while (energyCap >= rangedAttackCost && thisConfig.length < 48) {
        thisConfig.push(RANGED_ATTACK);
        thisConfig.push(MOVE);
        energyCap = energyCap - rangedAttackCost;
    }
    
    // Sort to group body parts nicely
    thisConfig.sort();
    
    return thisConfig;
}

module.exports = spawn_BuildFarCreeps;