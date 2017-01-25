var spawn_BuildFarCreeps = {
	run: function(spawn, thisRoom) {
		if (!spawn.spawning) {
			if (Memory.creepInQue.indexOf(spawn.name) >= 0) {
				//Clear creep from que array
				var queSpawnIndex = Memory.creepInQue.indexOf(spawn.name);
				Memory.creepInQue.splice(queSpawnIndex - 3, 4);
			}

			var farMules = [];
			var farClaimers = [];
			var farMiners = [];
			if (Game.flags[thisRoom.name + "FarMining"]) {
				farMules = _.filter(Game.creeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining");
				farClaimers = _.filter(Game.creeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining");
				farMiners = _.filter(Game.creeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining");
			}

			var farGuards = [];
			if (Game.flags[thisRoom.name + "FarGuard"]) {
				farGuards = _.filter(Game.creeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarGuard");
			}

			var farMules2 = [];
			var farClaimers2 = [];
			var farMiners2 = [];
			if (Game.flags[thisRoom.name + "FarMining2"]) {
				farMules2 = _.filter(Game.creeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining2");
				farClaimers2 = _.filter(Game.creeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining2");
				farMiners2 = _.filter(Game.creeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining2");
			}

			var farGuards2 = [];
			if (Game.flags[thisRoom.name + "FarGuard2"]) {
				farGuards2 = _.filter(Game.creeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarGuard2");
			}

			var farMules3 = [];
			var farClaimers3 = [];
			var farMiners3 = [];
			if (Game.flags[thisRoom.name + "FarMining3"]) {
				farMules3 = _.filter(Game.creeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining3");
				farClaimers3 = _.filter(Game.creeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining3");
				farMiners3 = _.filter(Game.creeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining3");
			}

			var farGuards3 = [];
			if (Game.flags[thisRoom.name + "FarGuard3"]) {
				farGuards3 = _.filter(Game.creeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarGuard3");
			}

			//950 Points
			var farMinerConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, CARRY];
			//2000 Points
			var farMuleConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];
			if (thisRoom.energyCapacityAvailable >= 2500) {
				//2500 Points
				farMuleConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];
			}
			//1950 Points
			var farClaimerConfig = [MOVE, MOVE, MOVE, CLAIM, CLAIM, CLAIM];
			//1300 Points
			var farGuardConfig = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK];

			var prioritizedRole = '';
			var roomTarget = '';
			var flagName = '';
			var storageID = '';
			var strStorage = Memory.storageList[thisRoom.name];

			if (Game.flags[thisRoom.name + "FarMining"]) {
				if (farMiners.length < 1) {
					prioritizedRole = 'farMiner';
					roomTarget = Game.flags[thisRoom.name + "FarMining"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining"].name;
				} else if (farMules.length < 1) {
					prioritizedRole = 'farMule';
					roomTarget = Game.flags[thisRoom.name + "FarMining"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining"].name;
					storageID = strStorage[0];
				} else if (farClaimers.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining"].pos.roomName]) {
					prioritizedRole = 'farClaimer';
					roomTarget = Game.flags[thisRoom.name + "FarMining"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining"].name;
				} else if (farGuards.length < 1 && Game.flags[thisRoom.name + "FarGuard"]) {
					prioritizedRole = 'farGuard';
					roomTarget = Game.flags[thisRoom.name + "FarGuard"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarGuard"].name;
				}
			}

			if (Game.flags[thisRoom.name + "FarMining2"] && prioritizedRole == '') {
				if (farMiners2.length < 1) {
					prioritizedRole = 'farMiner';
					roomTarget = Game.flags[thisRoom.name + "FarMining2"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining2"].name;
				} else if (farMules2.length < 1) {
					prioritizedRole = 'farMule';
					roomTarget = Game.flags[thisRoom.name + "FarMining2"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining2"].name;
					storageID = strStorage[0];
				} else if (farClaimers2.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining2"].pos.roomName]) {
					prioritizedRole = 'farClaimer';
					roomTarget = Game.flags[thisRoom.name + "FarMining2"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining2"].name;
				} else if (farGuards2.length < 1 && Game.flags[thisRoom.name + "FarGuard2"]) {
					prioritizedRole = 'farGuard';
					roomTarget = Game.flags[thisRoom.name + "FarGuard2"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarGuard2"].name;
				}
			}

			if (Game.flags[thisRoom.name + "FarMining3"] && prioritizedRole == '') {
				if (farMiners3.length < 1) {
					prioritizedRole = 'farMiner';
					roomTarget = Game.flags[thisRoom.name + "FarMining3"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining3"].name;
				} else if (farMules3.length < 1) {
					prioritizedRole = 'farMule';
					roomTarget = Game.flags[thisRoom.name + "FarMining3"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining3"].name;
					storageID = strStorage[0];
				} else if (farClaimers3.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining3"].pos.roomName]) {
					prioritizedRole = 'farClaimer';
					roomTarget = Game.flags[thisRoom.name + "FarMining3"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarMining3"].name;
				} else if (farGuards3.length < 1 && Game.flags[thisRoom.name + "FarGuard3"]) {
					prioritizedRole = 'farGuard';
					roomTarget = Game.flags[thisRoom.name + "FarGuard3"].pos.roomName;
					flagName = Game.flags[thisRoom.name + "FarGuard3"].name;
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
						Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
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
						Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
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
						Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
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
						Memory.creepInQue.push(thisRoom.name, prioritizedRole, jobSpecificPri, spawn.name);
					}
				}
			}

		}
	}
}

module.exports = spawn_BuildFarCreeps;