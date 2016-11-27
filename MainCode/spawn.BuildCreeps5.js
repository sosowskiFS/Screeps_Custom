var spawn_BuildCreeps5 = {
	run: function(spawn, thisRoom) {
		for (var name in Memory.creeps) {
			if (!Game.creeps[name]) {
				delete Memory.creeps[name];
				console.log('Clearing non-existing creep memory:', name);
			}
		}

		var RoomCreeps = thisRoom.find(FIND_MY_CREEPS);

		var miners = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'miner'); //Only gathers, does not move after reaching source
		var mules = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'mule'); //Stores in spawn/towers, builds, upgrades
		var upgraders = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'upgrader'); //Kinda important, and stuff.
		//TODO : Count creeps by room, not globally.
		//var harvesters = _.filter(Game.creeps, (creep) => creep.memory.priority == 'harvester');
		//var builders = _.filter(Game.creeps, (creep) => creep.memory.priority == 'builder');
		//var upgraders = _.filter(Game.creeps, (creep) => creep.memory.priority == 'upgrader');

		var minerMax = 2;
		var muleMax = 1;
		var upgraderMax = 2;
		var strSources = [];
		var strLinks = [];
		var strStorage = [];

		switch (thisRoom.name) {
			case 'E3N61':
				//two sources
				minerMax = 2;
				strSources.push('57ef9db786f108ae6e60e2a5', '57ef9db786f108ae6e60e2a7');
				strLinks.push('583adab41b9ba6bd6923fc74', '583af8fa827c44087d11fca1');
				muleMax = 2;
				strStorage.push('58388a3dac3bed8a51188517');
				UpgraderMax = 2;
				break;
		}


		//900 Points
		var minerConfig = [CARRY, CARRY, CARRY, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE];
		//950 Points
		var muleConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, MOVE];
		//Upgrader to use minerConfig

		var bareMinConfig = [WORK, CARRY, MOVE];

		if (RoomCreeps.length == 0 && spawn.canCreateCreep(bareMinConfig) == OK) {
			//In case of complete destruction, make a minimum viable worker
			//Make sure 5+ work code has harvester backup path
			spawn.createCreep(bareMinConfig, undefined, {
				priority: 'harvester'
			});
		} else if (Memory.roomsUnderAttack.indexOf(thisRoom.name) != -1) {
			if (thisRoom.energyAvailable >= 500) {
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
				while ((remainingEnergy / 400) >= 1) {
					switch (ChosenPriority) {
						case 'melee':
							ToughCount = ToughCount + 2
							MoveCount = MoveCount + 3;
							AttackCount++;
							totalParts = totalParts + 6;
							remainingEnergy = remainingEnergy - 250;
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

		} else if ((miners.length < minerMax || mules.length < muleMax || upgraders.length < upgraderMax) && spawn.canCreateCreep(muleConfig) == OK) {
			var prioritizedRole = 'miner';
			var creepSource = '';
			var connectedLink = '';
			var storageID = '';
			if (miners.length < minerMax) {
				prioritizedRole = 'miner';
				switch (miners.length) {
					case 0:
						creepSource = strSources[0];
						connectedLink = strLinks[0];
						break;
					case 1:
						creepSource = strSources[1];
						connectedLink = strStorage[0];
						break;
				}
			} else if (upgraders.length < upgraderMax) {
				prioritizedRole = 'upgrader';
				storageID = strStorage[0];
				connectedLink = strLinks[1];
			} else if (mules.length < muleMax) {
				prioritizedRole = 'mule';
				storageID = strStorage[0];
				connectedLink = strLinks[1];
			}

			if (prioritizedRole == 'miner') {
				spawn.createCreep(minerConfig, undefined, {
					priority: prioritizedRole,
					mineSource: creepSource,
					linkSource: connectedLink
				});
			} else if (prioritizedRole == 'mule') {
				spawn.createCreep(muleConfig, undefined, {
					priority: prioritizedRole,
					linkSource: connectedLink,
					storageSource: storageID
				});
			} else {
				spawn.createCreep(minerConfig, undefined, {
					priority: prioritizedRole,
					linkSource: connectedLink,
					storageSource: storageID
				});
			}

		}
	}
};

module.exports = spawn_BuildCreeps5;