var tower_Operate = {
    run: function(tower, thisRoom) {
        var thisTower = Game.getObjectById(tower);

        var UnderAttackPos = Memory.roomsUnderAttack.indexOf(thisRoom.name);
        if (UnderAttackPos >= 0 && thisTower.energy > 0) {
            var closestHostile = thisTower.pos.findInRange(FIND_HOSTILE_CREEPS, 15, {
                filter: (creep) => (creep.getActiveBodyparts(WORK) > 0 || creep.getActiveBodyparts(CARRY) > 0 || creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0 || creep.getActiveBodyparts(HEAL) > 0) || (creep.hits <= 500)
            });
            if (closestHostile.length > 0) {
                //Target healing creeps first
                closestHostile.sort(towerPartsCompare);
                thisTower.attack(closestHostile[0]);
            }
        } else if (thisTower.energy > (thisTower.energyCapacity * 0.5)) {
            //Save 50% of the tower's energy to use on repelling attackers
            var closestDamagedCreep = thisTower.pos.findClosestByRange(FIND_MY_CREEPS, {
                filter: (creep) => creep.hits < creep.hitsMax
            });
            if (closestDamagedCreep) {
                thisTower.heal(closestDamagedCreep);
            }
        }

        thisRoom.visual.rect(tower.pos.x - 15, tower.pos.y - 15, 30, 30, {fill: '#ff0019', opacity: 0.2});
    }
};

module.exports = tower_Operate;

function towerPartsCompare(a, b) {
    if (a.getActiveBodyparts(HEAL) < b.getActiveBodyparts(HEAL))
        return 1;
    if (a.getActiveBodyparts(HEAL) > b.getActiveBodyparts(HEAL))
        return -1;
    return 0;
}