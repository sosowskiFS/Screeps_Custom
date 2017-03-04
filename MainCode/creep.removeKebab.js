var creep_Kebab = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.room.name != creep.memory.destination) {
            creep.moveTo(new RoomPosition(25, 25, creep.memory.destination));
        } else {
            //Move towards wall
            var flagName = creep.room.name + 'eWall';
            var flagCounter = 1;
            while (Game.flags[flagName + flagCounter.toString()]) {
                if (Game.flags[flagName + flagCounter.toString()].pos.lookFor(LOOK_STRUCTURES).length == 0) {
                    //Wall removed, proceed to target
                    if (Game.flags["Removekebab"]) {
                        var sitesOnTile = Game.flags["RemoveKebab"].pos.lookFor(LOOK_STRUCTURES);
                        if (sitesOnTile.length) {
                            if (creep.dismantle(sitesOnTile[0]) == ERR_NOT_IN_RANGE) {
                                creep.moveTo(sitesOnTile[0]);
                            }
                            break;
                        } else {
                            Game.flags["RemoveKebab"].remove();
                            //Assume target is destroyed, vandalize.
                            var signResult = creep.signController(creep.room.controller, 'https://www.youtube.com/watch?v=HgD8-Ree07I');
                            if (signResult == ERR_NOT_IN_RANGE) {
                                creep.moveTo(creep.room.controller);
                            } else if (signResult == OK) {
                                //KEBAB REMOVED
                                creep.suicide();
                            }
                            break;
                        }
                    }
                } else if (creep.pos.isNearTo(Game.flags[flagName + flagCounter.toString()].pos) && Game.flags[flagName + flagCounter.toString()].pos.lookFor(LOOK_STRUCTURES).length > 0) {
                    var thisWall = Game.flags[flagName + flagCounter.toString()].pos.lookFor(LOOK_STRUCTURES);
                    if (thisWall[0]) {
                        creep.dismantle(thisWall[0]);
                        break;
                    }
                } else if (!creep.pos.isNearTo(Game.flags[flagName + flagCounter.toString()].pos)) {
                    creep.moveTo(Game.flags[flagName + flagCounter.toString()]);
                    break;
                } else {
                    flagCounter++;
                }
            }
        }
    }
};

module.exports = creep_Kebab;