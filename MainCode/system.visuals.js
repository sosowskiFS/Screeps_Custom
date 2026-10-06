const { visualsEnabled } = require('runtime.config');
const roomCpu = require('runtime.roomCpu');
// system.visuals — Screeps tick subsystem.


function displayGeneralPieGraphs() {
    if (!visualsEnabled()) return;
    let vis = new RoomVisual();
    // GCL
    drawPie(vis, Math.round(Game.gcl.progress), Game.gcl.progressTotal, 'GCL ' + Game.gcl.level, getColourByPercentage(Game.gcl.progress / Game.gcl.progressTotal, true), 2, 0.5);
    // Bucket
    drawPie(vis, Game.cpu.bucket, 10000, 'Bucket', getColourByPercentage(Math.min(1, Game.cpu.bucket / 10000), true), 5, 0.5);
    // CPU Average
    drawPie(vis, Math.round(Memory.CPUAverages.TotalCPU.CPU * 100) / 100, Game.cpu.limit, 'Average', getColourByPercentage(Math.min(1, Memory.CPUAverages.TotalCPU.CPU / Game.cpu.limit), false), 2, 1.5);
}

function displayRoomInfo(thisRoom) {
    if (!visualsEnabled()) {
        if (thisRoom.storage && thisRoom.storage.store[RESOURCE_ENERGY] <= 40000) {
            Memory.LastNotification = Game.time.toString() + ' : ' + thisRoom.name + ' Energy levels are critically low!';
        }
        return;
    }
    let roomVis = new RoomVisual(thisRoom.name);

    // Room CPU: this base's creeps (by home room) plus its structures, next to the shard Average.
    if (roomCpu.enabled()) {
        const roomAverage = roomCpu.average(thisRoom.name);
        drawPie(roomVis, Math.round(roomAverage * 100) / 100, Game.cpu.limit, 'Room CPU',
            getColourByPercentage(Math.min(1, roomAverage / Game.cpu.limit), false), 5, 1.5);
    }

    //Controller Progress + Storage Amount + CPU Average
    if (thisRoom.storage) {
        if (thisRoom.controller.level < 8) {
            drawPie(roomVis, Math.round(thisRoom.controller.progress), thisRoom.controller.progressTotal, 'RCL ' + thisRoom.controller.level, getColourByPercentage(thisRoom.controller.progress / thisRoom.controller.progressTotal, true), 2, 3.5);
            if (thisRoom.storage) {
                drawPie(roomVis, Math.round(thisRoom.storage.store[RESOURCE_ENERGY]), thisRoom.storage.store.getCapacity(), 'Energy', getColourByPercentage(thisRoom.storage.store[RESOURCE_ENERGY] / thisRoom.storage.store.getCapacity(), true), 2, 2.5);
                if (thisRoom.storage.store[RESOURCE_ENERGY] <= 40000) {
                    Memory.LastNotification = Game.time.toString() + ' : ' + thisRoom.name + ' Energy levels are critically low!'
                }
            }
        } else if (thisRoom.storage) {
            drawPie(roomVis, Math.round(thisRoom.storage.store[RESOURCE_ENERGY]), thisRoom.storage.store.getCapacity(), 'Energy', getColourByPercentage(thisRoom.storage.store[RESOURCE_ENERGY] / thisRoom.storage.store.getCapacity(), true), 2, 2.5);
            if (thisRoom.storage.store[RESOURCE_ENERGY] <= 40000) {
                Memory.LastNotification = Game.time.toString() + ' : ' + thisRoom.name + ' Energy levels are critically low!'
            }
        }
        Game.map.visual.text("\u{26A1}" + formatNumber(Math.round(thisRoom.storage.store[RESOURCE_ENERGY])), new RoomPosition(1, 1, thisRoom.name), { color: '#FFFFFF', backgroundColor: '#000000' })
        if (thisRoom.storage.store[RESOURCE_POWER]) {
           Game.map.visual.text("\u{2622}" + formatNumber(Math.round(thisRoom.storage.store[RESOURCE_POWER])), new RoomPosition(49, 49, thisRoom.name), { color: '#FFFFFF', backgroundColor: '#000000' })
        }
        if (Memory.repairTarget[thisRoom.name]) {
            let damagedStructure = Game.getObjectById(Memory.repairTarget[thisRoom.name]);
            if (damagedStructure && damagedStructure.structureType != STRUCTURE_CONTAINER) {
                Game.map.visual.text("\u{1F6E1}" + formatNumber(Math.round(damagedStructure.hits)), new RoomPosition(1, 49, thisRoom.name), { color: '#FFFFFF', backgroundColor: '#000000' })
            }
        }
    }
}

function DisplayBoostTotals() {
    if (!visualsEnabled()) return;
    //Left Box (T3 Boosts)
    let fillColor = '#2d68a0';
    if (Memory.warMode) {
        fillColor = '#9c2d34';
    }

    new RoomVisual().rect(0, 39, 6, 9.5, {
        fill: fillColor,
        stroke: '#FFFFFF',
        opacity: 0.15,
        strokeWidth: 0.15
    });

    let defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#33D5F6', stroke: '#000000', strokeWidth: 0.15 };
    new RoomVisual().text("SMACK : " + formatNumber(Memory.mineralTotals[RESOURCE_CATALYZED_UTRIUM_ACID]), 0.5, 40, defaultSettings);
    defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#a16df8', stroke: '#000000', strokeWidth: 0.15 };
    new RoomVisual().text("SHOOT : " + formatNumber(Memory.mineralTotals[RESOURCE_CATALYZED_KEANIUM_ALKALIDE]), 0.5, 41, defaultSettings);
    defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#00f4a7', stroke: '#000000', strokeWidth: 0.15 };
    new RoomVisual().text("REPAR : " + formatNumber(Memory.mineralTotals[RESOURCE_CATALYZED_LEMERGIUM_ACID]), 0.5, 47, defaultSettings);
    new RoomVisual().text("HEAL  : " + formatNumber(Memory.mineralTotals[RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE]), 0.5, 42, defaultSettings);
    defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#ffd38e', stroke: '#000000', strokeWidth: 0.15 };
    new RoomVisual().text("DECON : " + formatNumber(Memory.mineralTotals[RESOURCE_CATALYZED_ZYNTHIUM_ACID]), 0.5, 43, defaultSettings);
    new RoomVisual().text("MOVE  : " + formatNumber(Memory.mineralTotals[RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE]), 0.5, 44, defaultSettings);
    defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#ffffff', stroke: '#000000', strokeWidth: 0.15 };
    new RoomVisual().text("TOUGH : " + formatNumber(Memory.mineralTotals[RESOURCE_CATALYZED_GHODIUM_ALKALIDE]), 0.5, 45, defaultSettings);
    new RoomVisual().text("UPGRA : " + formatNumber(Memory.mineralTotals[RESOURCE_CATALYZED_GHODIUM_ACID]), 0.5, 48, defaultSettings);

    //Show time for debugging
    new RoomVisual().rect(36.5, 46, 8, 1, {
        fill: fillColor,
        stroke: '#FFFFFF',
        opacity: 0.15,
        strokeWidth: 0.15
    });
    new RoomVisual().text("TIME : " + Game.time.toString(), 36.7, 46.7, {
        align: 'left',
        font: '0.7 Courier New',
        color: '#FFFFFF',
        stroke: '#000000',
        strokeWidth: 0.15
    });

    // CPU governor: shown only while it is shedding work (see runtime.cpuGovernor).
    const governorState = Memory.cpuGov;
    if (governorState && governorState.shed > 0) {
        new RoomVisual().rect(36.5, 44.8, 8, 1, {
            fill: '#9c6a2d',
            stroke: '#FFFFFF',
            opacity: 0.15,
            strokeWidth: 0.15
        });
        new RoomVisual().text("CPU SHED " + governorState.shed + " : " + (Math.round(governorState.ema * 10) / 10), 36.7, 45.5, {
            align: 'left',
            font: '0.7 Courier New',
            color: '#ffd38e',
            stroke: '#000000',
            strokeWidth: 0.15
        });
    }

    if (Memory.warMode) {
        new RoomVisual().rect(6.5, 46, 7.1, 1, {
            fill: fillColor,
            stroke: '#FFFFFF',
            opacity: 0.15,
            strokeWidth: 0.15
        });
        new RoomVisual().text("WAR MODE ENABLED", 6.7, 46.7, {
            align: 'left',
            font: '0.7 Courier New',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeWidth: 0.15
        });
    }

    //Middle Box (Last Notification)
    new RoomVisual().rect(6.5, 47.5, 38, 1, {
        fill: fillColor,
        stroke: '#FFFFFF',
        opacity: 0.15,
        strokeWidth: 0.15
    });
    if (!Memory.LastNotification) {
        defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#00f4a7', stroke: '#000000', strokeWidth: 0.15 };
        new RoomVisual().text("This is where news would go. IF I HAD ANY.", 6.7, 48.2, defaultSettings);
    } else {
        defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#FFFFFF', stroke: '#000000', strokeWidth: 0.15 };
        if (Memory.LastNotification.includes("tresspassing") || Memory.LastNotification.includes("attack") || Memory.LastNotification.includes("critically")) {
            defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#ff7a7b', stroke: '#000000', strokeWidth: 0.15 };
        }
        new RoomVisual().text(Memory.LastNotification, 6.7, 48.2, defaultSettings);
    }


    //Right Box (Minerals)
    new RoomVisual().rect(45, 41, 4, 7.5, {
        fill: fillColor,
        stroke: '#FFFFFF',
        opacity: 0.15,
        strokeWidth: 0.15
    });

    defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#FFFFFF', stroke: '#000000', strokeWidth: 0.15 };
    new RoomVisual().text("H : " + formatNumber(Memory.mineralTotals[RESOURCE_HYDROGEN]), 45.3, 42, defaultSettings);
    new RoomVisual().text("O : " + formatNumber(Memory.mineralTotals[RESOURCE_OXYGEN]), 45.3, 43, defaultSettings);
    defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#ffd38e', stroke: '#000000', strokeWidth: 0.15 };
    new RoomVisual().text("Z : " + formatNumber(Memory.mineralTotals[RESOURCE_ZYNTHIUM]), 45.3, 44, defaultSettings);
    defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#a16df8', stroke: '#000000', strokeWidth: 0.15 };
    new RoomVisual().text("K : " + formatNumber(Memory.mineralTotals[RESOURCE_KEANIUM]), 45.3, 45, defaultSettings);
    defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#33D5F6', stroke: '#000000', strokeWidth: 0.15 };
    new RoomVisual().text("U : " + formatNumber(Memory.mineralTotals[RESOURCE_UTRIUM]), 45.3, 46, defaultSettings);
    defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#00f4a7', stroke: '#000000', strokeWidth: 0.15 };
    new RoomVisual().text("L : " + formatNumber(Memory.mineralTotals[RESOURCE_LEMERGIUM]), 45.3, 47, defaultSettings);
    defaultSettings = { align: 'left', font: '0.7 Courier New', color: '#ff7a7b', stroke: '#000000', strokeWidth: 0.15 };
    new RoomVisual().text("X : " + formatNumber(Memory.mineralTotals[RESOURCE_CATALYST]), 45.3, 48, defaultSettings);
}

function drawPie(vis, val, max, title, colour, centerx, centery, inner) {
    //const vis = new RoomVisual(from.roomName);
    if (vis.getSize() < 512000) {
        if (!inner) inner = val;

        let p = 1;
        if (max !== 0) p = val / max;
        const r = 1; // radius
        var center = {
            x: centerx,
            y: centery * r * 4.5
        };
        vis.circle(center, {
            radius: r + 0.1,
            fill: '#000000',
            stroke: 'rgba(255, 255, 255, 0.8)',
        });
        var pfix = p;
        if (p >= 1) {
            pfix = pfix + 0.01;
        }
        const poly = [center];
        const tau = 2 * Math.PI;
        const surf = tau * (pfix);
        const offs = -Math.PI / 2;
        const step = tau / 32;
        for (let i = 0; i <= surf; i += step) {
            poly.push({
                x: center.x + Math.cos(i + offs),
                y: center.y - Math.cos(i),
            });
        }
        poly.push(center);
        vis.poly(poly, {
            fill: colour,
            opacity: 1,
            stroke: colour,
            strokeWidth: 0.05,
        });
        vis.text(Number.isFinite(inner) ? formatNumber(inner) : inner, center.x, center.y + 0.33, {
            color: '#FFFFFF',
            font: '1 Courier New',
            align: 'center',
            stroke: 'rgba(0, 0, 0, 0.8)',
            strokeWidth: 0.15,
        });
        let yoff = 0.7;
        if (0.35 < p && p < 0.65) yoff += 0.3;
        vis.text(title, center.x, center.y + r + yoff, {
            color: '#FFFFFF',
            font: '0.6 Courier New',
            align: 'center',
        });
        const lastpol = poly[poly.length - 2];
        vis.text('' + Math.floor(p * 100) + '%', lastpol.x + (lastpol.x - center.x) * 0.7, lastpol.y + (lastpol.y - center.y) * 0.4 + 0.1, {
            color: '#FFFFFF',
            font: '0.4 Courier New',
            align: 'center',
        });
    }

}

const getColourByPercentage = (percentage, reverse) => {
    const value = reverse ? percentage : 1 - percentage;
    const hue = (value * 120).toString(10);
    return `hsl(${hue}, 100%, 50%)`;
};

function formatNumber(number) {
    let ld = Math.log10(number) / 3;
    if (!number) return number;
    let n = number.toString();
    if (ld < 1) {
        return n;
    }
    if (ld < 2) {
        return n.substring(0, n.length - 3) + 'k';
    }
    if (ld < 3) {
        return n.substring(0, n.length - 6) + 'M';
    }
    if (ld < 4) {
        return n.substring(0, n.length - 9) + 'B';
    }
    return number.toString();
}

module.exports = { displayGeneralPieGraphs, displayRoomInfo, DisplayBoostTotals, drawPie, getColourByPercentage, formatNumber };
