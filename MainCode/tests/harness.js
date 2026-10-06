const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readdirSync(root).filter(n => n.endsWith('.js')).map(n => fs.readFileSync(path.join(root, n), 'utf8')).join('\n');
const plain = value => JSON.parse(JSON.stringify(value));
// The game's REACTIONS table (both orders), using the harness's RESOURCE_* names.
function reactions() {
    const R = name => 'RESOURCE_' + name;
    const table = {};
    const add = (a, b, p) => {
        (table[R(a)] = table[R(a)] || {})[R(b)] = R(p);
        (table[R(b)] = table[R(b)] || {})[R(a)] = R(p);
    };
    add('HYDROGEN', 'OXYGEN', 'HYDROXIDE');
    add('ZYNTHIUM', 'KEANIUM', 'ZYNTHIUM_KEANITE');
    add('UTRIUM', 'LEMERGIUM', 'UTRIUM_LEMERGITE');
    add('ZYNTHIUM_KEANITE', 'UTRIUM_LEMERGITE', 'GHODIUM');
    for (const m of ['UTRIUM', 'KEANIUM', 'LEMERGIUM', 'ZYNTHIUM', 'GHODIUM']) {
        add(m, 'HYDROGEN', m + '_HYDRIDE');
        add(m, 'OXYGEN', m + '_OXIDE');
        add(m + '_HYDRIDE', 'HYDROXIDE', m + '_ACID');
        add(m + '_OXIDE', 'HYDROXIDE', m + '_ALKALIDE');
        add(m + '_ACID', 'CATALYST', 'CATALYZED_' + m + '_ACID');
        add(m + '_ALKALIDE', 'CATALYST', 'CATALYZED_' + m + '_ALKALIDE');
    }
    return table;
}
function harness(overrides = {}) {
    const constants = Object.fromEntries([...source.matchAll(/\b(?:FIND|STRUCTURE|RESOURCE|LOOK|ERR|ORDER|TERRAIN_MASK|PWR)_[A-Z_0-9]+\b/g)].map(m => [m[0], m[0]]));
    const matches = filter => typeof filter === 'function' ? filter : value => Object.entries(filter || {}).every(([key, expected]) => value[key] === expected);
    const context = vm.createContext({
        ...constants, console: { log() {} },
        WORK: 'work', CARRY: 'carry', MOVE: 'move', HEAL: 'heal', ATTACK: 'attack', RANGED_ATTACK: 'ranged_attack', CLAIM: 'claim', TOUGH: 'tough',
        TOP: 1, TOP_RIGHT: 2, RIGHT: 3, BOTTOM_RIGHT: 4, BOTTOM: 5, BOTTOM_LEFT: 6, LEFT: 7, TOP_LEFT: 8,
        REACTIONS: reactions(), LAB_REACTION_AMOUNT: 5,
        OK: 0, MAX_CONSTRUCTION_SITES: 100, EXTRACTOR_COOLDOWN: 5, CONTAINER_CAPACITY: 2000, TERRAIN_MASK_WALL: 1, CPU_UNLOCK: 'cpuUnlock', PIXEL: 'pixel', POWER_CLASS: { OPERATOR: 'operator' },
        Creep: class {}, PowerCreep: class {}, Room: class {},
        StructureRampart: class {}, StructureRoad: class {}, StructureContainer: class {},
        _: {
            filter: (values, filter) => Object.values(values || {}).filter(matches(filter)),
            find: (values, filter) => Object.values(values || {}).find(matches(filter)),
            findKey: (values, filter) => Object.keys(values || {}).find(k => matches(filter)(values[k])),
            keys: Object.keys, size: o => Object.keys(o || {}).length,
            sum: o => Object.values(o || {}).reduce((a, b) => a + b, 0), isArray: Array.isArray,
        },
        Memory: { settings: { visuals: false } },
        Game: {
            time: 1, rooms: {}, creeps: {}, spawns: {}, structures: {}, flags: {}, powerCreeps: {}, constructionSites: {}, resources: {},
            shard: { name: 'shard0' }, cpu: { bucket: 8000, limit: 20, getUsed: () => 1 },
            market: { orders: {}, getAllOrders: () => [] }, getObjectById: () => null, map: {},
        },
    });
    context.global = context;
    const modules = {};
    function load(id) {
        if (Object.hasOwn(overrides, id)) return overrides[id];
        if (modules[id]) return modules[id].exports;
        const module = modules[id] = { exports: {} };
        const code = fs.readFileSync(path.join(root, id + '.js'), 'utf8');
        const run = vm.runInContext('(function(require,module,exports) {\n' + code + '\n})', context, { filename: id + '.js' });
        run(load, module, module.exports);
        return module.exports;
    }
    return { context, load, plain };
}
module.exports = { harness, plain, root };
