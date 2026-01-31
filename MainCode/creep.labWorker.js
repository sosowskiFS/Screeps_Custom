var creep_labWorker = {
    /** @param {Creep} creep **/
    run: function(creep) {
        if (!creep.room.terminal) {
            return;
        }

        const terminal = creep.room.terminal;
        const storage = creep.room.storage;
        const roomName = creep.room.name;

        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'labWorkerNearDeath') {
            creep.memory.priority = 'labWorkerNearDeath';
        }

        if (!creep.memory.nextResourceCheck) {
            creep.memory.nextResourceCheck = Game.time + 50;
        }

        handleResourceCheck(creep, terminal);

        creep.memory.storeProduced = (
            creep.memory.mineral1 == creep.memory.mineral6 ||
            creep.memory.mineral2 == creep.memory.mineral6 ||
            creep.memory.mineral3 == creep.memory.mineral6
        );

        const ctx = buildLabContext(creep);
        let foundWork = false;

        const currentTarget = creep.memory.structureTarget ? Game.getObjectById(creep.memory.structureTarget) : undefined;

        if (creep.memory.cleaningOverflow) {
            foundWork = dropCarried(creep);
            if (foundWork) {
                creep.memory.cleaningOverflow = false;
            }
        } else if (currentTarget) {
            foundWork = actOnTarget(creep, currentTarget);
        } else if (_.sum(creep.carry) == 0) {
            foundWork = withdrawWrongMineral(creep, ctx);
        } else if (creep.memory.movingOtherMineral) {
            foundWork = deliverOtherMineral(creep, terminal);
        } else {
            clearInstructions(creep);
        }

        if (!foundWork) {
            foundWork = handleTerminalOverflow(creep);
        }

        if (!foundWork) {
            foundWork = findLabWork(creep, ctx, terminal);
        }

        if (!foundWork && storage) {
            foundWork = moveStorageMineralsToTerminal(creep, storage, terminal);
        }

        if (!foundWork && Memory.mineralList[roomName] && Memory.mineralList[roomName].length) {
            foundWork = haulMineralContainer(creep, terminal);
        }

        if (!foundWork && creep.room.controller.level == 8 && Memory.nukerList[roomName].length) {
            foundWork = fillNuker(creep, terminal);
        }

        if (!foundWork && creep.memory.factory) {
            foundWork = manageFactory(creep, terminal);
        }

        if (!foundWork && !Game.flags[roomName + "RoomOperator"]) {
            creep.memory.previousPriority = 'labWorker';
            creep.memory.priority = 'distributor';
            creep.memory.hasDistributed = false;
        }

        handleMovementCoordination(creep);

        if (creep.memory._trav && creep.memory._trav.path && creep.memory._trav.path.length) {
            placeRoadOnPath(creep);
        }
    }
};

function orderPriceCompareBuying(a, b) {
    if (a.price < b.price)
        return -1;
    if (a.price > b.price)
        return 1;
    return 0;
}

function NotOverLimit(thisTerminal) {
    //Determines if there's too many unsold bars in the terminal
    if (thisTerminal.store[RESOURCE_UTRIUM_BAR] && thisTerminal.store[RESOURCE_UTRIUM_BAR] >= 10000) {
        return false;
    } else if (thisTerminal.store[RESOURCE_LEMERGIUM_BAR] && thisTerminal.store[RESOURCE_LEMERGIUM_BAR] >= 10000) {
        return false;
    } else if (thisTerminal.store[RESOURCE_ZYNTHIUM_BAR] && thisTerminal.store[RESOURCE_ZYNTHIUM_BAR] >= 10000) {
        return false;
    } else if (thisTerminal.store[RESOURCE_KEANIUM_BAR] && thisTerminal.store[RESOURCE_KEANIUM_BAR] >= 10000) {
        return false;
    } else if (thisTerminal.store[RESOURCE_OXIDANT] && thisTerminal.store[RESOURCE_OXIDANT] >= 10000) {
        return false;
    } else if (thisTerminal.store[RESOURCE_REDUCTANT] && thisTerminal.store[RESOURCE_REDUCTANT] >= 10000) {
        return false;
    } else if (thisTerminal.store[RESOURCE_PURIFIER] && thisTerminal.store[RESOURCE_PURIFIER] >= 10000) {
        return false;
    } else {
        return true;
    }
}

function handleTerminalOverflow(creep) {
    const terminal = creep.room.terminal;
    if (!terminal) return false;
    
    // Check if terminal is nearly full (less than 10k free capacity) AND has less than 10k energy
    const freeCapacity = terminal.store.getFreeCapacity();
    const energyAmount = terminal.store[RESOURCE_ENERGY] || 0;
    
    if (freeCapacity >= 10000 || energyAmount >= 10000) return false;
    
    // List of basic minerals to remove when terminal is full
    const basicMinerals = [
        RESOURCE_HYDROGEN,
        RESOURCE_OXYGEN, 
        RESOURCE_UTRIUM,
        RESOURCE_LEMERGIUM,
        RESOURCE_KEANIUM,
        RESOURCE_ZYNTHIUM,
        RESOURCE_CATALYST
    ];
    
    // If creep is carrying basic minerals, drop them
    if (_.sum(creep.carry) > 0) {
        for (let mineral of basicMinerals) {
            if (creep.carry[mineral]) {
                creep.drop(mineral);
                clearTravelMemory(creep);
                return true;
            }
        }
        return false;
    }
    
    // Find basic mineral with highest quantity in terminal
    let targetMineral = null;
    let maxAmount = 0;
    
    for (let mineral of basicMinerals) {
        const amount = terminal.store[mineral] || 0;
        if (amount > maxAmount && amount > 5000) { // Only target if > 5k
            maxAmount = amount;
            targetMineral = mineral;
        }
    }
    
    // Withdraw excess basic mineral from terminal
    if (targetMineral) {
        const withdrawResult = creep.withdraw(terminal, targetMineral);
        if (withdrawResult == ERR_NOT_IN_RANGE) {
            creep.travelTo(terminal, {
                maxRooms: 1,
                ignoreRoads: true
            });
        } else if (withdrawResult == OK) {
            // Set memory to indicate we're cleaning overflow
            creep.memory.cleaningOverflow = true;
            clearTravelMemory(creep);
        }
        return true;
    }
    
    return false;
}

function handleResourceCheck(creep, terminal) {
    if (Game.time < creep.memory.nextResourceCheck || !Game.flags[creep.memory.primaryFlag] || !creep.memory.lab4) {
        if (Game.flags[creep.memory.backupFlag] && Game.flags[creep.memory.primaryFlag]) {
            Game.flags[creep.memory.primaryFlag].remove();
        } else if (Game.flags[creep.memory.backupFlag] && creep.memory.resourceChecks >= 15 && _.sum(creep.carry) == 0) {
            creep.suicide();
        }
        return;
    }

    creep.memory.nextResourceCheck = Game.time + 50;

    if (creep.memory.resourceChecks >= 15) {
        if (!Game.flags[creep.memory.backupFlag] && Game.flags[creep.memory.primaryFlag]) {
            creep.room.createFlag(Game.flags[creep.memory.primaryFlag].pos, creep.memory.backupFlag, COLOR_CYAN);
            Game.flags[creep.memory.primaryFlag].remove();
        } else if (Game.flags[creep.memory.backupFlag] && Game.flags[creep.memory.primaryFlag]) {
            Game.flags[creep.memory.primaryFlag].remove();
        }
        return;
    }

    const lab4 = Game.getObjectById(creep.memory.lab4);
    const lab5 = Game.getObjectById(creep.memory.lab5);

    if (terminal.store[creep.memory.mineral6] >= 40000) {
        creep.memory.resourceChecks = 15;
        if (creep.memory.mineral5 == RESOURCE_CATALYST && creep.memory.mineral6 != RESOURCE_CATALYZED_GHODIUM_ACID) {
            handleMarketOrder(creep, terminal);
        }
        return;
    }

    if (lab4 && lab5 && (lab4.mineralAmount < creep.carryCapacity || lab5.mineralAmount < creep.carryCapacity) && _.sum(creep.carry) == 0) {
        creep.memory.resourceChecks = creep.memory.resourceChecks + 1;
    }
}

function handleMarketOrder(creep, terminal) {
    const foundOrder = _.findKey(Game.market.orders, {
        'roomName': creep.room.name,
        'resourceType': creep.memory.mineral6
    });

    if (!foundOrder) {
        const comparableOrders = Game.market.getAllOrders(order => order.resourceType == creep.memory.mineral6 && order.type == ORDER_SELL);
        if (comparableOrders.length > 0) {
            comparableOrders.sort(orderPriceCompareBuying);
            let targetPrice = comparableOrders[0].price;
            if (Memory.RoomsAt5.indexOf(comparableOrders[0].roomName) == -1) {
                targetPrice = targetPrice - 0.001;
            }
            if (targetPrice < 0.5) {
                targetPrice = 0.5;
            }
            Game.market.createOrder(ORDER_SELL, creep.memory.mineral6, targetPrice, terminal.store[creep.memory.mineral6], creep.room.name);
        }
        return;
    }

    const thisOrder = Game.market.orders[foundOrder];
    const comparableOrders = Game.market.getAllOrders(order => order.resourceType == creep.memory.mineral6 && order.type == ORDER_SELL);

    if (comparableOrders.length > 0) {
        comparableOrders.sort(orderPriceCompareBuying);
        let targetPrice = comparableOrders[0].price;
        if (Memory.RoomsAt5.indexOf(comparableOrders[0].roomName) == -1) {
            if ((thisOrder.price - 0.5) > targetPrice) {
                targetPrice = thisOrder.Price;
            } else {
                targetPrice = targetPrice - 0.001;
            }
        }
        if (targetPrice < 0.5) {
            targetPrice = 0.5;
        }
        Game.market.changeOrderPrice(foundOrder, targetPrice);
    } else if (thisOrder.price < 0.5) {
        Game.market.changeOrderPrice(foundOrder, 0.5);
    }

    if (thisOrder.remainingAmount < 40000) {
        Game.market.extendOrder(foundOrder, terminal.store[creep.memory.mineral6] - thisOrder.remainingAmount);
    }
}

function buildLabContext(creep) {
    const labs = [];
    const minerals = [];
    const lab1 = Game.getObjectById(creep.memory.lab1);
    const lab2 = Game.getObjectById(creep.memory.lab2);
    const lab3 = Game.getObjectById(creep.memory.lab3);

    labs.push(lab1, lab2, lab3);
    minerals.push(creep.memory.mineral1, creep.memory.mineral2, creep.memory.mineral3);

    let lab4, lab5, lab6, lab7, lab8, lab9, lab10;

    if (creep.memory.lab4) {
        lab4 = Game.getObjectById(creep.memory.lab4);
        lab5 = Game.getObjectById(creep.memory.lab5);
        lab6 = Game.getObjectById(creep.memory.lab6);
        labs.push(lab4, lab5, lab6);
        minerals.push(creep.memory.mineral4, creep.memory.mineral5, creep.memory.mineral6);
    } else {
        creep.memory.lab4 = 'XXX';
        creep.memory.lab5 = 'XXX';
        creep.memory.lab6 = 'XXX';
    }

    if (creep.memory.lab7) {
        lab7 = Game.getObjectById(creep.memory.lab7);
        lab8 = Game.getObjectById(creep.memory.lab8);
        lab9 = Game.getObjectById(creep.memory.lab9);
        labs.push(lab7, lab8, lab9);
        minerals.push(creep.memory.mineral7, creep.memory.mineral8, creep.memory.mineral9);
    } else {
        creep.memory.lab7 = 'XXX';
        creep.memory.lab8 = 'XXX';
        creep.memory.lab9 = 'XXX';
    }

    if (creep.memory.lab10) {
        lab10 = Game.getObjectById(creep.memory.lab10);
        labs.push(lab10);
        minerals.push(creep.memory.mineral10);
    } else {
        creep.memory.lab10 = 'XXX';
    }

    return {
        labs,
        minerals,
        lab1,
        lab2,
        lab3,
        lab4,
        lab5,
        lab6,
        lab7,
        lab8,
        lab9,
        lab10
    };
}

function dropCarried(creep) {
    const currentlyCarrying = _.findKey(creep.carry);
    if (!currentlyCarrying) {
        return false;
    }
    creep.drop(currentlyCarrying);
    clearTravelMemory(creep);
    return true;
}

function actOnTarget(creep, target) {
    if (creep.memory.direction == 'Withdraw' && creep.memory.priority != 'labWorkerNearDeath') {
        const withdrawResult = creep.withdraw(target, creep.memory.mineralToMove);
        if (withdrawResult == ERR_NOT_IN_RANGE) {
            creep.travelTo(target, { maxRooms: 1, ignoreRoads: true });
        } else {
            clearInstructions(creep);
            clearTravelMemory(creep);
        }
        return true;
    }

    const transferResult = creep.transfer(target, creep.memory.mineralToMove);
    if (transferResult == ERR_NOT_IN_RANGE) {
        creep.travelTo(target, { maxRooms: 1, ignoreRoads: true });
    } else {
        clearInstructions(creep);
        clearTravelMemory(creep);
    }
    return true;
}

function withdrawWrongMineral(creep, ctx) {
    for (let i = 0; i < ctx.labs.length; i++) {
        const lab = ctx.labs[i];
        const expected = ctx.minerals[i];
        if (lab && lab.mineralAmount > 0 && lab.mineralType != expected) {
            creep.memory.movingOtherMineral = true;
            const withdrawResult = creep.withdraw(lab, lab.mineralType);
            if (withdrawResult == ERR_NOT_IN_RANGE) {
                creep.travelTo(lab, { maxRooms: 1, ignoreRoads: true });
                creep.memory.structureTarget = lab.id;
                creep.memory.direction = 'Withdraw';
                creep.memory.mineralToMove = lab.mineralType;
            } else if (withdrawResult == OK) {
                clearTravelMemory(creep);
            }
            return true;
        }
    }
    return false;
}

function deliverOtherMineral(creep, terminal) {
    const currentlyCarrying = _.findKey(creep.carry);
    if (!currentlyCarrying) {
        creep.memory.movingOtherMineral = false;
        clearInstructions(creep);
        return false;
    }

    let transferTarget = terminal;
    if (creep.memory.otherMineralTarget) {
        transferTarget = Game.getObjectById(creep.memory.otherMineralTarget) || terminal;
    }

    const transferResult = creep.transfer(transferTarget, currentlyCarrying);
    if (transferResult == ERR_NOT_IN_RANGE) {
        creep.travelTo(transferTarget, { maxRooms: 1, ignoreRoads: true });
        creep.memory.structureTarget = transferTarget.id;
        creep.memory.direction = 'Transfer';
        creep.memory.mineralToMove = currentlyCarrying;
    } else if (transferResult == OK) {
        creep.memory.movingOtherMineral = false;
        clearInstructions(creep);
        clearTravelMemory(creep);
    }
    return true;
}

function clearInstructions(creep) {
    creep.memory.structureTarget = undefined;
    creep.memory.direction = undefined;
    creep.memory.mineralToMove = undefined;
    creep.memory.otherMineralTarget = undefined;
}

function findLabWork(creep, ctx, terminal) {
    const warBoosts = Game.flags[creep.room.name + "WarBoosts"];

    for (let i = 0; i < ctx.labs.length; i++) {
        const lab = ctx.labs[i];
        const mineral = ctx.minerals[i];
        if (!lab) {
            continue;
        }

        if (warBoosts) {
            if (lab.id == creep.memory.lab4 || lab.id == creep.memory.lab5 || lab.id == creep.memory.lab6 ||
                lab.id == creep.memory.lab1 || lab.id == creep.memory.lab2 || lab.id == creep.memory.lab3) {
                return handleBoostLab(creep, lab, mineral, terminal);
            }
            continue;
        }

        if (lab.id == creep.memory.lab4 || lab.id == creep.memory.lab5) {
            if (handleReagentLab(creep, lab, mineral, terminal)) {
                return true;
            }
            continue;
        }

        if (lab.id == creep.memory.lab6 || lab.id == creep.memory.lab7 || lab.id == creep.memory.lab8 || lab.id == creep.memory.lab9 || lab.id == creep.memory.lab10) {
            if (handleResultLab(creep, ctx, lab, mineral, terminal)) {
                return true;
            }
            continue;
        }

        if (lab.id == creep.memory.lab1 || lab.id == creep.memory.lab2 || lab.id == creep.memory.lab3) {
            if (handleBoostLab(creep, lab, mineral, terminal)) {
                return true;
            }
        }
    }

    return false;
}

function handleBoostLab(creep, lab, mineral, terminal) {
    if (_.sum(creep.carry) == 0 && creep.memory.priority != 'labWorkerNearDeath') {
        const minAmount = mineral in terminal.store;
        const minLab = lab.mineralAmount;
        if (minLab <= 2500 && minAmount > 0) {
            creep.memory.structureTarget = terminal.id;
            creep.memory.direction = 'Withdraw';
            creep.memory.mineralToMove = mineral;
            const withdrawResult = creep.withdraw(terminal, mineral);
            if (withdrawResult == ERR_NOT_IN_RANGE) {
                creep.travelTo(terminal, { maxRooms: 1, ignoreRoads: true });
            } else if (withdrawResult == OK) {
                clearTravelMemory(creep);
            }
            return true;
        }
        return false;
    }

    const carryAmount = mineral in creep.carry;
    if (carryAmount > 0 && lab.mineralAmount <= 2500) {
        creep.memory.structureTarget = lab.id;
        creep.memory.direction = 'Transfer';
        creep.memory.mineralToMove = mineral;
        const transferResult = creep.transfer(lab, mineral);
        if (transferResult == ERR_NOT_IN_RANGE) {
            creep.travelTo(lab, { maxRooms: 1, ignoreRoads: true });
        } else if (transferResult == OK) {
            clearTravelMemory(creep);
        }
        return true;
    }

    return false;
}

function handleReagentLab(creep, lab, mineral, terminal) {
    if (_.sum(creep.carry) == 0 && creep.memory.priority != 'labWorkerNearDeath') {
        if (terminal.store[creep.memory.mineral6] < 40000 || !terminal.store[creep.memory.mineral6]) {
            const mineralAmount = mineral in terminal.store;
            if (mineralAmount > 0 && lab.mineralAmount < lab.mineralCapacity - creep.carryCapacity) {
                creep.memory.structureTarget = terminal.id;
                creep.memory.direction = 'Withdraw';
                creep.memory.mineralToMove = mineral;
                const withdrawResult = creep.withdraw(terminal, mineral);
                if (withdrawResult == ERR_NOT_IN_RANGE) {
                    creep.travelTo(terminal, { maxRooms: 1, ignoreRoads: true });
                } else if (withdrawResult == OK) {
                    clearTravelMemory(creep);
                }
                return true;
            }
        }
        return false;
    }

    if (creep.carry[mineral] && lab.mineralAmount < lab.mineralCapacity - creep.carryCapacity) {
        creep.memory.structureTarget = lab.id;
        creep.memory.direction = 'Transfer';
        creep.memory.mineralToMove = mineral;
        const transferResult = creep.transfer(lab, mineral);
        if (transferResult == ERR_NOT_IN_RANGE) {
            creep.travelTo(lab, { maxRooms: 1, ignoreRoads: true });
        } else if (transferResult == OK) {
            clearTravelMemory(creep);
        }
        return true;
    }

    return false;
}

function handleResultLab(creep, ctx, lab, mineral, terminal) {
    if (_.sum(creep.carry) == 0 && creep.memory.priority != 'labWorkerNearDeath') {
        if (lab.mineralAmount >= creep.carryCapacity) {
            creep.memory.structureTarget = lab.id;
            creep.memory.direction = 'Withdraw';
            creep.memory.mineralToMove = mineral;
            const withdrawResult = creep.withdraw(lab, lab.mineralType);
            if (withdrawResult == ERR_NOT_IN_RANGE) {
                creep.travelTo(lab, { maxRooms: 1, ignoreRoads: true });
            } else if (withdrawResult == OK) {
                clearTravelMemory(creep);
            }
            return true;
        }
        return false;
    }

    if (!creep.carry[mineral]) {
        return false;
    }

    if (creep.memory.storeProduced) {
        let labAmount = 9999;
        if (mineral == creep.memory.mineral1 && ctx.lab1) {
            labAmount = ctx.lab1.mineralAmount;
        } else if (mineral == creep.memory.mineral2 && ctx.lab2) {
            labAmount = ctx.lab2.mineralAmount;
        } else if (mineral == creep.memory.mineral3 && ctx.lab3) {
            labAmount = ctx.lab3.mineralAmount;
        }
        if (labAmount <= 2500) {
            return false;
        }
    }

    if (mineral == RESOURCE_GHODIUM && creep.room.controller.level == 8 && Memory.nukerList[creep.room.name].length) {
        const thisNuker = Game.getObjectById(Memory.nukerList[creep.room.name][0]);
        if (thisNuker && thisNuker.ghodiumCapacity > thisNuker.ghodium) {
            creep.memory.structureTarget = thisNuker.id;
            creep.memory.direction = 'Transfer';
            creep.memory.mineralToMove = RESOURCE_GHODIUM;
            if (creep.transfer(thisNuker, mineral) == ERR_NOT_IN_RANGE) {
                creep.travelTo(thisNuker, { maxRooms: 1, ignoreRoads: true });
            } else {
                clearTravelMemory(creep);
            }
            return true;
        }
    }

    creep.memory.structureTarget = terminal.id;
    creep.memory.direction = 'Transfer';
    creep.memory.mineralToMove = mineral;
    if (creep.transfer(terminal, mineral) == ERR_NOT_IN_RANGE) {
        creep.travelTo(terminal, { maxRooms: 1, ignoreRoads: true });
    } else {
        clearTravelMemory(creep);
    }
    return true;
}

function moveStorageMineralsToTerminal(creep, storage, terminal) {
    if (Object.keys(storage.store).length <= 1 || terminal.store.getFreeCapacity() < 25000) {
        return false;
    }

    let withdrawResult = "N/A";
    for (const resourceType in storage.store) {
        if (resourceType == RESOURCE_POWER || resourceType == RESOURCE_ENERGY) {
            continue;
        }
        withdrawResult = creep.withdraw(storage, resourceType);
        break;
    }

    if (withdrawResult == ERR_NOT_IN_RANGE) {
        creep.travelTo(storage, { maxRooms: 1, ignoreRoads: true });
        return true;
    }

    if (withdrawResult != ERR_NOT_IN_RANGE && withdrawResult != "N/A") {
        creep.travelTo(terminal, { maxRooms: 1, ignoreRoads: true });
        creep.memory.movingOtherMineral = true;
        return true;
    }

    return false;
}

function haulMineralContainer(creep, terminal) {
    const thisMineral = Game.getObjectById(Memory.mineralList[creep.room.name][0]);
    if (!thisMineral) {
        return false;
    }

    const nearbyContainer = thisMineral.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: (structure) => structure.structureType == STRUCTURE_CONTAINER
    });

    if (!nearbyContainer.length || _.sum(nearbyContainer[0].store) < creep.carryCapacity) {
        return false;
    }

    let withdrawResult = "N/A";
    for (const resourceType in nearbyContainer[0].store) {
        if (resourceType == RESOURCE_ENERGY) {
            if (nearbyContainer[0].store[RESOURCE_ENERGY] < creep.carryCapacity) {
                continue;
            }
        }
        withdrawResult = creep.withdraw(nearbyContainer[0], resourceType);
        break;
    }

    if (withdrawResult == ERR_NOT_IN_RANGE) {
        creep.travelTo(nearbyContainer[0], { maxRooms: 1, ignoreRoads: true });
        return true;
    }

    if (withdrawResult != ERR_NOT_IN_RANGE && withdrawResult != "N/A") {
        creep.travelTo(terminal, { maxRooms: 1, ignoreRoads: true });
        creep.memory.movingOtherMineral = true;
        return true;
    }

    return false;
}

function fillNuker(creep, terminal) {
    const thisNuker = Game.getObjectById(Memory.nukerList[creep.room.name][0]);
    if (!thisNuker) {
        return false;
    }

    if (thisNuker.ghodiumCapacity > thisNuker.ghodium && !creep.carry[RESOURCE_GHODIUM] && terminal.store[RESOURCE_GHODIUM]) {
        creep.memory.structureTarget = terminal.id;
        creep.memory.direction = 'Withdraw';
        creep.memory.mineralToMove = RESOURCE_GHODIUM;
        return true;
    }

    if (thisNuker.ghodiumCapacity > thisNuker.ghodium && creep.carry[RESOURCE_GHODIUM]) {
        creep.memory.structureTarget = thisNuker.id;
        creep.memory.direction = 'Transfer';
        creep.memory.mineralToMove = RESOURCE_GHODIUM;
        return true;
    }

    if (thisNuker.ghodiumCapacity == thisNuker.ghodium && creep.carry[RESOURCE_GHODIUM]) {
        creep.memory.structureTarget = terminal.id;
        creep.memory.direction = 'Transfer';
        creep.memory.mineralToMove = RESOURCE_GHODIUM;
        return true;
    }

    return false;
}

function manageFactory(creep, terminal) {
    const thisFactory = Game.getObjectById(creep.memory.factory);
    if (!thisFactory) {
        return false;
    }

    const withdrawCandidates = [
        RESOURCE_UTRIUM_BAR,
        RESOURCE_LEMERGIUM_BAR,
        RESOURCE_ZYNTHIUM_BAR,
        RESOURCE_KEANIUM_BAR,
        RESOURCE_OXIDANT,
        RESOURCE_REDUCTANT,
        RESOURCE_PURIFIER
    ];

    for (let i = 0; i < withdrawCandidates.length; i++) {
        const res = withdrawCandidates[i];
        if (thisFactory.store[res] && thisFactory.store[res] >= creep.carryCapacity) {
            creep.memory.structureTarget = thisFactory.id;
            creep.memory.direction = 'Withdraw';
            creep.memory.mineralToMove = res;
            creep.memory.movingOtherMineral = true;
            return true;
        }
    }

    let roomMineral = '';
    if (Memory.mineralList[creep.room.name] && Memory.mineralList[creep.room.name].length > 0) {
        const mineralObj = Game.getObjectById(Memory.mineralList[creep.room.name][0]);
        if (mineralObj) {
            roomMineral = mineralObj.mineralType;
        }
    }

    if (!roomMineral) {
        return false;
    }

    let terminalLimit = 40000;
    const freeRoom = terminal.store.getFreeCapacity();
    if (freeRoom <= 5000) {
        terminalLimit = 3000;
    } else if (freeRoom <= 50000) {
        terminalLimit = 20000;
    }

    if (terminal.store[roomMineral] && terminal.store[roomMineral] > terminalLimit && NotOverLimit(terminal) && thisFactory.store[RESOURCE_ENERGY] >= 200) {
        creep.memory.structureTarget = terminal.id;
        creep.memory.direction = 'Withdraw';
        creep.memory.mineralToMove = roomMineral;
        creep.memory.movingOtherMineral = true;
        creep.memory.otherMineralTarget = thisFactory.id;
        return true;
    }

    return false;
}

function handleMovementCoordination(creep) {
    let talkingCreeps = creep.pos.findInRange(FIND_MY_CREEPS, 1, {
        filter: (thisCreep) => (creep.id != thisCreep.id && thisCreep.saying)
    });

    if (talkingCreeps.length) {
        const coords = talkingCreeps[0].saying.split(";");
        if (coords.length == 2 && creep.pos.x == parseInt(coords[0]) && creep.pos.y == parseInt(coords[1])) {
            const thisDirection = creep.pos.getDirectionTo(talkingCreeps[0].pos);
            creep.move(thisDirection);
            creep.say("\uD83D\uDCA6", true);
        }
    }

    if (Game.flags[creep.room.name + "RoomOperator"]) {
        talkingCreeps = creep.pos.findInRange(FIND_MY_POWER_CREEPS, 1, {
            filter: (thisCreep) => (creep.id != thisCreep.id && thisCreep.saying)
        });

        if (talkingCreeps.length) {
            const coords = talkingCreeps[0].saying.split(";");
            if (coords.length == 2 && creep.pos.x == parseInt(coords[0]) && creep.pos.y == parseInt(coords[1])) {
                const thisDirection = creep.pos.getDirectionTo(talkingCreeps[0].pos);
                creep.move(thisDirection);
                creep.say("\uD83D\uDCA6", true);
            }
        }
    }
}

function placeRoadOnPath(creep) {
    if (!creep.memory._trav || !creep.memory._trav.path || creep.memory._trav.path.length === 0) {
        return;
    }

    if (Game.cpu && Game.cpu.bucket < 1000) {
        return;
    }

    if (Game.constructionSites && Object.keys(Game.constructionSites).length >= MAX_CONSTRUCTION_SITES) {
        return;
    }

    tryCreateRoadAt(creep.pos);

    const nextDir = parseInt(creep.memory._trav.path[0], 10);
    if (nextDir) {
        const nextPos = positionAtDirection(creep.pos, nextDir);
        if (nextPos) {
            tryCreateRoadAt(nextPos);
        }
    }
}

function tryCreateRoadAt(pos) {
    if (!pos || !pos.roomName) {
        return;
    }

    const structures = pos.lookFor(LOOK_STRUCTURES);
    if (structures.length && !structures.every(s => s.structureType === STRUCTURE_ROAD)) {
        return;
    }

    const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
    if (sites.length) {
        return;
    }

    pos.createConstructionSite(STRUCTURE_ROAD);
}

function positionAtDirection(pos, direction) {
    const offsets = {
        1: { x: 0, y: -1 },
        2: { x: 1, y: -1 },
        3: { x: 1, y: 0 },
        4: { x: 1, y: 1 },
        5: { x: 0, y: 1 },
        6: { x: -1, y: 1 },
        7: { x: -1, y: 0 },
        8: { x: -1, y: -1 }
    };

    const offset = offsets[direction];
    if (!offset) {
        return undefined;
    }

    const x = pos.x + offset.x;
    const y = pos.y + offset.y;
    if (x < 0 || x > 49 || y < 0 || y > 49) {
        return undefined;
    }

    return new RoomPosition(x, y, pos.roomName);
}

function clearTravelMemory(creep) {
    if (creep.memory && creep.memory._trav) {
        delete creep.memory._trav;
    }
}

module.exports = creep_labWorker;