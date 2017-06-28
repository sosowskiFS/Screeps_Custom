var tower_Operate = {
    run: function(tower, attackDuration) {
        var thisRoom = tower.room;

        if (!Memory.towerNeedEnergy[thisRoom.name]) {
            Memory.towerNeedEnergy[thisRoom.name] = [];
        }
        if (!Memory.towerPickedTarget[thisRoom.name] || Game.time % 5 == 0) {
            //Recalc target every 5 ticks
            Memory.towerPickedTarget[thisRoom.name] = '';
        }

        var UnderAttackPos = Memory.roomsUnderAttack.indexOf(thisRoom.name);
        if (UnderAttackPos >= 0 && tower.energy > 0) {
            var closestHostile = Game.getObjectById(Memory.towerPickedTarget[thisRoom.name]);
            if (!closestHostile) {
                closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
                    filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
                });
            }
            if (closestHostile) {
                Memory.towerPickedTarget[thisRoom.name] = closestHostile.id;
                tower.attack(closestHostile)
                //Keep target for defenders to lock on
                /*var randomTarget = tower.room.find(FIND_HOSTILE_CREEPS);
                if (randomTarget.length) {
                    tower.attack(randomTarget[Math.floor(Math.random() * randomTarget.length)])
                }*/
            } else if (tower.energy > (tower.energyCapacity * 0.5)) {
                //Save 50% of the tower's energy to use on repelling attackers
                var closestDamagedCreep = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
                    filter: (creep) => creep.hits < creep.hitsMax - 50
                });
                if (closestDamagedCreep) {
                    tower.heal(closestDamagedCreep);
                }
            }
        } else if ((tower.energy > (tower.energyCapacity * 0.5)) && (Game.time % 10 == 0)) {
            //Save 50% of the tower's energy to use on repelling attackers
            var closestDamagedCreep = tower.pos.findClosestByRange(FIND_CREEPS, {
                filter: (creep) => (creep.hits < creep.hitsMax - 150) && (Memory.whiteList.includes(creep.owner.username) || creep.owner.username == "Montblanc")
            });
            if (closestDamagedCreep) {
                tower.heal(closestDamagedCreep);
            }
        }

        if (tower.energy <= tower.energyCapacity - 150 && Memory.towerNeedEnergy[thisRoom.name].indexOf(tower.id) == -1) {
            Memory.towerNeedEnergy[thisRoom.name].push(tower.id);
        } else if (tower.energy > tower.energyCapacity - 150 && Memory.towerNeedEnergy[thisRoom.name].indexOf(tower.id) > -1) {
            var thisTowerIndex = Memory.towerNeedEnergy[thisRoom.name].indexOf(tower.id)
            Memory.towerNeedEnergy[thisRoom.name].splice(thisTowerIndex, 1);
        }
        //Enable to see tower coverage
        //thisRoom.visual.rect(thisTower.pos.x - 15, thisTower.pos.y - 15, 30, 30, {fill: '#ff0019', opacity: 0.2});
        //wew
    }
};

module.exports = tower_Operate;
