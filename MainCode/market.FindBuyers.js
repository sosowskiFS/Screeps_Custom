const runtimeCache = require('runtime.cache');
const labPlanner = require('system.labs');
var market_buyers = {

    run: function(thisRoom, thisTerminal, thisMineral) {
        const TerminalEnergy = thisTerminal.store[RESOURCE_ENERGY];


        const neededMinerals = [];
        let GH2OPriority = -1;
        let HydroxidePriority = -1;

        // Always requested minerals for boosts
        if (thisRoom.controller.level >= 6) {
            neededMinerals.push(
                RESOURCE_CATALYZED_KEANIUM_ALKALIDE, // Ranged boost, defenders
                RESOURCE_CATALYZED_GHODIUM_ACID,     // Upgrade boost
                RESOURCE_CATALYZED_LEMERGIUM_ACID    // Repair boost
            );
            GH2OPriority = 0;
        }
        if (thisRoom.controller.level === 8) {
            neededMinerals.push(RESOURCE_GHODIUM);
        }

        // War boost staging
        if (Game.flags[thisRoom.name + "WarBoosts"]) {
            neededMinerals.push(RESOURCE_CATALYZED_UTRIUM_ACID, RESOURCE_CATALYZED_KEANIUM_ALKALIDE,
                RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE, RESOURCE_CATALYZED_ZYNTHIUM_ACID,
                RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE, RESOURCE_CATALYZED_GHODIUM_ALKALIDE);
        }

        // Reagents for the reaction the planner gave this room
        const job = labPlanner.jobFor(thisRoom.name);
        if (job) {
            neededMinerals.push(job.a, job.b);
            if (job.a === RESOURCE_HYDROXIDE || job.b === RESOURCE_HYDROXIDE) {
                HydroxidePriority = 0;
            }
        }

        const ordinaryNeeds = new Set(neededMinerals);
        const guardBoosts = require('system.guardBoosts');
        const guardStock = guardBoosts.roomState(thisRoom.name);
        if (guardStock) for (const mineral of Object.keys(guardStock.need)) {
            if (!neededMinerals.includes(mineral)) neededMinerals.push(mineral);
        }

        // Process mineral needs
        for (const mineral of neededMinerals) {
            if (!Memory.mineralNeed[mineral]) {
                Memory.mineralNeed[mineral] = [];
            }
            const reservation = guardBoosts.reserved(thisRoom.name, mineral);
            const mineralCap = Math.max(ordinaryNeeds.has(mineral) ? 5000 : 0, reservation);
            const currentAmount = reservation ? guardBoosts.stock(thisRoom, mineral) :
                (thisTerminal.store[mineral] || 0) + ((thisRoom.storage && thisRoom.storage.store[mineral]) || 0);
            const roomIndex = Memory.mineralNeed[mineral].indexOf(thisRoom.name);
            
            if (currentAmount < mineralCap) {
                if (roomIndex === -1) {
                    if (guardBoosts.reserved(thisRoom.name, mineral) || (mineral === RESOURCE_CATALYZED_GHODIUM_ACID && GH2OPriority === 0) ||
                        (mineral === RESOURCE_HYDROXIDE && HydroxidePriority === 0)) {
                        Memory.mineralNeed[mineral].unshift(thisRoom.name);
                    } else {
                        Memory.mineralNeed[mineral].push(thisRoom.name);
                    }
                }
            } else if (roomIndex !== -1) {
                Memory.mineralNeed[mineral].splice(roomIndex, 1);
            }
        }

        // Reactions change hands now: withdraw requests for reagents this room no longer uses.
        for (const mineral in Memory.mineralNeed) {
            if (neededMinerals.includes(mineral)) continue;
            const staleIndex = Memory.mineralNeed[mineral].indexOf(thisRoom.name);
            if (staleIndex !== -1) {
                Memory.mineralNeed[mineral].splice(staleIndex, 1);
            }
        }

        if (TerminalEnergy >= 5000) {
            const currentMineral = Game.getObjectById(thisMineral);

            // Determine if excess minerals and distribute where needed
            let hasSent = false;
            if (Game.time % 100 === 0) {
                for (const mineral in Memory.mineralNeed) {
                    if (mineral === RESOURCE_CATALYZED_GHODIUM_ACID && thisRoom.controller.level < 8) {
                        continue; // Skip if room can't use this mineral
                    }
                    if (hasSent) {
                        break;
                    } else if (Memory.mineralNeed[mineral].length) {
                        const isNeeded = neededMinerals.includes(mineral);
                        
                        hasSent = sendMineral(mineral, thisTerminal, Memory.mineralNeed[mineral][0], isNeeded);
                    }
                }
            }

            if (!hasSent && TerminalEnergy >= 50000 && Memory.energyNeedRooms.length && Memory.energyNeedRooms[0] !== thisRoom.name && thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] >= 250000) {
                // Send energy to requesting room
                const targetTerminal = Game.rooms[Memory.energyNeedRooms[0]].terminal;
                const amountAvailable = TerminalEnergy - 30000;
                const siegeTarget = !!require('system.guardBoosts').roomState(Memory.energyNeedRooms[0]);
                const targetStoreCap = siegeTarget ? 150000 : 60000;
                
                if (targetTerminal) {
                    let amountToSend = 30000;
                    if (targetTerminal.store[RESOURCE_ENERGY]) {
                        amountToSend = targetStoreCap - targetTerminal.store[RESOURCE_ENERGY];
                    }
                    if (amountToSend > amountAvailable) {
                        amountToSend = amountAvailable;
                    }
                    if (amountToSend >= 5000 && thisTerminal.send(RESOURCE_ENERGY, amountToSend, Memory.energyNeedRooms[0], thisTerminal.room.name + " has gotchu, fam.") === OK) {
                        Memory.energyNeedRooms.splice(0, 1);
                        hasSent = true;
                    }
                } else {
                    // No terminal, remove this room from the list
                    Memory.energyNeedRooms.splice(0, 1);
                }
            }

            /*if (!hasSent && Game.market.credits >= 100000) {
                //Buy GCL juice
                let XGH2OSellers = runtimeCache.marketOrders(RESOURCE_CATALYZED_GHODIUM_ACID, ORDER_SELL, order => order.resourceType == RESOURCE_CATALYZED_GHODIUM_ACID && order.amount >= 100 && order.price <= 4.0 && order.type == ORDER_SELL && Game.market.calcTransactionCost(order.amount, thisRoom.name, order.roomName) <= TerminalEnergy && Memory.ordersFilled.indexOf(order.id) == -1)
                if (XGH2OSellers.length) {
                    XGH2OSellers.sort(orderBuyCompare);
                    if (Game.market.deal(XGH2OSellers[0].id, XGH2OSellers[0].amount, thisRoom.name) == OK) {
                        if (Memory.ordersFilled.indexOf(XGH2OSellers[0].id) == -1) {
                            Memory.ordersFilled.push(XGH2OSellers[0].id);
                        }
                        hasSent = true;
                    }
                }
            }*/

            // Trade goods (silicon, metal, biomass, mist) are sold by system.market.sellTradeGoods.
            const sellMinerals = [RESOURCE_UTRIUM_BAR, RESOURCE_LEMERGIUM_BAR, RESOURCE_ZYNTHIUM_BAR, RESOURCE_KEANIUM_BAR, RESOURCE_OXIDANT, RESOURCE_REDUCTANT, RESOURCE_PURIFIER, RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_ZYNTHIUM, RESOURCE_KEANIUM, RESOURCE_UTRIUM, RESOURCE_LEMERGIUM];
            const noStoreMinerals = [RESOURCE_UTRIUM_BAR, RESOURCE_LEMERGIUM_BAR, RESOURCE_ZYNTHIUM_BAR, RESOURCE_KEANIUM_BAR, RESOURCE_OXIDANT, RESOURCE_REDUCTANT, RESOURCE_PURIFIER];

            const sellEnergyCap = thisTerminal.store.getFreeCapacity() <= 5000 ? 10000 : 30000;
            const MaxSaleAmount = thisTerminal.store.getFreeCapacity() <= 5000 ? TerminalEnergy + 5000 : 30000;
            const panicSell = thisTerminal.store.getFreeCapacity() <= 5000;
            
            // Selling to other players' buy orders (not in the Seasonal World: no market there).
            if (!hasSent && TerminalEnergy >= sellEnergyCap && (Game.time % 1000 === 0 || panicSell) && require('runtime.world').market()) {
                for (const mineral of sellMinerals) {
                    if (!noStoreMinerals.includes(mineral) && Memory.mineralTotals[mineral] < 75000) {
                        continue; // Not a lot stockpiled, skip the sell
                    }
                    
                    let mineralInTerminal = thisTerminal.store[mineral];
                    if (mineralInTerminal > 100) {
                        if (mineralInTerminal > MaxSaleAmount) {
                            mineralInTerminal = MaxSaleAmount;
                        }
                        
                        if (!Memory.PriceList[mineral]) {
                            Memory.PriceList[mineral] = 0;
                        }
                        
                        const FilteredOrders = runtimeCache.marketOrders(mineral, ORDER_BUY, order =>
                            order.resourceType === mineral && 
                            order.amount >= 100 && 
                            order.type === ORDER_BUY && 
                            order.price >= Memory.PriceList[mineral] && 
                            Game.market.calcTransactionCost(mineralInTerminal, thisRoom.name, order.roomName) <= TerminalEnergy && 
                            !Memory.ordersFilled.includes(order.id)
                        );
                        
                        if (FilteredOrders.length > 0) {
                            FilteredOrders.sort(orderSellCompare);
                            const tradeAmount = Math.min(FilteredOrders[0].amount, mineralInTerminal);
                            
                            if (Game.market.deal(FilteredOrders[0].id, tradeAmount, thisRoom.name) === OK) {
                                Memory.PriceList[mineral] = FilteredOrders[0].price;
                                if (!Memory.ordersFilled.includes(FilteredOrders[0].id)) {
                                    Memory.ordersFilled.push(FilteredOrders[0].id);
                                }
                                break;
                            }
                        } else if (Memory.PriceList[mineral] > 0 && Game.time % 1000 === 0) {
                            // No orders found, drop the price a bit
                            Memory.PriceList[mineral] = Math.max(0, Memory.PriceList[mineral] - 0.01);
                        }
                    }
                }
            }
        }

    }
};

module.exports = market_buyers;

function sendMineral(thisMineral, thisTerminal, targetRoom, saveFlag) {
    if (thisTerminal.store[thisMineral] && Game.rooms[targetRoom]) {
        const targetTerminal = Game.rooms[targetRoom].terminal;
        let amountAvailable = thisTerminal.store[thisMineral];
        let targetStoreCap = 5000;
        
        if (saveFlag) {
            if (thisMineral === RESOURCE_GHODIUM || thisMineral === RESOURCE_CATALYZED_KEANIUM_ALKALIDE) {
                amountAvailable = thisTerminal.store[thisMineral] - 5000;
            } else {
                targetStoreCap = 3000;
                amountAvailable = thisTerminal.store[thisMineral] - 3000;
            }
        }
        
        const guardBoosts = require('system.guardBoosts');
        const reserve = guardBoosts.reserved(thisTerminal.room.name, thisMineral);
        const spare = guardBoosts.stock(thisTerminal.room, thisMineral) - reserve;
        amountAvailable = Math.min(amountAvailable, spare);
        const targetReserve = guardBoosts.reserved(targetRoom, thisMineral);
        if (targetReserve) {
            const missing = Math.max(targetStoreCap, targetReserve) - guardBoosts.stock(Game.rooms[targetRoom], thisMineral);
            targetStoreCap = (targetTerminal && targetTerminal.store[thisMineral] || 0) + Math.max(0, missing);
        }
        if (targetRoom === thisTerminal.room.name) return false;

        if (amountAvailable > 5000) {
            amountAvailable = 5000;
        }
        
        if (amountAvailable >= 100) {
            if (targetTerminal && !targetTerminal.store[thisMineral]) {
                if (amountAvailable > targetStoreCap) {
                    amountAvailable = targetStoreCap;
                }
                if (thisTerminal.send(thisMineral, amountAvailable, targetRoom, thisTerminal.room.name + " has gotchu, fam.") === OK) {
                    const thisRoomIndex = Memory.mineralNeed[thisMineral].indexOf(targetRoom);
                    if (thisRoomIndex !== -1) {
                        Memory.mineralNeed[thisMineral].splice(thisRoomIndex, 1);
                    }
                    return true;
                }
            } else if (targetTerminal && targetTerminal.store[thisMineral] && targetTerminal.store[thisMineral] < targetStoreCap) {
                let neededAmount = targetStoreCap - targetTerminal.store[thisMineral];
                if (neededAmount < 100) {
                    const thisRoomIndex = Memory.mineralNeed[thisMineral].indexOf(targetRoom);
                    if (thisRoomIndex !== -1) {
                        Memory.mineralNeed[thisMineral].splice(thisRoomIndex, 1);
                    }
                    return false;
                } else {
                    if (amountAvailable < neededAmount) {
                        neededAmount = amountAvailable;
                    }
                    if (neededAmount >= 100) {
                        if (thisTerminal.send(thisMineral, neededAmount, targetRoom, thisTerminal.room.name + " has gotchu, fam.") === OK) {
                            const thisRoomIndex = Memory.mineralNeed[thisMineral].indexOf(targetRoom);
                            if (thisRoomIndex !== -1) {
                                Memory.mineralNeed[thisMineral].splice(thisRoomIndex, 1);
                            }
                            return true;
                        }
                    }
                }
            } else if (targetTerminal && targetTerminal.store[thisMineral] && targetTerminal.store[thisMineral] >= targetStoreCap) {
                const thisRoomIndex = Memory.mineralNeed[thisMineral].indexOf(targetRoom);
                if (thisRoomIndex !== -1) {
                    Memory.mineralNeed[thisMineral].splice(thisRoomIndex, 1);
                }
            }
        }
    }
    return false;
}

function orderSellCompare(a, b) {
    if (a.price < b.price)
        return 1;
    if (a.price > b.price)
        return -1;
    return 0;
}

function orderBuyCompare(a, b) {
    if (a.price < b.price)
        return -1;
    if (a.price > b.price)
        return 1;
    return 0;
}
