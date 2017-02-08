var market_buyers = {

    run: function(thisRoom, thisTerminal, thisMineral) {
        var TerminalEnergy = thisTerminal.store[RESOURCE_ENERGY];
        var currentMineral = Game.getObjectById(thisMineral);
        var mineralInTerminal = thisTerminal.store[currentMineral.mineralType];
        var MaxSaleAmount = 30000;
        if (mineralInTerminal > MaxSaleAmount) {
            mineralInTerminal = MaxSaleAmount;
        }
        if (!Memory.PriceList[currentMineral.mineralType]) {
            //Initalize this memory object
            Memory.PriceList[currentMineral.mineralType] = 0;
        }
        if (mineralInTerminal > 0 && TerminalEnergy >= 100000) {
            var FilteredOrders = Game.market.getAllOrders(order => order.resourceType == currentMineral.mineralType && order.type == ORDER_BUY && order.price >= Memory.PriceList[currentMineral.mineralType] && Game.market.calcTransactionCost(mineralInTerminal, thisRoom.name, order.roomName) <= TerminalEnergy)
            if (FilteredOrders.length > 0) {
                FilteredOrders.sort(orderPriceCompare);
                var tradeAmount = FilteredOrders[0].amount;
                if (mineralInTerminal < tradeAmount) {
                    tradeAmount = mineralInTerminal;
                }
                if (Game.market.deal(FilteredOrders[0].id, tradeAmount, thisRoom.name) == OK) {
                    console.log('Successfully made a deal');
                    Memory.PriceList[currentMineral.mineralType] = FilteredOrders[0].price;
                }
            } else {
                //No orders were found with mineral in the terminal, with MAX ENERGY in the terminal. Drop the price a bit
                if (Memory.PriceList[currentMineral.mineralType] > 0 && TerminalEnergy >= 100000) {
                    Memory.PriceList[currentMineral.mineralType] = Memory.PriceList[currentMineral.mineralType] - 0.01;
                }              
            }
        }
    }
};

module.exports = market_buyers;

function orderPriceCompare(a, b) {
    if (a.price < b.price)
        return 1;
    if (a.price > b.price)
        return -1;
    return 0;
}