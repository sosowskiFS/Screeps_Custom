/**
 * To start using Traveler, require it in main.js:
 * Example: var Traveler = require('Traveler.js');
 */
"use strict";
// Changes from stock Traveler (see README "Travel"):
//  - every trip to another room plans its room route first (Game.map.findRoute), not only trips
//    over 2 rooms: without it PathFinder may route back through the room just left, so a creep
//    stepping off an exit tile is sent straight back (exit bounce)
//  - rooms claimed by non-whitelisted players (system.badRooms) are never routed through; only
//    the trip's own start or destination room may be one
//  - a route whose rooms are cut off by walls is widened to neighbouring rooms, then dropped,
//    before giving up: long winding paths no longer end in a partial path walked back and forth
//  - stuck behind one of our own creeps that is not moving and not parked at a work spot: swap
//    places with it (head-on deadlocks in 1-wide corridors)
//  - a repath around creeps that cannot reach the target is discarded: the creep waits and
//    pushes instead of walking away from its goal and back again
const runtimeCache = require('runtime.cache');
const badRooms = require('system.badRooms');
const roomStatus = require('room.status');
Object.defineProperty(exports, "__esModule", {
    value: true
});
class Traveler {
    /**
     * move creep to destination
     * @param creep
     * @param destination
     * @param options
     * @returns {number}
     */
    static travelTo(creep, destination, options = {}, doFlee = false) {
            // uncomment if you would like to register hostile rooms entered
            // this.updateRoomStatus(creep.room);
            if (!destination) {
                return ERR_INVALID_ARGS;
            }
            if (creep.fatigue > 0) {
                Traveler.circle(creep.pos, "aqua", .3);
                return ERR_BUSY;
            }
            destination = this.normalizePos(destination);
            // manage case where creep is nearby destination
            let rangeToDestination = creep.pos.getRangeTo(destination);
            // Waiting near a spot (range > 1, e.g. idle by the spawn), just swapped out of someone's way
            // (pushBlocker) and still about there: stay. Walking straight back made two idle creeps
            // trade places forever. Trips to an actual target (range 1) are not delayed.
            if (!doFlee && options.range > 1 && Traveler.wasPushed(creep) && rangeToDestination <= options.range + 1) {
                return OK;
            }
            if (!doFlee) {
                if (options.range && rangeToDestination <= options.range) {
                    return OK;
                } else if (rangeToDestination <= 1) {
                    if (rangeToDestination === 1 && !options.range) {
                        let direction = creep.pos.getDirectionTo(destination);
                        if (options.returnData) {
                            options.returnData.nextPos = destination;
                            options.returnData.path = direction.toString();
                        }
                        Traveler.markMoved(creep);
                        return creep.move(direction);
                    }
                    return OK;
                }
            }
            // initialize data object
            if (!creep.memory._trav) {
                delete creep.memory._travel;
                creep.memory._trav = {};
            }
            let travelData = creep.memory._trav;
            let state = this.deserializeState(travelData, destination);
            // uncomment to visualize destination
            // this.circle(destination.pos, "orange");
            // check if creep is stuck
            if (this.isStuck(creep, state)) {
                state.stuckCount++;
                if (travelData.path && travelData.path.length > 0) {
                    let nextDirection = parseInt(travelData.path[0], 10);
                    if (nextDirection) {
                        let nextPos = Traveler.positionAtDirection(creep.pos, nextDirection);
                        if (nextPos) {
                            creep.say(nextPos.x + ";" + nextPos.y);
                        }
                    }
                }
                //creep.say(options.returnData.nextPos.x + ";" + options.returnData.nextPos.y);
                Traveler.circle(creep.pos, "magenta", state.stuckCount * .2);
            } else {
                state.stuckCount = 0;
            }
            // handle case where creep is stuck
            if (!options.stuckValue) {
                options.stuckValue = DEFAULT_STUCK_VALUE;
            }
            let aroundCreeps = false;
            if (state.stuckCount >= options.stuckValue && travelData.path) {
                options.ignoreCreeps = false;
                options.freshMatrix = true;
                delete travelData.path;
                aroundCreeps = true;
            }
            // TODO:handle case where creep moved by some other function, but destination is still the same
            // delete path cache if destination is different
            if (!this.samePos(state.destination, destination)) {
                if (options.movingTarget) {
                    // For moving targets, always delete path and recalculate to ensure we track the current position
                    delete travelData.path;
                    state.destination = destination;
                } else {
                    delete travelData.path;
                }
            } else if (options.movingTarget) {
                // Even if destination appears the same, for moving targets we should recalculate periodically
                // to ensure we're not stuck following an old path to where the target used to be
                if (travelData.path && travelData.path.length > 5) {
                    delete travelData.path;
                }
            }
            if (options.repath && Math.random() < options.repath) {
                // add some chance that you will find a new path randomly
                delete travelData.path;
            }
            // pathfinding
            let newPath = false;
            if (!travelData.path) {
                newPath = true;
                if (creep.spawning) {
                    return ERR_BUSY;
                }
                state.destination = destination;
                let cpu = Game.cpu.getUsed();
                let ret = this.findTravelPath(creep.pos, destination, options, doFlee);
                if (aroundCreeps && ret.incomplete) {
                    // No way around the creeps in the way: keep the real path and wait/push
                    // rather than walking off and coming straight back.
                    options.ignoreCreeps = true;
                    ret = this.findTravelPath(creep.pos, destination, options, doFlee);
                }
                let cpuUsed = Game.cpu.getUsed() - cpu;
                state.cpu = _.round(cpuUsed + state.cpu);
                if (state.cpu > REPORT_CPU_THRESHOLD) {
                    // see note at end of file for more info on this
                    //console.log(`TRAVELER: heavy cpu use: ${creep.name}, cpu: ${state.cpu} origin: ${creep.pos}, dest: ${destination}`);
                }
                let color = "orange";
                if (ret.incomplete) {
                    // uncommenting this is a great way to diagnose creep behavior issues
                    // console.log(`TRAVELER: incomplete path for ${creep.name}`);
                    color = "red";
                }
                if (options.returnData) {
                    //options.returnData.pathfinderReturn = ret;
                }
                travelData.path = Traveler.serializePath(creep.pos, ret.path, color);
                state.stuckCount = 0;
            }
            this.serializeState(creep, destination, state, travelData);
            if (!travelData.path || travelData.path.length === 0) {
                return ERR_NO_PATH;
            }
            if (options.returnData) {
                options.returnData.state = travelData.state;
                options.returnData.path = travelData.path;
            }
            // consume path
            if (state.stuckCount === 0 && !newPath) {
                travelData.path = travelData.path.substr(1);
            }
            let nextDirection = parseInt(travelData.path[0], 10);
            if (state.stuckCount > 0 && nextDirection) {
                Traveler.pushBlocker(creep, nextDirection);
            }
            Traveler.markMoved(creep);
            /*if (options.returnData) {
                if (nextDirection) {
                    let nextPos = Traveler.positionAtDirection(creep.pos, nextDirection);
                    if (nextPos) {
                        options.returnData.nextPos = nextPos;
                    }
                }
                options.returnData.state = state;
                options.returnData.path = travelData.path;
            }*/
            return creep.move(nextDirection);
        }
        /**
         * make position objects consistent so that either can be used as an argument
         * @param destination
         * @returns {any}
         */
    static normalizePos(destination) {
            if (!(destination instanceof RoomPosition)) {
                return destination.pos;
            }
            return destination;
        }
        /**
         * check if room should be avoided by findRoute algorithm
         * @param roomName
         * @returns {RoomMemory|number}
         */
    static checkAvoid(roomName) {
            // Rooms we cannot enter (closed / out of borders: room.status) are never routed through.
            return badRooms.isBad(roomName) || !roomStatus.open(roomName) ||
                !!(Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].avoid);
        }
        /**
         * remember that a creep issued its own move this tick (pushBlocker leaves it alone)
         */
    static markMoved(creep) {
            if (Traveler._movedTick !== Game.time) {
                Traveler._movedTick = Game.time;
                Traveler._moved = Object.create(null);
            }
            Traveler._moved[creep.name] = true;
        }
    static movedThisTick(creep) {
            return Traveler._movedTick === Game.time && !!Traveler._moved[creep.name];
        }
        /**
         * our own creep standing on the next tile and going nowhere: swap places with it. Creeps
         * that run later this tick override this with their own move; parked workers (miners,
         * the tower supplier, anything at its spot) are never pushed: the path goes around them
         * after stuckValue ticks instead.
         */
    static pushBlocker(creep, direction) {
            const next = Traveler.positionAtDirection(creep.pos, direction);
            if (!next) return false;
            const blocker = next.lookFor(LOOK_CREEPS)[0];
            if (!blocker || !blocker.my || blocker.spawning || blocker.fatigue > 0 || Traveler.movedThisTick(blocker)) return false;
            const memory = blocker.memory || {};
            if (memory.atSpot || memory.onPoint || PARKED_ROLES.has(memory.priority)) return false;
            if (blocker.move(blocker.pos.getDirectionTo(creep.pos)) !== OK) return false;
            Traveler._pushed[blocker.name] = Game.time;
            return true;
        }
    static wasPushed(creep) {
            const at = Traveler._pushed[creep.name];
            if (at === undefined) return false;
            if (Game.time - at > PUSH_SETTLE) {
                delete Traveler._pushed[creep.name];
                return false;
            }
            return true;
        }
        /**
         * check if a position is an exit
         * @param pos
         * @returns {boolean}
         */
    static isExit(pos) {
            return pos.x === 0 || pos.y === 0 || pos.x === 49 || pos.y === 49;
        }
        /**
         * check two coordinates match
         * @param pos1
         * @param pos2
         * @returns {boolean}
         */
    static sameCoord(pos1, pos2) {
            return pos1.x === pos2.x && pos1.y === pos2.y;
        }
        /**
         * check if two positions match
         * @param pos1
         * @param pos2
         * @returns {boolean}
         */
    static samePos(pos1, pos2) {
            return this.sameCoord(pos1, pos2) && pos1.roomName === pos2.roomName;
        }
        /**
         * draw a circle at position
         * @param pos
         * @param color
         * @param opacity
         */
    static circle(pos, color, opacity) {
            if (!travelerVisualize()) return;
            new RoomVisual(pos.roomName).circle(pos, {
                radius: .45,
                fill: "transparent",
                stroke: color,
                strokeWidth: .15,
                opacity: opacity
            });
        }
        /**
         * update memory on whether a room should be avoided based on controller owner
         * @param room
         */
    static updateRoomStatus(room) {
            if (!room) {
                return;
            }
            if (room.controller) {
                if (room.controller.owner && !room.controller.my) {
                    room.memory.avoid = 1;
                } else {
                    delete room.memory.avoid;
                }
            }
        }
        /**
         * find a path from origin to destination
         * @param origin
         * @param destination
         * @param options
         * @returns {PathfinderReturn}
         */
    static findTravelPath(origin, destination, options = {}, doFlee = false) {
            _.defaults(options, {
                ignoreCreeps: true,
                maxOps: DEFAULT_MAXOPS,
                range: 1,
                flee: doFlee
            });
            if (options.movingTarget) {
                // For moving targets, use a smaller range to get closer for better tracking
                if (!options.range) {
                    options.range = 1;
                }
            }
            origin = this.normalizePos(origin);
            destination = this.normalizePos(destination);
            let originRoomName = origin.roomName;
            let destRoomName = destination.roomName;
            // check to see whether findRoute should be used
            let roomDistance = Game.map.getRoomLinearDistance(origin.roomName, destination.roomName);
            let allowedRooms = options.route;
            const crossRoom = originRoomName !== destRoomName && options.maxRooms !== 1;
            if (!allowedRooms && (options.useFindRoute || (options.useFindRoute === undefined && crossRoom))) {
                let route = this.findRoute(origin.roomName, destination.roomName, options, doFlee);
                if (route) {
                    allowedRooms = route;
                }
            }
            let roomsSearched = 0;
            let callback = (roomName) => {
                if (allowedRooms) {
                    if (!allowedRooms[roomName]) {
                        return false;
                    }
                } else if (!options.allowHostile && Traveler.checkAvoid(roomName) && roomName !== destRoomName && roomName !== originRoomName) {
                    return false;
                }
                roomsSearched++;
                let matrix;
                let room = Game.rooms[roomName];
                if (room) {
                    if (options.ignoreStructures) {
                        matrix = new PathFinder.CostMatrix();
                        if (!options.ignoreCreeps) {
                            Traveler.addCreepsToMatrix(room, matrix);
                        }
                    } else if (options.ignoreCreeps || roomName !== originRoomName) {
                        matrix = this.getStructureMatrix(room);
                    } else {
                        matrix = this.getCreepMatrix(room);
                    }
                    if (options.obstacles) {
                        matrix = matrix.clone();
                        for (let obstacle of options.obstacles) {
                            if (obstacle.pos.roomName !== roomName) {
                                continue;
                            }
                            matrix.set(obstacle.pos.x, obstacle.pos.y, 0xff);
                        }
                    }
                }
                if (options.roomCallback) {
                    if (!matrix) {
                        matrix = new PathFinder.CostMatrix();
                    }
                    let outcome = options.roomCallback(roomName, matrix.clone());
                    if (outcome !== undefined) {
                        return outcome;
                    }
                }
                return matrix;
            };
            const search = (maxOps) => PathFinder.search(origin, {
                pos: destination,
                range: options.range
            }, {
                maxOps: maxOps,
                maxRooms: options.maxRooms,
                plainCost: options.offRoad ? 1 : options.ignoreRoads ? 1 : 2,
                swampCost: options.offRoad ? 1 : options.ignoreRoads ? 5 : 10,
                flee: options.flee,
                roomCallback: callback,
            });
            let ret = search(options.maxOps);
            if (ret.incomplete && allowedRooms && !options.route && !options.flee) {
                // The route's rooms are cut off by walls (findRoute only knows room links):
                // widen to the neighbours (never bad rooms), then search without a route.
                allowedRooms = Traveler.widenRoute(allowedRooms, options);
                const wider = search(options.maxOps);
                if (!wider.incomplete) {
                    ret = wider;
                } else {
                    allowedRooms = undefined;
                    const open = search(options.maxOps * 2);
                    if (!open.incomplete) ret = open;
                }
            }
            if (ret.incomplete && options.ensurePath) {
                if (options.useFindRoute === undefined) {
                    // handle case where pathfinder failed at a short distance due to not using findRoute
                    // can happen for situations where the creep would have to take an uncommonly indirect path
                    // options.allowedRooms and options.routeCallback can also be used to handle this situation
                    if (roomDistance <= 2) {
                        console.log(`TRAVELER: path failed without findroute, trying with options.useFindRoute = true`);
                        console.log(`from: ${origin}, destination: ${destination}`);
                        options.useFindRoute = true;
                        ret = this.findTravelPath(origin, destination, options, doFlee);
                        console.log(`TRAVELER: second attempt was ${ret.incomplete ? "not " : ""}successful`);
                        return ret;
                    }
                    // TODO: handle case where a wall or some other obstacle is blocking the exit assumed by findRoute
                } else {}
            }
            return ret;
        }
        /**
         * find a viable sequence of rooms that can be used to narrow down pathfinder's search algorithm
         * @param origin
         * @param destination
         * @param options
         * @returns {{}}
         */
    static widenRoute(allowedRooms, options) {
            const wider = Object.assign({}, allowedRooms);
            for (const roomName in allowedRooms) {
                const exits = Game.map.describeExits(roomName) || {};
                for (const dir in exits) {
                    const next = exits[dir];
                    if (options.allowHostile || !Traveler.checkAvoid(next)) wider[next] = true;
                }
            }
            return wider;
        }
    static findRoute(origin, destination, options = {}, doFlee = false) {
            let restrictDistance = options.restrictDistance || Game.map.getRoomLinearDistance(origin, destination) + 10;
            // Remote creeps repath across the same rooms constantly; reuse recent routes.
            // Custom route callbacks can depend on caller state, so those are never cached.
            const cacheKey = options.routeCallback ? undefined : [origin, destination, restrictDistance,
                options.preferHighway ? (options.highwayBias || 2.5) : 0, options.allowHostile ? 1 : 0, options.allowSK ? 1 : 0,
                badRooms.version()].join('|');
            if (cacheKey) {
                const cached = Traveler._routeCache[cacheKey];
                if (cached && Game.time - cached.tick < ROUTE_CACHE_TTL) {
                    return cached.rooms;
                }
            }
            let allowedRooms = {
                [origin]: true, [destination]: true
            };
            let highwayBias = 1;
            if (options.preferHighway) {
                highwayBias = 2.5;
                if (options.highwayBias) {
                    highwayBias = options.highwayBias;
                }
            }
            let ret = Game.map.findRoute(origin, destination, {
                routeCallback: (roomName) => {
                    if (options.routeCallback) {
                        let outcome = options.routeCallback(roomName);
                        if (outcome !== undefined) {
                            return outcome;
                        }
                    }
                    let rangeToRoom = Game.map.getRoomLinearDistance(origin, roomName);
                    if (rangeToRoom > restrictDistance) {
                        // room is too far out of the way
                        return Number.POSITIVE_INFINITY;
                    }
                    if (!options.allowHostile && Traveler.checkAvoid(roomName) &&
                        roomName !== destination && roomName !== origin) {
                        // room is marked as "avoid" in room memory
                        return Number.POSITIVE_INFINITY;
                    }
                    let parsed;
                    if (options.preferHighway) {
                        parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
                        let isHighway = (parsed[1] % 10 === 0) || (parsed[2] % 10 === 0);
                        if (isHighway) {
                            return 1;
                        }
                    }
                    // SK rooms are avoided when there is no vision in the room, harvested-from SK rooms are allowed
                    if (!options.allowSK && !Game.rooms[roomName]) {
                        if (!parsed) {
                            parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
                        }
                        let fMod = parsed[1] % 10;
                        let sMod = parsed[2] % 10;
                        let isSK = !(fMod === 5 && sMod === 5) &&
                            ((fMod >= 4) && (fMod <= 6)) &&
                            ((sMod >= 4) && (sMod <= 6));
                        if (isSK) {
                            return 10 * highwayBias;
                        }
                    }
                    return highwayBias;
                },
            });
            if (!_.isArray(ret)) {
                console.log(`couldn't findRoute to ${destination}`);
                return;
            }
            for (let value of ret) {
                allowedRooms[value.room] = true;
            }
            if (cacheKey) {
                Traveler._routeCache[cacheKey] = { tick: Game.time, rooms: allowedRooms };
            }
            return allowedRooms;
        }
        /**
         * check how many rooms were included in a route returned by findRoute
         * @param origin
         * @param destination
         * @returns {number}
         */
    static routeDistance(origin, destination) {
            let linearDistance = Game.map.getRoomLinearDistance(origin, destination);
            if (linearDistance >= 32) {
                return linearDistance;
            }
            let allowedRooms = this.findRoute(origin, destination);
            if (allowedRooms) {
                return Object.keys(allowedRooms).length;
            }
        }
        /**
         * build a cost matrix based on structures in the room. Will be cached for more than one tick. Requires vision.
         * @param room
         * @param freshMatrix
         * @returns {any}
         */
    static getStructureMatrix(room) {
            // Per-tick cache for structure matrices
            if (Traveler._cacheTick !== Game.time) {
                Traveler._cacheTick = Game.time;
                Traveler._structureMatrixCache = {};
                Traveler._creepMatrixCache = {};
            }
            const key = room.name;
            if (Traveler._structureMatrixCache && Traveler._structureMatrixCache[key]) {
                return Traveler._structureMatrixCache[key];
            }
            // Validate topology every used tick; retain only matrices/signatures,
            // never last tick's structure objects. Hits/energy do not affect paths.
            const structures = runtimeCache.find(room, FIND_STRUCTURES);
            const sites = runtimeCache.find(room, FIND_MY_CONSTRUCTION_SITES);
            let entry = Traveler._topologyCache[key];
            let unchanged = entry && entry.structures.length === structures.length && entry.sites.length === sites.length;
            // Compare primitive records without allocating signatures every tick.
            if (unchanged) {
                for (let i = 0; i < structures.length; i++) {
                    const now = structures[i], previous = entry.structures[i];
                    if (now.pos.x !== previous.x || now.pos.y !== previous.y || now.structureType !== previous.type ||
                        !!now.my !== previous.my || !!now.isPublic !== previous.public) { unchanged = false; break; }
                }
            }
            if (unchanged) {
                for (let i = 0; i < sites.length; i++) {
                    const now = sites[i], previous = entry.sites[i];
                    if (now.pos.x !== previous.x || now.pos.y !== previous.y || now.structureType !== previous.type) { unchanged = false; break; }
                }
            }
            if (!unchanged) {
                entry = {
                    structures: structures.map(s => ({ x: s.pos.x, y: s.pos.y, type: s.structureType, my: !!s.my, public: !!s.isPublic })),
                    sites: sites.map(s => ({ x: s.pos.x, y: s.pos.y, type: s.structureType })),
                    matrix: Traveler.addStructuresToMatrix(room, new PathFinder.CostMatrix(), 1),
                };
                Traveler._topologyCache[key] = entry;
            }
            entry.lastUsed = Game.time;
            // Bound heap growth while scouting; expire unused rooms lazily.
            if (Game.time - Traveler._lastTopologyCleanup >= 100) {
                for (const name in Traveler._topologyCache) {
                    if (Game.time - Traveler._topologyCache[name].lastUsed > 100) delete Traveler._topologyCache[name];
                }
                for (const key in Traveler._routeCache) {
                    if (Game.time - Traveler._routeCache[key].tick >= ROUTE_CACHE_TTL) delete Traveler._routeCache[key];
                }
                Traveler._lastTopologyCleanup = Game.time;
            }
            // Creeps parked on a work tile (miners, the tower supplier: atSpot/onPoint) never move
            // out of the way, so paths must not plan through them. Planning through the storage
            // miner's tile deadlocked a hauler queue at the storage.
            let matrix = entry.matrix;
            const parked = Traveler.parkedCreeps(room);
            if (parked.length) {
                matrix = matrix.clone();
                for (const creep of parked) matrix.set(creep.pos.x, creep.pos.y, 0xff);
            }
            Traveler._structureMatrixCache[key] = matrix;
            return matrix;
        }
    static parkedCreeps(room) {
            return runtimeCache.find(room, FIND_MY_CREEPS).filter(creep => creep.memory && (creep.memory.atSpot || creep.memory.onPoint));
        }
        /**
         * build a cost matrix based on creeps and structures in the room. Will be cached for one tick. Requires vision.
         * @param room
         * @returns {any}
         */
    static getCreepMatrix(room) {
            // Per-tick cache for creep+structure matrices
            if (Traveler._cacheTick !== Game.time) {
                Traveler._cacheTick = Game.time;
                Traveler._structureMatrixCache = {};
                Traveler._creepMatrixCache = {};
            }
            const key = room.name;
            if (Traveler._creepMatrixCache && Traveler._creepMatrixCache[key]) {
                return Traveler._creepMatrixCache[key];
            }
            const base = this.getStructureMatrix(room).clone();
            const withCreeps = Traveler.addCreepsToMatrix(room, base);
            Traveler._creepMatrixCache[key] = withCreeps;
            return withCreeps;
        }
        /**
         * add structures to matrix so that impassible structures can be avoided and roads given a lower cost
         * @param room
         * @param matrix
         * @param roadCost
         * @returns {CostMatrix}
         */
    static addStructuresToMatrix(room, matrix, roadCost) {
            let impassibleStructures = [];
            for (let structure of runtimeCache.find(room, FIND_STRUCTURES)) {
                if (structure instanceof StructureRampart) {
                    if (!structure.my && !structure.isPublic) {
                        impassibleStructures.push(structure);
                    }
                } else if (structure instanceof StructureRoad) {
                    matrix.set(structure.pos.x, structure.pos.y, roadCost);
                } else if (structure instanceof StructureContainer) {
                    matrix.set(structure.pos.x, structure.pos.y, 5);
                } else {
                    impassibleStructures.push(structure);
                }
            }
            for (let site of runtimeCache.find(room, FIND_MY_CONSTRUCTION_SITES)) {
                if (site.structureType === STRUCTURE_CONTAINER || site.structureType === STRUCTURE_ROAD || site.structureType === STRUCTURE_RAMPART) {
                    continue;
                }
                matrix.set(site.pos.x, site.pos.y, 0xff);
            }
            for (let structure of impassibleStructures) {
                matrix.set(structure.pos.x, structure.pos.y, 0xff);
            }
            return matrix;
        }
        /**
         * add creeps to matrix so that they will be avoided by other creeps
         * @param room
         * @param matrix
         * @returns {CostMatrix}
         */
    static addCreepsToMatrix(room, matrix) {
            runtimeCache.find(room, FIND_CREEPS).forEach((creep) => matrix.set(creep.pos.x, creep.pos.y, 0xff));
            return matrix;
        }
        /**
         * serialize a path, traveler style. Returns a string of directions.
         * @param startPos
         * @param path
         * @param color
         * @returns {string}
         */
    static serializePath(startPos, path, color = "orange") {
            let serializedPath = "";
            let lastPosition = startPos;
            const visualize = travelerVisualize();
            if (visualize) this.circle(startPos, color);
            for (let position of path) {
                if (position.roomName === lastPosition.roomName) {
                    if (visualize) {
                        new RoomVisual(position.roomName)
                            .line(position, lastPosition, {
                                color: color,
                                lineStyle: "dashed"
                            });
                    }
                    serializedPath += lastPosition.getDirectionTo(position);
                }
                lastPosition = position;
            }
            return serializedPath;
        }
        /**
         * returns a position at a direction relative to origin
         * @param origin
         * @param direction
         * @returns {RoomPosition}
         */
    static positionAtDirection(origin, direction) {
            let offsetX = [0, 0, 1, 1, 1, 0, -1, -1, -1];
            let offsetY = [0, -1, -1, 0, 1, 1, 1, 0, -1];
            let x = origin.x + offsetX[direction];
            let y = origin.y + offsetY[direction];
            if (x > 49 || x < 0 || y > 49 || y < 0) {
                return;
            }
            return new RoomPosition(x, y, origin.roomName);
        }
        /**
         * convert room avoidance memory from the old pattern to the one currently used
         * @param cleanup
         */
    static patchMemory(cleanup = false) {
        if (!Memory.empire) {
            return;
        }
        if (!Memory.empire.hostileRooms) {
            return;
        }
        let count = 0;
        for (let roomName in Memory.empire.hostileRooms) {
            if (Memory.empire.hostileRooms[roomName]) {
                if (!Memory.rooms[roomName]) {
                    Memory.rooms[roomName] = {};
                }
                Memory.rooms[roomName].avoid = 1;
                count++;
            }
            if (cleanup) {
                delete Memory.empire.hostileRooms[roomName];
            }
        }
        if (cleanup) {
            delete Memory.empire.hostileRooms;
        }
        console.log(`TRAVELER: room avoidance data patched for ${count} rooms`);
    }
    static deserializeState(travelData, destination) {
        let state = {};
        if (travelData.state) {
            state.lastCoord = {
                x: travelData.state[STATE_PREV_X],
                y: travelData.state[STATE_PREV_Y]
            };
            state.cpu = travelData.state[STATE_CPU];
            state.stuckCount = travelData.state[STATE_STUCK];
            state.destination = new RoomPosition(travelData.state[STATE_DEST_X], travelData.state[STATE_DEST_Y], travelData.state[STATE_DEST_ROOMNAME]);
        } else {
            state.cpu = 0;
            state.destination = destination;
        }
        return state;
    }
    static serializeState(creep, destination, state, travelData) {
        travelData.state = [creep.pos.x, creep.pos.y, state.stuckCount, state.cpu, destination.x, destination.y,
            destination.roomName
        ];
    }
    static isStuck(creep, state) {
        let stuck = false;
        if (state.lastCoord !== undefined) {
            if (this.sameCoord(creep.pos, state.lastCoord)) {
                // didn't move
                stuck = true;
            } else if (this.isExit(creep.pos) && this.isExit(state.lastCoord)) {
                // moved against exit
                stuck = true;
            }
        }
        return stuck;
    }
}
//Traveler.structureMatrixCache = {};
//Traveler.creepMatrixCache = {};
exports.Traveler = Traveler;
// Path/stuck visuals are off by default (they are drawn on every repath and every fatigued
// tick). Enable with Memory.settings.travelerVisuals = true; global.TRAVELER_VISUALIZE still overrides.
const { travelerVisualsEnabled } = require('runtime.config');
function travelerVisualize() {
    if (typeof global !== 'undefined' && typeof global.TRAVELER_VISUALIZE !== 'undefined') return !!global.TRAVELER_VISUALIZE;
    return travelerVisualsEnabled();
}
// this might be higher than you wish, setting it lower is a great way to diagnose creep behavior issues. When creeps
// need to repath to often or they aren't finding valid paths, it can sometimes point to problems elsewhere in your code
const REPORT_CPU_THRESHOLD = 1000;
const DEFAULT_MAXOPS = 20000;
const DEFAULT_STUCK_VALUE = 5;
// Internal caches (reset each tick)
Traveler._topologyCache = Object.create(null);
Traveler._routeCache = Object.create(null);
const ROUTE_CACHE_TTL = 300;
Traveler._lastTopologyCleanup = 0;
Traveler._cacheTick = -1;
Traveler._movedTick = -1;
Traveler._pushed = Object.create(null);   // creep name -> tick it was swapped out of the way
const PUSH_SETTLE = 3;
Traveler._moved = Object.create(null);
// Creeps working from a fixed tile: never pushed out of the way.
const PARKED_ROLES = new Set(['supplier', 'supplierNearDeath', 'miner', 'minerNearDeath', 'mineralMiner',
    'mineralMinerNearDeath', 'farMiner', 'farMinerNearDeath']);
Traveler._structureMatrixCache = {};
Traveler._creepMatrixCache = {};
const STATE_PREV_X = 0;
const STATE_PREV_Y = 1;
const STATE_STUCK = 2;
const STATE_CPU = 3;
const STATE_DEST_X = 4;
const STATE_DEST_Y = 5;
const STATE_DEST_ROOMNAME = 6;
// assigns a function to Creep.prototype: creep.travelTo(destination)
Creep.prototype.travelTo = function(destination, options, doFlee) {
    return Traveler.travelTo(this, destination, options, doFlee);
    //return this.moveTo(destination, options);
};
// assigns a function to Creep.prototype: creep.travelTo(destination)
PowerCreep.prototype.travelTo = function(destination, options, doFlee) {
    return Traveler.travelTo(this, destination, options, doFlee);
    //return this.moveTo(destination, options);
};
