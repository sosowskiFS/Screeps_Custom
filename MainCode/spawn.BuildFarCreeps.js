var spawn_BuildFarCreeps = {
	run: function(spawn, thisRoom) {
		if (!spawn.spawning) {
			var controlledCreeps = Game.creeps;

			var farMules = [];
			var farClaimers = [];
			var farMiners = [];
			if (Game.flags[thisRoom.name + "FarMining"]) {
				farMules = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining");
				farClaimers = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining");
				farMiners = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining");
			}

			var farGuards = [];
			if (Game.flags[thisRoom.name + "FarGuard"]) {
				farGuards = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarGuard");
			}

			var farMules2 = [];
			var farClaimers2 = [];
			var farMiners2 = [];
			if (Game.flags[thisRoom.name + "FarMining2"]) {
				farMules2 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining2");
				farClaimers2 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining2");
				farMiners2 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining2");
			}

			var farGuards2 = [];
			if (Game.flags[thisRoom.name + "FarGuard2"]) {
				farGuards2 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarGuard2");
			}

			var farMules3 = [];
			var farClaimers3 = [];
			var farMiners3 = [];
			if (Game.flags[thisRoom.name + "FarMining3"]) {
				farMules3 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining3");
				farClaimers3 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining3");
				farMiners3 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining3");
			}

			var farGuards3 = [];
			if (Game.flags[thisRoom.name + "FarGuard3"]) {
				farGuards3 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarGuard3");
			}

			var farMules4 = [];
			var farClaimers4 = [];
			var farMiners4 = [];
			if (Game.flags[thisRoom.name + "FarMining4"]) {
				farMules4 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining4");
				farClaimers4 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining4");
				farMiners4 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining4");
			}

			var farGuards4 = [];
			if (Game.flags[thisRoom.name + "FarGuard4"]) {
				farGuards4 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarGuard4");
			}

			var farMules5 = [];
			var farClaimers5 = [];
			var farMiners5 = [];
			if (Game.flags[thisRoom.name + "FarMining5"]) {
				farMules5 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining5");
				farClaimers5 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining5");
				farMiners5 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining5");
			}

			var farGuards5 = [];
			if (Game.flags[thisRoom.name + "FarGuard5"]) {
				farGuards5 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarGuard5");
			}

			var farMules6 = [];
			var farClaimers6 = [];
			var farMiners6 = [];
			if (Game.flags[thisRoom.name + "FarMining6"]) {
				farMules6 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining6");
				farClaimers6 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining6");
				farMiners6 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining6");
			}

			var farGuards6 = [];
			if (Game.flags[thisRoom.name + "FarGuard6"]) {
				farGuards6 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarGuard6");
			}

			//950 Points
			var farMinerConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, CARRY];
			//1300 Points (Level 4)
			var farMuleConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];
			if (thisRoom.energyCapacityAvailable >= 2500) {
				//2500 Points
				farMuleConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];
			} else if (thisRoom.energyCapacityAvailable >= 2000) {
				farMuleConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];
			} else if (thisRoom.energyCapacityAvailable >= 1800) {
				//1800 Points (level 5)
				farMuleConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];
			}


			//1300 Points
			var farClaimerConfig = [MOVE, MOVE, CLAIM, CLAIM];
			if (thisRoom.energyCapacityAvailable >= 1950) {
				//1950 Points
				farClaimerConfig = [MOVE, MOVE, MOVE, CLAIM, CLAIM, CLAIM];
			}

			//760 Points (Level 3)
			var farGuardConfig = [TOUGH, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, MOVE, HEAL];

			if (thisRoom.energyCapacityAvailable >= 1250) {
				//1250 Points
				var farGuardConfig = [TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, HEAL, HEAL];
			}

			if (thisRoom.energyCapacityAvailable >= 2500) {
				var farGuardConfig = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL];
			}

			var prioritizedRole = '';
			var roomTarget = '';
			var flagName = '';
			var storageID = '';
			var strStorage = Memory.storageList[thisRoom.name];

			var blockedRole = '';
			if (Memory.creepInQue.indexOf(thisRoom.name) >= 0) {
				var RoomPointer = Memory.creepInQue.indexOf(thisRoom.name)
				blockedRole = Memory.creepInQue[RoomPointer + 1];
			}

			if (Game.flags[thisRoom.name + "FarMining"]) {
				if (farMiners.length < 1 && blockedRole != 'farMiner') {
					prioritizedRole = 'farMiner';
					roomTarget = Game.flags[thisRoom.name + "FarMining"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining"].name;
				} else if (farMules.length < 1 && blockedRole != 'farMule') {
					prioritizedRole = 'farMule';
					roomTarget = Game.flags[thisRoom.name + "FarMining"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining"].name;
					storageID = strStorage[0];
				} else if (farClaimers.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining"].pos.roomName] && blockedRole != 'farClaimer') {
					prioritizedRole = 'farClaimer';
					roomTarget = Game.flags[thisRoom.name + "FarMining"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining"].name;
				}
			}

			if (Game.flags[thisRoom.name + "FarGuard"] && prioritizedRole == '') {
				if (farGuards.length < 1 && Game.flags[thisRoom.name + "FarGuard"] && blockedRole != 'farGuard') {
					prioritizedRole = 'farGuard';
					roomTarget = Game.flags[thisRoom.name + "FarGuard"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarGuard"].name;
				}
			}

			if (Game.flags[thisRoom.name + "FarMining2"] && prioritizedRole == '') {
				if (farMiners2.length < 1 && blockedRole != 'farMiner') {
					prioritizedRole = 'farMiner';
					roomTarget = Game.flags[thisRoom.name + "FarMining2"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining2"].name;
				} else if (farMules2.length < 1 && blockedRole != 'farMule') {
					prioritizedRole = 'farMule';
					roomTarget = Game.flags[thisRoom.name + "FarMining2"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining2"].name;
					storageID = strStorage[0];
				} else if (farClaimers2.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining2"].pos.roomName] && blockedRole != 'farClaimer') {
					prioritizedRole = 'farClaimer';
					roomTarget = Game.flags[thisRoom.name + "FarMining2"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining2"].name;
				}
			}

			if (Game.flags[thisRoom.name + "FarGuard2"] && prioritizedRole == '') {
				if (farGuards2.length < 1 && Game.flags[thisRoom.name + "FarGuard2"] && blockedRole != 'farGuard') {
					prioritizedRole = 'farGuard';
					roomTarget = Game.flags[thisRoom.name + "FarGuard2"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarGuard2"].name;
				}
			}

			if (Game.flags[thisRoom.name + "FarMining3"] && prioritizedRole == '') {
				if (farMiners3.length < 1 && blockedRole != 'farMiner') {
					prioritizedRole = 'farMiner';
					roomTarget = Game.flags[thisRoom.name + "FarMining3"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining3"].name;
				} else if (farMules3.length < 1 && blockedRole != 'farMule') {
					prioritizedRole = 'farMule';
					roomTarget = Game.flags[thisRoom.name + "FarMining3"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining3"].name;
					storageID = strStorage[0];
				} else if (farClaimers3.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining3"].pos.roomName] && blockedRole != 'farClaimer') {
					prioritizedRole = 'farClaimer';
					roomTarget = Game.flags[thisRoom.name + "FarMining3"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining3"].name;
				}
			}

			if (Game.flags[thisRoom.name + "FarGuard3"] && prioritizedRole == '') {
				if (farGuards3.length < 1 && Game.flags[thisRoom.name + "FarGuard3"] && blockedRole != 'farGuard') {
					prioritizedRole = 'farGuard';
					roomTarget = Game.flags[thisRoom.name + "FarGuard3"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarGuard3"].name;
				}
			}

			if (Game.flags[thisRoom.name + "FarMining4"] && prioritizedRole == '') {
				if (farMiners4.length < 1 && blockedRole != 'farMiner') {
					prioritizedRole = 'farMiner';
					roomTarget = Game.flags[thisRoom.name + "FarMining4"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining4"].name;
				} else if (farMules4.length < 1 && blockedRole != 'farMule') {
					prioritizedRole = 'farMule';
					roomTarget = Game.flags[thisRoom.name + "FarMining4"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining4"].name;
					storageID = strStorage[0];
				} else if (farClaimers4.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining4"].pos.roomName] && blockedRole != 'farClaimer') {
					prioritizedRole = 'farClaimer';
					roomTarget = Game.flags[thisRoom.name + "FarMining4"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining4"].name;
				}
			}

			if (Game.flags[thisRoom.name + "FarGuard4"] && prioritizedRole == '') {
				if (farGuards4.length < 1 && Game.flags[thisRoom.name + "FarGuard4"] && blockedRole != 'farGuard') {
					prioritizedRole = 'farGuard';
					roomTarget = Game.flags[thisRoom.name + "FarGuard4"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarGuard4"].name;
				}
			}


			if (Game.flags[thisRoom.name + "FarMining5"] && prioritizedRole == '') {
				if (farMiners5.length < 1 && blockedRole != 'farMiner') {
					prioritizedRole = 'farMiner';
					roomTarget = Game.flags[thisRoom.name + "FarMining5"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining5"].name;
				} else if (farMules5.length < 1 && blockedRole != 'farMule') {
					prioritizedRole = 'farMule';
					roomTarget = Game.flags[thisRoom.name + "FarMining5"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining5"].name;
					storageID = strStorage[0];
				} else if (farClaimers5.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining5"].pos.roomName] && blockedRole != 'farClaimer') {
					prioritizedRole = 'farClaimer';
					roomTarget = Game.flags[thisRoom.name + "FarMining5"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining5"].name;
				}
			}

			if (Game.flags[thisRoom.name + "FarGuard5"] && prioritizedRole == '') {
				if (farGuards5.length < 1 && Game.flags[thisRoom.name + "FarGuard5"] && blockedRole != 'farGuard') {
					prioritizedRole = 'farGuard';
					roomTarget = Game.flags[thisRoom.name + "FarGuard5"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarGuard5"].name;
				}
			}


			if (Game.flags[thisRoom.name + "FarMining6"] && prioritizedRole == '') {
				if (farMiners6.length < 1 && blockedRole != 'farMiner') {
					prioritizedRole = 'farMiner';
					roomTarget = Game.flags[thisRoom.name + "FarMining6"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining6"].name;
				} else if (farMules6.length < 1 && blockedRole != 'farMule') {
					prioritizedRole = 'farMule';
					roomTarget = Game.flags[thisRoom.name + "FarMining6"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining6"].name;
					storageID = strStorage[0];
				} else if (farClaimers6.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining6"].pos.roomName] && blockedRole != 'farClaimer') {
					prioritizedRole = 'farClaimer';
					roomTarget = Game.flags[thisRoom.name + "FarMining6"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining6"].name;
				}
			}

			if (Game.flags[thisRoom.name + "FarGuard6"] && prioritizedRole == '') {
				if (farGuards6.length < 1 && Game.flags[thisRoom.name + "FarGuard6"] && blockedRole != 'farGuard') {
					prioritizedRole = 'farGuard';
					roomTarget = Game.flags[thisRoom.name + "FarGuard6"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarGuard6"].name;
				}
			}


			if (prioritizedRole != '') {
				if (prioritizedRole == 'farClaimer') {
					if (spawn.canCreateCreep(farClaimerConfig) == OK) {
						spawn.createCreep(farClaimerConfig, undefined, {
							priority: prioritizedRole,
							destination: roomTarget,
							fromSpawn: spawn.id,
							homeRoom: thisRoom.name,
							targetFlag: flagName
						});
						Memory.FarClaimerNeeded[Game.flags[flagName].pos.roomName] = false;
						Memory.creepInQue.push(thisRoom.name, prioritizedRole, '', spawn.name);
					}
				} else if (prioritizedRole == 'farMiner') {
					if (spawn.canCreateCreep(farMinerConfig) == OK) {
						spawn.createCreep(farMinerConfig, undefined, {
							priority: prioritizedRole,
							destination: roomTarget,
							fromSpawn: spawn.id,
							homeRoom: thisRoom.name,
							targetFlag: flagName
						});
						Memory.creepInQue.push(thisRoom.name, prioritizedRole, '', spawn.name);
					}
				} else if (prioritizedRole == 'farMule') {
					if (spawn.canCreateCreep(farMuleConfig) == OK) {
						spawn.createCreep(farMuleConfig, undefined, {
							priority: prioritizedRole,
							destination: roomTarget,
							homeRoom: thisRoom.name,
							storageSource: storageID,
							fromSpawn: spawn.id,
							targetFlag: flagName
						});
						Memory.creepInQue.push(thisRoom.name, prioritizedRole, '', spawn.name);
					}
				} else if (prioritizedRole == 'farGuard') {
					if (spawn.canCreateCreep(farGuardConfig) == OK) {
						spawn.createCreep(farGuardConfig, undefined, {
							priority: prioritizedRole,
							destination: roomTarget,
							homeRoom: thisRoom.name,
							fromSpawn: spawn.id,
							targetFlag: flagName
						});
						Memory.creepInQue.push(thisRoom.name, prioritizedRole, '', spawn.name);
					}
				}
			}

		}
	}
}

module.exports = spawn_BuildFarCreeps;