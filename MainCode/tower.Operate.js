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
            var closestHostile = thisTower.pos.findInRange(FIND_HOSTILE_CREEPS, 50);
            if (closestHostile.length) {
                //Target healing creeps first
                    closestHostile.sort(targetOther);       
                    //closestHostile.sort(targetHealer);
                if (closestHostile.getActiveBodyparts(HEAL) >= 12 && thisTower.pos.getRangeTo(closestHostile) > 15 && closestHostile.hits == closestHostile.hitsMax) {
                    //Creep can outheal max range, do nothing. Will keep firing at creep until it's max HP again
                    if (closestHostile[1]) {
                        thisTower.attack(closestHostile[1]);
                    }
                } else {
                    thisTower.attack(closestHostile[0]);
                }                      
            }
        } else if ((thisTower.energy > (thisTower.energyCapacity * 0.5)) && (Game.time % 10 == 0)) {
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
        //wew
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