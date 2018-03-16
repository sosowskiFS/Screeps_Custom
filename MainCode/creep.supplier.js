var creep_supplier = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'supplierNearDeath') {
            creep.memory.priority = 'supplierNearDeath';
        }

        if (Game.flags[creep.room.name + "Supply"] && (creep.pos.x != Game.flags[creep.room.name + "Supply"].pos.x || creep.pos.y != Game.flags[creep.room.name + "Supply"].pos.y)) {
            creep.travelTo(Game.flags[creep.room.name + "Supply"]);
        } else if (_.sum(creep.carry) == 0) {
            //Get from storage
            var storageTarget = creep.room.storage;
            if (storageTarget) {
                if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.travelTo(storageTarget);
                }
            }
        } else if (Memory.towerNeedEnergy[creep.room.name].length) {
            var target = Game.getObjectById(Memory.towerNeedEnergy[creep.room.name][0]);
            if (target) {
                if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.travelTo(target);
                }
            }
        }
    }
};

module.exports = creep_supplier;