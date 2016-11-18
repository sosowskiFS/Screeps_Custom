var roleHarvester = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if(creep.carry.energy < creep.carryCapacity) {
            var sources = creep.room.find(FIND_SOURCES);
            if(creep.memory.targetSource == 'NO_TARGET'){
                //Set a default source if none is set
                creep.memory.targetSource = sources[0].id;
                creep.memory.targetSourcePos = 0;
            }

            if(creep.harvest(Game.getObjectById(creep.memory.targetSource)) == ERR_NOT_IN_RANGE) {
                creep.moveTo(Game.getObjectById(creep.memory.targetSource));
            } 
            else if(creep.harvest(Game.getObjectById(creep.memory.targetSource)) == ERR_NO_PATH) {
                //Change source
                creep.memory.targetSourcePos = creep.memory.targetSourcePos + 1;
                if (creep.memory.targetSourcePos > (sources.length - 1)){
                    creep.memory.targetSourcePos = 0;
                }
                creep.memory.targetSource = sources[creep.memory.targetSourcePos].id;
            }
        }
        else {
            creep.memory.targetSource = 'NO_TARGET';
            creep.memory.targetSourcePos = 0;
            var targets = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_EXTENSION ||
                                structure.structureType == STRUCTURE_SPAWN ||
                                structure.structureType == STRUCTURE_CONTAINER ||
                                structure.structureType == STRUCTURE_TOWER) && structure.energy < structure.energyCapacity;
                    }
            });
            if(targets.length > 0) {
                if(creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(targets[0]);
                }
            }
        }
    }
};

module.exports = roleHarvester;