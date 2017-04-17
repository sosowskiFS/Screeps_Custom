var market_buyers = {

	run: function(thisRoom, thisTerminal, thisMineral) {
		var TerminalEnergy = thisTerminal.store[RESOURCE_ENERGY];

		var neededMinerals = [];

		//Always requested minerals for boosts
		neededMinerals.push(RESOURCE_UTRIUM_ACID); //Attack boost, defenders
		neededMinerals.push(RESOURCE_GHODIUM_ACID); //Upgrade boost
		neededMinerals.push(RESOURCE_LEMERGIUM_ACID); //Repair boost
		//Check for production flags and request accordingly
		if (Game.flags[thisRoom.name + "UHProducer"]) {
			neededMinerals.push(RESOURCE_UTRIUM);
			neededMinerals.push(RESOURCE_HYDROGEN);
		}
		if (Game.flags[thisRoom.name + "UH2OProducer"]) {
			neededMinerals.push(RESOURCE_UTRIUM_HYDRIDE);
			neededMinerals.push(RESOURCE_HYDROXIDE);
		}
		if (Game.flags[thisRoom.name + "OHProducer"]) {
			neededMinerals.push(RESOURCE_OXYGEN);
			neededMinerals.push(RESOURCE_HYDROGEN);
		}

		for (var i in neededMinerals) {
			if (!Memory.mineralNeed[neededMinerals[i]]) {
				Memory.mineralNeed[neededMinerals[i]] = [];
			}
			if (!thisTerminal.store[neededMinerals[i]] || thisTerminal.store[neededMinerals[i]] < 10000) {
				if (Memory.mineralNeed[neededMinerals[i]].indexOf(thisRoom.name) == -1) {
					Memory.mineralNeed[neededMinerals[i]].push(thisRoom.name);
				}
			} else if (Memory.mineralNeed[neededMinerals[i]].indexOf(thisRoom.name) != -1) {
				var thisRoomIndex = Memory.mineralNeed[neededMinerals[i]].indexOf(thisRoom.name)
				Memory.mineralNeed[neededMinerals[i]].splice(thisRoomIndex, 1);
			}
		}

		if (TerminalEnergy >= 50000) {
			var currentMineral = Game.getObjectById(thisMineral);
			var MaxSaleAmount = 30000;
			var mineralInTerminal = thisTerminal.store[currentMineral.mineralType] - 20000;

			if (mineralInTerminal > MaxSaleAmount) {
				mineralInTerminal = MaxSaleAmount;
			}
			if (!Memory.PriceList[currentMineral.mineralType]) {
				//Initalize this memory object
				Memory.PriceList[currentMineral.mineralType] = 0;
			}

			//Memory.mineralNeed

			//Determine if excess minerals and distribute where needed
			//Memory.needMin room name
			//resource
			for (var y in Memory.mineralNeed) {
				//sendMineral(thisMineral, thisTerminal, targetRoom);
				if (Memory.mineralNeed[y].length) {
					sendMineral(y, thisTerminal, Memory.mineralNeed[y][0]);
				}
			}

			if (mineralInTerminal > 100 && TerminalEnergy >= 100000 && Game.time % 1000 == 0) {
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
					if (Memory.PriceList[currentMineral.mineralType] > 0) {
						Memory.PriceList[currentMineral.mineralType] = Memory.PriceList[currentMineral.mineralType] - 0.01;
					}
				}
			}
		}

	}
};

module.exports = market_buyers;

function sendMineral(thisMineral, thisTerminal, targetRoom) {
	if (thisTerminal.store[thisMineral] && thisTerminal.store[thisMineral] > 20000) {
		var targetTerminal = Game.rooms[targetRoom].terminal
		var amountAvailable = thisTerminal.store[thisMineral];
		if (amountAvailable > 20000) {
			amountAvailable = 20000;
		}
		if (amountAvailable >= 100) {
			if (targetTerminal && !targetTerminal.store[thisMineral]) {
				thisTerminal.send(thisMineral, amountAvailable, targetRoom, thisTerminal.room.name + " has gotchu, fam.");
			} else if (targetTerminal && targetTerminal.store[thisMineral] && targetTerminal.store[thisMineral] < 20000) {
				var neededAmount = 20000 - targetTerminal.store[thisMineral]
				if (amountAvailable < neededAmount) {
					neededAmount = amountAvailable
				}
				if (neededAmount > 100) {
					thisTerminal.send(thisMineral, neededAmount, targetRoom, thisTerminal.room.name + " has gotchu, fam.");
				}
			}
		}
	}
}

function orderPriceCompare(a, b) {
	if (a.price < b.price)
		return 1;
	if (a.price > b.price)
		return -1;
	return 0;
}