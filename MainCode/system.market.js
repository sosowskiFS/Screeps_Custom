const runtimeCache = require('runtime.cache');
// system.market — Screeps tick subsystem.
//
// - Sell orders (surplus T3 compounds, pixels): one order per resource for the whole empire,
//   priced just under the cheapest listing that is not ours. Price cuts are free and immediate;
//   raises cost MARKET_FEE x increase x remaining amount, so they wait for a gap worth it.
// - CPU unlocks: buy outright from asks when that is no dearer than our bid would be after its
//   5% fee, otherwise keep the top bid. Both are capped against the recent average price so a
//   bidding war or a spoofed listing cannot drag us up.
const labPlanner = require('system.labs');

const FEE = 0.05;                 // MARKET_FEE
const TICK = 0.001;               // price step used to undercut / outbid
const RAISE_MIN_FRACTION = 0.01;  // only pay the fee to raise a price by at least 1%
const MIN_COMPETITOR = 100;       // ignore crumbs of compounds when pricing (pixels/unlocks: 1)
const DEPTH_FRACTION = 0.25;      // competing volume that sets our price: 25% of what one of our orders offers
const FLOOR_FRACTION = 0.7;       // never list below 70% of the recent average price
const MIN_SELL_PRICE = 0.5;       // absolute floor for compounds (previous behaviour)
const HISTORY_TTL = 1000;         // ticks between Game.market.getHistory refreshes
const CREDIT_RESERVE = 5000;      // keep for listing fees
const UNLOCK_CEILING = 1.05;      // never bid/buy unlocks above 105% of their recent average
const UNLOCK_LOT = 5;             // unlocks per buy order
const MAX_UNLOCK_DEALS = 3;       // deals per run (10/tick game limit shared with room sales)
const PIXEL_MIN_LOT = 10;
const PIXEL_TAKE_BID = 0.95;      // a bid this close to our ask is sold into directly

const historyCache = {};          // heap: resource -> { at, price }

// Volume-weighted average of the market history (last ~14 days), or undefined.
function referencePrice(resource) {
    const cached = historyCache[resource];
    if (cached && Game.time - cached.at < HISTORY_TTL) return cached.price;
    let price;
    try {
        const history = Game.market.getHistory ? Game.market.getHistory(resource) : [];
        let volume = 0;
        let value = 0;
        for (const day of history || []) {
            volume += day.volume;
            value += day.avgPrice * day.volume;
        }
        price = volume > 0 ? value / volume : undefined;
    } catch (e) {
        price = undefined;
    }
    historyCache[resource] = { at: Game.time, price };
    return price;
}

function myOrders(resource, type) {
    const out = [];
    for (const id in Game.market.orders) {
        const order = Game.market.orders[id];
        if (order.resourceType === resource && order.type === type && order.remainingAmount > 0) out.push(order);
    }
    return out;
}

// Other players' orders. Ours are excluded by id, so our own rooms never compete.
function competitors(resource, type, minAmount) {
    return runtimeCache.marketOrders(resource, type, order =>
        !Game.market.orders[order.id] && order.amount >= minAmount && order.price > 0);
}

function lowestPrice(orders) {
    let low = Infinity;
    for (const o of orders) if (o.price < low) low = o.price;
    return low;
}

function highestPrice(orders) {
    let high = 0;
    for (const o of orders) if (o.price > high) high = o.price;
    return high;
}

function round(price) {
    return Math.round(price * 1000) / 1000;
}

// Price level of the competition that matters for an order of `volume`. Other sellers' orders
// are walked cheapest first and the level is where their combined amount reaches
// DEPTH_FRACTION of our volume. A token order (500 units against our 40,000) placed a tick
// under us to drag our price down is skipped: buyers clear it in one deal and then still
// pay our price. Infinity when nobody offers meaningful volume.
function competitiveLevel(resource, minAmount, volume) {
    const orders = competitors(resource, ORDER_SELL, minAmount).sort((a, b) => a.price - b.price);
    const needed = Math.max(minAmount, (volume || 0) * DEPTH_FRACTION);
    let depth = 0;
    for (const order of orders) {
        depth += order.amount;
        if (depth >= needed) return order.price;
    }
    return Infinity;
}

// Ask price for an order of `volume`: just under the competition that matters, never under the
// floor. Without meaningful competition: the current price, or the recent average if that is
// higher (recovers from a price dragged down by bait orders).
function sellPrice(resource, minAmount, absoluteFloor, current, volume) {
    const ref = referencePrice(resource);
    const floor = Math.max(absoluteFloor, ref ? ref * FLOOR_FRACTION : 0);
    const level = competitiveLevel(resource, minAmount, volume);
    if (level === Infinity) return round(Math.max(floor, current || 0, ref || 0));
    return round(Math.max(floor, level - TICK));
}

// Credits that raises may spend this run; shared so several orders cannot each pass the check
// against the same balance. Keeps CREDIT_RESERVE for unlocks and listing fees.
function raiseBudget() {
    return { credits: Game.market.credits - CREDIT_RESERVE };
}

// Move an order to `target`. Cuts are free; raises cost FEE x increase x remaining (on a 40,000
// order a +400 raise is 800,000 credits), so only when the gain is worth an intent and the
// budget covers it.
function reprice(order, target, budget) {
    const diff = round(target - order.price);
    if (diff === 0) return false;
    if (diff > 0) {
        if (diff < order.price * RAISE_MIN_FRACTION) return false;
        const fee = diff * order.remainingAmount * FEE;
        const available = budget ? budget.credits : Game.market.credits - CREDIT_RESERVE;
        if (available < fee) return false;
        if (Game.market.changeOrderPrice(order.id, target) !== OK) return false;
        if (budget) budget.credits -= fee;
        return true;
    }
    return Game.market.changeOrderPrice(order.id, target) === OK;
}

// Finished orders still occupy order slots and make every scan longer.
function cleanupOrders() {
    for (const id in Game.market.orders) {
        const order = Game.market.orders[id];
        if (order.remainingAmount <= 0) Game.market.cancelOrder(id);
    }
}

// ---------------------------------------------------------------- CPU unlocks

function buyCpuUnlocks() {
    const spendable = Game.market.credits - CREDIT_RESERVE;
    if (spendable <= 0) return;
    const ref = referencePrice(CPU_UNLOCK);
    const ceiling = ref ? ref * UNLOCK_CEILING : Infinity;
    const bid = myOrders(CPU_UNLOCK, ORDER_BUY)[0];

    // 1. Asks. A filled bid costs bid x (1 + FEE), so an ask at or under that is no worse, and
    //    an ask under the recent average is a bargain either way.
    const asks = competitors(CPU_UNLOCK, ORDER_SELL, 1).sort((a, b) => a.price - b.price);
    const takeBelow = Math.min(ceiling, Math.max(bid ? bid.price * (1 + FEE) : 0, ref || 0));
    let credits = spendable;
    let deals = 0;
    for (const ask of asks) {
        if (ask.price > takeBelow || deals >= MAX_UNLOCK_DEALS) break;
        const amount = Math.min(ask.amount, Math.floor(credits / ask.price));
        if (amount < 1) break;
        if (Game.market.deal(ask.id, amount) === OK) {
            credits -= amount * ask.price;
            deals++;
        }
    }
    if (deals) return;

    // 2. Bid: one tick over the best other bid, but under the cheapest ask (we would deal that
    //    instead) and under the ceiling.
    const topBid = highestPrice(competitors(CPU_UNLOCK, ORDER_BUY, 1));
    const lowAsk = lowestPrice(asks);
    let target = topBid > 0 ? topBid + TICK : (ref || 0);
    target = round(Math.min(target, lowAsk - TICK, ceiling));
    if (!(target > 0)) return;

    if (bid) {
        if (bid.price < target) {
            // Outbid: the raise fee is FEE x increase x remaining.
            if (credits >= (target - bid.price) * bid.remainingAmount * FEE + target) {
                Game.market.changeOrderPrice(bid.id, target);
            }
        } else if (bid.price > target + TICK) {
            // Paying more than needed (the bid above us went away): cutting is free.
            Game.market.changeOrderPrice(bid.id, target);
        }
        return;
    }
    const amount = Math.min(UNLOCK_LOT, Math.floor(credits / (target * (1 + FEE))));
    if (amount >= 1) {
        Game.market.createOrder({ type: ORDER_BUY, resourceType: CPU_UNLOCK, price: target, totalAmount: amount });
    }
}

// ---------------------------------------------------------------- selling

function sellPixels() {
    const owned = Game.resources[PIXEL] || 0;
    const order = myOrders(PIXEL, ORDER_SELL)[0];
    const ask = sellPrice(PIXEL, 1, 0, order && order.price, order ? order.remainingAmount : owned);
    if (!(ask > 0)) return;

    // A bid close to our ask: sell into it now instead of waiting.
    if (owned >= PIXEL_MIN_LOT) {
        const bids = competitors(PIXEL, ORDER_BUY, 1).sort((a, b) => b.price - a.price);
        if (bids.length && bids[0].price >= ask * PIXEL_TAKE_BID) {
            Game.market.deal(bids[0].id, Math.min(owned, bids[0].amount));
            return;
        }
    }

    if (order) {
        reprice(order, ask, raiseBudget());
        if (owned - order.remainingAmount >= PIXEL_MIN_LOT) {
            Game.market.extendOrder(order.id, owned - order.remainingAmount);
        }
    } else if (owned >= PIXEL_MIN_LOT && Game.market.credits >= ask * owned * FEE) {
        Game.market.createOrder({ type: ORDER_SELL, resourceType: PIXEL, price: ask, totalAmount: owned });
    }
}

// Surplus T3 compounds above the planner's keep level, listed from the room holding the most.
function sellCompounds() {
    const stock = labPlanner.empireStock();
    const budget = raiseBudget();
    for (const resource of labPlanner.SELLABLE) {
        const orders = myOrders(resource, ORDER_SELL);
        const surplus = labPlanner.surplus(resource, stock);
        if (orders.length) {
            // Volume of our biggest order: our orders sell one at a time, cheapest first.
            let volume = 0;
            let current = 0;
            for (const order of orders) {
                volume = Math.max(volume, order.remainingAmount);
                current = Math.max(current, order.price);
            }
            const ask = sellPrice(resource, MIN_COMPETITOR, MIN_SELL_PRICE, current, volume);
            // Smallest first: cheapest raises, so a short budget still moves the most orders.
            orders.sort((a, b) => a.remainingAmount - b.remainingAmount);
            for (const order of orders) reprice(order, ask, budget);
            continue;
        }
        if (surplus < 2000) continue;
        let room;
        for (const name in Game.rooms) {
            const r = Game.rooms[name];
            if (r.controller && r.controller.my && r.terminal &&
                (!room || (r.terminal.store[resource] || 0) > (room.terminal.store[resource] || 0))) room = r;
        }
        const amount = room ? Math.min(surplus, room.terminal.store[resource] || 0) : 0;
        if (amount < 1000) continue;
        const ask = sellPrice(resource, MIN_COMPETITOR, MIN_SELL_PRICE, 0, amount);
        if (budget.credits >= ask * amount * FEE) {
            budget.credits -= ask * amount * FEE;
            Game.market.createOrder({ type: ORDER_SELL, resourceType: resource, price: ask, totalAmount: amount, roomName: room.name });
        }
    }
}

function handleMarketOperations() {
    if (Game.time % 50 !== 0) return;
    cleanupOrders();
    buyCpuUnlocks();
    if (Game.time % 100 === 0) {
        sellPixels();
        sellCompounds();
    }
}

function handleCPUUnlocking() {
    if (Game.shard.name == 'shard2') {
        let today = new Date();
        // Without a token unlock() just fails; checking first also stops a notify every tick.
        if ((Game.resources[CPU_UNLOCK] || 0) < 1) return;
        if (!Game.cpu.unlockedTime || (Game.cpu.unlockedTime - 600000) <= today.valueOf()) {
            if (Game.cpu.unlock() !== OK) return;

            let date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate() + ' | ' + today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
            Game.notify('CPU Token Used. ' + date);
        }
    }
}

module.exports = { handleMarketOperations, handleCPUUnlocking, sellPrice, competitiveLevel, reprice, buyCpuUnlocks, sellPixels, sellCompounds, referencePrice };
