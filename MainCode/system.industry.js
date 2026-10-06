const labPlanner = require('system.labs');
const runtimeCache = require('runtime.cache');
const baseBuilder = require('base.builder');
// system.industry — Screeps tick subsystem.


function updateRoomStructureLists(thisRoom) {
    if (!Memory.structureScanTick) Memory.structureScanTick = {};
    Memory.structureScanTick[thisRoom.name] = Game.time;
    const roomName = thisRoom.name;

    // Find and store all structure IDs
    const links = runtimeCache.find(thisRoom, FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_LINK }
    });

    const sortedLinks = [];
    const controllerLinks = [];
    const storageLinks = [];
    const sourceLinks = [];
    const otherLinks = [];

    Memory.linkList[roomName] = [];
    // Categorize links by their function
    for (let link of links) {
        // Check if near controller (within 4 range)
        if (link.pos.getRangeTo(thisRoom.controller) <= 4) {
            controllerLinks.push(link);
        }
        // Check if near storage (within 3 range - increased from 2)
        else if (thisRoom.storage && link.pos.getRangeTo(thisRoom.storage) <= 3) {
            storageLinks.push(link);
        }
        // Check if near sources (within 3 range - increased from 2)
        else {
            const nearSources = link.pos.findInRange(FIND_SOURCES, 3);
            if (nearSources.length > 0) {
                sourceLinks.push(link);
            } else {
                // This link doesn't fit standard categories, but include it anyway
                otherLinks.push(link);
            }
        }
    }

     // Add first source link
    if (sourceLinks.length > 0) {
        Memory.linkList[roomName].push(sourceLinks[0].id);
    }

    //Add the controller link
    if (controllerLinks.length > 0) {
        Memory.linkList[roomName].push(controllerLinks[0].id);
    }

    //Add the second source link
    if (sourceLinks.length > 1) {
        Memory.linkList[roomName].push(sourceLinks[1].id);
    }

    //Add the storage link
    if (storageLinks.length > 0) {
        Memory.linkList[roomName].push(storageLinks[0].id);
    }

    //If there's 'other' links, just add em
    for (let link of otherLinks) {
        Memory.linkList[roomName].push(link.id);
    }

    const labs = runtimeCache.find(thisRoom, FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_LAB }
    });
    // Planned rooms: boost labs, then the two reagent labs, then outputs (labWorker and
    // manageLabOperations read roles by index). Only when every lab is a planned one.
    const labOrder = baseBuilder.labOrder(roomName);
    if (labOrder) {
        const rank = new Map(labOrder.map((tile, n) => [tile, n]));
        const key = lab => lab.pos.x * 50 + lab.pos.y;
        if (labs.every(lab => rank.has(key(lab)))) labs.sort((a, b) => rank.get(key(a)) - rank.get(key(b)));
    }
    Memory.labList[roomName] = labs.map(lab => lab.id);

    const powerSpawns = runtimeCache.find(thisRoom, FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_POWER_SPAWN }
    });
    Memory.powerSpawnList[roomName] = powerSpawns.map(ps => ps.id);

    const factories = runtimeCache.find(thisRoom, FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_FACTORY }
    });
    Memory.factoryList[roomName] = factories.map(factory => factory.id);

    const nukers = runtimeCache.find(thisRoom, FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_NUKER }
    });
    Memory.nukerList[roomName] = nukers.map(nuker => nuker.id);

    // Update sources and mineral lists
    const sources = runtimeCache.find(thisRoom, FIND_SOURCES);
    if (sources.length > 0) {
        // Sort sources by distance to storage (closest first)
        if (thisRoom.storage) {
            sources.sort((a, b) => {
                const distA = a.pos.getRangeTo(thisRoom.storage);
                const distB = b.pos.getRangeTo(thisRoom.storage);
                return distA - distB;
            });
        }
        Memory.sourceList[roomName] = sources.map(source => source.id);
    }

    const minerals = runtimeCache.find(thisRoom, FIND_MINERALS);
    if (minerals.length > 0) {
        Memory.mineralList[roomName] = [minerals[0].id]; // Store as array for consistency
    }

    const extractors = runtimeCache.find(thisRoom, FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_EXTRACTOR }
    });
    if (extractors.length > 0) {
        Memory.extractorList[roomName] = extractors[0].id;
    }
}

function manageLinkOperations(thisRoom) {
    const roomName = thisRoom.name;
    const linkIds = Memory.linkList[roomName];

    if (!linkIds || linkIds.length < 2) return;

    // Get all active links using the ordered memory array
    const links = linkIds.map(id => Game.getObjectById(id)).filter(link => link);

    if (links.length < 2) return;

    // Links are ordered as:
    // Index 0: First source link
    // Index 1: Controller link
    // Index 2: Second source link
    // Index 3: Storage link
    // Index 4+: Other links

    const sourceLink1 = links[0]; // Index 0: First source link
    const controllerLink = links[1]; // Index 1: Controller link
    const sourceLink2 = links[2]; // Index 2: Second source link (if exists)
    const storageLink = links[3]; // Index 3: Storage link (if exists)

    // Transfer from first source link (index 0)
    if (sourceLink1 && sourceLink1.energy >= 400 && sourceLink1.cooldown == 0) {
        let targetLink = null;

        // Priority 1: Controller link if it needs energy
        if (controllerLink && controllerLink.energy < 400) {
            targetLink = controllerLink;
        }
        // Priority 2: Storage link if controller link is full
        else if (storageLink && storageLink.energy < 400) {
            targetLink = storageLink;
        }

        if (targetLink) {
            const result = sourceLink1.transferEnergy(targetLink);
            if (Game.time % 100 === 0 && result === OK) {
                console.log(`${roomName}: Source link 1 -> ${targetLink === controllerLink ? 'controller' : 'storage'} link`);
            }
        }
    }

    // Transfer from second source link (index 2) if it exists
    if (sourceLink2 && sourceLink2.energy >= 400 && sourceLink2.cooldown == 0) {
        let targetLink = null;

        // Priority 1: Controller link if it needs energy
        if (controllerLink && controllerLink.energy < 400) {
            targetLink = controllerLink;
        }
        // Priority 2: Storage link if controller link is full
        else if (storageLink && storageLink.energy < 400) {
            targetLink = storageLink;
        }

        if (targetLink) {
            const result = sourceLink2.transferEnergy(targetLink);
            if (Game.time % 100 === 0 && result === OK) {
                console.log(`${roomName}: Source link 2 -> ${targetLink === controllerLink ? 'controller' : 'storage'} link`);
            }
        }
    }
}

function manageLabOperations(thisRoom) {
    const roomName = thisRoom.name;
    const labIds = Memory.labList[roomName];

    if (!labIds || labIds.length < 6) return;

    // The empire planner (system.labs) decides what this room reacts.
    const job = labPlanner.jobFor(roomName);
    if (!job) return;

    const labs = labIds.map(id => Game.getObjectById(id)).filter(lab => lab);

    // Skip first 3 labs, use labs 4 and 5 as input labs (indices 3 and 4), rest as output labs
    if (labs.length < 6) return; // Need at least 6 labs (skip 3, use 2 for input, 1+ for output)

    const inputLabs = labs.slice(3, 5); // Labs 4 and 5 (indices 3 and 4)
    const outputLabs = labs.slice(5);   // Labs 6+ (indices 5+)

    // Check if input labs have correct resources
    const input1 = job.a;
    const input2 = job.b;

    if (inputLabs[0].mineralType != input1 || inputLabs[1].mineralType != input2) {
        // Need to load correct inputs - this would be handled by lab worker creeps
        return;
    }

    // Run reactions in output labs
    for (let outputLab of outputLabs) {
        if (outputLab.cooldown == 0 &&
            inputLabs[0].mineralAmount >= LAB_REACTION_AMOUNT &&
            inputLabs[1].mineralAmount >= LAB_REACTION_AMOUNT &&
            outputLab.mineralAmount < outputLab.mineralCapacity - LAB_REACTION_AMOUNT) {

            outputLab.runReaction(inputLabs[0], inputLabs[1]);
        }
    }
}

function managePowerSpawnOperations(thisRoom) {
    const roomName = thisRoom.name;
    const powerSpawnIds = Memory.powerSpawnList[roomName];

    if (!powerSpawnIds || powerSpawnIds.length == 0) return;

    const powerSpawn = Game.getObjectById(powerSpawnIds[0]);
    if (!powerSpawn) return;

    // Process power if we have both power and energy (need 50 energy per 1 power)
    // Power spawns don't have cooldown - processPower() can be called every tick
    if (powerSpawn.power > 0 && powerSpawn.energy >= POWER_SPAWN_ENERGY_RATIO) {
        const result = powerSpawn.processPower();
    }
}

function manageFactoryOperations(thisRoom) {
    const roomName = thisRoom.name;
    const factoryIds = Memory.factoryList[roomName];

    if (!factoryIds || factoryIds.length == 0) return;

    const factory = Game.getObjectById(factoryIds[0]);
    if (!factory) return;

    // Factory operations would be handled here
    // This is a placeholder for now as factory logic can be quite complex
    if (factory.cooldown == 0) {
        // Determine what to produce based on available resources
        // This would need more sophisticated logic based on your needs
    }
}

function manageNukerOperations(thisRoom) {
    const roomName = thisRoom.name;
    const nukerIds = Memory.nukerList[roomName];

    if (!nukerIds || nukerIds.length == 0) return;

    const nuker = Game.getObjectById(nukerIds[0]);
    if (!nuker) return;

    // Nuker operations would be handled here
    // This is typically manual/flag-based operation for targeting
    const nukeFlag = Game.flags[roomName + "NukeTarget"];
    if (nukeFlag && nuker.energy >= NUKER_ENERGY_CAPACITY && nuker.ghodium >= NUKER_GHODIUM_CAPACITY && nuker.cooldown == 0) {
        const result = nuker.launchNuke(nukeFlag.pos);
        if (result == OK) {
            nukeFlag.remove();
            Game.notify('Nuke launched from ' + roomName + ' to ' + nukeFlag.pos.roomName + '!');
        }
    }
}

module.exports = { updateRoomStructureLists, manageLinkOperations, manageLabOperations, managePowerSpawnOperations, manageFactoryOperations, manageNukerOperations };
