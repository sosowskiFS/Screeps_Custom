const speech = require('creep.speech');
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
register(['farMule', 'farMuleNearDeath'], (creep, isRoomAt5, remoteThrottleActive) => {
    var doExcessWork = true;
    if (Game.cpu.bucket < 500) {
        doExcessWork = false;
    }
    creep_farMule.run(creep, doExcessWork);
    return;
});

register(['farMiner', 'farMinerNearDeath'], (creep, isRoomAt5, remoteThrottleActive) => {
    if (remoteThrottleActive) { return; }
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

register(['farClaimer', 'farGuard', 'SKAttackGuard', 'SKHealGuard', 'farClaimerNearDeath', 'farGuardNearDeath', 'SKAttackGuardNearDeath', 'SKHealGuardNearDeath', 'farMineralMiner'], (creep, isRoomAt5, remoteThrottleActive) => {
    if (remoteThrottleActive) { return; }
    var doExcessWork = true;
    if (Game.cpu.bucket < 500) {
        doExcessWork = false;
    }
    creep_farMining.run(creep, doExcessWork);
    return;
});

register(['miner', 'minerNearDeath'], (creep, isRoomAt5, remoteThrottleActive) => {
    if (isRoomAt5) {
        creep_miner.run(creep);
    } else {
        creep_workV2.run(creep, 25);
    }
    return;
});

register(['upgrader', 'upgraderNearDeath'], (creep, isRoomAt5, remoteThrottleActive) => {
    if (isRoomAt5) {
        creep_upgrader.run(creep);
    } else {
        creep_workV2.run(creep, 25);
    }
    return;
});

register(['repair', 'repairNearDeath'], (creep, isRoomAt5, remoteThrottleActive) => {
    if (remoteThrottleActive) { return; }
    if (isRoomAt5) {
        creep_repair.run(creep);
    } else {
        creep_workV2.run(creep, 25);
    }
    return;
});

register(['scraper', 'scraperNearDeath'], (creep, isRoomAt5, remoteThrottleActive) => {
    if (remoteThrottleActive) { return; }
    creep_scraper.run(creep);
    return;
});

register(['salvager', 'salvagerNearDeath'], (creep, isRoomAt5, remoteThrottleActive) => {
    if (remoteThrottleActive) { return; }
    creep_salvager.run(creep);
    return;
});

register(['supplier', 'supplierNearDeath'], (creep, isRoomAt5, remoteThrottleActive) => {
    creep_supplier.run(creep);
    return;
});

register(['upSupplier', 'upSupplierNearDeath'], (creep, isRoomAt5, remoteThrottleActive) => {
    if (remoteThrottleActive) { return; }
    creep_upSupplier.run(creep);
    return;
});

register(['labWorker', 'labWorkerNearDeath'], (creep, isRoomAt5, remoteThrottleActive) => {
    if (remoteThrottleActive) { return; }
    creep_labWorker.run(creep);
    return;
});

register(['claimer'], (creep, isRoomAt5, remoteThrottleActive) => {
    creep_claimer.run(creep);
    return;
});

register(['looter'], (creep, isRoomAt5, remoteThrottleActive) => {
    creep_looter.run(creep);
    return;
});

register(['vandal'], (creep, isRoomAt5, remoteThrottleActive) => {
    creep_vandal.run(creep);
    return;
});

register(['helper'], (creep, isRoomAt5, remoteThrottleActive) => {
    creep_Helper.run(creep);
    return;
});

register(['defender'], (creep, isRoomAt5, remoteThrottleActive) => {
    creep_combat.run(creep);
    return;
});

register(['assattacker', 'assattackerNearDeath'], (creep, isRoomAt5, remoteThrottleActive) => {
    creep_assattacker.run(creep);
    return;
});

register(['assranger', 'assrangerNearDeath'], (creep, isRoomAt5, remoteThrottleActive) => {
    creep_assranger.run(creep);
    return;
});

register(['asshealer', 'asshealerNearDeath', 'targetlessHealer'], (creep, isRoomAt5, remoteThrottleActive) => {
    creep_asshealer.run(creep);
    return;
});

register(['powerAttack', 'powerAttackNearDeath'], (creep, isRoomAt5, remoteThrottleActive) => {
    creep_powerAttack.run(creep);
    return;
});

register(['powerHeal', 'powerHealNearDeath'], (creep, isRoomAt5, remoteThrottleActive) => {
    creep_powerHeal.run(creep);
    return;
});

register(['powerCollector'], (creep, isRoomAt5, remoteThrottleActive) => {
    creep_powerPickup.run(creep);
    return;
});

register(['distantSupplier'], (creep, isRoomAt5, remoteThrottleActive) => {
    creep_distantSupplier.run(creep);
    return;
});

register(['ranger', 'ranger2', 'PowerGuard', 'rangerNearDeath'], (creep, isRoomAt5, remoteThrottleActive) => {
    creep_ranger.run(creep);
    return;
});

register(['farScout'], (creep, isRoomAt5, remoteThrottleActive) => {
    creep_farScout.run(creep);
    return;
});

register(['highwayPatrol', 'highwayPatrolNearDeath'], (creep, isRoomAt5, remoteThrottleActive) => {
    creep_highwayPatrol.run(creep);
    return;
});

register(['harasser', 'harasserNearDeath'], (creep, isRoomAt5, remoteThrottleActive) => {
    if (Game.cpu.bucket >= 750) {
        creep_harasser.run(creep);
    } else {
        speech.say(creep, "\u2716\uFE0F", false);
    }
    return;
});

function fallback(creep, isRoomAt5, remoteThrottleActive) {
    if (!creep.memory.priority) {
        creep.memory.priority = 'helper';
        var creepPath = 'E30N43;E29N43'.split(";");
        creep.memory.path = creepPath;
        creep.memory.destination = 'E29N43';
        creep.memory.homeRoom = 'E29N43';
        creep.memory.previousPriority = 'helper';
    }
    if (!isRoomAt5) {
        if (!remoteThrottleActive || Memory.warMode) {
            creep_workV2.run(creep, 25);
        } else {
            speech.say(creep, "\u2716\uFE0F", false);
        }
    } else {
        if (creep.memory.priority == 'harvester' || creep.memory.priority == 'builder') {
            //In case of emergency
            creep_workV2.run(creep, 25);
        } else {
            if ((!remoteThrottleActive || Memory.warMode) || creep.memory.priority == 'upgrader' || creep.memory.priority == 'upgraderNearDeath' || creep.memory.priority == 'miner' || creep.memory.priority == 'minerNearDeath') {
                creep_work5.run(creep);
            } else {
                speech.say(creep, "\u2716\uFE0F", false);
            }
        }
    }
    return;
}
module.exports = { roles, fallback };
