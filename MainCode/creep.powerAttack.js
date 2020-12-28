var creep_powerAttack = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (!Game.flags[creep.memory.homeRoom + "PowerGather"]) {
            //You are not required
            creep.suicide();
        } else {
        	if (!creep.memory.disabledNotify) {
                    creep.notifyWhenAttacked(false);
                    creep.memory.disabledNotify = true;
                }
            if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'powerAttackNearDeath') {
                creep.memory.priority = 'powerAttackNearDeath';
            }
            //Flag active
            if (creep.room.name != creep.memory.destination) {
                //Travel to room
                if (Game.flags[creep.memory.homeRoom + "PowerGather"] && Game.flags[creep.memory.homeRoom + "PowerGather"]) {
                    creep.travelTo(Game.flags[creep.memory.homeRoom + "PowerGather"]);
                } else {
                    creep.travelTo(new RoomPosition(25, 25, creep.memory.destination));
                }
            } else {
                //Main loop
                if (!creep.memory.targetBank) {
                    try {
                        var powerBanks = Game.flags[creep.memory.homeRoom + "PowerGather"].pos.lookFor(LOOK_STRUCTURES);
                        if (powerBanks.length) {
                            creep.memory.targetBank = powerBanks[0].id
                            creep.travelTo(powerBanks[0]);
                            if (!creep.memory.travelDistance && creep.memory._trav && creep.memory._trav.path) {
                                creep.memory.travelDistance = creep.memory._trav.path.length;
                                creep.memory.deathWarn = (creep.memory.travelDistance + _.size(creep.body) * 3) + 15;
                            }
                        } else {
                            //No bank located, delete flag
                            Game.flags[creep.memory.homeRoom + "PowerGather"].remove();
                            if (Game.flags[creep.memory.homeRoom + "PowerGuard"]) {
                                Game.flags[creep.memory.homeRoom + "PowerGuard"].remove();
                            }
                            //Game.notify('Power flag deleted - Cannot find bank. Initial look |' + creep.room.name);
                        }
                    } catch (e) {
                        creep.travelTo(Game.flags[creep.memory.homeRoom + "PowerGather"]);
                        if (!creep.memory.travelDistance && creep.memory._trav && creep.memory._trav.path) {
                            creep.memory.travelDistance = creep.memory._trav.path.length;
                            creep.memory.deathWarn = (creep.memory.travelDistance + _.size(creep.body) * 3) + 15;
                        }
                    }

                } else if (creep.hits >= 2500) {
                    var thisBank = Game.getObjectById(creep.memory.targetBank);
                    if (thisBank) {
                        let attackResult = creep.attack(thisBank);
                        if (attackResult == ERR_NOT_IN_RANGE) {
                            creep.travelTo(thisBank);
                        } else if (attackResult == OK && thisBank.hits >= 1500000) {
                            creep.memory.checkForOwnership = true;
                        }
                        if (thisBank.hits <= 468000 && !Game.flags[creep.memory.homeRoom + "PowerCollect"]) {
                            //Set flag to signal mule creation
                            Game.rooms[creep.room.name].createFlag(25, 25, creep.memory.homeRoom + "PowerCollect");
                        }
                        //750 = attack per hit
                        /*if (creep.memory.deathWarn > 0 && (thisBank.hits / 750) <= creep.ticksToLive + 50) {
                        	//Don't deathwarn. May be able to destroy it now.
                        	creep.memory.deathWarn = 0;
                        	creep.memory.priority = 'powerAttack';
                        }*/
                    } else {
                        //Cannot find bank, abort
                        Game.flags[creep.memory.homeRoom + "PowerGather"].remove();
                        if (Game.flags[creep.memory.homeRoom + "PowerGuard"]) {
                            Game.flags[creep.memory.homeRoom + "PowerGuard"].remove();
                        }
                        //Game.notify('Power flag deleted - Cannot find bank. |' + creep.room.name);
                    }
                }
            }
        }
        var AgreementList = ["slowmotionghost", "Digital"];

        let inRangeEnemy = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 2, {
            filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username) && eCreep.getActiveBodyparts(ATTACK) > 0)
        });
        if (inRangeEnemy.length) {
            if (!creep.memory.isOwner && creep.memory.checkForOwnership) {
                if (AgreementList.includes(inRangeEnemy[0].owner.username)) {
                    //They were here first, cancel flag.
                    if (Game.flags[creep.memory.homeRoom + "PowerGather"]) {
                        Game.flags[creep.memory.homeRoom + "PowerGather"].remove();
                    }          
                    if (Game.flags[creep.memory.homeRoom + "PowerGuard"]) {
                        Game.flags[creep.memory.homeRoom + "PowerGuard"].remove();
                    }
                    Game.notify(Game.time.toString() + " | " + creep.room.name + " gave ownership of power bank to " + inRangeEnemy[0].owner.username);
                    Memory.LastNotification = Game.time.toString() + " : " + creep.room.name + " gave ownership of power bank to " + inRangeEnemy[0].owner.username
                } else {
                    if (!Game.flags[creep.memory.homeRoom + "PowerGuard"] && creep.room.name == creep.memory.destination) {
                        creep.room.createFlag(25, 25, creep.memory.homeRoom + "PowerGuard");
                    }
                    if (creep.pos.isNearTo(inRangeEnemy[0])) {
                        creep.attack(inRangeEnemy[0]);
                    }                 
                    creep.memory.isOwner = true;
                }
            } else if (!AgreementList.includes(inRangeEnemy[0].owner.username)) {
                if (creep.pos.isNearTo(inRangeEnemy[0])) {
                    creep.attack(inRangeEnemy[0]);
                }
                if (!Game.flags[creep.memory.homeRoom + "PowerGuard"] && creep.room.name == creep.memory.destination) {
                    creep.room.createFlag(25, 25, creep.memory.homeRoom + "PowerGuard");
                }
            }        
        } else if (!creep.memory.isOwner && creep.memory.checkForOwnership) {
            creep.memory.isOwner = true;
        }
    }

};

module.exports = creep_powerAttack;