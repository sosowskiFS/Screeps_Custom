var creep_scraper = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (_.sum(creep.carry) < creep.carryCapacity) {
            //Go to link, find dropped energy
            if (creep.memory.targetResource) {
                var thisResource = Game.getObjectById(creep.memory.targetResource);
                if (thisResource) {
                    if (creep.pickup(thisResource) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(thisResource, {
                            maxRooms: 1
                        })
                    } else {
                        creep.memory.targetResource = undefined;
                    }
                } else {
                    creep.memory.targetResource = undefined;
                }
            } else {
                var thisLink = Game.getObjectById(creep.memory.linkID);
                if (thisLink && creep.pos.inRangeTo(thisLink, 3)) {
                    var droppedResources = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
                    if (droppedResources) {
                        creep.memory.targetResource = droppedResources.id;
                    }
                } else if (thisLink) {
                    creep.travelTo(thisLink, {
                        maxRooms: 1
                    })
                }
            }
        } else {
            //Deposit energy
            if (creep.room.storage) {
                if (Object.keys(creep.carry).length > 1) {
                    if (creep.transfer(creep.room.storage, Object.keys(creep.carry)[1]) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(creep.room.storage, {
                            maxRooms: 1
                        });
                    }
                } else {
                    if (creep.transfer(creep.room.storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(creep.room.storage. {
                        	maxRooms: 1
                        });
                    }
                }
            }
        }
    }
};

module.exports = creep_scraper;