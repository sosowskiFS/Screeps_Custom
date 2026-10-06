const runtimeCache = require('runtime.cache');
const combatIntel = require('combat.intel');
const combat = require('combat.tactics');
const defender = require('creep.combat');
const { findEnergySink } = require('creep.logistics');

// Base operator (power creep). Each tick:
//   1. pick a job if idle (lazily checked, priority-ordered, re-checked every few ticks when idle)
//   2. run the job; when it completes, the next job starts next tick (a second intent of the
//      same type in one tick would cancel the first)
//   3. generate ops only if no other power was used this tick (only one usePower per tick)
//   4. step aside for other creeps, keep the room power-enabled
//   5. take cover from armed hostiles last, so it overrides the job's movement
const RESERVED_FOR_OPS = 600;  // carry space kept for ops
const IDLE_RECHECK = 5;        // ticks between job searches when there is nothing to do
const BUSY_IDLE = 5;           // ticks between maintenance scans when nothing needs energy
const POWER_JOBS = new Set(['OPERATE_EXTENSION', 'OPERATE_SPAWN', 'OPERATE_TOWER', 'REGEN_SOURCE', 'OPERATE_LAB', 'OPERATE_POWER']);

var creep_baseOp = {

    /** @param {PowerCreep} creep **/
    run: function(creep) {
        if (!creep.memory.initialSetup || Game.time % 10000 == 0) {
            setupCreepMemory(creep);
        }

        const totalOps = creep.store[RESOURCE_OPS] || 0;
        const threats = reachingThreats(creep);

        // Renewal first, unless that means walking into a fight (still renew when nearly dead).
        if (creep.ticksToLive <= 250 && Memory.powerSpawnList[creep.room.name] && (!threats.length || creep.ticksToLive < 60)) {
            const powerSpawn = Game.getObjectById(Memory.powerSpawnList[creep.room.name][0]);
            if (powerSpawn && handleRenewal(creep, powerSpawn)) {
                handleHostileAvoidance(creep, threats);
                return;
            }
        }

        const underAttack = Memory.roomsUnderAttack.indexOf(creep.room.name) !== -1;
        if (!creep.memory.jobFocus && (underAttack || Game.time >= (creep.memory.nextJobCheck || 0))) {
            creep.memory.jobFocus = findNeededWork(creep, totalOps);
            if (creep.memory.jobFocus) {
                creep.memory.structureTarget = undefined;
            } else {
                creep.memory.nextJobCheck = Game.time + IDLE_RECHECK;
            }
        }

        const job = creep.memory.jobFocus;
        let usedPower = false;
        let completed = false;
        switch (job) {
            case 'OPERATE_EXTENSION':
                if (creep.powers[PWR_OPERATE_EXTENSION].cooldown <= 0) {
                    completed = usedPower = handlePowerUsage(creep, PWR_OPERATE_EXTENSION, creep.room.storage, 3);
                } else {
                    completed = true;
                }
                break;
            case 'OPERATE_SPAWN':
                completed = usedPower = handlePowerUsage(creep, PWR_OPERATE_SPAWN, getNeededSpawn(creep), 3);
                break;
            case 'OPERATE_TOWER':
                completed = usedPower = handlePowerUsage(creep, PWR_OPERATE_TOWER, getNeededTower(creep), 3);
                break;
            case 'REGEN_SOURCE':
                if (creep.powers[PWR_REGEN_SOURCE].cooldown <= 0) {
                    completed = usedPower = handlePowerUsage(creep, PWR_REGEN_SOURCE, getNeededSource(creep), 3);
                } else {
                    completed = true;
                }
                break;
            case 'OPERATE_LAB':
                completed = usedPower = handlePowerUsage(creep, PWR_OPERATE_LAB, getNeededLab(creep), 3);
                break;
            case 'OPERATE_POWER':
                completed = usedPower = handlePowerUsage(creep, PWR_OPERATE_POWER, getNeededPower(creep), 3);
                break;
            case 'FILL_SPAWNS':
                completed = handleEnergyFillJob(creep);
                break;
            case 'FILL_POWER':
                completed = handlePowerFillJob(creep);
                break;
            default:
                handleBusyWork(creep);
                break;
        }
        if (completed) {
            creep.memory.jobFocus = undefined;
            creep.memory.nextJobCheck = 0; // look for the next job next tick
            // A power job used no transfer/withdraw intents, so busywork can still run this tick.
            if (POWER_JOBS.has(job)) {
                handleBusyWork(creep);
            }
        }

        if (!usedPower && totalOps < 600 && creep.powers[PWR_GENERATE_OPS] && creep.powers[PWR_GENERATE_OPS].cooldown <= 0) {
            creep.usePower(PWR_GENERATE_OPS);
        }

        handleMovementCoordination(creep);
        handleRoomPowerEnable(creep);
        handleHostileAvoidance(creep, threats);
    }
};

function setupCreepMemory(creep) {
    // Initialize spawn list
    if (!creep.memory.spawnList || Game.time % 10000 == 0) {
        const roomSpawns = runtimeCache.find(creep.room, FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_SPAWN }
        });
        creep.memory.spawnList = roomSpawns.map(spawn => spawn.id);
    }

    // Initialize tower list
    if (!creep.memory.towerList || Game.time % 10000 == 0) {
        const roomTowers = runtimeCache.find(creep.room, FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_TOWER }
        });
        creep.memory.towerList = roomTowers.map(tower => tower.id);
    }

    // Create room operator flag if needed
    if (!Game.flags[creep.room.name + "RoomOperator"]) {
        creep.room.createFlag(46, 2, creep.room.name + "RoomOperator");
    }

    // Set link source if available
    if (Memory.linkList[creep.room.name] && Memory.linkList[creep.room.name].length >= 4) {
        creep.memory.linkSource = Memory.linkList[creep.room.name][3];
    }

    // Set home room
    if (!creep.memory.homeRoom) {
        creep.memory.homeRoom = creep.pos.roomName;
    }

    // Clear job focus on setup
    creep.memory.jobFocus = undefined;
    creep.memory.initialSetup = true;
}

function powerReady(creep, power, ops) {
    const info = creep.powers[power];
    return !!info && info.cooldown <= 0 && ops >= (POWER_INFO[power].ops || 0);
}

// Priority-ordered job list. Conditions are functions so only the checks up to the first
// match run (the old array literal evaluated every lookup on every idle tick).
function findNeededWork(creep, totalOps) {
    const room = creep.room;
    const underAttack = Memory.roomsUnderAttack.includes(room.name) && !Memory.roomsPrepSalvager.includes(room.name);
    const powerSpawnId = Memory.powerSpawnList[room.name] && Memory.powerSpawnList[room.name][0];
    const workChecks = [
        // Defence first: a boosted tower matters more than anything else during an attack.
        ['OPERATE_TOWER', () => underAttack && powerReady(creep, PWR_OPERATE_TOWER, totalOps) && getNeededTower(creep)],
        ['OPERATE_EXTENSION', () => powerReady(creep, PWR_OPERATE_EXTENSION, totalOps) && room.storage &&
            room.energyAvailable < room.energyCapacityAvailable - 900],
        // Level 5 OPERATE_EXTENSION fills every extension; spawns still need hand filling.
        ['FILL_SPAWNS', () => creep.powers[PWR_OPERATE_EXTENSION] && creep.powers[PWR_OPERATE_EXTENSION].level >= 5 &&
            spawnDeficit(room) > 0],
        ['OPERATE_SPAWN', () => powerReady(creep, PWR_OPERATE_SPAWN, totalOps) &&
            (Game.flags[room.name + "RunningAssault"] || totalOps >= 600) && totalOps >= 100 && getNeededSpawn(creep)],
        ['REGEN_SOURCE', () => powerReady(creep, PWR_REGEN_SOURCE, totalOps) && getNeededSource(creep)],
        ['OPERATE_LAB', () => powerReady(creep, PWR_OPERATE_LAB, totalOps) && !Game.flags[room.name + "WarBoosts"] && getNeededLab(creep)],
        ['OPERATE_POWER', () => powerReady(creep, PWR_OPERATE_POWER, totalOps) && room.storage &&
            room.storage.store[RESOURCE_POWER] >= 100 && getNeededPower(creep)],
        ['FILL_POWER', () => {
            if (!room.storage || room.storage.store[RESOURCE_POWER] < 100 || !powerSpawnId) return false;
            if (creep.store.getCapacity() - creep.store.getUsedCapacity() - RESERVED_FOR_OPS < 100) return false;
            const powerSpawn = Game.getObjectById(powerSpawnId);
            return powerSpawn && powerSpawn.store[RESOURCE_POWER] <= 5;
        }],
    ];

    for (const [job, condition] of workChecks) {
        if (condition()) return job;
    }
    return undefined;
}

function spawnDeficit(room) {
    let deficit = 0;
    for (const spawn of runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_SPAWN } })) {
        deficit += spawn.store.getFreeCapacity(RESOURCE_ENERGY);
    }
    return deficit;
}

function getNeededPower(creep) {
    if (!Memory.powerSpawnList[creep.room.name]) return undefined;

    const powerSpawn = Game.getObjectById(Memory.powerSpawnList[creep.room.name][0]);
    if (!powerSpawn) return undefined;

    return hasEffectActive(powerSpawn, PWR_OPERATE_POWER) ? undefined : powerSpawn;
}

function getNeededSource(creep) {
    let sourceNum = 0;
    for (let sourceID in Memory.sourceList[creep.room.name]) {
        if (sourceNum >= 1 &&
            Memory.roomsUnderAttack.includes(creep.room.name) &&
            !Memory.roomsPrepSalvager.includes(creep.room.name)) {
            continue; // Under attack, do not leave base
        }

        const thisSource = Game.getObjectById(Memory.sourceList[creep.room.name][sourceID]);
        if (thisSource && !hasEffectActive(thisSource, PWR_REGEN_SOURCE, 25)) {
            return thisSource;
        }
        sourceNum += 1;
    }
    return undefined;
}

function getNeededTower(creep) {
    for (let towerID in creep.memory.towerList) {
        const thisTower = Game.getObjectById(creep.memory.towerList[towerID]);
        if (thisTower && !hasEffectActive(thisTower, PWR_OPERATE_TOWER)) {
            return thisTower;
        }
    }
    return undefined;
}

function getNeededLab(creep) {
    if (!Memory.labList[creep.room.name]) return undefined;

    // Check if reagent labs have materials
    if (Memory.labList[creep.room.name][3] && Memory.labList[creep.room.name][4]) {
        const regLab1 = Game.getObjectById(Memory.labList[creep.room.name][3]);
        const regLab2 = Game.getObjectById(Memory.labList[creep.room.name][4]);
        if (!regLab1 || !regLab2 || !regLab1.mineralType || !regLab2.mineralType) {
            return undefined;
        }
    }

    // Check output labs (skip first 5 which are for boosts/reagents)
    for (let i = 5; i < 10; i++) {
        const labID = Memory.labList[creep.room.name][i];
        if (labID) {
            const thisLab = Game.getObjectById(labID);
            if (thisLab && !hasEffectActive(thisLab, PWR_OPERATE_LAB)) {
                return thisLab;
            }
        }
    }
    return undefined;
}

function getNeededSpawn(creep) {
    for (let spawnID in creep.memory.spawnList) {
        const thisSpawn = Game.getObjectById(creep.memory.spawnList[spawnID]);
        if (thisSpawn && !hasEffectActive(thisSpawn, PWR_OPERATE_SPAWN)) {
            return thisSpawn;
        }
    }
    return undefined;
}

// Helper function to check if a structure has an active power effect
function hasEffectActive(structure, powerType, minTimeRemaining = 0) {
    if (!structure.effects) return false;

    for (let effect of structure.effects) {
        if (effect.effect === powerType && effect.ticksRemaining > minTimeRemaining) {
            return true;
        }
    }
    return false;
}

// Returns true when the power was used (job complete). A missing target also ends the job.
function handlePowerUsage(creep, powerType, target, range = 3) {
    if (!target) {
        creep.memory.jobFocus = undefined;
        return false;
    }

    const useResult = creep.usePower(powerType, target);
    if (useResult == ERR_NOT_IN_RANGE) {
        creep.travelTo(target, {
            range: range,
            ignoreRoads: true,
            maxRooms: 1
        });
        return false;
    }
    if (useResult != OK) {
        creep.memory.jobFocus = undefined; // e.g. not enough ops: drop it, re-evaluate next tick
    }
    return useResult == OK;
}

function handleRenewal(creep, powerSpawn) {
    const renewResult = creep.renew(powerSpawn);
    if (renewResult == ERR_NOT_IN_RANGE) {
        creep.travelTo(powerSpawn, {
            ignoreRoads: true,
            maxRooms: 1
        });
        return true; // Still handling renewal
    }
    return renewResult == OK;
}

// Fill spawns by hand (level 5 OPERATE_EXTENSION covers extensions). Carries exactly the spawn
// deficit, so it no longer hauls energy for extensions it never fills.
function handleEnergyFillJob(creep) {
    const deficit = spawnDeficit(creep.room);
    if (deficit <= 0) {
        return true;
    }
    const carryRoom = creep.store.getCapacity() - RESERVED_FOR_OPS - creep.store.getUsedCapacity() + creep.store[RESOURCE_ENERGY];
    const wanted = Math.min(deficit, carryRoom);
    if (wanted <= 0 && !creep.store[RESOURCE_ENERGY]) {
        return true; // no room to carry energy (full of ops/power): let other jobs run
    }
    if (creep.store[RESOURCE_ENERGY] < wanted) {
        withdrawEnergyForJob(creep);
        return false;
    }
    return fillTargetStructures(creep);
}

function handlePowerFillJob(creep) {
    const availableCapacity = creep.store.getCapacity() - RESERVED_FOR_OPS - creep.store.getUsedCapacity();

    if (!creep.store[RESOURCE_POWER]) {
        const withdrawAmount = Math.min(100, availableCapacity);
        if (withdrawAmount <= 0) {
            return true; // Can't carry any
        }
        const withdrawResult = creep.withdraw(creep.room.storage, RESOURCE_POWER, withdrawAmount);
        if (withdrawResult == ERR_NOT_IN_RANGE) {
            creep.travelTo(creep.room.storage, {
                ignoreRoads: true,
                maxRooms: 1
            });
        } else if (withdrawResult == ERR_FULL || withdrawResult == ERR_NOT_ENOUGH_RESOURCES) {
            return true;
        }
        return false; // Still gathering power
    }
    const pSpawn = Game.getObjectById(Memory.powerSpawnList[creep.room.name][0]);
    if (!pSpawn) {
        return true; // No power spawn, job completed
    }
    const transferResult = creep.transfer(pSpawn, RESOURCE_POWER);
    if (transferResult == ERR_NOT_IN_RANGE) {
        creep.travelTo(pSpawn, {
            maxRooms: 1,
            ignoreRoads: true
        });
        return false; // Still moving to target
    }
    return transferResult == OK || transferResult == ERR_FULL;
}

function handleBusyWork(creep) {
    if (creep.memory.busyIdleUntil && Game.time < creep.memory.busyIdleUntil) {
        return; // nothing needed energy a moment ago
    }
    if (!creep.store[RESOURCE_ENERGY]) {
        withdrawEnergyForJob(creep);
        return;
    }
    if (performMaintenanceTasks(creep)) {
        delete creep.memory.busyIdleUntil;
        return;
    }
    // Nothing to fill: top up for future jobs, or rest a few ticks if already topped up.
    if (!withdrawEnergyForJob(creep)) {
        creep.memory.busyIdleUntil = Game.time + BUSY_IDLE;
    }
}

// Returns false when there is nothing to withdraw (already carrying a full load).
function withdrawEnergyForJob(creep) {
    const neededAmount = creep.store.getCapacity() - RESERVED_FOR_OPS - creep.store.getUsedCapacity() - 6;
    creep.memory.structureTarget = undefined;
    if (neededAmount <= 0) {
        return false;
    }

    // Check overflow link first
    const linkTarget = creep.memory.linkSource ? Game.getObjectById(creep.memory.linkSource) : undefined;

    if (linkTarget && linkTarget.store[RESOURCE_ENERGY] >= 400) {
        if (creep.withdraw(linkTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.travelTo(linkTarget, { ignoreRoads: true, maxRooms: 1 });
        }
        return true;
    }
    return withdrawFromStorageOrTerminal(creep, neededAmount);
}

function withdrawFromStorageOrTerminal(creep, neededAmount) {
    let storageTarget = creep.room.storage;

    // Prefer terminal in certain conditions
    if (creep.room.terminal) {
        const storageEnergy = (storageTarget && storageTarget.store[RESOURCE_ENERGY]) || 0;
        const terminalEnergy = creep.room.terminal.store[RESOURCE_ENERGY] || 0;

        if ((storageEnergy < 100000 && terminalEnergy > 0) ||
            (storageEnergy < 250000 && terminalEnergy > 31000)) {
            storageTarget = creep.room.terminal;
        }
    }

    if (!storageTarget || !storageTarget.store[RESOURCE_ENERGY]) {
        return false;
    }
    const amount = Math.min(neededAmount, storageTarget.store[RESOURCE_ENERGY]);
    if (creep.withdraw(storageTarget, RESOURCE_ENERGY, amount) == ERR_NOT_IN_RANGE) {
        creep.travelTo(storageTarget, { ignoreRoads: true, maxRooms: 1 });
    }
    return true;
}

function fillTargetStructures(creep) {
    let target = Game.getObjectById(creep.memory.structureTarget);
    if (!target || target.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) {
        target = findEnergySink(creep, [STRUCTURE_SPAWN]);
        creep.memory.structureTarget = target ? target.id : undefined;
    }
    if (!target) {
        return true; // No spawn needs energy
    }
    const result = creep.transfer(target, RESOURCE_ENERGY);
    if (result == ERR_NOT_IN_RANGE) {
        creep.travelTo(target, { ignoreRoads: true, maxRooms: 1 });
        return false;
    }
    creep.memory.structureTarget = undefined;
    // Done once this spawn is filled and no other spawn still needs energy after it.
    return spawnDeficit(creep.room) - Math.min(creep.store[RESOURCE_ENERGY], target.store.getFreeCapacity(RESOURCE_ENERGY)) <= 0;
}

// One transfer per tick: a successful transfer ends the tick's maintenance (the old version
// recursed and issued a second transfer, which cancelled the first).
function performMaintenanceTasks(creep) {
    if (creep.memory.structureTarget) {
        const target = Game.getObjectById(creep.memory.structureTarget);
        if (target && target.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            const result = creep.transfer(target, RESOURCE_ENERGY);
            if (result == ERR_NOT_IN_RANGE) {
                creep.travelTo(target, { ignoreRoads: true, maxRooms: 1 });
                return true;
            }
            creep.memory.structureTarget = undefined;
            if (result == OK) {
                return true;
            }
        } else {
            creep.memory.structureTarget = undefined;
        }
    }

    // Priority order: Terminal -> Labs -> Factory -> Storage -> PowerSpawn/Nuker
    return fillTerminal(creep) ||
        fillStructureType(creep, STRUCTURE_LAB) ||
        fillStructureType(creep, STRUCTURE_FACTORY, 10000) ||
        fillStorage(creep) ||
        (creep.room.controller.level == 8 && fillHighLevelStructures(creep));
}

function fillTerminal(creep) {
    if (!creep.room.terminal) return false;

    let targetEnergy = 0;
    if (creep.room.storage) {
        const storageEnergy = creep.room.storage.store[RESOURCE_ENERGY];
        if (storageEnergy >= 275000) targetEnergy = 60000;
        else if (storageEnergy >= 50000) targetEnergy = 30000;
    }

    const terminal = creep.room.terminal;
    if (terminal.store[RESOURCE_ENERGY] < targetEnergy && terminal.store.getFreeCapacity() > 5000) {
        return transferOrApproach(creep, terminal);
    }
    return false;
}

// Typed lookup instead of scanning every structure. limit: energy level to fill up to
// (default: full). Uses the store API; factories have no .energy, so they were never filled.
function fillStructureType(creep, structureType, limit) {
    const candidates = runtimeCache.find(creep.room, FIND_MY_STRUCTURES, { filter: { structureType: structureType } })
        .filter(s => limit ? s.store[RESOURCE_ENERGY] < limit : s.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
    if (!candidates.length) return false;
    return transferOrApproach(creep, creep.pos.findClosestByRange(candidates));
}

function fillHighLevelStructures(creep) {
    return fillStructureType(creep, STRUCTURE_POWER_SPAWN) || fillStructureType(creep, STRUCTURE_NUKER);
}

function transferOrApproach(creep, target) {
    if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
        creep.memory.structureTarget = target.id;
        creep.travelTo(target, { ignoreRoads: true, maxRooms: 1 });
    } else {
        creep.memory.structureTarget = undefined;
    }
    return true;
}

function fillStorage(creep) {
    if (!creep.room.storage) return false;

    const linkTarget = creep.memory.linkSource ? Game.getObjectById(creep.memory.linkSource) : undefined;

    // Empty the overflow link into storage, or move terminal energy into a low storage. (Without
    // the terminal check a low storage was filled and immediately withdrawn from, every tick.)
    const terminal = creep.room.terminal;
    if ((linkTarget && linkTarget.store[RESOURCE_ENERGY] >= 400) ||
        (creep.room.storage.store[RESOURCE_ENERGY] < 50000 && terminal && terminal.store[RESOURCE_ENERGY] > 0)) {
        return transferOrApproach(creep, creep.room.storage);
    }
    return false;
}

function handleMovementCoordination(creep) {
    const talkingCreeps = creep.pos.findInRange(FIND_MY_CREEPS, 1, {
        filter: (thisCreep) => (creep.id != thisCreep.id && thisCreep.saying && thisCreep.saying.indexOf(';') > 0)
    });

    if (talkingCreeps.length) {
        const coords = talkingCreeps[0].saying.split(";");
        if (coords.length == 2 &&
            creep.pos.x == parseInt(coords[0]) &&
            creep.pos.y == parseInt(coords[1])) {
            const direction = creep.pos.getDirectionTo(talkingCreeps[0].pos);
            creep.move(direction);
            creep.say("💦", true);
        }
    }
}

function handleRoomPowerEnable(creep) {
    if (creep.room.controller && !creep.room.controller.isPowerEnabled) {
        if (creep.enableRoom(creep.room.controller) == ERR_NOT_IN_RANGE) {
            creep.travelTo(creep.room.controller, {
                ignoreRoads: true,
                maxRooms: 1
            });
        }
    }
}

// Armed hostiles that could hit the operator next tick (melee reach 1 + a step, ranged 3 + a step).
function reachingThreats(creep) {
    if (creep.room.controller && creep.room.controller.safeMode) return [];
    const intel = combatIntel.roomIntel(creep.room);
    return intel.threats.filter(threat => {
        const stats = combatIntel.assess(threat);
        const reach = stats.ranged > 0 ? 4 : (stats.melee > 0 ? 2 : 0);
        return reach > 0 && creep.pos.inRangeTo(threat, reach);
    });
}

// Runs last so its movement overrides the job's. Powers still work from cover (range 3).
//  * on one of our ramparts: stay put (hits land on the rampart)
//  * otherwise: nearest rampart reachable without crossing hostile reach
//  * no rampart nearby: flee from every threat at once
// The old version always ran to the power spawn, even when the attackers were standing there.
function handleHostileAvoidance(creep, threats) {
    if (!threats.length) return;
    const room = creep.room;
    const posts = room.controller && room.controller.my ? defender.rampartPosts(room) : [];
    const here = posts.find(post => post.x === creep.pos.x && post.y === creep.pos.y);
    if (here) {
        creep.cancelOrder('move');
        return;
    }
    let best = null, bestRange = 9;
    for (const post of posts) {
        const range = Math.max(Math.abs(post.x - creep.pos.x), Math.abs(post.y - creep.pos.y));
        if (range < bestRange && !threats.some(t => Math.max(Math.abs(t.pos.x - post.x), Math.abs(t.pos.y - post.y)) <= 1)) {
            best = post;
            bestRange = range;
        }
    }
    if (best) {
        const intel = combatIntel.roomIntel(room);
        creep.travelTo(new RoomPosition(best.x, best.y, room.name), {
            range: 0,
            maxRooms: 1,
            roomCallback: (roomName, matrix) => roomName === room.name ? defender.exposeThreatZones(room, intel, matrix) : matrix,
        });
    } else {
        combat.flee(creep, threats);
    }
}

// True only while this room's operator is actually spawned here with time left. Spawn staffing
// uses this instead of the RoomOperator flag, which stays behind when the operator dies or is
// deleted (and used to leave the room with no haulers or distributors).
function operatorPresent(roomName) {
    const tick = runtimeCache.current();
    const cache = tick.operators || (tick.operators = Object.create(null));
    if (cache[roomName] === undefined) {
        cache[roomName] = null;
        for (const name in Game.powerCreeps) {
            const pc = Game.powerCreeps[name];
            if (pc.room && pc.room.name === roomName && pc.memory.homeRoom === roomName && pc.ticksToLive > 100) {
                cache[roomName] = pc;
                break;
            }
        }
    }
    return cache[roomName];
}
creep_baseOp.operatorPresent = operatorPresent;

module.exports = creep_baseOp;
