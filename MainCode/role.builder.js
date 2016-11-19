var roleBuilder = {

    /** @param {Creep} creep **/
    run: function(creep) {

        if ((creep.memory.building && creep.carry.energy == 0) || (creep.memory.storing && creep.carry.energy == 0) || (creep.memory.upgrading && creep.carry.energy == 0)) {
            creep.memory.building = false;
            creep.memory.storing = false;
            creep.memory.upgrading = false;
            creep.memory.structureTarget = undefined;
            creep.say('harvesting');
        }
        if (!creep.memory.building && !creep.memory.storing && !creep.memory.upgrading && creep.carry.energy == creep.carryCapacity) {
            creep.memory.building = true;
            creep.memory.structureTarget = undefined;
            creep.say('building');
        }

        if (creep.memory.building) {
            var savedTarget = Game.getObjectById(creep.memory.structureTarget)
                //site ID changes when construction is complete, simply check if valid.
            if (savedTarget) {
                if (creep.build(savedTarget) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(savedTarget);
                }
            } else {
                var targets = creep.room.find(FIND_CONSTRUCTION_SITES);
                if (targets.length) {
                    creep.memory.structureTarget = targets[0].id;
                    if (creep.build(targets[0]) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(targets[0]);
                    }
                } else {
                    //Store in container
                    creep.memory.building = false;
                    creep.memory.storing = true;
                    creep.say('storing');
                }
            }
        } else if (creep.memory.storing) {
            var savedTarget = Game.getObjectById(creep.memory.structureTarget)
                //If target is destroyed, this will prevent creep from locking up
            if (savedTarget) {
                if (savedTarget.energy < savedTarget.energyCapacity) {
                    if (creep.transfer(savedTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(savedTarget);
                    }
                } else {
                    //Target is invalid, clear from memory.
                    creep.memory.structureTarget = undefined;
                }
            } else {
                var targets = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_EXTENSION ||
                            structure.structureType == STRUCTURE_SPAWN ||
                            structure.structureType == STRUCTURE_CONTAINER ||
                            structure.structureType == STRUCTURE_TOWER) && structure.energy < structure.energyCapacity;
                    }
                });
                if (targets.length > 0) {
                    var targetForLoop = 0;
                    if (targets[0].structureType == STRUCTURE_SPAWN && targets.length > 1) {
                        //Prioritize other structures, the spawn regenerates.
                        creep.memory.structureTarget = targets[1].id;
                        targetForLoop = 1;
                    } else {
                        creep.memory.structureTarget = targets[0].id;
                    }

                    if (creep.transfer(targets[targetForLoop], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(targets[targetForLoop]);
                    }
                } else {
                    //Nowhere to store. Upgrade.
                    creep.memory.storing = false;
                    creep.memory.upgrading = true;
                    creep.say('upgrading');
                }
            }

        } else if (creep.memory.upgrading) {
            if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller);
            }
        } else {
            //Harvest
            var savedTarget = Game.getObjectById(creep.memory.structureTarget)
            if (savedTarget) {
                if (savedTarget.structureType == STRUCTURE_CONTAINER || savedTarget.structureType == STRUCTURE_STORAGE) {
                    if (savedTarget.energy > 0) {
                        if (creep.withdraw(savedTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(savedTarget);
                        }
                    }
                } else {
                    if (creep.harvest(savedTarget) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(savedTarget);
                    }
                }
            } else {
                var targets = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_CONTAINER ||
                            structure.structureType == STRUCTURE_STORAGE) && structure.energy > 0;
                    }
                });
                if (targets.length > 0) {
                    //Get from container
                    creep.memory.structureTarget = targets[0];
                    if (creep.withdraw(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(targets[0]);
                    }
                } else {
                    //Mine it yourself
                    var sources = creep.room.find(FIND_SOURCES);
                    creep.memory.structureTarget = sources[0];
                    if (creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(sources[0]);
                    }
                }
            }
        }
    }
};

module.exports = roleBuilder;