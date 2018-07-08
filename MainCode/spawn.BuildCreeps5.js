var spawn_BuildCreeps5 = {
    run: function(spawn, thisRoom, RoomCreeps, energyIndex) {
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

        let labWorkers = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'labWorker');

        let salvagers = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'salvager');

        let defenders = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'defender');

        let minerMax = 2;
        let muleMax = 1;
        let upgraderMax = 2;
        let repairMax = 1;
        let upSupplierMax = 1;
        if (thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] < 100000) {
            upSupplierMax = 0;
            repairMax = 0;
        }
        let scraperMax = 0;
        if (thisRoom.controller.level < 7) {
            scraperMax = 1;
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
            //SHARD 0 COUNTS
            //1: UH/LO/ZH - 1 (E87N85)        
            //2: OH/G/GH/GH2O/XGH2O - 4 (E88N83, E86N83, E85N89, E88N75)           
            //3: UH2O/ZHO2/LHO2 - 1 (E89N83)          
            //4: ZK/ZO/ZH2O - 2 (E89N86, E88N87)          
            //5: LH/UL/XLHO2 - 2 (E84N77, E81N79)        
            //6: GHO2/LH2O/XLH2O/GO - 2 (E88N88, E77N83)          
            //7: XUH2O/XZH2O/XZHO2 - 1 (E86N68)            
            //8: KO/KHO2/XKHO2/XGHO2 - 1 (E74N81)
            //SHARD 1 COUNTS
            //1: UH/LO/ZH - 1
            //2: OH/G/GH/GH2O/XGH2O - 1
            //3: UH2O/ZHO2/LHO2 - 1
            //4: ZK/ZO/ZH2O - 1
            //5: LH/UL/XLHO2 - 1
            //6: GHO2/LH2O/XLH2O/GO - 1
            //7: XUH2O/XZH2O/XZHO2 - 1
            //8: KO/KHO2/XKHO2/XGHO2 - 1
            //DO NOT CARE LIST : UO/KH
            if (Memory.labList[thisRoom.name].length >= 6) {
                if (Game.flags[thisRoom.name + "WarBoosts"]) {
                    min1 = RESOURCE_CATALYZED_UTRIUM_ACID;
                    min2 = RESOURCE_CATALYZED_KEANIUM_ALKALIDE;
                    min3 = RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE;
                    min4 = RESOURCE_CATALYZED_ZYNTHIUM_ACID;
                    min5 = RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE;
                    min6 = RESOURCE_CATALYZED_GHODIUM_ALKALIDE;
                } else if (Game.flags[thisRoom.name + "UHProducer"]) {
                    min4 = RESOURCE_UTRIUM;
                    min5 = RESOURCE_HYDROGEN;
                    min6 = RESOURCE_UTRIUM_HYDRIDE;
                    primaryFlag = thisRoom.name + "UHProducer";
                    backupFlag = thisRoom.name + "LOProducer";
                } else if (Game.flags[thisRoom.name + "OHProducer"]) {
                    min4 = RESOURCE_OXYGEN;
                    min5 = RESOURCE_HYDROGEN;
                    min6 = RESOURCE_HYDROXIDE;
                    primaryFlag = thisRoom.name + "OHProducer";
                    backupFlag = thisRoom.name + "GProducer";
                } else if (Game.flags[thisRoom.name + "UH2OProducer"]) {
                    min4 = RESOURCE_UTRIUM_HYDRIDE;
                    min5 = RESOURCE_HYDROXIDE;
                    min6 = RESOURCE_UTRIUM_ACID;
                    primaryFlag = thisRoom.name + "UH2OProducer";
                    backupFlag = thisRoom.name + "ZHO2Producer";
                } else if (Game.flags[thisRoom.name + "ZHO2Producer"]) {
                    min4 = RESOURCE_ZYNTHIUM_OXIDE;
                    min5 = RESOURCE_HYDROXIDE;
                    min6 = RESOURCE_ZYNTHIUM_ALKALIDE;
                    primaryFlag = thisRoom.name + "ZHO2Producer";
                    backupFlag = thisRoom.name + "LHO2Producer";
                } else if (Game.flags[thisRoom.name + "LHO2Producer"]) {
                    min4 = RESOURCE_LEMERGIUM_OXIDE;
                    min5 = RESOURCE_HYDROXIDE;
                    min6 = RESOURCE_LEMERGIUM_ALKALIDE;
                    primaryFlag = thisRoom.name + "LHO2Producer";
                    backupFlag = thisRoom.name + "UH2OProducer";
                } else if (Game.flags[thisRoom.name + "ZH2OProducer"]) {
                    min4 = RESOURCE_ZYNTHIUM_HYDRIDE;
                    min5 = RESOURCE_HYDROXIDE;
                    min6 = RESOURCE_ZYNTHIUM_ACID;
                    primaryFlag = thisRoom.name + "ZH2OProducer";
                    backupFlag = thisRoom.name + "ZKProducer";
                } else if (Game.flags[thisRoom.name + "ZKProducer"]) {
                    min4 = RESOURCE_ZYNTHIUM;
                    min5 = RESOURCE_KEANIUM;
                    min6 = RESOURCE_ZYNTHIUM_KEANITE;
                    primaryFlag = thisRoom.name + "ZKProducer";
                    backupFlag = thisRoom.name + "ZOProducer";
                } else if (Game.flags[thisRoom.name + "ZOProducer"]) {
                    min4 = RESOURCE_ZYNTHIUM;
                    min5 = RESOURCE_OXYGEN;
                    min6 = RESOURCE_ZYNTHIUM_OXIDE;
                    primaryFlag = thisRoom.name + "ZOProducer";
                    backupFlag = thisRoom.name + "ZH2OProducer";
                } else if (Game.flags[thisRoom.name + "LHProducer"]) {
                    min4 = RESOURCE_LEMERGIUM;
                    min5 = RESOURCE_HYDROGEN;
                    min6 = RESOURCE_LEMERGIUM_HYDRIDE;
                    primaryFlag = thisRoom.name + "LHProducer";
                    backupFlag = thisRoom.name + "ULProducer";
                } else if (Game.flags[thisRoom.name + "LOProducer"]) {
                    min4 = RESOURCE_LEMERGIUM;
                    min5 = RESOURCE_OXYGEN;
                    min6 = RESOURCE_LEMERGIUM_OXIDE;
                    primaryFlag = thisRoom.name + "LOProducer";
                    backupFlag = thisRoom.name + "ZHProducer";
                } else if (Game.flags[thisRoom.name + "ZHProducer"]) {
                    min4 = RESOURCE_ZYNTHIUM;
                    min5 = RESOURCE_HYDROGEN;
                    min6 = RESOURCE_ZYNTHIUM_HYDRIDE;
                    primaryFlag = thisRoom.name + "ZHProducer";
                    backupFlag = thisRoom.name + "UHProducer";
                } else if (Game.flags[thisRoom.name + "ULProducer"]) {
                    min4 = RESOURCE_UTRIUM;
                    min5 = RESOURCE_LEMERGIUM;
                    min6 = RESOURCE_UTRIUM_LEMERGITE;
                    primaryFlag = thisRoom.name + "ULProducer";
                    backupFlag = thisRoom.name + "XLHO2Producer";
                } else if (Game.flags[thisRoom.name + "XLHO2Producer"]) {
                    min4 = RESOURCE_LEMERGIUM_ALKALIDE;
                    min5 = RESOURCE_CATALYST;
                    min6 = RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE;
                    primaryFlag = thisRoom.name + "XLHO2Producer";
                    backupFlag = thisRoom.name + "LHProducer";
                } else if (Game.flags[thisRoom.name + "GProducer"]) {
                    min4 = RESOURCE_UTRIUM_LEMERGITE;
                    min5 = RESOURCE_ZYNTHIUM_KEANITE;
                    min6 = RESOURCE_GHODIUM;
                    primaryFlag = thisRoom.name + "GProducer";
                    backupFlag = thisRoom.name + "GHProducer";
                } else if (Game.flags[thisRoom.name + "GHProducer"]) {
                    min4 = RESOURCE_GHODIUM;
                    min5 = RESOURCE_HYDROGEN;
                    min6 = RESOURCE_GHODIUM_HYDRIDE;
                    primaryFlag = thisRoom.name + "GHProducer";
                    backupFlag = thisRoom.name + "GH2OProducer";
                } else if (Game.flags[thisRoom.name + "GOProducer"]) {
                    min4 = RESOURCE_GHODIUM;
                    min5 = RESOURCE_OXYGEN;
                    min6 = RESOURCE_GHODIUM_OXIDE;
                    primaryFlag = thisRoom.name + "GOProducer";
                    backupFlag = thisRoom.name + "GHO2Producer";
                } else if (Game.flags[thisRoom.name + "GHO2Producer"]) {
                    min4 = RESOURCE_GHODIUM_OXIDE;
                    min5 = RESOURCE_HYDROXIDE;
                    min6 = RESOURCE_GHODIUM_ALKALIDE;
                    primaryFlag = thisRoom.name + "GHO2Producer";
                    backupFlag = thisRoom.name + "LH2OProducer";
                } else if (Game.flags[thisRoom.name + "GH2OProducer"]) {
                    min4 = RESOURCE_GHODIUM_HYDRIDE;
                    min5 = RESOURCE_HYDROXIDE;
                    min6 = RESOURCE_GHODIUM_ACID;
                    primaryFlag = thisRoom.name + "GH2OProducer";
                    backupFlag = thisRoom.name + "XGH2OProducer";
                } else if (Game.flags[thisRoom.name + "XGH2OProducer"]) {
                    min4 = RESOURCE_GHODIUM_ACID;
                    min5 = RESOURCE_CATALYST;
                    min6 = RESOURCE_CATALYZED_GHODIUM_ACID;
                    primaryFlag = thisRoom.name + "XGH2OProducer";
                    backupFlag = thisRoom.name + "OHProducer";
                } else if (Game.flags[thisRoom.name + "LH2OProducer"]) {
                    min4 = RESOURCE_LEMERGIUM_HYDRIDE;
                    min5 = RESOURCE_HYDROXIDE;
                    min6 = RESOURCE_LEMERGIUM_ACID;
                    primaryFlag = thisRoom.name + "LH2OProducer";
                    backupFlag = thisRoom.name + "XLH2OProducer";
                } else if (Game.flags[thisRoom.name + "XLH2OProducer"]) {
                    min4 = RESOURCE_LEMERGIUM_ACID;
                    min5 = RESOURCE_CATALYST;
                    min6 = RESOURCE_CATALYZED_LEMERGIUM_ACID;
                    primaryFlag = thisRoom.name + "XLH2OProducer";
                    backupFlag = thisRoom.name + "GOProducer";
                } else if (Game.flags[thisRoom.name + "XUH2OProducer"]) {
                    min4 = RESOURCE_UTRIUM_ACID;
                    min5 = RESOURCE_CATALYST;
                    min6 = RESOURCE_CATALYZED_UTRIUM_ACID;
                    primaryFlag = thisRoom.name + "XUH2OProducer";
                    backupFlag = thisRoom.name + "XZH2OProducer";
                } else if (Game.flags[thisRoom.name + "XZH2OProducer"]) {
                    min4 = RESOURCE_ZYNTHIUM_ACID;
                    min5 = RESOURCE_CATALYST;
                    min6 = RESOURCE_CATALYZED_ZYNTHIUM_ACID;
                    primaryFlag = thisRoom.name + "XZH2OProducer";
                    backupFlag = thisRoom.name + "XZHO2Producer";
                } else if (Game.flags[thisRoom.name + "XZHO2Producer"]) {
                    min4 = RESOURCE_ZYNTHIUM_ALKALIDE;
                    min5 = RESOURCE_CATALYST;
                    min6 = RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE;
                    primaryFlag = thisRoom.name + "XZHO2Producer";
                    backupFlag = thisRoom.name + "XUH2OProducer";
                } else if (Game.flags[thisRoom.name + "KOProducer"]) {
                    min4 = RESOURCE_OXYGEN;
                    min5 = RESOURCE_KEANIUM;
                    min6 = RESOURCE_KEANIUM_OXIDE;
                    primaryFlag = thisRoom.name + "KOProducer";
                    backupFlag = thisRoom.name + "KHO2Producer";
                } else if (Game.flags[thisRoom.name + "KHO2Producer"]) {
                    min4 = RESOURCE_KEANIUM_OXIDE;
                    min5 = RESOURCE_HYDROXIDE;
                    min6 = RESOURCE_KEANIUM_ALKALIDE;
                    primaryFlag = thisRoom.name + "KHO2Producer";
                    backupFlag = thisRoom.name + "XKHO2Producer";
                } else if (Game.flags[thisRoom.name + "XKHO2Producer"]) {
                    min4 = RESOURCE_KEANIUM_ALKALIDE;
                    min5 = RESOURCE_CATALYST;
                    min6 = RESOURCE_CATALYZED_KEANIUM_ALKALIDE;
                    primaryFlag = thisRoom.name + "XKHO2Producer";
                    backupFlag = thisRoom.name + "XGHO2Producer";
                } else if (Game.flags[thisRoom.name + "XGHO2Producer"]) {
                    min4 = RESOURCE_GHODIUM_ALKALIDE;
                    min5 = RESOURCE_CATALYST;
                    min6 = RESOURCE_CATALYZED_GHODIUM_ALKALIDE;
                    primaryFlag = thisRoom.name + "XGHO2Producer";
                    backupFlag = thisRoom.name + "KOProducer";
                }
            }
            labWorkerMax = 1;
        }
        let strSources = Memory.sourceList[thisRoom.name];
        let strLinks = Memory.linkList[thisRoom.name];
        let strMineral = Memory.mineralList[thisRoom.name];
        let strTerminal = "";
        if (thisRoom.terminal) {
            strTerminal = thisRoom.terminal.id;
        }
        let strExtractor = Memory.extractorList[thisRoom.name];
        let readyForMineral = false;
        if (strExtractor[0] && thisRoom.terminal && strMineral[0] && (thisRoom.terminal.storeCapacity - 25000) > _.sum(thisRoom.terminal.store)) {
            readyForMineral = true;
        }

        if (thisRoom.energyCapacityAvailable >= 1550) {
            upgraderMax--;
        }


        if (thisRoom.storage) {
        	if (thisRoom.controller.level != 8 && thisRoom.storage.store[RESOURCE_ENERGY] >= 115000) {
        		//upgraderMax++;
        		muleMax++;
        	}
            if (thisRoom.storage.store[RESOURCE_ENERGY] >= 225000) {
                //Add another mule for resource management
                if (thisRoom.controller.level != 8) {
                	upgraderMax++;
                }
                muleMax++;
            }
            if (thisRoom.storage.store[RESOURCE_ENERGY] >= 375000) {
                //speed up that repairing a bit
                repairMax++;
            }
            if (thisRoom.storage.store[RESOURCE_ENERGY] >= 525000) {
                //HOW MUCH MUST I CRANK IT UP?
                repairMax++;
                muleMax++;
            }

            if (storageMiners.length == 0 && upgradeMiners.length > 0 && thisRoom.storage.store[RESOURCE_ENERGY] <= 3000) {
                //reassign upgrade miner
                upgradeMiners[0].drop(RESOURCE_ENERGY);
                upgradeMiners[0].memory.jobSpecific = 'storageMiner';
                upgradeMiners[0].memory.linkSource = thisRoom.storage.id
                upgradeMiners[0].memory.mineSource = strSources[0];
                upgradeMiners = _.filter(RoomCreeps, (creep) => creep.memory.jobSpecific == 'upgradeMiner');
                storageMiners = _.filter(RoomCreeps, (creep) => creep.memory.jobSpecific == 'storageMiner');
            }
        }

        let roomMineral = Game.getObjectById(strMineral[0]);

        if (Memory.roomsUnderAttack.indexOf(thisRoom.name) != -1) {
            //Custom limits for beseiged rooms
            minerMax = 1;
            muleMax = 1;
            upgraderMax = 0;
            repairMax = 3;
            upSupplierMax = 0;
            supplierMax = 1;
            distributorMax = 1;
        }

        let bareMinConfig = [MOVE, MOVE, WORK, CARRY, CARRY];

        if (RoomCreeps.length == 0) {
            let configCost = calculateConfigCost(bareMinConfig);
            if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                //In case of complete destruction, make a minimum viable worker
                //Make sure 5+ work code has harvester backup path
                spawn.spawnCreep(bareMinConfig, 'mule_' + spawn.name + '_' + Game.time, {
                    memory: {
                        priority: 'harvester',
                        deathWarn: _.size(bareMinConfig) * 6,
                        sourceLocation: strSources[1],
                        homeRoom: thisRoom.name
                    }
                });
                Memory.isSpawning = true;
            }
        } else if (Memory.roomsUnderAttack.indexOf(thisRoom.name) != -1 && defenders.length < 3) {
            let Foe = thisRoom.find(FIND_HOSTILE_CREEPS, {
                filter: (eCreep) => ((eCreep.getActiveBodyparts(ATTACK) > 0 || eCreep.getActiveBodyparts(RANGED_ATTACK) > 0 || eCreep.getActiveBodyparts(WORK) > 0) && !Memory.whiteList.includes(eCreep.owner.username))
            });

			if (Memory.roomsPrepSalvager.indexOf(thisRoom.name) == -1 && thisRoom.energyAvailable >= thisRoom.energyCapacityAvailable - 500 && (Foe.length || defenders.length < 1)) {
                //Try to produce millitary units

                //Melee unit set: TOUGH, TOUGH, MOVE, MOVE, MOVE, ATTACK - 250
                //Ranged unit set: MOVE, MOVE, RANGED_ATTACK - 250

                //Damaged modules do not work, put padding first.

                var ToughCount = 0;
                var MoveCount = 0;
                var AttackCount = 0;
                var RangedCount = 0;
                var totalParts = 0;

                var remainingEnergy = Memory.CurrentRoomEnergy[energyIndex];
                var thisBuildAmount = 500;
                while ((remainingEnergy / thisBuildAmount) >= 1) {
                    //switch (ChosenPriority) {
                    //case 'melee':
                    //ToughCount = ToughCount + 1;
                    MoveCount = MoveCount + 2;
                    RangedCount = RangedCount + 3;
                    remainingEnergy = remainingEnergy - 500;
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

                Memory.CurrentRoomEnergy[energyIndex] = remainingEnergy;
                spawn.spawnCreep(ChosenCreepSet, 'defender_' + spawn.name + '_' + Game.time, {
                    memory: {
                        priority: 'defender',
                        fromSpawn: spawn.id,
                        homeRoom: thisRoom.name
                    }
                });
                Memory.isSpawning = true;
            } else {
                //Lock out spawning other units until max defenders
                Memory.isSpawning = true;
            }
        }
        if ((miners.length < minerMax || mules.length < muleMax || upgraders.length < upgraderMax || repairers.length < repairMax || suppliers.length < supplierMax || distributors.length < distributorMax || labWorkers.length < labWorkerMax || upSuppliers.length < upSupplierMax || scrapers.length < scraperMax || salvagers.length < salvagerMax) || (roomMineral.mineralAmount > 0 && mineralMiners.length == 0 && readyForMineral)) {
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

            var queLength = Memory.creepInQue.length;
            for (var i = 0; i < queLength; i++) {
                if (Memory.creepInQue[i] == thisRoom.name) {
                    blockedRole = blockedRole + ' ' + Memory.creepInQue[i + 1];
                    blockedSubRole = blockedSubRole + ' ' + Memory.creepInQue[i + 2];
                }
            }

            if (miners.length >= 1 && mules.length == 0 && !blockedRole.includes('mule')) {
                prioritizedRole = 'mule';
                storageID = thisRoom.storage.id;
                connectedLink = strLinks[1];
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
            } else if (suppliers.length < supplierMax && !blockedRole.includes('supplier')) {
                prioritizedRole = 'supplier';
            } else if (mules.length < muleMax && !blockedRole.includes('mule')) {
                prioritizedRole = 'mule';
                storageID = thisRoom.storage.id;
                connectedLink = strLinks[1];
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
                    let minerConfig = [CARRY, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE];
                    let configCost = calculateConfigCost(minerConfig);
                    if (configCost > thisRoom.energyCapacityAvailable) {
                    	//Took severe damage, assume cap of 300
                    	minerConfig = [CARRY,WORK,WORK,MOVE];
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
                                    ignoreTravel: false,
                                    atSpot: false
                                }
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
                                    ignoreTravel: false,
                                    atSpot: false
                                }
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
                    	muleConfig = [MOVE,WORK,CARRY,CARRY,CARRY];
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
                            }
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
                    }
                } else if (prioritizedRole == 'upgrader') {
                    Memory.isSpawning = true;
                    let upgraderConfig = [CARRY, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE];
                    if (thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] >= 265000 && thisRoom.energyCapacityAvailable >= 2300 && thisRoom.controller.level != 8) {
                        upgraderConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    } else if (thisRoom.energyCapacityAvailable >= 1550) {
                        if (thisRoom.controller.level == 8) {
                            upgraderConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY];
                        } else {
                            upgraderConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY];
                        }
                    }

                    let configCost = calculateConfigCost(upgraderConfig);
                    if (configCost > thisRoom.energyCapacityAvailable) {
                    	//Took severe damage, assume cap of 300
                    	upgraderConfig = [MOVE,WORK,WORK,CARRY];
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
                            }
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
                    }
                } else if (prioritizedRole == 'upSupplier') {
                    Memory.isSpawning = true;
                    let upSupplierConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];

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
                            }
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
                            }
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
                            }
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
                    	distributorConfig = [MOVE,MOVE,CARRY,CARRY,CARRY,CARRY];
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
                                }
                            });
                        } else {
                            spawn.spawnCreep(distributorConfig, 'distribute_' + spawn.name + '_' + Game.time, {
                                memory: {
                                    priority: prioritizedRole,
                                    deathWarn: _.size(distributorConfig) * 4,
                                    fromSpawn: spawn.id,
                                    homeRoom: thisRoom.name
                                }
                            });
                        }
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);

                    }
                } else if (prioritizedRole == 'mineralMiner') {
                    Memory.isSpawning = true;
                    let mineralMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
                    if (thisRoom.energyCapacityAvailable >= 4600) {
                        mineralMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    } else if (thisRoom.energyCapacityAvailable >= 3100) {
                        mineralMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
                    }
                    let configCost = calculateConfigCost(mineralMinerConfig);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep(mineralMinerConfig, 'mineralMiner_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: prioritizedRole,
                                terminalID: storageID,
                                mineralID: creepSource,
                                extractorID: connectedLink,
                                fromSpawn: spawn.id,
                                homeRoom: thisRoom.name
                            }
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);

                    }
                } else if (prioritizedRole == 'labWorker') {
                    Memory.isSpawning = true;
                    let labWorkerConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    let configCost = calculateConfigCost(labWorkerConfig);
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
                                    primaryFlag: primaryFlag,
                                    backupFlag: backupFlag,
                                    isMoving: false,
                                    movingOtherMineral: false,
                                    movingOtherMineral2: false,
                                    resourceChecks: 0,
                                    deathWarn: _.size(labWorkerConfig) * 4,
                                    fromSpawn: spawn.id,
                                    homeRoom: thisRoom.name
                                }
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
                                    primaryFlag: primaryFlag,
                                    backupFlag: backupFlag,
                                    isMoving: false,
                                    movingOtherMineral: false,
                                    movingOtherMineral2: false,
                                    resourceChecks: 0,
                                    deathWarn: _.size(labWorkerConfig) * 4,
                                    fromSpawn: spawn.id,
                                    homeRoom: thisRoom.name
                                }
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
                                    primaryFlag: primaryFlag,
                                    backupFlag: backupFlag,
                                    isMoving: false,
                                    movingOtherMineral: false,
                                    movingOtherMineral2: false,
                                    resourceChecks: 0,
                                    deathWarn: _.size(labWorkerConfig) * 4,
                                    fromSpawn: spawn.id,
                                    homeRoom: thisRoom.name
                                }
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
                                    primaryFlag: primaryFlag,
                                    backupFlag: backupFlag,
                                    isMoving: false,
                                    movingOtherMineral: false,
                                    movingOtherMineral2: false,
                                    resourceChecks: 0,
                                    deathWarn: _.size(labWorkerConfig) * 4,
                                    fromSpawn: spawn.id,
                                    homeRoom: thisRoom.name
                                }
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
                            }
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
                    }
                } else if (prioritizedRole == 'salvager') {
                    Memory.isSpawning = true;
                    let configCost = calculateConfigCost([CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE]);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep([MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY], 'salvager_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: prioritizedRole,
                                deathWarn: _.size([CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE]) * 6,
                                storageTarget: thisRoom.storage.id,
                                homeRoom: thisRoom.name
                            }
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
                    }
                }
            }
        } else if (mules.length == 0) {
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
                        }
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

module.exports = spawn_BuildCreeps5;