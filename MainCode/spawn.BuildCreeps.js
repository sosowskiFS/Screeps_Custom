var spawn_BuildCreeps = {
    run: function(spawn, bestWorker, thisRoom, RoomCreeps, energyIndex) {

        let harvesters = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'harvester');
        let builders = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'builder');
        let upgraders = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'upgrader');
        let repairers = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'repair');
        let suppliers = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'supplier');
        let distributors = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'distributor');

        let defenders = _.filter(RoomCreeps, (creep) => creep.memory.priority == 'defender');

        let harvesterMax = 3;
        let builderMax = 2;
        let upgraderMax = 2;
        let repairMax = 1;
        let supplierMax = 0;
        let distributorMax = 0;
        //How many creeps can mine at once
        let mineSpots = [4, 5];
        //Add sources from N to S
        let strSources = Memory.sourceList[thisRoom.name];
        let assignedSlot1 = _.filter(RoomCreeps, (creep) => creep.memory.sourceLocation == strSources[0]);

        let bareMinConfig = [MOVE, MOVE, WORK, CARRY, CARRY];

        if (strSources.length == 1) {
            harvesterMax = 1;
            builderMax = 1;
            upgraderMax = 1;
        }

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

        let defenderEnergyLim = 780;
        if (thisRoom.controller.level == 4) {
            defenderEnergyLim = 1170;
        }

        if (RoomCreeps.length == 0 && spawn.canCreateCreep(bareMinConfig) == OK) {
            //In case of complete destruction, make a minimum viable worker
            if (strSources.length > 1) {
                let configCost = calculateConfigCost(bareMinConfig);
                if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                    Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                    spawn.spawnCreep(bareMinConfig, 'harvester_' + spawn.name + '_' + Game.time, {
                        memory: {
                            priority: 'harvester',
                            sourceLocation: strSources[1],
                            homeRoom: thisRoom.name
                        }
                    });
                }
            } else {
                let configCost = calculateConfigCost(bareMinConfig);
                if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                    Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                    spawn.createCreep(bareMinConfig, 'harvester_' + spawn.name + '_' + Game.time, {
                        memory: {
                            priority: 'harvester',
                            sourceLocation: strSources[0],
                            homeRoom: thisRoom.name
                        }
                    });
                }
            }

            Memory.isSpawning = true;
        } else if (Memory.roomsUnderAttack.indexOf(thisRoom.name) != -1 && Memory.roomsPrepSalvager.indexOf(thisRoom.name) == -1 && thisRoom.energyAvailable >= defenderEnergyLim && defenders.length < 2 && harvesters.length >= harvesterMax) {
            //Try to produce millitary units

            var ToughCount = 0;
            var MoveCount = 0;
            var AttackCount = 0;
            var RangedCount = 0;
            var HealCount = 0;
            var totalParts = 0;

            var remainingEnergy = Memory.CurrentRoomEnergy[energyIndex];
            while ((remainingEnergy / 410) >= 1) {
                //switch (ChosenPriority) {
                //case 'melee':
                //ToughCount = ToughCount + 1;
                MoveCount = MoveCount + 2;
                if (RangedCount == 0) {
                    RangedCount = 1;
                    AttackCount = AttackCount + 2;
                    remainingEnergy = remainingEnergy - 410;
                } else {
                    AttackCount = AttackCount + 3;
                    remainingEnergy = remainingEnergy - 340;
                }
                //RangedCount = RangedCount + 1;
                totalParts = totalParts + 5;
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
            while (AttackCount > 0) {
                ChosenCreepSet.push(ATTACK);
                AttackCount--;
            }
            while (RangedCount > 0) {
                ChosenCreepSet.push(RANGED_ATTACK);
                RangedCount--;
            }
            while (MoveCount > 0) {
                ChosenCreepSet.push(MOVE);
                MoveCount--;
            }

            if (ChosenCreepSet.length > 50) {
                while (ChosenCreepSet.length > 50) {
                    ChosenCreepSet.splice(0, 1)
                }
            }

            Memory.CurrentRoomEnergy[energyIndex] = remainingEnergy;

            spawn.spawnCreep(ChosenCreepSet, 'defender_' + spawn.name + '_' + Game.time, {
                memory: {
                    priority: 'defender',
                    fromSpawn: spawn.id,
                    homeRoom: thisRoom.name
                }
            });
            Memory.isSpawning = true;

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
                if (strSources.length > 1) {
                    creepSourceID = strSources[1];
                } else {
                    creepSourceID = strSources[0];
                }
            } else {
                //Assign spot 1
                creepSourceID = strSources[0];
            }
            let configCost = calculateConfigCost(bestWorker);
            if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                spawn.spawnCreep(bestWorker, prioritizedRole + '_' + spawn.name + '_' + Game.time, {
                    memory: {
                        priority: prioritizedRole,
                        fromSpawn: spawn.id,
                        sourceLocation: creepSourceID,
                        homeRoom: thisRoom.name
                    }
                });
            }
            Memory.isSpawning = true;
        }
    }
};

function calculateConfigCost(bodyConfig) {
    var totalCost = 0;
    for (let thisPart of bodyConfig) {
        totalCost = totalCost + BODYPART_COST[thisPart];
    }
    return totalCost;
}

module.exports = spawn_BuildCreeps;