var creep_supplier = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'supplierNearDeath') {
            creep.memory.priority = 'supplierNearDeath';
        }

        if (!creep.memory.atSpot && Game.flags[creep.room.name + "Supply"] && (creep.pos.x != Game.flags[creep.room.name + "Supply"].pos.x || creep.pos.y != Game.flags[creep.room.name + "Supply"].pos.y)) {
            creep.travelTo(Game.flags[creep.room.name + "Supply"]);

            if (!creep.memory.travelDistance && creep.memory._trav && creep.memory._trav.path) {
                creep.memory.travelDistance = creep.memory._trav.path.length;
                creep.memory.deathWarn = (creep.memory.travelDistance + _.size(creep.body) * 3) + 15;
            }
        } else if (_.sum(creep.carry) == 0) {
            creep.memory.atSpot = true;
            //Get from storage
            var storageTarget = creep.room.storage;
            if (storageTarget) {
                if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.travelTo(storageTarget);
                }
            }
        } else if (Memory.towerNeedEnergy[creep.room.name] && Memory.towerNeedEnergy[creep.room.name].length) {
            var target = Game.getObjectById(Memory.towerNeedEnergy[creep.room.name][0]);
            if (target) {
                if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.travelTo(target);
                }
            } else {
                //Destroyed, remove from list
                Memory.towerNeedEnergy[creep.room.name].splice(0, 1);
            }
        }
    }
};

module.exports = creep_supplier;