// system.energyFlow — what each room earns and spends, and what it can afford.
//
// Spawning used fixed storage breakpoints (more upgraders at 50k, repairers at 100k...). Those know
// nothing of what a room earns: shardX W1N9's fortified ring kept up to three repairers from a
// two-source room until its storage was empty, and then (under 50k) none, and the ring rotted.
// Instead the energy moved is counted where it happens, per home room (heap tallies, written to
// Memory once per sample), and rolling averages (half-life HALF_LIFE ticks) kept every SAMPLE_EVERY:
//   in   harvested from sources by its creeps (remote mining included), at the harvest
//   up / bu / re   spent upgrading, building, repairing (its creeps; its towers' repairs), at the action
//   sp   spent spawning (every successful spawnCreep of its spawns)
//   bank storage + terminal energy, and nb its change per tick
// The amounts come from the action itself: harvest 2 per WORK (boosts included) capped by what the
// source holds; build 5 per WORK capped by the energy carried and the progress left; upgrade 1 per
// WORK (15 at RCL8); repair 1 per WORK capped by the hits missing; a tower repair 10. Counting every
// action this way replaced reading every visible room's event log every 10 ticks (spiky, a few CPU
// a sample on shard2). Deposits are not counted: the same energy is moved two or three times
// (container, storage, extensions); what is harvested but never used shows as "unaccounted".
// budget(room): energy per tick the room can put into optional work (upgrading, repairing, more
// workers): income less spawning, plus a slow draw on what is stored above RESERVE (bank above the
// reserve over DRAW_TICKS; below it the draw is negative, a cut). null until MIN_SAMPLES samples.
// staffing() turns it into creep counts for the spawners (spawn.BuildCreeps, spawn.BuildCreeps5).
//
// Memory.energyFlow = { room: { n, in, up, bu, re, sp, nb, bank, t }, _cpu: { sample, wrap, calls } }
const SAMPLE_EVERY = 10;
const HALF_LIFE = 2000;
const ALPHA = 1 - Math.pow(0.5, SAMPLE_EVERY / HALF_LIFE);
const MIN_SAMPLES = 30;                 // 300 ticks before the budget is trusted
const DRAW_TICKS = 10000;               // stored energy above the reserve is spent over this long
const RECOVER_TICKS = 3000;             // and stored energy below it is rebuilt over this long
const REPAIR_MAX = 3;
const REPAIR_MAX_RCL8 = 2;              // shard2 is short of CPU: a surplus never raises more than this
const LOSS_SHARE = 0.2;                 // more than this share of income unaccounted: a hauler short
const DUTY = 0.8;                       // share of its life a working creep spends working
const RESERVE = level => (level >= 8 ? 250000 : level >= 6 ? 50000 : level >= 4 ? 20000 : 0);
const MEASURE_EVERY = 100;              // the wrappers time themselves on one tick in this many
const KEYS = ['in', 'up', 'bu', 're', 'sp'];

// Heap: energy moved since the last sample, per home room.
let tally = Object.create(null);
function count(room, key, amount) {
    if (!room || !(amount > 0)) return;
    const t = tally[room] || (tally[room] = { in: 0, up: 0, bu: 0, re: 0, sp: 0 });
    t[key] += amount;
}
// Wrapper overhead on measuring ticks (CPU, calls).
let measured = { tick: -1, cpu: 0, calls: 0 };

// Effective WORK for an action (boosted parts count their multiplier), and plain WORK count.
function workPower(creep, action) {
    let power = 0, parts = 0;
    for (const p of creep.body || []) {
        if (p.type !== WORK || p.hits <= 0) continue;
        parts++;
        const b = p.boost && typeof BOOSTS !== 'undefined' && BOOSTS[WORK] && BOOSTS[WORK][p.boost];
        power += b && b[action] ? b[action] : 1;
    }
    return { power, parts };
}
function carried(creep) {
    return (creep.store && creep.store[RESOURCE_ENERGY]) || 0;
}
function homeOf(creep) {
    return (creep.memory && creep.memory.homeRoom) || (creep.room && creep.room.name);
}
// Energy each action moves (on success).
const AMOUNT = {
    harvest: (creep, target) => {
        if (!target || target.energy === undefined || target.mineralType || target.depositType) return 0;   // sources only
        return Math.min(target.energy, workPower(creep, 'harvest').power * HARVEST_POWER);
    },
    build: (creep, site) => {
        const left = site && site.progressTotal !== undefined ? site.progressTotal - site.progress : Infinity;
        return Math.min(carried(creep), workPower(creep, 'build').parts * BUILD_POWER, left);
    },
    repair: (creep, target) => {
        const missing = target && target.hitsMax !== undefined ? Math.ceil((target.hitsMax - target.hits) / REPAIR_POWER) : Infinity;
        return Math.min(carried(creep), workPower(creep, 'repair').parts, missing);
    },
    upgradeController: (creep, controller) => {
        const cap = controller && controller.level === 8 ? CONTROLLER_MAX_UPGRADE_PER_TICK : Infinity;
        return Math.min(carried(creep), workPower(creep, 'upgradeController').parts, cap);
    },
};
const KEY = { harvest: 'in', build: 'bu', repair: 're', upgradeController: 'up' };

function wrap(proto, method, credit) {
    const original = proto[method];
    if (typeof original !== 'function') return;
    proto[method] = function (...args) {
        if (measured.tick !== Game.time && Game.time % MEASURE_EVERY === 0) measured = { tick: Game.time, cpu: 0, calls: 0 };
        const timing = measured.tick === Game.time;
        const t0 = timing ? Game.cpu.getUsed() : 0;
        // Read before the action: carried energy and the target as they are now.
        const amount = credit.amount(this, args[0]);
        const t1 = timing ? Game.cpu.getUsed() : 0;
        const result = original.apply(this, args);
        const t2 = timing ? Game.cpu.getUsed() : 0;
        if (result === OK) count(credit.room(this), credit.key, amount);
        if (timing) {
            measured.cpu += (t1 - t0) + (Game.cpu.getUsed() - t2);
            measured.calls++;
        }
        return result;
    };
}

function install() {
    if (typeof StructureSpawn !== 'undefined' && !StructureSpawn.prototype._energyFlow) {
        const spawnCreep = StructureSpawn.prototype.spawnCreep;
        StructureSpawn.prototype.spawnCreep = function (body, name, opts) {
            const result = spawnCreep.call(this, body, name, opts);
            if (result === OK && !(opts && opts.dryRun)) count(this.room.name, 'sp', body.reduce((n, p) => n + (BODYPART_COST[p] || 0), 0));
            return result;
        };
        StructureSpawn.prototype._energyFlow = true;
    }
    if (typeof Creep !== 'undefined' && !Creep.prototype._energyFlow) {
        for (const method of Object.keys(AMOUNT)) {
            wrap(Creep.prototype, method, { key: KEY[method], amount: AMOUNT[method], room: homeOf });
        }
        Creep.prototype._energyFlow = true;
    }
    if (typeof StructureTower !== 'undefined' && !StructureTower.prototype._energyFlow) {
        wrap(StructureTower.prototype, 'repair', { key: 're', amount: () => TOWER_ENERGY_COST, room: tower => tower.room && tower.room.name });
        StructureTower.prototype._energyFlow = true;
    }
}
install();

function noteSpawn(roomName, cost) {
    count(roomName, 'sp', cost);
}

function state() {
    return Memory.energyFlow || (Memory.energyFlow = {});
}

function ownedHomes() {
    const out = [];
    for (const name in Game.rooms) {
        const room = Game.rooms[name];
        if (room.controller && room.controller.my && room.find(FIND_MY_SPAWNS).length) out.push(room);
    }
    return out;
}

// One sample: the tallies since the last one, per tick, into the rolling averages.
function sample() {
    if (Game.time % SAMPLE_EVERY !== 0) return;
    const start = Game.cpu && Game.cpu.getUsed ? Game.cpu.getUsed() : 0;
    const homes = ownedHomes();
    const names = new Set(homes.map(r => r.name));
    const s = state();
    for (const room of homes) {
        const e = s[room.name] || (s[room.name] = { n: 0, in: 0, up: 0, bu: 0, re: 0, sp: 0, nb: 0 });
        const t = tally[room.name] || {};
        const bank = (room.storage ? room.storage.store[RESOURCE_ENERGY] || 0 : 0) + (room.terminal ? room.terminal.store[RESOURCE_ENERGY] || 0 : 0);
        const now = { nb: e.bank === undefined ? 0 : (bank - e.bank) / SAMPLE_EVERY };
        for (const k of KEYS) now[k] = (t[k] || 0) / SAMPLE_EVERY;
        const a = e.n ? ALPHA : 1;
        for (const k in now) e[k] = e[k] + a * (now[k] - e[k]);
        e.bank = bank;
        e.n++;
        e.t = Game.time;
    }
    for (const name of Object.keys(s)) if (name !== '_cpu' && !names.has(name) && Game.time - (s[name].t || 0) > HALF_LIFE * 5) delete s[name];
    tally = Object.create(null);
    // CPU: this sample, and the wrappers' overhead on their last measured tick.
    const cpu = s._cpu || (s._cpu = { sample: 0, wrap: 0, calls: 0 });
    if (Game.cpu && Game.cpu.getUsed) cpu.sample = cpu.sample + 0.1 * ((Game.cpu.getUsed() - start) - cpu.sample);
    if (measured.tick >= 0 && measured.tick > (cpu.at || -1)) {
        cpu.wrap = cpu.wrap + 0.2 * (measured.cpu - cpu.wrap);
        cpu.calls = measured.calls;
        cpu.at = measured.tick;
    }
}

// Energy per tick the room can put into optional work, or null while it has too little data.
//   With a storage (feedback on what is stored): what optional work costs now (upgrading, building,
//   repairing) plus the change in storage, so every other drain counts too (power processing,
//   terminal shipments and sales, towers, decay), plus a correction toward the reserve: what is
//   stored above it spent over DRAW_TICKS, a shortfall rebuilt over RECOVER_TICKS. A room keeping
//   its storage steady at the reserve has a budget equal to what it spends now.
//   Without one: income less spawning (nothing stored to steer by).
function budget(room) {
    const e = state()[room.name];
    if (!e || e.n < MIN_SAMPLES) return null;
    const level = room.controller ? room.controller.level : 0;
    if (!room.storage) return e.in - e.sp;
    const gap = (e.bank || 0) - RESERVE(level);
    return e.up + e.bu + e.re + e.nb + gap / (gap >= 0 ? DRAW_TICKS : RECOVER_TICKS);
}

// Share of the room's income that nothing counted spent or stored (dropped and decayed, shipped,
// burned in power processing), or null without data.
function losses(room) {
    const e = state()[room.name];
    if (!e || e.n < MIN_SAMPLES || !(e.in > 1)) return null;
    return Math.max(0, e.in - e.up - e.bu - e.re - e.sp - e.nb) / e.in;
}

// Creep counts from the budget. units: energy per tick one creep of each kind spends while working
// ({ upgrade: per 12-WORK upgrader module, repair: per repairer, worker: per worker }); current: the
// counts the spawner had. Returns null without a trusted budget, else
// { budget, upgraderModules, upgraders (0 or undefined: as the spawner decides), repairMax, workers }.
//   - Hardened rooms (system.shardX.hardened): repairers take up to half the budget, at most 3.
//   - Below RCL8: upgraders get what is left (at most 4 modules); none at all when the budget is
//     spent and the controller is not near downgrading.
//   - Repairers otherwise: the spawner's count, if the budget still covers them.
//   - Workers (rooms before links): the whole budget, 1 to 8.
function staffing(room, units, current = {}) {
    const b = budget(room);
    if (b === null) return null;
    const level = room.controller ? room.controller.level : 0;
    const cost = u => Math.max(0.1, u * DUTY);
    let left = Math.max(0, b);
    const out = { budget: b };
    let repair = 0;
    // Below RCL8 the room's one upgrader comes first, whatever the budget (reaching RCL8 matters
    // most): its upgrade module is taken off before anything else is paid for.
    if (level < 8 && units.upgrade) left = Math.max(0, left - cost(units.upgrade));
    if (require('system.shardX').hardened(room) && units.repair) {
        repair = Math.min(3, Math.floor(left * 0.5 / cost(units.repair)));
        left -= repair * cost(units.repair);
    }
    // More upgrade modules on top of that one from what is left (at most 4 extra).
    if (level < 8 && units.upgrade) {
        out.upgraderModules = Math.min(4, Math.floor(left / cost(units.upgrade)));
        left -= out.upgraderModules * cost(units.upgrade);
    }
    // Repairers: what is left, up to REPAIR_MAX, unless the spawner says ramparts are capped
    // (units.repairCapped: 25M/50M flags, 290M). At RCL8 the whole budget (upgrading is upkeep), at
    // most REPAIR_MAX_RCL8 there.
    if (units.repair && !require('system.shardX').hardened(room)) {
        repair = units.repairCapped ? 0 : Math.min(level >= 8 ? REPAIR_MAX_RCL8 : REPAIR_MAX, Math.floor(left / cost(units.repair)));
        // Short of CPU (the governor shedding): the budget may cut repairers, never add any.
        if (require('runtime.cpuGovernor').shedLevel() > 0) repair = Math.min(repair, current.repairMax || 0);
    }
    out.repairMax = repair;
    // Workers: the budget less the dedicated upgrader's share (units.reserved, energy a tick).
    if (units.worker) out.workers = Math.max(1, Math.min(8, Math.floor(Math.max(0, b - (units.reserved || 0)) / cost(units.worker))));
    // Rooms without a storage losing income on the ground: one more distributor (at most 3).
    const lost = losses(room);
    out.extraDistributor = !room.storage && lost !== null && lost > LOSS_SHARE;
    return out;
}

// Console: energyFlow() prints each room's averages and budget.
function report() {
    const lines = ['Energy flow (per tick; rolling averages, half-life ' + HALF_LIFE + ' ticks):'];
    for (const name of Object.keys(state()).filter(n => n !== '_cpu').sort()) {
        const e = state()[name], room = Game.rooms[name];
        const b = room ? budget(room) : null;
        const f = v => (v || 0).toFixed(1);
        lines.push('  ' + name + ': in ' + f(e.in) + ', upgrade ' + f(e.up) + ', build ' + f(e.bu) + ', repair ' + f(e.re) +
            ', spawn ' + f(e.sp) + ', bank ' + (e.bank || 0) + ' (' + (e.nb >= 0 ? '+' : '') + f(e.nb) + ')' +
            ', unaccounted ' + f(e.in - e.up - e.bu - e.re - e.sp - e.nb) + ', reserve ' + (room ? RESERVE(room.controller.level) : '?') +
            ', budget ' + (b === null ? 'warming up (' + e.n + '/' + MIN_SAMPLES + ')' : f(b)));
    }
    const cpu = state()._cpu;
    if (cpu) lines.push('CPU: ' + cpu.sample.toFixed(3) + ' per sample (every ' + SAMPLE_EVERY + ' ticks); counting ' + cpu.wrap.toFixed(3) +
        ' per tick (' + cpu.calls + ' actions on the last measured tick)');
    console.log(lines.join('\n'));
    return Object.keys(state()).filter(n => n !== '_cpu').length + ' rooms';
}

module.exports = { losses, RECOVER_TICKS, sample, budget, staffing, report, noteSpawn, install, count, AMOUNT, SAMPLE_EVERY, MIN_SAMPLES, DUTY, RESERVE, DRAW_TICKS };
