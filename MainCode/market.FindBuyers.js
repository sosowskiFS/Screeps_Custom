var market_buyers = {

    run: function(thisRoom, thisTerminal, thisMineral) {
        var TerminalEnergy = thisTerminal.store[RESOURCE_ENERGY];
        var mineralInTerminal = thisTerminal.store[thisMineral];
        var FilteredOrders = Game.market.getAllOrders(order => order.resourceType == thisMineral && order.type == ORDER_BUY && order.price >= 0.18 && Game.market.calcTransactionCost(mineralInTerminal, thisRoom.name, order.roomName) <= TerminalEnergy)
        if (FilteredOrders.length > 0) {
            FilteredOrders.sort(orderPriceCompare);
            var tradeAmount = FilteredOrders[0].amount;
            if (mineralInTerminal < tradeAmount) {
                tradeAmount = mineralInTerminal;
            }
            if (Game.market.deal(FilteredOrders[0].id, amount, thisRoom.name) == OK) {
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