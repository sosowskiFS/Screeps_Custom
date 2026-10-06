const { roles, fallback, tierOf } = require('creep.registry');
const governor = require('runtime.cpuGovernor');
const creep_baseOp = require('creep.baseOp');
const roomCpu = require('runtime.roomCpu');
const { depositBeforeDeath } = require('creep.logistics');

// Home logistics roles that can die carrying a full load (energy, minerals, power).
const BANK_BEFORE_DEATH = new Set(['mule', 'muleNearDeath', 'distributor', 'distributorNearDeath',
    'labWorker', 'labWorkerNearDeath', 'upSupplier', 'upSupplierNearDeath', 'supplier', 'supplierNearDeath',
    'scraper', 'scraperNearDeath', 'salvager', 'salvagerNearDeath']);

// One failing creep must not stop every creep after it. Log each error once per
// 100 ticks per role so a persistent bug cannot flood the console or burn CPU.
const lastReported = Object.create(null);
function report(kind, name, role, error) {
    const key = kind + ':' + role;
    if (lastReported[key] !== undefined && Game.time - lastReported[key] < 100) return;
    lastReported[key] = Game.time;
    console.log(`[${kind} ${name} (${role})] ${error && error.stack ? error.stack : error}`);
}

function handleCreepOperations() {
    const roomsAt5 = new Set(Memory.RoomsAt5 || []);
    // Each creep's CPU is charged to its home room (remote creeps count toward their base).
    const cpu = roomCpu.timer();
    for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        // Over budget, the governor thins optional (then economy) creeps on a staggered share of
        // ticks; essential creeps always run.
        if (!creep.spawning && governor.shouldRun(name, tierOf(creep))) {
            const home = creep.memory.homeRoom || creep.room.name;
            const run = roles[creep.memory.priority] || fallback;
            try {
                if (!(BANK_BEFORE_DEATH.has(creep.memory.priority) && depositBeforeDeath(creep))) {
                    run(creep, roomsAt5.has(creep.room.name));
                }
            } catch (error) {
                report('creep', name, creep.memory.priority, error);
            }
            cpu.lap(home);
        }
    }
    for (const name in Game.powerCreeps) {
        const creep = Game.powerCreeps[name];
        if (creep.shard !== Game.shard.name) continue;
        const home = creep.memory.homeRoom || (creep.room && creep.room.name);
        try {
            if (creep.memory.priority === 'baseOp') creep_baseOp.run(creep);
            else creep.memory.priority = 'baseOp';
        } catch (error) {
            report('powerCreep', name, creep.memory.priority, error);
        }
        cpu.lap(home);
    }
}
module.exports = { handleCreepOperations };
