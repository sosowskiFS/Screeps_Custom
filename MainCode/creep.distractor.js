var creep_distractor = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.room.name != creep.memory.destination) {
            creep.moveTo(new RoomPosition(25, 25, creep.memory.destination));
        } else if (Game.flags[creep.memory.targetFlag]) {
            creep.moveTo(Game.flags[creep.memory.targetFlag]);
            var closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
                filter: (eCreep) => (eCreep.getActiveBodyparts(ATTACK) == 0 && !Memory.whiteList.includes(eCreep.owner.username))
            });
            if (closeFoe) {
                creep.attack(closeFoe);
            }
        }
        evadeAttacker(creep);
    }
};

function evadeAttacker(creep) {
    var Foe = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 7, {
        filter: (eCreep) => ((eCreep.getActiveBodyparts(ATTACK) > 0 || eCreep.getActiveBodyparts(RANGED_ATTACK) > 0) && !Memory.whiteList.includes(eCreep.owner.username))
    });

    if (Foe.length) {
        var closeFoe = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
            filter: (eCreep) => ((eCreep.getActiveBodyparts(ATTACK) > 0 || eCreep.getActiveBodyparts(RANGED_ATTACK) > 0) && !Memory.whiteList.includes(eCreep.owner.username))
        });
        var foeDirection = creep.pos.getDirectionTo(closeFoe);
        var y = 0;
        var x = 0;
        switch (foeDirection) {
            case TOP:
                y = -2;
                break;
            case TOP_RIGHT:
                y = -2;
                x = -2;
                break;
            case RIGHT:
                x = -2;
                break;
            case BOTTOM_RIGHT:
                y = 2;
                x = -2;
                break;
            case BOTTOM:
                y = 2;
                break;
            case BOTTOM_LEFT:
                y = 2;
                x = 2;
                break;
            case LEFT:
                x = 2;
                break;
            case TOP_LEFT:
                y = -2;
                x = 2
                break;
        }
        x = creep.pos.x + x;
        y = creep.pos.y + y;
        if (x < 0) {
            x = 0;
            if (y < 25 && y > 0) {
                y = y - 1;
            } else if (y < 49) {
                y = y + 1;
            }
        } else if (x > 49) {
            x = 49;
            if (y < 25 && y > 0) {
                y = y - 1;
            } else if (y < 49) {
                y = y + 1;
            }
        }
        if (y < 0) {
            y = 0;
            if (x < 25 && x > 0) {
                x = x - 1;
            } else if (x < 49) {
                x = x + 1;
            }
        } else if (y > 49) {
            y = 49;
            if (x < 25 && x > 0) {
                x = x - 1;
            } else if (x < 49) {
                x = x + 1;
            }
        }

        creep.moveTo(x, y);
    }
}

module.exports = creep_distractor;