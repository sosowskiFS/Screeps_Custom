// creep.recall — bring a creep home and recycle it (a cancelled mission: shardX switched off, or
// the room it was sent to defend has been lost).
//   - a creep on another shard than the one it came from cannot get back: it is retired there;
//   - otherwise it walks to its home room; a boosted creep first stops at a lab with no cooldown to
//     unboost (half the compounds drop beside the lab for the salvager), then it recycles at the
//     nearest spawn (part of its spawn energy back). No home or spawn left: retired.
function recall(creep) {
    if (creep.memory.hs && creep.memory.hs !== Game.shard.name) {
        creep.suicide();
        return;
    }
    const home = Game.rooms[creep.memory.homeRoom];
    if (!home || !home.controller || !home.controller.my) {
        creep.suicide();
        return;
    }
    if (creep.room.name !== home.name) {
        creep.travelTo(new RoomPosition(25, 25, home.name), { range: 20 });
        return;
    }
    if (!creep.memory.unboosted && creep.body.some(p => p.boost)) {
        const labs = home.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LAB && !s.cooldown });
        const lab = labs.length ? creep.pos.findClosestByRange(labs) : null;
        if (lab) {
            const result = lab.unboostCreep(creep);
            if (result === ERR_NOT_IN_RANGE) creep.travelTo(lab, { range: 1 });
            else creep.memory.unboosted = 1;   // done, or not possible: recycle anyway
            return;
        }
    }
    const spawn = creep.pos.findClosestByRange(home.find(FIND_MY_SPAWNS));
    if (!spawn) {
        creep.suicide();
        return;
    }
    if (spawn.recycleCreep(creep) === ERR_NOT_IN_RANGE) creep.travelTo(spawn, { range: 1 });
}

module.exports = { recall };
