const remoteMining = require('system.remoteMining');
const badRooms = require('system.badRooms');

// 1-MOVE scout for remote-mining intel. It visits each room its home needs looked at
// (unknown/stale intel, or a disabled remote due a safety check), records it on arrival,
// and retires when done. Source flags are placed by system.remoteMining, not by the scout.
var creep_farScout = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (!creep.memory.targets) {
            creep.memory.targets = remoteMining.scoutTargets(creep.memory.homeRoom);
        }
        const targets = creep.memory.targets;

        // Whatever room we are in is visible now: record it once per visit (covers rooms on the way too).
        const record = Memory.remoteIntel && Memory.remoteIntel[creep.room.name];
        if (!record || Game.time - record.t > 50) {
            remoteMining.recordIntel(creep.room);
        }
        badRooms.record(creep.room);
        while (targets.length && targets[0] === creep.room.name) {
            targets.shift();
        }

        if (!targets.length && creep.memory.badRoomCheck) {
            creep.suicide();
            return;
        }
        if (!targets.length) {
            Memory.scoutedMiningRooms = Memory.scoutedMiningRooms || [];
            if (Memory.scoutedMiningRooms.indexOf(creep.memory.homeRoom) === -1) {
                Memory.scoutedMiningRooms.push(creep.memory.homeRoom);
            }
            creep.suicide();
            return;
        }

        const result = creep.travelTo(new RoomPosition(25, 25, targets[0]), { range: 20, allowHostile: false, maxOps: 4000 });
        if (result === ERR_NO_PATH) {
            // Unreachable (walled off or blocked): skip it rather than walking in place.
            targets.shift();
        }
    }
};

module.exports = creep_farScout;
