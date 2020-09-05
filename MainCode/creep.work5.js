var creep_work5 = {

    /** @param {Creep} creep **/
    run: function(creep) {

        /*if (creep.carry.energy > 0 && creep.memory.priority != 'miner' && creep.memory.priority != 'minerNearDeath') {
            //All creeps check for road under them and repair if needed.
            var someStructure = creep.pos.lookFor(LOOK_STRUCTURES);
            if (someStructure.length && (someStructure[0].hitsMax - someStructure[0].hits >= 600) && someStructure[0].structureType == STRUCTURE_ROAD) {
                creep.repair(someStructure[0]);
            }
        }*/

        switch (creep.memory.priority) {
            case 'mule':
            case 'muleNearDeath':
                if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'muleNearDeath') {
                    creep.memory.priority = 'muleNearDeath';
                }

                if (_.sum(creep.carry) <= 15) {
                    creep.memory.structureTarget = undefined;
                    let storageTarget = creep.room.storage;
                    if (creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 50000 && creep.room.terminal.store[RESOURCE_ENERGY] > 0) {
                        storageTarget = creep.room.terminal;
                    } else if (creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 250000 && creep.room.terminal.store[RESOURCE_ENERGY] > 31000) {
                        storageTarget = creep.room.terminal;
                    }
                    if (storageTarget) {
                        if (storageTarget.store[RESOURCE_ENERGY] >= 50) {
                            //Get from container
                            if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(storageTarget, {
                                    maxRooms: 1
                                });
                            }
                        } else {
                            var spawnTarget = Game.getObjectById(creep.memory.fromSpawn);
                            if (spawnTarget) {
                                if (!creep.pos.isNearTo(spawnTarget)) {
                                    creep.travelTo(spawnTarget, {
                                        maxRooms: 1
                                    });
                                }
                            }
                        }
                    }
                } else {
                    if (creep.carry[RESOURCE_ENERGY] == 0) {
                        if (creep.room.terminal) {
                            var currentlyCarrying = _.findKey(creep.carry);
                            if (creep.transfer(creep.room.terminal, currentlyCarrying) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(creep.room.terminal, {
                                    maxRooms: 1
                                });
                            }
                        } else if (!creep.room.terminal && creep.room.storage) {
                            var currentlyCarrying = _.findKey(creep.carry);
                            if (creep.transfer(creep.room.storage, currentlyCarrying) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(creep.room.storage, {
                                    maxRooms: 1
                                });
                            }
                        }
                    } else {
                        var savedTarget = Game.getObjectById(creep.memory.structureTarget)
                        var getNewStructure = false;
                        if (savedTarget) {
                            if (creep.build(savedTarget) == ERR_INVALID_TARGET) {
                                //Only other blocker is build.
                                creep.repair(savedTarget);

                                if (savedTarget.structureType != STRUCTURE_CONTAINER && savedTarget.structureType != STRUCTURE_STORAGE && savedTarget.structureType != STRUCTURE_CONTROLLER) {
                                    //Storing in spawn/extension/tower/link
                                    if (creep.transfer(savedTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE && savedTarget.energy < savedTarget.energyCapacity) {
                                        creep.travelTo(savedTarget, {
                                            maxRooms: 1
                                        });
                                    } else {
                                        //assumed OK, drop target
                                        creep.memory.structureTarget = undefined;
                                        getNewStructure = true;
                                    }
                                } else {
                                    //Upgrading controller
                                    if (Memory.linkList[creep.room.name].length > 1) {
                                        var upgraderLink = Game.getObjectById(Memory.linkList[creep.room.name][1]);
                                        if (upgraderLink && upgraderLink.energy < 100) {
                                            if (creep.transfer(upgraderLink, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                                creep.travelTo(upgraderLink, {
                                                    maxRooms: 1
                                                });
                                            }
                                        } else if (creep.upgradeController(savedTarget) == ERR_NOT_IN_RANGE) {
                                            if (Game.flags[creep.room.name + "Controller"]) {
                                                creep.travelTo(Game.flags[creep.room.name + "Controller"], {
                                                    maxRooms: 1
                                                });
                                            } else {
                                                creep.travelTo(savedTarget, {
                                                    maxRooms: 1
                                                });
                                            }
                                        }
                                    }
                                }
                            } else {
                                let bResult = creep.build(savedTarget);
                                if (bResult == ERR_NOT_IN_RANGE) {
                                    creep.travelTo(savedTarget, {
                                        maxRooms: 1
                                    });
                                } else if (bResult != OK) {
                                    creep.memory.structureTarget = undefined;
                                } else if (savedTarget.structureType == STRUCTURE_RAMPART) {
                                    //Become a repair drone
                                    creep.memory.priority = 'repair';
                                    creep.memory.previousPriority = 'mule';
                                    Memory.repairTarget[creep.room.name] = undefined;
                                }
                            }
                        } else {
                            creep.memory.structureTarget = undefined;
                        }
                        //Immediately find a new target if previous transfer worked
                        if (!creep.memory.structureTarget) {
                            var targets = undefined;
                            if (Memory.warMode) {
                                if (getNewStructure) {
                                    targets = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                                        filter: (structure) => {
                                            return (structure.structureType == STRUCTURE_EXTENSION ||
                                                structure.structureType == STRUCTURE_SPAWN ||
                                                structure.structureType == STRUCTURE_LAB) && structure.energy < structure.energyCapacity && structure.id != savedTarget.id;
                                        }
                                    });
                                } else {
                                    targets = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                                        filter: (structure) => {
                                            return (structure.structureType == STRUCTURE_EXTENSION ||
                                                structure.structureType == STRUCTURE_SPAWN ||
                                                structure.structureType == STRUCTURE_LAB) && structure.energy < structure.energyCapacity;
                                        }
                                    });
                                }
                            } else {
                                if (getNewStructure) {
                                    targets = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                                        filter: (structure) => {
                                            return (structure.structureType == STRUCTURE_EXTENSION ||
                                                structure.structureType == STRUCTURE_SPAWN ||
                                                structure.structureType == STRUCTURE_LAB) && structure.energy < structure.energyCapacity && structure.id != savedTarget.id;
                                        }
                                    });
                                } else {
                                    targets = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                                        filter: (structure) => {
                                            return (structure.structureType == STRUCTURE_EXTENSION ||
                                                structure.structureType == STRUCTURE_SPAWN ||
                                                structure.structureType == STRUCTURE_LAB) && structure.energy < structure.energyCapacity;
                                        }
                                    });
                                }
                            }

                            if (targets) {
                                creep.memory.structureTarget = targets.id;
                                if (getNewStructure) {
                                    creep.travelTo(targets, {
                                        maxRooms: 1
                                    });
                                } else if (creep.transfer(targets, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                    creep.travelTo(targets, {
                                        maxRooms: 1
                                    });
                                } else {
                                    creep.memory.structureTarget = undefined;
                                }
                            } else {
                                //Store in terminal
                                let terminalTarget = Game.getObjectById(creep.memory.terminalID)
                                if (terminalTarget) {
                                    let targetEnergy = 0;
                                    if (creep.room.storage) {
                                        if (creep.room.storage.store[RESOURCE_ENERGY] >= 275000) {
                                            targetEnergy = 60000;
                                        } else if (creep.room.storage.store[RESOURCE_ENERGY] >= 50000) {
                                            targetEnergy = 30000;
                                        }
                                    }
                                    if (terminalTarget.store[RESOURCE_ENERGY] < targetEnergy && terminalTarget.store.getFreeCapacity() > 5000) {
                                        creep.memory.structureTarget = terminalTarget.id;
                                        if (creep.transfer(terminalTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                            creep.travelTo(terminalTarget, {
                                                maxRooms: 1
                                            });
                                        }
                                    } else {
                                        terminalTarget = undefined;
                                    }
                                }

                                if (!terminalTarget) {
                                    //Store in factory
                                    let factoryTarget = undefined;
                                    if (Memory.factoryList[creep.room.name]) {
                                        factoryTarget = Game.getObjectById(Memory.factoryList[creep.room.name][0]);
                                    }
                                    if (factoryTarget && factoryTarget.store[RESOURCE_ENERGY] < 10000) {
                                        creep.memory.structureTarget = Memory.factoryList[creep.room.name][0];
                                        if (creep.transfer(factoryTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                            creep.travelTo(factoryTarget, {
                                                maxRooms: 1
                                            });
                                        }
                                    } else {
                                        factoryTarget = undefined;
                                    }

                                    if (!factoryTarget) {
                                        var targets2;
                                        if (creep.room.controller.level == 8) {
                                            targets2 = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                                                filter: (structure) => {
                                                    return (structure.structureType == STRUCTURE_POWER_SPAWN ||
                                                        structure.structureType == STRUCTURE_NUKER) && structure.energy < structure.energyCapacity;
                                                }
                                            });
                                        }
                                        if (targets2) {
                                            creep.memory.structureTarget = targets2.id;
                                            if (creep.transfer(targets2, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                                creep.travelTo(targets2, {
                                                    maxRooms: 1
                                                });
                                            } else {
                                                creep.memory.structureTarget = undefined;
                                            }
                                        } else {
                                            //Build
                                            targets2 = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
                                            if (targets2) {
                                                creep.memory.structureTarget = targets2.id;
                                                let buildResult = creep.build(targets2)
                                                if (buildResult == ERR_NOT_IN_RANGE) {
                                                    creep.travelTo(targets2, {
                                                        maxRooms: 1
                                                    });
                                                } else if (buildResult == ERR_NO_BODYPART) {
                                                    creep.suicide();
                                                } else if (targets2.structureType == STRUCTURE_RAMPART && buildResult == OK) {
                                                    //Change job to repair, reset room repair target.
                                                    creep.memory.priority = 'repair';
                                                    creep.memory.previousPriority = 'mule';
                                                    Memory.repairTarget[creep.room.name] = undefined;
                                                }
                                            } else {
                                                //Upgrade
                                                if (creep.room.controller.level == 8) {
                                                    //Check for nearby link and fill it if possible.
                                                    if (Memory.linkList[creep.room.name].length > 1) {
                                                        var upgraderLink = Game.getObjectById(Memory.linkList[creep.room.name][1]);
                                                        if (upgraderLink && upgraderLink.energy < 200) {
                                                            creep.memory.structureTarget = upgraderLink.id;
                                                            if (creep.transfer(upgraderLink, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                                                creep.travelTo(upgraderLink, {
                                                                    maxRooms: 1
                                                                });
                                                            }
                                                        } else {
                                                            //Turn into a repair worker temporarily
                                                            creep.memory.priority = 'repair';
                                                            creep.memory.previousPriority = 'mule';
                                                        }
                                                    }
                                                } else {
                                                    creep.memory.structureTarget = creep.room.controller.id;
                                                    if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                                                        if (Game.flags[creep.room.name + "Controller"]) {
                                                            creep.travelTo(Game.flags[creep.room.name + "Controller"], {
                                                                maxRooms: 1
                                                            });
                                                        } else {
                                                            creep.travelTo(creep.room.controller, {
                                                                maxRooms: 1
                                                            });
                                                        }
                                                    } else if (creep.upgradeController(creep.room.controller) == ERR_NO_BODYPART) {
                                                        creep.suicide();
                                                    }
                                                }
                                            } //targets2
                                        } //FactoryTarget
                                    } //TerminalTarget
                                } //targets
                            } //structureTarget
                        } //carry energy check
                    } //storage target check
                } //carry check
                break;
            case 'distributor':
            case 'distributorNearDeath':
                if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'distributorNearDeath') {
                    creep.memory.priority = 'distributorNearDeath';
                }

                if (creep.memory.previousPriority == 'labWorker' && Game.time >= creep.memory.nextResourceCheck && Game.flags[creep.memory.primaryFlag] && creep.memory.lab4) {
                    DoResourceCheck(creep);
                }

                if (_.sum(creep.carry) <= 0) {
                    if (creep.memory.previousPriority == 'labWorker' && creep.memory.hasDistributed) {
                        creep.memory.priority = 'labWorker';
                        break;
                    }
                    creep.memory.structureTarget = undefined;
                    //Get from storage
                    //Check 4th link first just in case
                    var linkTarget = undefined;
                    if (creep.memory.linkSource) {
                        linkTarget = Game.getObjectById(creep.memory.linkSource)
                    }
                    if (linkTarget && linkTarget.energy >= 200) {
                        if (creep.withdraw(linkTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(linkTarget, {
                                ignoreRoads: true
                            });
                        }
                    } else {
                        var storageTarget = creep.room.storage;
                        if (creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 50000 && creep.room.terminal.store[RESOURCE_ENERGY] > 0) {
                            storageTarget = creep.room.terminal;
                        } else if (creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 250000 && creep.room.terminal.store[RESOURCE_ENERGY] > 31000) {
                            storageTarget = creep.room.terminal;
                        }
                        if (storageTarget) {
                            if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(storageTarget, {
                                    ignoreRoads: true
                                });
                            }
                        }
                    }
                } else if (creep.room.energyAvailable < creep.room.energyCapacityAvailable) {
                    if (creep.memory.previousPriority == 'labWorker' && !creep.memory.hasDistributed) {
                        creep.memory.hasDistributed = true;
                    }
                    var savedTarget = Game.getObjectById(creep.memory.structureTarget);
                    var getNewStructure = false;
                    if (savedTarget && savedTarget.energy < savedTarget.energyCapacity) {
                        if (creep.transfer(savedTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(savedTarget);
                        } else {
                            getNewStructure = true;
                            creep.memory.structureTarget = undefined;
                        }
                    } else if (savedTarget) {
                        getNewStructure = true;
                        creep.memory.structureTarget = undefined;
                    }
                    if (!creep.memory.structureTarget) {
                        var target = undefined;
                        if (getNewStructure) {
                            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                                filter: (structure) => {
                                    return (structure.structureType == STRUCTURE_EXTENSION ||
                                        structure.structureType == STRUCTURE_SPAWN || structure.structureType == STRUCTURE_LAB) && structure.energy < structure.energyCapacity && structure.id != savedTarget.id;
                                }
                            });
                        } else {
                            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                                filter: (structure) => {
                                    return (structure.structureType == STRUCTURE_EXTENSION ||
                                        structure.structureType == STRUCTURE_SPAWN || structure.structureType == STRUCTURE_LAB) && structure.energy < structure.energyCapacity;
                                }
                            });
                        }
                        if (!target) {
                            //Find closest by path will not return anything if path is blocked
                            if (getNewStructure) {
                                target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                                    filter: (structure) => {
                                        return (structure.structureType == STRUCTURE_EXTENSION ||
                                            structure.structureType == STRUCTURE_SPAWN || structure.structureType == STRUCTURE_LAB) && structure.energy < structure.energyCapacity && structure.id != savedTarget.id;
                                    }
                                });
                            } else {
                                target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                                    filter: (structure) => {
                                        return (structure.structureType == STRUCTURE_EXTENSION ||
                                            structure.structureType == STRUCTURE_SPAWN || structure.structureType == STRUCTURE_LAB) && structure.energy < structure.energyCapacity;
                                    }
                                });
                            }
                        }

                        if (target) {
                            if (getNewStructure) {
                                creep.travelTo(target);
                                creep.memory.structureTarget = target.id;
                            } else if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(target);
                                creep.memory.structureTarget = target.id;
                            }
                        }
                    }
                } else if (Memory.roomsUnderAttack.indexOf(creep.room.name) == -1 && creep.room.terminal && creep.room.storage && creep.room.storage.store[RESOURCE_ENERGY] < 250000 && creep.room.terminal.store[RESOURCE_ENERGY] > 31000) {
                    //Being supplied, drop in storage
                    if (creep.memory.previousPriority == 'labWorker' && !creep.memory.hasDistributed) {
                        creep.memory.hasDistributed = true;
                    }
                    if (creep.transfer(creep.room.storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(creep.room.storage);
                    }
                } else if (creep.room.controller.level != 8 && Memory.linkList[creep.room.name].length > 1) {
                    if (creep.memory.previousPriority == 'labWorker' && !creep.memory.hasDistributed) {
                        creep.memory.hasDistributed = true;
                    }
                    var upLink = Game.getObjectById(Memory.linkList[creep.room.name][1])
                    if (upLink) {
                        if (creep.transfer(upLink, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(upLink);
                        }
                    }
                } else if (_.sum(creep.carry) < creep.carryCapacity) {
                    if (creep.memory.previousPriority == 'labWorker' && !creep.memory.hasDistributed) {
                        creep.memory.hasDistributed = true;
                    }
                    //Get from storage
                    //Check 4th link first just in case
                    var linkTarget = undefined;
                    if (creep.memory.linkSource) {
                        linkTarget = Game.getObjectById(creep.memory.linkSource)
                    }
                    if (linkTarget && linkTarget.energy >= 200) {
                        if (creep.withdraw(linkTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(linkTarget);
                        }
                    } else {
                        var storageTarget = creep.room.storage;
                        if (creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 50000 && creep.room.terminal.store[RESOURCE_ENERGY] > 0) {
                            storageTarget = creep.room.terminal;
                        } else if (creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 250000 && creep.room.terminal.store[RESOURCE_ENERGY] > 31000) {
                            storageTarget = creep.room.terminal;
                        }
                        if (storageTarget) {
                            if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(storageTarget);
                            }
                        }
                    }
                } else {
                    if (creep.memory.previousPriority == 'labWorker' && !creep.memory.hasDistributed) {
                        creep.memory.hasDistributed = true;
                    }
                    var homeSpawn = Game.getObjectById(creep.memory.fromSpawn)
                    if (homeSpawn) {
                        if (!creep.pos.isNearTo(homeSpawn)) {
                            creep.travelTo(homeSpawn);
                        } else {
                            //Make sure you're not in the way
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
                }
                break;
            case 'mineralMiner':
            case 'mineralMinerNearDeath':
                if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'mineralMinerNearDeath') {
                    creep.memory.priority = 'mineralMinerNearDeath';
                }

                let thisMineral = Game.getObjectById(creep.memory.mineralID);

                if (thisMineral.mineralAmount == 0 && creep.memory.onPoint) {
                    //Nothing left to do
                    creep.suicide();
                } else if (Game.time >= creep.memory.nextMine) {
                    let harvestResult = creep.harvest(thisMineral);
                    if (harvestResult == ERR_NOT_IN_RANGE) {
                        creep.travelTo(thisMineral);
                        if (!creep.memory.travelDistance && creep.memory._trav && creep.memory._trav.path) {
                            creep.memory.travelDistance = creep.memory._trav.path.length;
                            creep.memory.deathWarn = ((creep.memory.travelDistance * 2) + _.size(creep.body) * 3) + 15;
                        }
                    } else if (harvestResult == OK) {
                        creep.memory.nextMine = Game.time + 6;
                        if (!creep.memory.storageUnit) {
                            let containers = thisMineral.pos.findInRange(FIND_STRUCTURES, 1, {
                                filter: (structure) => structure.structureType == STRUCTURE_CONTAINER
                            });
                            if (containers.length) {
                                if (creep.pos != containers[0].pos) {
                                    creep.travelTo(containers[0]);
                                } else {
                                    creep.memory.onPoint = true;
                                }
                                creep.memory.storageUnit = containers[0].id;
                            } else {
                                let sites = thisMineral.pos.findInRange(FIND_CONSTRUCTION_SITES, 1)
                                if (!sites.length) {
                                    //Create new container
                                    creep.room.createConstructionSite(creep.pos.x, creep.pos.y, STRUCTURE_CONTAINER);
                                }
                            }
                        } else if (!creep.memory.onPoint) {
                            let thisContainer = Game.getObjectById(creep.memory.storageUnit);
                            if (thisContainer && creep.pos != thisContainer.pos) {
                                creep.travelTo(thisContainer);
                            } else if (thisContainer && creep.pos == thisContainer.pos) {
                                creep.memory.onPoint = true;
                            } else {
                                creep.memory.storageUnit = undefined;
                                creep.memory.onPoint = false;
                            }
                        }
                    }
                }
                break;
        }
    }
};

module.exports = creep_work5;

function repairCompare(a, b) {
    if (a.hits < b.hits)
        return -1;
    if (a.hits > b.hits)
        return 1;
    return 0;
}

function orderPriceCompareBuying(a, b) {
    if (a.price < b.price)
        return -1;
    if (a.price > b.price)
        return 1;
    return 0;
}

function DoResourceCheck(creep) {
    creep.memory.nextResourceCheck = Game.time + 50;
    if (creep.memory.resourceChecks < 15) {
        var lab4 = Game.getObjectById(creep.memory.lab4);
        var lab5 = Game.getObjectById(creep.memory.lab5);
        if (creep.room.terminal && creep.room.terminal.store[creep.memory.mineral6] >= 40000) {
            //Immediately swap flags
            creep.memory.resourceChecks = 15;
            if (creep.memory.mineral5 == RESOURCE_CATALYST && creep.memory.mineral6 != RESOURCE_CATALYZED_GHODIUM_ACID) {
                //If producing something with catalyst, make an order.
                var foundOrder = _.findKey(Game.market.orders, {
                    'roomName': creep.room.name,
                    'resourceType': creep.memory.mineral6
                });
                if (foundOrder) {
                    //Update quantity if less than 40000
                    var thisOrder = Game.market.orders[foundOrder];
                    if (thisOrder.remainingAmount < 40000) {
                        var comparableOrders = Game.market.getAllOrders(order => order.resourceType == creep.memory.mineral6 && order.type == ORDER_SELL);
                        if (comparableOrders.length > 0) {
                            comparableOrders.sort(orderPriceCompareBuying);
                            var targetPrice = comparableOrders[0].price;
                            if (Memory.RoomsAt5.indexOf(comparableOrders[0].roomName) == -1) {
                                //Not competing with self, undercut!
                                if ((thisOrder.price - 0.5) > targetPrice) {
                                    targetPrice = thisOrder.Price
                                } else {
                                    targetPrice = targetPrice - 0.001
                                }
                            }
                            //Regardless of everything, never dip below 1.
                            if (targetPrice < 0.5) {
                                targetPrice = 0.5
                            }
                            Game.market.changeOrderPrice(foundOrder, targetPrice);
                            Game.market.extendOrder(foundOrder, creep.room.terminal.store[creep.memory.mineral6] - thisOrder.remainingAmount);
                        } else {
                            if (thisOrder.price < 0.5) {
                                Game.market.changeOrderPrice(foundOrder, 0.5);
                            }
                            Game.market.extendOrder(foundOrder, creep.room.terminal.store[creep.memory.mineral6] - thisOrder.remainingAmount);
                        }
                    } else {
                        //Keep prices up to date
                        var comparableOrders = Game.market.getAllOrders(order => order.resourceType == creep.memory.mineral6 && order.type == ORDER_SELL);
                        if (comparableOrders.length > 0) {
                            comparableOrders.sort(orderPriceCompareBuying);
                            var targetPrice = comparableOrders[0].price;
                            if (Memory.RoomsAt5.indexOf(comparableOrders[0].roomName) == -1) {
                                //Not competing with self, undercut!
                                if ((thisOrder.price - 0.5) > targetPrice) {
                                    targetPrice = thisOrder.Price
                                } else {
                                    targetPrice = targetPrice - 0.001
                                }
                            }
                            //Regardless of everything, never dip below 1.
                            if (targetPrice < 0.5) {
                                targetPrice = 0.5
                            }
                            Game.market.changeOrderPrice(foundOrder, targetPrice);
                        }
                    }
                } else {
                    //Create new order, 0.001 less than lowest comperable order
                    var comparableOrders = Game.market.getAllOrders(order => order.resourceType == creep.memory.mineral6 && order.type == ORDER_SELL);
                    if (comparableOrders.length > 0) {
                        comparableOrders.sort(orderPriceCompareBuying);
                        var targetPrice = comparableOrders[0].price;
                        if (Memory.RoomsAt5.indexOf(comparableOrders[0].roomName) == -1) {
                            //Not competing with self, undercut!
                            targetPrice = targetPrice - 0.001
                        }
                        //Regardless of everything, never dip below 1.
                        if (targetPrice < 0.5) {
                            targetPrice = 0.5
                        }
                        Game.market.createOrder(ORDER_SELL, creep.memory.mineral6, targetPrice, creep.room.terminal.store[creep.memory.mineral6], creep.room.name);
                    }
                }
            }
            //Game.notify('PRODUCTION MAXED: ' + creep.room.name + ' has swapped off ' + creep.memory.primaryFlag + ' New Target : ' + creep.memory.backupFlag);
        } else if (lab4 && lab5 && (lab4.mineralAmount < creep.carryCapacity || lab5.mineralAmount < creep.carryCapacity)) {
            //tick up, but don't swap yet
            creep.memory.resourceChecks = creep.memory.resourceChecks + 1;
            if (creep.memory.resourceChecks >= 15) {
                //Game.notify('NO MATERIALS:' + creep.room.name + ' has swapped off ' + creep.memory.primaryFlag + ' New Target : ' + creep.memory.backupFlag);
            }
        }
    } else {
        //Still can't find resources, switch flags
        if (!Game.flags[creep.memory.backupFlag] && Game.flags[creep.memory.primaryFlag]) {
            creep.room.createFlag(Game.flags[creep.memory.primaryFlag].pos, creep.memory.backupFlag, COLOR_CYAN);
            Game.flags[creep.memory.primaryFlag].remove();
        } else if (Game.flags[creep.memory.backupFlag] && Game.flags[creep.memory.primaryFlag]) {
            //Just in case
            Game.flags[creep.memory.primaryFlag].remove();
        }
    }
}