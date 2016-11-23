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
        if (!creep.memory.building && !creep.memory.storing && !creep.memory.upgrading && _.sum(creep.carry) == creep.carryCapacity) {
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
                var targets = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
                if (targets) {
                    creep.memory.structureTarget = targets.id;
                    if (creep.build(targets) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(targets);
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
                if (savedTarget.structureType != STRUCTURE_CONTAINER && savedTarget.structureType != STRUCTURE_STORAGE) {
                    if (savedTarget.energy < savedTarget.energyCapacity) {
                        if (creep.transfer(savedTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(savedTarget);
                        }
                    } else {
                        //Target is invalid, clear from memory.
                        creep.memory.structureTarget = undefined;
                    }
                } else {
                    if (savedTarget.store[RESOURCE_ENERGY] < savedTarget.storeCapacity) {
                        if (creep.transfer(savedTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(savedTarget);
                        }
                    } else {
                        //Target is invalid, clear from memory.
                        creep.memory.structureTarget = undefined;
                    }
                }

            } else {
                var targets = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_EXTENSION ||
                            structure.structureType == STRUCTURE_SPAWN ||
                            structure.structureType == STRUCTURE_TOWER) && structure.energy < structure.energyCapacity;
                    }
                });
                if (targets) {
                    creep.memory.structureTarget = targets.id;

                    if (creep.transfer(targets, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(targets);
                    }
                } else {
                    //Containers call a different function to check contents
                    //(WHYYYYY)
                    var containers = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: (structure) => {
                            return (structure.structureType == STRUCTURE_CONTAINER ||
                                structure.structureType == STRUCTURE_STORAGE) && structure.store[RESOURCE_ENERGY] < structure.storeCapacity;
                        }
                    });
                    if (containers && creep.memory.priority == 'harvester') {
                        creep.memory.structureTarget = containers.id;

                        if (creep.transfer(containers, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(containers);
                        }
                    } else if (creep.memory.priority == 'harvester') {
                        //Try to build first      
                        creep.memory.storing = false;
                        creep.memory.building = true;
                        creep.memory.structureTarget = undefined;
                        creep.say('building');
                    } else {
                        creep.memory.storing = false;
                        creep.memory.upgrading = true;
                        creep.memory.structureTarget = undefined;
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
                    if (savedTarget.store[RESOURCE_ENERGY] > 0) {
                        if (creep.withdraw(savedTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(savedTarget);
                        }
                    } else {
                        creep.memory.structureTarget = undefined;
                    }
                } else {
                    if (creep.harvest(savedTarget) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(savedTarget);
                    } else if (creep.harvest(savedTarget) == ERR_INVALID_TARGET) {
                        if (creep.pickup(savedTarget) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(savedTarget);
                        }
                    } else {
                        creep.memory.structureTarget = undefined;
                    }
                }
            } else {
                var targets = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_CONTAINER ||
                            structure.structureType == STRUCTURE_STORAGE) && structure.store[RESOURCE_ENERGY] > 0;
                    }
                });
                if (targets && creep.memory.priority != 'harvester') {
                    //Get from container
                    creep.memory.structureTarget = targets.id;
                    if (creep.withdraw(targets, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(targets);
                    }
                } else {
                    //Mine it yourself
                    var sources = creep.pos.findClosestByRange(FIND_DROPPED_ENERGY);
                    if (sources) {
                        //If it ain't worth pickin' up, fuck it.
                        if (sources.amount < 50) {
                            sources = undefined;
                        }
                    }
                    if (!sources) {
                        sources = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
                    }
                    if (!sources) {
                        sources = creep.pos.findClosestByRange(FIND_SOURCES);
                    }
                    creep.memory.structureTarget = sources.id;
                    if (creep.harvest(sources) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(sources);
                    } else if (creep.harvest(sources) == ERR_INVALID_TARGET) {
                        if (creep.pickup(sources) == ERR_NOT_IN_RANGE) {
                            creep.moveTo(sources);
                        }
                    }
                }
            }
        }
    }
};

module.exports = creep_work;