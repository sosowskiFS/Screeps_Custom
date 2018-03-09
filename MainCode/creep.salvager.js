var creep_salvager = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'labWorkerNearDeath') {
            creep.memory.priority = 'labWorkerNearDeath';
        }

        var newTarget = false;
        var foundObject = findTarget(creep, 0);
        if (!foundObject) {
            //Idle
            if (!creep.pos.isNearTo(creep.room.controller)) {
                creep.travelTo(creep.room.controller);
            }
            return;
        } else if (foundObject) {
            if (creep.memory.targetType == 0) {
                if (Object.keys(foundObject.store).length > 1) {
                    if (creep.withdraw(foundObject, Object.keys(foundObject.store)[1]) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(foundObject);
                    }
                } else {
                    var withdrawResult = creep.withdraw(foundObject, Object.keys(foundObject.store)[0])
                    if (withdrawResult == ERR_NOT_IN_RANGE) {
                        creep.travelTo(foundObject);
                    } else if (withdrawResult == OK) {
                        creep.memory.lastTargetId = creep.memory.targetId;
                        creep.memory.targetId = undefined;
                        creep.memory.targetType = undefined;
                        foundObject = findTarget(creep, _.sum(foundObject.store));
                        newTarget = true;
                    }
                }
            } else if (creep.memory.targetType == 1) {
                var pickupResult = creep.pickup(foundObject);
                if (pickupResult == ERR_NOT_IN_RANGE) {
                    creep.travelTo(foundObject);
                } else if (pickupResult == OK) {
                    creep.memory.lastTargetId = creep.memory.targetId;
                    creep.memory.targetId = undefined;
                    creep.memory.targetType = undefined;
                    foundObject = findTarget(creep, foundObject.amount);
                    newTarget = true;
                }
            } else if (creep.memory.targetType == 2) {
                if (Object.keys(creep.carry).length > 1) {
                    if (creep.transfer(foundObject, Object.keys(creep.carry)[1]) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(foundObject);
                    }
                } else if (creep.transfer(foundObject, Object.keys(creep.carry)[0]) == ERR_NOT_IN_RANGE) {
                    var transferResult = creep.transfer(foundObject, Object.keys(creep.carry)[0]);
                    if (transferResult == ERR_NOT_IN_RANGE) {
                        creep.travelTo(foundObject);
                    } else if (transferResult == OK) {
                        creep.memory.targetId = undefined;
                        creep.memory.targetType = undefined;
                        foundObject = findTarget(creep, -_.sum(creep.carry));
                        newTarget = true;
                    }
                }
            }
        }
        //travel to new target...or don't if it doesn't exist
        if (newTarget) {
            if (!foundObject) {
                //Idle
                creep.travelTo(creep.room.controller);
                return;
            } else {
                creep.travelTo(foundObject);
            }
        }
    }
};

function findTarget(creep, amountWithdrawn) {
    var returnObject = undefined;
    if (creep.memory.targetId) {
        returnObject = Game.getObjectById(creep.memory.targetId);
        if (returnObject) {
            if (creep.memory.targetType == 0) {
                if (Object.keys(returnObject.store).length) {
                    return returnObject;
                } else {
                    creep.memory.targetId = undefined;
                    creep.memory.targetType = undefined;
                    returnObject = undefined;
                }
            } else {
                //Dropped resource wouldn't exist if it expired
                return returnObject;
            }
        }
    }

    if ((_.sum(creep.carry) + amountWithdrawn) < creep.carryCapacity) {
        if (creep.memory.lastTargetId) {
            returnObject = creep.pos.findClosestByRange(FIND_TOMBSTONES, {
                filter: (thisTombstone) => (_.sum(thisTombstone.store) > 0 && thisTombstone.id != creep.memory.lastTargetId)
            });
        } else {
            returnObject = creep.pos.findClosestByRange(FIND_TOMBSTONES, {
                filter: (thisTombstone) => (_.sum(thisTombstone.store) > 0)
            });
        }
        if (returnObject) {
            creep.memory.targetId = returnObject.id;
            creep.memory.targetType = 0;
            creep.memory.lastTargetId = undefined;
            return returnObject;
        } else {
            if (creep.memory.lastTargetId) {
                returnObject = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
                    filter: (thisResource) => (thisResource.id != creep.memory.lastTargetId)
                });
            } else {
                returnObject = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
            }
            if (returnObject) {
                creep.memory.targetId = returnObject.id;
                creep.memory.targetType = 1;
                creep.memory.lastTargetId = undefined;
                return returnObject;
            }
        }
    }

    creep.memory.lastTargetId = undefined;

    if ((!returnObject && (_.sum(creep.carry) + amountWithdrawn) > 0 || (_.sum(creep.carry) + amountWithdrawn) >= creep.carryCapacity) && creep.room.storage) {
        creep.memory.targetId = creep.room.storage.id;
        creep.memory.targetType = 2;
        return creep.room.storage;
    }

    return undefined;
}

module.exports = creep_salvager;