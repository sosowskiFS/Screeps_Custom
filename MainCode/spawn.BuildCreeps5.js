var spawn_BuildCreeps5 = {
    run: function (spawn, thisRoom, RoomCreeps, energyIndex) {
        // Cache frequently used values
        const roomName = thisRoom.name;
        const controller = thisRoom.controller;
        const storage = thisRoom.storage;
        const terminal = thisRoom.terminal;
        const energyCapacity = thisRoom.energyCapacityAvailable;
        
        // Categorize creeps efficiently in a single pass
        const creepCounts = this.categorizeCreeps(RoomCreeps);
        
        // Extract individual counts for readability
        const {
            miners, upgradeMiners, storageMiners, mules, upgraders, mineralMiners,
            repairers, suppliers, distributors, upSuppliers, scrapers, labWorkers,
            salvagers, defenders
        } = creepCounts;

        // Get cached room data and configuration
        const roomConfig = this.getRoomConfiguration(roomName, storage, terminal, controller, energyCapacity);
        let { 
            minerMax, muleMax, upgraderMax, repairMax, upSupplierMax, supplierMax,
            distributorMax, labWorkerMax, salvagerMax, scraperMax,
            mineralConfig, regenPower, pNeedDist
        } = roomConfig;

        // Get cached structure references
        const structures = this.getCachedStructures(roomName);
        const { strSources, strLinks, strMineral, strTerminal, strExtractor } = structures;
        let readyForMineral = false;
        let mineralType = '';
        
        // Safely get mineral type with null checks
        if (strMineral && strMineral.length > 0) {
            let mineralObj = Game.getObjectById(strMineral[0]);
            if (mineralObj) {
                mineralType = mineralObj.mineralType;
            }
        }

        if (strExtractor && strExtractor.length > 0 && thisRoom.terminal && strMineral && strMineral.length > 0 && mineralType && (!thisRoom.terminal.store[mineralType] || thisRoom.terminal.store[mineralType] <= 10000)) {
            readyForMineral = true;
        }

        if (thisRoom.energyCapacityAvailable >= 1550) {
            upgraderMax--;
        }
        
        // Apply room-specific configurations
        this.applyRoomConfigurations(roomConfig, thisRoom, creepCounts);

        let roomMineral = null;
        if (strMineral && strMineral.length > 0) {
            roomMineral = Game.getObjectById(strMineral[0]);
        }

        if (Memory.roomsUnderAttack.indexOf(thisRoom.name) != -1 && !thisRoom.controller.safeMode) {
            //Custom limits for beseiged rooms
            minerMax = 1;
            muleMax = 1;
            upgraderMax = 0;
            repairMax = 3;
            upSupplierMax = 0;
            supplierMax = 1;
            if (Game.flags[thisRoom.name + "RoomOperator"]) {
                //The RoomOperator is robust enough to make up for multiple roles
                if (pNeedDist) {
                    distributorMax = 1;
                } else {
                    distributorMax = 0;
                }
                muleMax = 0;
            }
        }

        if (Game.flags[thisRoom.name + "upFocus"]) {
            //Laser focus on upgrading
            muleMax = muleMax + repairMax;
            upgraderMax = upgraderMax + repairMax;
            repairMax = 0;
        }

        //Returns [upgraderMax, upgraderConfig]
        let upgraderResults = GetUpgraderConfig(upgraderMax, thisRoom.energyCapacityAvailable, thisRoom.controller.level)
            upgraderMax = upgraderResults[0]
            let upgraderConfig = upgraderResults[1]
            let bareMinConfig = [MOVE, WORK, WORK, CARRY];
        let buildDirections = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
        let supplierDirection = [];
        
        // Check if this spawn should build suppliers (next to Supply flag)
        if (Game.flags[thisRoom.name + "Supply"] && Game.flags[thisRoom.name + "Supply"].pos.isNearTo(spawn)) {
            let targetDir = spawn.pos.getDirectionTo(Game.flags[thisRoom.name + "Supply"]);
            // For autobuild rooms, restrict directions more strictly
            if (Memory.autoBuildRooms.indexOf(thisRoom.name) > -1) {
                buildDirections.splice(buildDirections.indexOf(targetDir), 1);
            }
            supplierDirection.push(targetDir);
        }
        // For non-autobuild rooms, allow any spawn to build suppliers if Supply flag exists
        else if (Game.flags[thisRoom.name + "Supply"] && Memory.autoBuildRooms.indexOf(thisRoom.name) === -1) {
            supplierDirection = buildDirections; // Use all available directions
        }


        if (!RoomCreeps || RoomCreeps.length <= 1) {
            if (thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] >= 500 || thisRoom.terminal && thisRoom.terminal.store[RESOURCE_ENERGY] >= 500) {
                let configCost = calculateConfigCost([MOVE, MOVE, CARRY, CARRY, CARRY, CARRY]);
                if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                    Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                    //In case of complete destruction, make a minimum viable worker
                    //Make sure 5+ work code has harvester backup path
                    let connectedLink = undefined;
                    if (strLinks.length >= 4) {
                        connectedLink = strLinks[3];
                    }
                    spawn.spawnCreep([MOVE, MOVE, CARRY, CARRY, CARRY, CARRY], 'dist_' + spawn.name + '_' + Game.time, {
                        memory: {
                            priority: 'distributor',
                            deathWarn: _.size([MOVE, MOVE, CARRY, CARRY, CARRY, CARRY]) * 4,
                            fromSpawn: spawn.id,
                            homeRoom: thisRoom.name,
                            linkSource: connectedLink
                        },
                        directions: buildDirections
                    });
                    Memory.isSpawning = true;
                }
            } else if (thisRoom.storage) {
                let configCost = calculateConfigCost([MOVE, WORK, WORK, CARRY]);
                if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                    Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                    //In case of complete destruction, make a minimum viable worker
                    //Make sure 5+ work code has harvester backup path
                    spawn.spawnCreep([MOVE, WORK, WORK, CARRY], 'miner_' + spawn.name + '_' + Game.time, {
                        memory: {
                            priority: 'miner',
                            mineSource: strSources[0],
                            linkSource: thisRoom.storage.id,
                            jobSpecific: 'storageMiner',
                            ignoreTravel: false,
                            atSpot: false,
                            minePower: 2 * HARVEST_POWER,
                            deathWarn: _.size([MOVE, WORK, WORK, CARRY]) * 4,
                            fromSpawn: spawn.id,
                            homeRoom: thisRoom.name
                        },
                        directions: buildDirections
                    });
                    Memory.isSpawning = true;
                }
            }
        } else if (Memory.roomsUnderAttack.indexOf(thisRoom.name) != -1 && !thisRoom.controller.safeMode && Memory.roomsPrepSalvager.indexOf(thisRoom.name) == -1 && defenders.length < 6) {
            let Foe = thisRoom.find(FIND_HOSTILE_CREEPS, {
                filter: (eCreep) => ((eCreep.getActiveBodyparts(ATTACK) > 0 || eCreep.getActiveBodyparts(RANGED_ATTACK) > 0 || eCreep.getActiveBodyparts(WORK) > 0) && !Memory.whiteList.includes(eCreep.owner.username))
            });

            let blockedRole = '';
            // Check what roles are blocked by looking through the queue for this room
            for (let i = 0; i < Memory.creepInQue.length; i += 4) {
                if (Memory.creepInQue[i] === thisRoom.name) {
                    blockedRole += ' ' + Memory.creepInQue[i + 1];
                }
            }

            if (suppliers.length < supplierMax && !blockedRole.includes('supplier') && supplierDirection.length > 0) {
                Memory.isSpawning = true;
                let supplierConfig = [MOVE, CARRY, CARRY, CARRY];
                let configCost = calculateConfigCost(supplierConfig);
                if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                    Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                    spawn.spawnCreep(supplierConfig, 'supplier_' + spawn.name + '_' + Game.time, {
                        memory: {
                            priority: 'supplier',
                            deathWarn: _.size(supplierConfig) * 4,
                            fromSpawn: spawn.id,
                            homeRoom: thisRoom.name,
                            atSpot: false
                        },
                        directions: supplierDirection
                    });
                    Memory.creepInQue.push(thisRoom.name, 'supplier', '', spawn.name);
                }
            } else if (Memory.CurrentRoomEnergy[energyIndex] >= 650 && (Foe.length || defenders.length < 1)) {
                // Optimized defender creation
                const defenderConfig = this.buildOptimalDefender(thisRoom.energyCapacityAvailable);
                const configCost = calculateConfigCost(defenderConfig);
                
                if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                    Memory.CurrentRoomEnergy[energyIndex] -= configCost;
                    spawn.spawnCreep(defenderConfig, 'defender_' + spawn.name + '_' + Game.time, {
                        memory: {
                            priority: 'defender',
                            fromSpawn: spawn.id,
                            homeRoom: thisRoom.name
                        },
                        directions: buildDirections
                    });
                    Memory.isSpawning = true;
                }
            } else {
                //Lock out spawning other units until max defenders
                Memory.isSpawning = true;
            }
        }
        if (!Memory.isSpawning && (miners.length < minerMax || mules.length < muleMax || upgraders.length < upgraderMax || repairers.length < repairMax || suppliers.length < supplierMax || distributors.length < distributorMax || labWorkers.length < labWorkerMax || upSuppliers.length < upSupplierMax || scrapers.length < scraperMax || salvagers.length < salvagerMax) || (roomMineral && roomMineral.mineralAmount > 0 && mineralMiners.length == 0 && readyForMineral)) {
            let prioritizedRole = '';
            let creepSource = '';
            let connectedLink = '';
            let backupLink = '';
            let storageID = '';
            let jobSpecificPri = '';
            let blockedRole = '';
            let blockedSubRole = '';
            let roomTarget = '';
            let farSource = '';

            let purgeIDs = [];
            var queLength = Memory.creepInQue.length;
            for (var i = 0; i < queLength; i += 4) {
                if (Memory.creepInQue[i] == thisRoom.name) {
                    //Check if spawn still exists/is active. If not, mark for removal
                    if (!Game.spawns[Memory.creepInQue[i + 3]] || !Game.spawns[Memory.creepInQue[i + 3]].isActive()) {
                        purgeIDs.push(i);
                    } else {
                        blockedRole = blockedRole + ' ' + Memory.creepInQue[i + 1];
                        blockedSubRole = blockedSubRole + ' ' + Memory.creepInQue[i + 2];
                    }
                }
            }

            // Remove all invalid entries (iterate backwards to avoid index shifting issues)
            for (let j = purgeIDs.length - 1; j >= 0; j--) {
                Memory.creepInQue.splice(purgeIDs[j], 4);
            }

            if (miners.length >= 1 && mules.length == 0 && !blockedRole.includes('mule') && !Game.flags[thisRoom.name + "RoomOperator"]) {
                prioritizedRole = 'mule';
                storageID = thisRoom.storage.id;
                if (strLinks.length >= 4) {
                    connectedLink = strLinks[3];
                } else {
                    connectedLink = undefined;
                }
                creepSource = strTerminal;
            } else if (miners.length < minerMax) {
                switch (storageMiners.length) {
                case 0:
                    if (!blockedSubRole.includes('storageMiner')) {
                        prioritizedRole = 'miner';
                        creepSource = strSources[0];
                        connectedLink = thisRoom.storage.id;
                        jobSpecificPri = 'storageMiner';
                    }
                    break;
                case 1:
                    if (!blockedSubRole.includes('upgradeMiner')) {
                        prioritizedRole = 'miner';
                        creepSource = strSources[1];
                        connectedLink = strLinks[0];
                        if (strLinks.length >= 3) {
                            backupLink = strLinks[2];
                        }
                        jobSpecificPri = 'upgradeMiner';
                    }
                    break;
                }
            } else if (distributors.length < distributorMax && !blockedRole.includes('distributor')) {
                prioritizedRole = 'distributor';
                if (strLinks.length >= 4) {
                    connectedLink = strLinks[3];
                }
            } else if (suppliers.length < supplierMax && !blockedRole.includes('supplier') && supplierDirection.length > 0) {
                prioritizedRole = 'supplier';
                if (Game.time % 50 === 0) {
                    console.log(`${thisRoom.name} - ${spawn.name}: Prioritizing supplier - Current: ${suppliers.length}/${supplierMax}, Not blocked: ${!blockedRole.includes('supplier')}, Has direction: ${supplierDirection.length > 0}`);
                }
            } else if (mules.length < muleMax && !blockedRole.includes('mule')) {
                prioritizedRole = 'mule';
                storageID = thisRoom.storage.id;
                if (strLinks.length >= 4) {
                    connectedLink = strLinks[3];
                }
                creepSource = strTerminal;
            } else if (upgraders.length < upgraderMax && !blockedRole.includes('upgrader')) {
                prioritizedRole = 'upgrader';
                storageID = thisRoom.storage.id;
                connectedLink = strLinks[1];
            } else if (upSuppliers.length < upSupplierMax && !blockedRole.includes('upSupplier')) {
                prioritizedRole = 'upSupplier';
                storageID = thisRoom.storage.id;
                connectedLink = strLinks[1];
            } else if (repairers.length < repairMax && !blockedRole.includes('repair')) {
                prioritizedRole = 'repair';
                storageID = thisRoom.storage.id;
            } else if (roomMineral && roomMineral.mineralAmount > 0 && mineralMiners.length == 0 && readyForMineral && !blockedRole.includes('mineralMiner') && thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] >= 50000) {
                prioritizedRole = 'mineralMiner';
                storageID = strTerminal;
                creepSource = strMineral[0];
                connectedLink = strExtractor[0];
            } else if (labWorkers.length < labWorkerMax && !blockedRole.includes('labWorker')) {
                prioritizedRole = 'labWorker';
                storageID = strTerminal;
            } else if (scrapers.length < scraperMax && !blockedRole.includes('scraper')) {
                prioritizedRole = 'scraper';
                connectedLink = strLinks[0];
            } else if (salvagers.length < salvagerMax && !blockedRole.includes('salvager')) {
                prioritizedRole = 'salvager';
            }

            if (prioritizedRole != '') {
                if (prioritizedRole == 'miner') {
                    Memory.isSpawning = true;
                    let minePower = 5 * HARVEST_POWER;
                    let minerConfig = [MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, CARRY];
                    if (Game.flags[thisRoom.name + "RoomOperator"] && regenPower > 0) {
                        //source totals per level (300ticks) - 4000, 5000, 6000, 7000, 8000
                        switch (regenPower) {
                        case 1:
                            minerConfig = [MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY];
                            minePower = 7 * HARVEST_POWER;
                            break;
                        case 2:
                            minerConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY];
                            minePower = 9 * HARVEST_POWER;
                            break;
                        case 3:
                            minerConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY];
                            minePower = 10 * HARVEST_POWER;
                            break;
                        case 4:
                            minerConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY];
                            minePower = 12 * HARVEST_POWER;
                            break;
                        case 5:
                            minePower = 14 * HARVEST_POWER;
                            minerConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY];
                            break;
                        }
                    }
                    let configCost = calculateConfigCost(minerConfig);
                    if (configCost > thisRoom.energyCapacityAvailable) {
                        //Took severe damage, assume cap of 300
                        minePower = 2 * HARVEST_POWER;
                        minerConfig = [CARRY, WORK, WORK, MOVE];
                        configCost = 300
                    }
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        if (jobSpecificPri == 'upgradeMiner' && strLinks.length >= 4) {
                            spawn.spawnCreep(minerConfig, 'miner_' + spawn.name + '_' + Game.time, {
                                memory: {
                                    priority: prioritizedRole,
                                    mineSource: creepSource,
                                    linkSource: connectedLink,
                                    linkSource2: backupLink,
                                    jobSpecific: jobSpecificPri,
                                    deathWarn: _.size(minerConfig) * 6,
                                    fromSpawn: spawn.id,
                                    homeRoom: thisRoom.name,
                                    minePower: minePower,
                                    ignoreTravel: false,
                                    atSpot: false
                                },
                                directions: buildDirections
                            });
                        } else {
                            spawn.spawnCreep(minerConfig, 'miner_' + spawn.name + '_' + Game.time, {
                                memory: {
                                    priority: prioritizedRole,
                                    mineSource: creepSource,
                                    linkSource: connectedLink,
                                    jobSpecific: jobSpecificPri,
                                    deathWarn: _.size(minerConfig) * 5,
                                    fromSpawn: spawn.id,
                                    homeRoom: thisRoom.name,
                                    minePower: minePower,
                                    ignoreTravel: false,
                                    atSpot: false
                                },
                                directions: buildDirections
                            });
                        }
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
                    }
                } else if (prioritizedRole == 'mule') {
                    Memory.isSpawning = true;
                    let muleConfig = [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
                    if (thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] >= 450000 && thisRoom.energyCapacityAvailable >= 3000) {
                        muleConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    } else if (thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] >= 150000 && thisRoom.energyCapacityAvailable >= 1600) {
                        muleConfig = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    }

                    let configCost = calculateConfigCost(muleConfig);
                    if (configCost > thisRoom.energyCapacityAvailable) {
                        //Took severe damage, assume cap of 300
                        muleConfig = [MOVE, WORK, CARRY, CARRY, CARRY];
                        configCost = 300
                    }
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep(muleConfig, 'mule_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: prioritizedRole,
                                linkSource: connectedLink,
                                storageSource: storageID,
                                terminalID: creepSource,
                                deathWarn: _.size(muleConfig) * 4,
                                fromSpawn: spawn.id,
                                homeRoom: thisRoom.name
                            },
                            directions: buildDirections
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
                    }
                } else if (prioritizedRole == 'upgrader') {
                    Memory.isSpawning = true;
                    let configCost = calculateConfigCost(upgraderConfig);
                    if (configCost > thisRoom.energyCapacityAvailable) {
                        //Took severe damage, assume cap of 300
                        upgraderConfig = [MOVE, WORK, WORK, CARRY];
                        configCost = 300
                    }
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep(upgraderConfig, 'upgrader_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: prioritizedRole,
                                linkSource: connectedLink,
                                storageSource: storageID,
                                deathWarn: _.size(upgraderConfig) * 6,
                                fromSpawn: spawn.id,
                                homeRoom: thisRoom.name
                            },
                            directions: buildDirections
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
                    }
                } else if (prioritizedRole == 'upSupplier') {
                    Memory.isSpawning = true;
                    let upSupplierConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    if (thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] >= 265000 && thisRoom.energyCapacityAvailable >= 2500 && thisRoom.controller.level != 8) {
                        upSupplierConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    }
                    let configCost = calculateConfigCost(upSupplierConfig);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep(upSupplierConfig, 'upSupplier_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: prioritizedRole,
                                linkTarget: connectedLink,
                                storageSource: storageID,
                                deathWarn: _.size(upSupplierConfig) * 5,
                                fromSpawn: spawn.id,
                                homeRoom: thisRoom.name
                            },
                            directions: buildDirections
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);

                    }
                } else if (prioritizedRole == 'repair') {
                    Memory.isSpawning = true;
                    let repairConfig = [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
                    if (thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] >= 450000 && thisRoom.energyCapacityAvailable >= 3000) {
                        repairConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    } else if (thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] >= 300000 && thisRoom.energyCapacityAvailable >= 1800) {
                        repairConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    }
                    let configCost = calculateConfigCost(repairConfig);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep(repairConfig, 'repair_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: prioritizedRole,
                                storageSource: storageID,
                                deathWarn: _.size(repairConfig) * 4,
                                fromSpawn: spawn.id,
                                homeRoom: thisRoom.name
                            },
                            directions: buildDirections
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
                    }
                } else if (prioritizedRole == 'supplier') {
                    Memory.isSpawning = true;
                    let supplierConfig = [MOVE, CARRY, CARRY, CARRY];
                    let configCost = calculateConfigCost(supplierConfig);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep(supplierConfig, 'supplier_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: prioritizedRole,
                                deathWarn: _.size(supplierConfig) * 4,
                                fromSpawn: spawn.id,
                                homeRoom: thisRoom.name,
                                atSpot: false
                            },
                            directions: supplierDirection
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
                    }
                } else if (prioritizedRole == 'distributor') {
                    Memory.isSpawning = true;
                    let distributorConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
                    if (thisRoom.storage && thisRoom.energyCapacityAvailable >= 1200) {
                        distributorConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    } else if (thisRoom.controller.level > 7) {
                        distributorConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    }
                    let configCost = calculateConfigCost(distributorConfig);
                    if (configCost > thisRoom.energyCapacityAvailable) {
                        //Took severe damage, assume cap of 300
                        distributorConfig = [MOVE, MOVE, CARRY, CARRY, CARRY, CARRY];
                        configCost = 300
                    }
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        if (connectedLink != '') {
                            spawn.spawnCreep(distributorConfig, 'distribute_' + spawn.name + '_' + Game.time, {
                                memory: {
                                    priority: prioritizedRole,
                                    linkSource: connectedLink,
                                    deathWarn: _.size(distributorConfig) * 4,
                                    fromSpawn: spawn.id,
                                    homeRoom: thisRoom.name
                                },
                                directions: buildDirections
                            });
                        } else {
                            spawn.spawnCreep(distributorConfig, 'distribute_' + spawn.name + '_' + Game.time, {
                                memory: {
                                    priority: prioritizedRole,
                                    deathWarn: _.size(distributorConfig) * 4,
                                    fromSpawn: spawn.id,
                                    homeRoom: thisRoom.name
                                },
                                directions: buildDirections
                            });
                        }
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);

                    }
                } else if (prioritizedRole == 'mineralMiner') {
                    Memory.isSpawning = true;
                    let mineralMinerConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK];
                    if (thisRoom.energyCapacityAvailable >= 4500) {
                        mineralMinerConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK];
                    }
                    let configCost = calculateConfigCost(mineralMinerConfig);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep(mineralMinerConfig, 'mineralMiner_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: prioritizedRole,
                                mineralID: creepSource,
                                fromSpawn: spawn.id,
                                homeRoom: thisRoom.name,
                                nextMine: 0,
                                deathWarn: _.size(mineralMinerConfig) * 4,
                                onPoint: false
                            },
                            directions: buildDirections
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);

                    }
                } else if (prioritizedRole == 'labWorker') {
                    Memory.isSpawning = true;
                    let labWorkerConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    let configCost = calculateConfigCost(labWorkerConfig);
                    let factoryID = undefined;
                    if (Memory.factoryList[thisRoom.name] && Memory.factoryList[thisRoom.name].length) {
                        factoryID = Memory.factoryList[thisRoom.name][0];
                    }
                    const { min1, min2, min3, min4, min5, min6, primaryFlag, backupFlag } = mineralConfig;
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        if (Memory.labList[thisRoom.name].length >= 10) {
                            spawn.spawnCreep(labWorkerConfig, 'labWorker_' + spawn.name + '_' + Game.time, {
                                memory: {
                                    priority: prioritizedRole,
                                    terminalID: storageID,
                                    mineral1: min1,
                                    lab1: Memory.labList[thisRoom.name][0],
                                    mineral2: min2,
                                    lab2: Memory.labList[thisRoom.name][1],
                                    mineral3: min3,
                                    lab3: Memory.labList[thisRoom.name][2],
                                    mineral4: min4,
                                    lab4: Memory.labList[thisRoom.name][3],
                                    mineral5: min5,
                                    lab5: Memory.labList[thisRoom.name][4],
                                    mineral6: min6,
                                    lab6: Memory.labList[thisRoom.name][5],
                                    mineral7: min6,
                                    lab7: Memory.labList[thisRoom.name][6],
                                    mineral8: min6,
                                    lab8: Memory.labList[thisRoom.name][7],
                                    mineral9: min6,
                                    lab9: Memory.labList[thisRoom.name][8],
                                    mineral10: min6,
                                    lab10: Memory.labList[thisRoom.name][9],
                                    factory: factoryID,
                                    primaryFlag: primaryFlag,
                                    backupFlag: backupFlag,
                                    isMoving: false,
                                    movingOtherMineral: false,
                                    movingOtherMineral2: false,
                                    resourceChecks: 0,
                                    deathWarn: _.size(labWorkerConfig) * 4,
                                    fromSpawn: spawn.id,
                                    homeRoom: thisRoom.name
                                },
                                directions: buildDirections
                            });
                        } else if (Memory.labList[thisRoom.name].length >= 9) {
                            spawn.spawnCreep(labWorkerConfig, 'labWorker_' + spawn.name + '_' + Game.time, {
                                memory: {
                                    priority: prioritizedRole,
                                    terminalID: storageID,
                                    mineral1: min1,
                                    lab1: Memory.labList[thisRoom.name][0],
                                    mineral2: min2,
                                    lab2: Memory.labList[thisRoom.name][1],
                                    mineral3: min3,
                                    lab3: Memory.labList[thisRoom.name][2],
                                    mineral4: min4,
                                    lab4: Memory.labList[thisRoom.name][3],
                                    mineral5: min5,
                                    lab5: Memory.labList[thisRoom.name][4],
                                    mineral6: min6,
                                    lab6: Memory.labList[thisRoom.name][5],
                                    mineral7: min6,
                                    lab7: Memory.labList[thisRoom.name][6],
                                    mineral8: min6,
                                    lab8: Memory.labList[thisRoom.name][7],
                                    mineral9: min6,
                                    lab9: Memory.labList[thisRoom.name][8],
                                    factory: factoryID,
                                    primaryFlag: primaryFlag,
                                    backupFlag: backupFlag,
                                    isMoving: false,
                                    movingOtherMineral: false,
                                    movingOtherMineral2: false,
                                    resourceChecks: 0,
                                    deathWarn: _.size(labWorkerConfig) * 4,
                                    fromSpawn: spawn.id,
                                    homeRoom: thisRoom.name
                                },
                                directions: buildDirections
                            });
                        } else if (Memory.labList[thisRoom.name].length >= 6) {
                            spawn.spawnCreep(labWorkerConfig, 'labWorker_' + spawn.name + '_' + Game.time, {
                                memory: {
                                    priority: prioritizedRole,
                                    terminalID: storageID,
                                    mineral1: min1,
                                    lab1: Memory.labList[thisRoom.name][0],
                                    mineral2: min2,
                                    lab2: Memory.labList[thisRoom.name][1],
                                    mineral3: min3,
                                    lab3: Memory.labList[thisRoom.name][2],
                                    mineral4: min4,
                                    lab4: Memory.labList[thisRoom.name][3],
                                    mineral5: min5,
                                    lab5: Memory.labList[thisRoom.name][4],
                                    mineral6: min6,
                                    lab6: Memory.labList[thisRoom.name][5],
                                    factory: factoryID,
                                    primaryFlag: primaryFlag,
                                    backupFlag: backupFlag,
                                    isMoving: false,
                                    movingOtherMineral: false,
                                    movingOtherMineral2: false,
                                    resourceChecks: 0,
                                    deathWarn: _.size(labWorkerConfig) * 4,
                                    fromSpawn: spawn.id,
                                    homeRoom: thisRoom.name
                                },
                                directions: buildDirections
                            });
                        } else {
                            spawn.spawnCreep(labWorkerConfig, 'labWorker_' + spawn.name + '_' + Game.time, {
                                memory: {
                                    priority: prioritizedRole,
                                    terminalID: storageID,
                                    mineral1: min1,
                                    lab1: Memory.labList[thisRoom.name][0],
                                    mineral2: min2,
                                    lab2: Memory.labList[thisRoom.name][1],
                                    mineral3: min3,
                                    lab3: Memory.labList[thisRoom.name][2],
                                    factory: factoryID,
                                    primaryFlag: primaryFlag,
                                    backupFlag: backupFlag,
                                    isMoving: false,
                                    movingOtherMineral: false,
                                    movingOtherMineral2: false,
                                    resourceChecks: 0,
                                    deathWarn: _.size(labWorkerConfig) * 4,
                                    fromSpawn: spawn.id,
                                    homeRoom: thisRoom.name
                                },
                                directions: buildDirections
                            });
                        }
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
                    }
                } else if (prioritizedRole == 'scraper') {
                    Memory.isSpawning = true;
                    let scraperConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    let configCost = calculateConfigCost(scraperConfig);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep(scraperConfig, 'scraper_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: prioritizedRole,
                                linkID: connectedLink,
                                targetResource: undefined,
                                fromSpawn: spawn.id,
                                homeRoom: thisRoom.name
                            },
                            directions: buildDirections
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
                    }
                } else if (prioritizedRole == 'salvager') {
                    Memory.isSpawning = true;
                    let configCost = calculateConfigCost([CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE]);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep([CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE], 'salvager_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: prioritizedRole,
                                deathWarn: _.size([CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE]) * 6,
                                storageTarget: thisRoom.storage.id,
                                homeRoom: thisRoom.name
                            },
                            directions: buildDirections
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
                    }
                }
            }
        } else if (mules.length == 0 && !Game.flags[thisRoom.name + "RoomOperator"]) {
            var blockedRole = '';
            var blockedSubRole = '';

            // Check what roles are blocked by looking through the queue for this room
            for (let i = 0; i < Memory.creepInQue.length; i += 4) {
                if (Memory.creepInQue[i] === thisRoom.name) {
                    blockedRole += ' ' + Memory.creepInQue[i + 1];
                    blockedSubRole += ' ' + Memory.creepInQue[i + 2];
                }
            }
            if (!blockedRole.includes('mule')) {
                //Spawn a crappy mule
                Memory.isSpawning = true;
                let configCost = calculateConfigCost([MOVE, MOVE, CARRY, CARRY, CARRY, CARRY]);
                if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                    Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                    spawn.spawnCreep([MOVE, MOVE, CARRY, CARRY, CARRY, CARRY], 'mule_' + spawn.name + '_' + Game.time, {
                        memory: {
                            priority: 'mule',
                            linkSource: strLinks[1],
                            storageSource: thisRoom.storage.id,
                            terminalID: strTerminal,
                            deathWarn: _.size([MOVE, MOVE, CARRY, CARRY, CARRY, CARRY]) * 4,
                            fromSpawn: spawn.id,
                            homeRoom: thisRoom.name
                        },
                        directions: buildDirections
                    });
                    Memory.creepInQue.push(thisRoom.name, 'mule', '', spawn.name);
                }
            }
        }
    }
};

function calculateConfigCost(bodyConfig) {
    var totalCost = 0;
    for (let thisPart of bodyConfig) {
        totalCost = totalCost + BODYPART_COST[thisPart];
    }
    return totalCost;
}

function GetUpgraderConfig(upgraderMax, energyCap, cLevel) {
	if (energyCap >= 1550 && cLevel >= 8) {
		return [1, [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY]]
	}

	if (energyCap < (BODYPART_COST[MOVE] *3) + BODYPART_COST[CARRY] + (BODYPART_COST[WORK] * 12)) {
		return [1, [MOVE,MOVE,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY]]
	}

	//1 Standard upgrader - 12 WORK
	let thisConfig = [MOVE,MOVE,MOVE,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY];
    let configCost = (BODYPART_COST[WORK] * 12) + (BODYPART_COST[MOVE] * 3);
    energyCap = energyCap - ((BODYPART_COST[MOVE] *3) + BODYPART_COST[CARRY] + (BODYPART_COST[WORK] * 12));

    let configLength = 16;
    while ((energyCap / configCost) >= 1 && configLength < 46 && upgraderMax > 0) {
        thisConfig.push(WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK);
        thisConfig.push(MOVE,MOVE,MOVE);
        energyCap = energyCap - configCost
        configLength += 15
        upgraderMax -= 1;
    }

    thisConfig.sort();

    if (upgraderMax == 0) {
    	upgraderMax = 1;
    }

    return [upgraderMax, thisConfig];
}

Object.assign(spawn_BuildCreeps5, {
    // Efficiently categorize all creeps in a single pass
    categorizeCreeps: function(RoomCreeps) {
        const counts = {
            miners: [], upgradeMiners: [], storageMiners: [], mules: [], upgraders: [],
            mineralMiners: [], repairers: [], suppliers: [], distributors: [], upSuppliers: [],
            scrapers: [], labWorkers: [], salvagers: [], defenders: []
        };

        if (!RoomCreeps) return counts;

        for (const creep of RoomCreeps) {
            const priority = creep.memory.priority;
            const previousPriority = creep.memory.previousPriority;
            const jobSpecific = creep.memory.jobSpecific;

            switch (priority) {
                case 'miner':
                    counts.miners.push(creep);
                    if (jobSpecific === 'upgradeMiner') counts.upgradeMiners.push(creep);
                    else if (jobSpecific === 'storageMiner') counts.storageMiners.push(creep);
                    break;
                case 'mule':
                    counts.mules.push(creep);
                    break;
                case 'upgrader':
                    counts.upgraders.push(creep);
                    break;
                case 'mineralMiner':
                    counts.mineralMiners.push(creep);
                    break;
                case 'repair':
                    if (!previousPriority) counts.repairers.push(creep);
                    break;
                case 'supplier':
                    counts.suppliers.push(creep);
                    break;
                case 'distributor':
                    counts.distributors.push(creep);
                    break;
                case 'upSupplier':
                    counts.upSuppliers.push(creep);
                    break;
                case 'scraper':
                    counts.scrapers.push(creep);
                    break;
                case 'labWorker':
                    counts.labWorkers.push(creep);
                    break;
                case 'salvager':
                    counts.salvagers.push(creep);
                    break;
                case 'defender':
                    counts.defenders.push(creep);
                    break;
            }

            // Handle previousPriority cases
            if (previousPriority === 'mule' && priority !== 'mule') {
                counts.mules.push(creep);
            } else if (previousPriority === 'labWorker' && priority !== 'labWorker') {
                counts.labWorkers.push(creep);
            }
        }

        return counts;
    },

    // Get room configuration with caching
    getRoomConfiguration: function(roomName, storage, terminal, controller, energyCapacity) {
        // Cache configuration per room to avoid recalculation
        if (!Memory.roomConfigs) Memory.roomConfigs = {};
        if (!Memory.roomConfigs[roomName] || Game.time % 100 === 0) {
            Memory.roomConfigs[roomName] = this.calculateRoomConfiguration(roomName, storage, terminal, controller, energyCapacity);
        }
        return Memory.roomConfigs[roomName];
    },

    // Calculate room configuration based on room state
    calculateRoomConfiguration: function(roomName, storage, terminal, controller, energyCapacity) {
        let config = {
            minerMax: 2, muleMax: 1, upgraderMax: 2, repairMax: 1,
            upSupplierMax: 1, supplierMax: 1, distributorMax: 1,
            labWorkerMax: 0, salvagerMax: 1, scraperMax: 0,
            mineralConfig: {}, regenPower: 0, pNeedDist: false
        };

        // Determine scraper max based on links
        const strLinks = Memory.linkList[roomName] || [];
        if (strLinks.length < 4) {
            config.scraperMax = 1;
        }

        // Configure lab worker and mineral config if terminal exists
        if (terminal && Memory.labList[roomName] && Memory.labList[roomName].length >= 3) {
            config.labWorkerMax = 1;
            config.mineralConfig = this.getMineralConfiguration(roomName);
        }

        // Adjust based on storage energy levels
        if (storage && storage.store[RESOURCE_ENERGY] < 50000) {
            config.upSupplierMax = 0;
            config.repairMax = 0;
        }

        // Room level specific configurations
        if (controller.level === 8) {
            this.configureLevel8Room(config, roomName, storage);
        } else if (storage) {
            this.configureStorageRoom(config, storage);
        }

        return config;
    },

    // Configure level 8 room settings
    configureLevel8Room: function(config, roomName, storage) {
        // Minimize staffing for level 8 rooms
        config.muleMax = 1;
        config.upgraderMax = 1;
        config.repairMax = 1;
        config.upSupplierMax = 1;
        config.supplierMax = 1;
        config.distributorMax = 1;
        config.salvagerMax = 0;

        // Adjust based on repair caps
        if (Game.flags[roomName + "25mCap"] || Game.flags[roomName + "50mCap"]) {
            config.repairMax = 0;
        }

        // Energy-based adjustments
        if (storage) {
            if (storage.store[RESOURCE_ENERGY] <= 50000) {
                config.upgraderMax = 0;
                config.upSupplierMax = 0;
                config.repairMax = 0;
            } else if (storage.store[RESOURCE_ENERGY] <= 100000) {
                config.repairMax = 0;
            } else if (storage.store[RESOURCE_ENERGY] >= 700000) {
                config.repairMax = 2;
            }
        }

        // Power creep adjustments
        if (Game.flags[roomName + "RoomOperator"]) {
            this.configurePowerCreepRoom(config, roomName, storage);
        }
    },

    // Configure power creep room settings
    configurePowerCreepRoom: function(config, roomName, storage) {
        config.upSupplierMax = 0;
        config.distributorMax = 0;
        config.muleMax = 0;
        config.repairMax = 2;

        // Check power creep abilities
        for (let pName in Game.powerCreeps) {
            const pCreep = Game.powerCreeps[pName];
            if (pCreep.memory.homeRoom === roomName) {
                // Check extension fill capacity
                if (!pCreep.powers[PWR_OPERATE_EXTENSION] || 
                    pCreep.powers[PWR_OPERATE_EXTENSION].level < 5) {
                    config.pNeedDist = true;
                    config.distributorMax = 1;
                }
                // Check regen source strength
                if (pCreep.powers[PWR_REGEN_SOURCE]) {
                    config.regenPower = pCreep.powers[PWR_REGEN_SOURCE].level;
                }
                break;
            }
        }

        // Special case adjustments
        if (Game.flags[roomName + "RunningAssault"]) {
            config.distributorMax = 1; // Aid with lab refilling
        }

        if (storage) {
            if (storage.store[RESOURCE_ENERGY] <= 50000) {
                config.repairMax = 0;
                config.upgraderMax = 0;
            } else if (storage.store[RESOURCE_ENERGY] >= 700000) {
                config.repairMax = 4;
            }
        }

        // Check for construction sites
        const room = Game.rooms[roomName];
        if (room) {
            const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
            if (constructionSites.length) {
                config.muleMax = 2; // Need builders
            }
        }
    },

    // Configure rooms with storage (non-level 8)
    configureStorageRoom: function(config, storage) {
        const energy = storage.store[RESOURCE_ENERGY];
        
        if (energy >= 115000) {
            config.upgraderMax++;
        }
        if (energy >= 225000) {
            config.upgraderMax++;
            config.muleMax++;
        }
        if (energy >= 375000) {
            config.repairMax++;
        }
        if (energy >= 525000) {
            config.upgraderMax += 2;
        }
    },

    // Get mineral configuration for lab operations
    getMineralConfiguration: function(roomName) {
        // Cached mineral configuration based on flags
        const flagMappings = {
            [roomName + "WarBoosts"]: {
                min1: RESOURCE_CATALYZED_GHODIUM_ALKALIDE,
                min2: RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE,
                min3: RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE,
                min4: RESOURCE_CATALYZED_ZYNTHIUM_ACID,
                min5: RESOURCE_CATALYZED_UTRIUM_ACID,
                min6: RESOURCE_CATALYZED_KEANIUM_ALKALIDE
            },
            [roomName + "XGHO2Producer"]: {
                min4: RESOURCE_GHODIUM_ALKALIDE, min5: RESOURCE_CATALYST,
                min6: RESOURCE_CATALYZED_GHODIUM_ALKALIDE,
                primaryFlag: roomName + "XGHO2Producer",
                backupFlag: roomName + "XGH2OProducer"
            }
            // Additional mappings would continue here for all producer types
        };

        // Default configuration
        let config = {
            min1: RESOURCE_CATALYZED_KEANIUM_ALKALIDE,
            min2: RESOURCE_CATALYZED_GHODIUM_ACID,
            min3: RESOURCE_CATALYZED_LEMERGIUM_ACID,
            min4: '', min5: '', min6: '',
            primaryFlag: '', backupFlag: ''
        };

        // Check flags and apply configuration
        for (const [flagName, flagConfig] of Object.entries(flagMappings)) {
            if (Game.flags[flagName]) {
                Object.assign(config, flagConfig);
                break;
            }
        }

        return config;
    },

    // Get cached structure references
    getCachedStructures: function(roomName) {
        // Use Memory lists that are already maintained
        return {
            strSources: Memory.sourceList[roomName] || [],
            strLinks: Memory.linkList[roomName] || [],
            strMineral: Memory.mineralList[roomName] || [],
            strTerminal: Memory.terminalList ? Memory.terminalList[roomName] : 
                        (Game.rooms[roomName] && Game.rooms[roomName].terminal ? 
                         Game.rooms[roomName].terminal.id : ""),
            strExtractor: Memory.extractorList[roomName] || ""
        };
    },

    // Apply room-specific configurations that modify the base config
    applyRoomConfigurations: function(roomConfig, thisRoom, creepCounts) {
        const roomName = thisRoom.name;
        const { upgradeMiners, storageMiners } = creepCounts;
        const strSources = Memory.sourceList[roomName] || [];

        // Handle miner reassignment if needed
        if (thisRoom.storage && storageMiners.length === 0 && upgradeMiners.length > 0 && 
            thisRoom.storage.store[RESOURCE_ENERGY] <= 3000) {
            
            const miner = upgradeMiners[0];
            miner.drop(RESOURCE_ENERGY);
            miner.memory.jobSpecific = 'storageMiner';
            miner.memory.linkSource = thisRoom.storage.id;
            miner.memory.mineSource = strSources[0];
            miner.memory.ignoreTravel = false;
            miner.memory.atSpot = false;
        }
    },

    // Build optimal defender configuration
    buildOptimalDefender: function(energyCapacity) {
        const config = [];
        let remainingEnergy = energyCapacity;
        const moduleEnergy = 650; // Cost for 1 MOVE + 4 RANGED_ATTACK
        let totalParts = 0;

        // Calculate number of complete modules we can afford
        while (remainingEnergy >= moduleEnergy && totalParts + 5 <= 50) {
            config.push(MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK);
            remainingEnergy -= moduleEnergy;
            totalParts += 5;
        }

        return config;
    }
});

module.exports = spawn_BuildCreeps5;