const runtimeCache = require('runtime.cache');
// system.market — Screeps tick subsystem.
const { orderSellCompare, orderBuyCompare } = require('util.common');

function handleMarketOperations() {
    if (Game.time % 50 == 0) {
        //Periodically place buy orders for CPU unlocks
        //Check for existing order, ignore orders that have already been filled.
        let existingOrder = _.findKey(Game.market.orders, function(thisOrder) {
            return thisOrder.resourceType == CPU_UNLOCK && thisOrder.type == "buy" && thisOrder.remainingAmount >= 1
        });
        let existingPrice = undefined;
        let didDeal = false;
        if (existingOrder) {
            existingPrice = Game.market.orders[existingOrder].price;

            let sellOrders = runtimeCache.marketOrders(CPU_UNLOCK, ORDER_SELL, order => order.resourceType == CPU_UNLOCK && order.type == ORDER_SELL && order.price <= existingPrice);
            //Something is lower than our current offer
            if (sellOrders.length) {
                sellOrders.sort(orderBuyCompare);
                Game.market.deal(sellOrders[0].id, 1);
                didDeal = true;
            }
        }
        if (!didDeal){
            //Look for highest buy order, ignoring existing order.
            let comparableOrders = runtimeCache.marketOrders(CPU_UNLOCK, ORDER_BUY, order => order.resourceType == CPU_UNLOCK && order.type == ORDER_BUY);
            let targetPrice = 0;
            if (comparableOrders.length > 0) {
                comparableOrders.sort(orderSellCompare);
                targetPrice = comparableOrders[0].price;
                if (existingOrder && existingPrice <= targetPrice) {
                    //Current offer is lower, raise it.
                    //Determine if this is affordable
                    targetPrice += 0.001
                    if (Game.market.credits >= (targetPrice - existingPrice) * 0.05) {
                        Game.market.changeOrderPrice(existingOrder, targetPrice);
                    }
                } else if (!existingOrder) {
                    //Determine if you can afford to compete
                    targetPrice += 0.001;
                    if (Game.market.credits >= (targetPrice * 0.05) + targetPrice) {
                        //Create new order better than highest comparable one
                        Game.market.createOrder({
                            type: ORDER_BUY,
                            resourceType: CPU_UNLOCK,
                            price: targetPrice + 0.001,
                            totalAmount: 1
                        })
                    }
                }
            }
        }

        //Sell Pixels
        if (Game.resources[PIXEL] >= 100) {
            let PixelOrders = runtimeCache.marketOrders(PIXEL, ORDER_BUY, order => order.resourceType == PIXEL && order.type == ORDER_BUY);
            if (PixelOrders.length > 0) {
                PixelOrders.sort(orderSellCompare);
                let sellAmount = Game.resources[PIXEL];
                if (sellAmount > PixelOrders[0].amount) {
                    sellAmount = PixelOrders[0].amount;
                }
                Game.market.deal(PixelOrders[0].id, sellAmount)
            }
        }
    }
}

function handleCPUUnlocking() {
    if (Game.shard.name == 'shard2') {
        let today = new Date();
        if (!Game.cpu.unlockedTime || (Game.cpu.unlockedTime - 600000) <= today.valueOf()) {
            Game.cpu.unlock()

            let date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate() + ' | ' + today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
            Game.notify('CPU Token Used. ' + date);
        }
    }
}

module.exports = { handleMarketOperations, handleCPUUnlocking };
