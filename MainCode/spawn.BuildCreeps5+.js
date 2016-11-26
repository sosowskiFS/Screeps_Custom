var spawn_BuildCreeps = {
	run: function(spawn, bestWorker, thisRoom) {
		for (var name in Memory.creeps) {
			if (!Game.creeps[name]) {
				delete Memory.creeps[name];
				console.log('Clearing non-existing creep memory:', name);
			}
		}

		//TODO : Count creeps by room, not globally.
		var harvesters = _.filter(Game.creeps, (creep) => creep.memory.priority == 'harvester');
		var builders = _.filter(Game.creeps, (creep) => creep.memory.priority == 'builder');
		var upgraders = _.filter(Game.creeps, (creep) => creep.memory.priority == 'upgrader');

		var bareMinConfig = [WORK, CARRY, MOVE];

		if ((harvesters.length == 0 && builders.length == 0 && upgraders.length == 0) && spawn.canCreateCreep(bareMinConfig) == OK) {
			//In case of complete destruction, make a minimum viable worker
			spawn.createCreep(bareMinConfig, undefined, {
				priority: 'harvester'
			});
		} else if (Memory.roomsUnderAttack.indexOf(thisRoom.name) != -1) {
			if (thisRoom.energyAvailable >= 500) {
				//Try to produce millitary units

				//Melee unit set: TOUGH, TOUGH, MOVE, MOVE, MOVE, ATTACK - 250
				//Ranged unit set: MOVE, MOVE, RANGED_ATTACK - 250

				//Damaged modules do not work, put padding first.

				var meleeUnits = _.filter(Game.creeps, (creep) => creep.memory.priority == 'melee');
				var rangedUnits = _.filter(Game.creeps, (creep) => creep.memory.priority == 'ranged');

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
				while ((remainingEnergy / 250) >= 1) {
					switch (ChosenPriority) {
						case 'melee':
							ToughCount = ToughCount + 2
							MoveCount = MoveCount + 3;
							AttackCount++;
							totalParts = totalParts + 6;
							break;
						case 'ranged':
							MoveCount = MoveCount + 2;
							RangedCount++;
							totalParts = totalParts + 3;
							break;
					}
					remainingEnergy = remainingEnergy - 250;
					if (totalParts >= 50){
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

		} else if ((harvesters.length < 2 || builders.length < 1 || upgraders.length < 2) && spawn.canCreateCreep(bestWorker) == OK) {
			var prioritizedRole = 'harvester';
			if (harvesters.length < 2) {
				prioritizedRole = 'harvester';
			} else if (upgraders.length < 2) {
				prioritizedRole = 'upgrader';
			} else if (builders.length < 1) {
				prioritizedRole = 'builder';
			}

			spawn.createCreep(bestWorker, undefined, {
				priority: prioritizedRole
			});
		}
	}
};

module.exports = spawn_BuildCreeps;