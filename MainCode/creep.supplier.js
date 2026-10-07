// Tower supplier: stands on the room's Supply tile (centre of the core) and keeps the towers
// filled from the storage. Without a usable Supply tile (no flag, or base migration has not
// cleared it yet) it does the same job on foot, so towers never go unfed.
const BLOCKED_RECHECK = 50;   // ticks between re-checking a Supply tile that had a structure on it

// Can a creep stand on the Supply tile? (Migration may put the flag on a tile an old structure
// still occupies until it is moved.)
function standable(pos) {
    return !pos.lookFor(LOOK_STRUCTURES).some(s =>
        s.structureType !== STRUCTURE_ROAD && s.structureType !== STRUCTURE_CONTAINER &&
        !(s.structureType === STRUCTURE_RAMPART && s.my));
}

var creep_supplier = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'supplierNearDeath') {
            creep.memory.priority = 'supplierNearDeath';
        }

        // Walk to the Supply tile once, and again whenever the flag moves (base migration).
        const flag = Game.flags[creep.room.name + "Supply"];
        const spot = flag ? flag.pos.x + ',' + flag.pos.y : undefined;
        if (flag && creep.memory.spot !== spot && Game.time >= (creep.memory.spotBlockedUntil || 0)) {
            if (creep.pos.x == flag.pos.x && creep.pos.y == flag.pos.y) {
                creep.memory.spot = spot;
                creep.memory.atSpot = true;
            } else if (standable(flag.pos)) {
                creep.travelTo(flag);
                if (!creep.memory.travelDistance && creep.memory._trav && creep.memory._trav.path) {
                    creep.memory.travelDistance = creep.memory._trav.path.length;
                    creep.memory.deathWarn = (creep.memory.travelDistance + _.size(creep.body) * 3) + 15;
                }
                return;
            } else {
                creep.memory.spotBlockedUntil = Game.time + BLOCKED_RECHECK;
            }
        }

        if (_.sum(creep.carry) == 0) {
            //Get from storage
            var storageTarget = creep.room.storage;
            if (storageTarget) {
                if (creep.withdraw(storageTarget, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.travelTo(storageTarget);
                }
            }
        } else if (Memory.towerNeedEnergy[creep.room.name] && Memory.towerNeedEnergy[creep.room.name].length) {
            var target = Game.getObjectById(Memory.towerNeedEnergy[creep.room.name][0]);
            if (target) {
                if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.travelTo(target);
                }
            } else {
                //Destroyed, remove from list
                Memory.towerNeedEnergy[creep.room.name].splice(0, 1);
            }
        }
    }
};

module.exports = creep_supplier;
