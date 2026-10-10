// combat.bodies — part order and the guard bodies.
//
// Damage hits a creep's parts front to back, and a part at 0 hits stops working. So the order
// decides what a fighter loses first:
//   TOUGH      first: cheap hit points (and with XGHO2, 70% of the damage they take is ignored)
//   ATTACK, RANGED_ATTACK, WORK, CARRY, CLAIM
//              next: losing some firepower is the price of keeping the rest
//   MOVE       late: a fighter that loses MOVE cannot keep its range, chase, or get away; a kiter
//              with MOVE in front is caught (the harassers in W0N20 put ranged parts in front of
//              theirs, and our room guards, MOVE first, fell behind as soon as they took hits)
//   HEAL       last: as long as one HEAL part works, the creep can bring the rest back
const ORDER = () => [TOUGH, ATTACK, RANGED_ATTACK, WORK, CARRY, CLAIM, MOVE, HEAL];

function order(body) {
    const rank = ORDER();
    return body.slice().sort((a, b) => rank.indexOf(a) - rank.indexOf(b));
}

// The game's part costs (BODYPART_COST), with the standard values where it is not defined.
const STANDARD = { move: 50, work: 100, carry: 50, attack: 80, ranged_attack: 150, heal: 250, claim: 600, tough: 10 };
const COST = () => (typeof BODYPART_COST !== 'undefined' && BODYPART_COST) || STANDARD;
function cost(body) {
    return body.reduce((n, p) => n + (COST()[p] !== undefined ? COST()[p] : STANDARD[p]), 0);
}

// Room guard (creep.roomGuard: sponsor-sent rangers, temporary guards): a kiter that keeps up with
// what it fights off-road. As many MOVE as other parts (full speed on plains, unboosted), most of
// the rest RANGED_ATTACK with about a quarter HEAL; no ATTACK (melee and heal share an action, so
// a swing cancels that tick's heal).
//   5600+  (RCL7+)  19 RANGED_ATTACK, 25 MOVE, 6 HEAL: 190 damage, 72 heal per tick, 50 parts
//   2300+           10 RANGED_ATTACK, 11 MOVE, 1 HEAL
//   1760+           TOUGH, 7 RANGED_ATTACK, 9 MOVE, HEAL
//   less            RANGED_ATTACK/MOVE pairs
function roomGuard(energyCapacity) {
    const e = Number(energyCapacity) || 0;
    if (e >= 5600) return order([].concat(Array(19).fill(RANGED_ATTACK), Array(25).fill(MOVE), Array(6).fill(HEAL)));
    if (e >= 2300) return order([].concat(Array(10).fill(RANGED_ATTACK), Array(11).fill(MOVE), [HEAL]));
    if (e >= 1760) return order([].concat([TOUGH], Array(7).fill(RANGED_ATTACK), Array(9).fill(MOVE), [HEAL]));
    const pairs = Math.max(1, Math.min(10, Math.floor(e / 200)));
    return order([].concat(Array(pairs).fill(RANGED_ATTACK), Array(pairs).fill(MOVE)));
}

// Guard quad member (system.guardSquads), always fully boosted (XGHO2, XZHO2, XKHO2, XLHO2):
// all four alike, n TOUGH, n MOVE and 3n of RANGED_ATTACK and HEAL (about 4:1), n up to 10.
// Boosted MOVE carries 4 parts each at full speed on plains, so one MOVE per four parts is enough.
// Every member heals: any of them can be focused and the other three (adjacent in the 2x2) heal it;
// heal and rangedAttack run in the same tick. A dedicated healer used to be the one member whose
// loss broke the quad. At n = 10 (5,900 energy): 22 RANGED_ATTACK and 8 HEAL each, for the quad
// 3,520 ranged damage and 1,536 heal on one member per tick (boosted), about what three rangers and
// one healer gave (3,600 / 1,440), with no single point of failure.
function quadMember(energyCapacity) {
    for (let n = 10; n >= 1; n--) {
        const heal = Math.round(0.8 * n), ranged = 3 * n - heal;
        const body = [].concat(Array(n).fill(TOUGH), Array(ranged).fill(RANGED_ATTACK), Array(n).fill(MOVE), Array(heal).fill(HEAL));
        if (cost(body) <= energyCapacity) return order(body);
    }
    return [];
}

// Room defender (spawn.BuildCreeps, young rooms without ramparts): it has to reach what attacks,
// so RANGED_ATTACK/MOVE pairs (full speed off-road), and one HEAL from 800 energy.
function youngDefender(energy) {
    const e = Number(energy) || 0;
    const heal = e >= 800 ? 1 : 0;
    const pairs = Math.max(1, Math.min(20, Math.floor((e - heal * 300) / 200)));
    return order([].concat(Array(pairs).fill(RANGED_ATTACK), Array(pairs + heal).fill(MOVE), Array(heal).fill(HEAL)));
}

module.exports = { order, cost, roomGuard, quadMember, youngDefender };
