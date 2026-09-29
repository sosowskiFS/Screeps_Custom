// util.common — Screeps tick subsystem.


function orderPriceCompare(a, b) {
    if (a.price < b.price)
        return 1;
    if (a.price > b.price)
        return -1;
    return 0;
}

function orderPriceCompareBuying(a, b) {
    if (a.price < b.price)
        return -1;
    if (a.price > b.price)
        return 1;
    return 0;
}

function flagWeightCompare(a, b) {
    if (a.weight < b.weight)
        return -1;
    if (a.weight > b.weight)
        return 1;
    return 0;
}

function repairCompare(a, b) {
    if (a.hits < b.hits)
        return -1;
    if (a.hits > b.hits)
        return 1;
    return 0;
}

function hiHitCompare(a, b) {
    if (a.hits < b.hits)
        return 1;
    if (a.hits > b.hits)
        return -1;
    return 0;
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

function getRoomAtOffset(xOffset, yOffset, roomName) {
    //Returns the name of the room that is x,y away from the submitted origin room name

    //Get origin room coordinates in numerical format
    let xx = parseInt(roomName.substr(1), 10);
    let verticalPos = 2;
    if (xx >= 100) {
        verticalPos = 4;
    } else if (xx >= 10) {
        verticalPos = 3;
    }
    let yy = parseInt(roomName.substr(verticalPos + 1), 10);
    let horizontalDir = roomName.charAt(0);
    let verticalDir = roomName.charAt(verticalPos);
    if (horizontalDir === 'W' || horizontalDir === 'w') {
        xx = -xx - 1;
    }
    if (verticalDir === 'N' || verticalDir === 'n') {
        yy = -yy - 1;
    }

    //Apply offset
    xx = xx + xOffset
    yy = yy + yOffset

    //Convert coordinates back to room name format
    let xName = ''
    let yName = ''
    if (xx >= 0) {
        xName = "E" + xx.toString()
    } else {
        xName = "W" + (-xx - 1).toString()
    }

    if (yy >= 0) {
        yName = "S" + yy.toString()
    } else {
        yName = "N" + (-yy - 1).toString()
    }

    return xName + yName;
}

module.exports = { orderPriceCompare, orderPriceCompareBuying, flagWeightCompare, repairCompare, hiHitCompare, orderSellCompare, orderBuyCompare, getRoomAtOffset };

// Stable first minimum: equivalent to sorting by hits and taking index zero.
function leastHits(values) {
    let best;
    for (const value of values) if (!best || value.hits < best.hits) best = value;
    return best;
}
module.exports.leastHits = leastHits;
