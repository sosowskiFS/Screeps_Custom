var spawn_BuildFarCreeps = {
	run: function(spawn, thisRoom) {
		if (!spawn.spawning) {
			var controlledCreeps = Game.creeps;

			var eFarGuards = [];
			if (Memory.warMode) {
				eFarGuards = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "eFarGuard");
			}

			var farMules = [];
			var farClaimers = [];
			var farMiners = [];
			var room1Distance = 1;

			var farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE];

			if (Game.flags[thisRoom.name + "FarMining"]) {
				farMules = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining");
				farClaimers = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining");
				farMiners = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining");
				room1Distance = Game.map.getRoomLinearDistance(thisRoom.name, Game.flags[thisRoom.name + "FarMining"].pos.roomName);
			}

			var farGuards = [];
			if (Game.flags[thisRoom.name + "FarGuard"] || Game.flags[thisRoom.name + "FarGuardTEMP"]) {
				farGuards = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarGuard");
			}

			var farMules2 = [];
			var farClaimers2 = [];
			var farMiners2 = [];
			var room2Distance = 1;
			if (Game.flags[thisRoom.name + "FarMining2"]) {
				farMules2 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining2");
				farClaimers2 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining2");
				farMiners2 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining2");
				room2Distance = Game.map.getRoomLinearDistance(thisRoom.name, Game.flags[thisRoom.name + "FarMining2"].pos.roomName);
			}

			var farGuards2 = [];
			if (Game.flags[thisRoom.name + "FarGuard2"] || Game.flags[thisRoom.name + "FarGuard2TEMP"]) {
				farGuards2 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarGuard2");
			}

			var farMules3 = [];
			var farClaimers3 = [];
			var farMiners3 = [];
			var room3Distance = 1;
			if (Game.flags[thisRoom.name + "FarMining3"]) {
				farMules3 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining3");
				farClaimers3 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining3");
				farMiners3 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining3");
				room3Distance = Game.map.getRoomLinearDistance(thisRoom.name, Game.flags[thisRoom.name + "FarMining3"].pos.roomName);
			}

			var farGuards3 = [];
			if (Game.flags[thisRoom.name + "FarGuard3"] || Game.flags[thisRoom.name + "FarGuard3TEMP"]) {
				farGuards3 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarGuard3");
			}

			var farMules4 = [];
			var farClaimers4 = [];
			var farMiners4 = [];
			var room4Distance = 1;
			if (Game.flags[thisRoom.name + "FarMining4"]) {
				farMules4 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining4");
				farClaimers4 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining4");
				farMiners4 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining4");
				room4Distance = Game.map.getRoomLinearDistance(thisRoom.name, Game.flags[thisRoom.name + "FarMining4"].pos.roomName);
			}

			var farGuards4 = [];
			if (Game.flags[thisRoom.name + "FarGuard4"] || Game.flags[thisRoom.name + "FarGuard4TEMP"]) {
				farGuards4 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarGuard4");
			}

			var farMules5 = [];
			var farClaimers5 = [];
			var farMiners5 = [];
			var room5Distance = 1;
			if (Game.flags[thisRoom.name + "FarMining5"]) {
				farMules5 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining5");
				farClaimers5 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining5");
				farMiners5 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining5");
				room5Distance = Game.map.getRoomLinearDistance(thisRoom.name, Game.flags[thisRoom.name + "FarMining5"].pos.roomName);
			}

			var farGuards5 = [];
			if (Game.flags[thisRoom.name + "FarGuard5"] || Game.flags[thisRoom.name + "FarGuard5TEMP"]) {
				farGuards5 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarGuard5");
			}

			var farMules6 = [];
			var farClaimers6 = [];
			var farMiners6 = [];
			var room6Distance = 1;
			if (Game.flags[thisRoom.name + "FarMining6"]) {
				farMules6 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining6");
				farClaimers6 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining6");
				farMiners6 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining6");
				room6Distance = Game.map.getRoomLinearDistance(thisRoom.name, Game.flags[thisRoom.name + "FarMining6"].pos.roomName);
			}

			var farGuards6 = [];
			if (Game.flags[thisRoom.name + "FarGuard6"] || Game.flags[thisRoom.name + "FarGuard6TEMP"]) {
				farGuards6 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarGuard6");
			}

			var SKAttackGuards = [];
			var SKHealGuards = [];
			if (Game.flags[thisRoom.name + "SKGuard"]) {
				SKAttackGuards = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'SKAttackGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "SKGuard");
				SKHealGuards = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'SKHealGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "SKGuard");
			}

			var farMineralMiners = [];
			if (Game.flags[thisRoom.name + "FarMineral"]) {
				farMineralMiners = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMineralMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMineral");
			}

			var farMuleConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK];
			if (thisRoom.energyCapacityAvailable >= 2300 && thisRoom.controller.level >= 7) {
				farMuleConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK];
			} else if (thisRoom.energyCapacityAvailable >= 1700) {
				farMuleConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK];
			}

			//1300 Points
			var farClaimerConfig = [CLAIM, CLAIM, MOVE, MOVE];
			if (thisRoom.energyCapacityAvailable >= 2600) {
				//2600 Points
				farClaimerConfig = [CLAIM, CLAIM, CLAIM, CLAIM, MOVE, MOVE, MOVE, MOVE];
			} else if (thisRoom.energyCapacityAvailable >= 1950) {
				//1950 Points
				farClaimerConfig = [CLAIM, CLAIM, CLAIM, MOVE, MOVE, MOVE];
			}

			//760 Points (Level 3)
			var farGuardConfig = [TOUGH, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, MOVE, HEAL];

			//2650
			var SKGuardAttackerConfig = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE];
			//3000
			var SKGuardHealerConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];

			if (Memory.warMode) {
				if (Memory.guardType) {
					//Ranged Guard
					if (thisRoom.energyCapacityAvailable >= 5100) {
						farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL];
					} else if (thisRoom.energyCapacityAvailable >= 3100) {
						farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL];
					} else if (thisRoom.energyCapacityAvailable >= 2300) {
						farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL];
					} else if (thisRoom.energyCapacityAvailable >= 1800) {
						farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL];
					} else if (thisRoom.energyCapacityAvailable >= 1280) {
						//1250 Points
						farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL];
					}
				} else {
					//Melee Guard
					if (thisRoom.energyCapacityAvailable >= 3420) {
						farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, HEAL];
					} else if (thisRoom.energyCapacityAvailable >= 3090) {
						farGuardConfig = [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, HEAL];
					} else if (thisRoom.energyCapacityAvailable >= 2300) {
						farGuardConfig = [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, HEAL];
					} else if (thisRoom.energyCapacityAvailable >= 1790) {
						farGuardConfig = [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, HEAL];
					} else if (thisRoom.energyCapacityAvailable >= 1270) {
						//1250 Points
						farGuardConfig = [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, HEAL];
					}
				}
			} else {
				if (Memory.guardType) {
					if (thisRoom.energyCapacityAvailable >= 1280) {
						farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL];
					}
				} else {
					if (thisRoom.energyCapacityAvailable >= 1270) {
						farGuardConfig = [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, HEAL];
					}
				}
			}

			var prioritizedRole = '';
			var roomTarget = '';
			var flagName = '';
			var storageID = '';
			var healTarget;

			var blockedRole = '';
			if (Memory.creepInQue.indexOf(thisRoom.name) >= 0) {
				var RoomPointer = Memory.creepInQue.indexOf(thisRoom.name)
				blockedRole = Memory.creepInQue[RoomPointer + 1];
			}

			if (Memory.warMode) {
				if (eFarGuards.length < 1 && Game.flags[thisRoom.name + "eFarGuard"] && blockedRole != 'farGuard') {
					prioritizedRole = 'farGuard';
					roomTarget = Game.flags[thisRoom.name + "eFarGuard"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "eFarGuard"].name;
				}
			}

			if (Game.flags[thisRoom.name + "SKGuard"] && prioritizedRole == '') {
				if (SKAttackGuards.length < 1 && blockedRole != 'SKAttackGuard') {
					prioritizedRole = 'SKAttackGuard';
					roomTarget = Game.flags[thisRoom.name + "SKGuard"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "SKGuard"].name;
				} else if (SKHealGuards.length < 1 && blockedRole != 'SKHealGuard') {
					prioritizedRole = 'SKHealGuard';
					roomTarget = Game.flags[thisRoom.name + "SKGuard"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "SKGuard"].name;
					healTarget = SKAttackGuards[0].id;
				}
			}

			if (Game.flags[thisRoom.name + "FarGuard"] || Game.flags[thisRoom.name + "FarGuardTEMP"] && prioritizedRole == '') {
				if (farGuards.length < 1 && Game.flags[thisRoom.name + "FarGuard"] && blockedRole != 'farGuard') {
					prioritizedRole = 'farGuard';
					roomTarget = Game.flags[thisRoom.name + "FarGuard"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarGuard"].name;
					if (Game.flags[Game.flags[thisRoom.name + "FarGuard"].pos.roomName + "SKRoom"]) {
						farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL];
					}
				}
			}

			if (Game.flags[thisRoom.name + "FarMining"] && prioritizedRole == '') {
				if (farMiners.length < 1 && blockedRole != 'farMiner') {
					prioritizedRole = 'farMiner';
					roomTarget = Game.flags[thisRoom.name + "FarMining"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining"].name;
					if (Game.flags[Game.flags[thisRoom.name + "FarMining"].pos.roomName + "SKRoom"]) {
						farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
					} else if (Game.flags[Game.flags[thisRoom.name + "FarMining"].pos.roomName + "NoSKRoom"]) {
						farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE];
					}
				} else if (farMules.length < room1Distance && blockedRole != 'farMule') {
					prioritizedRole = 'farMule';
					roomTarget = Game.flags[thisRoom.name + "FarMining"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining"].name;
					storageID = thisRoom.storage.id;
					if (Game.flags[Game.flags[thisRoom.name + "FarMining"].pos.roomName + "SKRoom"]) {
						farMuleConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK];
					}
				} else if (farClaimers.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining"].pos.roomName] && blockedRole != 'farClaimer') {
					prioritizedRole = 'farClaimer';
					roomTarget = Game.flags[thisRoom.name + "FarMining"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining"].name;
				}
			}

			if (Game.flags[thisRoom.name + "FarGuard2"] || Game.flags[thisRoom.name + "FarGuard2TEMP"] && prioritizedRole == '') {
				if (farGuards2.length < 1 && Game.flags[thisRoom.name + "FarGuard2"] && blockedRole != 'farGuard') {
					prioritizedRole = 'farGuard';
					roomTarget = Game.flags[thisRoom.name + "FarGuard2"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarGuard2"].name;
					if (Game.flags[Game.flags[thisRoom.name + "FarGuard2"].pos.roomName + "SKRoom"]) {
						farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL];
					}
				}
			}

			if (Game.flags[thisRoom.name + "FarMining2"] && prioritizedRole == '') {
				if (farMiners2.length < 1 && blockedRole != 'farMiner') {
					prioritizedRole = 'farMiner';
					roomTarget = Game.flags[thisRoom.name + "FarMining2"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining2"].name;
					if (Game.flags[Game.flags[thisRoom.name + "FarMining2"].pos.roomName + "SKRoom"]) {
						farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
					} else if (Game.flags[Game.flags[thisRoom.name + "FarMining2"].pos.roomName + "NoSKRoom"]) {
						farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE];
					}
				} else if (farMules2.length < room2Distance && blockedRole != 'farMule') {
					prioritizedRole = 'farMule';
					roomTarget = Game.flags[thisRoom.name + "FarMining2"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining2"].name;
					storageID = thisRoom.storage.id;
					if (Game.flags[Game.flags[thisRoom.name + "FarMining2"].pos.roomName + "SKRoom"]) {
						farMuleConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK];
					}
				} else if (farClaimers2.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining2"].pos.roomName] && blockedRole != 'farClaimer') {
					prioritizedRole = 'farClaimer';
					roomTarget = Game.flags[thisRoom.name + "FarMining2"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining2"].name;
				}
			}

			if (Game.flags[thisRoom.name + "FarGuard3"] || Game.flags[thisRoom.name + "FarGuard3TEMP"] && prioritizedRole == '') {
				if (farGuards3.length < 1 && Game.flags[thisRoom.name + "FarGuard3"] && blockedRole != 'farGuard') {
					prioritizedRole = 'farGuard';
					roomTarget = Game.flags[thisRoom.name + "FarGuard3"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarGuard3"].name;
					if (Game.flags[Game.flags[thisRoom.name + "FarGuard3"].pos.roomName + "SKRoom"]) {
						farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL];
					}
				}
			}

			if (Game.flags[thisRoom.name + "FarMining3"] && prioritizedRole == '') {
				if (farMiners3.length < 1 && blockedRole != 'farMiner') {
					prioritizedRole = 'farMiner';
					roomTarget = Game.flags[thisRoom.name + "FarMining3"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining3"].name;
					if (Game.flags[Game.flags[thisRoom.name + "FarMining3"].pos.roomName + "SKRoom"]) {
						farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
					} else if (Game.flags[Game.flags[thisRoom.name + "FarMining3"].pos.roomName + "NoSKRoom"]) {
						farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE];
					}
				} else if (farMules3.length < room3Distance && blockedRole != 'farMule') {
					prioritizedRole = 'farMule';
					roomTarget = Game.flags[thisRoom.name + "FarMining3"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining3"].name;
					storageID = thisRoom.storage.id;
					if (Game.flags[Game.flags[thisRoom.name + "FarMining3"].pos.roomName + "SKRoom"]) {
						farMuleConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK];
					}
				} else if (farClaimers3.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining3"].pos.roomName] && blockedRole != 'farClaimer') {
					prioritizedRole = 'farClaimer';
					roomTarget = Game.flags[thisRoom.name + "FarMining3"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining3"].name;
				}
			}

			if (Game.flags[thisRoom.name + "FarGuard4"] || Game.flags[thisRoom.name + "FarGuard4TEMP"] && prioritizedRole == '') {
				if (farGuards4.length < 1 && Game.flags[thisRoom.name + "FarGuard4"] && blockedRole != 'farGuard') {
					prioritizedRole = 'farGuard';
					roomTarget = Game.flags[thisRoom.name + "FarGuard4"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarGuard4"].name;
					if (Game.flags[Game.flags[thisRoom.name + "FarGuard4"].pos.roomName + "SKRoom"]) {
						farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL];
					}
				}
			}

			if (Game.flags[thisRoom.name + "FarMining4"] && prioritizedRole == '') {
				if (farMiners4.length < 1 && blockedRole != 'farMiner') {
					prioritizedRole = 'farMiner';
					roomTarget = Game.flags[thisRoom.name + "FarMining4"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining4"].name;
					if (Game.flags[Game.flags[thisRoom.name + "FarMining4"].pos.roomName + "SKRoom"]) {
						farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
					} else if (Game.flags[Game.flags[thisRoom.name + "FarMining4"].pos.roomName + "NoSKRoom"]) {
						farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE];
					}
				} else if (farMules4.length < room4Distance && blockedRole != 'farMule') {
					prioritizedRole = 'farMule';
					roomTarget = Game.flags[thisRoom.name + "FarMining4"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining4"].name;
					storageID = thisRoom.storage.id;
					if (Game.flags[Game.flags[thisRoom.name + "FarMining4"].pos.roomName + "SKRoom"]) {
						farMuleConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK];
					}
				} else if (farClaimers4.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining4"].pos.roomName] && blockedRole != 'farClaimer') {
					prioritizedRole = 'farClaimer';
					roomTarget = Game.flags[thisRoom.name + "FarMining4"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining4"].name;
				}
			}

			if (Game.flags[thisRoom.name + "FarGuard5"] || Game.flags[thisRoom.name + "FarGuard5TEMP"] && prioritizedRole == '') {
				if (farGuards5.length < 1 && Game.flags[thisRoom.name + "FarGuard5"] && blockedRole != 'farGuard') {
					prioritizedRole = 'farGuard';
					roomTarget = Game.flags[thisRoom.name + "FarGuard5"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarGuard5"].name;
					if (Game.flags[Game.flags[thisRoom.name + "FarGuard5"].pos.roomName + "SKRoom"]) {
						farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL];
					}
				}
			}

			if (Game.flags[thisRoom.name + "FarMining5"] && prioritizedRole == '') {
				if (farMiners5.length < 1 && blockedRole != 'farMiner') {
					prioritizedRole = 'farMiner';
					roomTarget = Game.flags[thisRoom.name + "FarMining5"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining5"].name;
					if (Game.flags[Game.flags[thisRoom.name + "FarMining5"].pos.roomName + "SKRoom"]) {
						farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
					} else if (Game.flags[Game.flags[thisRoom.name + "FarMining5"].pos.roomName + "NoSKRoom"]) {
						farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE];
					}
				} else if (farMules5.length < room5Distance && blockedRole != 'farMule') {
					prioritizedRole = 'farMule';
					roomTarget = Game.flags[thisRoom.name + "FarMining5"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining5"].name;
					storageID = thisRoom.storage.id;
					if (Game.flags[Game.flags[thisRoom.name + "FarMining5"].pos.roomName + "SKRoom"]) {
						farMuleConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK];
					}
				} else if (farClaimers5.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining5"].pos.roomName] && blockedRole != 'farClaimer') {
					prioritizedRole = 'farClaimer';
					roomTarget = Game.flags[thisRoom.name + "FarMining5"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining5"].name;
				}
			}

			if (Game.flags[thisRoom.name + "FarGuard6"] || Game.flags[thisRoom.name + "FarGuard6TEMP"] && prioritizedRole == '') {
				if (farGuards6.length < 1 && Game.flags[thisRoom.name + "FarGuard6"] && blockedRole != 'farGuard') {
					prioritizedRole = 'farGuard';
					roomTarget = Game.flags[thisRoom.name + "FarGuard6"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarGuard6"].name;
					if (Game.flags[Game.flags[thisRoom.name + "FarGuard6"].pos.roomName + "SKRoom"]) {
						farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL];
					}
				}
			}

			if (Game.flags[thisRoom.name + "FarMining6"] && prioritizedRole == '') {
				if (farMiners6.length < 1 && blockedRole != 'farMiner') {
					prioritizedRole = 'farMiner';
					roomTarget = Game.flags[thisRoom.name + "FarMining6"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining6"].name;
					if (Game.flags[Game.flags[thisRoom.name + "FarMining6"].pos.roomName + "SKRoom"]) {
						farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
					} else if (Game.flags[Game.flags[thisRoom.name + "FarMining6"].pos.roomName + "NoSKRoom"]) {
						farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE];
					}
				} else if (farMules6.length < room6Distance && blockedRole != 'farMule') {
					prioritizedRole = 'farMule';
					roomTarget = Game.flags[thisRoom.name + "FarMining6"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining6"].name;
					storageID = thisRoom.storage.id;
					if (Game.flags[Game.flags[thisRoom.name + "FarMining6"].pos.roomName + "SKRoom"]) {
						farMuleConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK];
					}
				} else if (farClaimers6.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining6"].pos.roomName] && blockedRole != 'farClaimer') {
					prioritizedRole = 'farClaimer';
					roomTarget = Game.flags[thisRoom.name + "FarMining6"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining6"].name;
				}
			}

			if (Game.flags[thisRoom.name + "FarMineral"] && Memory.SKMineralTimers[Game.flags[thisRoom.name + "FarMineral"].pos.roomName] <= 0 && thisRoom.terminal && prioritizedRole == '') {
				if (farMineralMiners.length < 1 && blockedRole != 'farMineralMiner') {
					prioritizedRole = 'farMineralMiner';
					roomTarget = Game.flags[thisRoom.name + "FarMineral"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMineral"].name;
					storageID = thisRoom.terminal.id;
					farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
				}
			}

			var farMineralMiners = [];
			if (Game.flags[thisRoom.name + "FarMineral"]) {
				farMineralMiners = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMineralMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMineral");
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
					Memory.guardType = !Memory.guardType;
				} else if (prioritizedRole == 'farMineralMiner') {
					if (spawn.canCreateCreep(farMinerConfig) == OK) {
						spawn.createCreep(farMinerConfig, undefined, {
							priority: prioritizedRole,
							destination: roomTarget,
							homeRoom: thisRoom.name,
							fromSpawn: spawn.id,
							storageSource: storageID,
							targetFlag: flagName
						});
						Memory.creepInQue.push(thisRoom.name, prioritizedRole, '', spawn.name);
					}
				} else if (prioritizedRole == 'SKAttackGuard') {
					if (spawn.canCreateCreep(SKGuardAttackerConfig) == OK) {
						spawn.createCreep(SKGuardAttackerConfig, undefined, {
							priority: prioritizedRole,
							destination: roomTarget,
							homeRoom: thisRoom.name,
							fromSpawn: spawn.id,
							targetFlag: flagName
						});
						Memory.creepInQue.push(thisRoom.name, prioritizedRole, '', spawn.name);
					}
				} else if (prioritizedRole == 'SKHealGuard') {
					if (spawn.canCreateCreep(SKGuardHealerConfig) == OK) {
						spawn.createCreep(SKGuardHealerConfig, undefined, {
							priority: prioritizedRole,
							destination: roomTarget,
							homeRoom: thisRoom.name,
							fromSpawn: spawn.id,
							targetFlag: flagName,
							parentAttacker: healTarget
						});
						Memory.creepInQue.push(thisRoom.name, prioritizedRole, '', spawn.name);
					}
				}
			}

		}
	}
}

module.exports = spawn_BuildFarCreeps;