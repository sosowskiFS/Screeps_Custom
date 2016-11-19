var creep_work = {

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
            switch (creep.memory.priority) {
                case 'builder':
                    creep.memory.building = true;
                    creep.memory.structureTarget = undefined;
                    creep.say('building');
                    break;
                case 'harvester':
                    creep.memory.storing = true;
                    creep.memory.structureTarget = undefined;
                    creep.say('storing');
                    break;
                case 'upgrader':
                    creep.memory.upgrading = true;
                    creep.memory.structureTarget = undefined;
                    creep.say('upgrading');
                    break;
                default:
                    //fucking what
                    creep.memory.building = true;
                    creep.memory.structureTarget = undefined;
                    creep.say('building');
                    break;
            }

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
                    if (creep.memory.priority == 'harvester') {
                        //Already tried to store, upgrade.
                        creep.memory.building = false;
                        creep.memory.upgrading = true;
                        creep.say('upgrading');
                    } else {
                        creep.memory.building = false;
                        creep.memory.storing = true;
                        creep.say('storing');
                    }
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
                    creep.memory.structureTarget = targets[0].id;
                    
                    if (creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(targets[0]);
                    }
                } else {
                    //Nowhere to store. Change action.
                    if (creep.memory.priority == 'harvester') {
                        //Try to build first
                        creep.memory.storing = false;
                        creep.memory.building = true;
                        creep.say('building');
                    } else {
                        creep.memory.storing = false;
                        creep.memory.upgrading = true;
                        creep.say('upgrading');
                    }
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
                    var sources = creep.pos.findClosestByRange(FIND_DROPPED_ENERGY);
                    if (!sources) {
                        creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
                    }
                    if (!sources) {
                        creep.pos.findClosestByRange(FIND_SOURCES);
                    }
                    creep.memory.structureTarget = sources[0];
                    if (creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(sources[0]);
                    }
                }
            }
        }
    }
};

module.exports = creep_work;