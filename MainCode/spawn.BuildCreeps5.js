var spawn_BuildCreeps5 = {
	run: function(spawn, thisRoom, RoomCreeps) {
		//var strStorage = Memory.storageList[thisRoom.name];
		var roomStorage = thisRoom.storage

		if (Memory.creepInQue.indexOf(spawn.name) >= 0) {
			//Clear creep from que array
			var queSpawnIndex = Memory.creepInQue.indexOf(spawn.name);
			Memory.creepInQue.splice(queSpawnIndex - 3, 4);
		}
		//var RoomCreeps = thisRoom.find(FIND_MY_CREEPS);

		var miners = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'miner'); //Only gathers, does not move after reaching source
		var upgradeMiners = _.filter(RoomCreeps, (creep) => creep.memory.jobSpecific == 'upgradeMiner');
		var storageMiners = _.filter(RoomCreeps, (creep) => creep.memory.jobSpecific == 'storageMiner');

		var mules = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'mule'); //Stores in spawn/towers, builds, upgrades
		var upgraders = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'upgrader'); //Kinda important, and stuff.
		var mineralMiners = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'mineralMiner');
		var repairers = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'repair');
		var suppliers = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'supplier');
		var distributors = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'distributor');

		var labWorkers = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'labWorker');

		var salvagers = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'salvager');

		var defenders = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'defender');

		var minerMax = 2;
		var muleMax = 1;
		var upgraderMax = 2;
		var repairMax = 1;
		if (roomStorage && roomStorage.store[RESOURCE_ENERGY] < 50000) {
			repairMax = 0;
		}
		var supplierMax = 1;
		var distributorMax = 1;
		var labWorkerMax = 0;
		var min1 = '';
		var min2 = '';
		var min3 = '';
		var min4 = RESOURCE_UTRIUM_ACID;
		var min5 = RESOURCE_GHODIUM_ACID;
		var min6 = RESOURCE_LEMERGIUM_ACID;
		if (Memory.labList[thisRoom.name].length >= 3 && thisRoom.terminal) {
			if (Game.flags[thisRoom.name + "UHProducer"]) {
				min1 = RESOURCE_UTRIUM;
				min2 = RESOURCE_HYDROGEN;
				min3 = RESOURCE_UTRIUM_HYDRIDE;
			} else if (Game.flags[thisRoom.name + "OHProducer"]) {
				min1 = RESOURCE_OXYGEN;
				min2 = RESOURCE_HYDROGEN;
				min3 = RESOURCE_HYDROXIDE;
			} else if (Game.flags[thisRoom.name + "UH2OProducer"]) {
				min1 = RESOURCE_UTRIUM_HYDRIDE;
				min2 = RESOURCE_HYDROXIDE;
				min3 = RESOURCE_UTRIUM_ACID;
			} else if (Game.flags[thisRoom.name + "ZKProducer"]) {
				min1 = RESOURCE_ZYNTHIUM;
				min2 = RESOURCE_KEANIUM;
				min3 = RESOURCE_ZYNTHIUM_KEANITE;
			} else if (Game.flags[thisRoom.name + "LHProducer"]) {
				min1 = RESOURCE_LEMERGIUM;
				min2 = RESOURCE_HYDROGEN;
				min3 = RESOURCE_LEMERGIUM_HYDRIDE;
			} else if (Game.flags[thisRoom.name + "ULProducer"]) {
				min1 = RESOURCE_UTRIUM;
				min2 = RESOURCE_LEMERGIUM;
				min3 = RESOURCE_UTRIUM_LEMERGITE;
			} else if (Game.flags[thisRoom.name + "GProducer"]) {
				min1 = RESOURCE_UTRIUM_LEMERGITE;
				min2 = RESOURCE_ZYNTHIUM_KEANITE;
				min3 = RESOURCE_GHODIUM;
			} else if (Game.flags[thisRoom.name + "LH2OProducer"]) {
				min1 = RESOURCE_LEMERGIUM_HYDRIDE;
				min2 = RESOURCE_HYDROXIDE;
				min3 = RESOURCE_LEMERGIUM_ACID;
			}

			var min1Count = min1 in thisRoom.terminal.store;
			var min2Count = min2 in thisRoom.terminal.store;
			var producedResult = min3 in thisRoom.terminal.store;
			if (min1Count > 0 && min2Count > 0 && producedResult < 40000) {
				labWorkerMax = 1;
			}
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
		var distributorConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
		if (roomStorage && roomStorage.store[RESOURCE_ENERGY] >= 150000 && thisRoom.energyCapacityAvailable >= 2000) {
			distributorConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
		} else if (thisRoom.controller.level > 7) {
			var distributorConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
		}

		var labWorkerConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];

		//950 Points
		var muleConfigCost = 800;
		var muleConfig = [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
		if (roomStorage && roomStorage.store[RESOURCE_ENERGY] >= 100000 && thisRoom.energyCapacityAvailable >= 1600) {
			//1600 Points
			muleConfig = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
			muleConfigCost = 1600;
		}

		var repairConfig = [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
		if (roomStorage && roomStorage.store[RESOURCE_ENERGY] >= 200000 && thisRoom.energyCapacityAvailable >= 1800) {
			repairConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
		}

		//800 Points
		var upgraderConfig = [CARRY, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE];
		if (thisRoom.energyCapacityAvailable >= 1550) {
			//1550 Points
			upgraderConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY];
			upgraderMax--;
		}

		var roomMineral = Game.getObjectById(strMineral[0]);
		if (roomStorage) {
			if (roomStorage.store[RESOURCE_ENERGY] >= 175000 && thisRoom.energyCapacityAvailable >= 2300) {
				upgraderConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
			}
			if (roomStorage.store[RESOURCE_ENERGY] >= 150000) {
				//Add another mule for resource management
				muleMax++;
			}
			if (roomStorage.store[RESOURCE_ENERGY] >= 250000) {
				//speed up that repairing a bit
				repairMax++;
			}
			if (roomStorage.store[RESOURCE_ENERGY] >= 300000 && thisRoom.energyCapacityAvailable >= 3000) {
				muleConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
				muleConfigCost = 3000;
				repairConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
			}
			if (roomStorage.store[RESOURCE_ENERGY] >= 350000) {
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
		if (thisRoom.energyCapacityAvailable >= 4450) {
			mineralMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
		} else if (thisRoom.energyCapacityAvailable >= 3100) {
			mineralMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
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
					fromSpawn: spawn.id
				});
				Memory.isSpawning = true;
			} else {
				spawn.createCreep(bareMinConfig, undefined, {
					priority: 'harvester',
					sourceLocation: strSources[1]
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
						if (spawn.canCreateCreep([MOVE, MOVE, CARRY, CARRY, CARRY, CARRY]) == OK) {
							spawn.createCreep([MOVE, MOVE, CARRY, CARRY, CARRY, CARRY], undefined, {
								priority: 'salvager',
								storageTarget: thisRoom.storage.id
							});
							Memory.creepInQue.push(thisRoom.name, 'salvager', '', spawn.name);
							Memory.isSpawning = true;
						}
					}


				}
			} else if (thisRoom.energyAvailable >= thisRoom.energyCapacityAvailable && (Foe.length || defenders.length < 1)) {
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
					AttackCount = AttackCount + 3;
					//RangedCount = RangedCount + 1;
					totalParts = totalParts + 5;
					remainingEnergy = remainingEnergy - 340;
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
				while (MoveCount > 1) {
					ChosenCreepSet.push(MOVE);
					MoveCount--;
				}
				while (AttackCount > 0) {
					ChosenCreepSet.push(ATTACK);
					AttackCount--;
				}
				while (RangedCount > 0) {
					ChosenCreepSet.push(RANGED_ATTACK);
					RangedCount--;
				}

				//Insert one move module last so the creep can still run
				ChosenCreepSet.push(MOVE);

				if (ChosenCreepSet.length > 50) {
					while (ChosenCreepSet.length > 50) {
						ChosenCreepSet.splice(0, 1);
					}
				}

				spawn.createCreep(ChosenCreepSet, undefined, {
					priority: 'defender',
					fromSpawn: spawn.id
				});
				Memory.isSpawning = true;
			} else {
				//Lock out spawning other units until max defenders
				Memory.isSpawning = true;
			}
		}
		if ((miners.length < minerMax || mules.length < muleMax || upgraders.length < upgraderMax || repairers.length < repairMax || suppliers.length < supplierMax || distributors.length < distributorMax || labWorkers.length < labWorkerMax) || (roomMineral.mineralAmount > 0 && mineralMiners.length == 0 && readyForMineral)) {
			var prioritizedRole = '';
			var creepSource = '';
			var connectedLink = '';
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
							jobSpecificPri = 'upgradeMiner';
						}
						break;
				}
			} else if (distributors.length < distributorMax && !blockedRole.includes('distributor')) {
				prioritizedRole = 'distributor';
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
					if (spawn.canCreateCreep(minerConfig) == OK) {
						spawn.createCreep(minerConfig, undefined, {
							priority: prioritizedRole,
							mineSource: creepSource,
							linkSource: connectedLink,
							jobSpecific: jobSpecificPri,
							fromSpawn: spawn.id
						});
						Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
						Memory.isSpawning = true;
					}
				} else if (prioritizedRole == 'mule') {
					if (spawn.canCreateCreep(muleConfig) == OK) {
						spawn.createCreep(muleConfig, undefined, {
							priority: prioritizedRole,
							linkSource: connectedLink,
							storageSource: storageID,
							terminalID: creepSource,
							fromSpawn: spawn.id
						});
						Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
						Memory.isSpawning = true;
					}
				} else if (prioritizedRole == 'upgrader') {
					if (spawn.canCreateCreep(upgraderConfig) == OK) {
						spawn.createCreep(upgraderConfig, undefined, {
							priority: prioritizedRole,
							linkSource: connectedLink,
							storageSource: storageID,
							fromSpawn: spawn.id
						});
						Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
						Memory.isSpawning = true;
					}
				} else if (prioritizedRole == 'repair') {
					if (spawn.canCreateCreep(repairConfig) == OK) {
						spawn.createCreep(repairConfig, undefined, {
							priority: prioritizedRole,
							storageSource: storageID,
							fromSpawn: spawn.id
						});
						Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
						Memory.isSpawning = true;
					}
				} else if (prioritizedRole == 'supplier') {
					if (spawn.canCreateCreep(supplierConfig) == OK) {
						spawn.createCreep(supplierConfig, undefined, {
							priority: prioritizedRole,
							fromSpawn: spawn.id
						});
						Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
						Memory.isSpawning = true;
					}
				} else if (prioritizedRole == 'distributor') {
					if (spawn.canCreateCreep(distributorConfig) == OK) {
						spawn.createCreep(distributorConfig, undefined, {
							priority: prioritizedRole,
							fromSpawn: spawn.id
						});
						Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
						Memory.isSpawning = true;
					}
				} else if (prioritizedRole == 'mineralMiner') {
					if (spawn.canCreateCreep(mineralMinerConfig) == OK) {
						spawn.createCreep(mineralMinerConfig, undefined, {
							priority: prioritizedRole,
							terminalID: storageID,
							mineralID: creepSource,
							extractorID: connectedLink,
							fromSpawn: spawn.id
						});
						Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
						Memory.isSpawning = true;
					}
				} else if (prioritizedRole == 'labWorker') {
					if (spawn.canCreateCreep(labWorkerConfig) == OK) {
						if (Memory.labList[thisRoom.name].length >= 6) {
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
								fromSpawn: spawn.id
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
								fromSpawn: spawn.id
							});
						}
						Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
						Memory.isSpawning = true;
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
				if (spawn.canCreateCreep([MOVE, MOVE, CARRY, CARRY, CARRY, CARRY]) == OK) {
					spawn.createCreep([MOVE, MOVE, CARRY, CARRY, CARRY, CARRY], undefined, {
						priority: 'mule',
						linkSource: strLinks[1],
						storageSource: thisRoom.storage.id,
						terminalID: strTerminal,
						fromSpawn: spawn.id
					});
					Memory.creepInQue.push(thisRoom.name, 'mule', '', spawn.name);
					Memory.isSpawning = true;
				}
			}
		}
	}
};

module.exports = spawn_BuildCreeps5;