// runtime.console — debugging commands for the game console.
//
// Defined on `global` when the code loads, so they are always available in the console:
//   mem()                    top-level Memory keys with their size (JSON characters)
//   mem('basePlan.E14N18')   one Memory path (dot separated), printed in full
//   mem('*')                 all of Memory (large: many console lines, noticeable CPU)
//   memCreeps()              creep memory size by field and by role (what to trim)
//   roomReport('E14N18')     everything about one room: live state, why it is or isn't in
//                            maintenance mode, every Memory entry that mentions the room, the
//                            creeps homed there and its flags
// Output is split into console-sized chunks so nothing gets cut off.
const maintenance = require('system.maintenance');
const heapMemory = require('runtime.heapMemory');

const CHUNK = 1000;   // characters per console line

// The console renders HTML: escape so JSON with '<' shows as text.
function escape(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

// Print text in chunks, breaking at line ends where possible.
function print(text) {
    const lines = String(text).split('\n');
    let chunk = '';
    for (const line of lines) {
        if (chunk && chunk.length + line.length + 1 > CHUNK) {
            console.log(escape(chunk));
            chunk = '';
        }
        if (line.length > CHUNK) {
            for (let i = 0; i < line.length; i += CHUNK) console.log(escape(line.slice(i, i + CHUNK)));
            continue;
        }
        chunk += (chunk ? '\n' : '') + line;
    }
    if (chunk) console.log(escape(chunk));
}

function json(value) {
    return JSON.stringify(value, null, 1);
}

function size(value) {
    try {
        return JSON.stringify(value).length;
    } catch (e) {
        return -1;
    }
}

function resolve(path) {
    const keys = path.split('.');
    // Heap-only keys (runtime.heapMemory) are not on Memory between ticks.
    let value = heapMemory.HEAP_KEYS.includes(keys[0]) ? { [keys[0]]: heapMemory.get(keys[0]) } : Memory;
    for (const key of keys) {
        if (value === undefined || value === null) return undefined;
        value = value[key];
    }
    return value;
}

function mem(path) {
    if (!path) {
        const rows = Object.keys(Memory)
            .map(key => [key, size(Memory[key])])
            .concat(heapMemory.HEAP_KEYS.filter(key => !(key in Memory) && heapMemory.get(key) !== undefined)
                .map(key => [key + ' (heap only)', size(heapMemory.get(key))]))
            .sort((a, b) => b[1] - a[1]);
        const total = rows.reduce((sum, row) => sum + Math.max(0, row[1]), 0);
        print('Memory: ' + rows.length + ' keys, ~' + total + ' characters\n' +
            rows.map(([key, n]) => '  ' + key + ': ' + n).join('\n') +
            "\nmem('key.sub') prints one entry, mem('*') prints everything.");
        return rows.length + ' keys';
    }
    const value = path === '*' ? Memory : resolve(path);
    if (value === undefined) return 'Memory.' + path + ' is undefined';
    const text = json(value);
    print('Memory' + (path === '*' ? '' : '.' + path) + ' =\n' + text);
    return text.length + ' characters';
}

function countBy(list, key) {
    const out = {};
    for (const item of list) {
        const k = key(item);
        out[k] = (out[k] || 0) + 1;
    }
    return out;
}

// Live state of a visible room.
function liveState(room) {
    const c = room.controller;
    const state = {};
    if (c) {
        state.controller = { my: c.my, level: c.level, progress: c.progress + '/' + c.progressTotal,
            ticksToDowngrade: c.ticksToDowngrade, safeMode: c.safeMode, safeModeAvailable: c.safeModeAvailable };
    }
    state.energy = room.energyAvailable + '/' + room.energyCapacityAvailable;
    if (room.storage) state.storage = { energy: room.storage.store[RESOURCE_ENERGY], used: room.storage.store.getUsedCapacity(), free: room.storage.store.getFreeCapacity() };
    if (room.terminal) state.terminal = { energy: room.terminal.store[RESOURCE_ENERGY], used: room.terminal.store.getUsedCapacity(), free: room.terminal.store.getFreeCapacity() };
    const mine = room.find(FIND_MY_STRUCTURES);
    state.structures = countBy(mine, s => s.structureType);
    const sites = room.find(FIND_MY_CONSTRUCTION_SITES);
    state.constructionSites = sites.length ? countBy(sites, s => s.structureType) : 0;
    state.spawns = mine.filter(s => s.structureType === STRUCTURE_SPAWN).map(s =>
        s.name + ' @' + s.pos.x + ',' + s.pos.y + (s.isActive() ? '' : ' INACTIVE') +
        (s.spawning ? ' spawning ' + s.spawning.name + ' (' + s.spawning.remainingTime + ')' : ''));
    const towers = mine.filter(s => s.structureType === STRUCTURE_TOWER);
    state.towers = towers.map(t => t.pos.x + ',' + t.pos.y + ': ' + t.store[RESOURCE_ENERGY]);
    const ramparts = mine.filter(s => s.structureType === STRUCTURE_RAMPART);
    if (ramparts.length) state.ramparts = { count: ramparts.length, lowestHits: Math.min.apply(null, ramparts.map(r => r.hits)) };
    const hostiles = room.find(FIND_HOSTILE_CREEPS);
    state.hostiles = hostiles.length ? countBy(hostiles, h => h.owner.username) : 0;
    state.creepsInRoom = countBy(room.find(FIND_MY_CREEPS), cr => cr.memory.priority || '?');
    return state;
}

// Every Memory entry that mentions the room: keyed by it, or a list containing it.
function memoryMentions(roomName) {
    const out = {};
    const keys = Object.keys(Memory).concat(heapMemory.HEAP_KEYS.filter(key => !(key in Memory)));
    for (const key of keys) {
        if (key === 'creeps' || key === 'flags' || key === 'powerCreeps') continue;
        const value = key in Memory ? Memory[key] : heapMemory.get(key);
        if (Array.isArray(value)) {
            const hits = [];
            value.forEach((item, i) => { if (item === roomName) hits.push(i); });
            if (!hits.length) continue;
            // Flat record lists (creepInQue: room, role, job, spawn) show their record too.
            out[key] = key === 'creepInQue' ? hits.map(i => value.slice(i, i + 4)) : 'listed at index ' + hits.join(', ') + ' of ' + value.length;
        } else if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, roomName)) {
            out[key] = value[roomName];
        } else if (value === roomName) {
            out[key] = value;
        }
    }
    return out;
}

function room(roomName) {
    if (!roomName) return "usage: roomReport('E14N18')";
    const report = { room: roomName, tick: Game.time };
    const visible = Game.rooms[roomName];
    if (visible) {
        report.live = liveState(visible);
        const reasons = maintenance.diagnose(visible);
        report.maintenance = {
            inMaintenance: maintenance.inMaintenance(roomName),
            established: maintenance.isEstablished(roomName),
            blockedBy: reasons.length ? reasons : 'nothing: qualifies (re-evaluated every 100 ticks)',
        };
    } else {
        report.live = 'no vision';
    }
    report.memory = memoryMentions(roomName);
    const home = [];
    for (const name in Memory.creeps) {
        const m = Memory.creeps[name];
        if (!m || m.homeRoom !== roomName) continue;
        const creep = Game.creeps[name];
        home.push(name + ': ' + (m.priority || '?') + (m.jobSpecific ? '/' + m.jobSpecific : '') +
            (creep ? ' ttl ' + (creep.spawning ? 'spawning' : creep.ticksToLive) + ' in ' + creep.room.name : ' (dead, memory left)'));
    }
    report.creepsHomedHere = home;
    const flags = [];
    for (const name in Game.flags) {
        const flag = Game.flags[name];
        if (flag.pos.roomName === roomName || name.indexOf(roomName) === 0) {
            flags.push(name + ' @' + flag.pos.roomName + ' ' + flag.pos.x + ',' + flag.pos.y);
        }
    }
    report.flags = flags;
    print('Room report ' + roomName + '\n' + json(report));
    return 'room report printed (' + json(report).length + ' characters)';
}

// Where creep memory goes: characters per field (summed over all creeps) and per role.
function memCreeps() {
    const byField = {};
    const byRole = {};
    let total = 0;
    let count = 0;
    for (const name in Memory.creeps) {
        const m = Memory.creeps[name];
        if (!m) continue;
        count++;
        const size = JSON.stringify(m).length + name.length + 4;
        total += size;
        const role = m.priority || '?';
        const r = byRole[role] || (byRole[role] = { creeps: 0, chars: 0 });
        r.creeps++;
        r.chars += size;
        for (const field in m) {
            byField[field] = (byField[field] || 0) + JSON.stringify(m[field] === undefined ? null : m[field]).length + field.length + 4;
        }
    }
    const fields = Object.keys(byField).sort((a, b) => byField[b] - byField[a]);
    const roles = Object.keys(byRole).sort((a, b) => byRole[b].chars - byRole[a].chars);
    const lines = ['Creep memory: ' + count + ' creeps, ~' + total + ' characters (~' + Math.round(total / Math.max(1, count)) + ' each)', 'By field:'];
    for (const f of fields) lines.push('  ' + f + ': ' + byField[f]);
    lines.push('By role:');
    for (const r of roles) lines.push('  ' + r + ': ' + byRole[r].creeps + ' creeps, ' + byRole[r].chars + ' chars (' + Math.round(byRole[r].chars / byRole[r].creeps) + ' each)');
    print(lines.join('\n'));
    return count + ' creeps';
}

global.mem = mem;
global.memCreeps = memCreeps;
global.roomReport = room;

module.exports = { mem, memCreeps, room, print, memoryMentions };
