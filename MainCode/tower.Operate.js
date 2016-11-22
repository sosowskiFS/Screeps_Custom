var tower_Operate = {
    run: function(tower, improveMax, thisRoom) {
        var thisTower = Game.getObjectById(tower);

        var closestHostile = thisTower.pos.findInRange(FIND_HOSTILE_CREEPS, 40);
        if (closestHostile[0]) {
            if (Memory.roomsUnderAttack.indexOf(thisRoom.name) === -1) {
                Memory.roomsUnderAttack.push(thisRoom.name);
            }
            if (thisTower.energy > 0) {
                thisTower.attack(closestHostile[0]);
            }
        } else if (thisTower.energy > (thisTower.energyCapacity * 0.75)) {
            var UnderAttackPos = Memory.roomsUnderAttack.indexOf(thisRoom.name);
            if (UnderAttackPos >= 0) {
                Memory.roomsUnderAttack.splice(UnderAttackPos, 1);
            }
            //Save 75% of the tower's energy to use on repelling attackers
            var closestDamagedStructure = thisTower.pos.findInRange(FIND_STRUCTURES, 20, {
                filter: (structure) => (structure.hits < structure.hitsMax) && (structure.hits < improveMax)
            });
            if (closestDamagedStructure) {
                thisTower.repair(closestDamagedStructure);
            } else {
                //Renable this later if it becomes needed
                /*var closestDamagedCreep = thisTower.pos.findClosestByRange(FIND_MY_CREEPS, {
                    filter: (creep) => creep.hits < creep.hitsMax
                });
                if (closestDamagedCreep) {
                    thisTower.heal(closestDamagedCreep);
                }*/
            }
        } else {
            var UnderAttackPos = Memory.roomsUnderAttack.indexOf(thisRoom.name);
            if (UnderAttackPos >= 0) {
                Memory.roomsUnderAttack.splice(UnderAttackPos, 1);
            }
        }

    }
};

module.exports = tower_Operate;