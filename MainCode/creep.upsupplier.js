var creep_upSupplier = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'upSupplierNearDeath') {
            creep.memory.priority = 'upSupplierNearDeath';
        }

        if (_.sum(creep.carry) == 0) {
            //Get from storage
            //Get power if available and powerSpawn is empty
            var storageTarget = creep.room.storage;
            if (storageTarget) {
                var getPower = false;
                var powerAmount = 0;
                var powerSource = storageTarget;
                var pSpawn = powerSpawnOf(creep.room);
                if (pSpawn && pSpawn.store.getFreeCapacity(RESOURCE_POWER) >= 50) {
                    if (!(storageTarget.store[RESOURCE_POWER] > 0) && creep.room.terminal && creep.room.terminal.store[RESOURCE_POWER] > 0) {
                        powerSource = creep.room.terminal;
                    }
                    if (powerSource.store[RESOURCE_POWER] > 0) {
                        getPower = true;
                        powerAmount = Math.min(pSpawn.store.getFreeCapacity(RESOURCE_POWER), powerSource.store[RESOURCE_POWER], creep.store.getFreeCapacity());
                    }
                }
                var upLink = Game.getObjectById(creep.memory.linkTarget);
                if (!getPower && !upgrades(creep) && energyTarget(creep, upLink, pSpawn) === null) {
                    // Nothing wants energy (the upgrader link is full without an upgrader at
                    // RCL8): wait empty-handed, ready for the next power load.
                    handleMovementCoordination(creep);
                } else if (getPower) {
                    var withdrawResult = creep.withdraw(powerSource, RESOURCE_POWER, powerAmount);
                    if (withdrawResult == ERR_NOT_IN_RANGE) {
                        creep.travelTo(powerSource, {
                            ignoreRoads: true,
                            maxRooms: 1
                        });
                    } else if (withdrawResult == OK) {
                        locateSupplierTarget("POWER", creep);
                    }
                } else {
                    const overflow = require('creep.logistics').overflowSource(creep);   // the upgrade miner's overflow link first
                    if (overflow) {
                        storageTarget = overflow;
                    } else if (creep.room.terminal && storageTarget.store[RESOURCE_ENERGY] < 250000 && creep.room.terminal.store[RESOURCE_ENERGY] > require('system.siegeWatch').terminalEnergyGoal(creep.room) + 1000) {
                        storageTarget = creep.room.terminal
                    }
                    var withdrawResult = creep.withdraw(storageTarget, RESOURCE_ENERGY);
                    if (withdrawResult == ERR_NOT_IN_RANGE) {
                        creep.travelTo(storageTarget, {
                            ignoreRoads: true,
                            maxRooms: 1
                        });
                    } else if (withdrawResult == OK) {
                        locateSupplierTarget("ENERGY", creep);
                    }
                }
            }
        } else {
            if (creep.carry[RESOURCE_POWER] > 0) {
                //Drop off in power Spawn (back in storage if it is gone or full)
                var pSpawn = powerSpawnOf(creep.room);
                if (!pSpawn || pSpawn.store.getFreeCapacity(RESOURCE_POWER) <= 0) pSpawn = creep.room.storage;
                if (pSpawn) {
                    var transferResult = creep.transfer(pSpawn, RESOURCE_POWER);
                    if (transferResult == ERR_NOT_IN_RANGE) {
                        creep.travelTo(pSpawn, {
                            maxRooms: 1
                        });
                    } else if (transferResult == OK) {
                        determineIfEmptyPower(pSpawn, creep);
                    }
                    handleMovementCoordination(creep);
                }
            } else {
                // The upgrade link only when it and the upgrade miner's links are all low; the power
                // spawn when it needs energy; otherwise it upgrades the controller itself (WORK
                // parts, below RCL8). Holding energy used to block every power run: with nothing
                // to do it goes back.
                const target = energyTarget(creep, Game.getObjectById(creep.memory.linkTarget), powerSpawnOf(creep.room));
                if (!target && upgrades(creep)) {
                    const result = creep.upgradeController(creep.room.controller);
                    if (result == ERR_NOT_IN_RANGE) {
                        delete creep.memory.onPoint;
                        creep.travelTo(creep.room.controller, { range: 3, maxRooms: 1 });
                    } else if (result == OK) {
                        creep.memory.onPoint = true;
                    }
                    return;
                }
                delete creep.memory.onPoint;
                var upLink = target || creep.room.storage;
                if (upLink) {
                    var transferResult = creep.transfer(upLink, RESOURCE_ENERGY);
                    if (transferResult == ERR_NOT_IN_RANGE) {
                        creep.travelTo(upLink, {
                            maxRooms: 1
                        });
                    } else if (transferResult == OK && upLink.structureType == STRUCTURE_LINK){
                        determineIfEmptyEnergy(upLink, creep);
                    }
                    handleMovementCoordination(creep);
                }
            }
        }
    }
};

function powerSpawnOf(room) {
    var list = Memory.powerSpawnList && Memory.powerSpawnList[room.name];
    return list && list.length ? Game.getObjectById(list[0]) : null;
}

// Where energy is wanted: the upgrade link when it runs low with the upgrade miner's links low too
// (linkLow: nothing is coming its way), else a power spawn low on energy that has power to burn.
// null: nowhere. It used to fill the upgrade link whenever it had room, beside a miner sending it
// energy anyway.
function energyTarget(creep, upLink, pSpawn) {
    upLink = upLink || require('system.links').upgradeLink(creep.room);
    if (upLink && upLink.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && (linkLow(creep.room, upLink) || upgradersStarved(creep.room, upLink))) return upLink;
    if (pSpawn && pSpawn.store[RESOURCE_POWER] > 0 && pSpawn.store.getFreeCapacity(RESOURCE_ENERGY) >= 500) return pSpawn;
    return null;
}

const LINK_LOW = 200;
function linkLow(room, upLink) {
    if ((upLink.store[RESOURCE_ENERGY] || 0) >= LINK_LOW) return false;
    const sources = Memory.sourceList && Memory.sourceList[room.name];
    const source = sources && sources[1] && Game.getObjectById(sources[1]);
    const near = source ? require('system.links').sendersNear(room, source.pos, 2) : [];
    return near.reduce((n, l) => n + (l.store[RESOURCE_ENERGY] || 0), 0) < LINK_LOW;
}

// The upgrade link dry (under LINK_DRY) with an upgrader in place beside it (within UPGRADER_NEAR)
// out of energy: its big WORK count stands idle while the supplier upgrades with its few, so the
// load goes in the link, whatever the miner's links hold (under 400 they send nothing yet). Not
// while the room is under attack: upgraders hold then (system.maintenance.attackHold).
const LINK_DRY = 100;
const UPGRADER_NEAR = 4;
const UPGRADER_ROLES = new Set(['upgrader', 'upgraderNearDeath']);
function upgradersStarved(room, upLink) {
    if ((upLink.store[RESOURCE_ENERGY] || 0) >= LINK_DRY || require('system.maintenance').attackHold(room)) return false;
    return require('runtime.cache').find(room, FIND_MY_CREEPS).some(c => c.memory && UPGRADER_ROLES.has(c.memory.priority) && !c.spawning &&
        !(c.store && c.store[RESOURCE_ENERGY] > 0) && c.pos.inRangeTo(upLink, UPGRADER_NEAR));
}

// It upgrades with its WORK parts below RCL8 (at RCL8 it only runs power).
// Not while the room is under attack (system.maintenance.attackHold): it only hauls then.
function upgrades(creep) {
    return !!(creep.room.controller && creep.room.controller.my && creep.room.controller.level < 8 &&
        !require('system.maintenance').attackHold(creep.room) &&
        typeof creep.getActiveBodyparts === 'function' && creep.getActiveBodyparts(WORK) > 0);
}

function locateSupplierTarget(targetType, creep) {
    if (targetType == "POWER") {
        var pSpawn = Game.getObjectById(Memory.powerSpawnList[creep.room.name][0]);
        if (pSpawn) {
            creep.travelTo(pSpawn, {
                maxRooms: 1
            });
        }
    } else {
        //Energy
        var upLink = Game.getObjectById(creep.memory.linkTarget);
        if (upLink) {
            creep.travelTo(upLink, {
                maxRooms: 1
            });
        }
    }
}

//Below functions are only fired when OK is returned
function determineIfEmptyPower(thisSpawn, creep) {
    if (_.sum(creep.carry) <= thisSpawn.powerCapacity - thisSpawn.power) {
        var storageTarget = creep.room.storage;
        if (storageTarget) {
            creep.travelTo(storageTarget, {
                ignoreRoads: true,
                maxRooms: 1
            });
        }
    }
}

function determineIfEmptyEnergy(thisLink, creep) {
    if (_.sum(creep.carry) <= thisLink.energyCapacity - thisLink.energy) {
        var storageTarget = creep.room.storage;
        if (storageTarget) {
            creep.travelTo(storageTarget, {
                ignoreRoads: true,
                maxRooms: 1
            });
            handleMovementCoordination(creep);
        }
    }
}

function handleMovementCoordination(creep) {
    // Listen for movement requests only from upgrader-priority creeps
    let talkingCreeps = creep.pos.findInRange(FIND_MY_CREEPS, 1, {
        filter: (thisCreep) => (creep.id != thisCreep.id && thisCreep.saying && thisCreep.memory &&
            (thisCreep.memory.priority == 'upgrader' || thisCreep.memory.priority == 'upgraderNearDeath'))
    });

    if (talkingCreeps.length) {
        let coords = talkingCreeps[0].saying.split(";");
        if (coords.length == 2 &&
            creep.pos.x == parseInt(coords[0]) &&
            creep.pos.y == parseInt(coords[1])) {
            // Standing in the way of an upgrader-priority creep
            let thisDirection = creep.pos.getDirectionTo(talkingCreeps[0].pos);
            creep.move(thisDirection);
            creep.say("\uD83D\uDCA6", true);
        }
    }
}

creep_upSupplier.energyTarget = energyTarget;
creep_upSupplier.linkLow = linkLow;
creep_upSupplier.upgradersStarved = upgradersStarved;
module.exports = creep_upSupplier;