var tower_Operate = {
    run: function(tower, thisRoom, towerNumber) {
        var thisTower = Game.getObjectById(tower);
        var towerRange = 70;

        var UnderAttackPos = Memory.roomsUnderAttack.indexOf(thisRoom.name);
        var salvagerPrepPos = Memory.roomsPrepSalvager.indexOf(thisRoom.name);
        if (salvagerPrepPos >= 0) {
            towerRange = 70;
        }
        if (UnderAttackPos >= 0 && thisTower.energy > 0) {
            var closestHostile = thisTower.pos.findInRange(FIND_HOSTILE_CREEPS, towerRange, {
                filter: (creep) => (creep.getActiveBodyparts(WORK) > 0 || creep.getActiveBodyparts(CARRY) > 0 || creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0 || creep.getActiveBodyparts(HEAL) > 0) || (creep.hits <= 500)
            });
            if (closestHostile.length > 0) {
                //Target healing creeps first
                if (towerNumber == 1) {
                    closestHostile.sort(targetHealer);
                } else {
                    closestHostile.sort(targetOther);
                }             
                thisTower.attack(closestHostile[0]);
            }
        } else if (thisTower.energy > (thisTower.energyCapacity * 0.5)) {
            //Save 50% of the tower's energy to use on repelling attackers
            var closestDamagedCreep = thisTower.pos.findClosestByRange(FIND_MY_CREEPS, {
                filter: (creep) => creep.hits < creep.hitsMax - 150
            });
            if (closestDamagedCreep) {
                thisTower.heal(closestDamagedCreep);
            }
        }
        //Enable to see tower coverage
        //thisRoom.visual.rect(thisTower.pos.x - 15, thisTower.pos.y - 15, 30, 30, {fill: '#ff0019', opacity: 0.2});
    }
};

module.exports = tower_Operate;

function targetHealer(a, b) {
    if (a.getActiveBodyparts(HEAL) < b.getActiveBodyparts(HEAL))
        return 1;
    if (a.getActiveBodyparts(HEAL) > b.getActiveBodyparts(HEAL))
        return -1;
    return 0;
}

function targetOther(a, b) {
    if (a.getActiveBodyparts(HEAL) < b.getActiveBodyparts(HEAL))
        return -1;
    if (a.getActiveBodyparts(HEAL) > b.getActiveBodyparts(HEAL))
        return 1;
    return 0;
}