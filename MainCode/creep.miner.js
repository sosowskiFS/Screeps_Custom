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

        // Near death its job reads 'storageMinerNearDeath': still the same tile (it used to find no
        // flag, stop short of its tile and stand in the way for the rest of its life).
        const job = String(creep.memory.jobSpecific || '').replace(/NearDeath$/, '');
        let minerFlag = Game.flags[creep.room.name + job];
        if (minerFlag && !creep.memory.atSpot) {
            creep.memory.ignoreTravel = true;
            if (creep.pos.x != minerFlag.pos.x || creep.pos.y != minerFlag.pos.y) {
                creep.travelTo(minerFlag, {
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
                let transferTarget = storageTarget;
                if (job == 'upgradeMiner') {
                    // Any link beside it, the one with most room (system.links sends each on to a
                    // receiver); its assigned link when none is beside it.
                    const best = adjacentLinks(creep).filter(l => l.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
                        .sort((a, b) => b.store.getFreeCapacity(RESOURCE_ENERGY) - a.store.getFreeCapacity(RESOURCE_ENERGY))[0];
                    if (best) transferTarget = best;
                }

                if (transferTarget && creep.transfer(transferTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE && !creep.memory.ignoreTravel) {
                    creep.travelTo(transferTarget);
                }
            }

        }
    }
};

// Links within 1 of the miner on its spot (ids cached ADJ_TTL ticks).
const ADJ_TTL = 500;
function adjacentLinks(creep) {
    if (!creep.memory.atSpot) return [];
    const m = creep.memory;
    if (!m.adj || Game.time - (m.adjAt || 0) >= ADJ_TTL) {
        m.adj = require('runtime.cache').find(creep.room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LINK } })
            .filter(l => creep.pos.isNearTo(l)).map(l => l.id);
        m.adjAt = Game.time;
    }
    return m.adj.map(id => Game.getObjectById(id)).filter(Boolean);
}
creep_miner.adjacentLinks = adjacentLinks;

module.exports = creep_miner;