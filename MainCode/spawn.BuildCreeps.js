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
			if (thisRoom.energyAvailable >= 400) {
				//Try to produce millitary units

				//TODO : Calculate best millitary unit, maybe slightly less than max cap.
				//Consider using only what's currently available?
				//Possible to get data on invaders parts?

				/*
			var targets = creep.room.find(FIND_HOSTILE_CREEPS, {
    			filter: function(object) {
        			return object.getActiveBodyparts(ATTACK) == 0;
    			}		
			}); */

				//Determine if possible to overpower invader by body part, if not build best.
				//Copy invader's part count?

				//Melee unit set: MOVE MOVE ATTACK TOUGH TOUGH - 200
				//Ranged unit set: RANGED_ATTACK MOVE - 200

				var MeleeSet = [TOUGH, TOUGH, MOVE, MOVE, ATTACK];
				var RangedSet = [MOVE, RANGED_ATTACK];

				var meleeUnits = _.filter(Game.creeps, (creep) => creep.memory.priority == 'melee');
				var rangedUnits = _.filter(Game.creeps, (creep) => creep.memory.priority == 'ranged');

				var ChosenCreepSet;
				var ChosenPriority = '';
				if (meleeUnits <= rangedUnits) {
					ChosenCreepSet = MeleeSet;
					ChosenPriority = 'melee';
				} else {
					ChosenCreepSet = RangedSet;
					ChosenPriority = 'ranged';
				}

				//Duplicate array contents into new one by using ARRAY.SLICE(0);
				//Then use ARRAY.CONCAT(newArray) to combine them

				var remainingEnergy = thisRoom.energyAvailable;
				while ((remainingEnergy / 200) >= 1) {
					var ArrayHolder = ChosenCreepSet.slice(0);
					ChosenCreepSet.concat(ArrayHolder);
					remainingEnergy = remainingEnergy - 200;
				}

				spawn.createCreep(ChosenCreepSet, undefined, {
					priority: ChosenPriority
				});
			}

		} else if ((harvesters.length < 2 || builders.length < 2 || upgraders.length < 2) && spawn.canCreateCreep(bestWorker) == OK) {
			var prioritizedRole = 'harvester';
			if (harvesters.length < 2) {
				prioritizedRole = 'harvester';
			} else if (upgraders.length < 2) {
				prioritizedRole = 'upgrader';
			} else if (builders.length < 2) {
				prioritizedRole = 'builder';
			}

			spawn.createCreep(bestWorker, undefined, {
				priority: prioritizedRole
			});
		}
	}
};

module.exports = spawn_BuildCreeps;