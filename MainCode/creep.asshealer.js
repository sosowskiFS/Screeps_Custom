var creep_asshealer = {

    /** @param {Creep} creep **/
    run: function(creep) {
        var unboostedTough = 0;
        var unboostedHeal = 0;

        creep.body.forEach(function(thisPart) {
            if (thisPart.type == HEAL && !thisPart.boost){
                unboostedHeal = unboostedHeal + 1;
            }

            if (thisPart.type == TOUGH && !thisPart.boost){
                unboostedTough = unboostedTough + 1;
            }
        });

        console.log("unboosted heal : " + unboostedHeal + "| unboosted Tough : " + unboostedTough);

        var targetAttacker = _.filter(Game.creeps, (tCreep) => tCreep.name == creep.memory.attackerName);
        if (targetAttacker.length) {
            if (creep.pos.x == 0 || creep.pos.x == 49 || creep.pos.y == 0 || creep.pos.y == 49) {
                var xTarget = 1;
                var yTarget = 1;
                if (creep.pos.x == 49) {
                    xTarget = 48;
                }
                if (creep.pos.y = 49) {
                    yTarget = 48;
                }
                creep.moveTo(xTarget, yTarget);
            } else {
                creep.moveTo(targetAttacker[0], {
                    ignoreCreeps: true
                });
            }

            if (creep.hits < creep.hitsMax - 99) {
                creep.heal(creep);
            } else if (targetAttacker[0].hits < targetAttacker[0].hitsMax) {
                if (creep.pos.getRangeTo(targetAttacker[0]) > 1) {
                    creep.rangedHeal(targetAttacker[0]);
                } else {
                    creep.heal(targetAttacker[0]);
                }
            } else {
                var hurtAlly = creep.pos.findInRange(FIND_MY_CREEPS, 3, {
                    filter: (thisCreep) => thisCreep.hits < thisCreep.hitsMax
                });
                if (hurtAlly.length > 0) {
                    if (creep.pos.getRangeTo(hurtAlly[0]) > 1) {
                        creep.rangedHeal(hurtAlly[0]);
                    } else {
                        creep.heal(hurtAlly[0]);
                    }
                }
            }
        } else {
            if (Game.flags["RallyHere"]) {
                creep.moveTo(Game.flags["RallyHere"]);
            }
            var newTarget = creep.pos.findInRange(FIND_MY_CREEPS, 2, {
                filter: (mCreep) => (mCreep.memory.priority == "assattacker")
            });
            if (newTarget.length) {
                creep.memory.attackerName == newTarget[0].name;
            }
        }
    }

};

module.exports = creep_asshealer;