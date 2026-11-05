const runtimeCache = require('runtime.cache');
const defenseWatch = require('defense.watch');
// system.defense — Screeps tick subsystem.
const tower_Operate = require('tower.Operate');
const roomCpu = require('runtime.roomCpu');

// Rooms come off Memory.roomsUnderAttack (and roomsPrepSalvager) only through their own towers
// (handleHostileDetection), so a room lost while listed stayed listed for good: shardX's list held a
// dozen rooms no longer ours, which held back pixels and more. Every tick: ours (visible, controller
// ours) or off the lists.
// A room of ours without a tower is never looked at by handleHostileDetection either (shardX's RCL2
// decoys stayed listed): it stays listed only while an armed hostile is in it.
function pruneAttackLists() {
    const ours = name => {
        const r = Game.rooms[name];
        if (!r || !r.controller || !r.controller.my) return false;
        if (runtimeCache.find(r, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } }).length) return true;
        return runtimeCache.find(r, FIND_HOSTILE_CREEPS).some(c => !(Memory.whiteList || []).includes(c.owner && c.owner.username) && armedHostile(c));
    };
    if (Memory.roomsUnderAttack && Memory.roomsUnderAttack.some(n => !ours(n))) Memory.roomsUnderAttack = Memory.roomsUnderAttack.filter(ours);
    if (Memory.roomsPrepSalvager && Memory.roomsPrepSalvager.some(n => !ours(n))) Memory.roomsPrepSalvager = Memory.roomsPrepSalvager.filter(ours);
}

// A hostile that can hurt us: live ATTACK, RANGED_ATTACK or WORK parts. A 1-MOVE scout hopping on
// E32N45's border kept the room "under attack" (and its pixels back); scouts, claimers-only and
// healers alone no longer do (towers still shoot them when one volley kills: tower.Operate).
function armedHostile(creep) {
    return (creep.body || []).some(p => p.hits > 0 && (p.type === ATTACK || p.type === RANGED_ATTACK || p.type === WORK));
}

function handleTowersAndRooms() {
    pruneAttackLists();
    var towers = _.filter(Game.structures, (structure) => structure.structureType == STRUCTURE_TOWER);
    if (towers.length) {
        var roomIntel = {};
        // Tower targeting, healing, repair and room threat handling are charged to the tower's room.
        const cpu = roomCpu.timer();
        for (var y = 0; y < towers.length; y++) {
            if (towers[y].room.controller.owner && towers[y].room.controller.owner.username == "Montblanc") {
                const roomName = towers[y].room.name;
                if (!roomIntel[roomName]) {
                    roomIntel[roomName] = processTowerRoom(towers[y]);
                }
                tower_Operate.run(towers[y], Memory.attackDuration, y, roomIntel[roomName]);
                cpu.lap(roomName);
            }
        }
    }
}

function processTowerRoom(tower) {
    //Populate the room creeps memory.
    runtimeCache.current().roomCreeps[tower.room.name] = runtimeCache.find(tower.room, FIND_MY_CREEPS);
    const roomCreeps = runtimeCache.current().roomCreeps[tower.room.name];
    let mostInjuredCreep = null;
    let mostMissingHits = 0;
    for (let i = 0; i < roomCreeps.length; i++) {
        const thisCreep = roomCreeps[i];
        const missingHits = thisCreep.hitsMax - thisCreep.hits;
        if (missingHits > mostMissingHits) {
            mostMissingHits = missingHits;
            mostInjuredCreep = thisCreep;
        }
    }
    var RampartDirection = ""
    //Check for hostiles in this room
    let hostiles = runtimeCache.find(tower.room, FIND_HOSTILE_CREEPS, {
        filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
    });
    let pHostiles = runtimeCache.find(tower.room, FIND_HOSTILE_POWER_CREEPS, {
        filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
    });

    // Under attack (and the drain watch) by armed hostiles only (armedHostile); every hostile still
    // closes the ramparts and is a tower target.
    const armed = hostiles.filter(armedHostile);
    defenseWatch.update(tower.room, armed.concat(pHostiles));
    RampartDirection = handleHostileDetection(tower.room, armed, pHostiles);
    handleRampartControl(tower.room, hostiles, pHostiles);
    controlRamparts(RampartDirection, tower);

    const allTowers = runtimeCache.find(tower.room, FIND_STRUCTURES, {
        filter: { structureType: STRUCTURE_TOWER }
    });

    return {
        roomCreeps: roomCreeps,
        mostInjuredCreep: mostInjuredCreep,
        hostiles: hostiles,
        pHostiles: pHostiles,
        allTowers: allTowers
    };
}

function handleHostileDetection(room, hostiles, pHostiles) {
    const roomName = room.name;
    let RampartDirection = "";

    const present = hostiles.length > 0 || pHostiles.length > 0;
    const draining = defenseWatch.isDraining(roomName);
    if (present && Memory.roomsUnderAttack.indexOf(roomName) === -1) {
        Memory.roomsUnderAttack.push(roomName);
        if (hostiles.length && !determineCreepThreat(hostiles[0], hostiles.length) && Memory.roomsPrepSalvager.indexOf(roomName) === -1) {
            Memory.roomsPrepSalvager.push(roomName);
        }
    } else if (!present && Memory.roomsUnderAttack.indexOf(roomName) != -1 && defenseWatch.isQuiet(roomName)) {
        // Only stand down after a quiet period. A creep bouncing on the border used to flip the
        // room in and out of "under attack" (and open/close every rampart) on each bounce.
        var UnderAttackPos = Memory.roomsUnderAttack.indexOf(roomName);
        var salvagerPos = Memory.roomsPrepSalvager.indexOf(roomName);
        var nukes = runtimeCache.find(room, FIND_NUKES);
        if (UnderAttackPos >= 0) {
            Memory.roomsUnderAttack.splice(UnderAttackPos, 1);
            if (!nukes.length) {
                RampartDirection = "Open"
            }
        }
        if (salvagerPos >= 0) {
            Memory.roomsPrepSalvager.splice(salvagerPos, 1);
        }
    }

    if (Memory.roomsUnderAttack.indexOf(roomName) > -1 && !room.controller.safeMode) {
        // A border drainer is not a siege: don't let it push the whole empire into war mode.
        if (hostiles.length && (hostiles[0].owner.username != 'Invader') && !draining) {
            Memory.attackDuration = Memory.attackDuration + 1;
        }
    } else if (Memory.roomsUnderAttack.indexOf(roomName) == -1 && Memory.attackDuration >= 250 && Memory.roomsUnderAttack.length > 0) {
        const eFarGuardFlag = Game.flags[roomName + "eFarGuard"];
        if (!eFarGuardFlag) {
            //if (Game.map.getRoomLinearDistance(roomName, Game.rooms(Memory.roomsUnderAttack[0].name)) <= 5) {
            //Game.rooms[Memory.roomsUnderAttack[0]].createFlag(25, 25, roomName + "eFarGuard");
            //}
        }
    } else if (Memory.roomsUnderAttack.length == 0) {
        Memory.attackDuration = 0;
        const eFarGuardFlag = Game.flags[roomName + "eFarGuard"];
        if (eFarGuardFlag) {
            eFarGuardFlag.remove();
        }
    }

    if (Game.time % 500 == 0) {
        var nukes = runtimeCache.find(room, FIND_NUKES);
        if (nukes.length) {
            RampartDirection = "Closed";
        }
    }

    return RampartDirection;
}

function handleRampartControl(room, hostiles, pHostiles) {
    if (hostiles.length > 0 || pHostiles.length > 0) {
        if (!Memory.ClosedRampartList[room.name]) {
            Memory.ClosedRampartList[room.name] = [];
        }

        let LockedThisTick = [];
        //Assemble list of ramparts that need to be locked
        for (let q = 0; q < hostiles.length; q++) {
            let nearbyRamparts = hostiles[q].pos.findInRange(FIND_MY_STRUCTURES, 4, {
                filter: {
                    structureType: STRUCTURE_RAMPART
                }
            })
            for (let p = 0; p < nearbyRamparts.length; p++) {
                if (nearbyRamparts[p].isPublic) {
                    nearbyRamparts[p].setPublic(false);
                }
                if (Memory.ClosedRampartList[room.name].indexOf(nearbyRamparts[p].id) == -1) {
                    Memory.ClosedRampartList[room.name].push(nearbyRamparts[p].id);
                }
                LockedThisTick.push(nearbyRamparts[p].id);
            }
        }
        for (let t = 0; t < pHostiles.length; t++) {
            let nearbyRamparts = pHostiles[t].pos.findInRange(FIND_MY_STRUCTURES, 4, {
                filter: {
                    structureType: STRUCTURE_RAMPART
                }
            })
            for (let g = 0; g < nearbyRamparts.length; g++) {
                if (nearbyRamparts[g].isPublic) {
                    nearbyRamparts[g].setPublic(false);
                }
                if (Memory.ClosedRampartList[room.name].indexOf(nearbyRamparts[g].id) == -1) {
                    Memory.ClosedRampartList[room.name].push(nearbyRamparts[g].id);
                }
                LockedThisTick.push(nearbyRamparts[g].id);
            }
        }
        //Compare ramparts locked this tick with previously locked ramparts
        for (let z = 0; z < Memory.ClosedRampartList[room.name].length; z++) {
            if (LockedThisTick.indexOf(Memory.ClosedRampartList[room.name][z]) == -1) {
                let thisRampart = Game.getObjectById(Memory.ClosedRampartList[room.name][z]);
                if (thisRampart) {
                    thisRampart.setPublic(true);
                    let tempIndex = Memory.ClosedRampartList[room.name].indexOf(thisRampart.id);
                    Memory.ClosedRampartList[room.name].splice(tempIndex, 1);
                }
            }
        }
    }
}

function controlRamparts(RampartDirection, thisTower) {
    if (RampartDirection == "Closed") {
        var roomRamparts = runtimeCache.find(thisTower.room, FIND_MY_STRUCTURES, {
            filter: {
                structureType: STRUCTURE_RAMPART
            }
        });
        for (var n = 0; n < roomRamparts.length; n++) {
            if (roomRamparts[n].isPublic) {
                roomRamparts[n].setPublic(false);
            }
        }
        Memory.ClosedRampartList[thisTower.room.name] = [];
    } else if (RampartDirection == "Open") {
        var nukes = runtimeCache.find(thisTower.room, FIND_NUKES);
        if (!nukes.length) {
            var roomRamparts = runtimeCache.find(thisTower.room, FIND_MY_STRUCTURES, {
                filter: {
                    structureType: STRUCTURE_RAMPART
                }
            });
            for (var n = 0; n < roomRamparts.length; n++) {
                if (!roomRamparts[n].isPublic) {
                    roomRamparts[n].setPublic(true);
                }
            }
        }
        Memory.ClosedRampartList[thisTower.room.name] = [];
    }
}

// True for boosted player creeps (towers alone may not hold). The old version returned from
// inside forEach, so it always answered false and boosted attackers were never recognised.
function determineCreepThreat(eCreep, totalHostiles) {
    if ((eCreep.owner.username == 'Invader' || eCreep.name.indexOf('Drainer') >= 0) || (eCreep.hitsMax <= 1000 && totalHostiles <= 1)) {
        return false;
    }
    return eCreep.body.some(thisPart => thisPart.boost);
}

module.exports = { pruneAttackLists, armedHostile, handleTowersAndRooms, processTowerRoom, handleHostileDetection, handleRampartControl, controlRamparts, determineCreepThreat };
