const runtimeCache = require('runtime.cache');
const roads = require('system.roads');
const { loadForTrip } = require('creep.logistics');
const { Traveler } = require('traveler');

const WORK_RANGE = 3;            // build/upgrade from here: no crowding next to the target
const SLOT_CACHE_TICKS = 1500;
const slotCache = Object.create(null);   // source id -> { n: open tiles around it, t }

// Tiles around a source a creep can stand on to harvest (terrain and blocking structures).
function harvestSlots(source) {
    const hit = slotCache[source.id];
    if (hit && Game.time - hit.t < SLOT_CACHE_TICKS) return hit.n;
    const terrain = source.room.getTerrain();
    const blocked = new Set();
    for (const s of source.room.lookForAtArea(LOOK_STRUCTURES, source.pos.y - 1, source.pos.x - 1, source.pos.y + 1, source.pos.x + 1, true)) {
        const type = s.structure.structureType;
        if (type !== STRUCTURE_ROAD && type !== STRUCTURE_CONTAINER && type !== STRUCTURE_RAMPART) blocked.add(s.x * 50 + s.y);
    }
    let n = 0;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const x = source.pos.x + dx, y = source.pos.y + dy;
            if ((dx || dy) && x > 0 && x < 49 && y > 0 && y < 49 && !(terrain.get(x, y) & TERRAIN_MASK_WALL) && !blocked.has(x * 50 + y)) n++;
        }
    }
    slotCache[source.id] = { n, t: Game.time };
    return n;
}

// Creeps of ours working a source: helpers (targetSource), the room's harvesters and miners.
function claimed(source, self) {
    let n = 0;
    for (const c of runtimeCache.find(source.room, FIND_MY_CREEPS)) {
        if (c === self) continue;
        const m = c.memory;
        if (m.targetSource === source.id || m.mineSource === source.id || m.sourceLocation === source.id) n++;
    }
    return n;
}

// The nearest source with energy and a free harvesting tile.
function pickSource(creep) {
    const sources = runtimeCache.find(creep.room, FIND_SOURCES).filter(s => s.energy > 0 && claimed(s, creep) < harvestSlots(s));
    return sources.length ? creep.pos.findClosestByRange(sources) : null;
}

function release(creep) {
    delete creep.memory.targetSource;
}

// Energy for a helper in the room it builds: storage/terminal, energy lying around, a source
// with a free tile (nearest first). Returns false when it found nothing to do.
function gather(creep) {
    const room = creep.room;
    for (const store of [room.storage, room.terminal]) {
        if (store && store.store[RESOURCE_ENERGY] >= 400) {
            if (creep.withdraw(store, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.travelTo(store, { range: 1 });
            return true;
        }
    }
    const loose = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 5, { filter: r => r.resourceType === RESOURCE_ENERGY && r.amount >= 100 })[0] ||
        creep.pos.findInRange(FIND_TOMBSTONES, 5, { filter: t => t.store[RESOURCE_ENERGY] >= 100 })[0] ||
        creep.pos.findInRange(FIND_RUINS, 5, { filter: t => t.store[RESOURCE_ENERGY] >= 100 })[0];
    if (loose) {
        const result = loose.amount !== undefined ? creep.pickup(loose) : creep.withdraw(loose, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) creep.travelTo(loose, { range: 1 });
        return true;
    }
    let source = creep.memory.targetSource ? Game.getObjectById(creep.memory.targetSource) : null;
    if (source && source.energy === 0 && !creep.pos.isNearTo(source)) source = null;   // emptied: look again
    if (source && !creep.pos.isNearTo(source) && claimed(source, creep) >= harvestSlots(source)) source = null;   // taken meanwhile
    if (!source) {
        source = pickSource(creep);
        if (source) creep.memory.targetSource = source.id;
        else release(creep);
    }
    if (source) {
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) creep.travelTo(source, { range: 1 });
        return true;
    }
    return false;
}

var creep_Helper = {
    run: function(creep) {
        if (loadForTrip(creep)) return;   // a full load from home first
        this.act(creep);
        // Standing still this tick (harvesting, building, upgrading): parked, so other creeps
        // neither swap it off its tile nor path through it. Helpers used to shove each other off
        // their harvest spots and work tiles all day.
        if (creep.room.name === creep.memory.destination && !Traveler.movedThisTick(creep)) creep.memory.onPoint = 1;
        else delete creep.memory.onPoint;
    },

    act: function(creep) {

        /*let closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
            filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username) && eCreep.owner.username != "Nemah")
        });*/

        if (creep.room.name != creep.memory.destination) {
            var thisPortal = undefined;
            if (Game.flags["TakePortal"] && Game.flags["TakePortal"].pos.roomName == creep.pos.roomName) {
                var thisPortal = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: { structureType: STRUCTURE_PORTAL }
                });
            }
            if (thisPortal) {
                if (creep.memory.path.length && creep.memory.path[0] == creep.room.name) {
                    creep.memory.path.splice(0, 1);
                }
                creep.travelTo(thisPortal)
            } else if (creep.memory.path && creep.memory.path.length) {
                if (creep.memory.path[0] == creep.room.name) {
                    creep.memory.path.splice(0, 1);
                }
                creep.travelTo(new RoomPosition(25, 25, creep.memory.path[0]));
                //creep.travelTo(new RoomPosition(25, 25, creep.memory.destination));
            } else {
                creep.travelTo(new RoomPosition(25, 25, creep.memory.destination));
            }

            if (creep.room.controller && !creep.room.controller.my) {
                if (creep.room.controller.reservation && creep.room.controller.reservation.username == "Montblanc") {
                    //Soak
                } else {
                    let somethingNearby = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: (structure) => (structure.structureType != STRUCTURE_ROAD)
                    });
                    if (somethingNearby) {
                        creep.dismantle(somethingNearby);
                    }
                }
            }
        } else {
            // Check if room has reached level 4 and remove helper flag
            if (creep.room.controller.level >= 4 && creep.memory.homeRoom) {
                const helperFlag = Game.flags[creep.memory.homeRoom + "SendHelper"];
                if (helperFlag) {
                    helperFlag.remove();
                }
            }
            
            if (!creep.memory.currentState) {
                creep.memory.currentState = 1;
            }

            if (creep.memory.currentState == 1) {
                const working = gather(creep);
                const carried = creep.store.getUsedCapacity();
                if (carried + (creep.getActiveBodyparts(WORK) * 2) >= creep.carryCapacity || (!working && carried > 0)) {
                    // Full, or nowhere to get more right now: spend what it carries; the source
                    // tile is free for the next one.
                    creep.memory.currentState = 2;
                    release(creep);
                } else if (!working) {
                    // Every harvesting tile is taken: wait out of the way, 3 tiles from the nearest source.
                    const near = creep.pos.findClosestByRange(runtimeCache.find(creep.room, FIND_SOURCES));
                    if (near && !creep.pos.inRangeTo(near, 3)) creep.travelTo(near, { range: 3 });
                }
            } else {
                let needSearch = true;
                if (creep.memory.structureTarget) {
                    let thisStructure = Game.getObjectById(creep.memory.structureTarget);
                    if (thisStructure) {
                        needSearch = false;
                        let buildResult = creep.build(thisStructure);
                        if (buildResult == ERR_NOT_IN_RANGE) {
                            creep.travelTo(thisStructure, {
                                range: WORK_RANGE
                            });
                        } else if (buildResult == ERR_INVALID_TARGET && thisStructure.energy < thisStructure.energyCapacity) {
                            if (creep.transfer(thisStructure, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(thisStructure, {
                                    ignoreRoads: true
                                });
                            } else {
                                creep.memory.structureTarget = undefined;
                            }
                        } else {
                            creep.memory.structureTarget = undefined;
                        }
                    } else {
                        creep.memory.structureTarget = undefined;
                    }
                }

                if (needSearch && creep.room.energyAvailable < creep.room.energyCapacityAvailable / 2) {
                    // A young room low on spawn energy: fill spawns/extensions first so it can
                    // make its own creeps.
                    target = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
                        filter: (s) => (s.structureType == STRUCTURE_SPAWN || s.structureType == STRUCTURE_EXTENSION) &&
                            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                    });
                    if (target) {
                        needSearch = false;
                        creep.memory.structureTarget = target.id;
                        if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(target, {
                                ignoreRoads: true
                            });
                        }
                    }
                }

                if (needSearch) {
                    target = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
                    if (target) {
                        creep.memory.structureTarget = target.id;
                        let buildResult = creep.build(target);
                        if (buildResult == ERR_NOT_IN_RANGE) {
                            creep.travelTo(target, {
                                range: WORK_RANGE
                            });
                        } else if (buildResult == ERR_NO_BODYPART) {
                            creep.suicide();
                        }
                    } else {
                        target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                            filter: (structure) => {
                                return structure.structureType == STRUCTURE_TOWER && structure.energy < structure.energyCapacity;
                            }
                        });
                        if (target) {
                            creep.memory.structureTarget = target.id;
                            if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                                creep.travelTo(target, {
                                    ignoreRoads: true
                                });
                            }
                        } else if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                            creep.travelTo(creep.room.controller, {
                                maxRooms: 1,
                                range: WORK_RANGE
                            });
                        } else {
                            if (creep.room.controller.sign && creep.room.controller.sign.username != "Montblanc") {
                                creep.travelTo(creep.room.controller, {
                                    maxRooms: 1,
                                    ignoreRoads: true
                                });
                                creep.signController(creep.room.controller, '\u300C\u8F1D\u304F\u732B\u300D(\uFF90\u24DB\u11BD\u24DB\uFF90)\u2727');
                            } else if (!creep.room.controller.sign) {
                                creep.travelTo(creep.room.controller, {
                                    maxRooms: 1,
                                    ignoreRoads: true
                                });
                                creep.signController(creep.room.controller, '\u300C\u8F1D\u304F\u732B\u300D(\uFF90\u24DB\u11BD\u24DB\uFF90)\u2727');
                            }
                        }
                    }
                }

                if (_.sum(creep.carry) <= 0) {
                    creep.memory.currentState = 1;
                } else {
                    let someStructure = creep.pos.lookFor(LOOK_STRUCTURES);
                    // Never pour energy into a tunnel (road on a wall tile).
                    if (someStructure.length && (someStructure[0].hitsMax - someStructure[0].hits >= 800) &&
                        !(someStructure[0].structureType == STRUCTURE_ROAD && roads.isTunnel(creep.room.name, creep.pos.x, creep.pos.y))) {
                        creep.repair(someStructure[0]);
                    }
                }
            }
        }

        /*if (closeFoe) {
            let closeRange = creep.pos.getRangeTo(closeFoe);
            if (closeRange <= 7) {
                //Dodge away from foe
                let foeDirection = creep.pos.getDirectionTo(closeFoe);
                let y = 0;
                let x = 0;
                switch (foeDirection) {
                    case TOP:
                        y = 5;
                        break;
                    case TOP_RIGHT:
                        y = 5;
                        x = -5;
                        break;
                    case RIGHT:
                        x = -5;
                        break;
                    case BOTTOM_RIGHT:
                        y = -5;
                        x = -5;
                        break;
                    case BOTTOM:
                        y = -5;
                        break;
                    case BOTTOM_LEFT:
                        y = -5;
                        x = 5;
                        break;
                    case LEFT:
                        x = 5;
                        break;
                    case TOP_LEFT:
                        y = 5;
                        x = 5;
                        break;
                }
                x = creep.pos.x + x;
                y = creep.pos.y + y;
                if (x < 0) {
                    x = 0;
                    if (y < 25 && y > 0) {
                        y = y - 1;
                    } else if (y < 49) {
                        y = y + 1;
                    }
                } else if (x > 49) {
                    x = 49;
                    if (y < 25 && y > 0) {
                        y = y - 1;
                    } else if (y < 49) {
                        y = y + 1;
                    }
                }
                if (y < 0) {
                    y = 0;
                    if (x < 25 && x > 0) {
                        x = x - 1;
                    } else if (x < 49) {
                        x = x + 1;
                    }
                } else if (y > 49) {
                    y = 49;
                    if (x < 25 && x > 0) {
                        x = x - 1;
                    } else if (x < 49) {
                        x = x + 1;
                    }
                }

                creep.moveTo(x, y, {
                    ignoreRoads: true
                });
            }
        }*/
    }
};

module.exports = creep_Helper;
