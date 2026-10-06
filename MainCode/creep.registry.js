const speech = require('creep.speech');
const governor = require('runtime.cpuGovernor');
// Role aliases, dispatch policy and fallback. Add roles here; keep priorities stable.
const creep_workV2 = require('creep.workV2');
const creep_work5 = require('creep.work5');
const creep_salvager = require('creep.salvager');
const creep_supplier = require('creep.supplier');
const creep_upSupplier = require('creep.upsupplier');
const creep_miner = require('creep.miner');
const creep_upgrader = require('creep.upgrader');
const creep_repair = require('creep.repair');
const creep_labWorker = require('creep.labWorker');
const creep_farMining = require('creep.farMining');
const creep_farMule = require('creep.farMule');
const creep_farMiner = require('creep.farMiner');
const creep_farMinerSK = require('creep.farMinerSK');
const creep_combat = require('creep.combat');
const creep_claimer = require('creep.claimer');
const creep_vandal = require('creep.vandal');
const creep_Helper = require('creep.helper');
const creep_looter = require('creep.looter');
const creep_assattacker = require('creep.assattacker');
const creep_asshealer = require('creep.asshealer');
const creep_assranger = require('creep.assranger');
const creep_powerAttack = require('creep.powerAttack');
const creep_powerHeal = require('creep.powerHeal');
const creep_powerPickup = require('creep.powerCollect');
const creep_scraper = require('creep.scraper');
const creep_distantSupplier = require('creep.distantSupplier');
const creep_ranger = require('creep.ranger');
const creep_farScout = require('creep.farScout');
const creep_highwayPatrol = require('creep.highwayPatrol');
const creep_harasser = require('creep.harasser');
const roles = Object.create(null);
function register(names, run) {
    for (const name of names) roles[name] = run;
}
register(['farMule', 'farMuleNearDeath'], (creep, isRoomAt5) => {
    // Per-tick container re-scans are the first thing shed when CPU runs over budget.
    var doExcessWork = governor.allows('excessScans');
    creep_farMule.run(creep, doExcessWork);
    return;
});

register(['farMiner', 'farMinerNearDeath'], (creep, isRoomAt5) => {
    //Change to if (creep.memory.jobSpecific) after new wave is out
    if (creep.getActiveBodyparts(HEAL) > 0) {
        //SK Miner (TEMP, MAKE OWN FILE)
        //Make new memory detail on SK miner spawn too, so don't have to make this check
        creep_farMinerSK.run(creep);
    } else {
        //Normal miner
        creep_farMiner.run(creep);
    }
    return;
});

register(['farClaimer', 'farGuard', 'SKAttackGuard', 'SKHealGuard', 'farClaimerNearDeath', 'farGuardNearDeath', 'SKAttackGuardNearDeath', 'SKHealGuardNearDeath', 'farMineralMiner'], (creep, isRoomAt5) => {
    // Per-tick container re-scans are the first thing shed when CPU runs over budget.
    var doExcessWork = governor.allows('excessScans');
    creep_farMining.run(creep, doExcessWork);
    return;
});

register(['miner', 'minerNearDeath'], (creep, isRoomAt5) => {
    if (isRoomAt5) {
        creep_miner.run(creep);
    } else {
        creep_workV2.run(creep, 25);
    }
    return;
});

register(['upgrader', 'upgraderNearDeath'], (creep, isRoomAt5) => {
    if (isRoomAt5) {
        creep_upgrader.run(creep);
    } else {
        creep_workV2.run(creep, 25);
    }
    return;
});

register(['repair', 'repairNearDeath'], (creep, isRoomAt5) => {
    if (isRoomAt5) {
        creep_repair.run(creep);
    } else {
        creep_workV2.run(creep, 25);
    }
    return;
});

register(['scraper', 'scraperNearDeath'], (creep, isRoomAt5) => {
    creep_scraper.run(creep);
    return;
});

register(['salvager', 'salvagerNearDeath'], (creep, isRoomAt5) => {
    creep_salvager.run(creep);
    return;
});

register(['supplier', 'supplierNearDeath'], (creep, isRoomAt5) => {
    creep_supplier.run(creep);
    return;
});

register(['upSupplier', 'upSupplierNearDeath'], (creep, isRoomAt5) => {
    creep_upSupplier.run(creep);
    return;
});

register(['labWorker', 'labWorkerNearDeath'], (creep, isRoomAt5) => {
    creep_labWorker.run(creep);
    return;
});

register(['claimer'], (creep, isRoomAt5) => {
    creep_claimer.run(creep);
    return;
});

register(['looter'], (creep, isRoomAt5) => {
    creep_looter.run(creep);
    return;
});

register(['vandal'], (creep, isRoomAt5) => {
    creep_vandal.run(creep);
    return;
});

register(['helper'], (creep, isRoomAt5) => {
    creep_Helper.run(creep);
    return;
});

register(['defender'], (creep, isRoomAt5) => {
    creep_combat.run(creep);
    return;
});

register(['assattacker', 'assattackerNearDeath'], (creep, isRoomAt5) => {
    creep_assattacker.run(creep);
    return;
});

register(['assranger', 'assrangerNearDeath'], (creep, isRoomAt5) => {
    creep_assranger.run(creep);
    return;
});

register(['asshealer', 'asshealerNearDeath', 'targetlessHealer'], (creep, isRoomAt5) => {
    creep_asshealer.run(creep);
    return;
});

register(['powerAttack', 'powerAttackNearDeath'], (creep, isRoomAt5) => {
    creep_powerAttack.run(creep);
    return;
});

register(['powerHeal', 'powerHealNearDeath'], (creep, isRoomAt5) => {
    creep_powerHeal.run(creep);
    return;
});

register(['powerCollector'], (creep, isRoomAt5) => {
    creep_powerPickup.run(creep);
    return;
});

register(['distantSupplier'], (creep, isRoomAt5) => {
    creep_distantSupplier.run(creep);
    return;
});

register(['ranger', 'ranger2', 'PowerGuard', 'rangerNearDeath'], (creep, isRoomAt5) => {
    creep_ranger.run(creep);
    return;
});

register(['farScout'], (creep, isRoomAt5) => {
    creep_farScout.run(creep);
    return;
});

register(['highwayPatrol', 'highwayPatrolNearDeath'], (creep, isRoomAt5) => {
    creep_highwayPatrol.run(creep);
    return;
});

register(['harasser', 'harasserNearDeath'], (creep, isRoomAt5) => {
    creep_harasser.run(creep); // thinned by the governor only while no hostiles are around
    return;
});

function fallback(creep, isRoomAt5) {
    if (!creep.memory.priority) {
        creep.memory.priority = 'helper';
        var creepPath = 'E30N43;E29N43'.split(";");
        creep.memory.path = creepPath;
        creep.memory.destination = 'E29N43';
        creep.memory.homeRoom = 'E29N43';
        creep.memory.previousPriority = 'helper';
    }
    // Young rooms run everything through workV2; mature rooms send mule/distributor/mineral
    // miner through work5 (harvester/builder are emergency workers). Throttling is by tier.
    if (!isRoomAt5 || creep.memory.priority == 'harvester' || creep.memory.priority == 'builder') {
        creep_workV2.run(creep, 25);
    } else {
        creep_work5.run(creep);
    }
    return;
}
// ---------------------------------------------------------------- CPU tiers
// essential: always runs. economy: remote income, thinned only when CPU is well over budget.
// optional: useful but deferrable, thinned first. Functions can promote a creep when its work is
// urgent (room under attack, war boosts, controller close to downgrading).
const ESSENTIAL = 'essential', ECONOMY = 'economy', OPTIONAL = 'optional';
const TIERS = Object.create(null);
function tier(names, value) {
    for (const name of names) TIERS[name] = value;
}
const underAttack = creep => Memory.roomsUnderAttack && Memory.roomsUnderAttack.indexOf(creep.memory.homeRoom || creep.room.name) !== -1;
tier(['farMule', 'farMuleNearDeath', 'farClaimer', 'farClaimerNearDeath', 'farMineralMiner',
    'looter', 'helper', 'distantSupplier', 'farScout'], ECONOMY);
// Keeper-room miners carry HEAL and fight keepers: skipping their ticks gets them killed.
tier(['farMiner', 'farMinerNearDeath'], creep => creep.memory.jobSpecific === 'SKMiner' || creep.getActiveBodyparts(HEAL) > 0 ? ESSENTIAL : ECONOMY);
tier(['repair', 'repairNearDeath'], creep => underAttack(creep) ? ESSENTIAL : OPTIONAL);
tier(['labWorker', 'labWorkerNearDeath'], creep => {
    const home = creep.memory.homeRoom || creep.room.name;
    return Game.flags[home + 'WarBoosts'] || Game.flags[home + 'RunningAssault'] ? ESSENTIAL : OPTIONAL;
});
tier(['upSupplier', 'upSupplierNearDeath'], creep => {
    const controller = creep.room.controller;
    return controller && controller.my && controller.ticksToDowngrade < 20000 ? ESSENTIAL : OPTIONAL;
});
tier(['scraper', 'scraperNearDeath', 'salvager', 'salvagerNearDeath', 'highwayPatrol', 'highwayPatrolNearDeath'], OPTIONAL);
// Raiders are optional while travelling or waiting, but never thinned mid-fight.
tier(['harasser', 'harasserNearDeath'], creep => creep.room.find(FIND_HOSTILE_CREEPS).length ? ESSENTIAL : OPTIONAL);
tier(['mineralMiner', 'mineralMinerNearDeath'], ECONOMY);
// Everything else (miners, upgraders, mules, distributors, suppliers, defenders, guards, claimers,
// assault/power/ranger roles, young-room workers) is essential.

function tierOf(creep) {
    const value = TIERS[creep.memory.priority];
    if (!value) return ESSENTIAL;
    return typeof value === 'function' ? value(creep) : value;
}

module.exports = { roles, fallback, tierOf };
