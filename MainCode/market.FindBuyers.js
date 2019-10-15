var market_buyers = {

    run: function(thisRoom, thisTerminal, thisMineral) {
        var TerminalEnergy = thisTerminal.store[RESOURCE_ENERGY];


        var neededMinerals = [];

        var GH2OPriority = -1;
        var ForNuker = true;
        //Always requested minerals for boosts
        if (thisRoom.controller.level >= 6) {
            neededMinerals.push(RESOURCE_CATALYZED_KEANIUM_ALKALIDE); //Ranged boost, defenders
            //if (thisRoom.controller.level != 8) {
            neededMinerals.push(RESOURCE_CATALYZED_GHODIUM_ACID); //Upgrade boost
            GH2OPriority = 0;
            neededMinerals.push(RESOURCE_CATALYZED_LEMERGIUM_ACID); //Repair boost
        }
        if (thisRoom.controller.level == 8) {
            neededMinerals.push(RESOURCE_GHODIUM);
        }
        var HydroxidePriority = -1;
        //Check for production flags and request accordingly
        //Flag room to transfer War Boosts
        if (Game.flags[thisRoom.name + "WarBoosts"]) {
            neededMinerals.push(RESOURCE_CATALYZED_UTRIUM_ACID);
            neededMinerals.push(RESOURCE_CATALYZED_KEANIUM_ALKALIDE);
            neededMinerals.push(RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE);
            neededMinerals.push(RESOURCE_CATALYZED_ZYNTHIUM_ACID);
            neededMinerals.push(RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE);
            neededMinerals.push(RESOURCE_CATALYZED_GHODIUM_ALKALIDE);
        } else if (Game.flags[thisRoom.name + "UHProducer"]) {
            neededMinerals.push(RESOURCE_UTRIUM);
            neededMinerals.push(RESOURCE_HYDROGEN);
        } else if (Game.flags[thisRoom.name + "UH2OProducer"]) {
            neededMinerals.push(RESOURCE_UTRIUM_HYDRIDE);
            neededMinerals.push(RESOURCE_HYDROXIDE);
            HydroxidePriority = 0;
        } else if (Game.flags[thisRoom.name + "OHProducer(3)"] || Game.flags[thisRoom.name + "OHProducer(9)"]) {
            neededMinerals.push(RESOURCE_OXYGEN);
            neededMinerals.push(RESOURCE_HYDROGEN);
        } else if (Game.flags[thisRoom.name + "ZKProducer"]) {
            neededMinerals.push(RESOURCE_ZYNTHIUM);
            neededMinerals.push(RESOURCE_KEANIUM);
        } else if (Game.flags[thisRoom.name + "ZOProducer"]) {
            neededMinerals.push(RESOURCE_ZYNTHIUM);
            neededMinerals.push(RESOURCE_OXYGEN);
        } else if (Game.flags[thisRoom.name + "ZHProducer"]) {
            neededMinerals.push(RESOURCE_ZYNTHIUM);
            neededMinerals.push(RESOURCE_HYDROGEN);
        } else if (Game.flags[thisRoom.name + "LHProducer"]) {
            neededMinerals.push(RESOURCE_LEMERGIUM);
            neededMinerals.push(RESOURCE_HYDROGEN);
        } else if (Game.flags[thisRoom.name + "LHProducer"]) {
            neededMinerals.push(RESOURCE_LEMERGIUM);
            neededMinerals.push(RESOURCE_OXYGEN);
        } else if (Game.flags[thisRoom.name + "ULProducer"]) {
            neededMinerals.push(RESOURCE_UTRIUM);
            neededMinerals.push(RESOURCE_LEMERGIUM);
        } else if (Game.flags[thisRoom.name + "GProducer(4)"] || Game.flags[thisRoom.name + "GProducer(9)"]) {
            neededMinerals.push(RESOURCE_UTRIUM_LEMERGITE);
            neededMinerals.push(RESOURCE_ZYNTHIUM_KEANITE);
        } else if (Game.flags[thisRoom.name + "GHProducer"]) {
            neededMinerals.push(RESOURCE_GHODIUM);
            ForNuker = false;
            neededMinerals.push(RESOURCE_HYDROGEN);
        } else if (Game.flags[thisRoom.name + "GOProducer"]) {
            neededMinerals.push(RESOURCE_GHODIUM);
            ForNuker = false;
            neededMinerals.push(RESOURCE_OXYGEN);
        } else if (Game.flags[thisRoom.name + "GHO2Producer"]) {
            neededMinerals.push(RESOURCE_GHODIUM_OXIDE);
            neededMinerals.push(RESOURCE_HYDROXIDE);
            HydroxidePriority = 2;
        } else if (Game.flags[thisRoom.name + "GH2OProducer"]) {
            neededMinerals.push(RESOURCE_GHODIUM_HYDRIDE);
            neededMinerals.push(RESOURCE_HYDROXIDE);
            HydroxidePriority = 0;
        } else if (Game.flags[thisRoom.name + "LH2OProducer"]) {
            neededMinerals.push(RESOURCE_LEMERGIUM_HYDRIDE);
            neededMinerals.push(RESOURCE_HYDROXIDE);
            HydroxidePriority = 2;
        } else if (Game.flags[thisRoom.name + "ZH2OProducer"]) {
            neededMinerals.push(RESOURCE_ZYNTHIUM_HYDRIDE);
            neededMinerals.push(RESOURCE_HYDROXIDE);
            HydroxidePriority = 2;
        } else if (Game.flags[thisRoom.name + "ZHO2Producer"]) {
            neededMinerals.push(RESOURCE_ZYNTHIUM_OXIDE);
            neededMinerals.push(RESOURCE_HYDROXIDE);
            HydroxidePriority = 2;
        } else if (Game.flags[thisRoom.name + "LHO2Producer"]) {
            neededMinerals.push(RESOURCE_LEMERGIUM_OXIDE);
            neededMinerals.push(RESOURCE_HYDROXIDE);
            HydroxidePriority = 2;
        } else if (Game.flags[thisRoom.name + "XUH2OProducer"]) {
            neededMinerals.push(RESOURCE_UTRIUM_ACID);
            neededMinerals.push(RESOURCE_CATALYST);
        } else if (Game.flags[thisRoom.name + "XZH2OProducer"]) {
            neededMinerals.push(RESOURCE_ZYNTHIUM_ACID);
            neededMinerals.push(RESOURCE_CATALYST);
        } else if (Game.flags[thisRoom.name + "XZHO2Producer"]) {
            neededMinerals.push(RESOURCE_ZYNTHIUM_ALKALIDE);
            neededMinerals.push(RESOURCE_CATALYST);
        } else if (Game.flags[thisRoom.name + "XGH2OProducer"]) {
            neededMinerals.push(RESOURCE_GHODIUM_ACID);
            neededMinerals.push(RESOURCE_CATALYST);
        } else if (Game.flags[thisRoom.name + "KOProducer"]) {
            neededMinerals.push(RESOURCE_OXYGEN);
            neededMinerals.push(RESOURCE_KEANIUM);
        } else if (Game.flags[thisRoom.name + "KHO2Producer"]) {
            neededMinerals.push(RESOURCE_KEANIUM_OXIDE);
            neededMinerals.push(RESOURCE_HYDROXIDE);
            HydroxidePriority = 2;
        } else if (Game.flags[thisRoom.name + "XKHO2Producer"]) {
            neededMinerals.push(RESOURCE_KEANIUM_ALKALIDE);
            neededMinerals.push(RESOURCE_CATALYST);
        } else if (Game.flags[thisRoom.name + "XGHO2Producer"]) {
            neededMinerals.push(RESOURCE_GHODIUM_ALKALIDE);
            neededMinerals.push(RESOURCE_CATALYST);
        } else if (Game.flags[thisRoom.name + "XLH2OProducer"]) {
            neededMinerals.push(RESOURCE_LEMERGIUM_ACID);
            neededMinerals.push(RESOURCE_CATALYST);
        } else if (Game.flags[thisRoom.name + "XLHO2Producer"]) {
            neededMinerals.push(RESOURCE_LEMERGIUM_ALKALIDE);
            neededMinerals.push(RESOURCE_CATALYST);
        } else if (Game.flags[thisRoom.name + "LOProducer"]) {
            neededMinerals.push(RESOURCE_LEMERGIUM);
            neededMinerals.push(RESOURCE_OXYGEN);
        }

        for (var i in neededMinerals) {
            if (!Memory.mineralNeed[neededMinerals[i]]) {
                Memory.mineralNeed[neededMinerals[i]] = [];
            }
            var mineralCap = 5000;
            if (!thisTerminal.store[neededMinerals[i]] || thisTerminal.store[neededMinerals[i]] < mineralCap) {
                if (Memory.mineralNeed[neededMinerals[i]].indexOf(thisRoom.name) == -1) {
                    if ((neededMinerals[i] == RESOURCE_CATALYZED_GHODIUM_ACID && GH2OPriority == 0) || (neededMinerals[i] == RESOURCE_HYDROXIDE && HydroxidePriority == 0)) {
                        Memory.mineralNeed[neededMinerals[i]].splice(0, 0, thisRoom.name);
                    } else {
                        Memory.mineralNeed[neededMinerals[i]].push(thisRoom.name);
                    }
                }
            } else if (Memory.mineralNeed[neededMinerals[i]].indexOf(thisRoom.name) != -1) {
                var thisRoomIndex = Memory.mineralNeed[neededMinerals[i]].indexOf(thisRoom.name)
                Memory.mineralNeed[neededMinerals[i]].splice(thisRoomIndex, 1);
            }
        }

        if (TerminalEnergy >= 5000) {
            var currentMineral = Game.getObjectById(thisMineral);


            //Memory.mineralNeed

            //Determine if excess minerals and distribute where needed
            //Memory.needMin room name
            //resource
            var hasSent = false;
            if (Game.time % 1000 == 0) {
                for (var y in Memory.mineralNeed) {
                    if (y == RESOURCE_CATALYZED_GHODIUM_ACID && thisRoom.controller.level < 8) {
                        //No
                        continue;
                    }
                    //sendMineral(thisMineral, thisTerminal, targetRoom);
                    if (hasSent) {
                        break;
                    } else if (Memory.mineralNeed[y].length) {
                        if (neededMinerals.indexOf(y) != -1) {
                            if (y == RESOURCE_GHODIUM) {
                                hasSent = sendMineral(y, thisTerminal, Memory.mineralNeed[y][0], true, ForNuker);
                            } else {
                                hasSent = sendMineral(y, thisTerminal, Memory.mineralNeed[y][0], true, false);
                            }
                        } else {
                            if (y == RESOURCE_GHODIUM) {
                                hasSent = sendMineral(y, thisTerminal, Memory.mineralNeed[y][0], false, ForNuker);
                            } else {
                                hasSent = sendMineral(y, thisTerminal, Memory.mineralNeed[y][0], false, false);
                            }
                        }
                    }
                }
            }

            if (!hasSent && TerminalEnergy >= 50000 && Memory.energyNeedRooms.length && Memory.energyNeedRooms[0] != thisRoom.name && thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] >= 250000) {
                //Send energy to requesting room
                let targetTerminal = Game.rooms[Memory.energyNeedRooms[0]].terminal
                let amountAvailable = TerminalEnergy - 30000;
                let targetStoreCap = 60000;
                if (targetTerminal) {
                    let amountToSend = 30000;
                    if (targetTerminal.store[RESOURCE_ENERGY]) {
                        amountToSend = targetStoreCap - targetTerminal.store[RESOURCE_ENERGY];
                    }
                    if (amountToSend > amountAvailable) {
                        amountToSend = amountAvailable
                    }
                    if (amountToSend >= 5000 && thisTerminal.send(RESOURCE_ENERGY, amountToSend, Memory.energyNeedRooms[0], thisTerminal.room.name + " has gotchu, fam.") == OK) {
                        //Game.notify('SUPPLY: ' + thisRoom.name + ' -> ' + Memory.energyNeedRooms[0] + '|' + amountToSend + 'u');
                        Memory.energyNeedRooms.splice(0, 1);
                        hasSent = true;
                    }
                } else {
                    //No terminal, remove this room from the list
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

            var sellMinerals = [RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM, RESOURCE_LEMERGIUM, RESOURCE_KEANIUM, RESOURCE_ZYNTHIUM, RESOURCE_CATALYST, RESOURCE_UTRIUM_BAR, RESOURCE_LEMERGIUM_BAR, RESOURCE_ZYNTHIUM_BAR, RESOURCE_KEANIUM_BAR, RESOURCE_OXIDANT, RESOURCE_REDUCTANT, RESOURCE_PURIFIER];

            var sellEnergyCap = 30000;
            var keepAmount = 20000;
            var MaxSaleAmount = 30000;
            if (thisTerminal.store.getFreeCapacity() <= 5000) {
                sellEnergyCap = 10000;
                keepAmount = 3000;
                MaxSaleAmount = TerminalEnergy + 5000;
            }
            if (!hasSent && TerminalEnergy >= sellEnergyCap && Game.time % 1000 == 0) {
                for (var y in sellMinerals) {
                    let mineralInTerminal = thisTerminal.store[sellMinerals[y]] - keepAmount;
                    if (mineralInTerminal > 100) {
                        if (mineralInTerminal > MaxSaleAmount) {
                            mineralInTerminal = MaxSaleAmount;
                        }
                        if (!Memory.PriceList[sellMinerals[y]]) {
                            //Initalize this memory object
                            Memory.PriceList[sellMinerals[y]] = 0;
                        }
                        var FilteredOrders = Game.market.getAllOrders(order => order.resourceType == sellMinerals[y] && order.amount >= 100 && order.type == ORDER_BUY && order.price >= Memory.PriceList[sellMinerals[y]] && Game.market.calcTransactionCost(mineralInTerminal, thisRoom.name, order.roomName) <= TerminalEnergy && Memory.ordersFilled.indexOf(order.id) == -1)
                        if (FilteredOrders.length > 0) {
                            FilteredOrders.sort(orderSellCompare);
                            var tradeAmount = FilteredOrders[0].amount;
                            if (mineralInTerminal < tradeAmount) {
                                tradeAmount = mineralInTerminal;
                            }
                            if (Game.market.deal(FilteredOrders[0].id, tradeAmount, thisRoom.name) == OK) {
                                //console.log('DEAL: ' + thisRoom.name + '|' + sellMinerals[y] + '|' + tradeAmount + 'u');
                                Memory.PriceList[sellMinerals[y]] = FilteredOrders[0].price;
                                if (Memory.ordersFilled.indexOf(FilteredOrders[0].id) == -1) {
                                    Memory.ordersFilled.push(FilteredOrders[0].id);
                                }
                                break;
                            }
                        } else {
                            //No orders were found with mineral in the terminal, with MAX ENERGY in the terminal. Drop the price a bit
                            if (Memory.PriceList[sellMinerals[y]] > 0) {
                                Memory.PriceList[sellMinerals[y]] = Memory.PriceList[sellMinerals[y]] - 0.01;
                            }
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
        let targetTerminal = Game.rooms[targetRoom].terminal
        let amountAvailable = thisTerminal.store[thisMineral];
        let targetStoreCap = 5000;
        if (saveFlag) {
            if (thisMineral == RESOURCE_GHODIUM || thisMineral == RESOURCE_CATALYZED_KEANIUM_ALKALIDE) {
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
                    amountAvailable = targetStoreCap
                }
                if (thisTerminal.send(thisMineral, amountAvailable, targetRoom, thisTerminal.room.name + " has gotchu, fam.") == OK) {
                    let thisRoomIndex = Memory.mineralNeed[thisMineral].indexOf(targetRoom);
                    if (thisRoomIndex != -1) {
                        Memory.mineralNeed[thisMineral].splice(thisRoomIndex, 1);
                    }
                    return true;
                }
            } else if (targetTerminal && targetTerminal.store[thisMineral] && targetTerminal.store[thisMineral] < targetStoreCap) {
                let neededAmount = targetStoreCap - targetTerminal.store[thisMineral]
                if (neededAmount < 100) {
                    let thisRoomIndex = Memory.mineralNeed[thisMineral].indexOf(targetRoom);
                    if (thisRoomIndex != -1) {
                        Memory.mineralNeed[thisMineral].splice(thisRoomIndex, 1);
                    }
                    return false;
                } else {
                    if (amountAvailable < neededAmount) {
                        neededAmount = amountAvailable
                    }
                    if (neededAmount >= 100) {
                        if (thisTerminal.send(thisMineral, neededAmount, targetRoom, thisTerminal.room.name + " has gotchu, fam.") == OK) {
                            var thisRoomIndex = Memory.mineralNeed[thisMineral].indexOf(targetRoom);
                            if (thisRoomIndex != -1) {
                                Memory.mineralNeed[thisMineral].splice(thisRoomIndex, 1);
                            }
                            return true;
                        }
                    }
                }

            } else if (targetTerminal && targetTerminal.store[thisMineral] && targetTerminal.store[thisMineral] >= targetStoreCap) {
                var thisRoomIndex = Memory.mineralNeed[thisMineral].indexOf(targetRoom);
                if (thisRoomIndex != -1) {
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