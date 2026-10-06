const runtimeCache = require('runtime.cache');
const combatIntel = require('combat.intel');
const remoteMining = require('system.remoteMining');
var spawn_BuildFarCreeps = {
    run: function(spawn, thisRoom, energyIndex) {
        if (!spawn.spawning && !global.isSpawnBusy(spawn) && thisRoom.storage && Memory.roomsUnderAttack.indexOf(thisRoom.name) == -1) {
            let controlledCreeps = runtimeCache.homeCreeps(thisRoom.name);

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

            let farMinerConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, ATTACK];

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

            let sizedGuard = null;
            for (let config of guardConfigs) {
                const guardFlagName = thisRoom.name + config.flag;
                const tempFlagName = thisRoom.name + config.temp;
                // Against players, send the cheapest ranged/heal kiter the fight estimate says wins.
                // If none is affordable, send nothing: a fixed-size guard would just be fed to them.
                // Disabled remotes only get a guard when such a winning body exists.
                const guardRoom = Game.flags[guardFlagName] && Game.flags[guardFlagName].pos.roomName;
                const threat = guardRoom && combatIntel.remoteThreat(guardRoom);
                const playerPlan = threat && threat.p ? guardPlanFor(threat, thisRoom.energyCapacityAvailable) : null;
                const playerBody = playerPlan ? playerPlan.body : null;
                if (threat && threat.p && !playerBody) continue;
                if (config.condition && prioritizedRole === '' && !(guardRoom && remoteMining.isDisabled(guardRoom) && !playerBody) &&
                    ((Game.flags[guardFlagName] && Memory.FarRoomsUnderAttack.indexOf(Game.flags[guardFlagName].pos.roomName) != -1) || Game.flags[tempFlagName])) {
                    const guards = miningOps.farGuards[config.index] || [];
                    // A guard that judged its fight unwinnable marks the room outmatched: send a second one.
                    const guardTarget = Math.max(playerPlan ? playerPlan.count : 1,
                        Game.flags[guardFlagName] && combatIntel.isOutmatched(Game.flags[guardFlagName].pos.roomName) ? 2 : 1);
                    if (guards.length < guardTarget && Game.flags[guardFlagName] && blockedRole != 'farGuard') {
                        prioritizedRole = 'farGuard';
                        roomTarget = Game.flags[guardFlagName].pos.roomName;
                        flagName = Game.flags[guardFlagName].name;
                        sizedGuard = playerBody;
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
                    if (config.condition && Game.flags[thisRoom.name + config.flag] && !remoteMining.isDisabled(Game.flags[thisRoom.name + config.flag].pos.roomName)) {
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
                                farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
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

            if (prioritizedRole != '') {
                if (prioritizedRole == 'farClaimer') {
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
                        global.setSpawnBusy(spawn);
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
                        global.setSpawnBusy(spawn);
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, '', spawn.name);
                    }
                } else if (prioritizedRole == 'farMule') {
                    var farMuleConfig = getMuleBuild(thisRoom.energyCapacityAvailable, thisRoom, remoteMining.tripFor(thisRoom.name, Game.flags[flagName]));
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
                        global.setSpawnBusy(spawn);
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, '', spawn.name);
                    }
                } else if (prioritizedRole == 'farGuard') {
                    if (sizedGuard) {
                        farGuardConfig = sizedGuard;
                    }
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
                        global.setSpawnBusy(spawn);
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, '', spawn.name);
                    }
                    if (!sizedGuard) {
                        Memory.guardType = !Memory.guardType; // invader guards still alternate melee/ranged
                    }
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
                        global.setSpawnBusy(spawn);
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, '', spawn.name);
                    }
                }
            }

        }
    }
}

function getClaimerBuild(energyCap) {
    var thisConfig = [];

    // CLAIM/MOVE pairs only: the old trailing MOVE + ATTACK was never used (claimers avoid fights).
    var ConfigCost = BODYPART_COST[CLAIM] + BODYPART_COST[MOVE]

    while ((energyCap / ConfigCost) >= 1) {
        thisConfig.push(CLAIM);
        thisConfig.push(MOVE);
        energyCap = energyCap - ConfigCost;
        if (thisConfig.length >= 16) {
            break;
        }
    }
    thisConfig.sort();
    return thisConfig;
}

// Far mule: CARRY/MOVE 1:1 (full speed on unpaved plains even when full; remote rooms have no
// roads). Sized to the source: enough capacity for one round trip of output plus 15%, so close
// sources don't get (and don't lose) a 2500-energy hauler. Unplanned (manual) flags get the max.
// The old single ATTACK part was never used.
function getMuleBuild(energyCap, thisRoom, trip) {
    const affordable = Math.min(25, Math.floor(energyCap / (BODYPART_COST[CARRY] + BODYPART_COST[MOVE])));
    let pairs = affordable;
    if (trip) {
        const needed = Math.ceil(remoteMining.SOURCE_RATE * trip * 1.15 / CARRY_CAPACITY);
        pairs = Math.max(4, Math.min(affordable, needed));
    }
    const body = [];
    for (let i = 0; i < pairs; i++) body.push(CARRY);
    for (let i = 0; i < pairs; i++) body.push(MOVE);
    return body;
}

// Player threat in a remote room: the cheapest full-speed ranged/heal kiter that the shared fight
// estimate (combat.intel.verdictFor) says beats the recorded force, alone or as a pair. Returns
// { body, count } or null when even two max-size guards would lose (send nothing, don't feed).
// Kiters can disengage, which a melee guard against players cannot.
function guardPlanFor(threat, energyCap) {
    const them = { dps: threat.d, heal: threat.h, ehp: threat.e };
    for (const count of [1, 2]) {
        let best = null;
        for (let ranged = 1; ranged <= 25; ranged++) {
            for (let heal = 0; ranged + heal <= 25; heal++) {
                const cost = ranged * (BODYPART_COST[RANGED_ATTACK] + BODYPART_COST[MOVE]) + heal * (BODYPART_COST[HEAL] + BODYPART_COST[MOVE]);
                if (cost > energyCap || (best && cost >= best.cost)) continue;
                const us = { dps: count * ranged * 10, heal: count * heal * 12, ehp: count * (ranged + heal) * 2 * 100 };
                if (combatIntel.verdictFor(us, them) === 'win') best = { cost, ranged, heal };
            }
        }
        if (best) return { body: kiterBody(best.ranged, best.heal), count };
    }
    return null;
}

function guardBodyFor(threat, energyCap) {
    const plan = guardPlanFor(threat, energyCap);
    return plan ? plan.body : null;
}

function kiterBody(ranged, heal) {
    // Ranged parts in front, MOVE in the middle, HEAL last (damage hits the front parts first).
    const body = [];
    for (let i = 0; i < ranged; i++) body.push(RANGED_ATTACK);
    for (let i = 0; i < ranged + heal; i++) body.push(MOVE);
    for (let i = 0; i < heal; i++) body.push(HEAL);
    return body;
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

    const miningFlagToIndex = {};
    const miningDestinationToIndex = {};
    const guardFlagToIndex = {};
    const mineralFlagToIndex = {};

    // Initialize eFarGuards for war mode
    const watchEFarGuards = Memory.warMode;

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
            miningFlagToIndex[miningFlag] = i;

            const destination = Game.flags[miningFlag].pos.roomName;
            if (!miningDestinationToIndex[destination]) {
                miningDestinationToIndex[destination] = [];
            }
            miningDestinationToIndex[destination].push(i);
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
            guardFlagToIndex[guardFlag] = i;
        }
    }

    // Mineral mining operations
    const mineralConfigs = ["", "2", "3"];
    for (let i = 0; i < mineralConfigs.length; i++) {
        const mineralFlag = roomName + "FarMineral" + mineralConfigs[i];
        
        result.farMineralMiners[i] = [];
        
        if (Game.flags[mineralFlag]) {
            mineralFlagToIndex[mineralFlag] = i;
        }
    }

    for (const creepName in controlledCreeps) {
        const creep = controlledCreeps[creepName];
        if (!creep || !creep.memory || creep.memory.homeRoom != roomName) {
            continue;
        }

        const priority = creep.memory.priority;

        if (priority == 'farGuard') {
            if (watchEFarGuards && creep.memory.targetFlag == roomName + "eFarGuard") {
                result.eFarGuards.push(creep);
            }

            const guardIndex = guardFlagToIndex[creep.memory.targetFlag];
            if (guardIndex !== undefined) {
                result.farGuards[guardIndex].push(creep);
            }
            continue;
        }

        if (priority == 'farMule') {
            const miningIndex = miningFlagToIndex[creep.memory.targetFlag];
            if (miningIndex !== undefined) {
                result.farMining[miningIndex].mules.push(creep);
            }
            continue;
        }

        if (priority == 'farMiner') {
            const miningIndex = miningFlagToIndex[creep.memory.targetFlag];
            if (miningIndex !== undefined) {
                result.farMining[miningIndex].miners.push(creep);
            }
            continue;
        }

        if (priority == 'farClaimer') {
            const destinationIndexes = miningDestinationToIndex[creep.memory.destination];
            if (destinationIndexes && destinationIndexes.length) {
                for (let d = 0; d < destinationIndexes.length; d++) {
                    result.farMining[destinationIndexes[d]].claimers.push(creep);
                }
            }
            continue;
        }

        if (priority == 'farMineralMiner') {
            const mineralIndex = mineralFlagToIndex[creep.memory.targetFlag];
            if (mineralIndex !== undefined) {
                result.farMineralMiners[mineralIndex].push(creep);
            }
        }
    }

    return result;
}

spawn_BuildFarCreeps.getMuleBuild = getMuleBuild;   // exposed for tests
spawn_BuildFarCreeps.guardBodyFor = guardBodyFor;
spawn_BuildFarCreeps.guardPlanFor = guardPlanFor;
spawn_BuildFarCreeps.getClaimerBuild = getClaimerBuild;
module.exports = spawn_BuildFarCreeps;
