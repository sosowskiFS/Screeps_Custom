const expansion = require('system.expansion');

// A shardX claim target (system.shardX). Never attacks a room someone else owns: that is reported
// and shard2 picks another room. Another player's reservation is worn down first
// (attackController takes a tick per CLAIM part), then the room is claimed. Anything else that
// stops the claim is reported too; shard2 keeps sending claimers until one succeeds.
function claimX(creep) {
    const shardX = require('system.shardX');
    const room = creep.room, c = room.controller;
    if (!c || c.my) { creep.suicide(); return; }
    if (c.owner) {
        shardX.noteBlock(room.name, { ow: c.owner.username });
        creep.suicide();
        return;
    }
    const reserved = c.reservation && c.reservation.username !== creep.owner.username;
    shardX.noteBlock(room.name, reserved ? { rs: c.reservation.username, e: c.reservation.ticksToEnd } : null);
    if (!creep.pos.isNearTo(c)) {
        creep.travelTo(c, { range: 1, ignoreRoads: true, offRoad: true });
        return;
    }
    if (reserved) {
        creep.attackController(c);
        return;
    }
    const result = creep.claimController(c);
    if (result !== OK) {
        shardX.noteBlock(room.name, { err: result });
        creep.suicide();
        return;
    }
    c.pos.createFlag('InitAutoBuild', COLOR_GREEN, COLOR_WHITE);
    creep.suicide();
}

var creep_claimer = {

    /** @param {Creep} creep **/
    run: function(creep) {
        /*if (creep.room.name != creep.memory.destination) {
            creep.moveTo(new RoomPosition(34, 47, creep.memory.destination));
        } else {
            if (creep.claimController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller);
            }
        }*/

        if (creep.room.name != creep.memory.destination) {
            var thisPortal = undefined;
            if (Game.flags["TakePortal"] && Game.flags["TakePortal"].pos.roomName == creep.pos.roomName) {
                var thisPortal = Game.flags["TakePortal"].pos.look(LOOK_STRUCTURES);
            }
            if (thisPortal && thisPortal.length) {
                if (creep.memory.path.length && creep.memory.path[0] == creep.room.name) {
                    creep.memory.path.splice(0, 1);
                }

                creep.travelTo(Game.flags["TakePortal"], {
                    ignoreRoads: true,
                    offRoad: true
                });
            } else if (creep.memory.path && creep.memory.path.length) {
                if (creep.memory.path[0] == creep.room.name) {
                    creep.memory.path.splice(0, 1);
                }
                creep.travelTo(new RoomPosition(25, 25, creep.memory.path[0]), {
                    ignoreRoads: true,
                    offRoad: true
                });
            } else {
                if (Game.flags["ClaimThis"] && Game.flags["ClaimThis"].pos) {
                    creep.travelTo(Game.flags["ClaimThis"], {
                        ignoreRoads: true,
                        offRoad: true
                    });
                } else {
                    creep.travelTo(new RoomPosition(25, 25, creep.memory.destination), {
                        ignoreRoads: true,
                        offRoad: true
                    });
                }
            }
        } else if (creep.memory.xTarget) {
            claimX(creep);
        } else {
            const forExpansion = Memory.expansion && Memory.expansion.t === creep.room.name;
            if (forExpansion && creep.room.controller.owner != undefined && !creep.room.controller.my) {
                // Someone else got there first: system.expansion abandons the target.
                creep.suicide();
            } else if (creep.room.controller.owner != undefined) {
                //Here to attack
                const attackResult = creep.attackController(creep.room.controller);
                if (attackResult == ERR_NOT_IN_RANGE) {
                    creep.travelTo(creep.room.controller, {
                        ignoreRoads: true,
                        offRoad: true
                    });
                } else if (attackResult == OK) {
                    if (Game.flags[creep.memory.homeRoom + "ClaimThis"]) {
                        Game.flags[creep.memory.homeRoom + "ClaimThis"].pos.createFlag(creep.memory.homeRoom + "ClaimThis;" + (Game.time + 925).toString());
                        Game.flags[creep.memory.homeRoom + "ClaimThis"].remove();
                    }
                    Memory.claimSpawn = false;
                    creep.suicide();
                }
            } else {
                const claimResult = creep.claimController(creep.room.controller);
                if (claimResult == ERR_NOT_IN_RANGE) {
                    creep.travelTo(creep.room.controller, {
                        ignoreRoads: true,
                        offRoad: true
                    });
                } else if (claimResult != OK) {
                    if (forExpansion) {
                        expansion.claimFailed(creep.room.name, claimResult);
                        creep.suicide();
                    }
                } else {
                    // Room successfully claimed - place automation flags

                    // 1. Place InitAutoBuild flag to automatically generate room structures
                    creep.room.controller.pos.createFlag("InitAutoBuild", COLOR_GREEN, COLOR_WHITE);

                    // 2. Helpers: automatic expansions get them from system.expansion; a manual
                    //    claim places the SendHelper flag for its home room.
                    if (forExpansion) {
                        expansion.claimed(creep.room.name);
                    } else if (!creep.memory.xTarget) {   // shardX targets: helpers come from shard2 (system.shardX)
                        creep.room.controller.pos.createFlag(creep.memory.homeRoom + "SendHelper", COLOR_BLUE, COLOR_WHITE);
                    }

                    // Clean up original claim flag
                    if (Game.flags[creep.memory.homeRoom + "ClaimThis"]) {
                        Game.flags[creep.memory.homeRoom + "ClaimThis"].remove();
                    }
                    Memory.claimSpawn = false;
                    creep.suicide();
                }
            }
        }
    }
};

creep_claimer.claimX = claimX;
module.exports = creep_claimer;
