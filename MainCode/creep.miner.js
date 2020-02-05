var creep_miner = {

    /** @param {Creep} creep **/
    run: function(creep) {
        //TEMP - For setting current creep memory after uploading change.
        /*if (!creep.memory.minePower) {
            let totalWork = 0
            eCreep.body.forEach(function(thisPart) {
                if (thisPart.type = WORK) {
                    totalWork++;
                }
            });
            creep.memory.minePower = totalWork * HARVEST_POWER;
        }*/

        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'minerNearDeath') {
            creep.memory.priority = 'minerNearDeath';
            creep.memory.jobSpecific = creep.memory.jobSpecific + 'NearDeath';
        }

        if (Game.flags[creep.room.name + creep.memory.jobSpecific] && !creep.memory.atSpot) {
            creep.memory.ignoreTravel = true;
            if (creep.pos.x != Game.flags[creep.room.name + creep.memory.jobSpecific].pos.x || creep.pos.y != Game.flags[creep.room.name + creep.memory.jobSpecific].pos.y) {
                creep.travelTo(Game.flags[creep.room.name + creep.memory.jobSpecific], {
                    maxRooms: 1
                });
            } else {
                creep.memory.atSpot = true;
            }
        }
        //Creep will immediately harvest and store mined materials
        let mineTarget = Game.getObjectById(creep.memory.mineSource);
        if (mineTarget) {
            if (creep.harvest(mineTarget) == ERR_NOT_IN_RANGE && !creep.memory.ignoreTravel) {
                creep.travelTo(mineTarget, {
                    maxRooms: 1
                });
            }

            if (!creep.memory.travelDistance && creep.memory._trav && creep.memory._trav.path) {
                creep.memory.travelDistance = creep.memory._trav.path.length;
                creep.memory.deathWarn = (creep.memory.travelDistance + _.size(creep.body) * 3) + 15;
            }

            if (creep.store.getFreeCapacity(RESOURCE_ENERGY) <= creep.memory.minePower) {
                let storageTarget = Game.getObjectById(creep.memory.linkSource);
                if (creep.memory.jobSpecific == 'upgradeMiner') {
                    let storageTarget2 = undefined;
                    if (creep.memory.linkSource2) {
                        storageTarget2 = Game.getObjectById(creep.memory.linkSource2);
                    }
                    if (storageTarget2 && storageTarget.energy == storageTarget.energyCapacity) {
                        if (creep.transfer(storageTarget2, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE && !creep.memory.ignoreTravel) {
                            creep.travelTo(storageTarget2);
                        }
                    } else {
                        if (creep.transfer(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE && !creep.memory.ignoreTravel) {
                            creep.travelTo(storageTarget);
                        }
                    }
                } else {
                    if (creep.transfer(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE && !creep.memory.ignoreTravel) {
                        creep.travelTo(storageTarget);
                    }
                }
            }

        }
    }
};

module.exports = creep_miner;