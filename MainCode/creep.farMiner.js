var creep_farMiner = {
    //For miner in SK rooms, see creep_farMinerSK
    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'farMinerNearDeath') {
            creep.memory.priority = 'farMinerNearDeath';
        }

        if (creep.hits < 400 && Game.flags[creep.memory.targetFlag].room.name == creep.room.name) {
            //Determine if attacker is player, if so, delete flag.
            var hostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3, {
                filter: (creep) => (creep.getActiveBodyparts(WORK) > 0 || creep.getActiveBodyparts(CARRY) > 0 || creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0 || creep.getActiveBodyparts(HEAL) > 0) || (creep.hits <= 500)
            });
            if (hostiles.length > 0 && hostiles[0].owner.username != 'Invader' && hostiles[0].owner.username != 'Source Keeper' && Game.flags[creep.memory.targetFlag]) {
                Game.notify(creep.memory.tragetFlag + ' was removed due to an attack by ' + hostiles[0].owner.username);
                if (!Memory.warMode) {
                    Memory.warMode = true;
                    Game.notify('War mode has been enabled.');
                }
                Game.flags[creep.memory.targetFlag].remove();
            }
        }

        if (creep.room.name != creep.memory.destination) {
            if (Game.flags[creep.memory.targetFlag + "Here"] && Game.flags[creep.memory.targetFlag + "Here"].pos) {
                creep.travelTo(Game.flags[creep.memory.targetFlag + "Here"]);
            } else if (Game.flags[creep.memory.targetFlag] && Game.flags[creep.memory.targetFlag].pos) {
                creep.travelTo(Game.flags[creep.memory.targetFlag]);
            } else {
                creep.travelTo(new RoomPosition(25, 25, creep.memory.destination));
            }
        } else {
            if (Game.time >= creep.memory.nextReservationCheck) {
                if (creep.room.controller && creep.room.controller.reservation && (creep.room.name == creep.memory.destination)) {
                    if (creep.room.controller.reservation.ticksToEnd <= 1000 && !Memory.FarClaimerNeeded[creep.room.name]) {
                        Memory.FarClaimerNeeded[creep.room.name] = true;
                        creep.memory.nextReservationCheck = Game.time + 50;
                    } else if (Memory.FarClaimerNeeded[creep.room.name]) {
                        Memory.FarClaimerNeeded[creep.room.name] = false;
                        creep.memory.nextReservationCheck = Game.time + creep.room.controller.reservation.ticksToEnd - 1000;
                    }
                } else if (creep.room.name == creep.memory.destination && creep.room.controller && !Memory.FarClaimerNeeded[creep.room.name]) {
                    Memory.FarClaimerNeeded[creep.room.name] = true;
                    creep.memory.nextReservationCheck = Game.time + 50;
                } else if (!creep.room.controller && Memory.FarClaimerNeeded[creep.room.name]) {
                    Memory.FarClaimerNeeded[creep.room.name] = false;
                    creep.memory.nextReservationCheck = Game.time + 1500;
                }
            }

            var mineTarget = undefined;
            var thisUnit = undefined;

            if (creep.memory.storageUnit) {
                thisUnit = Game.getObjectById(creep.memory.storageUnit);
            }

            if (creep.memory.mineSource) {
                mineTarget = Game.getObjectById(creep.memory.mineSource);
                var StorageOK = true;
                if (thisUnit && _.sum(thisUnit.store) == thisUnit.storeCapacity) {
                    StorageOK = false;
                }
                if (mineTarget && _.sum(creep.carry) <= 40 && mineTarget.energy > 0 && StorageOK) {
                    if (creep.harvest(mineTarget) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(Game.flags[creep.memory.targetFlag]);
                    }
                    if (Game.flags[creep.memory.targetFlag + "Here"]) {
                        creep.travelTo(Game.flags[creep.memory.targetFlag + "Here"]);
                    }
                } else if (Game.flags[creep.memory.targetFlag + "Here"] && mineTarget) {
                    creep.travelTo(Game.flags[creep.memory.targetFlag + "Here"]);
                } else if (mineTarget) {
                    creep.travelTo(Game.flags[creep.memory.targetFlag]);
                }
            } else {
                //Get the source ID while in the room
                var markedSources = [];
                if (Game.flags[creep.memory.targetFlag]) {
                    markedSources = Game.flags[creep.memory.targetFlag].pos.lookFor(LOOK_SOURCES);
                }
                if (markedSources.length) {
                    creep.memory.mineSource = markedSources[0].id;
                }
                mineTarget = Game.getObjectById(creep.memory.mineSource);
                if (mineTarget) {
                    if (creep.harvest(mineTarget) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(Game.flags[creep.memory.targetFlag]);
                    }
                }
            }

            if (thisUnit) {
                if (thisUnit.hits < thisUnit.hitsMax) {
                    creep.repair(thisUnit);
                } else if (creep.carry.energy >= 36) {
                    if (creep.transfer(thisUnit, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(thisUnit);
                    }
                }
            } else {
                if (mineTarget) {
                    if (creep.pos.inRangeTo(mineTarget, 2)) {
                        var containers = creep.pos.findInRange(FIND_STRUCTURES, 2, {
                            filter: (structure) => structure.structureType == STRUCTURE_CONTAINER
                        });
                        if (containers.length) {
                            if (creep.transfer(containers[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(containers[0]);
                            }
                            creep.memory.storageUnit = containers[0].id;
                        } else {
                            if (creep.carry[RESOURCE_ENERGY] >= 36) {
                                var sites = creep.pos.findInRange(FIND_CONSTRUCTION_SITES, 2)
                                var nearFoe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3, {
                                    filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
                                });
                                if (sites.length && !nearFoe.length) {
                                    if (creep.build(sites[0]) == ERR_NOT_IN_RANGE) {
                                        creep.travelTo(sites[0]);
                                    }
                                } else if (!sites.length && !nearFoe.length) {
                                    //Create new container
                                    if (creep.pos.isNearTo(mineTarget)) {
                                        var x = Math.floor(Math.random() * 3);
                                        switch (x) {
                                            case 0:
                                                x = -1;
                                                break;
                                            case 1:
                                                x = 0;
                                                break;
                                            case 2:
                                                x = 1;
                                                break;
                                        }
                                        var y = Math.floor(Math.random() * 3);
                                        switch (y) {
                                            case 0:
                                                y = -1;
                                                break;
                                            case 1:
                                                y = 0;
                                                break;
                                            case 2:
                                                y = 1;
                                                break;
                                        }
                                        creep.room.createConstructionSite(creep.pos.x + x, creep.pos.y + y, STRUCTURE_CONTAINER);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

module.exports = creep_farMiner;