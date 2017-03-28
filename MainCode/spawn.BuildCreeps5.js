var spawn_BuildCreeps5 = {
	run: function(spawn, thisRoom, RoomCreeps) {
		//var strStorage = Memory.storageList[thisRoom.name];
		var roomStorage = thisRoom.storage
		if (roomStorage) {
			var formattedNumber = roomStorage.store[RESOURCE_ENERGY].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
			if (roomStorage.store[RESOURCE_ENERGY] == 420) {
				thisRoom.visual.text("Blaze it fgt \uD83C\uDF41\uD83D\uDD25 \uD83D\uDC4C\uD83D\uDE38\uD83D\uDD95", roomStorage.pos.x + 1, roomStorage.pos.y, {
					align: 'left',
					font: '3 Courier New',
					color: '#FFFFFF',
					stroke: '#000000',
					strokeWidth: 0.15
				});
			} else {
				thisRoom.visual.text(formattedNumber, roomStorage.pos.x + 1, roomStorage.pos.y, {
					align: 'left',
					font: '0.7 Courier New',
					color: '#FFFFFF',
					stroke: '#000000',
					strokeWidth: 0.15
				});
			}
		}
		if (!spawn.spawning) {
			if (Memory.creepInQue.indexOf(spawn.name) >= 0) {
				//Clear creep from que array
				var queSpawnIndex = Memory.creepInQue.indexOf(spawn.name);
				Memory.creepInQue.splice(queSpawnIndex - 3, 4);
			}
			//var RoomCreeps = thisRoom.find(FIND_MY_CREEPS);

			var miners = _.filter(Game.creeps, (creep) => creep.memory.priority == 'miner'); //Only gathers, does not move after reaching source
			var upgradeMiners = _.filter(Game.creeps, (creep) => creep.memory.jobSpecific == 'upgradeMiner');
			var storageMiners = _.filter(Game.creeps, (creep) => creep.memory.jobSpecific == 'storageMiner');

			var mules = _.filter(Game.creeps, (creep) => creep.memory.priority == 'mule'); //Stores in spawn/towers, builds, upgrades
			var upgraders = _.filter(Game.creeps, (creep) => creep.memory.priority == 'upgrader'); //Kinda important, and stuff.
			var mineralMiners = _.filter(Game.creeps, (creep) => creep.memory.priority == 'mineralMiner');
			var repairers = _.filter(Game.creeps, (creep) => creep.memory.priority == 'repair');
			var suppliers = _.filter(Game.creeps, (creep) => creep.memory.priority == 'supplier');
			var distributors = _.filter(Game.creeps, (creep) => creep.memory.priority == 'distributor');

			var salvagers = _.filter(Game.creeps, (creep) => creep.memory.priority == 'salvager');

			var defenders = _.filter(Game.creeps, (creep) => creep.memory.priority == 'defender');

			var minerMax = 2;
			var muleMax = 1;
			var upgraderMax = 2;
			var repairMax = 1;
			var supplierMax = 1;
			var distributorMax = 1;
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
			if (roomStorage && roomStorage.store[RESOURCE_ENERGY] >= 200000 && thisRoom.energyCapacityAvailable >= 2000) {
				distributorConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
			}

			//950 Points
			var muleConfigCost = 800;
			var muleConfig = [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
			if (roomStorage && roomStorage.store[RESOURCE_ENERGY] >= 100000 && thisRoom.energyCapacityAvailable >= 1600) {
				//1600 Points
				muleConfig = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
				muleConfigCost = 1600;
			}

			var repairConfig = [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
			if (roomStorage && roomStorage.store[RESOURCE_ENERGY] >= 100000 && thisRoom.energyCapacityAvailable >= 1800) {
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
				if (roomStorage.store[RESOURCE_ENERGY] >= 200000) {
					//Add another mule for resource management
					muleMax++;
					if (thisRoom.energyCapacityAvailable >= 2300) {
						//1950 Points
						upgraderConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
					}
				}
				if (roomStorage.store[RESOURCE_ENERGY] >= 300000) {
					//speed up that repairing a bit
					repairMax++;
				}
				if (roomStorage.store[RESOURCE_ENERGY] >= 400000) {
					//Bigger Mules/Repairers
					if (thisRoom.energyCapacityAvailable >= 3000) {
						muleConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
						muleConfigCost = 3000;
						repairConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
					}
				}
				if (roomStorage.store[RESOURCE_ENERGY] >= 500000) {
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
			var mineralMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE];

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
					filter: (eCreep) => ((eCreep.getActiveBodyparts(ATTACK) > 0 || eCreep.getActiveBodyparts(RANGED_ATTACK) > 0 || eCreep.getActiveBodyparts(WORK) > 0 ) && !Memory.whiteList.includes(eCreep.owner.username))
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
			if ((miners.length < minerMax || mules.length < muleMax || upgraders.length < upgraderMax || repairers.length < repairMax || suppliers.length < supplierMax || distributors.length < distributorMax) || (roomMineral.mineralAmount > 0 && mineralMiners.length == 0 && readyForMineral)) {
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
				} else if (roomMineral.mineralAmount > 0 && mineralMiners.length == 0 && readyForMineral && !blockedRole.includes('mineralMiner') && roomStorage && roomStorage.store[RESOURCE_ENERGY] >= 100000) {
					prioritizedRole = 'mineralMiner';
					storageID = strTerminal;
					creepSource = strMineral[0];
					connectedLink = strExtractor[0];
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
		} else {
			//Add a visual for spawn progress
			var spawnProgress = (spawn.spawning.needTime - spawn.spawning.remainingTime) + 1;
			var percentageComplete = Math.floor((spawnProgress / spawn.spawning.needTime) * 100);

			thisRoom.visual.text(' (' + percentageComplete + '%)', spawn.pos.x + 1, spawn.pos.y, {
				align: 'left',
				font: '1 Courier New',
				color: '#FFFFFF',
				stroke: '#000000',
				strokeWidth: 0.15
			});
		}
	}
};

module.exports = spawn_BuildCreeps5;