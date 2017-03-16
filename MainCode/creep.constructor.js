var creep_constructor = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.memory.building && creep.carry.energy == 0) {
            delete creep.memory.building;
        } else if (_.sum(creep.carry) == creep.carryCapacity && !creep.memory.building) {
            creep.memory.building = true;
        }

        if (!creep.memory.building) {
            if (creep.room.name != creep.memory.destination) {
                creep.moveTo(new RoomPosition(25, 25, creep.memory.destination));
            } else {
                sources = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);

                if (sources) {
                    if (creep.harvest(sources) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(sources);
                    }
                }
            }
        } else {
            if ((creep.carry.energy <= 20 && creep.hits < 2500) || (creep.carry.energy <= 40)) {
                //Upgrade the controller
                if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller);
                }
            } else if (creep.build(Game.getObjectById(creep.memory.siteID)) == ERR_NOT_IN_RANGE) {
                creep.moveTo(Game.getObjectById(creep.memory.siteID));
            } else if (creep.build(Game.getObjectById(creep.memory.siteID)) == ERR_INVALID_TARGET) {
                if (Game.flags["BuildThis"]) {
                    Game.flags["BuildThis"].remove();
                }
                creep.suicide();
            }
        }
    }
};

module.exports = creep_constructor;