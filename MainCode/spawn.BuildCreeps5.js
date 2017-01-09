var spawn_BuildCreeps5 = {
	run: function(spawn, thisRoom) {
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

			var farMules = _.filter(Game.creeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name);
			var farClaimers = _.filter(Game.creeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name);
			var farMiners = _.filter(Game.creeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name);

			var minerMax = 2;
			var muleMax = 1;
			var upgraderMax = 2;
			var repairMax = 1;
			var strSources = Memory.sourceList[thisRoom.name];
			var strLinks = Memory.linkList[thisRoom.name];
			var strStorage = Memory.storageList[thisRoom.name];
			var strMineral = Memory.mineralList[thisRoom.name];
			var strTerminal = Memory.terminalList[thisRoom.name];
			var strExtractor = Memory.extractorList[thisRoom.name];
			var readyForMineral = false;
			if (strExtractor[0] && strTerminal[0] && strMineral[0]) {
				readyForMineral = true;
			}
			var usingFarMiners = false;
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

			var farMinerCount = 0;
			var farClaimerCount = 0;
			var farMuleCount = 0;
			if (Memory.FarCreeps[thisRoom.name]) {
				//Enable far miner consideration for this spawn
				usingFarMiners = true;
				var creepCount = Memory.FarCreeps[thisRoom.name].reduce(function(m, v) {
					for (var k in m) {
						if (~v.indexOf(k)) m[k]++;
					}
					return m;
				}, {
					farClaimer: 0,
					farMiner: 0,
					farMule: 0
				});

				farMinerCount = creepCount.farMiner;
				farClaimerCount = creepCount.farClaimer;
				farMuleCount = creepCount.farMule;

				if (farMules.length) {
					if (farMules.length < farMuleCount) {
						//Lost a creep, remove it from the memory value
						var farIndex = Memory.FarCreeps[thisRoom.name].indexOf('farMule');
						if (farIndex != -1) {
							Memory.FarCreeps[thisRoom.name].splice(farIndex, 1);
						}
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
				}
				if (farMiners.length) {
					if (farMiners.length < farMinerCount) {
						//Lost a creep, remove it from the memory value
						var farIndex = Memory.FarCreeps[thisRoom.name].indexOf('farMiner');
						if (farIndex != -1) {
							Memory.FarCreeps[thisRoom.name].splice(farIndex, 1);
						}
					}
				}
			}

			var roomMineral = Game.getObjectById(strMineral[0]);
			var roomStorage = Game.getObjectById(strStorage[0]);
			if (roomStorage) {
				if (roomStorage.store[RESOURCE_ENERGY] >= 5000) {
					//Add another mule for resource management
					muleMax++;
				}
				if (roomStorage.store[RESOURCE_ENERGY] >= 10000) {
					//speed up that repairing a bit
					repairMax++;
				}
				if (roomStorage.store[RESOURCE_ENERGY] >= 25000) {
					//speed up that repairing a bit
					muleMax++;
				}
				if (roomStorage.store[RESOURCE_ENERGY] >= 50000) {
					//speed it up a LOT
					repairMax++;
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
			}

			//800 Points
			var minerConfig = [CARRY, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE];
			//950 Points
			var muleConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, MOVE];
			//950 Points
			var farMinerConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, CARRY];
			//2000 Points
			var farMuleConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];
			//1950 Points
			var farClaimerConfig = [MOVE, MOVE, MOVE, CLAIM, CLAIM, CLAIM];
			//Upgrader to use minerConfig
			//2,200 Points
			var mineralMinerConfig = [MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY]

			var bareMinConfig = [MOVE, MOVE, WORK, CARRY, CARRY];

			if (RoomCreeps.length == 0 && spawn.canCreateCreep(bareMinConfig) == OK) {
				//In case of complete destruction, make a minimum viable worker
				//Make sure 5+ work code has harvester backup path
				if (Game.getObjectById(strStorage[0]).store[RESOURCE_ENERGY] >= 1100) {
					//There's enough in storage for a minimum and a miner. Spawn a crappy mule
					spawn.createCreep([MOVE, CARRY, CARRY], undefined, {
						priority: 'mule',
						linkSource: strLinks[1],
						storageSource: strStorage[0],
						terminalID: strTerminal[0],
						fromSpawn: spawn
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
						if (Memory.creepInQue.indexOf(thisRoom.name) >= 0) {
							var RoomPointer = Memory.creepInQue.indexOf(thisRoom.name)
							blockedRole = Memory.creepInQue[RoomPointer + 1];
						}
						if (blockedRole != 'salvager') { //Produce a salvager unit to pick up the dropped resources
							spawn.createCreep([MOVE, MOVE, CARRY, CARRY, CARRY, CARRY], undefined, {
								priority: 'salvager',
								storageTarget: strStorage[0]
							});
							Memory.creepInQue.push(thisRoom.name, 'salvager', '', spawn.name);
						}


					}
				} else if (thisRoom.energyAvailable >= 950) {
					//Try to produce millitary units

					//Melee unit set: TOUGH, TOUGH, MOVE, MOVE, MOVE, ATTACK - 250
					//Ranged unit set: MOVE, MOVE, RANGED_ATTACK - 250

					//Damaged modules do not work, put padding first.

					var meleeUnits = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'melee');
					var rangedUnits = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'ranged');

					var ChosenPriority = '';
					if (meleeUnits <= rangedUnits) {
						ChosenPriority = 'melee';
					} else {
						ChosenPriority = 'ranged';
					}

					var ToughCount = 0;
					var MoveCount = 0;
					var AttackCount = 0;
					var RangedCount = 0;
					var totalParts = 0;

					var remainingEnergy = thisRoom.energyAvailable;
					while ((remainingEnergy / 950) >= 1) {
						switch (ChosenPriority) {
							case 'melee':
								ToughCount = ToughCount + 1;
								MoveCount = MoveCount + 2;
								AttackCount = AttackCount + 3;
								totalParts = totalParts + 6;
								remainingEnergy = remainingEnergy - 350;
								break;
							case 'ranged':
								MoveCount = MoveCount + 2;
								RangedCount = RangedCount + 2;
								totalParts = totalParts + 4;
								remainingEnergy = remainingEnergy - 400;
								break;
						}

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
						priority: ChosenPriority
					});
				}
			}
			if (((miners.length < minerMax || mules.length < muleMax || upgraders.length < upgraderMax || repairers.length < repairMax) && spawn.canCreateCreep(muleConfig) == OK) || (roomMineral.mineralAmount > 0 && mineralMiners.length == 0 && spawn.canCreateCreep(mineralMinerConfig) == OK && readyForMineral) || (usingFarMiners)) {
				var prioritizedRole = '';
				var creepSource = '';
				var connectedLink = '';
				var storageID = '';
				var jobSpecificPri = '';
				var blockedRole = '';
				var blockedSubRole = '';
				var roomTarget = '';
				var farSource = '';
				var muleNumber = 1;
				if (Memory.creepInQue.indexOf(thisRoom.name) >= 0) {
					var RoomPointer = Memory.creepInQue.indexOf(thisRoom.name)
					blockedRole = Memory.creepInQue[RoomPointer + 1];
					blockedSubRole = Memory.creepInQue[RoomPointer + 2];
				}

				if (miners.length == 1 && mules.length == 0 && blockedRole != 'mule') {
					prioritizedRole = 'mule';
					storageID = strStorage[0];
					connectedLink = strLinks[1];
					creepSource = strTerminal[0];
				} else if (miners.length < minerMax && blockedRole != 'miner') {
					switch (storageMiners.length) {
						case 0:
							if (blockedSubRole != 'storageMiner') {
								prioritizedRole = 'miner';
								creepSource = strSources[0];
								connectedLink = strStorage[0];
								jobSpecificPri = 'storageMiner';
							}
							break;
						case 1:
							if (blockedSubRole != 'upgradeMiner') {
								prioritizedRole = 'miner';
								creepSource = strSources[1];
								connectedLink = strLinks[0];
								jobSpecificPri = 'upgradeMiner';
							}
							break;
					}
				} else if (mules.length < muleMax && blockedRole != 'mule') {
					prioritizedRole = 'mule';
					storageID = strStorage[0];
					connectedLink = strLinks[1];
					creepSource = strTerminal[0];
				} else if (upgraders.length < upgraderMax && blockedRole != 'upgrader') {
					prioritizedRole = 'upgrader';
					storageID = strStorage[0];
					connectedLink = strLinks[1];
				} else if (repairers.length < repairMax && blockedRole != 'repair') {
					prioritizedRole = 'repair';
					storageID = strStorage[0];
				} else if (roomMineral.mineralAmount > 0 && mineralMiners.length == 0 && readyForMineral && blockedRole != 'mineralMiner') {
					prioritizedRole = 'mineralMiner';
					storageID = strTerminal[0];
					creepSource = strMineral[0];
					connectedLink = strExtractor[0];
				} else if (usingFarMiners && farClaimerCount < 1 && Memory.FarClaimerNeeded[thisRoom.name] == true && blockedRole != 'farClaimer') {
					//Claimer
					prioritizedRole = 'farClaimer';
					roomTarget = Game.flags[thisRoom.name + "FarMining"].pos.roomName;
				} else if (usingFarMiners && farMinerCount < 1 && blockedRole != 'farMiner') {
					//Miner
					prioritizedRole = 'farMiner';
					roomTarget = Game.flags[thisRoom.name + "FarMining"].pos.roomName;
				} else if (usingFarMiners && farMuleCount < 2 && blockedRole != 'farMule') {
					//Mule
					prioritizedRole = 'farMule';
					roomTarget = Game.flags[thisRoom.name + "FarMining"].pos.roomName;
					storageID = strStorage[0];
					if (farMules.length) {
						switch (farMules[0].memory.muleNum) {
							case 1:
								muleNumber = 2;
								break;
							case 2:
								muleNumber = 1;
								break;
						}
					} else {
						muleNumber = 1
					}
				}

				if (prioritizedRole != '') {
					if (prioritizedRole == 'miner') {
						spawn.createCreep(minerConfig, undefined, {
							priority: prioritizedRole,
							mineSource: creepSource,
							linkSource: connectedLink,
							jobSpecific: jobSpecificPri,
							fromSpawn: spawn
						});
					} else if (prioritizedRole == 'mule') {
						spawn.createCreep(muleConfig, undefined, {
							priority: prioritizedRole,
							linkSource: connectedLink,
							storageSource: storageID,
							terminalID: creepSource,
							fromSpawn: spawn
						});
					} else if (prioritizedRole == 'upgrader') {
						spawn.createCreep(minerConfig, undefined, {
							priority: prioritizedRole,
							linkSource: connectedLink,
							storageSource: storageID,
							fromSpawn: spawn
						});
					} else if (prioritizedRole == 'repair') {
						spawn.createCreep(muleConfig, undefined, {
							priority: prioritizedRole,
							storageSource: storageID,
							fromSpawn: spawn
						});
					} else if (prioritizedRole == 'mineralMiner') {
						spawn.createCreep(mineralMinerConfig, undefined, {
							priority: prioritizedRole,
							terminalID: storageID,
							mineralID: creepSource,
							extractorID: connectedLink,
							fromSpawn: spawn
						});
					} else if (prioritizedRole == 'farClaimer') {
						if (spawn.canCreateCreep(farClaimerConfig) == OK) {
							spawn.createCreep(farClaimerConfig, undefined, {
								priority: prioritizedRole,
								destination: roomTarget,
								fromSpawn: spawn,
								homeRoom: thisRoom.name
							});
							Memory.FarClaimerNeeded[thisRoom.name] = false;
						}
					} else if (prioritizedRole == 'farMiner') {
						if (spawn.canCreateCreep(farMinerConfig) == OK) {
							spawn.createCreep(farMinerConfig, undefined, {
								priority: prioritizedRole,
								destination: roomTarget,
								fromSpawn: spawn,
								homeRoom: thisRoom.name
							});
						}
					} else if (prioritizedRole == 'farMule') {
						if (spawn.canCreateCreep(farMuleConfig) == OK) {
							spawn.createCreep(farMuleConfig, undefined, {
								priority: prioritizedRole,
								destination: roomTarget,
								homeRoom: thisRoom.name,
								storageSource: storageID,
								fromSpawn: spawn,
								muleNum: muleNumber
							});
						}
					}
					Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
				}
			} else if (mules.length == 0) {
				var blockedRole = '';
				var blockedSubRole = '';
				if (Memory.creepInQue.indexOf(thisRoom.name) >= 0) {
					var RoomPointer = Memory.creepInQue.indexOf(thisRoom.name)
					blockedRole = Memory.creepInQue[RoomPointer + 1];
					blockedSubRole = Memory.creepInQue[RoomPointer + 2];
				}
				if (blockedRole != 'mule') {
					//Spawn a crappy mule
					spawn.createCreep([MOVE, CARRY, CARRY], undefined, {
						priority: 'mule',
						linkSource: strLinks[1],
						storageSource: strStorage[0],
						terminalID: strTerminal[0],
						fromSpawn: spawn
					});
					Memory.creepInQue.push(thisRoom.name, 'mule', '', spawn.name);
				}
			}
		}
	}
};

module.exports = spawn_BuildCreeps5;