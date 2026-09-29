const { roles, fallback } = require('creep.registry');
const creep_baseOp = require('creep.baseOp');

function handleCreepOperations() {
    const remoteThrottleActive = Game.cpu.bucket < 1000 && Game.time % 2 === 1;
    const roomsAt5 = new Set(Memory.RoomsAt5 || []);
    for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        if (!creep.spawning) {
            const run = roles[creep.memory.priority] || fallback;
            run(creep, roomsAt5.has(creep.room.name), remoteThrottleActive);
        }
    }
    for (const name in Game.powerCreeps) {
        const creep = Game.powerCreeps[name];
        if (creep.shard !== Game.shard.name) continue;
        if (creep.memory.priority === 'baseOp') creep_baseOp.run(creep);
        else creep.memory.priority = 'baseOp';
    }
}
module.exports = { handleCreepOperations };
