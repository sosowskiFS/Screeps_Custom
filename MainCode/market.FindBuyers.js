var market_buyers = {

    run: function(thisRoom, thisTerminal, thisMineral) {
        const TerminalEnergy = thisTerminal.store[RESOURCE_ENERGY];


        const neededMinerals = [];
        let GH2OPriority = -1;
        let ForNuker = true;
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

        // Mineral production flag mapping
        const flagMinerals = {
            "WarBoosts": [RESOURCE_CATALYZED_UTRIUM_ACID, RESOURCE_CATALYZED_KEANIUM_ALKALIDE, 
                         RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE, RESOURCE_CATALYZED_ZYNTHIUM_ACID,
                         RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE, RESOURCE_CATALYZED_GHODIUM_ALKALIDE],
            "UHProducer": [RESOURCE_UTRIUM, RESOURCE_HYDROGEN],
            "UH2OProducer": [RESOURCE_UTRIUM_HYDRIDE, RESOURCE_HYDROXIDE],
            "ZKProducer": [RESOURCE_ZYNTHIUM, RESOURCE_KEANIUM],
            "ZOProducer": [RESOURCE_ZYNTHIUM, RESOURCE_OXYGEN],
            "ZHProducer": [RESOURCE_ZYNTHIUM, RESOURCE_HYDROGEN],
            "LHProducer": [RESOURCE_LEMERGIUM, RESOURCE_HYDROGEN],
            "LOProducer": [RESOURCE_LEMERGIUM, RESOURCE_OXYGEN],
            "ULProducer": [RESOURCE_UTRIUM, RESOURCE_LEMERGIUM],
            "GHProducer": [RESOURCE_GHODIUM, RESOURCE_HYDROGEN],
            "GOProducer": [RESOURCE_GHODIUM, RESOURCE_OXYGEN],
            "GHO2Producer": [RESOURCE_GHODIUM_OXIDE, RESOURCE_HYDROXIDE],
            "GH2OProducer": [RESOURCE_GHODIUM_HYDRIDE, RESOURCE_HYDROXIDE],
            "LH2OProducer": [RESOURCE_LEMERGIUM_HYDRIDE, RESOURCE_HYDROXIDE],
            "ZH2OProducer": [RESOURCE_ZYNTHIUM_HYDRIDE, RESOURCE_HYDROXIDE],
            "ZHO2Producer": [RESOURCE_ZYNTHIUM_OXIDE, RESOURCE_HYDROXIDE],
            "LHO2Producer": [RESOURCE_LEMERGIUM_OXIDE, RESOURCE_HYDROXIDE],
            "XUH2OProducer": [RESOURCE_UTRIUM_ACID, RESOURCE_CATALYST],
            "XZH2OProducer": [RESOURCE_ZYNTHIUM_ACID, RESOURCE_CATALYST],
            "XZHO2Producer": [RESOURCE_ZYNTHIUM_ALKALIDE, RESOURCE_CATALYST],
            "XGH2OProducer": [RESOURCE_GHODIUM_ACID, RESOURCE_CATALYST],
            "KOProducer": [RESOURCE_OXYGEN, RESOURCE_KEANIUM],
            "KHO2Producer": [RESOURCE_KEANIUM_OXIDE, RESOURCE_HYDROXIDE],
            "XKHO2Producer": [RESOURCE_KEANIUM_ALKALIDE, RESOURCE_CATALYST],
            "XGHO2Producer": [RESOURCE_GHODIUM_ALKALIDE, RESOURCE_CATALYST],
            "XLH2OProducer": [RESOURCE_LEMERGIUM_ACID, RESOURCE_CATALYST],
            "XLHO2Producer": [RESOURCE_LEMERGIUM_ALKALIDE, RESOURCE_CATALYST]
        };

        // Check for production flags and request accordingly
        for (const [flagName, minerals] of Object.entries(flagMinerals)) {
            if (Game.flags[thisRoom.name + flagName] || 
                (flagName === "OHProducer" && (Game.flags[thisRoom.name + "OHProducer(3)"] || Game.flags[thisRoom.name + "OHProducer(9)"])) ||
                (flagName === "GProducer" && (Game.flags[thisRoom.name + "GProducer(4)"] || Game.flags[thisRoom.name + "GProducer(9)"]))) {
                
                neededMinerals.push(...minerals);
                
                // Set special flags
                if (flagName === "UH2OProducer" || flagName === "GH2OProducer") {
                    HydroxidePriority = 0;
                } else if (flagName.includes("HO2Producer") || flagName.includes("H2OProducer")) {
                    HydroxidePriority = 2;
                } else if (flagName === "GHProducer" || flagName === "GOProducer") {
                    ForNuker = false;
                }
                break;
            }
        }

        // Handle special cases
        if (Game.flags[thisRoom.name + "OHProducer(3)"] || Game.flags[thisRoom.name + "OHProducer(9)"]) {
            neededMinerals.push(RESOURCE_OXYGEN, RESOURCE_HYDROGEN);
        } else if (Game.flags[thisRoom.name + "GProducer(4)"] || Game.flags[thisRoom.name + "GProducer(9)"]) {
            neededMinerals.push(RESOURCE_UTRIUM_LEMERGITE, RESOURCE_ZYNTHIUM_KEANITE);
        }

        // Process mineral needs
        for (const mineral of neededMinerals) {
            if (!Memory.mineralNeed[mineral]) {
                Memory.mineralNeed[mineral] = [];
            }
            const mineralCap = 5000;
            const currentAmount = thisTerminal.store[mineral] || 0;
            const roomIndex = Memory.mineralNeed[mineral].indexOf(thisRoom.name);
            
            if (currentAmount < mineralCap) {
                if (roomIndex === -1) {
                    if ((mineral === RESOURCE_CATALYZED_GHODIUM_ACID && GH2OPriority === 0) || 
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
                        const isGhodium = mineral === RESOURCE_GHODIUM;
                        
                        hasSent = sendMineral(mineral, thisTerminal, Memory.mineralNeed[mineral][0], isNeeded, isGhodium && ForNuker);
                    }
                }
            }

            if (!hasSent && TerminalEnergy >= 50000 && Memory.energyNeedRooms.length && Memory.energyNeedRooms[0] !== thisRoom.name && thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] >= 250000) {
                // Send energy to requesting room
                const targetTerminal = Game.rooms[Memory.energyNeedRooms[0]].terminal;
                const amountAvailable = TerminalEnergy - 30000;
                const targetStoreCap = 60000;
                
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
                let XGH2OSellers = Game.market.getAllOrders(order => order.resourceType == RESOURCE_CATALYZED_GHODIUM_ACID && order.amount >= 100 && order.price <= 4.0 && order.type == ORDER_SELL && Game.market.calcTransactionCost(order.amount, thisRoom.name, order.roomName) <= TerminalEnergy && Memory.ordersFilled.indexOf(order.id) == -1)
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

            const sellMinerals = [RESOURCE_UTRIUM_BAR, RESOURCE_LEMERGIUM_BAR, RESOURCE_ZYNTHIUM_BAR, RESOURCE_KEANIUM_BAR, RESOURCE_OXIDANT, RESOURCE_REDUCTANT, RESOURCE_PURIFIER, RESOURCE_MIST, RESOURCE_BIOMASS, RESOURCE_METAL, RESOURCE_SILICON, RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_ZYNTHIUM, RESOURCE_KEANIUM, RESOURCE_UTRIUM, RESOURCE_LEMERGIUM];
            const noStoreMinerals = [RESOURCE_UTRIUM_BAR, RESOURCE_LEMERGIUM_BAR, RESOURCE_ZYNTHIUM_BAR, RESOURCE_KEANIUM_BAR, RESOURCE_OXIDANT, RESOURCE_REDUCTANT, RESOURCE_PURIFIER, RESOURCE_MIST, RESOURCE_BIOMASS, RESOURCE_METAL, RESOURCE_SILICON];

            const sellEnergyCap = thisTerminal.store.getFreeCapacity() <= 5000 ? 10000 : 30000;
            const MaxSaleAmount = thisTerminal.store.getFreeCapacity() <= 5000 ? TerminalEnergy + 5000 : 30000;
            const panicSell = thisTerminal.store.getFreeCapacity() <= 5000;
            
            if (!hasSent && TerminalEnergy >= sellEnergyCap && (Game.time % 1000 === 0 || panicSell)) {
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
                        
                        const FilteredOrders = Game.market.getAllOrders(order => 
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

function sendMineral(thisMineral, thisTerminal, targetRoom, saveFlag, nukerLimit) {
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