const speech = require('creep.speech');
const { operatorPresent } = require('creep.baseOp');
const { placeRoadOnPath, clearTravelMemory } = require('creep.movement');
const labPlanner = require('system.labs');
const baseMigrate = require('base.migrate');
const mineralBudget = require('system.mineralBudget');
/*
LabWorker breakpoint reference (overflow + notable thresholds)

Overflow breakpoints
- Terminal overflow cleanup: trigger when terminal free < 10,000 OR factory free < 1,000.
- Terminal overflow mineral pick: basic minerals prioritized when amount > 5,000.
- Terminal overflow reroute window: terminalOverflowUntil = Game.time + 100.
- Terminal stock refill from storage (inside handleTerminalOverflow): run when terminal free > 15,000.
- Pre-lab storage -> terminal transfer (run order step): run when terminal free >= 20,000.
- General storage -> terminal transfer helper default: min terminal free = 25,000.
- Factory overflow handling: trigger when factory free < 2,000 OR factory energy > 10,000.
- Factory overflow destination: send to terminal first if terminal free > 20,000, else storage.

Carry rules (no flip-flops)
- Tasks that withdraw (storage->terminal, mineral container) only start empty-handed and then set a
  plain Transfer target, so nothing re-issues a withdraw while the creep is loaded.
- A refused transfer (target full) hands the load to deliverLeftovers (terminal or storage).
- Watchdog: a load held over 100 ticks, or one no task wants, is put away (deliverLeftovers).

Notable non-overflow breakpoints
- Reaction (mineral4/5/6..10) re-synced every tick from the empire planner (system.labs);
  labs holding the previous reaction's minerals are emptied by withdrawWrongMineral.
- Production stop gate: reagents are not fed while terminal[mineral6] >= 40,000.
- Selling surplus compounds is handled by system.market.
- Boost/reagent lab refill threshold: refill when lab mineralAmount <= 2,500.
- Reagent feed allowed while terminal[mineral6] < 40,000.
- Result lab withdraw threshold: withdraw when lab mineralAmount >= carryCapacity.
- Store-produced guard: avoid terminal drop if source lab amount <= 2,500.
- ManageFactory room-mineral target limits by terminal free:
    - free > 50,000 => limit 40,000
    - 5,001..50,000 => limit 20,000
    - <= 5,000 => limit 3,000
- ManageFactory room-mineral move blocked when factory free < 1,500.
- NotOverLimit bar/reactant cap: 10,000 for each tracked commodity.
*/

var creep_labWorker = {
    /** @param {Creep} creep **/
    run: function(creep) {
        if (!creep.room.terminal) {
            debugSay(creep, "noTerm");
            return;
        }

        const terminal = creep.room.terminal;
        const storage = creep.room.storage;
        const roomName = creep.room.name;

        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'labWorkerNearDeath') {
            creep.memory.priority = 'labWorkerNearDeath';
        }

        // Base migration: empty the terminal/factory/lab about to be moved into the storage first.
        const evacuateId = baseMigrate.evacuationTarget(roomName);
        if (evacuateId && evacuate(creep, Game.getObjectById(evacuateId), storage)) {
            debugSay(creep, "evac");
            handleMovementCoordination(creep);
            return;
        }

        if (require('system.guardBoosts').workLabs(creep)) return;

        // Watchdog: a load held this long means some branch keeps claiming the tick without
        // delivering it (flip-flop). Put it away so the creep gets back to real work.
        if (_.sum(creep.carry) > 0) {
            if (!creep.memory.carrySince) creep.memory.carrySince = Game.time;
        } else {
            creep.memory.carrySince = undefined;
        }
        if (creep.memory.carrySince && Game.time - creep.memory.carrySince > STUCK_CARRY_TICKS &&
            deliverLeftovers(creep, terminal, storage)) {
            debugSay(creep, "unstick");
            handleMovementCoordination(creep);
            return;
        }

        // Storage/terminal/factory over their mineral budget: dump the excess (system.mineralBudget).
        if (trimExcess(creep)) {
            debugSay(creep, "dump");
            handleMovementCoordination(creep);
            return;
        }

        // A full scan just found nothing to do: stay out of the way and rescan later.
        if (creep.memory.idleUntil) {
            if (Game.time < creep.memory.idleUntil && _.sum(creep.carry) == 0) {
                handleMovementCoordination(creep);
                return;
            }
            delete creep.memory.idleUntil;
        }

        syncReaction(creep);

        creep.memory.storeProduced = (
            labView(creep).mineral1 == labView(creep).mineral6 ||
            labView(creep).mineral2 == labView(creep).mineral6 ||
            labView(creep).mineral3 == labView(creep).mineral6
        );

        const ctx = buildLabContext(creep);
        let foundWork = false;

        const currentTarget = creep.memory.structureTarget ? Game.getObjectById(creep.memory.structureTarget) : undefined;

        if (creep.memory.cleaningOverflow) {
            foundWork = dropCarried(creep);
            if (foundWork) {
                debugSay(creep, "ovfDrop");
                creep.memory.cleaningOverflow = false;
            }
        } else {
            foundWork = handleTerminalOverflow(creep);
            if (foundWork) {
                debugSay(creep, "ovfFlow");
            }
        }

        if (!foundWork) {
            foundWork = handleFactoryOverflow(creep, terminal, storage);
            if (foundWork) {
                debugSay(creep, "fOvf");
            }
        }

        if (!foundWork && storage) {
            foundWork = moveStorageMineralsToTerminal(creep, storage, terminal, 20000);
            if (foundWork) {
                debugSay(creep, "s2tPre");
            }
        }

        if (!foundWork && currentTarget) {
            debugSay(creep, creep.memory.direction == 'Withdraw' ? "actW" : "actT");
            foundWork = actOnTarget(creep, currentTarget);
        } else if (!foundWork && _.sum(creep.carry) == 0) {
            foundWork = withdrawWrongMineral(creep, ctx);
            if (foundWork) {
                debugSay(creep, "labWrong");
            }
        } else if (!foundWork && creep.memory.movingOtherMineral) {
            foundWork = deliverOtherMineral(creep, terminal);
            if (foundWork) {
                debugSay(creep, "otherDel");
            }
        } else if (!foundWork) {
            clearInstructions(creep);
            debugSay(creep, "clrInst");
        }

        if (!foundWork) {
            foundWork = findLabWork(creep, ctx, terminal);
            if (foundWork) {
                debugSay(creep, "labFlow");
            }
        }

        if (!foundWork && storage) {
            foundWork = moveStorageMineralsToTerminal(creep, storage, terminal);
            if (foundWork) {
                debugSay(creep, "s2tFlow");
            }
        }

        if (!foundWork && Memory.mineralList[roomName] && Memory.mineralList[roomName].length) {
            foundWork = haulMineralContainer(creep, terminal);
            if (foundWork) {
                debugSay(creep, "haulMin");
            }
        }

        if (!foundWork && creep.room.controller.level == 8 && Memory.nukerList[roomName].length) {
            foundWork = fillNuker(creep, terminal);
            if (foundWork) {
                debugSay(creep, "nuker");
            }
        }

        if (!foundWork && creep.memory.factory) {
            foundWork = manageFactory(creep, terminal);
            if (foundWork) {
                debugSay(creep, "factory");
            }
        }

        // Carrying something no task wanted: put it away rather than idling (or turning
        // distributor) with a mineral load.
        if (!foundWork && _.sum(creep.carry) > 0) {
            foundWork = deliverLeftovers(creep, terminal, storage);
            if (foundWork) {
                debugSay(creep, "leftover");
            }
        }

        if (!foundWork && !operatorPresent(roomName)) {
            creep.memory.previousPriority = 'labWorker';
            creep.memory.priority = 'distributor';
            creep.memory.hasDistributed = false;
            debugSay(creep, "toDist");
        }

        if (!foundWork) {
            debugSay(creep, "idle");
            if (creep.memory.priority == 'labWorker' || creep.memory.priority == 'labWorkerNearDeath') {
                creep.memory.idleUntil = Game.time + 10;
            }
        }

        handleMovementCoordination(creep);

        if (creep.memory._trav && creep.memory._trav.path && creep.memory._trav.path.length) {
            placeRoadOnPath(creep);
        }
    }
};

function NotOverLimit(thisTerminal) {
    //Determines if there's too many unsold bars in the terminal
    if (thisTerminal.store[RESOURCE_UTRIUM_BAR] && thisTerminal.store[RESOURCE_UTRIUM_BAR] >= 10000) {
        return false;
    } else if (thisTerminal.store[RESOURCE_LEMERGIUM_BAR] && thisTerminal.store[RESOURCE_LEMERGIUM_BAR] >= 10000) {
        return false;
    } else if (thisTerminal.store[RESOURCE_ZYNTHIUM_BAR] && thisTerminal.store[RESOURCE_ZYNTHIUM_BAR] >= 10000) {
        return false;
    } else if (thisTerminal.store[RESOURCE_KEANIUM_BAR] && thisTerminal.store[RESOURCE_KEANIUM_BAR] >= 10000) {
        return false;
    } else if (thisTerminal.store[RESOURCE_OXIDANT] && thisTerminal.store[RESOURCE_OXIDANT] >= 10000) {
        return false;
    } else if (thisTerminal.store[RESOURCE_REDUCTANT] && thisTerminal.store[RESOURCE_REDUCTANT] >= 10000) {
        return false;
    } else if (thisTerminal.store[RESOURCE_PURIFIER] && thisTerminal.store[RESOURCE_PURIFIER] >= 10000) {
        return false;
    } else {
        return true;
    }
}

function handleTerminalOverflow(creep) {
    const terminal = creep.room.terminal;
    if (!terminal) return false;

    if (creep.memory.fillingTerminalFromStorage && _.sum(creep.carry) == 0) {
        creep.memory.fillingTerminalFromStorage = false;
    }

    const storage = creep.room.storage;
    const factory = creep.memory.factory ? Game.getObjectById(creep.memory.factory) : undefined;

    const terminalFree = terminal.store.getFreeCapacity();
    const factoryFree = factory ? factory.store.getFreeCapacity() : 999999;

    const basicMinerals = [
        RESOURCE_HYDROGEN,
        RESOURCE_OXYGEN,
        RESOURCE_UTRIUM,
        RESOURCE_LEMERGIUM,
        RESOURCE_KEANIUM,
        RESOURCE_ZYNTHIUM,
        RESOURCE_CATALYST
    ];

    // If terminal or factory is too full, move basic minerals to storage.
    if (storage && (terminalFree < 10000 || factoryFree < 1000)) {
        if (_.sum(creep.carry) > 0) {
            creep.memory.terminalOverflowUntil = Game.time + 100;
            return dropCarried(creep);
        }

        let targetMineral = null;
        let maxAmount = 0;

        for (let mineral of basicMinerals) {
            const amount = terminal.store[mineral] || 0;
            if (amount > maxAmount && amount > 5000) {
                maxAmount = amount;
                targetMineral = mineral;
            }
        }

        if (!targetMineral) {
            let fallbackMineral = null;
            let fallbackAmount = 0;
            for (const resourceType in terminal.store) {
                if (resourceType == RESOURCE_ENERGY) {
                    continue;
                }
                const amount = terminal.store[resourceType] || 0;
                if (amount > fallbackAmount) {
                    fallbackAmount = amount;
                    fallbackMineral = resourceType;
                }
            }
            if (!fallbackMineral && (terminal.store[RESOURCE_ENERGY] || 0) > 0) {
                fallbackMineral = RESOURCE_ENERGY;
            }
            targetMineral = fallbackMineral;
        }

        if (targetMineral) {
            const withdrawResult = creep.withdraw(terminal, targetMineral);
            if (withdrawResult == ERR_NOT_IN_RANGE) {
                creep.travelTo(terminal, {
                    maxRooms: 1,
                    ignoreRoads: true
                });
            } else if (withdrawResult == OK) {
                creep.memory.cleaningOverflow = true;
                clearTravelMemory(creep);
            }
            creep.memory.terminalOverflowUntil = Game.time + 100;
            return true;
        }

        return false;
    }

    // If terminal has room, move non-energy/power from storage to terminal.
    if (storage && terminalFree > 15000) {
        if (creep.memory.fillingTerminalFromStorage && _.sum(creep.carry) > 0) {
            const currentlyCarrying = _.findKey(creep.carry);
            if (currentlyCarrying && currentlyCarrying != RESOURCE_ENERGY && currentlyCarrying != RESOURCE_POWER) {
                const transferResult = creep.transfer(terminal, currentlyCarrying);
                if (transferResult == ERR_NOT_IN_RANGE) {
                    creep.travelTo(terminal, { maxRooms: 1, ignoreRoads: true });
                } else if (transferResult == OK) {
                    clearTravelMemory(creep);
                    if (_.sum(creep.carry) == 0) {
                        creep.memory.fillingTerminalFromStorage = false;
                    }
                }
                return true;
            }
            creep.memory.fillingTerminalFromStorage = false;
            return false;
        }

        if (_.sum(creep.carry) > 0) {
            return false;
        }

        for (const resourceType in storage.store) {
            if (resourceType == RESOURCE_ENERGY || resourceType == RESOURCE_POWER) {
                continue;
            }
            const withdrawResult = creep.withdraw(storage, resourceType);
            if (withdrawResult == ERR_NOT_IN_RANGE) {
                creep.memory.fillingTerminalFromStorage = true;
                creep.travelTo(storage, { maxRooms: 1, ignoreRoads: true });
            } else if (withdrawResult == OK) {
                creep.memory.fillingTerminalFromStorage = true;
                clearTravelMemory(creep);
            }
            return true;
        }
    }

    return false;
}

function handleFactoryOverflow(creep, terminal, storage) {
    const thisFactory = creep.memory.factory ? Game.getObjectById(creep.memory.factory) : undefined;
    if (!thisFactory) {
        return false;
    }

    const factoryFree = thisFactory.store.getFreeCapacity();
    const energyInFactory = thisFactory.store[RESOURCE_ENERGY] || 0;
    if (factoryFree >= 2000 && energyInFactory <= 10000) {
        return false;
    }

    let transferTarget = undefined;
    if (terminal && terminal.store.getFreeCapacity() > 20000) {
        transferTarget = terminal;
    } else if (storage) {
        transferTarget = storage;
    }

    if (!transferTarget) {
        return false;
    }

    if (_.sum(creep.carry) > 0) {
        const currentlyCarrying = _.findKey(creep.carry);
        if (!currentlyCarrying) {
            return false;
        }

        const transferResult = creep.transfer(transferTarget, currentlyCarrying);
        if (transferResult == ERR_NOT_IN_RANGE) {
            creep.travelTo(transferTarget, { maxRooms: 1, ignoreRoads: true });
        } else if (transferResult == OK) {
            clearTravelMemory(creep);
        }
        return true;
    }

    const withdrawCandidates = [
        RESOURCE_UTRIUM_BAR,
        RESOURCE_LEMERGIUM_BAR,
        RESOURCE_ZYNTHIUM_BAR,
        RESOURCE_KEANIUM_BAR,
        RESOURCE_OXIDANT,
        RESOURCE_REDUCTANT,
        RESOURCE_PURIFIER
    ];

    let targetResource = undefined;
    for (let i = 0; i < withdrawCandidates.length; i++) {
        const resourceType = withdrawCandidates[i];
        if ((thisFactory.store[resourceType] || 0) > 0) {
            targetResource = resourceType;
            break;
        }
    }

    if (!targetResource) {
        let roomMineral = '';
        if (Memory.mineralList[creep.room.name] && Memory.mineralList[creep.room.name].length > 0) {
            const mineralObj = Game.getObjectById(Memory.mineralList[creep.room.name][0]);
            if (mineralObj) {
                roomMineral = mineralObj.mineralType;
            }
        }
        if (roomMineral && (thisFactory.store[roomMineral] || 0) > 0) {
            targetResource = roomMineral;
        }
    }

    if (!targetResource && energyInFactory > 10000) {
        targetResource = RESOURCE_ENERGY;
    }

    if (!targetResource) {
        return false;
    }

    const withdrawResult = creep.withdraw(thisFactory, targetResource);
    if (withdrawResult == ERR_NOT_IN_RANGE) {
        creep.travelTo(thisFactory, { maxRooms: 1, ignoreRoads: true });
    } else if (withdrawResult == OK) {
        clearTravelMemory(creep);
    }

    return true;
}

const STUCK_CARRY_TICKS = 100;
const TRIM_RECHECK = 10;

// Where to take a lab mineral from: the terminal, else the storage (reaction inputs and boosts
// often sit in the storage; they used to be ignored there).
function mineralSource(creep, terminal, mineral) {
    if (!mineral) return null;
    if ((terminal.store[mineral] || 0) > 0) return terminal;
    const storage = creep.room.storage;
    return storage && (storage.store[mineral] || 0) > 0 ? storage : null;
}

// Dump excess goods while the room is over its mineral budget (system.mineralBudget): withdraw a
// load of the cheapest excess, drop it on the next tick. A load it is carrying that fits nowhere
// is dropped too. Returns true while it is busy doing this.
function trimExcess(creep) {
    const carried = _.findKey(creep.carry);
    if (creep.memory.dumping) {
        creep.memory.dumping = false;
        if (carried) {
            creep.drop(carried);
            mineralBudget.markDumped(creep.room.name, carried);
            return true;
        }
        return false;
    }
    if (Game.time < (creep.memory.trimCheck || 0)) return false;
    const excess = mineralBudget.pick(creep.room);
    if (!excess) {
        creep.memory.trimCheck = Game.time + TRIM_RECHECK;
        return false;
    }
    if (carried) {
        // Finish the current delivery, unless nothing can take it any more.
        const amount = creep.carry[carried];
        const fits = s => s && s.store.getFreeCapacity(carried) >= amount;
        if (carried === RESOURCE_ENERGY || fits(creep.room.storage) || fits(creep.room.terminal)) return false;
        clearInstructions(creep);
        creep.drop(carried);
        mineralBudget.markDumped(creep.room.name, carried);
        return true;
    }
    clearInstructions(creep);
    creep.memory.idleUntil = undefined;
    const amount = Math.min(excess.amount, creep.store.getFreeCapacity());
    const result = creep.withdraw(excess.from, excess.resource, amount);
    if (result == ERR_NOT_IN_RANGE) {
        creep.travelTo(excess.from, { maxRooms: 1, ignoreRoads: true });
    } else if (result == OK) {
        creep.memory.dumping = true;
        clearTravelMemory(creep);
    }
    return true;
}

// Put the current load somewhere it fits: terminal for minerals (storage while the terminal
// overflow window is open), storage for energy, whichever has room otherwise. Clears any
// half-finished instructions. False when nothing is carried or nothing has room.
function deliverLeftovers(creep, terminal, storage, refused) {
    const resource = _.findKey(creep.carry);
    if (!resource) return false;
    const amount = creep.carry[resource];
    const fits = target => target && target !== refused && target.store.getFreeCapacity(resource) >= amount;
    let target;
    if (resource != RESOURCE_ENERGY && !shouldStoreOverflowInStorage(creep, resource) && fits(terminal)) {
        target = terminal;
    } else if (fits(storage)) {
        target = storage;
    } else if (fits(terminal)) {
        target = terminal;
    }
    if (!target) return false;
    clearInstructions(creep);
    creep.memory.movingOtherMineral = false;
    creep.memory.fillingTerminalFromStorage = false;
    creep.memory.cleaningOverflow = false;
    const result = creep.transfer(target, resource);
    if (result == ERR_NOT_IN_RANGE) {
        creep.travelTo(target, { maxRooms: 1, ignoreRoads: true });
    } else {
        clearTravelMemory(creep);
        if (result == OK) creep.memory.carrySince = undefined;
    }
    return true;
}

// Carry everything out of `target` into the storage, one load at a time. False when there is
// nothing left to move (or nowhere to put it).
function evacuate(creep, target, storage) {
    if (!target || !storage || storage.store.getFreeCapacity() <= 0) return false;
    clearInstructions(creep);
    creep.memory.idleUntil = undefined;
    const carried = Object.keys(creep.store).find(res => creep.store[res] > 0);
    if (carried) {
        if (creep.transfer(storage, carried) == ERR_NOT_IN_RANGE) {
            creep.travelTo(storage, { maxRooms: 1, ignoreRoads: true });
        }
        return true;
    }
    const resource = Object.keys(target.store).find(res => target.store[res] > 0);
    if (!resource) return false;
    if (creep.withdraw(target, resource) == ERR_NOT_IN_RANGE) {
        creep.travelTo(target, { maxRooms: 1, ignoreRoads: true });
    }
    return true;
}

// Lab ids and minerals are not stored in creep memory (they were ~20 fields per lab worker, and
// went stale when base migration rebuilt labs). Each tick they come from the room:
//   lab1..lab10       Memory.labList[room] (boost labs 0-2, reagents 3-4, outputs 5+)
//   mineral1..3       the room's boost minerals (Memory.roomConfigs[room].mineralConfig)
//   mineral4/5, 6..10 the planner's reaction for the room: inputs, product (system.labs)
// Labs that do not exist read as 'XXX' (the old placeholder), so the checks below are unchanged.
const labViews = Object.create(null);
function labView(creep) {
    let view = labViews[creep.name];
    if (view && view.t === Game.time) return view;
    const roomName = creep.room.name;
    const ids = (Memory.labList && Memory.labList[roomName]) || [];
    const config = (Memory.roomConfigs && Memory.roomConfigs[roomName] && Memory.roomConfigs[roomName].mineralConfig) || {};
    const job = ids.length >= 6 ? labPlanner.jobFor(roomName) : null;
    view = { t: Game.time };
    for (let i = 1; i <= 10; i++) view['lab' + i] = ids[i - 1] || 'XXX';
    view.mineral1 = config.min1 || RESOURCE_CATALYZED_KEANIUM_ALKALIDE;
    view.mineral2 = config.min2 || RESOURCE_CATALYZED_GHODIUM_ACID;
    view.mineral3 = config.min3 || RESOURCE_CATALYZED_LEMERGIUM_ACID;
    view.mineral4 = job ? job.a : '';
    view.mineral5 = job ? job.b : '';
    for (let i = 6; i <= 10; i++) view['mineral' + i] = job ? job.p : '';
    for (let i = 1; i <= 10; i++) {
        if (require('system.guardBoosts').assignment(roomName, view['lab' + i])) view['lab' + i] = 'XXX';
    }
    labViews[creep.name] = view;
    return view;
}

// A new reaction: rescan now rather than after an idle wait. Labs still holding the old
// minerals count as "wrong" and get emptied.
function syncReaction(creep) {
    const view = labView(creep);
    const key = view.mineral4 + '|' + view.mineral5 + '|' + view.mineral6;
    if (creep.memory.rx === key) {
        return;
    }
    creep.memory.rx = key;
    creep.memory.idleUntil = undefined;
}

function buildLabContext(creep) {
    const labs = [];
    const minerals = [];
    const lab1 = Game.getObjectById(labView(creep).lab1);
    const lab2 = Game.getObjectById(labView(creep).lab2);
    const lab3 = Game.getObjectById(labView(creep).lab3);

    labs.push(lab1, lab2, lab3);
    minerals.push(labView(creep).mineral1, labView(creep).mineral2, labView(creep).mineral3);

    let lab4, lab5, lab6, lab7, lab8, lab9, lab10;

    if (labView(creep).lab4) {
        lab4 = Game.getObjectById(labView(creep).lab4);
        lab5 = Game.getObjectById(labView(creep).lab5);
        lab6 = Game.getObjectById(labView(creep).lab6);
        labs.push(lab4, lab5, lab6);
        minerals.push(labView(creep).mineral4, labView(creep).mineral5, labView(creep).mineral6);
    } else {
        labView(creep).lab4 = 'XXX';
        labView(creep).lab5 = 'XXX';
        labView(creep).lab6 = 'XXX';
    }

    if (labView(creep).lab7) {
        lab7 = Game.getObjectById(labView(creep).lab7);
        lab8 = Game.getObjectById(labView(creep).lab8);
        lab9 = Game.getObjectById(labView(creep).lab9);
        labs.push(lab7, lab8, lab9);
        minerals.push(labView(creep).mineral7, labView(creep).mineral8, labView(creep).mineral9);
    } else {
        labView(creep).lab7 = 'XXX';
        labView(creep).lab8 = 'XXX';
        labView(creep).lab9 = 'XXX';
    }

    if (labView(creep).lab10) {
        lab10 = Game.getObjectById(labView(creep).lab10);
        labs.push(lab10);
        minerals.push(labView(creep).mineral10);
    } else {
        labView(creep).lab10 = 'XXX';
    }

    return {
        labs,
        minerals,
        lab1,
        lab2,
        lab3,
        lab4,
        lab5,
        lab6,
        lab7,
        lab8,
        lab9,
        lab10
    };
}

function dropCarried(creep) {
    const currentlyCarrying = _.findKey(creep.carry);
    if (!currentlyCarrying) {
        return false;
    }
    const storage = creep.room.storage;
    if (storage && storage.store.getFreeCapacity() >= 100000) {
        const transferResult = creep.transfer(storage, currentlyCarrying);
        if (transferResult == ERR_NOT_IN_RANGE) {
            creep.travelTo(storage, { maxRooms: 1, ignoreRoads: true });
        } else {
            clearTravelMemory(creep);
        }
        return true;
    }

    // Storage nearly full. This load came out of the overflowing terminal: putting it back there
    // is exactly the shuffle that kept a lab worker busy forever. It is excess: dump it.
    if (deliverLeftovers(creep, creep.room.terminal, storage, creep.room.terminal)) {
        return true;
    }
    creep.drop(currentlyCarrying);
    mineralBudget.markDumped(creep.room.name, currentlyCarrying);
    clearTravelMemory(creep);
    return true;
}

function actOnTarget(creep, target) {
    if (creep.memory.direction == 'Withdraw' && creep.memory.priority != 'labWorkerNearDeath') {
        const withdrawResult = creep.withdraw(target, creep.memory.mineralToMove);
        if (withdrawResult == ERR_NOT_IN_RANGE) {
            debugSay(creep, "mv->W");
            creep.travelTo(target, { maxRooms: 1, ignoreRoads: true });
        } else {
            debugSay(creep, withdrawResult == OK ? "W:OK" : "W:ERR");
            const carriedResource = _.findKey(creep.carry);
            if (creep.memory.movingOtherMineral && creep.memory.otherMineralTarget && carriedResource) {
                creep.memory.structureTarget = creep.memory.otherMineralTarget;
                creep.memory.direction = 'Transfer';
                creep.memory.mineralToMove = carriedResource;
            } else {
                clearInstructions(creep);
            }
            clearTravelMemory(creep);
        }
        return true;
    }

    const storage = creep.room.storage;
    if (shouldStoreOverflowInStorage(creep, creep.memory.mineralToMove) && target == creep.room.terminal && storage) {
        target = storage;
    }

    const transferResult = creep.transfer(target, creep.memory.mineralToMove);
    if (transferResult == ERR_NOT_IN_RANGE) {
        debugSay(creep, "mv->T");
        creep.travelTo(target, { maxRooms: 1, ignoreRoads: true });
    } else {
        debugSay(creep, transferResult == OK ? "T:OK" : "T:ERR");
        clearInstructions(creep);
        clearTravelMemory(creep);
    }
    return true;
}

function withdrawWrongMineral(creep, ctx) {
    for (let i = 0; i < ctx.labs.length; i++) {
        const lab = ctx.labs[i];
        const expected = ctx.minerals[i];
        if (lab && lab.mineralAmount > 0 && lab.mineralType != expected) {
            creep.memory.movingOtherMineral = true;
            const withdrawResult = creep.withdraw(lab, lab.mineralType);
            if (withdrawResult == ERR_NOT_IN_RANGE) {
                creep.travelTo(lab, { maxRooms: 1, ignoreRoads: true });
                creep.memory.structureTarget = lab.id;
                creep.memory.direction = 'Withdraw';
                creep.memory.mineralToMove = lab.mineralType;
            } else if (withdrawResult == OK) {
                clearTravelMemory(creep);
            }
            return true;
        }
    }
    return false;
}

function deliverOtherMineral(creep, terminal) {
    const currentlyCarrying = _.findKey(creep.carry);
    if (!currentlyCarrying) {
        creep.memory.movingOtherMineral = false;
        clearInstructions(creep);
        return false;
    }

    let transferTarget = terminal;
    if (creep.memory.otherMineralTarget) {
        transferTarget = Game.getObjectById(creep.memory.otherMineralTarget) || terminal;
    }

    const storage = creep.room.storage;
    if (shouldStoreOverflowInStorage(creep, currentlyCarrying) && transferTarget == terminal && storage) {
        transferTarget = storage;
    }

    const transferResult = creep.transfer(transferTarget, currentlyCarrying);
    if (transferResult == ERR_NOT_IN_RANGE) {
        creep.travelTo(transferTarget, { maxRooms: 1, ignoreRoads: true });
        creep.memory.structureTarget = transferTarget.id;
        creep.memory.direction = 'Transfer';
        creep.memory.mineralToMove = currentlyCarrying;
    } else if (transferResult == OK) {
        creep.memory.movingOtherMineral = false;
        clearInstructions(creep);
        clearTravelMemory(creep);
    } else {
        // Refused (target full...): hand the load to deliverLeftovers instead of retrying forever.
        creep.memory.movingOtherMineral = false;
        clearInstructions(creep);
        return deliverLeftovers(creep, terminal, creep.room.storage, transferTarget);
    }
    return true;
}

function clearInstructions(creep) {
    creep.memory.structureTarget = undefined;
    creep.memory.direction = undefined;
    creep.memory.mineralToMove = undefined;
    creep.memory.otherMineralTarget = undefined;
}

function findLabWork(creep, ctx, terminal) {
    const warBoosts = Game.flags[creep.room.name + "WarBoosts"];

    for (let i = 0; i < ctx.labs.length; i++) {
        const lab = ctx.labs[i];
        const mineral = ctx.minerals[i];
        if (!lab) {
            continue;
        }

        if (warBoosts) {
            if (lab.id == labView(creep).lab4 || lab.id == labView(creep).lab5 || lab.id == labView(creep).lab6 ||
                lab.id == labView(creep).lab1 || lab.id == labView(creep).lab2 || lab.id == labView(creep).lab3) {
                return handleBoostLab(creep, lab, mineral, terminal);
            }
            continue;
        }

        if (lab.id == labView(creep).lab4 || lab.id == labView(creep).lab5) {
            if (handleReagentLab(creep, lab, mineral, terminal)) {
                return true;
            }
            continue;
        }

        if (lab.id == labView(creep).lab6 || lab.id == labView(creep).lab7 || lab.id == labView(creep).lab8 || lab.id == labView(creep).lab9 || lab.id == labView(creep).lab10) {
            if (handleResultLab(creep, ctx, lab, mineral, terminal)) {
                return true;
            }
            continue;
        }

        if (lab.id == labView(creep).lab1 || lab.id == labView(creep).lab2 || lab.id == labView(creep).lab3) {
            if (handleBoostLab(creep, lab, mineral, terminal)) {
                return true;
            }
        }
    }

    return false;
}

function handleBoostLab(creep, lab, mineral, terminal) {
    if (_.sum(creep.carry) == 0 && creep.memory.priority != 'labWorkerNearDeath') {
        const source = mineralSource(creep, terminal, mineral);
        const minLab = lab.mineralAmount;
        if (minLab <= 2500 && source) {
            creep.memory.structureTarget = source.id;
            creep.memory.direction = 'Withdraw';
            creep.memory.mineralToMove = mineral;
            const withdrawResult = creep.withdraw(source, mineral);
            if (withdrawResult == ERR_NOT_IN_RANGE) {
                creep.travelTo(source, { maxRooms: 1, ignoreRoads: true });
            } else if (withdrawResult == OK) {
                clearInstructions(creep);
                clearTravelMemory(creep);
            }
            return true;
        }
        return false;
    }

    const carryAmount = creep.carry[mineral] || 0;
    if (carryAmount > 0 && lab.mineralAmount <= 2500) {
        creep.memory.structureTarget = lab.id;
        creep.memory.direction = 'Transfer';
        creep.memory.mineralToMove = mineral;
        const transferResult = creep.transfer(lab, mineral);
        if (transferResult == ERR_NOT_IN_RANGE) {
            creep.travelTo(lab, { maxRooms: 1, ignoreRoads: true });
        } else if (transferResult == OK) {
            clearInstructions(creep);
            clearTravelMemory(creep);
        }
        return true;
    }

    return false;
}

function handleReagentLab(creep, lab, mineral, terminal) {
    if (_.sum(creep.carry) == 0 && creep.memory.priority != 'labWorkerNearDeath') {
        if (terminal.store[labView(creep).mineral6] < 40000 || !terminal.store[labView(creep).mineral6]) {
            const source = mineralSource(creep, terminal, mineral);
            if (source && lab.mineralAmount < lab.mineralCapacity - creep.carryCapacity) {
                creep.memory.structureTarget = source.id;
                creep.memory.direction = 'Withdraw';
                creep.memory.mineralToMove = mineral;
                const withdrawResult = creep.withdraw(source, mineral);
                if (withdrawResult == ERR_NOT_IN_RANGE) {
                    creep.travelTo(source, { maxRooms: 1, ignoreRoads: true });
                } else if (withdrawResult == OK) {
                    clearInstructions(creep);
                    clearTravelMemory(creep);
                }
                return true;
            }
        }
        return false;
    }

    if (creep.carry[mineral] && lab.mineralAmount < lab.mineralCapacity - creep.carryCapacity) {
        creep.memory.structureTarget = lab.id;
        creep.memory.direction = 'Transfer';
        creep.memory.mineralToMove = mineral;
        const transferResult = creep.transfer(lab, mineral);
        if (transferResult == ERR_NOT_IN_RANGE) {
            creep.travelTo(lab, { maxRooms: 1, ignoreRoads: true });
        } else if (transferResult == OK) {
            clearInstructions(creep);
            clearTravelMemory(creep);
        }
        return true;
    }

    return false;
}

function handleResultLab(creep, ctx, lab, mineral, terminal) {
    if (_.sum(creep.carry) == 0 && creep.memory.priority != 'labWorkerNearDeath') {
        if (lab.mineralAmount >= creep.carryCapacity) {
            creep.memory.structureTarget = lab.id;
            creep.memory.direction = 'Withdraw';
            creep.memory.mineralToMove = mineral;
            const withdrawResult = creep.withdraw(lab, lab.mineralType);
            if (withdrawResult == ERR_NOT_IN_RANGE) {
                creep.travelTo(lab, { maxRooms: 1, ignoreRoads: true });
            } else if (withdrawResult == OK) {
                clearInstructions(creep);
                clearTravelMemory(creep);
            }
            return true;
        }
        return false;
    }

    if (!creep.carry[mineral]) {
        return false;
    }

    if (creep.memory.storeProduced) {
        let labAmount = 9999;
        if (mineral == labView(creep).mineral1 && ctx.lab1) {
            labAmount = ctx.lab1.mineralAmount;
        } else if (mineral == labView(creep).mineral2 && ctx.lab2) {
            labAmount = ctx.lab2.mineralAmount;
        } else if (mineral == labView(creep).mineral3 && ctx.lab3) {
            labAmount = ctx.lab3.mineralAmount;
        }
        if (labAmount <= 2500) {
            return false;
        }
    }

    if (mineral == RESOURCE_GHODIUM && creep.room.controller.level == 8 && Memory.nukerList[creep.room.name].length) {
        const thisNuker = Game.getObjectById(Memory.nukerList[creep.room.name][0]);
        if (thisNuker && thisNuker.ghodiumCapacity > thisNuker.ghodium) {
            creep.memory.structureTarget = thisNuker.id;
            creep.memory.direction = 'Transfer';
            creep.memory.mineralToMove = RESOURCE_GHODIUM;
            if (creep.transfer(thisNuker, mineral) == ERR_NOT_IN_RANGE) {
                creep.travelTo(thisNuker, { maxRooms: 1, ignoreRoads: true });
            } else {
                clearInstructions(creep);
                clearTravelMemory(creep);
            }
            return true;
        }
    }

    const storage = creep.room.storage;
    const transferTarget = (shouldStoreOverflowInStorage(creep, mineral) && storage) ? storage : terminal;

    creep.memory.structureTarget = transferTarget.id;
    creep.memory.direction = 'Transfer';
    creep.memory.mineralToMove = mineral;
    if (creep.transfer(transferTarget, mineral) == ERR_NOT_IN_RANGE) {
        creep.travelTo(transferTarget, { maxRooms: 1, ignoreRoads: true });
    } else {
        clearInstructions(creep);
        clearTravelMemory(creep);
    }
    return true;
}

function shouldStoreOverflowInStorage(creep, resourceType) {
    if (!creep.memory.terminalOverflowUntil || Game.time > creep.memory.terminalOverflowUntil) {
        return false;
    }
    if (!resourceType || resourceType == RESOURCE_ENERGY) {
        return false;
    }
    return true;
}

// Starts only with empty hands: it used to run before the creep's own delivery and re-issue a
// storage withdraw every tick while loaded (ERR_FULL beside the storage -> step to the terminal,
// ERR_NOT_IN_RANGE one tile later -> step back), so a loaded lab worker paced between two tiles.
function moveStorageMineralsToTerminal(creep, storage, terminal, minTerminalFree) {
    const requiredFree = minTerminalFree || 25000;
    if (_.sum(creep.carry) > 0 || terminal.store.getFreeCapacity() < requiredFree) {
        return false;
    }
    // Overflow just pushed minerals into the storage: do not pull them straight back.
    if (shouldStoreOverflowInStorage(creep, RESOURCE_HYDROGEN)) {
        return false;
    }

    let hasNonEnergyResource = false;
    for (const resourceType in storage.store) {
        if (resourceType != RESOURCE_POWER && resourceType != RESOURCE_ENERGY && storage.store[resourceType] > 0) {
            hasNonEnergyResource = true;
            break;
        }
    }

    if (!hasNonEnergyResource) {
        return false;
    }

    let withdrawResult = "N/A";
    let moved;
    for (const resourceType in storage.store) {
        if (resourceType == RESOURCE_POWER || resourceType == RESOURCE_ENERGY || !storage.store[resourceType]) {
            continue;
        }
        moved = resourceType;
        withdrawResult = creep.withdraw(storage, resourceType);
        break;
    }

    if (withdrawResult == ERR_NOT_IN_RANGE) {
        creep.travelTo(storage, { maxRooms: 1, ignoreRoads: true });
        return true;
    }

    if (withdrawResult == OK) {
        // Loaded: the delivery is a plain transfer target from here on.
        creep.memory.structureTarget = terminal.id;
        creep.memory.direction = 'Transfer';
        creep.memory.mineralToMove = moved;
        creep.travelTo(terminal, { maxRooms: 1, ignoreRoads: true });
        return true;
    }

    return false;
}

function haulMineralContainer(creep, terminal) {
    const thisMineral = Game.getObjectById(Memory.mineralList[creep.room.name][0]);
    if (!thisMineral) {
        return false;
    }

    const nearbyContainer = thisMineral.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: { structureType: STRUCTURE_CONTAINER }
    });

    // Same rule as moveStorageMineralsToTerminal: only with empty hands (a loaded creep used to
    // pace between the container and the terminal).
    if (_.sum(creep.carry) > 0 || !nearbyContainer.length || _.sum(nearbyContainer[0].store) < creep.carryCapacity) {
        return false;
    }

    let withdrawResult = "N/A";
    let moved;
    for (const resourceType in nearbyContainer[0].store) {
        if (!nearbyContainer[0].store[resourceType]) {
            continue;
        }
        if (resourceType == RESOURCE_ENERGY) {
            if (nearbyContainer[0].store[RESOURCE_ENERGY] < creep.carryCapacity) {
                continue;
            }
        }
        moved = resourceType;
        withdrawResult = creep.withdraw(nearbyContainer[0], resourceType);
        break;
    }

    if (withdrawResult == ERR_NOT_IN_RANGE) {
        creep.travelTo(nearbyContainer[0], { maxRooms: 1, ignoreRoads: true });
        return true;
    }

    if (withdrawResult == OK) {
        creep.memory.structureTarget = terminal.id;
        creep.memory.direction = 'Transfer';
        creep.memory.mineralToMove = moved;
        creep.travelTo(terminal, { maxRooms: 1, ignoreRoads: true });
        return true;
    }

    return false;
}

function fillNuker(creep, terminal) {
    const thisNuker = Game.getObjectById(Memory.nukerList[creep.room.name][0]);
    if (!thisNuker) {
        return false;
    }

    if (thisNuker.ghodiumCapacity > thisNuker.ghodium && !creep.carry[RESOURCE_GHODIUM] && terminal.store[RESOURCE_GHODIUM]) {
        creep.memory.structureTarget = terminal.id;
        creep.memory.direction = 'Withdraw';
        creep.memory.mineralToMove = RESOURCE_GHODIUM;
        return actOnTarget(creep, terminal);
    }

    if (thisNuker.ghodiumCapacity > thisNuker.ghodium && creep.carry[RESOURCE_GHODIUM]) {
        creep.memory.structureTarget = thisNuker.id;
        creep.memory.direction = 'Transfer';
        creep.memory.mineralToMove = RESOURCE_GHODIUM;
        return actOnTarget(creep, thisNuker);
    }

    if (thisNuker.ghodiumCapacity == thisNuker.ghodium && creep.carry[RESOURCE_GHODIUM]) {
        creep.memory.structureTarget = terminal.id;
        creep.memory.direction = 'Transfer';
        creep.memory.mineralToMove = RESOURCE_GHODIUM;
        return actOnTarget(creep, terminal);
    }

    return false;
}

function manageFactory(creep, terminal) {
    const thisFactory = Game.getObjectById(creep.memory.factory);
    if (!thisFactory) {
        return false;
    }

    const withdrawCandidates = [
        RESOURCE_UTRIUM_BAR,
        RESOURCE_LEMERGIUM_BAR,
        RESOURCE_ZYNTHIUM_BAR,
        RESOURCE_KEANIUM_BAR,
        RESOURCE_OXIDANT,
        RESOURCE_REDUCTANT,
        RESOURCE_PURIFIER
    ];

    for (let i = 0; i < withdrawCandidates.length; i++) {
        const res = withdrawCandidates[i];
        if (thisFactory.store[res] && thisFactory.store[res] >= creep.carryCapacity) {
            creep.memory.structureTarget = thisFactory.id;
            creep.memory.direction = 'Withdraw';
            creep.memory.mineralToMove = res;
            creep.memory.movingOtherMineral = true;
            return actOnTarget(creep, thisFactory);
        }
    }

    let roomMineral = '';
    if (Memory.mineralList[creep.room.name] && Memory.mineralList[creep.room.name].length > 0) {
        const mineralObj = Game.getObjectById(Memory.mineralList[creep.room.name][0]);
        if (mineralObj) {
            roomMineral = mineralObj.mineralType;
        }
    }

    if (!roomMineral) {
        return false;
    }

    let terminalLimit = 40000;
    const freeRoom = terminal.store.getFreeCapacity();
    if (freeRoom <= 5000) {
        terminalLimit = 3000;
    } else if (freeRoom <= 50000) {
        terminalLimit = 20000;
    }

    const factoryFree = thisFactory.store.getFreeCapacity();
    if (terminal.store[roomMineral] && terminal.store[roomMineral] > terminalLimit && NotOverLimit(terminal) && thisFactory.store[RESOURCE_ENERGY] >= 200) {
        if (factoryFree < 1500) {
            return false;
        }
        creep.memory.structureTarget = terminal.id;
        creep.memory.direction = 'Withdraw';
        creep.memory.mineralToMove = roomMineral;
        creep.memory.movingOtherMineral = true;
        creep.memory.otherMineralTarget = thisFactory.id;
        return actOnTarget(creep, terminal);
    }

    return false;
}

function handleMovementCoordination(creep) {
    let talkingCreeps = creep.pos.findInRange(FIND_MY_CREEPS, 1, {
        filter: (thisCreep) => (creep.id != thisCreep.id && thisCreep.saying)
    });

    if (talkingCreeps.length) {
        const coords = talkingCreeps[0].saying.split(";");
        if (coords.length == 2 && creep.pos.x == parseInt(coords[0]) && creep.pos.y == parseInt(coords[1])) {
            const thisDirection = creep.pos.getDirectionTo(talkingCreeps[0].pos);
            creep.move(thisDirection);
            creep.say("\uD83D\uDCA6", true);
        }
    }

    if (Game.flags[creep.room.name + "RoomOperator"]) {
        talkingCreeps = creep.pos.findInRange(FIND_MY_POWER_CREEPS, 1, {
            filter: (thisCreep) => (creep.id != thisCreep.id && thisCreep.saying)
        });

        if (talkingCreeps.length) {
            const coords = talkingCreeps[0].saying.split(";");
            if (coords.length == 2 && creep.pos.x == parseInt(coords[0]) && creep.pos.y == parseInt(coords[1])) {
                const thisDirection = creep.pos.getDirectionTo(talkingCreeps[0].pos);
                creep.move(thisDirection);
                creep.say("\uD83D\uDCA6", true);
            }
        }
    }
}







function debugSay(creep, message) {
    if (!creep || !message) {
        return;
    }
    speech.say(creep, message, false);
}

module.exports = creep_labWorker;
