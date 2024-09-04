var spawn_BuildCreeps5 = {
    run: function (spawn, thisRoom, RoomCreeps, energyIndex) {
        let miners = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'miner'); //Only gathers, does not move after reaching source
        let upgradeMiners = _.filter(RoomCreeps, (creep) => creep.memory.jobSpecific == 'upgradeMiner');
        let storageMiners = _.filter(RoomCreeps, (creep) => creep.memory.jobSpecific == 'storageMiner');

        let mules = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'mule' || creep.memory.previousPriority == 'mule'); //Stores in spawn/towers, builds, upgrades
        let upgraders = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'upgrader'); //Kinda important, and stuff.
        let mineralMiners = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'mineralMiner');
        let repairers = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'repair' && !creep.memory.previousPriority);
        let suppliers = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'supplier');
        let distributors = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'distributor');
        let upSuppliers = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'upSupplier');
        let scrapers = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'scraper');

        let labWorkers = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'labWorker' || creep.memory.previousPriority == 'labWorker');

        let salvagers = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'salvager');

        let defenders = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'defender');

        let minerMax = 2;
        let muleMax = 1;
        let upgraderMax = 2;
        let repairMax = 1;
        let upSupplierMax = 1;
        if (thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] < 50000) {
            upSupplierMax = 0;
            repairMax = 0;
        }
        let supplierMax = 1;
        let distributorMax = 1;
        let labWorkerMax = 0;
        let salvagerMax = 1;
        let min1 = RESOURCE_CATALYZED_KEANIUM_ALKALIDE;
        let min2 = RESOURCE_CATALYZED_GHODIUM_ACID;
        let min3 = RESOURCE_CATALYZED_LEMERGIUM_ACID;
        let min4 = '';
        let min5 = '';
        let min6 = '';
        let primaryFlag = '';
        let backupFlag = '';
        if (Memory.labList[thisRoom.name].length >= 3 && thisRoom.terminal) {
            //Mineral loops

            //Unique : OH/G
            //T1 : UH/LO/ZH/GH/ZK/ZO/LH/UL/GO/KO - 10
            //T2 : GHO2/KHO2/ZHO2/ZH2O/UH2O/LH2O/LHO2/GH2O - 8
            //T3 : XGHO2/XKHO2/XZHO2/XZH2O/XUH2O/XLH2O/XLHO2/XGH2O - 8

            //Most Frequent (2 SETS PER GROUPING)
            //XGHO2/XGH2O/XUH2O
            //XZHO2/XZH2O/XKHO2
            //XLH2O/XLHO2/OH

            //Mid Frequency (1 SET PER GROUPING)
            //G/GHO2/GH2O
            //ZHO2/ZH2O/KHO2
            //UH2O/LH2O/LHO2

            //Low Frequency (1 SET PER GROUPING)
            //UH/KO/GH/GO
            //ZH/ZO/LO/LH
            //UL/ZK/G/OH

            //DO NOT CARE LIST : UO/KH
            if (Memory.labList[thisRoom.name].length >= 6) {
                if (Game.flags[thisRoom.name + "WarBoosts"]) {
                    min1 = RESOURCE_CATALYZED_GHODIUM_ALKALIDE;
                    min2 = RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE;
                    min3 = RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE;
                    min4 = RESOURCE_CATALYZED_ZYNTHIUM_ACID;
                    min5 = RESOURCE_CATALYZED_UTRIUM_ACID;
                    min6 = RESOURCE_CATALYZED_KEANIUM_ALKALIDE;
                } else if (Game.flags[thisRoom.name + "XGHO2Producer"]) {
                    //1
                    min4 = RESOURCE_GHODIUM_ALKALIDE;
                    min5 = RESOURCE_CATALYST;
                    min6 = RESOURCE_CATALYZED_GHODIUM_ALKALIDE;
                    primaryFlag = thisRoom.name + "XGHO2Producer";
                    backupFlag = thisRoom.name + "XGH2OProducer";
                } else if (Game.flags[thisRoom.name + "XGH2OProducer"]) {
                    //1
                    min4 = RESOURCE_GHODIUM_ACID;
                    min5 = RESOURCE_CATALYST;
                    min6 = RESOURCE_CATALYZED_GHODIUM_ACID;
                    primaryFlag = thisRoom.name + "XGH2OProducer";
                    backupFlag = thisRoom.name + "XUH2OProducer";
                } else if (Game.flags[thisRoom.name + "XUH2OProducer"]) {
                    //1
                    min4 = RESOURCE_UTRIUM_ACID;
                    min5 = RESOURCE_CATALYST;
                    min6 = RESOURCE_CATALYZED_UTRIUM_ACID;
                    primaryFlag = thisRoom.name + "XUH2OProducer";
                    backupFlag = thisRoom.name + "XGHO2Producer";
                } else if (Game.flags[thisRoom.name + "XZHO2Producer"]) {
                    //2
                    min4 = RESOURCE_ZYNTHIUM_ALKALIDE;
                    min5 = RESOURCE_CATALYST;
                    min6 = RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE;
                    primaryFlag = thisRoom.name + "XZHO2Producer";
                    backupFlag = thisRoom.name + "XZH2OProducer";
                } else if (Game.flags[thisRoom.name + "XZH2OProducer"]) {
                    //2
                    min4 = RESOURCE_ZYNTHIUM_ACID;
                    min5 = RESOURCE_CATALYST;
                    min6 = RESOURCE_CATALYZED_ZYNTHIUM_ACID;
                    primaryFlag = thisRoom.name + "XZH2OProducer";
                    backupFlag = thisRoom.name + "XKHO2Producer";
                } else if (Game.flags[thisRoom.name + "XKHO2Producer"]) {
                    //2
                    min4 = RESOURCE_KEANIUM_ALKALIDE;
                    min5 = RESOURCE_CATALYST;
                    min6 = RESOURCE_CATALYZED_KEANIUM_ALKALIDE;
                    primaryFlag = thisRoom.name + "XKHO2Producer";
                    backupFlag = thisRoom.name + "XZHO2Producer";
                } else if (Game.flags[thisRoom.name + "XLH2OProducer"]) {
                    //3
                    min4 = RESOURCE_LEMERGIUM_ACID;
                    min5 = RESOURCE_CATALYST;
                    min6 = RESOURCE_CATALYZED_LEMERGIUM_ACID;
                    primaryFlag = thisRoom.name + "XLH2OProducer";
                    backupFlag = thisRoom.name + "XLHO2Producer";
                } else if (Game.flags[thisRoom.name + "XLHO2Producer"]) {
                    //3
                    min4 = RESOURCE_LEMERGIUM_ALKALIDE;
                    min5 = RESOURCE_CATALYST;
                    min6 = RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE;
                    primaryFlag = thisRoom.name + "XLHO2Producer";
                    backupFlag = thisRoom.name + "OHProducer(3)";
                } else if (Game.flags[thisRoom.name + "OHProducer(3)"]) {
                    //3
                    min4 = RESOURCE_OXYGEN;
                    min5 = RESOURCE_HYDROGEN;
                    min6 = RESOURCE_HYDROXIDE;
                    primaryFlag = thisRoom.name + "OHProducer(3)";
                    backupFlag = thisRoom.name + "XLH2OProducer";
                } else if (Game.flags[thisRoom.name + "GProducer(4)"]) {
                    //4
                    min4 = RESOURCE_UTRIUM_LEMERGITE;
                    min5 = RESOURCE_ZYNTHIUM_KEANITE;
                    min6 = RESOURCE_GHODIUM;
                    primaryFlag = thisRoom.name + "GProducer(4)";
                    backupFlag = thisRoom.name + "GHO2Producer";
                } else if (Game.flags[thisRoom.name + "GHO2Producer"]) {
                    //4
                    min4 = RESOURCE_GHODIUM_OXIDE;
                    min5 = RESOURCE_HYDROXIDE;
                    min6 = RESOURCE_GHODIUM_ALKALIDE;
                    primaryFlag = thisRoom.name + "GHO2Producer";
                    backupFlag = thisRoom.name + "GH2OProducer";
                } else if (Game.flags[thisRoom.name + "GH2OProducer"]) {
                    //4
                    min4 = RESOURCE_GHODIUM_HYDRIDE;
                    min5 = RESOURCE_HYDROXIDE;
                    min6 = RESOURCE_GHODIUM_ACID;
                    primaryFlag = thisRoom.name + "GH2OProducer";
                    backupFlag = thisRoom.name + "GProducer(4)";
                } else if (Game.flags[thisRoom.name + "ZHO2Producer"]) {
                    //5
                    min4 = RESOURCE_ZYNTHIUM_OXIDE;
                    min5 = RESOURCE_HYDROXIDE;
                    min6 = RESOURCE_ZYNTHIUM_ALKALIDE;
                    primaryFlag = thisRoom.name + "ZHO2Producer";
                    backupFlag = thisRoom.name + "ZH2OProducer";
                } else if (Game.flags[thisRoom.name + "ZH2OProducer"]) {
                    //5
                    min4 = RESOURCE_ZYNTHIUM_HYDRIDE;
                    min5 = RESOURCE_HYDROXIDE;
                    min6 = RESOURCE_ZYNTHIUM_ACID;
                    primaryFlag = thisRoom.name + "ZH2OProducer";
                    backupFlag = thisRoom.name + "KHO2Producer";
                } else if (Game.flags[thisRoom.name + "KHO2Producer"]) {
                    //5
                    min4 = RESOURCE_KEANIUM_OXIDE;
                    min5 = RESOURCE_HYDROXIDE;
                    min6 = RESOURCE_KEANIUM_ALKALIDE;
                    primaryFlag = thisRoom.name + "KHO2Producer";
                    backupFlag = thisRoom.name + "ZHO2Producer";
                } else if (Game.flags[thisRoom.name + "UH2OProducer"]) {
                    //6
                    min4 = RESOURCE_UTRIUM_HYDRIDE;
                    min5 = RESOURCE_HYDROXIDE;
                    min6 = RESOURCE_UTRIUM_ACID;
                    primaryFlag = thisRoom.name + "UH2OProducer";
                    backupFlag = thisRoom.name + "LH2OProducer";
                } else if (Game.flags[thisRoom.name + "LH2OProducer"]) {
                    //6
                    min4 = RESOURCE_LEMERGIUM_HYDRIDE;
                    min5 = RESOURCE_HYDROXIDE;
                    min6 = RESOURCE_LEMERGIUM_ACID;
                    primaryFlag = thisRoom.name + "LH2OProducer";
                    backupFlag = thisRoom.name + "LHO2Producer";
                } else if (Game.flags[thisRoom.name + "LHO2Producer"]) {
                    //6
                    min4 = RESOURCE_LEMERGIUM_OXIDE;
                    min5 = RESOURCE_HYDROXIDE;
                    min6 = RESOURCE_LEMERGIUM_ALKALIDE;
                    primaryFlag = thisRoom.name + "LHO2Producer";
                    backupFlag = thisRoom.name + "UH2OProducer";
                } else if (Game.flags[thisRoom.name + "UHProducer"]) {
                    //7
                    min4 = RESOURCE_UTRIUM;
                    min5 = RESOURCE_HYDROGEN;
                    min6 = RESOURCE_UTRIUM_HYDRIDE;
                    primaryFlag = thisRoom.name + "UHProducer";
                    backupFlag = thisRoom.name + "GHProducer";
                } else if (Game.flags[thisRoom.name + "GHProducer"]) {
                    //7
                    min4 = RESOURCE_GHODIUM;
                    min5 = RESOURCE_HYDROGEN;
                    min6 = RESOURCE_GHODIUM_HYDRIDE;
                    primaryFlag = thisRoom.name + "GHProducer";
                    backupFlag = thisRoom.name + "GOProducer";
                } else if (Game.flags[thisRoom.name + "GOProducer"]) {
                    //7
                    min4 = RESOURCE_GHODIUM;
                    min5 = RESOURCE_OXYGEN;
                    min6 = RESOURCE_GHODIUM_OXIDE;
                    primaryFlag = thisRoom.name + "GOProducer";
                    backupFlag = thisRoom.name + "KOProducer";
                } else if (Game.flags[thisRoom.name + "KOProducer"]) {
                    //7
                    min4 = RESOURCE_KEANIUM;
                    min5 = RESOURCE_OXYGEN;
                    min6 = RESOURCE_KEANIUM_OXIDE;
                    primaryFlag = thisRoom.name + "KOProducer";
                    backupFlag = thisRoom.name + "UHProducer";
                } else if (Game.flags[thisRoom.name + "ZHProducer"]) {
                    //8
                    min4 = RESOURCE_ZYNTHIUM;
                    min5 = RESOURCE_HYDROGEN;
                    min6 = RESOURCE_ZYNTHIUM_HYDRIDE;
                    primaryFlag = thisRoom.name + "ZHProducer";
                    backupFlag = thisRoom.name + "ZOProducer";
                } else if (Game.flags[thisRoom.name + "ZOProducer"]) {
                    //8
                    min4 = RESOURCE_ZYNTHIUM;
                    min5 = RESOURCE_OXYGEN;
                    min6 = RESOURCE_ZYNTHIUM_OXIDE;
                    primaryFlag = thisRoom.name + "ZOProducer";
                    backupFlag = thisRoom.name + "LOProducer";
                } else if (Game.flags[thisRoom.name + "LOProducer"]) {
                    //8
                    min4 = RESOURCE_LEMERGIUM;
                    min5 = RESOURCE_OXYGEN;
                    min6 = RESOURCE_LEMERGIUM_OXIDE;
                    primaryFlag = thisRoom.name + "LOProducer";
                    backupFlag = thisRoom.name + "LHProducer";
                } else if (Game.flags[thisRoom.name + "LHProducer"]) {
                    //8
                    min4 = RESOURCE_LEMERGIUM;
                    min5 = RESOURCE_HYDROGEN;
                    min6 = RESOURCE_LEMERGIUM_HYDRIDE;
                    primaryFlag = thisRoom.name + "LHProducer";
                    backupFlag = thisRoom.name + "ZHProducer";
                } else if (Game.flags[thisRoom.name + "ULProducer"]) {
                    //9
                    min4 = RESOURCE_UTRIUM;
                    min5 = RESOURCE_LEMERGIUM;
                    min6 = RESOURCE_UTRIUM_LEMERGITE;
                    primaryFlag = thisRoom.name + "ULProducer";
                    backupFlag = thisRoom.name + "ZKProducer";
                } else if (Game.flags[thisRoom.name + "ZKProducer"]) {
                    //9
                    min4 = RESOURCE_ZYNTHIUM;
                    min5 = RESOURCE_KEANIUM;
                    min6 = RESOURCE_ZYNTHIUM_KEANITE;
                    primaryFlag = thisRoom.name + "ZKProducer";
                    backupFlag = thisRoom.name + "GProducer(9)";
                } else if (Game.flags[thisRoom.name + "GProducer(9)"]) {
                    //9
                    min4 = RESOURCE_UTRIUM_LEMERGITE;
                    min5 = RESOURCE_ZYNTHIUM_KEANITE;
                    min6 = RESOURCE_GHODIUM;
                    primaryFlag = thisRoom.name + "GProducer(9)";
                    backupFlag = thisRoom.name + "OHProducer(9)";
                } else if (Game.flags[thisRoom.name + "OHProducer(9)"]) {
                    //9
                    min4 = RESOURCE_OXYGEN;
                    min5 = RESOURCE_HYDROGEN;
                    min6 = RESOURCE_HYDROXIDE;
                    primaryFlag = thisRoom.name + "OHProducer(9)";
                    backupFlag = thisRoom.name + "ULProducer";
                }
            }

            labWorkerMax = 1;
        }
        let strSources = Memory.sourceList[thisRoom.name];
        let strLinks = Memory.linkList[thisRoom.name];
        let scraperMax = 0;
        if (strLinks.length < 4) {
            scraperMax = 1;
        }
        let strMineral = Memory.mineralList[thisRoom.name];
        let strTerminal = "";
        if (thisRoom.terminal) {
            strTerminal = thisRoom.terminal.id;
        }
        let strExtractor = Memory.extractorList[thisRoom.name];
        let readyForMineral = false;
        let mineralType = Game.getObjectById(strMineral[0]).mineralType;

        if (strExtractor[0] && thisRoom.terminal && strMineral[0] && (!thisRoom.terminal.store[mineralType] || thisRoom.terminal.store[mineralType] <= 10000)) {
            readyForMineral = true;
        }

        if (thisRoom.energyCapacityAvailable >= 1550) {
            upgraderMax--;
        }

        let pNeedDist = false;
        let regenPower = 0;

        if (thisRoom.controller.level == 8) {
            //Minimize staffing
            muleMax = 1;
            upgraderMax = 1;
            repairMax = 1;
            upSupplierMax = 1;
            supplierMax = 1;
            distributorMax = 1;
            salvagerMax = 0;
            if (Game.flags[thisRoom.name + "25mCap"] || Game.flags[thisRoom.name + "50mCap"]) {
                repairMax = 0;
            }
            if (thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] <= 50000) {
                //Something's fucked
                upgraderMax = 0;
                upSupplierMax = 0;
                repairMax = 0;
            } else if (thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] <= 100000) {
                repairMax = 0;
            } else if (thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] >= 700000) {
                repairMax = 2;
            }
            if (Game.flags[thisRoom.name + "RoomOperator"]) {
                //The RoomOperator is robust enough to make up for multiple roles
                upSupplierMax = 0;
                distributorMax = 0;
                muleMax = 0;
                repairMax = 2;
                for (let pName in Game.powerCreeps) {
                    if (Game.powerCreeps[pName].memory.homeRoom && Game.powerCreeps[pName].memory.homeRoom == thisRoom.name) {
                        //Found power creep, check abilities and adjust
                        let thisPCreep = Game.powerCreeps[pName]
                            //Check extention fill capacity
                            if (!thisPCreep.powers[PWR_OPERATE_EXTENSION] || (thisPCreep.powers[PWR_OPERATE_EXTENSION] && thisPCreep.powers[PWR_OPERATE_EXTENSION].level < 5)) {
                                pNeedDist = true;
                                distributorMax = 1;
                            }
                            //Check regen source strength
                            if (thisPCreep.powers[PWR_REGEN_SOURCE]) {
                                regenPower = thisPCreep.powers[PWR_REGEN_SOURCE].level
                            }
                            break;
                    }
                }
                //labWorkerMax = 0;
                if (Game.flags[thisRoom.name + "RunningAssault"]) {
                    //To aid with lab refilling
                    distributorMax = 1;
                }
                if (thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] <= 50000) {
                    //Something's fucked
                    repairMax = 0;
                    upgraderMax = 0;
                } else if (thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] >= 700000) {
                    repairMax = 4;
                }

                let someSites = thisRoom.find(FIND_CONSTRUCTION_SITES);
                if (someSites.length) {
                    //Need builders
                    muleMax = 2;
                }
            }
        } else if (thisRoom.storage) {
            if (thisRoom.storage.store[RESOURCE_ENERGY] >= 115000) {
                upgraderMax++;
                //muleMax++;
            }
            if (thisRoom.storage.store[RESOURCE_ENERGY] >= 225000) {
                //Add another mule for resource management
                upgraderMax++;
                muleMax++;
            }
            if (thisRoom.storage.store[RESOURCE_ENERGY] >= 375000) {
                //speed up that repairing a bit
                repairMax++;
            }
            if (thisRoom.storage.store[RESOURCE_ENERGY] >= 525000) {
                //HOW MUCH MUST I CRANK IT UP?
                upgraderMax = upgraderMax + 2;
            }

            if (storageMiners.length == 0 && upgradeMiners.length > 0 && thisRoom.storage.store[RESOURCE_ENERGY] <= 3000) {
                //reassign upgrade miner
                upgradeMiners[0].drop(RESOURCE_ENERGY);
                upgradeMiners[0].memory.jobSpecific = 'storageMiner';
                upgradeMiners[0].memory.linkSource = thisRoom.storage.id
                    upgradeMiners[0].memory.mineSource = strSources[0];
                upgradeMiners[0].memory.ignoreTravel = false;
                upgradeMiners[0].memory.atSpot = false;
                upgradeMiners = _.filter(RoomCreeps, (creep) => creep.memory.jobSpecific == 'upgradeMiner');
                storageMiners = _.filter(RoomCreeps, (creep) => creep.memory.jobSpecific == 'storageMiner');
            }
        }

        let roomMineral = Game.getObjectById(strMineral[0]);

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
        let supplierDirection = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
		if (Memory.autoBuildRooms.indexOf(thisRoom.name) > -1) {
			supplierDirection = [];
			//Determine if this spawn is next to the supply flag, and if so, restrict spawn directions
			if (Game.flags[thisRoom.name + "Supply"] && Game.flags[thisRoom.name + "Supply"].pos.isNearTo(spawn)) {
				let targetDir = spawn.pos.getDirectionTo(Game.flags[thisRoom.name + "Supply"]);
				//Remove direction from buildDirections, add it to supplierDirection
				buildDirections.splice(buildDirections.indexOf(targetDir), 1);
				supplierDirection.push(targetDir)
			}
		}


        if (RoomCreeps.length <= 1) {
            if (thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] >= 500) {
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

            let blockedRole = ''
                let queLength = Memory.creepInQue.length;
            for (var i = 0; i < queLength; i++) {
                if (Memory.creepInQue[i] == thisRoom.name) {
                    blockedRole = blockedRole + ' ' + Memory.creepInQue[i + 1];
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
                //6500 = build total

                //Try to produce millitary units

                //Melee unit set: TOUGH, TOUGH, MOVE, MOVE, MOVE, ATTACK - 250
                //Ranged unit set: MOVE, MOVE, RANGED_ATTACK - 250

                //Check for the ideal defender before actually going through with it

                var ToughCount = 0;
                var MoveCount = 0;
                var AttackCount = 0;
                var RangedCount = 0;
                var totalParts = 0;

                //var remainingEnergy = Memory.CurrentRoomEnergy[energyIndex];
                var remainingEnergy = thisRoom.energyCapacityAvailable;
                var buildTotal = 0
                    var thisBuildAmount = 650;
                while ((remainingEnergy / thisBuildAmount) >= 1) {
                    //switch (ChosenPriority) {
                    //case 'melee':
                    //ToughCount = ToughCount + 1;
                    MoveCount = MoveCount + 1;
                    RangedCount = RangedCount + 4;
                    remainingEnergy = remainingEnergy - 650;
                    buildTotal += 650;
                    //RangedCount = RangedCount + 1;
                    totalParts = totalParts + 5;
                    //break;
                    //case 'ranged':
                    //MoveCount = MoveCount + 2;
                    //RangedCount = RangedCount + 2;
                    //totalParts = totalParts + 4;
                    //remainingEnergy = remainingEnergy - 400;
                    //break;
                    //}

                    if (totalParts >= 50) {
                        break;
                    }
                }

                var ChosenCreepSet = [];
                while (ToughCount > 0) {
                    ChosenCreepSet.push(TOUGH);
                    ToughCount--;
                }
                while (AttackCount > 0) {
                    ChosenCreepSet.push(ATTACK);
                    AttackCount--;
                }
                while (RangedCount > 0) {
                    ChosenCreepSet.push(RANGED_ATTACK);
                    RangedCount--;
                }
                while (MoveCount > 0) {
                    ChosenCreepSet.push(MOVE);
                    MoveCount--;
                }

                if (ChosenCreepSet.length > 50) {
                    while (ChosenCreepSet.length > 50) {
                        ChosenCreepSet.splice(0, 1);
                    }
                }

                if (buildTotal <= Memory.CurrentRoomEnergy[energyIndex]) {
                    Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - buildTotal;
                    spawn.spawnCreep(ChosenCreepSet, 'defender_' + spawn.name + '_' + Game.time, {
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
        if (!Memory.isSpawning && (miners.length < minerMax || mules.length < muleMax || upgraders.length < upgraderMax || repairers.length < repairMax || suppliers.length < supplierMax || distributors.length < distributorMax || labWorkers.length < labWorkerMax || upSuppliers.length < upSupplierMax || scrapers.length < scraperMax || salvagers.length < salvagerMax) || (roomMineral.mineralAmount > 0 && mineralMiners.length == 0 && readyForMineral)) {
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
                    //Check if spawn still exists/is active. If not, ignore
                    if (!Game.spawns[Memory.creepInQue[i + 3]]) {
                        purgeIDs.push(i);
                    } else if (!Game.spawns[Memory.creepInQue[i + 3]].isActive()) {
                        purgeIDs.push(i);
                    } else {
                        blockedRole = blockedRole + ' ' + Memory.creepInQue[i + 1];
                        blockedSubRole = blockedSubRole + ' ' + Memory.creepInQue[i + 2];
                    }
                }
            }

            if (purgeIDs.length > 0) {
                //Only remove one at a time, removing one index is going to skew other indicies
                Memory.creepInQue.splice(purgeIDs[0], 4);
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
                        if (strLinks.length >= 4) {
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
            } else if (roomMineral.mineralAmount > 0 && mineralMiners.length == 0 && readyForMineral && !blockedRole.includes('mineralMiner') && thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] >= 50000) {
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
                        repairConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
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
                            directions: buildDirections
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
                    if (Memory.factoryList[thisRoom.name].length) {
                        factoryID = Memory.factoryList[thisRoom.name][0];
                    }
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

            var queLength = Memory.creepInQue.length;
            for (var i = 0; i < queLength; i++) {
                if (Memory.creepInQue[i] == thisRoom.name) {
                    blockedRole = blockedRole + ' ' + Memory.creepInQue[i + 1];
                    blockedSubRole = blockedSubRole + ' ' + Memory.creepInQue[i + 2];
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

module.exports = spawn_BuildCreeps5;