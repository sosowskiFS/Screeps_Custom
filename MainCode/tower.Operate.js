var tower_Operate = {
    run: function(tower, thisRoom, repairRange) {
        var thisTower = Game.getObjectById(tower);

        var UnderAttackPos = Memory.roomsUnderAttack.indexOf(thisRoom.name);
        if (UnderAttackPos >= 0 && thisTower.energy > 0) {
            var closestHostile = thisTower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if (closestHostile){
                thisTower.attack(closestHostile);
            }
        } else if (thisTower.energy > (thisTower.energyCapacity * 0.5)) {
            //Save 50% of the tower's energy to use on repelling attackers
            //Only maintain roads
            var closestDamagedStructure = thisTower.pos.findInRange(FIND_STRUCTURES, repairRange, {
                filter: (structure) => (structure.structureType == STRUCTURE_RAMPART) && (structure.hitsMax - structure.hits >= 200 && structure.hits <= 25000)
            });
            if (closestDamagedStructure.length > 0) {
                //Sort so lowest hitpoints is on top
                closestDamagedStructure.sort(towerDamageCompare);
                thisTower.repair(closestDamagedStructure[0]);
            } else {
                //Renable this later if it becomes needed
                var closestDamagedCreep = thisTower.pos.findClosestByRange(FIND_MY_CREEPS, {
                    filter: (creep) => creep.hits < creep.hitsMax
                });
                if (closestDamagedCreep) {
                    thisTower.heal(closestDamagedCreep);
                }
            }
        }

    }
};

module.exports = tower_Operate;

function towerDamageCompare(a, b) {
    if (a.hits < b.hits)
        return -1;
    if (a.hits > b.hits)
        return 1;
    return 0;
}