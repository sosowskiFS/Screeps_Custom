var creep_asshealer = {

    /** @param {Creep} creep **/
    run: function(creep) {

        var targetAttacker = _.filter(Game.creeps, (tCreep) => tCreep.name == creep.memory.attackerName);
        if (targetAttacker.length) {
            creep.moveTo(targetAttacker[0]);
            creep.heal(targetAttacker[0]);
            creep.rangedHeal(targetAttacker[0]);
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