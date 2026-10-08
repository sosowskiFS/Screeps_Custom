const runtimeCache = require('runtime.cache');
const governor = require('runtime.cpuGovernor');
const roads = require('system.roads');
function placeRoadOnPath(creep) {
    // No roads in (or for) a young room: its energy goes into building and upgrading.
    if (!require('room.stage').upkeepAllowed(creep.room.name, creep.memory.homeRoom)) {
        return;
    }
    // Only attempt if we have an active travel path
    if (!creep.memory._trav || !creep.memory._trav.path || creep.memory._trav.path.length === 0) {
        return;
    }

    // Rooms with a road plan get their roads from it (system.roads); walking creeps used to
    // turn every detour into a permanent road.
    if (roads.hasPlan(creep.room.name)) {
        return;
    }

    // First optional work shed when CPU runs over budget.
    if (!governor.allows('roads')) {
        return;
    }

    // Game.constructionSites does not change during a tick; count it once.
    const tick = runtimeCache.current();
    if (tick.siteCount === undefined) {
        tick.siteCount = Game.constructionSites ? Object.keys(Game.constructionSites).length : 0;
    }
    if (tick.siteCount >= MAX_CONSTRUCTION_SITES) {
        return;
    }

    // Try to place road at current position
    let nextDir = parseInt(creep.memory._trav.path[0], 10);
    let nextPos = nextDir ? positionAtDirection(creep.pos, nextDir) : undefined;
    let nextNextPos = undefined;
    if (nextPos && creep.memory._trav.path.length > 1) {
        let nextNextDir = parseInt(creep.memory._trav.path[1], 10);
        if (nextNextDir) {
            nextNextPos = positionAtDirection(nextPos, nextNextDir);
        }
    }
    tryCreateRoadAt(creep.pos, nextPos);

    // Try to place road at next step in the path
    if (nextPos) {
        tryCreateRoadAt(nextPos, nextNextPos);
    }
}

function tryCreateRoadAt(pos, nextPosAfterTarget) {
    if (!pos || !pos.roomName) {
        return;
    }

    // Several creeps walk the same tiles; inspect each tile at most once per tick.
    const checked = runtimeCache.current().roadChecked || (runtimeCache.current().roadChecked = new Set());
    const key = pos.roomName + ':' + (pos.x * 50 + pos.y);
    if (checked.has(key)) {
        return;
    }
    checked.add(key);

    if (Game.map.getRoomTerrain(pos.roomName).get(pos.x, pos.y) & TERRAIN_MASK_WALL) {
        return;
    }

    // In a built-up base nearly every step is already a road: stop after one lookup.
    let structures = pos.lookFor(LOOK_STRUCTURES);
    for (const structure of structures) {
        if (structure.structureType !== STRUCTURE_RAMPART) {
            return;
        }
    }

    let sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
    if (sites.length) {
        return;
    }

    // If the next position after this target already has a road/site,
    // avoid placing a road here when there is another road/site adjacent
    // that is not the next position.
    if (nextPosAfterTarget && hasRoadOrSiteAt(nextPosAfterTarget)) {
        let adjacentPositions = getAdjacentPositions(pos);
        let hasOtherAdjacentRoad = adjacentPositions.some((adj) => {
            if (nextPosAfterTarget && adj.isEqualTo(nextPosAfterTarget)) {
                return false;
            }
            return hasRoadOrSiteAt(adj);
        });
        if (hasOtherAdjacentRoad) {
            return;
        }
    }

    pos.createConstructionSite(STRUCTURE_ROAD);
}

function hasRoadOrSiteAt(pos) {
    if (!pos || !pos.roomName) {
        return false;
    }

    let structures = pos.lookFor(LOOK_STRUCTURES);
    if (structures.some(s => s.structureType === STRUCTURE_ROAD)) {
        return true;
    }

    let sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
    return sites.some(s => s.structureType === STRUCTURE_ROAD);
}

function getAdjacentPositions(pos) {
    const offsets = [
        { x: 0, y: -1 },
        { x: 1, y: -1 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
        { x: -1, y: 1 },
        { x: -1, y: 0 },
        { x: -1, y: -1 }
    ];

    let positions = [];
    for (let i = 0; i < offsets.length; i++) {
        let x = pos.x + offsets[i].x;
        let y = pos.y + offsets[i].y;
        if (x >= 0 && x <= 49 && y >= 0 && y <= 49) {
            positions.push(new RoomPosition(x, y, pos.roomName));
        }
    }
    return positions;
}

function positionAtDirection(pos, direction) {
    const offsets = {
        1: { x: 0, y: -1 },
        2: { x: 1, y: -1 },
        3: { x: 1, y: 0 },
        4: { x: 1, y: 1 },
        5: { x: 0, y: 1 },
        6: { x: -1, y: 1 },
        7: { x: -1, y: 0 },
        8: { x: -1, y: -1 }
    };

    let offset = offsets[direction];
    if (!offset) {
        return undefined;
    }

    let x = pos.x + offset.x;
    let y = pos.y + offset.y;
    if (x < 0 || x > 49 || y < 0 || y > 49) {
        return undefined;
    }

    return new RoomPosition(x, y, pos.roomName);
}

function clearTravelMemory(creep) {
    if (creep.memory && creep.memory._trav) {
        delete creep.memory._trav;
    }
}

module.exports = { placeRoadOnPath, tryCreateRoadAt, hasRoadOrSiteAt, getAdjacentPositions, positionAtDirection, clearTravelMemory };
