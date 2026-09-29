const runtimeCache = require('runtime.cache');
const { orderPriceCompareBuying } = require('util.common');

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
                        var comparableOrders = runtimeCache.marketOrders(creep.memory.mineral6, ORDER_SELL, order => order.resourceType == creep.memory.mineral6 && order.type == ORDER_SELL);
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
                        var comparableOrders = runtimeCache.marketOrders(creep.memory.mineral6, ORDER_SELL, order => order.resourceType == creep.memory.mineral6 && order.type == ORDER_SELL);
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
                    var comparableOrders = runtimeCache.marketOrders(creep.memory.mineral6, ORDER_SELL, order => order.resourceType == creep.memory.mineral6 && order.type == ORDER_SELL);
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
                        //Game.market.createOrder(ORDER_SELL, creep.memory.mineral6, targetPrice, creep.room.terminal.store[creep.memory.mineral6], creep.room.name);
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

module.exports = { DoResourceCheck };
