var creep_work = {

    /** @param {Creep} creep **/
    run: function(creep, moveRecalc) {
        switch (creep.memory.priority) {
            case 'harvester':
            case 'harvesterNearDeath':
                if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'harvesterNearDeath') {
                    creep.memory.priority = 'harvesterNearDeath';
                }
                let mineTarget = undefined;
                let thisUnit = undefined;

                if (creep.memory.sourceLocation) {
                    mineTarget = Game.getObjectById(creep.memory.sourceLocation);
                    if (mineTarget) {
                        if (creep.harvest(mineTarget) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(Game.flags[creep.memory.targetFlag]);
                        }
                    }
                }
                if (creep.memory.storageUnit && Game.time % 4 == 0) {
                    thisUnit = Game.getObjectById(creep.memory.storageUnit);
                }

                if (thisUnit) {
                    if (thisUnit.structureType == STRUCTURE_CONTAINER) {
                        if (thisUnit.hits < thisUnit.hitsMax) {
                            creep.repair(thisUnit);
                        }
                        if (creep.pos != thisUnit.pos) {
                            creep.travelTo(thisUnit);
                        }
                    } else {
                        //This is a storage Unit
                        creep.transfer(thisUnit, RESOURCE_ENERGY);
                    }
                } else if (!creep.memory.storageUnit && mineTarget && creep.pos.inRangeTo(mineTarget, 1)) {
                    let containers = mineTarget.pos.findInRange(FIND_STRUCTURES, 2, {
                        filter: (structure) => structure.structureType == STRUCTURE_CONTAINER || structure.structureType == STRUCTURE_STORAGE
                    });
                    if (containers.length) {
                        if (creep.pos != containers[0].pos && containers[0].structureType == STRUCTURE_CONTAINER) {
                            creep.travelTo(containers[0]);
                        }
                        creep.memory.storageUnit = containers[0].id;
                    } else {
                        if (creep.carry[RESOURCE_ENERGY] >= 36) {
                            let sites = mineTarget.pos.findInRange(FIND_CONSTRUCTION_SITES, 2)
                            if (sites.length) {
                                if (creep.build(sites[0]) == ERR_NOT_IN_RANGE) {
                                    creep.travelTo(sites[0]);
                                }
                            } else if (!sites.length) {
                                //Create new container
                                if (creep.pos.isNearTo(mineTarget)) {
                                    creep.room.createConstructionSite(creep.pos.x, creep.pos.y, STRUCTURE_CONTAINER);
                                }
                            }
                        }
                    }
                }
                break;
            case 'supplier':
            case 'supplierNearDeath':
                if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'supplierNearDeath') {
                    creep.memory.priority = 'supplierNearDeath';
                }

                if (!creep.memory.atSpot && Game.flags[creep.room.name + "Supply"] && (creep.pos.x != Game.flags[creep.room.name + "Supply"].pos.x || creep.pos.y != Game.flags[creep.room.name + "Supply"].pos.y)) {
                    creep.travelTo(Game.flags[creep.room.name + "Supply"]);
                } else if (_.sum(creep.carry) == 0) {
                    creep.memory.atSpot = true;
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
                break;
            case 'upgrader':
            case 'upgraderNearDeath':

                break;
        }
    }
};

function repairCompare(a, b) {
    if (a.hits < b.hits)
        return -1;
    if (a.hits > b.hits)
        return 1;
    return 0;
}

module.exports = creep_work;