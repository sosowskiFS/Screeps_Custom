var creep_farMining = {

    /** @param {Creep} creep **/
    //Previous Usages - 55.9 mining / 104 overall
    run: function(creep, doExcessWork) {
        switch (creep.memory.priority) {
            case 'farClaimer':
            case 'farClaimerNearDeath':

                if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'farClaimerNearDeath') {
                    creep.memory.priority = 'farClaimerNearDeath';
                }

                var isEvading = evadeAttacker(creep, 4);

                if (!isEvading) {
                    if (creep.room.name != creep.memory.destination) {
                        if (Game.rooms[creep.memory.destination] && Game.rooms[creep.memory.destination].controller) {
                            creep.travelTo(Game.rooms[creep.memory.destination].controller, {
                                ignoreRoads: true
                            });
                        } else {
                            creep.travelTo(new RoomPosition(25, 25, creep.memory.destination), {
                                ignoreRoads: true
                            })
                        }
                    } else {
                        let reserveResult = creep.reserveController(creep.room.controller);
                        if (reserveResult == ERR_NOT_IN_RANGE) {
                            creep.travelTo(creep.room.controller, {
                                ignoreRoads: true
                            });
                        } else if (reserveResult == ERR_INVALID_TARGET) {
                            creep.attackController(creep.room.controller);
                        } else {
                            if (creep.room.controller.sign && creep.room.controller.sign.username != "Montblanc") {
                                creep.signController(creep.room.controller, "\u300C\u306B\u3083\u30FC\u300D(^\u30FB\u03C9\u30FB^ )");
                            } else if (!creep.room.controller.sign) {
                                creep.signController(creep.room.controller, "\u300C\u306B\u3083\u30FC\u300D(^\u30FB\u03C9\u30FB^ )");
                            }
                        }

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

                break;
            case 'farMineralMiner':
                if (creep.store.getCapacity() <= 0) {
                    //Too damaged, can't carry anything. suicide.
                    creep.suicide();
                }
                if ((creep.store.getFreeCapacity() <= 0 || (creep.store.getUsedCapacity() > 0 && creep.ticksToLive <= 200)) && !creep.memory.storing) {
                    creep.memory.storing = true;
                } else if (creep.store.getUsedCapacity() == 0 && creep.memory.storing) {
                    creep.memory.storing = false;
                }

                if (!creep.memory.storing) {
                    //in farRoom, mine mineral
                    if (creep.memory.mineralTarget) {
                        let thisMineral = Game.getObjectById(creep.memory.mineralTarget);
                        if (thisMineral) {
                            if (thisMineral.lastCooldown >= 28) {
                                //Too much time to spend on harvesting this
                                if (Game.flags[creep.memory.targetFlag]) {
                                    Game.flags[creep.memory.targetFlag].remove();
                                }
                                creep.memory.storing = true;
                            } else {
                                creep.travelTo(thisMineral);
                                if (thisMineral.cooldown <= 0) {
                                    creep.harvest(thisMineral);
                                }
                            } 
                        } else {
                            //Target isn't visible, go to room
                            creep.travelTo(new RoomPosition(25, 25, creep.memory.destination));
                        }
                    } else if (creep.room.name == creep.memory.destination) {
                        //Find mineral target
                        let mineralLocations = creep.room.find(FIND_DEPOSITS, {
                            filter: (eStruct) => (eStruct.lastCooldown < 28)
                        });
                        if (mineralLocations.length) {
                            creep.memory.mineralTarget = mineralLocations[0].id;
                            creep.travelTo(mineralLocations[0]);
                        } else {
                            //No mineral anymore, delete flag.
                            if (Game.flags[creep.memory.targetFlag]) {
                                Game.flags[creep.memory.targetFlag].remove();
                            }
                        }
                    } else {
                        creep.travelTo(new RoomPosition(25, 25, creep.memory.destination));
                    }
                } else {
                    //in home room, drop off energy
                    var storageUnit = Game.getObjectById(creep.memory.storageSource)
                    if (storageUnit) {
                        if (Object.keys(creep.carry).length > 1) {
                            if (creep.transfer(storageUnit, Object.keys(creep.carry)[1]) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(storageUnit);
                            }
                        } else if (creep.transfer(storageUnit, Object.keys(creep.carry)[0]) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(storageUnit);
                        }
                    } else {
                        //Not visible, travel to room
                        creep.travelTo(new RoomPosition(25, 25, creep.memory.homeRoom));
                    }
                }
                evadeAttacker(creep, 4);
                break;
            case 'farGuard':
            case 'farGuardNearDeath':
                if (!creep.memory.disabledNotify) {
                    creep.notifyWhenAttacked(false);
                    creep.memory.disabledNotify = true;
                }

                let targetFlagName = creep.memory.targetFlag;
                let tempTargetFlagName = targetFlagName + "TEMP";
                let targetFlag = Game.flags[targetFlagName];
                let tempTargetFlag = Game.flags[tempTargetFlagName];
                let nearbyEnemyCount = -1;
                let hasNearbyEnemies = function() {
                    if (nearbyEnemyCount < 0) {
                        nearbyEnemyCount = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3, {
                            filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
                        }).length;
                    }
                    return nearbyEnemyCount > 0;
                }

                if ((creep.ticksToLive <= creep.memory.deathWarn || creep.hits < 400) && creep.memory.priority != 'farGuardNearDeath') {
                    creep.memory.priority = 'farGuardNearDeath';
                }

                // Simplified guard flag management - only check every 10 ticks
                if (Game.time % 10 == 0) {
                    if (Memory.roomsUnderAttack.indexOf(creep.memory.homeRoom) > -1 && Memory.attackDuration >= 100) {
                        if (targetFlag && !tempTargetFlag) {
                            targetFlag.pos.createFlag(tempTargetFlagName);
                            targetFlag.remove();
                            var homePosition = new RoomPosition(25, 25, creep.memory.homeRoom);
                            homePosition.createFlag(targetFlagName);
                        }
                    } else if (tempTargetFlag && Memory.roomsUnderAttack.indexOf(creep.memory.homeRoom) == -1) {
                        if (tempTargetFlag) {
                            try {
                                tempTargetFlag.pos.createFlag(targetFlagName);
                                tempTargetFlag.remove();
                            } catch (e) {}
                        }
                    }
                }

                targetFlag = Game.flags[targetFlagName];
                tempTargetFlag = Game.flags[tempTargetFlagName];
                if (targetFlag) {
                    if (targetFlag.pos.roomName != creep.memory.destination) {
                        creep.memory.destination = targetFlag.pos.roomName;
                    }
                } else if (tempTargetFlag) {
                    if (tempTargetFlag.pos.roomName != creep.memory.destination) {
                        creep.memory.destination = tempTargetFlag.pos.roomName;
                    }
                }

                var Foe = [];
                var closeFoe = undefined;
                let eCores = undefined;
                if (Game.flags[creep.room.name + "SKRoom"]) {
                    Foe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3, {
                        filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username) && eCreep.owner.username != "Source Keeper")
                    });
                    closeFoe = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS, {
                        filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username) && (eCreep.owner.username != "Source Keeper" || eCreep.hits < eCreep.hitsMax))
                    });
                } else {        
                    closeFoe = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS, {
                        filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
                    });
                    if (closeFoe) {
                        Foe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3, {
                            filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
                        });
                    }
                    if (creep.room.controller && ((creep.room.controller.reservation && creep.room.controller.reservation.username == 'Invader') || !creep.room.controller.reservation)) {
                        eCores = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                            filter: (eStruct) => (eStruct.owner.username == 'Invader')
                        })
                    }
                }

                if (creep.room.controller && creep.room.controller.owner && creep.room.controller.owner.username != "Montblanc" && creep.room.name != creep.memory.destination) {
                    creep.travelTo(new RoomPosition(25, 25, creep.memory.destination), {
                        reusePath: 50
                    });
                    // Only heal when no nearby enemies (prioritize escape over healing)
                    if (creep.hits < creep.hitsMax && !hasNearbyEnemies()) {
                        creep.heal(creep);
                    }
                } else if (closeFoe) {
                    creep.say("\uFF08\u0E05\uFF3E\u30FB\uFECC\u30FB\uFF3E\uFF09\u0E05", true);
                    
                    // Simplified combat logic - cache body part counts
                    if (!creep.memory.bodyParts) {
                        let rangedParts = 0;
                        let attackParts = 0;
                        creep.body.forEach(function(thisPart) {
                            if (thisPart.type == RANGED_ATTACK) rangedParts++;
                            else if (thisPart.type == ATTACK) attackParts++;
                        });
                        creep.memory.bodyParts = { ranged: rangedParts, attack: attackParts };
                    }

                    let attackResult = creep.attack(closeFoe);
                    
                    // Simplified threat assessment
                    let needToRetreat = false;
                    if (Foe.length > 0) {
                        for (let foe of Foe) {
                            if (foe.getActiveBodyparts(ATTACK) > creep.memory.bodyParts.attack) {
                                needToRetreat = true;
                                break;
                            }
                        }
                    }

                    if (needToRetreat) {
                        creep.travelTo(closeFoe, { maxRooms: 1, range: 3 }, true);
                        creep.rangedAttack(closeFoe);
                    } else {
                        creep.travelTo(closeFoe, { maxRooms: 1 });
                        if (Foe.length >= 2) {
                            creep.rangedMassAttack();
                        } else {
                            creep.rangedAttack(closeFoe);
                        }
                    }

                    // Only heal if no melee attack was performed this tick (ranged attacks are allowed with healing)
                    if (creep.hits < creep.hitsMax && attackResult != OK) {
                        creep.heal(creep);
                    }

                } else if (eCores) {
                    let attackResult = creep.attack(eCores);
                    creep.rangedAttack(eCores);
                    
                    // Only heal if no successful melee attack was performed (ranged attack + heal is allowed)
                    if (attackResult != OK) {
                        if (creep.hits < creep.hitsMax) {
                            creep.heal(creep);
                        } else {
                            var hurtAlly = creep.pos.findInRange(FIND_MY_CREEPS, 3, {
                                filter: (thisCreep) => thisCreep.hits < thisCreep.hitsMax
                            });
                            if (hurtAlly.length > 0) {
                                creep.rangedHeal(hurtAlly[0]);
                            }
                        }
                    }

                    creep.travelTo(eCores, {
                        maxRooms: 1
                    });
                } else if (creep.room.name != creep.memory.destination) {
                    if (targetFlagName.includes("eFarGuard")) {
                        if (!creep.memory.thisPath) {
                            var thisPath = Game.map.findRoute(creep.room.name, creep.memory.destination, {
                                routeCallback(roomName, fromRoomName) {
                                    if (Memory.blockedRooms.indexOf(roomName) > -1) { // avoid this room
                                        return Infinity;
                                    }
                                    return 1;
                                }
                            });
                            var pathArray = [];
                            for (var i in thisPath) {
                                pathArray.push(thisPath[i].room)
                            }
                            creep.memory.thisPath = pathArray;
                        } else if (creep.memory.thisPath.length) {
                            creep.travelTo(new RoomPosition(25, 25, creep.memory.thisPath[0]));
                            if (creep.memory.thisPath[0] == creep.room.name) {
                                creep.memory.thisPath.splice(0, 1);
                                if (creep.memory.thisPath.length == 0) {
                                    creep.memory.thisPath = undefined;
                                }
                            }
                        }
                    } else {
                        creep.travelTo(new RoomPosition(25, 25, creep.memory.destination), {
                            reusePath: 25
                        });
                    }

                    // Only heal when not in combat and traveling
                    if (creep.hits < creep.hitsMax && !hasNearbyEnemies()) {
                        creep.heal(creep);
                    }
                } else if (targetFlag) {
                    // Decorative idle animations
                    if (Game.time % 2 == 0) {
                        creep.say("(=`ﾟ´=)", true);
                    } else {
                        creep.say("(=´ﾟ`=)", true);
                    }
                    
                    // Simplified idle behavior
                    if (creep.hits < creep.hitsMax) {
                        if (!hasNearbyEnemies()) {
                            creep.heal(creep);
                        }
                        if (creep.pos != targetFlag.pos) {
                            creep.travelTo(targetFlag, { maxRooms: 1 });
                        }
                    } else {
                        // Only heal allies if they're nearby - cache search every 5 ticks
                        if (!creep.memory.lastAllyCheck || Game.time - creep.memory.lastAllyCheck >= 5) {
                            creep.memory.hurtAllies = creep.room.find(FIND_MY_CREEPS, {
                                filter: (thisCreep) => thisCreep.hits < thisCreep.hitsMax
                            });
                            creep.memory.lastAllyCheck = Game.time;
                        }
                        
                        if (creep.memory.hurtAllies && creep.memory.hurtAllies.length > 0) {
                            let ally = Game.getObjectById(creep.memory.hurtAllies[0].id);
                            if (ally && ally.hits < ally.hitsMax) {
                                creep.travelTo(ally);
                                creep.heal(ally);
                            }
                        } else if (creep.pos != targetFlag.pos) {
                            creep.travelTo(targetFlag, { maxRooms: 1 });
                        }
                    }

                    // Clean up attack tracking only when needed
                    if (Memory.FarRoomsUnderAttack.indexOf(creep.room.name) != -1) {
                        var UnderAttackPos = Memory.FarRoomsUnderAttack.indexOf(creep.room.name);
                        if (UnderAttackPos >= 0) {
                            Memory.FarRoomsUnderAttack.splice(UnderAttackPos, 1);
                        }
                    }
                }
                break;
            case 'SKAttackGuard':
            case 'SKAttackGuardNearDeath':
                if (!creep.memory.disabledNotify) {
                    creep.notifyWhenAttacked(false);
                    creep.memory.disabledNotify = true;
                }

                if (creep.ticksToLive <= creep.memory.deathWarn || creep.hits < 400) {
                    creep.memory.priority = 'SKAttackGuardNearDeath';
                    creep.room.visual.text("\u2620\u27A1\u2694", creep.pos.x, creep.pos.y, {
                        align: 'left',
                        color: '#7DE3B5'
                    });
                } else {
                    creep.room.visual.text("\u27A1\u2694", creep.pos.x, creep.pos.y, {
                        align: 'left',
                        color: '#7DE3B5'
                    });
                }

                if (!creep.memory.healerID) {
                    var nearbyHealer = creep.pos.findInRange(FIND_MY_CREEPS, 2, {
                        filter: (mCreep) => (mCreep.memory.priority == "SKHealGuard" && mCreep.memory.targetFlag == creep.memory.targetFlag)
                    });
                    if (nearbyHealer.length) {
                        creep.memory.healerID = nearbyHealer[0].id;
                    }
                }

                var closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
                    filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
                });

                var thisHealer = Game.getObjectById(creep.memory.healerID);
                var healerIsNear = false;
                if (thisHealer) {
                    healerIsNear = creep.pos.isNearTo(thisHealer);
                }

                if (!healerIsNear) {
                    if (creep.memory.getOutOfStartRoom) {
                        //Probably in a new room, hold.
                        if (creep.pos.x == 0 || creep.pos.x == 49 || creep.pos.y == 0 || creep.pos.y == 49) {
                            var xTarget = 0;
                            var yTarget = 0;
                            if (creep.pos.x == 0) {
                                xTarget = 2;
                                yTarget = creep.pos.y;
                            } else if (creep.pos.x == 49) {
                                xTarget = 47;
                                yTarget = creep.pos.y;
                            }
                            if (creep.pos.y == 0) {
                                yTarget = 2;
                                xTarget = creep.pos.x;
                            } else if (creep.pos.y == 49) {
                                yTarget = 47;
                                xTarget = creep.pos.x;
                            }
                            creep.travelTo(xTarget, yTarget);
                        }
                    } else {
                        if (Game.flags[creep.memory.targetFlag + "Rally"]) {
                            creep.travelTo(Game.flags[creep.memory.targetFlag + "Rally"]);
                        }
                    }
                } else if (healerIsNear) {
                    creep.memory.getOutOfStartRoom = true;

                    if (Game.flags[creep.memory.targetFlag] && Game.flags[creep.memory.targetFlag].pos.roomName != creep.pos.roomName) {
                        creep.travelTo(new RoomPosition(25, 25, Game.flags[creep.memory.targetFlag].pos.roomName));
                    } else {
                        //In target room
                        if (closeFoe) {
                            creep.travelTo(closeFoe, {
                                maxRooms: 1
                            });
                            creep.attack(closeFoe);
                            creep.memory.targetLair = undefined;
                        } else if (creep.memory.targetLair) {
                            var thisLair = Game.getObjectById(creep.memory.targetLair);
                            if (!creep.isNearTo(thisLair)) {
                                creep.travelTo(thisLair, {
                                    maxRooms: 1
                                });
                            }
                        } else {
                            var SKLairs = creep.room.find(FIND_STRUCTURES, {
                                filter: (structure) => structure.structureType == STRUCTURE_KEEPER_LAIR
                            });
                            if (SKLairs.length) {
                                SKLairs.sort(SKCompare);
                                creep.memory.targetLair = SKLairs[0].id;
                                if (!creep.isNearTo(SKLairs[0])) {
                                    creep.travelTo(SKLairs[0], {
                                        maxRooms: 1
                                    });
                                }
                            }
                        }
                    }
                }
                break;
            case 'SKHealGuard':
            case 'SKHealGuardNearDeath':
                if (!creep.memory.disabledNotify) {
                    creep.notifyWhenAttacked(false);
                    creep.memory.disabledNotify = true;
                }

                if (creep.ticksToLive <= creep.memory.deathWarn || creep.hits < 400) {
                    creep.memory.priority = 'SKHealGuardNearDeath';
                    creep.room.visual.text("\u2620\u27A1\u2694", creep.pos.x, creep.pos.y, {
                        align: 'left',
                        color: '#7DE3B5'
                    });
                } else {
                    creep.room.visual.text("\u27A1\u2694", creep.pos.x, creep.pos.y, {
                        align: 'left',
                        color: '#7DE3B5'
                    });
                }


                var targetAttacker = Game.getObjectById(creep.memory.parentAttacker);
                if (targetAttacker) {
                    if ((creep.pos.x == 0 || creep.pos.x == 49 || creep.pos.y == 0 || creep.pos.y == 49) && targetAttacker.room.name == creep.room.name) {
                        var xTarget = 0;
                        var yTarget = 0;
                        if (creep.pos.x == 0) {
                            xTarget = 2;
                            yTarget = creep.pos.y;
                        } else if (creep.pos.x == 49) {
                            xTarget = 47;
                            yTarget = creep.pos.y;
                        }
                        if (creep.pos.y == 0) {
                            yTarget = 2;
                            xTarget = creep.pos.x;
                        } else if (creep.pos.y == 49) {
                            yTarget = 47;
                            xTarget = creep.pos.x;
                        }

                        creep.travelTo(xTarget, yTarget);
                    } else {
                        if (creep.pos.inRangeTo(targetAttacker, 2)) {
                            creep.move(creep.pos.getDirectionTo(targetAttacker));
                        } else {
                            if (targetAttacker.room.name == creep.room.name) {
                                creep.travelTo(targetAttacker, {
                                    reusePath: 2,
                                    maxRooms: 1
                                });
                            } else {
                                creep.travelTo(targetAttacker, {
                                    reusePath: 0
                                });
                            }
                        }
                    }

                    if (creep.hits < creep.hitsMax - 99) {
                        creep.heal(creep);
                    } else if (targetAttacker.hits < targetAttacker.hitsMax) {
                        if (creep.pos.getRangeTo(targetAttacker) > 1) {
                            creep.rangedHeal(targetAttacker);
                        } else {
                            creep.heal(targetAttacker);
                        }
                    } else {
                        var hurtAlly = creep.pos.findInRange(FIND_MY_CREEPS, 3, {
                            filter: (thisCreep) => thisCreep.hits < thisCreep.hitsMax
                        });
                        if (hurtAlly.length > 0) {
                            if (creep.pos.getRangeTo(hurtAlly[0]) > 1) {
                                creep.rangedHeal(hurtAlly[0]);
                            } else {
                                creep.heal(hurtAlly[0]);
                            }
                        }
                    }
                } else {
                    if (Game.flags[creep.memory.targetFlag + "Rally"]) {
                        creep.travelTo(Game.flags[creep.memory.targetFlag + "Rally"]);
                    }
                    var newTarget = creep.pos.findInRange(FIND_MY_CREEPS, 2, {
                        filter: (mCreep) => (mCreep.memory.priority == "SKAttackGuard")
                    });
                    if (newTarget.length) {
                        creep.memory.parentAttacker = newTarget[0].id;
                    }
                }
                break;
        }
    }
};

function evadeAttacker(creep, evadeRange) {
    var Foe = undefined;

    Foe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, evadeRange, {
        filter: (eCreep) => ((eCreep.getActiveBodyparts(ATTACK) > 0 || eCreep.getActiveBodyparts(RANGED_ATTACK) > 0) && !Memory.whiteList.includes(eCreep.owner.username))
    });

    if (Foe.length) {
        creep.travelTo(Foe[0], {
            range: 8
        }, true);
        creep.attack(Foe[0]);
        return true;
    }

    return false;
}

function attackInvader(creep) {
    var Foe = undefined;
    var closeFoe = undefined;
    var didRanged = false;

    if (_.sum(creep.carry) <= 40) {
        creep.drop(RESOURCE_ENERGY);
    }

    closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
        filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username) && eCreep.owner.username != "Source Keeper")
    });
    Foe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3, {
        filter: (eCreep) => ((eCreep.getActiveBodyparts(ATTACK) > 0 || eCreep.getActiveBodyparts(RANGED_ATTACK) > 0 || eCreep.getActiveBodyparts(HEAL) > 0) && !Memory.whiteList.includes(eCreep.owner.username))
    });
    if (Foe.length > 1) {
        Foe.sort(targetHeal);
        creep.rangedMassAttack();
        didRanged = true;
    } else if (Foe.length) {
        if (creep.rangedAttack(Foe[0]) == OK) {
            didRanged = true;
        }
    } else {
        if (creep.rangedAttack(closeFoe) == OK) {
            didRanged = true;
        }
    }

    if (creep.getActiveBodyparts(HEAL) > 0) {
        if (creep.hits < creep.hitsMax) {
            creep.heal(creep);
        } else {
            var hurtAlly = creep.pos.findInRange(FIND_MY_CREEPS, 3, {
                filter: (thisCreep) => thisCreep.hits < thisCreep.hitsMax
            });
            if (hurtAlly.length > 0) {
                if (creep.pos.getRangeTo(hurtAlly[0]) > 1 && !didRanged) {
                    creep.rangedHeal(hurtAlly[0]);
                } else {
                    creep.heal(hurtAlly[0]);
                }
            }
        }
    }

    var SKCheck = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3, {
        filter: (eCreep) => (eCreep.owner.username == "Source Keeper")
    });
    if (SKCheck.length) {
        var foeDirection = creep.pos.getDirectionTo(SKCheck[0]);
        var y = 0;
        var x = 0;
        switch (foeDirection) {
            case TOP:
                y = 5;
                break;
            case TOP_RIGHT:
                y = 5;
                x = -5;
                break;
            case RIGHT:
                x = -5;
                break;
            case BOTTOM_RIGHT:
                y = -5;
                x = -5;
                break;
            case BOTTOM:
                y = -5;
                break;
            case BOTTOM_LEFT:
                y = -5;
                x = 5;
                break;
            case LEFT:
                x = 5;
                break;
            case TOP_LEFT:
                y = 5;
                x = 5;
                break;
        }
        x = creep.pos.x + x;
        y = creep.pos.y + y;
        if (x < 0) {
            x = 0;
            if (y < 25 && y > 0) {
                y = y - 1;
            } else if (y < 49) {
                y = y + 1;
            }
        } else if (x > 49) {
            x = 49;
            if (y < 25 && y > 0) {
                y = y - 1;
            } else if (y < 49) {
                y = y + 1;
            }
        }
        if (y < 0) {
            y = 0;
            if (x < 25 && x > 0) {
                x = x - 1;
            } else if (x < 49) {
                x = x + 1;
            }
        } else if (y > 49) {
            y = 49;
            if (x < 25 && x > 0) {
                x = x - 1;
            } else if (x < 49) {
                x = x + 1;
            }
        }
        creep.moveTo(x, y, {
            ignoreRoads: true
        });
        return true;
    } else if (closeFoe) {
        if (Foe.length) {
            creep.travelTo(Foe[0], {
                maxRooms: 1
            });
        } else {
            creep.travelTo(closeFoe, {
                maxRooms: 1
            });
        }

        return true;
    } else {
        return false;
    }
}

function targetAttacker(a, b) {
    if (a.getActiveBodyparts(ATTACK) > b.getActiveBodyparts(ATTACK))
        return -1;
    if (a.getActiveBodyparts(ATTACK) < b.getActiveBodyparts(ATTACK))
        return 1;
    return 0;
}

function targetHeal(a, b) {
    if (a.getActiveBodyparts(HEAL) > b.getActiveBodyparts(HEAL))
        return -1;
    if (a.getActiveBodyparts(HEAL) < b.getActiveBodyparts(HEAL))
        return 1;
    return 0;
}

function SKCompare(a, b) {
    if (a.ticksToSpawn < b.ticksToSpawn)
        return -1;
    if (a.ticksToSpawn > b.ticksToSpawn)
        return 1;
    return 0;
}

function repairCompare(a, b) {
    if (a.hits < b.hits)
        return -1;
    if (a.hits > b.hits)
        return 1;
    return 0;
}

function determineThreat(thisCreep, myself, attackParts) {
    let foeAttack = 0;
    if (myself.pos.getRangeTo(thisCreep) <= 3) {
        thisCreep.body.forEach(function(thisPart) {
            if (thisPart.type == ATTACK) {
                foeAttack = foeAttack + 1;
            }
        });
        if (foeAttack > attackParts) {
            return true;
        }
    }
    return false;
}

module.exports = creep_farMining;