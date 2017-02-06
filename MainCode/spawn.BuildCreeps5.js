var spawn_BuildCreeps5 = {
	run: function(spawn, thisRoom) {
		var strStorage = Memory.storageList[thisRoom.name];
		var roomStorage = Game.getObjectById(strStorage[0]);
		if (roomStorage) {
			var formattedNumber = roomStorage.store[RESOURCE_ENERGY].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
			if (roomStorage.store[RESOURCE_ENERGY] == 420) {
				thisRoom.visual.text("Blaze it fgt \uD83C\uDF41\uD83D\uDD25 \uD83D\uDC4C\uD83D\uDE38\uD83D\uDD95", roomStorage.pos.x + 1, roomStorage.pos.y, {
					align: 'left'
				});
			} else {
				thisRoom.visual.text(formattedNumber, roomStorage.pos.x + 1, roomStorage.pos.y, {
					align: 'left'
				});
			}
		}
		if (!spawn.spawning) {
			if (Memory.creepInQue.indexOf(spawn.name) >= 0) {
				//Clear creep from que array
				var queSpawnIndex = Memory.creepInQue.indexOf(spawn.name);
				Memory.creepInQue.splice(queSpawnIndex - 3, 4);
			}
			var RoomCreeps = thisRoom.find(FIND_MY_CREEPS);

			var miners = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'miner'); //Only gathers, does not move after reaching source
			var upgradeMiners = _.filter(RoomCreeps, (creep) => creep.memory.jobSpecific == 'upgradeMiner');
			var storageMiners = _.filter(RoomCreeps, (creep) => creep.memory.jobSpecific == 'storageMiner');

			var mules = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'mule'); //Stores in spawn/towers, builds, upgrades
			var upgraders = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'upgrader'); //Kinda important, and stuff.
			var mineralMiners = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'mineralMiner');
			var repairers = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'repair');

			var salvagers = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'salvager');

			var minerMax = 2;
			var muleMax = 1;
			var upgraderMax = 2;
			var repairMax = 1;
			var strSources = Memory.sourceList[thisRoom.name];
			var strLinks = Memory.linkList[thisRoom.name];
			var strMineral = Memory.mineralList[thisRoom.name];
			var strTerminal = Memory.terminalList[thisRoom.name];
			var strExtractor = Memory.extractorList[thisRoom.name];
			var readyForMineral = false;
			if (strExtractor[0] && strTerminal[0] && strMineral[0]) {
				readyForMineral = true;
			}
			//var usingFarMiners = false;
			//var farRooms = [];
			//var farSources = [];
			//var farLength = 0;

			/*switch (thisRoom.name) {
				case 'E3N61':
					//two sources
					//minerMax = 2;
					//strSources.push('57ef9db786f108ae6e60e2a5', '57ef9db786f108ae6e60e2a7');
					//strLinks.push('583adab41b9ba6bd6923fc74', '583af8fa827c44087d11fca1');
					//muleMax = 1;
					//strStorage.push('58388a3dac3bed8a51188517');
					//upgraderMax = 2;
					//repairMax = 1;
					//strMineral.push('57efa010195b160f02c752c6');
					//strTerminal.push('58424a6ef6e01c883e9feb4b');
					//strExtractor.push('58412458eebbe1bc1d83c710');
					//readyForMineral = true;
					usingFarMiners = false;
					break;
				case 'E4N61':
					//minerMax = 2;
					//muleMax = 1;
					//upgraderMax = 2;
					//repairMax = 1;
					//strSources.push('57ef9dba86f108ae6e60e2f8', '57ef9dba86f108ae6e60e2fa');
					//strLinks.push('5846b97fa223c8f26df40a15', '5846c2f5b4d42f365e1c0d50');
					//strStorage.push('5842a7fa4d4fac0a066fbd05');
					//strMineral.push('57efa010195b160f02c752d5');
					//strTerminal.push('58511f42a4bd711272b69517');
					//strExtractor.push('584dd9736e946d971f816169');
					//readyForMineral = true;
					usingFarMiners = false;
					break;
				case 'E1N63':
					//minerMax = 2;
					//muleMax = 1;
					//upgraderMax = 2;
					//repairMax = 1;
					//strSources.push('57ef9db186f108ae6e60e21d', '57ef9db186f108ae6e60e21e');
					//strLinks.push('5851389331781392518d42f7', '5851488b9937b63f665b2f57');
					//strStorage.push('584ebb6cb33541d02a283774');
					//strMineral.push('57efa010195b160f02c752a0');
					//strTerminal.push('5859644c969e3a483fff380a');
					//strExtractor.push('585711fd97c4584d6a29c37a');
					//readyForMineral = true;
					usingFarMiners = false;
					farRooms.push('E1N62');
					farSources.push('57ef9db186f108ae6e60e220');
					farLength = Memory.E1N63FarRoles.length;
					break;
			}*/

			/*var farMinerCount = 0;
			var farClaimerCount = 0;
			var farMuleCount = 0;
			var farGuardCount = 0;
			if (Memory.FarCreeps[thisRoom.name]) {
				//Enable far miner consideration for this spawn
				usingFarMiners = true;
				var creepCount = Memory.FarCreeps[thisRoom.name].reduce(function(m, v) {
					for (var k in m) {
						if (~v.indexOf(k)) m[k] ++;
					}
					return m;
				}, {
					farClaimer: 0,
					farMiner: 0,
					farMule: 0,
					farGuard: 0
				});

				farMinerCount = creepCount.farMiner;
				farClaimerCount = creepCount.farClaimer;
				farMuleCount = creepCount.farMule;
				farGuardCount = creepCount.farGuard;

				if (farMules.length) {
					if (farMules.length < farMuleCount) {
						//Lost a creep, remove it from the memory value
						var farIndex = Memory.FarCreeps[thisRoom.name].indexOf('farMule');
						if (farIndex != -1) {
							Memory.FarCreeps[thisRoom.name].splice(farIndex, 1);
						}
					}
				} else if (farMuleCount > 0) {
					var farIndex = Memory.FarCreeps[thisRoom.name].indexOf('farMule');
					if (farIndex != -1) {
						Memory.FarCreeps[thisRoom.name].splice(farIndex, 1);
					}
				}

				if (farClaimers.length) {
					if (farClaimers.length < farClaimerCount) {
						//Lost a creep, remove it from the memory value
						var farIndex = Memory.FarCreeps[thisRoom.name].indexOf('farClaimer');
						if (farIndex != -1) {
							Memory.FarCreeps[thisRoom.name].splice(farIndex, 1);
						}
					}
				} else if (farClaimerCount > 0) {
					var farIndex = Memory.FarCreeps[thisRoom.name].indexOf('farClaimer');
					if (farIndex != -1) {
						Memory.FarCreeps[thisRoom.name].splice(farIndex, 1);
					}
				}

				if (farMiners.length) {
					if (farMiners.length < farMinerCount) {
						//Lost a creep, remove it from the memory value
						var farIndex = Memory.FarCreeps[thisRoom.name].indexOf('farMiner');
						if (farIndex != -1) {
							Memory.FarCreeps[thisRoom.name].splice(farIndex, 1);
						}
					}
				} else if (farMinerCount > 0) {
					var farIndex = Memory.FarCreeps[thisRoom.name].indexOf('farMiner');
					if (farIndex != -1) {
						Memory.FarCreeps[thisRoom.name].splice(farIndex, 1);
					}
				}

				if (farGuards.length) {
					if (farGuards.length < farGuardCount) {
						//Lost a creep, remove it from the memory value
						var farIndex = Memory.FarCreeps[thisRoom.name].indexOf('farGuard');
						if (farIndex != -1) {
							Memory.FarCreeps[thisRoom.name].splice(farIndex, 1);
						}
					}
				} else if (farGuardCount > 0) {
					var farIndex = Memory.FarCreeps[thisRoom.name].indexOf('farGuard');
					if (farIndex != -1) {
						Memory.FarCreeps[thisRoom.name].splice(farIndex, 1);
					}
				}
			}*/

			//950 Points
			var muleConfigCost = 950;
			var muleConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, MOVE];
			if (thisRoom.energyCapacityAvailable >= 1500) {
				//1500 Points
				muleConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];
				muleConfigCost = 1500;
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
				if (roomStorage.store[RESOURCE_ENERGY] >= 100000) {
					//Add another mule for resource management
					muleMax++;
					if (thisRoom.energyCapacityAvailable >= 1950) {
						//1950 Points
						upgraderConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY];
					}
				}
				if (roomStorage.store[RESOURCE_ENERGY] >= 200000) {
					//speed up that repairing a bit
					repairMax++;
				}
				if (roomStorage.store[RESOURCE_ENERGY] >= 300000) {
					//Bigger Mules/Repairers
					if (thisRoom.energyCapacityAvailable >= 3000) {
						muleConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];
						muleConfigCost = 3000;
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
					upgradeMiners[0].memory.linkSource = strStorage[0];
					upgradeMiners[0].memory.mineSource = strSources[0];
					upgradeMiners = _.filter(RoomCreeps, (creep) => creep.memory.jobSpecific == 'upgradeMiner');
					storageMiners = _.filter(RoomCreeps, (creep) => creep.memory.jobSpecific == 'storageMiner');
				}

				//thisRoom.visual.text(roomStorage.store[RESOURCE_ENERGY] , roomStorage.pos.x + 1, roomStorage.pos.y, {align: 'left'});
			}


			//800 Points
			var minerConfig = [CARRY, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE];
			//Upgrader to use minerConfig
			//2,200 Points
			var mineralMinerConfig = [MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY]

			var bareMinConfig = [MOVE, MOVE, WORK, CARRY, CARRY];

			if (RoomCreeps.length == 0 && spawn.canCreateCreep(bareMinConfig) == OK) {
				//In case of complete destruction, make a minimum viable worker
				//Make sure 5+ work code has harvester backup path
				if (Game.getObjectById(strStorage[0]).store[RESOURCE_ENERGY] >= 1100) {
					//There's enough in storage for a minimum and a miner. Spawn a crappy mule
					spawn.createCreep([MOVE, MOVE, CARRY, CARRY, CARRY, CARRY], undefined, {
						priority: 'mule',
						linkSource: strLinks[1],
						storageSource: strStorage[0],
						terminalID: strTerminal[0],
						fromSpawn: spawn.id
					});
				} else {
					spawn.createCreep(bareMinConfig, undefined, {
						priority: 'harvester',
						sourceLocation: strSources[1]
					});
				}
			} else if (Memory.roomsUnderAttack.indexOf(thisRoom.name) != -1) {
				if (Memory.roomsPrepSalvager.indexOf(thisRoom.name) != -1) {
					if (thisRoom.energyAvailable >= 1600 && salvagers.length == 0) {
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
									storageTarget: strStorage[0]
								});
								Memory.creepInQue.push(thisRoom.name, 'salvager', '', spawn.name);
							}
						}


					}
				} else if (thisRoom.energyAvailable >= 530) {
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
					while ((remainingEnergy / 530) >= 1) {
						//switch (ChosenPriority) {
						//case 'melee':
						//ToughCount = ToughCount + 1;
						MoveCount = MoveCount + 3;
						AttackCount = AttackCount + 1;
						RangedCount = RangedCount + 2;
						totalParts = totalParts + 6;
						remainingEnergy = remainingEnergy - 530;
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
							ChosenCreepSet.splice(0, 1)
						}
					}

					spawn.createCreep(ChosenCreepSet, undefined, {
						priority: 'defender'
					});
				}
			}
			if (((miners.length < minerMax || mules.length < muleMax || upgraders.length < upgraderMax || repairers.length < repairMax) && spawn.canCreateCreep(minerConfig) == OK) || (roomMineral.mineralAmount > 0 && mineralMiners.length == 0 && spawn.canCreateCreep(mineralMinerConfig) == OK && readyForMineral)) {
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
					storageID = strStorage[0];
					connectedLink = strLinks[1];
					creepSource = strTerminal[0];
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
								connectedLink = strStorage[0];
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
				} else if (mules.length < muleMax && !blockedRole.includes('mule')) {
					prioritizedRole = 'mule';
					storageID = strStorage[0];
					connectedLink = strLinks[1];
					creepSource = strTerminal[0];
				} else if (upgraders.length < upgraderMax && !blockedRole.includes('upgrader')) {
					prioritizedRole = 'upgrader';
					storageID = strStorage[0];
					connectedLink = strLinks[1];
				} else if (repairers.length < repairMax && !blockedRole.includes('repair')) {
					prioritizedRole = 'repair';
					storageID = strStorage[0];
				} else if (roomMineral.mineralAmount > 0 && mineralMiners.length == 0 && readyForMineral && !blockedRole.includes('mineralMiner')) {
					prioritizedRole = 'mineralMiner';
					storageID = strTerminal[0];
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
						}
					} else if (prioritizedRole == 'repair') {
						if (spawn.canCreateCreep(muleConfig) == OK) {
							spawn.createCreep(muleConfig, undefined, {
								priority: prioritizedRole,
								storageSource: storageID,
								fromSpawn: spawn.id
							});
							Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
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
							storageSource: strStorage[0],
							terminalID: strTerminal[0],
							fromSpawn: spawn.id
						});
						Memory.creepInQue.push(thisRoom.name, 'mule', '', spawn.name);
					}
				}
			}
		} else {
			//Add a visual for spawn progress
			//https://r12a.github.io/apps/conversion/ Dank emoji blaze it
			var thisCreepRole = Game.creeps[spawn.spawning.name].memory.priority;
			var relatedUnicode = '';
			switch (thisCreepRole) {
				case 'mule':
					relatedUnicode = '\uD83D\uDC02'
					break;
				case 'miner':
					relatedUnicode = '\u26CF';
					break;
				case 'upgrader':
					relatedUnicode = '\uD83D\uDC46';
					break;
				case 'repair':
					relatedUnicode = '\uD83D\uDEE0';
					break;
				case 'mineralMiner':
					relatedUnicode = '\u26CF \uD83D\uDDFB';
					break;
				case 'salvager':
					relatedUnicode = '\uD83D\uDCB2';
					break;
				case 'defender':
					relatedUnicode = '\u2694';
					break;
				case 'farMiner':
					relatedUnicode = '\u27A1 \u26CF';
					break;
				case 'farMule':
					relatedUnicode = '\u27A1 \uD83D\uDC02';
					break;
				case 'farClaimer':
					relatedUnicode = '\u27A1 \uD83D\uDEA9';
					break;
				case 'farGuard':
					relatedUnicode = '\u27A1 \u2694';
					break;
			}
			var spawnProgress = (spawn.spawning.needTime - spawn.spawning.remainingTime) + 1;
			var percentageComplete = Math.floor((spawnProgress / spawn.spawning.needTime) * 100);

			thisRoom.visual.text(relatedUnicode + ' (' + percentageComplete + '%)', spawn.pos.x + 1, spawn.pos.y, {
				align: 'left'
			});
		}
	}
};

module.exports = spawn_BuildCreeps5;