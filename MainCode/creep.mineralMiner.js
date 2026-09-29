// Harvest state and replacement timing remain compatible with existing creeps.
module.exports = {
    run: function(creep) {
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'mineralMinerNearDeath') {
            creep.memory.priority = 'mineralMinerNearDeath';
        }
        const mineral = Game.getObjectById(creep.memory.mineralID);
        if (mineral.mineralAmount == 0 && creep.memory.onPoint) {
            creep.suicide();
        } else if (Game.time >= creep.memory.nextMine) {
            const container = creep.memory.storageUnit && Game.getObjectById(creep.memory.storageUnit);
            if (container && container.store.getFreeCapacity() < 40) {
                creep.say("\u2716\uFE0F", false);
                return;
            }
            const result = creep.harvest(mineral);
            if (result == ERR_NOT_IN_RANGE) {
                creep.travelTo(mineral);
                if (!creep.memory.travelDistance && creep.memory._trav && creep.memory._trav.path) {
                    creep.memory.travelDistance = creep.memory._trav.path.length;
                    creep.memory.deathWarn = (creep.memory.travelDistance * 2) + _.size(creep.body) * 3 + 15;
                }
            } else if (result == OK) {
                creep.memory.nextMine = Game.time + 6;
                if (!creep.memory.storageUnit) {
                    const containers = mineral.pos.findInRange(FIND_STRUCTURES, 1, {
                        filter: { structureType: STRUCTURE_CONTAINER }
                    });
                    if (containers.length) {
                        if (creep.pos != containers[0].pos) creep.travelTo(containers[0]);
                        else creep.memory.onPoint = true;
                        creep.memory.storageUnit = containers[0].id;
                    } else if (!mineral.pos.findInRange(FIND_CONSTRUCTION_SITES, 1).length) {
                        creep.room.createConstructionSite(creep.pos.x, creep.pos.y, STRUCTURE_CONTAINER);
                    }
                } else if (!creep.memory.onPoint) {
                    if (container && creep.pos != container.pos) creep.travelTo(container);
                    else if (container && creep.pos == container.pos) creep.memory.onPoint = true;
                    else {
                        creep.memory.storageUnit = undefined;
                        creep.memory.onPoint = false;
                    }
                }
            }
        }
    }
};
