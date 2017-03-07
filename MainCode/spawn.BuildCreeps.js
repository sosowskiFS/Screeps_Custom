var spawn_BuildCreeps = {
	run: function(spawn, bestWorker, thisRoom, RoomCreeps) {
		if (!spawn.spawning) {
			if (Memory.creepInQue.indexOf(spawn.name) >= 0) {
				//Clear creep from que array
				var queSpawnIndex = Memory.creepInQue.indexOf(spawn.name);
				Memory.creepInQue.splice(queSpawnIndex - 3, 4);
			}


			//var RoomCreeps = thisRoom.find(FIND_MY_CREEPS);

			var harvesters = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'harvester');
			var builders = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'builder');
			var upgraders = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'upgrader');
			var repairers = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'repair');
			var suppliers = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'supplier');
			var distributors = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'distributor');

			var defenders = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'defender');

			var harvesterMax = 3;
			var builderMax = 2;
			var upgraderMax = 2;
			var repairMax = 1;
			var supplierMax = 0;
			var distributorMax = 0;
			//How many creeps can mine at once
			var mineSpots = [2, 5];
			//Add sources from N to S
			var strSources = Memory.sourceList[thisRoom.name];
			var assignedSlot1 = _.filter(RoomCreeps, (creep) => creep.memory.sourceLocation == strSources[0]);

			var bareMinConfig = [MOVE, MOVE, WORK, CARRY, CARRY];

			//For Level 4
			if (thisRoom.storage) {
				supplierMax++;
				if (thisRoom.storage.store[RESOURCE_ENERGY] >= 1000) {
					distributorMax++;
				}
				if (thisRoom.storage.store[RESOURCE_ENERGY] >= 10000) {
					upgraderMax++;
				}
				if (thisRoom.storage.store[RESOURCE_ENERGY] >= 20000) {
					upgraderMax++;
				}
			}

			if (RoomCreeps.length == 0 && spawn.canCreateCreep(bareMinConfig) == OK) {
				//In case of complete destruction, make a minimum viable worker
				spawn.createCreep(bareMinConfig, undefined, {
					priority: 'harvester',
					sourceLocation: strSources[1]
				});
			} else if (Memory.roomsUnderAttack.indexOf(thisRoom.name) != -1 && thisRoom.energyAvailable >= 850 && defenders.length < 2) {
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
				var HealCount = 0;
				var totalParts = 0;

				var remainingEnergy = thisRoom.energyAvailable;
				while ((remainingEnergy / 660) >= 1) {
					//switch (ChosenPriority) {
					//case 'melee':
					//ToughCount = ToughCount + 1;
					MoveCount = MoveCount + 4;
					AttackCount = AttackCount + 2;
					RangedCount = RangedCount + 2;
					totalParts = totalParts + 6;
					remainingEnergy = remainingEnergy - 660;
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

			} else if ((harvesters.length < harvesterMax || builders.length < builderMax || upgraders.length < upgraderMax || repairers.length < repairMax || suppliers.length < supplierMax || distributors.length < distributorMax)) {
				var prioritizedRole = 'harvester';
				if (distributors.length < distributorMax) {
					prioritizedRole = 'distributor';
					bestWorker = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];
				} else if (harvesters.length < harvesterMax) {
					prioritizedRole = 'harvester';
				} else if (suppliers.length < supplierMax) {
					prioritizedRole = 'supplier';
					bestWorker = [MOVE, CARRY, CARRY];
				} else if (upgraders.length < upgraderMax) {
					prioritizedRole = 'upgrader';
				} else if (builders.length < builderMax) {
					prioritizedRole = 'builder';
				} else if (repairers.length < repairMax) {
					prioritizedRole = 'repair';
				}

				var creepSourceID = '';
				if ((assignedSlot1.length) >= Math.ceil(mineSpots[0] * 1.2)) {
					//Assign spot 2
					creepSourceID = strSources[1];
				} else {
					//Assign spot 1
					creepSourceID = strSources[0];
				}
				spawn.createCreep(bestWorker, undefined, {
					priority: prioritizedRole,
					fromSpawn: spawn.id,
					sourceLocation: creepSourceID
				});
			}
		}
	}
};

module.exports = spawn_BuildCreeps;