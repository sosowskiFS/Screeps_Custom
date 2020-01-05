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

                //var isEvading = evadeAttacker(creep, 4);

                //if (!isEvading) {
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
                    if (creep.reserveController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(creep.room.controller, {
                            ignoreRoads: true
                        });
                    } else {
                        if (creep.room.controller.sign && creep.room.controller.sign.username != "Montblanc") {
                            creep.signController(creep.room.controller, "\u300C\u306B\u3083\u30FC\u300D(^\u30FB\u03C9\u30FB^ )");
                        } else if (!creep.room.controller.sign) {
                            creep.signController(creep.room.controller, "\u300C\u306B\u3083\u30FC\u300D(^\u30FB\u03C9\u30FB^ )");
                        }
                    }
                }
                //}

                break;
            case 'farMiner':
            case 'farMinerNearDeath':
                if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'farMinerNearDeath') {
                    creep.memory.priority = 'farMinerNearDeath';
                }

                var hostiles = [];

                if (creep.hits < creep.hitsMax) {
                    hostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3, {
                        filter: (creep) => (creep.getActiveBodyparts(WORK) > 0 || creep.getActiveBodyparts(CARRY) > 0 || creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0 || creep.getActiveBodyparts(HEAL) > 0) || (creep.hits <= 500)
                    });
                    if (creep.getActiveBodyparts(HEAL) > 0) {
                        creep.heal(creep);
                    }
                }

                if (creep.hits < 400 && Game.flags[creep.memory.targetFlag].room.name == creep.room.name) {
                    //Determine if attacker is player, if so, delete flag.
                    if (hostiles.length > 0 && hostiles[0].owner.username != 'Invader' && hostiles[0].owner.username != 'Source Keeper' && Game.flags[creep.memory.targetFlag]) {
                        Game.notify(creep.memory.tragetFlag + ' was removed due to an attack by ' + hostiles[0].owner.username);
                        if (!Memory.warMode) {
                            Memory.warMode = true;
                            Game.notify('War mode has been enabled.');
                        }
                        Game.flags[creep.memory.targetFlag].remove();
                    } else if (hostiles.length > 0 && hostiles[0].owner.username == 'Source Keeper') {
                        Game.notify(creep.memory.targetFlag + ' died early. TTL ' + creep.ticksToLive);
                    }
                }


                var isEvading = false;

                if (creep.getActiveBodyparts(RANGED_ATTACK) > 0) {
                    //Memory.SKRoomsUnderAttack
                    var Foe = [];

                    if (Game.time % 5 == 0) {
                        Foe = creep.room.find(FIND_HOSTILE_CREEPS, {
                            filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username) && eCreep.owner.username != "Source Keeper")
                        });

                        if (Foe.length && Memory.SKRoomsUnderAttack.indexOf(creep.room.name) == -1) {
                            Memory.SKRoomsUnderAttack.push(creep.room.name);
                        } else if (!Foe.length && Memory.SKRoomsUnderAttack.indexOf(creep.room.name) != -1) {
                            var UnderAttackPos = Memory.SKRoomsUnderAttack.indexOf(creep.room.name);
                            if (UnderAttackPos >= 0) {
                                Memory.SKRoomsUnderAttack.splice(UnderAttackPos, 1);
                            }
                        }
                    }

                    if (Memory.SKRoomsUnderAttack.indexOf(creep.room.name) != -1) {
                        isEvading = attackInvader(creep);
                    } else {
                        isEvading = evadeAttacker(creep, 2);
                    }
                }

                if (!isEvading) {
                    if (creep.room.name != creep.memory.destination) {
                        if (Game.flags[creep.memory.targetFlag + "Here"] && Game.flags[creep.memory.targetFlag + "Here"].pos) {
                            creep.travelTo(Game.flags[creep.memory.targetFlag + "Here"]);
                        } else if (Game.flags[creep.memory.targetFlag] && Game.flags[creep.memory.targetFlag].pos) {
                            creep.travelTo(Game.flags[creep.memory.targetFlag]);
                        } else {
                            creep.travelTo(new RoomPosition(25, 25, creep.memory.destination));
                        }
                    } else {
                        if (creep.room.controller && creep.room.controller.reservation && (creep.room.name == creep.memory.destination)) {
                            if (creep.room.controller.reservation.ticksToEnd <= 1000 && !Memory.FarClaimerNeeded[creep.room.name]) {
                                Memory.FarClaimerNeeded[creep.room.name] = true;
                            } else if (Memory.FarClaimerNeeded[creep.room.name]) {
                                Memory.FarClaimerNeeded[creep.room.name] = false;
                            }
                        } else if (creep.room.name == creep.memory.destination && creep.room.controller && !Memory.FarClaimerNeeded[creep.room.name]) {
                            Memory.FarClaimerNeeded[creep.room.name] = true;
                        } else if (!creep.room.controller && Memory.FarClaimerNeeded[creep.room.name]) {
                            Memory.FarClaimerNeeded[creep.room.name] = false;
                        }

                        if (Game.flags[creep.room.name + "SKRoom"] && !Memory.SKMineralTimers[creep.room.name]) {
                            Memory.SKMineralTimers[creep.room.name] = 0;
                        }

                        var mineTarget = undefined;
                        var thisUnit = undefined;

                        if (creep.memory.storageUnit) {
                            thisUnit = Game.getObjectById(creep.memory.storageUnit);
                        }

                        if (creep.memory.mineSource) {
                            mineTarget = Game.getObjectById(creep.memory.mineSource);
                            var StorageOK = true;
                            if (thisUnit && thisUnit.store.getFreeCapacity() <= 0) {
                                StorageOK = false;
                            }
                            if (mineTarget && _.sum(creep.carry) <= 40 && mineTarget.energy > 0 && StorageOK) {
                                creep.harvest(mineTarget);
                                if (Game.flags[creep.memory.targetFlag + "Here"] && !creep.pos.isNearTo(mineTarget)) {
                                    creep.travelTo(Game.flags[creep.memory.targetFlag + "Here"]);
                                } else if (!creep.pos.isNearTo(mineTarget)) {
                                    creep.travelTo(Game.flags[creep.memory.targetFlag]);
                                }
                            } else if (mineTarget && Game.flags[creep.memory.targetFlag + "Here"] && !creep.pos.isNearTo(mineTarget)) {
                                creep.travelTo(Game.flags[creep.memory.targetFlag + "Here"]);
                            } else if (mineTarget && !creep.pos.isNearTo(mineTarget)) {
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

                        if (creep.memory.storageUnit) {
                            if (thisUnit) {
                                if (thisUnit.hits < thisUnit.hitsMax && hostiles.length == 0) {
                                    creep.repair(thisUnit);
                                } else if (creep.carry.energy >= 36) {
                                    if (creep.transfer(thisUnit, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                        creep.travelTo(thisUnit);
                                    }
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
                                                //Math.floor(Math.random() * 2) - 1;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                break;
            case 'farMineralMiner':
                if ((_.sum(creep.carry) >= creep.carryCapacity || (_.sum(creep.carry) > 0 && creep.ticksToLive <= 200)) && !creep.memory.storing) {
                    creep.memory.storing = true;
                } else if (_.sum(creep.carry) == 0 && creep.memory.storing) {
                    creep.memory.storing = false;
                }

                if (!creep.memory.storing) {
                    //in farRoom, mine mineral
                    if (creep.memory.mineralTarget) {
                        var thisMineral = Game.getObjectById(creep.memory.mineralTarget);
                        if (thisMineral) {
                            if (thisMineral.ticksToRegeneration) {
                                if (Memory.SKMineralTimers[creep.room.name] == 0) {
                                    Memory.SKMineralTimers[creep.room.name] = thisMineral.ticksToRegeneration;
                                }
                                creep.memory.storing = true;
                            } else {
                                if (!creep.pos.isNearTo(thisMineral)) {
                                    creep.travelTo(thisMineral);
                                } else {
                                    if (Game.time % 6 == 0 && creep.harvest(thisMineral) == ERR_NOT_IN_RANGE) {
                                        creep.travelTo(thisMineral);
                                    }
                                }
                            }
                        } else {
                            //Target isn't visible, go to room
                            creep.travelTo(new RoomPosition(25, 25, creep.memory.destination));
                        }
                    } else if (creep.room.name == creep.memory.destination) {
                        //Find mineral target
                        var mineralLocations = creep.room.find(FIND_MINERALS);
                        if (mineralLocations.length) {
                            creep.memory.mineralTarget = mineralLocations[0].id;
                            creep.travelTo(mineralLocations[0]);
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
                evadeAttacker(creep, 2);
                break;
            case 'farGuard':
            case 'farGuardNearDeath':
                if (!creep.memory.disabledNotify) {
                    creep.notifyWhenAttacked(false);
                    creep.memory.disabledNotify = true;
                }

                if ((creep.ticksToLive <= creep.memory.deathWarn || creep.hits < 400) && creep.memory.priority != 'farGuardNearDeath') {
                    creep.memory.priority = 'farGuardNearDeath';
                }

                //Recall guard into home room if it's under attack
                if (Memory.roomsUnderAttack.indexOf(creep.memory.homeRoom) > -1 && Memory.attackDuration >= 100 && Game.flags[creep.memory.targetFlag] && Game.flags[creep.memory.targetFlag].room && !Game.flags[creep.memory.targetFlag + "TEMP"]) {
                    Game.flags[creep.memory.targetFlag].pos.createFlag(creep.memory.targetFlag + "TEMP");
                    Game.flags[creep.memory.targetFlag].remove();
                    var homePosition = new RoomPosition(25, 25, creep.memory.homeRoom);
                    homePosition.createFlag(creep.memory.targetFlag);
                } else if (Memory.roomsUnderAttack.indexOf(creep.memory.homeRoom) > -1 && Memory.attackDuration >= 100 && !Game.flags[creep.memory.targetFlag] && Game.flags[creep.memory.targetFlag + "TEMP"]) {
                    var homePosition = new RoomPosition(25, 25, creep.memory.homeRoom);
                    homePosition.createFlag(creep.memory.targetFlag);
                } else if (Game.flags[creep.memory.targetFlag + "TEMP"] && Memory.roomsUnderAttack.indexOf(creep.memory.homeRoom) == -1) {
                    if (Game.flags[creep.memory.targetFlag] && Game.flags[creep.memory.targetFlag + "TEMP"]) {
                        if (Game.flags[creep.memory.targetFlag].pos.roomName == Game.flags[creep.memory.targetFlag + "TEMP"].pos.roomName && Game.flags[creep.memory.targetFlag].pos.x == Game.flags[creep.memory.targetFlag + "TEMP"].pos.x && Game.flags[creep.memory.targetFlag].pos.y == Game.flags[creep.memory.targetFlag + "TEMP"].pos.y) {
                            Game.flags[creep.memory.targetFlag + "TEMP"].remove();
                        } else {
                            Game.flags[creep.memory.targetFlag].remove();
                        }
                    } else if (!Game.flags[creep.memory.targetFlag] && Game.flags[creep.memory.targetFlag + "TEMP"]) {
                        try {
                            Game.flags[creep.memory.targetFlag + "TEMP"].pos.createFlag(creep.memory.targetFlag);
                        } catch (e) {

                        }
                    }
                }

                if (Game.flags[creep.memory.targetFlag]) {
                    if (Game.flags[creep.memory.targetFlag].pos.roomName != creep.memory.destination) {
                        creep.memory.destination = Game.flags[creep.memory.targetFlag].pos.roomName;
                    }
                } else if (Game.flags[creep.memory.targetFlag + "TEMP"]) {
                    if (Game.flags[creep.memory.targetFlag + "TEMP"].pos.roomName != creep.memory.destination) {
                        creep.memory.destination = Game.flags[creep.memory.targetFlag + "TEMP"].pos.roomName;
                    }
                }

                var Foe = [];
                var closeFoe = undefined;
                let eCores = undefined;
                if (Game.flags[creep.room.name + "SKRoom"]) {
                    Foe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 40, {
                        filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username) && eCreep.owner.username != "Source Keeper")
                    });
                    closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
                        filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username) && (eCreep.owner.username != "Source Keeper" || eCreep.hits < eCreep.hitsMax))
                    });
                } else {
                    Foe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 40, {
                        filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
                    });
                    closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
                        filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
                    });
                    if (creep.room.controller && creep.room.controller.reservation && creep.room.controller.reservation.username == 'Invader') {
                        eCores = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                            filter: (eStruct) => (!Memory.whiteList.includes(eStruct.owner.username))
                        })
                    }
                }

                if (Foe.length) {
                    Foe.sort(targetAttacker);
                }

                if (creep.room.controller && creep.room.controller.owner && creep.room.controller.owner.username != "Montblanc" && creep.room.name != creep.memory.destination) {
                    creep.travelTo(new RoomPosition(25, 25, creep.memory.destination), {
                        reusePath: 50
                    });
                    if (creep.hits < creep.hitsMax) {
                        creep.heal(creep);
                    }
                } else if (Foe.length) {
                    let rangeToFoe = creep.pos.getRangeTo(closeFoe);
                    let rangedParts = 0;
                    let attackParts = 0;
                    creep.body.forEach(function(thisPart) {
                        if (thisPart.type == RANGED_ATTACK) {
                            rangedParts = rangedParts + 1;
                        } else if (thisPart.type == ATTACK) {
                            attackParts = attackParts + 1;
                        }
                    });

                    creep.say("\uFF08\u0E05\uFF3E\u30FB\uFECC\u30FB\uFF3E\uFF09\u0E05", true);
                    let closeRangeResult = "";
                    let attackResult = creep.attack(closeFoe);

                    //Loop through everything nearby and determine if you need to run
                    let thisThreat = undefined;
                    for (let thisFoe in Foe) {
                        thisThreat = determineThreat(thisFoe, creep, attackParts)
                        if (thisThreat) {
                            break;
                        }
                    }

                    if (thisThreat) {
                        //Back up
                        creep.travelTo(thisThreat, {
                            maxRooms: 1,
                            range: 3,
                            movingTarget: true
                        }, true);

                        closeRangeResult = creep.rangedAttack(closeFoe);
                    } else {
                        creep.travelTo(closeFoe, {
                            maxRooms: 1,
                            movingTarget: true
                        });

                        if (Foe.length >= 2) {
                            creep.rangedMassAttack();
                        } else {
                            closeRangeResult = creep.rangedAttack(closeFoe);
                        }
                    }

                    if (attackResult != OK) {
                        if (creep.hits < creep.hitsMax) {
                            creep.heal(creep);
                        } else {
                            var hurtAlly = creep.pos.findInRange(FIND_MY_CREEPS, 3, {
                                filter: (thisCreep) => thisCreep.hits < thisCreep.hitsMax
                            });
                            if (hurtAlly.length > 0) {
                                if (closeRangeResult != OK) {
                                    creep.rangedHeal(hurtAlly[0]);
                                }
                                creep.heal(hurtAlly[0]);
                            }
                        }
                    }

                } else if (eCores) {
                    let attackResult = creep.attack(eCores);
                    creep.rangedAttack(eCores);
                    if (attackResult != OK) {
                        if (creep.hits < creep.hitsMax) {
                            creep.heal(creep);
                        } else {
                            var hurtAlly = creep.pos.findInRange(FIND_MY_CREEPS, 3, {
                                filter: (thisCreep) => thisCreep.hits < thisCreep.hitsMax
                            });
                            if (hurtAlly.length > 0) {
                                if (closeRangeResult != OK) {
                                    creep.rangedHeal(hurtAlly[0]);
                                }
                                creep.heal(hurtAlly[0]);
                            }
                        }
                    }

                    creep.travelTo(eCores, {
                        maxRooms: 1
                    });
                } else if (creep.room.name != creep.memory.destination) {
                    if (creep.memory.targetFlag.includes("eFarGuard")) {
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

                    if (creep.hits < creep.hitsMax) {
                        creep.heal(creep);
                    }
                } else if (Game.flags[creep.memory.targetFlag]) {
                    if (Game.time % 2 == 0) {
                        creep.say("(=\uFF40\uFECC\u00B4=)", true);
                    } else {
                        creep.say("(=\u00B4\uFECC\uFF40=)", true);
                    }
                    var closeRangeResult = "";
                    if (closeFoe) {
                        closeRangeResult = creep.rangedAttack(closeFoe);
                    }
                    if (creep.hits < creep.hitsMax) {
                        creep.heal(creep);
                        if (creep.pos != Game.flags[creep.memory.targetFlag].pos) {
                            creep.travelTo(Game.flags[creep.memory.targetFlag], {
                                maxRooms: 1
                            });
                        }
                    } else {
                        var hurtAlly = creep.room.find(FIND_MY_CREEPS, {
                            filter: (thisCreep) => thisCreep.hits < thisCreep.hitsMax
                        });
                        if (hurtAlly.length > 0) {
                            creep.travelTo(hurtAlly[0]);
                            if (closeRangeResult != OK) {
                                creep.rangedHeal(hurtAlly[0]);
                            }
                            creep.heal(hurtAlly[0]);
                        } else if (creep.pos != Game.flags[creep.memory.targetFlag].pos) {
                            creep.travelTo(Game.flags[creep.memory.targetFlag], {
                                maxRooms: 1
                            });
                        }
                    }

                    if (Memory.FarRoomsUnderAttack.indexOf(creep.room.name) != -1) {
                        var UnderAttackPos = Memory.FarRoomsUnderAttack.indexOf(creep.room.name);
                        if (UnderAttackPos >= 0) {
                            Memory.FarRoomsUnderAttack.splice(UnderAttackPos, 1);
                        }
                    }
                    if (creep.hits < creep.hitsMax) {
                        creep.heal(creep);
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
    var closeFoe = undefined;
    var didRanged = false;

    closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
        filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
    });
    if (creep.getActiveBodyparts(RANGED_ATTACK) > 0) {
        Foe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, evadeRange, {
            filter: (eCreep) => ((eCreep.getActiveBodyparts(ATTACK) > 0 || eCreep.getActiveBodyparts(RANGED_ATTACK) > 0 || eCreep.getActiveBodyparts(HEAL) > 0) && !Memory.whiteList.includes(eCreep.owner.username))
        });
        if (Foe.length > 1) {
            creep.rangedMassAttack();
            didRanged = true;
        } else if (closeFoe) {
            if (creep.rangedAttack(closeFoe) == OK) {
                didRanged = true;
            }
        }
    } else {
        Foe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, evadeRange, {
            filter: (eCreep) => ((eCreep.getActiveBodyparts(ATTACK) > 0 || eCreep.getActiveBodyparts(RANGED_ATTACK) > 0) && !Memory.whiteList.includes(eCreep.owner.username))
        });
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

    if (closeFoe && Memory.FarRoomsUnderAttack.indexOf(creep.room.name) == -1) {
        Memory.FarRoomsUnderAttack.push(creep.room.name);
    }

    if (Foe.length) {
        creep.memory.evadingUntil = Game.time + 10;
        if (!closeFoe) {
            closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
                filter: (eCreep) => ((eCreep.getActiveBodyparts(ATTACK) > 0 || eCreep.getActiveBodyparts(RANGED_ATTACK) > 0) && !Memory.whiteList.includes(eCreep.owner.username))
            });
        }
        var foeDirection = creep.pos.getDirectionTo(closeFoe);
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
    } else if (!closeFoe && Memory.FarRoomsUnderAttack.indexOf(creep.room.name) != -1) {
        var UnderAttackPos = Memory.FarRoomsUnderAttack.indexOf(creep.room.name);
        if (UnderAttackPos >= 0) {
            Memory.FarRoomsUnderAttack.splice(UnderAttackPos, 1);
        }
        return false;
    }

    return didRanged;
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
        if (foeAttack >= attackParts) {
            return thisCreep;
        }
    }
    return undefined;
}

module.exports = creep_farMining;