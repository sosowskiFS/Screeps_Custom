var creep_miner = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'minerNearDeath') {
            creep.memory.priority = 'minerNearDeath';
            creep.memory.jobSpecific = creep.memory.jobSpecific + 'NearDeath';
        }

        //Creep will immediately harvest and store mined materials
        var mineTarget = Game.getObjectById(creep.memory.mineSource);
        if (mineTarget) {
            if (mineTarget.energy > 0) {
                if (creep.harvest(mineTarget) == ERR_NOT_IN_RANGE) {
                    creep.travelTo(mineTarget);
                }
            }

            if (creep.carry.energy >= 40) {
                var storageTarget = Game.getObjectById(creep.memory.linkSource);
                if (creep.memory.jobSpecific == 'upgradeMiner') {
                    var storageTarget2 = undefined;
                    if (creep.memory.linkSource2) {
                        storageTarget2 = Game.getObjectById(creep.memory.linkSource2);
                    }
                    if (storageTarget2 && storageTarget.energy == storageTarget.energyCapacity) {
                        if (creep.transfer(storageTarget2, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(storageTarget2);
                        }
                    } else {
                        if (creep.transfer(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(storageTarget);
                        }
                    }
                } else {
                    if (creep.transfer(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(storageTarget);
                    }
                }
            }

        }
    }
};

module.exports = creep_miner;