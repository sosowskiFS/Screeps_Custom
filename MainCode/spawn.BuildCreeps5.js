const runtimeCache = require('runtime.cache');
const { operatorPresent } = require('creep.baseOp');
const defenseWatch = require('defense.watch');
const maintenance = require('system.maintenance');
const labPlanner = require('system.labs');
const essentials = require('spawn.essentials');
const mineralBudget = require('system.mineralBudget');
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

        // Salvager on demand: tombstones or dropped resources worth collecting, or a weak
        // attack being prepared for (roomsPrepSalvager).
        if (salvagerMax > 0 && !this.hasSalvage(thisRoom)) {
            salvagerMax = 0;
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
            if (operatorPresent(thisRoom.name)) {
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

        // Check if room's lowest health rampart exceeds 290 million hitpoints
        // If so, block production of repair creeps to minimize CPU impact
        if (Memory.repairTarget[thisRoom.name]) {
            let repairTarget = Game.getObjectById(Memory.repairTarget[thisRoom.name]);
            if (repairTarget && repairTarget.structureType === STRUCTURE_RAMPART && repairTarget.hits > 290000000) {
                repairMax = 0;
            }
        }

        //Returns [upgraderMax, upgraderConfig]
        let upgraderResults = GetUpgraderConfig(upgraderMax, thisRoom.energyCapacityAvailable, thisRoom.controller.level)
            upgraderMax = upgraderResults[0]
            let upgraderConfig = upgraderResults[1]

        // RCL8 controller upkeep and maintenance-mode staffing (see lowCpuStaffing).
        const lowCpu = this.lowCpuStaffing(thisRoom, { upgraderMax, upgraderConfig, upSupplierMax, minerMax, repairMax, salvagerMax, muleMax, distributorMax, pNeedDist });
        ({ upgraderMax, upgraderConfig, upSupplierMax, minerMax, repairMax, salvagerMax, muleMax, distributorMax } = lowCpu);
        const controllerUpkeep = lowCpu.controllerUpkeep;
            let bareMinConfig = [MOVE, WORK, WORK, CARRY];
        // Supplier spawn directions (see supplierDirections).
        let { buildDirections, supplierDirection } = this.supplierDirections(thisRoom, spawn);

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
                    global.setSpawnBusy(spawn);
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
                    global.setSpawnBusy(spawn);
                }
            }
        } else if (Memory.roomsUnderAttack.indexOf(thisRoom.name) != -1 && !thisRoom.controller.safeMode && Memory.roomsPrepSalvager.indexOf(thisRoom.name) == -1 && defenders.length < 6 && !defenseWatch.isDraining(thisRoom.name)) {
            // Skipped while a border drainer is bouncing: no defenders for it and no economy lockout.
            let Foe = runtimeCache.find(thisRoom, FIND_HOSTILE_CREEPS, {
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
                global.setSpawnBusy(spawn);
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
                    global.setSpawnBusy(spawn);
                }
            } else {
                //Lock out spawning other units until max defenders
                global.setSpawnBusy(spawn);
            }
        }
        if (!global.isSpawnBusy || !global.isSpawnBusy(spawn)) {
            if ((miners.length < minerMax || mules.length < muleMax || upgraders.length < upgraderMax || repairers.length < repairMax || suppliers.length < supplierMax || distributors.length < distributorMax || labWorkers.length < labWorkerMax || upSuppliers.length < upSupplierMax || scrapers.length < scraperMax || salvagers.length < salvagerMax) || (roomMineral && roomMineral.mineralAmount > 0 && mineralMiners.length == 0 && readyForMineral)) {
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

            // Recovery: a room missing its refill (distributor/mule), tower supplier or storage miner
            // spawns those before anything else, sized to the energy on hand (spawn.essentials).
            const missingEssentials = essentials.missing(thisRoom);
            const recovering = missingEssentials.length > 0;
            const recoveryBudget = Math.min(thisRoom.energyCapacityAvailable, Math.max(300, Memory.CurrentRoomEnergy[energyIndex] || 0));

            if (missingEssentials.includes('refill') && !blockedRole.includes('distributor')) {
                prioritizedRole = 'distributor';
                if (strLinks.length >= 4) {
                    connectedLink = strLinks[3];
                }
            } else if (missingEssentials.includes('supplier') && !blockedRole.includes('supplier') && supplierDirection.length > 0) {
                prioritizedRole = 'supplier';
            } else if (missingEssentials.includes('miner') && !blockedSubRole.includes('storageMiner')) {
                prioritizedRole = 'miner';
                creepSource = strSources[0];
                connectedLink = thisRoom.storage.id;
                jobSpecificPri = 'storageMiner';
            } else if (miners.length >= 1 && mules.length == 0 && !blockedRole.includes('mule') && !operatorPresent(thisRoom.name)) {
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
                // Upkeep upgraders draw from storage; the controller link is no longer topped up.
                connectedLink = controllerUpkeep ? thisRoom.storage.id : strLinks[1];
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
                    global.setSpawnBusy(spawn);
                    let minePower = 5 * HARVEST_POWER;
                    let minerConfig = [MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, CARRY];
                    if (operatorPresent(thisRoom.name) && regenPower > 0) {
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
                    } else if (recovering && configCost > recoveryBudget) {
                        // Recovery: as many WORK as the energy on hand pays for (2..5).
                        const works = Math.max(2, Math.min(5, Math.floor((recoveryBudget - 100) / 100)));
                        minerConfig = [MOVE, CARRY];
                        for (let i = 0; i < works; i++) minerConfig.push(WORK);
                        minePower = works * HARVEST_POWER;
                        configCost = calculateConfigCost(minerConfig);
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
                    global.setSpawnBusy(spawn);
                    let muleConfig = [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
                    if (thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] >= 450000 && thisRoom.energyCapacityAvailable >= 3000) {
                        muleConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    } else if (thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] >= 150000 && thisRoom.energyCapacityAvailable >= 1600) {
                        muleConfig = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    }

                    let configCost = calculateConfigCost(muleConfig);
                    if (configCost > thisRoom.energyCapacityAvailable || (recovering && configCost > recoveryBudget)) {
                        //Took severe damage (or recovering on little energy): 300
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
                    global.setSpawnBusy(spawn);
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
                                upkeep: controllerUpkeep || undefined,
                                hasBoosted: controllerUpkeep || undefined, // no lab boost for a 1-WORK upkeep run
                                deathWarn: _.size(upgraderConfig) * 6,
                                fromSpawn: spawn.id,
                                homeRoom: thisRoom.name
                            },
                            directions: buildDirections
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
                    }
                } else if (prioritizedRole == 'upSupplier') {
                    global.setSpawnBusy(spawn);
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
                    global.setSpawnBusy(spawn);
                    let repairConfig = [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
                    if (thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] >= 450000 && thisRoom.energyCapacityAvailable >= 3300) {
                        // Full 50 parts: 16 WORK / 17 CARRY / 17 MOVE. Three of these match four of the
                        // old 42-part (12 WORK) body, so the top tier needs one creep fewer.
                        repairConfig = [];
                        for (let i = 0; i < 16; i++) repairConfig.push(WORK);
                        for (let i = 0; i < 17; i++) repairConfig.push(CARRY);
                        for (let i = 0; i < 17; i++) repairConfig.push(MOVE);
                    } else if (thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] >= 450000 && thisRoom.energyCapacityAvailable >= 3000) {
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
                    global.setSpawnBusy(spawn);
                    let supplierConfig = this.supplierBody(recovering ? recoveryBudget : thisRoom.energyCapacityAvailable);
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
                    global.setSpawnBusy(spawn);
                    let distributorConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
                    if (thisRoom.storage && thisRoom.energyCapacityAvailable >= 2400) {
                        // 32 CARRY / 16 MOVE (1600 capacity): a full RCL8 refill in ~8 trips instead of ~13.
                        distributorConfig = this.distributorBody(thisRoom.energyCapacityAvailable);
                    } else if (thisRoom.storage && thisRoom.energyCapacityAvailable >= 1200) {
                        distributorConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    } else if (thisRoom.controller.level > 7) {
                        distributorConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    }
                    let configCost = calculateConfigCost(distributorConfig);
                    if (configCost > thisRoom.energyCapacityAvailable) {
                        //Took severe damage, assume cap of 300
                        distributorConfig = [MOVE, MOVE, CARRY, CARRY, CARRY, CARRY];
                        configCost = 300
                    } else if (recovering && configCost > recoveryBudget) {
                        // Recovery: the biggest distributor the energy on hand pays for.
                        distributorConfig = this.distributorBody(recoveryBudget);
                        configCost = calculateConfigCost(distributorConfig);
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
                    global.setSpawnBusy(spawn);
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
                    global.setSpawnBusy(spawn);
                    let labWorkerConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    let configCost = calculateConfigCost(labWorkerConfig);
                    let factoryID = undefined;
                    if (Memory.factoryList[thisRoom.name] && Memory.factoryList[thisRoom.name].length) {
                        factoryID = Memory.factoryList[thisRoom.name][0];
                    }
                    const { min1, min2, min3, min4, min5, min6 } = mineralConfig;
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
                                    movingOtherMineral: false,
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
                                    movingOtherMineral: false,
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
                                    movingOtherMineral: false,
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
                                    movingOtherMineral: false,
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
                    global.setSpawnBusy(spawn);
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
                    global.setSpawnBusy(spawn);
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
        } else if (mules.length == 0 && !operatorPresent(thisRoom.name)) {
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
                global.setSpawnBusy(spawn);
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
        config.salvagerMax = 1; // only spawned when hasSalvage() finds tombstones/drops worth it

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
        if (operatorPresent(roomName)) {
            this.configurePowerCreepRoom(config, roomName, storage);
        }
    },

    // Configure power creep room settings
    configurePowerCreepRoom: function(config, roomName, storage) {
        config.upSupplierMax = 0;
        config.distributorMax = 0;
        config.muleMax = 0;
        config.repairMax = 2;

        // Abilities of the operator actually in the room (only called when one is present).
        const pCreep = operatorPresent(roomName);
        if (pCreep) {
            // Below level 5, OPERATE_EXTENSION fills only part of the extensions: keep a distributor.
            if (!pCreep.powers[PWR_OPERATE_EXTENSION] || pCreep.powers[PWR_OPERATE_EXTENSION].level < 5) {
                config.pNeedDist = true;
                config.distributorMax = 1;
            }
            // Regen source strength sizes the miners.
            if (pCreep.powers[PWR_REGEN_SOURCE]) {
                config.regenPower = pCreep.powers[PWR_REGEN_SOURCE].level;
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
                // 3 x 16 WORK (50-part repairers) = the old 4 x 12 WORK.
                config.repairMax = 3;
            }
        }

        // Check for construction sites
        const room = Game.rooms[roomName];
        if (room) {
            const constructionSites = runtimeCache.find(room, FIND_CONSTRUCTION_SITES);
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
            // A second mule is only useful for building; otherwise it mostly upgraded as an
            // energy sink. Skip it and let storage grow into the 525k upgrader tier instead.
            if (storage.room && runtimeCache.find(storage.room, FIND_CONSTRUCTION_SITES).length) {
                config.muleMax++;
            }
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
        // Default configuration (idle / storage usage)
        // Labs 1-3 (min1..min3) are for high tier stockpiles / war boosts
        let config = {
            min1: RESOURCE_CATALYZED_KEANIUM_ALKALIDE,   // SHOOT
            min2: RESOURCE_CATALYZED_GHODIUM_ACID,       // UPGRADE
            min3: RESOURCE_CATALYZED_LEMERGIUM_ACID,     // REPAIR
            min4: '',                                    // Input A (reaction)
            min5: '',                                    // Input B (reaction)
            min6: ''                                     // Product (all output labs)
        };

        // War boost staging overrides min1..min3 (does not select reaction)
        if (Game.flags[roomName + 'WarBoosts']) {
            config.min1 = RESOURCE_CATALYZED_GHODIUM_ALKALIDE;   // TOUGH
            config.min2 = RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE;  // MOVE
            config.min3 = RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE; // HEAL
            // Keep any reaction selection logic below (allows producing while staged for war)
        }

        // Reaction chosen by the empire planner (system.labs); labWorkers re-sync every tick.
        const job = labPlanner.jobFor(roomName);
        if (job) {
            config.min4 = job.a;      // Input A lab4
            config.min5 = job.b;      // Input B lab5
            config.min6 = job.p;      // Product labs 6+
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

    // RCL8 without GCL focus: no permanent upgrader, only a small one while the downgrade timer
    // needs topping up; the upSupplier is then only kept for power processing.
    // Maintenance mode (finished RCL8 room, healthy stockpile, no threats): bare essentials.
    // Storage pays for spawning until it drops to the exit level, then miners return.
    lowCpuStaffing: function(room, limits) {
        const result = Object.assign({}, limits, { controllerUpkeep: false });
        if (room.controller.level == 8 && !maintenance.gclFocus()) {
            result.controllerUpkeep = true;
            result.upgraderMax = maintenance.upkeepDue(room.controller) ? 1 : 0;
            result.upgraderConfig = maintenance.upkeepBody();
            const powerSpawnIds = Memory.powerSpawnList[room.name] || [];
            const powerStock = (room.storage ? room.storage.store[RESOURCE_POWER] || 0 : 0) + (room.terminal ? room.terminal.store[RESOURCE_POWER] || 0 : 0);
            const powerToProcess = powerSpawnIds.length > 0 && powerStock >= 100;
            if (!powerToProcess) result.upSupplierMax = 0;
        }
        if (maintenance.inMaintenance(room.name)) {
            const operator = operatorPresent(room.name);
            result.minerMax = 0;
            result.repairMax = 0;
            result.muleMax = operator ? 0 : 1;                       // one hauler fills extensions too
            result.distributorMax = operator && limits.pNeedDist ? 1 : 0;
        }
        return result;
    },

    // Tombstones/drops worth a salvager trip, or a weak attack whose drops will need collecting.
    hasSalvage: function(room) {
        if (Memory.roomsPrepSalvager.indexOf(room.name) !== -1) return true;
        for (const tombstone of runtimeCache.find(room, FIND_TOMBSTONES)) {
            if (tombstone.store.getUsedCapacity() >= 200) return true;
        }
        let dropped = 0;
        for (const resource of runtimeCache.find(room, FIND_DROPPED_RESOURCES)) {
            if (!mineralBudget.isDumped(room.name, resource.resourceType)) dropped += resource.amount;
        }
        return dropped >= 1000;
    },

    // Supplier: 2 CARRY per MOVE (full speed on roads), up to 400 capacity. The old fixed
    // 150-capacity body needed ~7 withdraw/transfer round trips per tower refill.
    // Which directions this spawn may use for the tower supplier and for everything else.
    // Auto-build rooms with 3+ spawns make the supplier in the spawn beside the Supply flag,
    // straight onto the flag, and keep that direction free of other creeps. Only while such a spawn
    // actually exists: during base migration the old one may be gone and the new one not built
    // yet, and the room must still get its tower supplier from any spawn. No Supply flag: any
    // spawn, any direction. Returns { buildDirections, supplierDirection } (empty = not here).
    supplierDirections: function(thisRoom, spawn) {
        const buildDirections = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
        const supplyFlag = Game.flags[thisRoom.name + "Supply"];
        if (!supplyFlag) {
            return { buildDirections, supplierDirection: buildDirections };
        }
        const isAutoBuild = Memory.autoBuildRooms.indexOf(thisRoom.name) > -1;
        const roomSpawns = runtimeCache.find(thisRoom, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_SPAWN } });
        const supplySpawnExists = roomSpawns.some(s => s.pos.isNearTo(supplyFlag) && s.isActive());
        if (!(isAutoBuild && roomSpawns.length >= 3 && supplySpawnExists)) {
            return { buildDirections, supplierDirection: buildDirections };
        }
        if (!supplyFlag.pos.isNearTo(spawn)) {
            return { buildDirections, supplierDirection: [] };   // the Supply spawn makes it
        }
        const targetDir = spawn.pos.getDirectionTo(supplyFlag);
        return { buildDirections: buildDirections.filter(d => d !== targetDir), supplierDirection: [targetDir] };
    },

    supplierBody: function(energyCapacity) {
        const units = Math.max(1, Math.min(4, Math.floor(energyCapacity / 150)));
        const body = [];
        for (let i = 0; i < units; i++) body.push(CARRY, CARRY);
        for (let i = 0; i < units; i++) body.push(MOVE);
        return body;
    },

    // Distributor: 2 CARRY per MOVE up to 32/16 (48 parts, 1600 capacity).
    distributorBody: function(energyCapacity) {
        const units = Math.max(1, Math.min(16, Math.floor(energyCapacity / 150)));
        const body = [];
        for (let i = 0; i < units; i++) body.push(CARRY, CARRY);
        for (let i = 0; i < units; i++) body.push(MOVE);
        return body;
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

        // Ranged parts in front of the MOVE parts (combat.bodies.order).
        return require('combat.bodies').order(config);
    }
});

module.exports = spawn_BuildCreeps5;
