var market_buyers = {

    run: function(thisRoom, thisTerminal, thisMineral) {
        var TerminalEnergy = thisTerminal.store[RESOURCE_ENERGY];
        var currentMineral = Game.getObjectById(thisMineral);
        var mineralInTerminal = thisTerminal.store[currentMineral.mineralType];
        var MaxSaleAmount = 50000;
        if (mineralInTerminal > MaxSaleAmount) {
            mineralInTerminal = MaxSaleAmount;
        }
        var targetPrice = 0.16;
        switch (currentMineral.mineralType) {
            case RESOURCE_ZYNTHIUM:
                targetPrice = 0.16;
                break;
            case RESOURCE_HYDROGEN:
                targetPrice = 0.7;
                break;
            case RESOURCE_LEMERGIUM:
                targetPrice = 0.2;
                break;
        }
        var FilteredOrders = Game.market.getAllOrders(order => order.resourceType == currentMineral.mineralType && order.type == ORDER_BUY && order.price >= targetPrice && Game.market.calcTransactionCost(mineralInTerminal, thisRoom.name, order.roomName) <= TerminalEnergy)
        if (FilteredOrders.length > 0) {
            FilteredOrders.sort(orderPriceCompare);
            var tradeAmount = FilteredOrders[0].amount;
            if (mineralInTerminal < tradeAmount) {
                tradeAmount = mineralInTerminal;
            }
            if (Game.market.deal(FilteredOrders[0].id, tradeAmount, thisRoom.name) == OK) {
                console.log('Successfully made a deal');
            }
        }
    }
};

module.exports = market_buyers;

function orderPriceCompare(a, b) {
    if (a.price < b.price)
        return -1;
    if (a.price > b.price)
        return 1;
    return 0;
}