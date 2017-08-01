var spawn_BuildCreeps5 = {
    run: function(spawn, thisRoom, RoomCreeps) {
        //var strStorage = Memory.storageList[thisRoom.name];
        var roomStorage = thisRoom.storage
            //var RoomCreeps = thisRoom.find(FIND_MY_CREEPS);

        var miners = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'miner'); //Only gathers, does not move after reaching source
        var upgradeMiners = _.filter(RoomCreeps, (creep) => creep.memory.jobSpecific == 'upgradeMiner');
        var storageMiners = _.filter(RoomCreeps, (creep) => creep.memory.jobSpecific == 'storageMiner');

        var mules = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'mule' || creep.memory.previousPriority == 'mule'); //Stores in spawn/towers, builds, upgrades
        var upgraders = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'upgrader'); //Kinda important, and stuff.
        var mineralMiners = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'mineralMiner');
        var repairers = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'repair' && !creep.memory.previousPriority);
        var suppliers = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'supplier');
        var distributors = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'distributor');
        var upSuppliers = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'upSupplier');

        var labWorkers = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'labWorker');

        var salvagers = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'salvager');

        var defenders = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'defender');

        var minerMax = 2;
        var muleMax = 1;
        var upgraderMax = 2;
        var repairMax = 1;
        var upSupplierMax = 1;
        if (roomStorage && roomStorage.store[RESOURCE_ENERGY] < 75000) {
            upSupplierMax = 0;
            repairMax = 0;
        }
        var supplierMax = 1;
        var distributorMax = 1;
        var labWorkerMax = 0;
        var min1 = RESOURCE_CATALYZED_UTRIUM_ACID;
        var min2 = RESOURCE_CATALYZED_GHODIUM_ACID;
        /*if (thisRoom.controller.level == 8) {
            min2 = RESOURCE_CATALYZED_KEANIUM_ALKALIDE;
        }*/
        var min3 = RESOURCE_CATALYZED_LEMERGIUM_ACID;
        var min4 = '';
        var min5 = '';
        var min6 = '';
        var primaryFlag = '';
        var backupFlag = '';
        if (Memory.labList[thisRoom.name].length >= 3 && thisRoom.terminal) {
            //Need to produce : 
            //CATALYZED_LEMERGIUM_ALKALIDE (Need more L)
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
                    backupFlag = thisRoom.name + "ZH2OProducer";
                } else if (Game.flags[thisRoom.name + "ZH2OProducer"]) {
                    min4 = RESOURCE_ZYNTHIUM_HYDRIDE;
                    min5 = RESOURCE_HYDROXIDE;
                    min6 = RESOURCE_ZYNTHIUM_ACID;
                    primaryFlag = thisRoom.name + "ZH2OProducer";
                    backupFlag = thisRoom.name + "UH2OProducer";
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
                    backupFlag = thisRoom.name + "ZKProducer";
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
        var strSources = Memory.sourceList[thisRoom.name];
        var strLinks = Memory.linkList[thisRoom.name];
        var strMineral = Memory.mineralList[thisRoom.name];
        var strTerminal = "";
        if (thisRoom.terminal) {
            strTerminal = thisRoom.terminal.id;
        }
        var strExtractor = Memory.extractorList[thisRoom.name];
        var readyForMineral = false;
        if (strExtractor[0] && thisRoom.terminal && strMineral[0]) {
            readyForMineral = true;
        }

        var supplierConfig = [MOVE, CARRY, CARRY, CARRY];
        var distributorConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
        if (roomStorage && roomStorage.store[RESOURCE_ENERGY] >= 225000 && thisRoom.energyCapacityAvailable >= 1200) {
            distributorConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
        } else if (thisRoom.controller.level > 7) {
            distributorConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
        }

        var labWorkerConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];

        //950 Points
        var muleConfigCost = 800;
        var muleConfig = [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
        if (roomStorage && roomStorage.store[RESOURCE_ENERGY] >= 150000 && thisRoom.energyCapacityAvailable >= 1600) {
            //1600 Points
            muleConfig = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
            muleConfigCost = 1600;
        }

        var repairConfig = [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
        if (roomStorage && roomStorage.store[RESOURCE_ENERGY] >= 300000 && thisRoom.energyCapacityAvailable >= 1800) {
            repairConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
        }

        //800 Points
        var upgraderConfig = [CARRY, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE];
        if (thisRoom.energyCapacityAvailable >= 1550) {
            //1550 Points
            if (thisRoom.controller.level == 8) {
                upgraderConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY];
            } else {
                upgraderConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY];
            }
            upgraderMax--;
        }

        var upSupplierConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];

        var roomMineral = Game.getObjectById(strMineral[0]);
        if (roomStorage) {
            if (roomStorage.store[RESOURCE_ENERGY] >= 265000 && thisRoom.energyCapacityAvailable >= 2300 && thisRoom.controller.level != 8) {
                upgraderConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
            }
            if (roomStorage.store[RESOURCE_ENERGY] >= 225000) {
                //Add another mule for resource management
                muleMax++;
            }
            if (roomStorage.store[RESOURCE_ENERGY] >= 375000) {
                //speed up that repairing a bit
                repairMax++;
                if (thisRoom.controller.level != 8) {
                    upgraderMax++;
                }
            }
            if (roomStorage.store[RESOURCE_ENERGY] >= 450000 && thisRoom.energyCapacityAvailable >= 3000) {
                muleConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                muleConfigCost = 3000;
                repairConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
            }
            if (roomStorage.store[RESOURCE_ENERGY] >= 525000) {
                //HOW MUCH MUST I CRANK IT UP?
                repairMax++;
                muleMax++;
            }

            if (storageMiners.length == 0 && upgradeMiners.length > 0 && roomStorage.store[RESOURCE_ENERGY] <= 3000) {
                //reassign upgrade miner
                upgradeMiners[0].drop(RESOURCE_ENERGY);
                upgradeMiners[0].memory.jobSpecific = 'storageMiner';
                upgradeMiners[0].memory.linkSource = thisRoom.storage.id
                upgradeMiners[0].memory.mineSource = strSources[0];
                upgradeMiners = _.filter(RoomCreeps, (creep) => creep.memory.jobSpecific == 'upgradeMiner');
                storageMiners = _.filter(RoomCreeps, (creep) => creep.memory.jobSpecific == 'storageMiner');
            }

            //thisRoom.visual.text(roomStorage.store[RESOURCE_ENERGY] , roomStorage.pos.x + 1, roomStorage.pos.y, {align: 'left'});
        }


        //800 Points
        var minerConfig = [CARRY, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE];
        //Upgrader to use minerConfig
        //2,300 Points
        var mineralMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
        if (thisRoom.energyCapacityAvailable >= 4600) {
            mineralMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
        } else if (thisRoom.energyCapacityAvailable >= 3100) {
            mineralMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
        }

        var bareMinConfig = [MOVE, MOVE, WORK, CARRY, CARRY];

        if (RoomCreeps.length == 0 && spawn.canCreateCreep(bareMinConfig) == OK) {
            //In case of complete destruction, make a minimum viable worker
            //Make sure 5+ work code has harvester backup path
            if (thisRoom.storage.store[RESOURCE_ENERGY] >= 1100) {
                //There's enough in storage for a minimum and a miner. Spawn a crappy mule
                spawn.createCreep([MOVE, MOVE, CARRY, CARRY, CARRY, CARRY], undefined, {
                    priority: 'mule',
                    linkSource: strLinks[1],
                    storageSource: thisRoom.storage.id,
                    terminalID: strTerminal,
                    deathWarn: _.size([MOVE, MOVE, CARRY, CARRY, CARRY, CARRY]) * 4,
                    fromSpawn: spawn.id,
                    homeRoom: thisRoom.name
                });
                Memory.isSpawning = true;
            } else {
                spawn.createCreep(bareMinConfig, undefined, {
                    priority: 'harvester',
                    deathWarn: _.size(bareMinConfig) * 4,
                    sourceLocation: strSources[1],
                    homeRoom: thisRoom.name
                });
                Memory.isSpawning = true;
            }
        } else if (Memory.roomsUnderAttack.indexOf(thisRoom.name) != -1 && defenders.length < 3) {
            var Foe = thisRoom.find(FIND_HOSTILE_CREEPS, {
                filter: (eCreep) => ((eCreep.getActiveBodyparts(ATTACK) > 0 || eCreep.getActiveBodyparts(RANGED_ATTACK) > 0 || eCreep.getActiveBodyparts(WORK) > 0) && !Memory.whiteList.includes(eCreep.owner.username))
            });
            if (Memory.roomsPrepSalvager.indexOf(thisRoom.name) != -1) {
                if (thisRoom.energyAvailable >= 800 && salvagers.length == 0) {
                    var blockedRole = '';

                    var queLength = Memory.creepInQue.length;
                    for (var i = 0; i < queLength; i++) {
                        if (Memory.creepInQue[i] == thisRoom.name) {
                            blockedRole = blockedRole + ' ' + Memory.creepInQue[i + 1];
                        }
                    }
                    if (!blockedRole.includes('salvager')) { //Produce a salvager unit to pick up the dropped resources
                        Memory.isSpawning = true;
                        if (spawn.canCreateCreep([MOVE, MOVE, CARRY, CARRY, CARRY, CARRY]) == OK) {
                            spawn.createCreep([MOVE, MOVE, CARRY, CARRY, CARRY, CARRY], undefined, {
                                priority: 'salvager',
                                deathWarn: _.size([MOVE, MOVE, CARRY, CARRY, CARRY, CARRY]) * 4,
                                storageTarget: thisRoom.storage.id,
                                homeRoom: thisRoom.name
                            });
                            Memory.creepInQue.push(thisRoom.name, 'salvager', '', spawn.name);
                        }
                    }


                }
            } else if (thisRoom.energyAvailable >= thisRoom.energyCapacityAvailable - 500 && (Foe.length || defenders.length < 1)) {
                //Try to produce millitary units

                //Melee unit set: TOUGH, TOUGH, MOVE, MOVE, MOVE, ATTACK - 250
                //Ranged unit set: MOVE, MOVE, RANGED_ATTACK - 250

                //Damaged modules do not work, put padding first.

                //var defenderUnits = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'defender');

                //var ChosenPriority = '';
                //if (meleeUnits <= rangedUnits) {
                //ChosenPriority = 'melee';
                //} else {
                //ChosenPriority = 'ranged';
                //}

                var ToughCount = 0;
                var MoveCount = 0;
                var AttackCount = 0;
                var RangedCount = 0;
                var totalParts = 0;

                var remainingEnergy = thisRoom.energyAvailable;
                while ((remainingEnergy / 340) >= 1) {
                    //switch (ChosenPriority) {
                    //case 'melee':
                    //ToughCount = ToughCount + 1;
                    MoveCount = MoveCount + 2;
                    if (RangedCount == 0) {
                        RangedCount = 1;
                        AttackCount = AttackCount + 2;
                        remainingEnergy = remainingEnergy - 410;
                    } else {
                        AttackCount = AttackCount + 3;
                        remainingEnergy = remainingEnergy - 340;
                    }
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

                spawn.createCreep(ChosenCreepSet, undefined, {
                    priority: 'defender',
                    fromSpawn: spawn.id,
                    homeRoom: thisRoom.name
                });
                Memory.isSpawning = true;
            } else {
                //Lock out spawning other units until max defenders
                Memory.isSpawning = true;
            }
        }
        if ((miners.length < minerMax || mules.length < muleMax || upgraders.length < upgraderMax || repairers.length < repairMax || suppliers.length < supplierMax || distributors.length < distributorMax || labWorkers.length < labWorkerMax || upSuppliers.length < upSupplierMax) || (roomMineral.mineralAmount > 0 && mineralMiners.length == 0 && readyForMineral)) {
            var prioritizedRole = '';
            var creepSource = '';
            var connectedLink = '';
            var backupLink = '';
            var storageID = '';
            var jobSpecificPri = '';
            var blockedRole = '';
            var blockedSubRole = '';
            var roomTarget = '';
            var farSource = '';

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
                if (thisRoom.energyAvailable < muleConfigCost) {
                    //Spawn a panicMule
                    muleConfig = [MOVE, MOVE, CARRY, CARRY, CARRY, CARRY];
                }
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
            } else if (roomMineral.mineralAmount > 0 && mineralMiners.length == 0 && readyForMineral && !blockedRole.includes('mineralMiner') && roomStorage && roomStorage.store[RESOURCE_ENERGY] >= 50000) {
                prioritizedRole = 'mineralMiner';
                storageID = strTerminal;
                creepSource = strMineral[0];
                connectedLink = strExtractor[0];
            } else if (labWorkers.length < labWorkerMax && !blockedRole.includes('labWorker')) {
                prioritizedRole = 'labWorker';
                storageID = strTerminal;
            }

            if (prioritizedRole != '') {
                if (prioritizedRole == 'miner') {
                    Memory.isSpawning = true;
                    if (spawn.canCreateCreep(minerConfig) == OK) {
                        if (jobSpecificPri == 'upgradeMiner' && strLinks.length >= 4) {
                            spawn.createCreep(minerConfig, undefined, {
                                priority: prioritizedRole,
                                mineSource: creepSource,
                                linkSource: connectedLink,
                                linkSource2: backupLink,
                                jobSpecific: jobSpecificPri,
                                deathWarn: _.size(minerConfig) * 4,
                                fromSpawn: spawn.id,
                                homeRoom: thisRoom.name
                            });
                        } else {
                            spawn.createCreep(minerConfig, undefined, {
                                priority: prioritizedRole,
                                mineSource: creepSource,
                                linkSource: connectedLink,
                                jobSpecific: jobSpecificPri,
                                deathWarn: _.size(minerConfig) * 4,
                                fromSpawn: spawn.id,
                                homeRoom: thisRoom.name
                            });
                        }
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
                    }
                } else if (prioritizedRole == 'mule') {
                    Memory.isSpawning = true;
                    if (spawn.canCreateCreep(muleConfig) == OK) {
                        spawn.createCreep(muleConfig, undefined, {
                            priority: prioritizedRole,
                            linkSource: connectedLink,
                            storageSource: storageID,
                            terminalID: creepSource,
                            deathWarn: _.size(muleConfig) * 4,
                            fromSpawn: spawn.id,
                            homeRoom: thisRoom.name
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
                    }
                } else if (prioritizedRole == 'upgrader') {
                    Memory.isSpawning = true;
                    if (spawn.canCreateCreep(upgraderConfig) == OK) {
                        spawn.createCreep(upgraderConfig, undefined, {
                            priority: prioritizedRole,
                            linkSource: connectedLink,
                            storageSource: storageID,
                            deathWarn: _.size(upgraderConfig) * 4,
                            fromSpawn: spawn.id,
                            homeRoom: thisRoom.name
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
                    }
                } else if (prioritizedRole == 'upSupplier') {
                    Memory.isSpawning = true;
                    if (spawn.canCreateCreep(upSupplierConfig) == OK) {
                        spawn.createCreep(upSupplierConfig, undefined, {
                            priority: prioritizedRole,
                            linkTarget: connectedLink,
                            storageSource: storageID,
                            deathWarn: _.size(repairConfig) * 4,
                            fromSpawn: spawn.id,
                            homeRoom: thisRoom.name
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);

                    }
                } else if (prioritizedRole == 'repair') {
                    Memory.isSpawning = true;
                    if (spawn.canCreateCreep(repairConfig) == OK) {
                        spawn.createCreep(repairConfig, undefined, {
                            priority: prioritizedRole,
                            storageSource: storageID,
                            deathWarn: _.size(repairConfig) * 4,
                            fromSpawn: spawn.id,
                            homeRoom: thisRoom.name
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);

                    }
                } else if (prioritizedRole == 'supplier') {
                    Memory.isSpawning = true;
                    if (spawn.canCreateCreep(supplierConfig) == OK) {
                        spawn.createCreep(supplierConfig, undefined, {
                            priority: prioritizedRole,
                            deathWarn: _.size(supplierConfig) * 4,
                            fromSpawn: spawn.id,
                            homeRoom: thisRoom.name
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);

                    }
                } else if (prioritizedRole == 'distributor') {
                    Memory.isSpawning = true;
                    if (spawn.canCreateCreep(distributorConfig) == OK) {
                        if (connectedLink != '') {
                            spawn.createCreep(distributorConfig, undefined, {
                                priority: prioritizedRole,
                                linkSource: connectedLink,
                                deathWarn: _.size(distributorConfig) * 4,
                                fromSpawn: spawn.id,
                                homeRoom: thisRoom.name
                            });
                        } else {
                            spawn.createCreep(distributorConfig, undefined, {
                                priority: prioritizedRole,
                                deathWarn: _.size(distributorConfig) * 4,
                                fromSpawn: spawn.id,
                                homeRoom: thisRoom.name
                            });
                        }
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);

                    }
                } else if (prioritizedRole == 'mineralMiner') {
                    Memory.isSpawning = true;
                    if (spawn.canCreateCreep(mineralMinerConfig) == OK) {
                        spawn.createCreep(mineralMinerConfig, undefined, {
                            priority: prioritizedRole,
                            terminalID: storageID,
                            mineralID: creepSource,
                            extractorID: connectedLink,
                            fromSpawn: spawn.id,
                            homeRoom: thisRoom.name
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);

                    }
                } else if (prioritizedRole == 'labWorker') {
                    Memory.isSpawning = true;
                    if (spawn.canCreateCreep(labWorkerConfig) == OK) {
                        if (Memory.labList[thisRoom.name].length >= 9) {
                            spawn.createCreep(labWorkerConfig, undefined, {
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
                                mineral7: min4,
                                lab7: Memory.labList[thisRoom.name][6],
                                mineral8: min5,
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
                            });
                        } else if (Memory.labList[thisRoom.name].length >= 6) {
                            spawn.createCreep(labWorkerConfig, undefined, {
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
                            });
                        } else {
                            spawn.createCreep(labWorkerConfig, undefined, {
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
                            });
                        }
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
                if (spawn.canCreateCreep([MOVE, MOVE, CARRY, CARRY, CARRY, CARRY]) == OK) {
                    spawn.createCreep([MOVE, MOVE, CARRY, CARRY, CARRY, CARRY], undefined, {
                        priority: 'mule',
                        linkSource: strLinks[1],
                        storageSource: thisRoom.storage.id,
                        terminalID: strTerminal,
                        deathWarn: _.size([MOVE, MOVE, CARRY, CARRY, CARRY, CARRY]) * 4,
                        fromSpawn: spawn.id,
                        homeRoom: thisRoom.name
                    });
                    Memory.creepInQue.push(thisRoom.name, 'mule', '', spawn.name);
                }
            }
        }
    }
};

module.exports = spawn_BuildCreeps5;