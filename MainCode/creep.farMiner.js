var creep_farMiner = {
    //For miner in SK rooms, see creep_farMinerSK
    /** @param {Creep} creep **/
    run: function(creep) {
    	if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'farMinerNearDeath') {
    		creep.memory.priority = 'farMinerNearDeath';
    	}

    	if (creep.hits < 400 && Game.flags[creep.memory.targetFlag] && Game.flags[creep.memory.targetFlag].room && Game.flags[creep.memory.targetFlag].room.name == creep.room.name) {
            // Simplified hostile detection - check for any hostile creeps
            var hostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3, {
            	filter: (eCreep) => !Memory.whiteList.includes(eCreep.owner.username)
            });
            
            if (hostiles.length > 0) {
                let hostile = hostiles[0];
                if (hostile.owner.username != 'Invader' && hostile.owner.username != 'Source Keeper' && Game.flags[creep.memory.targetFlag]) {
    				creep.attack(hostile);
                	console.log(creep.memory.targetFlag + ' was removed due to an attack by ' + hostile.owner.username);
                	Memory.LastNotification = Game.time.toString() + ' : ' + creep.memory.targetFlag + ' was removed due to an attack by ' + hostile.owner.username;
                	
                	if (!Memory.warMode) {
                		Memory.warMode = true;
                		console.log('War mode has been enabled.');
                	}
                	if (Memory.FarRoomsUnderAttack.indexOf(creep.room.name) == -1) {
                		Memory.FarRoomsUnderAttack.push(creep.room.name);
                	}
                	
                	let targetTime = Game.time + 750;
                	creep.room.createFlag(Game.flags[creep.memory.targetFlag].pos, creep.memory.targetFlag + ";" + targetTime.toString());
                	Game.flags[creep.memory.targetFlag].remove();
                }
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
        	// Check reservation status less frequently - every 50 ticks instead of variable timing
        	if (Game.time % 50 == 0) {
                if (creep.room.controller && creep.room.controller.owner && creep.room.controller.owner.username != "Montblanc") {
                    // Someone has taken control of this room, remove flag
                    if (Game.flags[creep.memory.targetFlag]) {
                        Game.flags[creep.memory.targetFlag].remove();
                    }
                } else if (creep.room.controller && creep.room.controller.reservation) {
        			if (creep.room.controller.reservation.username != 'Montblanc') {
                		// Get guards in to clear invader core/hostiles
                		if (Memory.FarRoomsUnderAttack.indexOf(creep.room.name) == -1) {
                			Memory.FarRoomsUnderAttack.push(creep.room.name);
                		}
                		Memory.FarClaimerNeeded[creep.room.name] = true;
                	} else if (creep.room.controller.reservation.ticksToEnd <= 1000) {
                		Memory.FarClaimerNeeded[creep.room.name] = true;
                	} else if (Memory.FarClaimerNeeded[creep.room.name]) {
                		Memory.FarClaimerNeeded[creep.room.name] = false;
                	}
                } else if (creep.room.controller && !Memory.FarClaimerNeeded[creep.room.name]) {
                	Memory.FarClaimerNeeded[creep.room.name] = true;
                } else if (!creep.room.controller && Memory.FarClaimerNeeded[creep.room.name]) {
                	Memory.FarClaimerNeeded[creep.room.name] = false;
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
            		if (!creep.pos.isEqualTo(containers[0].pos)) {
            			creep.travelTo(containers[0]);
            		}
            		creep.memory.storageUnit = containers[0].id;
            	} else if (creep.store[RESOURCE_ENERGY] >= 36) {
            		// Check for hostiles first
            		let nearFoe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3, {
            			filter: (eCreep) => !Memory.whiteList.includes(eCreep.owner.username)
            		});
            		
            		if (nearFoe.length) {
            			creep.attack(nearFoe[0]);
            		} else {
            			// Build or create container
            			let sites = mineTarget.pos.findInRange(FIND_CONSTRUCTION_SITES, 1);
            			if (sites.length) {
            				if (creep.build(sites[0]) == ERR_NOT_IN_RANGE) {
            					creep.travelTo(sites[0]);
            				}
            			} else if (creep.pos.isNearTo(mineTarget)) {
            				creep.room.createConstructionSite(creep.pos.x, creep.pos.y, STRUCTURE_CONTAINER);
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
            	if (!doNotHarvest) {
            		if (creep.harvest(mineTarget) == ERR_NOT_IN_RANGE && !triedToMove) {
            			creep.travelTo(mineTarget);
            		}
            	} else if (!creep.memory.onContainer) {
            		// Container is full, move to it anyway to position correctly
            		creep.travelTo(mineTarget);
            	}
            } else {
                // Find and cache the source ID
                if (Game.flags[creep.memory.targetFlag]) {
                	let markedSources = Game.flags[creep.memory.targetFlag].pos.lookFor(LOOK_SOURCES);
                	if (markedSources.length) {
                		creep.memory.mineSource = markedSources[0].id;
                		// Try to harvest immediately after finding source
                		if (creep.harvest(markedSources[0]) == ERR_NOT_IN_RANGE && !triedToMove) {
                			creep.travelTo(markedSources[0]);
                		}
                	} else {
                		creep.travelTo(Game.flags[creep.memory.targetFlag]);
                	}
                }
            }
        }
    }
};

module.exports = creep_farMiner;