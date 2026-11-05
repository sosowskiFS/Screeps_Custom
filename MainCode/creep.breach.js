// creep.breach — break a way through to a target closed off by walls or someone else's ramparts.
//
// The decoy claimers (creep.xBait) and the remote reservers (creep.farMining) found controllers
// walled in: our own old walls left round a lost decoy's controller (the attacker leaves them up
// so the room cannot be retaken), or barriers round a remote's controller. They walked at it for
// good. breach() plans a path to the target in which walls and other players' ramparts can be
// crossed at a cost (the weakest cheapest) and every other obstacle cannot; the first barrier on
// that path is broken: dismantled with WORK, else attacked with ATTACK.
// Checked at most every CHECK_EVERY ticks per creep (one in-room path search); the barrier found is
// kept until it is gone.
const runtimeCache = require('runtime.cache');

const CHECK_EVERY = 10;
const PASSABLE = () => new Set([STRUCTURE_ROAD, STRUCTURE_CONTAINER]);

function barrier(s) {
    return s.structureType === STRUCTURE_WALL || (s.structureType === STRUCTURE_RAMPART && !s.my && !s.isPublic);
}

// The first barrier on the way to target (range), or null when the way is open.
function findBarrier(creep, target, range) {
    const room = creep.room;
    const pos = target.pos || target;
    const barriers = {};
    const res = PathFinder.search(creep.pos, { pos, range }, {
        maxRooms: 1, plainCost: 2, swampCost: 10, maxOps: 4000,
        roomCallback: name => {
            if (name !== room.name) return false;
            const m = new PathFinder.CostMatrix();
            const passable = PASSABLE();
            for (const s of runtimeCache.find(room, FIND_STRUCTURES)) {
                const t = s.pos.x * 50 + s.pos.y;
                if (barrier(s)) {
                    // Weaker barriers cheaper, on a log scale: 300 hits ~50, 2k ~66, 1M ~150, 300M ~199.
                    const cost = Math.min(250, 30 + Math.round(Math.log10((s.hits || 0) + 1) * 20));
                    if (m.get(s.pos.x, s.pos.y) < 255) m.set(s.pos.x, s.pos.y, Math.max(m.get(s.pos.x, s.pos.y), cost));
                    barriers[t] = s;
                } else if (!passable.has(s.structureType) && !(s.structureType === STRUCTURE_RAMPART && (s.my || s.isPublic))) {
                    m.set(s.pos.x, s.pos.y, 255);
                }
            }
            return m;
        },
    });
    if (res.incomplete) return null;
    for (const step of res.path) {
        const b = barriers[step.x * 50 + step.y];
        if (b) return b;
    }
    return null;
}

// True while the creep is busy breaching (walking to or breaking a barrier); false when the way
// to target is open and the caller should carry on.
function breach(creep, target, range = 1) {
    if (!target) return false;
    const m = creep.memory;
    let wall = m.breachId && Game.getObjectById(m.breachId);
    if (!wall) {
        delete m.breachId;
        if (creep.pos.inRangeTo(target.pos || target, range)) return false;
        if (Game.time - (m.breachAt || 0) < CHECK_EVERY) return false;
        m.breachAt = Game.time;
        wall = findBarrier(creep, target, range);
        if (!wall) return false;
        m.breachId = wall.id;
    }
    if (!creep.pos.isNearTo(wall)) {
        creep.travelTo(wall, { range: 1, maxRooms: 1 });
        return true;
    }
    if (creep.getActiveBodyparts(WORK)) creep.dismantle(wall);
    else if (creep.getActiveBodyparts(ATTACK)) creep.attack(wall);
    else return false;   // nothing to break it with
    return true;
}

module.exports = { breach, findBarrier, barrier, CHECK_EVERY };
