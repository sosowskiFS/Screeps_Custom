// Drain hauler for a retiring room (system.retire): moves factory and storage contents into the
// terminal, goods first and energy last, so the terminal can ship everything to a kept room.
const retire = require('system.retire');

module.exports = {
    run: function(creep) {
        const room = Game.rooms[creep.memory.homeRoom];
        if (!room || !retire.retiring(room.name)) {
            creep.suicide();
            return;
        }
        if (creep.room.name !== room.name) {
            creep.travelTo(new RoomPosition(25, 25, room.name));
            return;
        }
        const terminal = room.terminal;
        if (!terminal) return;
        const carried = Object.keys(creep.store).find(r => creep.store[r] > 0);
        if (carried) {
            if (terminal.store.getFreeCapacity() <= 0) return;   // wait for the next shipment
            if (creep.transfer(terminal, carried) === ERR_NOT_IN_RANGE) creep.travelTo(terminal, { range: 1 });
            return;
        }
        const job = retire.nextHaul(room);
        if (!job) return;
        const amount = Math.min(job.from.store[job.resource], creep.store.getFreeCapacity(), terminal.store.getFreeCapacity());
        if (amount <= 0) return;
        if (creep.withdraw(job.from, job.resource, amount) === ERR_NOT_IN_RANGE) creep.travelTo(job.from, { range: 1 });
    }
};
