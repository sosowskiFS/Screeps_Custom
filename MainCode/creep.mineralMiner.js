const speech = require('creep.speech');
// Harvest state and replacement timing remain compatible with existing creeps.
module.exports = {
    run: function(creep) {
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'mineralMinerNearDeath') {
            creep.memory.priority = 'mineralMinerNearDeath';
        }
        const mineral = Game.getObjectById(creep.memory.mineralID);
        if (!mineral) {
            // Lost vision or bad ID: head home instead of throwing every tick.
            if (creep.memory.homeRoom && creep.room.name != creep.memory.homeRoom) {
                creep.travelTo(new RoomPosition(25, 25, creep.memory.homeRoom));
            }
            return;
        }
        if (mineral.mineralAmount == 0) {
            // Depleted for the regen period (50k ticks); this creep cannot outlive it.
            creep.suicide();
            return;
        }
        // Extractor cooldown is 5 ticks; skip all work until the next harvest is possible.
        if (Game.time < creep.memory.nextMine) return;

        const container = creep.memory.storageUnit && Game.getObjectById(creep.memory.storageUnit);
        if (creep.memory.storageUnit && !container) {
            creep.memory.storageUnit = undefined;
            creep.memory.onPoint = false;
        }
        if (container && container.store.getFreeCapacity() < 40) {
            speech.say(creep, "✖️", false);
            return;
        }
        // Stand on the container so harvested minerals drop straight into it.
        if (container && !creep.memory.onPoint) {
            if (creep.pos.isEqualTo(container.pos)) {
                creep.memory.onPoint = true;
            } else {
                creep.travelTo(container);
                return;
            }
        }
        const result = creep.harvest(mineral);
        if (result == ERR_NOT_IN_RANGE) {
            creep.travelTo(mineral);
            if (!creep.memory.travelDistance && creep.memory._trav && creep.memory._trav.path) {
                creep.memory.travelDistance = creep.memory._trav.path.length;
                creep.memory.deathWarn = (creep.memory.travelDistance * 2) + _.size(creep.body) * 3 + 15;
            }
        } else if (result == OK) {
            creep.memory.nextMine = Game.time + EXTRACTOR_COOLDOWN + 1;
            if (!container) {
                const containers = mineral.pos.findInRange(FIND_STRUCTURES, 1, {
                    filter: { structureType: STRUCTURE_CONTAINER }
                });
                if (containers.length) {
                    creep.memory.storageUnit = containers[0].id;
                    creep.memory.onPoint = creep.pos.isEqualTo(containers[0].pos);
                } else if (!mineral.pos.findInRange(FIND_CONSTRUCTION_SITES, 1).length) {
                    creep.room.createConstructionSite(creep.pos.x, creep.pos.y, STRUCTURE_CONTAINER);
                }
            }
        } else if (result == ERR_NOT_FOUND) {
            // No extractor: back off cheaply instead of retrying every tick.
            creep.memory.nextMine = Game.time + 50;
        } else if (result == ERR_NO_BODYPART) {
            creep.suicide();
        }
    }
};
