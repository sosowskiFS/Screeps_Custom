var creep_combat = {

    /** @param {Creep} creep **/
    run: function(creep) {
        //Defensive-focused attack
        //Only run this code if the room is being invaded, remain offline otherwise.
        //(Saves running excess finds in peacetime)
        if (creep.hits < creep.hitsMax) {
            creep.heal(creep);
        }
       	if (!creep.memory.waitingTimer) {
            creep.memory.waitingTimer = 0
        }

        if (Memory.roomsUnderAttack.indexOf(creep.room.name) != -1) {
            //Move towards Foe, stop at rampart
            var lookResult = creep.pos.lookFor(LOOK_STRUCTURES);
            var Foe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 50, {
                filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
            });

            var closeFoe = Game.getObjectById(Memory.towerPickedTarget[creep.room.name]);
            var massAttackFlag = false;
            if (!closeFoe) {
                closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
                    filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
                });
                massAttackFlag = true;
            }

            if (Foe.length) {
                Foe.sort(targetOther);
                var boostFlag = false;
                if ((Foe[0].getActiveBodyparts(ATTACK) > 0 || Foe[0].getActiveBodyparts(RANGED_ATTACK) > 0 || Foe[0].getActiveBodyparts(WORK) > 0) && Foe[0].owner.username != 'Invader') {
                    Foe[0].body.forEach(function(thisPart) {
                        if (thisPart.boost) {
                            boostFlag = true;
                        }
                    });
                }
                if (boostFlag && creep.room.controller.level >= 6) {
                    var attackLab = creep.room.find(FIND_MY_STRUCTURES, {
                        filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_KEANIUM_ALKALIDE)
                    });
                    var mineralCost = creep.getActiveBodyparts(RANGED_ATTACK) * LAB_BOOST_MINERAL;
                    var energyCost = creep.getActiveBodyparts(RANGED_ATTACK) * LAB_BOOST_ENERGY;
                    if (attackLab.length && attackLab[0].mineralAmount >= mineralCost && attackLab[0].energy >= energyCost) {
                        creep.memory.needBoosts = true;
                    } else {
                        creep.memory.needBoosts = false;
                    }
                } else {
                    creep.memory.needBoosts = false;
                }
            }

            var unboostedAttack = 0;
            if (creep.memory.needBoosts && creep.room.controller.level >= 6) {
                creep.body.forEach(function(thisPart) {
                    if (thisPart.type == RANGED_ATTACK && !thisPart.boost) {
                        unboostedAttack = unboostedAttack + 1;
                    }
                });
            }

            var rFound = false;
            var rangeToFoe = creep.pos.getRangeTo(closeFoe);
            if (creep.memory.needBoosts && unboostedAttack > 0) {
                var thisLab = creep.room.find(FIND_MY_STRUCTURES, {
                    filter: (structure) => (structure.structureType == STRUCTURE_LAB && structure.mineralType == RESOURCE_CATALYZED_KEANIUM_ALKALIDE)
                });
                if (thisLab.length) {
                    creep.travelTo(thisLab[0]);
                    thisLab[0].boostCreep(creep);
                } else {
                    creep.memory.needBoost = false;
                }
            } else if (closeFoe) {
                var lookResult = creep.pos.lookFor(LOOK_STRUCTURES);
                let timer = 2000;
                if (Foe.length <= 1) {
                	timer = 250;
                }
                if (lookResult.length && creep.memory.waitingTimer < timer) {
                    for (let y = 0; y < lookResult.length; y++) {
                        if (lookResult[y].structureType == STRUCTURE_RAMPART) {
                            rFound = true;
                            if (rangeToFoe <= 3) {
                                creep.memory.waitingTimer = 0;
                            } else if (lookResult[y].isPublic == true) {
                                creep.memory.waitingTimer = creep.memory.waitingTimer + 10;
                            } else {
                                creep.memory.waitingTimer = creep.memory.waitingTimer + 1;
                            }
                            break;
                        }
                    }
                    if (!rFound) {
                        creep.travelTo(closeFoe, {
                            maxRooms: 1
                        });
                    } else if (rangeToFoe > 1) {
                    	//Scan area around self, if target is in a similar direction to a rampart, move to that rampart
                    	let moveDir = moveWithinRamparts(creep.pos.getDirectionTo(closeFoe), creep, closeFoe);
                    	if (moveDir) {
                    		creep.move(moveDir);
                    	}
                    }
                } else {
                    creep.memory.waitingTimer = 0;
                    creep.travelTo(closeFoe, {
                        maxRooms: 1
                    });
                }
            }

            if (closeFoe && rangeToFoe <= 3) {
                if (massAttackFlag) {
                    creep.rangedMassAttack();
                } else {
                    if (rangeToFoe <= 1) {
                        creep.rangedMassAttack();
                    } else {
                        creep.rangedAttack(closeFoe);
                    }              
                }
                creep.say("\uFF08\u0E07\u03A6 \u0414 \u03A6\uFF09\u0E07", true);
                creep.memory.waitingTimer = 0;
                if (!rFound && rangeToFoe <= 2) {
                    //Back up
                    creep.travelTo(closeFoe, {
                        maxRooms: 1,
                        range: 3
                    }, true);
                } else {
                    //Eat movement request
                    creep.travelTo(creep);
                }
            } else {
                //The specified target isn't near, but other targets might be.
                creep.rangedMassAttack();
            }
        } else {
        	creep.memory.waitingTimer = creep.memory.waitingTimer + 1;
        	if (creep.memory.waitingTimer >= 10) {
        		let homeSpawn = Game.getObjectById(creep.memory.fromSpawn)
	            if (homeSpawn) {
	                creep.travelTo(homeSpawn, {
	                    maxRooms: 1,
	                    range: 2
	                })
	            }
        	}            
            //Move out of the way
            let talkingCreeps = creep.pos.findInRange(FIND_MY_CREEPS, 1, {
                filter: (thisCreep) => (creep.id != thisCreep.id && thisCreep.saying)
            })
            if (talkingCreeps.length) {
                let coords = talkingCreeps[0].saying.split(";");
                if (coords.length == 2 && creep.pos.x == parseInt(coords[0]) && creep.pos.y == parseInt(coords[1])) {
                    //Standing in the way of a creep
                    let thisDirection = creep.pos.getDirectionTo(talkingCreeps[0].pos);
                    creep.move(thisDirection);
                    creep.say("\uD83D\uDCA6", true);
                }
            }
        }
    }
};

function targetOther(a, b) {
    if (a.getActiveBodyparts(HEAL) > b.getActiveBodyparts(HEAL))
        return 1;
    if (a.getActiveBodyparts(HEAL) < b.getActiveBodyparts(HEAL))
        return -1;
    return 0;
}

function moveWithinRamparts(targetDir, creep, closeFoe) {
    /*
		TOP: 1,
	    TOP_RIGHT: 2,
	    RIGHT: 3,
	    BOTTOM_RIGHT: 4,
	    BOTTOM: 5,
	    BOTTOM_LEFT: 6,
	    LEFT: 7,
	    TOP_LEFT: 8 
    */
    let checkDirections = [];
    let coordMods = [];
    switch (targetDir) {
    	case TOP:
    		checkDirections = [TOP_LEFT, TOP, TOP_RIGHT];
    		coordMods = [[-1, -1], [0, -1], [1, -1]];
    		break;
    	case TOP_RIGHT:
    		checkDirections = [TOP, TOP_RIGHT, RIGHT];
    		coordMods = [[0, -1], [1, -1], [1, 0]];
    		break;
    	case RIGHT:
    		checkDirections = [TOP_RIGHT, RIGHT, BOTTOM_RIGHT];
    		coordMods = [[1, -1], [1, 0], [1, 1]];
    		break;
    	case BOTTOM_RIGHT:
    		checkDirections = [RIGHT, BOTTOM_RIGHT, BOTTOM];
    		coordMods = [[1, 0], [1, 1], [0, 1]];
    		break;
    	case BOTTOM:
    		checkDirections = [BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT];
    		coordMods = [[1, 1], [0, 1], [-1, 1]];
    		break;
    	case BOTTOM_LEFT:
    		checkDirections = [BOTTOM, BOTTOM_LEFT, LEFT];
    		coordMods = [[0, 1], [-1, 1], [-1, 0]];
    		break;
    	case LEFT:
    		checkDirections = [BOTTOM_LEFT, LEFT, TOP_LEFT];
    		coordMods = [[-1, 1], [-1, 0], [-1, -1]];
    		break;
    	case TOP_LEFT:
    		checkDirections = [LEFT, TOP_LEFT, TOP];
    		coordMods = [[-1, 0], [-1, -1], [0, -1]];
    		break;
    }
    //Step 2 - determine which directions have ramparts
    //let lookResult = creep.pos.lookFor(LOOK_STRUCTURES);
    let badDir = [];
    for (let i = 0; i <= 2; i++) {
    	//sanity check
    	if (creep.pos.x + coordMods[i][0] >= 49 || creep.pos.x + coordMods[i][0] <= 0) {
    		badDir.push[i];
    		continue;
    	}
    	if (creep.pos.y + coordMods[i][1] >= 49 || creep.pos.y + coordMods[i][1] <= 0) {
    		badDir.push[i];
    		continue;
    	}

    	let thisPos = new RoomPosition(creep.pos.x + coordMods[i][0], creep.pos.y + coordMods[i][1], creep.room.name);
    	let lookResult = thisPos.lookFor(LOOK_STRUCTURES);
    	let rFound = false;
        if (lookResult.length) {
            for (let y = 0; y < lookResult.length; y++) {
                if (lookResult[y].structureType == STRUCTURE_RAMPART) {
                    rFound = true;
                    break;
                }
            }
        }
        if (!rFound) {
        	badDir.push(i);
        	continue;
        }
    }

    if (badDir.length) {
    	badDir.reverse();
    	for (let q = 0; q < badDir.length; q++) {
    		checkDirections.splice(badDir[q], 1);
    		coordMods.splice(badDir[q], 1);
    	}
    }

    //Step 3 - If more than one result, determine which direction is closer to target
    if (!checkDirections.length) {
    	return undefined;
    }

    let bestDir = undefined;
    let bestDist = 99;
    for (let l = 0; l < checkDirections.length; l++) {
    	let thisPos = new RoomPosition(creep.pos.x + coordMods[l][0], creep.pos.y + coordMods[l][1], creep.room.name);
    	let thisDist = thisPos.getRangeTo(closeFoe);
    	if (thisDist < bestDist) {
    		bestDist = thisDist;
    		bestDir = checkDirections[l];
    	}
    }

    return bestDir;
}

module.exports = creep_combat;