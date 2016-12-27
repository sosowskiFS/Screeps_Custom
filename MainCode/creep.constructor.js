var creep_constructor = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.memory.building && creep.carry.energy == 0) {
            delete creep.memory.building;
        } else if (_.sum(creep.carry) == creep.carryCapacity && !creep.memory.building) {
            creep.memory.building = true;
        }

        if (!creep.memory.building) {
            if (creep.memory.destinations.length > 0) {
                if (creep.room.name != creep.memory.destinations[0]) {
                    creep.moveTo(new RoomPosition(34, 47, creep.memory.destinations[0]));
                } else {
                    creep.memory.destinations.splice(0, 1);
                }
            } else {
                if (creep.harvest(Game.getObjectById('57ef9db186f108ae6e60e223')) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(Game.getObjectById('57ef9db186f108ae6e60e223'));
                }
            }
        } else {
            if (creep.carry.energy <= 20) {
                //Upgrade the controller
                if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller);
                }
            } else if (creep.build(Game.getObjectById(creep.memory.siteID)) == ERR_NOT_IN_RANGE) {
                creep.moveTo(Game.getObjectById(creep.memory.siteID));
            }
        }
    }
};

module.exports = creep_constructor;