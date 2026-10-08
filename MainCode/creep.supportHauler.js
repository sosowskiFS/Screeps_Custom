// Support hauler (system.expansion): trucks energy from the sponsor's storage to a new room's
// storage while the new room is short and the sponsor can spare it. Retires when either stops
// being true, or when it could not finish another round trip.
const expansion = require('system.expansion');

module.exports = {
    run: function(creep) {
        const home = Game.rooms[creep.memory.homeRoom];
        const target = Game.rooms[creep.memory.destination];
        const energy = creep.store[RESOURCE_ENERGY] || 0;
        if (energy > 0) {
            const storage = target && target.storage && target.storage.my ? target.storage : null;
            if (!storage) {
                // No storage there (destroyed?): bring it back home.
                if (home && home.storage && creep.transfer(home.storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.travelTo(home.storage, { range: 1 });
                return;
            }
            const result = creep.transfer(storage, RESOURCE_ENERGY);
            if (result === ERR_NOT_IN_RANGE) creep.travelTo(storage, { range: 1 });
            else if (result === OK && creep.memory.left) creep.memory.trip = Game.time - creep.memory.left;
            return;
        }
        const tripBack = (creep.memory.trip || 0) * 2 + 20;
        if (!expansion.supplyWanted(creep.memory.destination, creep.memory.homeRoom) || creep.ticksToLive < tripBack) {
            creep.suicide();
            return;
        }
        const source = home && home.storage;
        if (!source) return;
        const result = creep.withdraw(source, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) creep.travelTo(source, { range: 1 });
        else if (result === OK) creep.memory.left = Game.time;
    }
};
