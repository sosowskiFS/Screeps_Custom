// creep.reactorClaimer — Seasonal World (system.reactors): a [CLAIM, MOVE] creep that takes the
// reactor in its destination room, and takes it back whenever it is claimed away while it lives.
const reactors = require('system.reactors');

module.exports = {
    run(creep) {
        const target = creep.memory.destination;
        if (!target) return;
        // Armed hostiles close: get away first (it has no fight in it).
        if (require('combat.tactics').escape(creep)) return;
        if (creep.room.name !== target) {
            const known = reactors.state()[target];
            const goal = known && known.x !== undefined ? new RoomPosition(known.x, known.y, target) : new RoomPosition(25, 25, target);
            creep.travelTo(goal, { range: known && known.x !== undefined ? 1 : 20 });
            return;
        }
        const reactor = typeof FIND_REACTORS === 'undefined' ? undefined : creep.room.find(FIND_REACTORS)[0];
        if (!reactor) return;
        if (!creep.pos.isNearTo(reactor)) {
            delete creep.memory.onPoint;
            creep.travelTo(reactor, { range: 1, maxRooms: 1 });
            return;
        }
        creep.memory.onPoint = true;   // parked beside it
        if (!reactor.my) {
            const result = creep.claimReactor(reactor);
            if (result === OK && !creep.memory.claimedAt) {
                creep.memory.claimedAt = Game.time;
                console.log('[reactors] ' + creep.name + ' claimed the reactor in ' + target +
                    (reactor.owner ? ' from ' + reactor.owner.username : ''));
            }
        }
    },
};
