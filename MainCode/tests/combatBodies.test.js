const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, plain } = require('./harness');

function load() {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    g.BODYPART_COST = { move: 50, work: 100, carry: 50, attack: 80, ranged_attack: 150, heal: 250, claim: 600, tough: 10 };
    return { g, b: h.load('combat.bodies') };
}
const runs = body => body.filter((p, i) => p !== body[i - 1]);
const count = (body, t) => body.filter(p => p === t).length;

test('fighters lose TOUGH first, then weapons, MOVE late and HEAL last', () => {
    const { g, b } = load();
    const body = plain(b.order([g.HEAL, g.MOVE, g.RANGED_ATTACK, g.TOUGH, g.ATTACK, g.MOVE]));
    assert.deepEqual(body, [g.TOUGH, g.ATTACK, g.RANGED_ATTACK, g.MOVE, g.MOVE, g.HEAL]);
});

test('room guards: full-speed kiters, ranged in front of MOVE, HEAL last, no ATTACK, within budget', () => {
    const { g, b } = load();
    for (const e of [400, 1000, 1760, 1800, 2300, 5600, 12900]) {
        const body = plain(b.roomGuard(e));
        assert.ok(b.cost(body) <= e, e + ': ' + b.cost(body));
        assert.equal(count(body, g.ATTACK), 0, String(e));
        assert.ok(count(body, g.MOVE) >= body.length - count(body, g.MOVE) - count(body, g.TOUGH), e + ': full speed on plains');
        const r = runs(body);
        assert.ok(r.indexOf(g.MOVE) > r.indexOf(g.RANGED_ATTACK), e + ': MOVE behind the ranged parts');
        if (r.includes(g.HEAL)) assert.equal(r[r.length - 1], g.HEAL);
    }
    const big = plain(b.roomGuard(5600));
    assert.deepEqual([count(big, g.RANGED_ATTACK), count(big, g.MOVE), count(big, g.HEAL)], [19, 25, 6], 'RCL7 and RCL8: 50 parts, 5600');
});

test('young defenders: ranged/MOVE pairs at full speed, a HEAL from 800', () => {
    const { g, b } = load();
    for (const e of [300, 550, 800, 1300]) {
        const body = plain(b.youngDefender(e));
        assert.ok(b.cost(body) <= e, String(e));
        assert.ok(count(body, g.MOVE) >= count(body, g.RANGED_ATTACK) + count(body, g.HEAL), String(e));
        assert.equal(count(body, g.HEAL), e >= 800 ? 1 : 0, String(e));
    }
});
