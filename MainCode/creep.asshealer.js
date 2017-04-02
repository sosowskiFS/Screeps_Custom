var creep_asshealer = {

    /** @param {Creep} creep **/
    run: function(creep) {

        creep.heal(creep);

        var targetAttacker = _.filter(Game.creeps, (tCreep) => tCreep.name == creep.memory.attackerName);
        if (targetAttacker.length) {
            if (creep.pos.x == 0 || creep.pos.x == 49 || creep.pos.y == 0 || creep.pos.y == 49) {
                var xTarget = 1;
                var yTarget = 1;
                if (creep.pos.x == 49){
                    xTarget = 48;
                }
                if (creep.pos.y = 49){
                    yTarget = 48;
                }
                creep.moveTo(xTarget, yTarget);
            } else {
                creep.moveTo(targetAttacker[0]);
            }

            if (targetAttacker[0].hits < targetAttacker[0].hitsMax) {
                creep.heal(targetAttacker[0]);
                creep.rangedHeal(targetAttacker[0]);
            } else {
                var hurtAlly = creep.pos.findInRange(FIND_MY_CREEPS, 3, {
                    filter: (thisCreep) => thisCreep.hits < thisCreep.hitsMax
                });
                if (hurtAlly.length > 0) {
                    creep.heal(hurtAlly[0]);
                    creep.rangedHeal(hurtAlly[0]);
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