// Claim hunter (system.claimDefense): kills controller attackers in its home room. Hostile creeps
// with CLAIM parts first, then any other hostile player creep there; retires when the room is clear.
const claimDefense = require('system.claimDefense');
const runtimeCache = require('runtime.cache');

module.exports = {
    run: function(creep) {
        const home = Game.rooms[creep.memory.homeRoom];
        if (creep.room.name !== creep.memory.homeRoom) {
            creep.travelTo(new RoomPosition(25, 25, creep.memory.homeRoom), { range: 20 });
            return;
        }
        const others = runtimeCache.find(creep.room, FIND_HOSTILE_CREEPS).filter(c => {
            const owner = c.owner && c.owner.username;
            return owner && owner !== 'Source Keeper' && !(Memory.whiteList && Memory.whiteList.includes(owner));
        });
        const claimers = home ? claimDefense.claimers(home) : [];
        const target = creep.pos.findClosestByRange(claimers.length ? claimers : others);
        if (!target) {
            creep.memory.idle = (creep.memory.idle || 0) + 1;
            if (creep.memory.idle > 50) creep.suicide();   // room clear for a while
            return;
        }
        creep.memory.idle = 0;
        if (creep.attack(target) === ERR_NOT_IN_RANGE) creep.travelTo(target, { range: 1, movingTarget: true, maxRooms: 1 });
    }
};
