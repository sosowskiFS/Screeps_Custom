var creep_powerCollect = {

    /** @param {Creep} creep **/
    run: function(creep) {
        // Cache frequently used values
        const homeRoom = creep.memory.homeRoom;
        const powerAttackFlagName = homeRoom + "PowerAttack";
        const powerPickupFlagName = homeRoom + "PowerPickup";
        const powerAttackFlag = Game.flags[powerAttackFlagName];
        const powerPickupFlag = Game.flags[powerPickupFlagName];
        
        if (!creep.memory.mode) {
            creep.memory.mode = 0;
        }
        
        if (creep.memory.mode == 0) {
            //Pick up
            if (creep.room.name != creep.memory.destination) {
                //Travel to room - removed redundant condition check
                if (powerAttackFlag) {
                    creep.travelTo(powerAttackFlag);
                } else {
                    creep.travelTo(new RoomPosition(25, 25, creep.memory.destination));
                }
            } else {
                //Main loop
                if (powerAttackFlag) {
                    //Bank still active, hold.
                    creep.travelTo(powerAttackFlag, {
                        range: 3
                    });
                } else {
                    //Pick up - remove flag if exists
                    if (powerPickupFlag) {
                        powerPickupFlag.remove();
                    }

                    if (creep.store.getFreeCapacity() > 0) {
                        // Try to find something to pick up (prioritize by value/efficiency)
                        let targetResource = this.findPickupTarget(creep);
                        
                        if (targetResource) {
                            let result = this.handlePickup(creep, targetResource);
                            if (result === 'full') {
                                creep.memory.mode = 1;
                                this.startReturnJourney(creep, homeRoom);
                            }
                        } else if (creep.store.getUsedCapacity() > 0) {
                            creep.memory.mode = 1;
                        } else {
                            //carrying nothing, nothing to pick up
                            creep.suicide();
                        }
                    } else {
                        creep.memory.mode = 1;
                    }
                }
            }
        } else {
            //Deposit
            if (creep.room.name != creep.memory.homeRoom) {
                //Travel to room
                const homeRoomObj = Game.rooms[homeRoom];
                if (homeRoomObj && homeRoomObj.storage) {
                    creep.travelTo(homeRoomObj.storage);
                } else {
                    creep.travelTo(new RoomPosition(25, 25, homeRoom));
                }
            } else if (creep.store.getUsedCapacity() > 0) {
                if (creep.room.storage) {
                    // Get resource types as array once
                    const resourceTypes = Object.keys(creep.store);
                    const transferResource = resourceTypes.length > 1 ? resourceTypes[1] : resourceTypes[0];
                    
                    if (creep.transfer(creep.room.storage, transferResource) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(creep.room.storage);
                    }
                }
            } else {
                //Done
                creep.suicide();
            }
        }
    },
    
    // Optimized method to find the best pickup target
    findPickupTarget: function(creep) {
        // Check for ruins first (highest priority - power bank ruins)
        let ruins = creep.pos.findClosestByRange(FIND_RUINS, {
            filter: (thisRuin) => thisRuin.store.getUsedCapacity() > 0
        });
        if (ruins) {
            return { type: 'ruin', target: ruins, resource: Object.keys(ruins.store)[0] };
        }
        
        // Check for dropped resources
        let droppedResources = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 30);
        if (droppedResources.length) {
            // Sort by amount descending to get largest first
            droppedResources.sort((a, b) => b.amount - a.amount);
            return { type: 'dropped', target: droppedResources[0] };
        }
        
        // Check tombstones last
        let tombstones = creep.pos.findClosestByRange(FIND_TOMBSTONES, {
            filter: (thisTombstone) => thisTombstone.store.getUsedCapacity() > 0
        });
        if (tombstones) {
            return { type: 'tombstone', target: tombstones, resource: Object.keys(tombstones.store)[0] };
        }
        
        return null;
    },
    
    // Optimized method to handle pickup operations
    handlePickup: function(creep, targetData) {
        let result;
        
        switch (targetData.type) {
            case 'ruin':
            case 'tombstone':
                result = creep.withdraw(targetData.target, targetData.resource);
                if (result == ERR_NOT_IN_RANGE) {
                    creep.travelTo(targetData.target, { maxRooms: 1 });
                }
                break;
                
            case 'dropped':
                result = creep.pickup(targetData.target);
                if (result == ERR_NOT_IN_RANGE) {
                    creep.travelTo(targetData.target);
                } else if (result == OK && targetData.target.amount >= creep.store.getFreeCapacity()) {
                    return 'full';
                }
                break;
        }
        
        return result == OK ? 'success' : 'pending';
    },
    
    // Method to prepare for return journey
    startReturnJourney: function(creep, homeRoom) {
        const homeRoomObj = Game.rooms[homeRoom];
        if (homeRoomObj && homeRoomObj.storage) {
            creep.travelTo(homeRoomObj.storage);
        } else {
            creep.travelTo(new RoomPosition(25, 25, homeRoom));
        }
    }
};

module.exports = creep_powerCollect;