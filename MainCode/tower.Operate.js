var tower_Operate = {
    run: function(tower, improveMax, thisRoom) {
        var thisTower = Game.getObjectById(tower);

        var UnderAttackPos = Memory.roomsUnderAttack.indexOf(thisRoom.name);
        if (UnderAttackPos >= 0 && thisTower.energy > 0) {
            var closestHostile = thisTower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if (closestHostile){
                thisTower.attack(closestHostile);
            }
        } else if (thisTower.energy > (thisTower.energyCapacity * 0.5)) {
            //Save 50% of the tower's energy to use on repelling attackers
            var closestDamagedStructure = thisTower.pos.findInRange(FIND_STRUCTURES, 40, {
                filter: (structure) => (structure.hits < structure.hitsMax) && (structure.hits < improveMax) && (structure.hitsMax - structure.hits >= 200)
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