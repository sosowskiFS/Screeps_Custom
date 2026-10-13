const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./harness');

function setup({ level = 5, storage = true, at5 = true, links = [{ x: 12, y: 10 }] } = {}) {
    const h = harness(), g = h.context;
    h.load('runtime.memory').ensureInitialized();
    const range = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    const pos = (x, y) => ({ x, y, inRangeTo: (o, r) => range({ x, y }, o.pos || o) <= r });
    const destroyed = [];
    const container = (id, x, y) => ({ id, structureType: g.STRUCTURE_CONTAINER, pos: pos(x, y), destroy: () => { destroyed.push(id); return g.OK; } });
    const containers = [container('atSource', 10, 11), container('atLinklessSource', 40, 41), container('atMineral', 30, 31)];
    const room = {
        name: 'R', controller: { my: true, level }, storage: storage ? {} : undefined,
        find: type => (type === g.FIND_SOURCES ? [{ pos: pos(10, 10) }, { pos: pos(40, 40) }] :
            type === g.FIND_MINERALS ? [{ pos: pos(30, 30) }] :
            type === g.FIND_MY_STRUCTURES ? links.map(l => ({ structureType: g.STRUCTURE_LINK, pos: pos(l.x, l.y) })) :
            type === g.FIND_STRUCTURES ? containers : []),
    };
    g.Memory.RoomsAt5 = at5 ? ['R'] : [];
    return { h, g, room, destroyed, rooms: h.load('system.rooms') };
}

test('on link miners (RCL5+, storage, 2+ links), a source\'s old container goes once its link stands; the mineral\'s stays', () => {
    const s = setup();
    assert.equal(s.rooms.clearSourceContainers(s.room), 1);
    assert.equal(s.destroyed.join(), 'atSource', 'the source without a link keeps its container; the mineral\'s is never touched');
});

test('no containers removed before the room runs on link miners (its harvesters still use them)', () => {
    assert.equal(setup({ at5: false }).rooms.clearSourceContainers(setup({ at5: false }).room), 0);
    const low = setup({ level: 4 });
    assert.equal(low.rooms.clearSourceContainers(low.room), 0);
    const noStorage = setup({ storage: false });
    assert.equal(noStorage.rooms.clearSourceContainers(noStorage.room), 0);
});
