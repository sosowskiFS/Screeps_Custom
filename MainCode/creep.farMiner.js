var creep_farMiner = {
    //For miner in SK rooms, see creep_farMinerSK
    /** @param {Creep} creep **/
    run: function(creep) {
    	if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'farMinerNearDeath') {
    		creep.memory.priority = 'farMinerNearDeath';
    	}

    	if (creep.hits < 400 && Game.flags[creep.memory.targetFlag] && Game.flags[creep.memory.targetFlag].room && Game.flags[creep.memory.targetFlag].room.name == creep.room.name) {
            //Determine if attacker is player, if so, delete flag.
            var hostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3, {
            	filter: (creep) => (creep.getActiveBodyparts(WORK) > 0 || creep.getActiveBodyparts(CARRY) > 0 || creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0 || creep.getActiveBodyparts(HEAL) > 0 && !Memory.whiteList.includes(creep.owner.username)) || (creep.hits <= 500)
            });
            if (hostiles.length > 0 && hostiles[0].owner.username != 'Invader' && hostiles[0].owner.username != 'Source Keeper' && Game.flags[creep.memory.targetFlag]) {
            	Game.notify(creep.memory.targetFlag + ' was removed due to an attack by ' + hostiles[0].owner.username);
            	Memory.LastNotification = Game.time.toString() + ' : ' + creep.memory.targetFlag + ' was removed due to an attack by ' + hostiles[0].owner.username
            	if (!Memory.warMode) {
            		Memory.warMode = true;
            		Game.notify('War mode has been enabled.');
            	}
            	if (Memory.FarRoomsUnderAttack.indexOf(creep.room.name) == -1) {
            		Memory.FarRoomsUnderAttack.push(creep.room.name);
            	}
            	let targetTime = Game.time + 750;
            	creep.room.createFlag(Game.flags[creep.memory.targetFlag].pos, creep.memory.targetFlag + ";" + targetTime.toString());
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
        	if (!creep.memory.travelDistance && creep.memory._trav && creep.memory._trav.path) {
        		creep.memory.travelDistance = creep.memory._trav.path.length;
        		creep.memory.deathWarn = (creep.memory.travelDistance + _.size(creep.body) * 3) + 15;
        	}
        } else {
        	if (Game.time >= creep.memory.nextReservationCheck) {
                if (creep.room.controller && creep.room.controller.owner && creep.room.controller.owner != "Montblanc") {
                    //Someone has taken control of this room, remove flag.
                    if (Game.flags[creep.memory.targetFlag]) {
                        Game.flags[creep.memory.targetFlag].remove();
                    }
                } else if (creep.room.controller && creep.room.controller.reservation && (creep.room.name == creep.memory.destination)) {
        			if (creep.room.controller.reservation.username != 'Montblanc') {
                		//Get guards in to clear invader core/hostiles
                		if (Memory.FarRoomsUnderAttack.indexOf(creep.room.name) == -1) {
                			Memory.FarRoomsUnderAttack.push(creep.room.name);
                		}
                		Memory.FarClaimerNeeded[creep.room.name] = true;
                        creep.memory.nextReservationCheck = Game.time + 50;
                	} else if (creep.room.controller.reservation.ticksToEnd <= 1000 && !Memory.FarClaimerNeeded[creep.room.name]) {
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

            let mineTarget = undefined;
            let thisUnit = undefined;
            let triedToMove = false;

            //Goal : Only need to get storage unit as a target every 10 ticks
            //Need to keep storageUnit under creep to not do deposits

            if (creep.memory.mineSource) {
            	mineTarget = Game.getObjectById(creep.memory.mineSource);
            }

            if (!creep.memory.storageUnit && mineTarget && creep.pos.inRangeTo(mineTarget, 1)) {
            	let containers = mineTarget.pos.findInRange(FIND_STRUCTURES, 1, {
            		filter: (structure) => structure.structureType == STRUCTURE_CONTAINER
            	});
            	if (containers.length) {
            		if (creep.pos != containers[0].pos) {
            			creep.travelTo(containers[0]);
            		}
            		creep.memory.storageUnit = containers[0].id;
            	} else {
            		if (creep.carry[RESOURCE_ENERGY] >= 36) {
            			let sites = mineTarget.pos.findInRange(FIND_CONSTRUCTION_SITES, 1)
            			let nearFoe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3, {
            				filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
            			});
            			if (sites.length && !nearFoe.length) {
            				if (creep.build(sites[0]) == ERR_NOT_IN_RANGE) {
            					creep.travelTo(sites[0]);
            				}
            			} else if (!sites.length && !nearFoe.length) {
                            //Create new container
                            if (creep.pos.isNearTo(mineTarget)) {
                            	creep.room.createConstructionSite(creep.pos.x, creep.pos.y, STRUCTURE_CONTAINER);
                            }
                        }
                    }
                }
            }

            if (creep.memory.storageUnit && (Game.time % 10 == 0 || !creep.memory.onContainer)) {
            	thisUnit = Game.getObjectById(creep.memory.storageUnit);
            }

            let doNotHarvest = false;

            if (thisUnit) {
            	if (thisUnit.hits < thisUnit.hitsMax) {
            		creep.repair(thisUnit);
            	}
            	if (creep.pos.x != thisUnit.pos.x || creep.pos.y != thisUnit.pos.y) {
            		triedToMove = true;
            		creep.travelTo(thisUnit);
            	} else {
            		creep.memory.onContainer = true;
            	}
            	if (creep.store.getFreeCapacity() <= 0 && thisUnit.store.getFreeCapacity() <= 0) {
            		doNotHarvest = true;
            	}
            }

            if (mineTarget) {
            	if (!doNotHarvest && creep.harvest(mineTarget) == ERR_NOT_IN_RANGE && !triedToMove) {
            		creep.travelTo(Game.flags[creep.memory.targetFlag]);
            	} else if (doNotHarvest && !creep.memory.onContainer) {
            		creep.travelTo(Game.flags[creep.memory.targetFlag]);
            	}
            } else {
                //Get the source ID while in the room
                let markedSources = [];
                if (Game.flags[creep.memory.targetFlag]) {
                	markedSources = Game.flags[creep.memory.targetFlag].pos.lookFor(LOOK_SOURCES);
                }
                if (markedSources.length) {
                	creep.memory.mineSource = markedSources[0].id;
                }
                mineTarget = Game.getObjectById(creep.memory.mineSource);
                if (mineTarget) {
                	if (creep.harvest(mineTarget) == ERR_NOT_IN_RANGE && !triedToMove) {
                		creep.travelTo(Game.flags[creep.memory.targetFlag]);
                	}
                }
            }
        }
    }
};

module.exports = creep_farMiner;