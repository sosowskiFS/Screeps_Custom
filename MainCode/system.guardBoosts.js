// Temporary boost-lab leases and mineral reservations for defensive squads.
const squads = require('system.guardSquads');
function state() { return Memory.guardBoosts || (Memory.guardBoosts = { rooms: {} }); }
function labs(room) {
    return ((Memory.labList && Memory.labList[room.name]) || []).map(id => Game.getObjectById(id)).filter(Boolean);
}
function stock(room, resource) {
    if (!room) return 0;
    return [room.storage, room.terminal].concat(labs(room)).reduce((n, s) => n + (s && s.store && s.store[resource] || 0), 0);
}
function requirements(parts) {
    const map = squads.BOOSTS_BY_PART(), result = {};
    for (const part of parts) {
        const type = typeof part === 'string' ? part : part.type;
        if (part.boost || part.hits === 0 || !map[type]) continue;
        result[map[type]] = (result[map[type]] || 0) + 30;
    }
    return result;
}
function add(into, values) { for (const r in values) into[r] = (into[r] || 0) + values[r]; }
function addSquad(need, room) {
    for (let slot = 0; slot < 4; slot++) add(need, requirements(squads.body(room.energyCapacityAvailable, slot)));
}
function prioritizeEnergy(name) {
    const room = Game.rooms[name];
    if (!room || !room.storage || !room.terminal) return;
    const list = Memory.energyNeedRooms || (Memory.energyNeedRooms = []);
    const i = list.indexOf(name);
    if (i !== -1) list.splice(i, 1);
    list.unshift(name);
}
function prepare() {
    const next = {};
    for (const t of Object.values(squads.state().targets)) {
        const room = Game.rooms[t.home];
        if (t.stopped || !room) continue;
        const r = next[t.home] || (next[t.home] = { need: {}, assignments: {} });
        // Reserve both required formations before their just-in-time safe-mode departure, plus
        // one complete replacement. Existing pending squads are counted below; boosted posted
        // squads no longer need minerals.
        const desired = t.desired || squads.DESIRED_SQUADS || 2;
        const represented = t.squads.filter(q => !q.retired).length;
        const standby = Math.max(1, desired - represented + 1);
        for (let n = 0; n < standby; n++) addSquad(r.need, room);
        for (const q of t.squads) {
            if (q.retired) continue;
            for (const slot of q.slots) {
                const creep = slot.name && Game.creeps[slot.name];
                if (slot.name && (!creep || creep.memory.guardBoostDone)) continue;
                add(r.need, requirements(creep ? creep.body : squads.body(room.energyCapacityAvailable, slot.slot)));
            }
        }
        prioritizeEnergy(t.home);
    }
    for (const name in next) {
        const r = next[name], room = Game.rooms[name], list = labs(room);
        if (!Object.keys(r.need).length) { delete next[name]; continue; }
        const old = state().rooms[name];
        const used = new Set();
        for (const resource of Object.keys(r.need)) {
            const previous = old && Object.keys(old.assignments).find(id => old.assignments[id] === resource);
            let lab = list.find(l => l.id === previous && !used.has(l.id));
            if (!lab) lab = list.find(l => l.mineralType === resource && !used.has(l.id));
            if (!lab) lab = list.find((l, i) => !used.has(l.id) && i !== 3 && i !== 4 && !l.mineralAmount);
            if (!lab) lab = list.find((l, i) => !used.has(l.id) && i >= 5);
            if (!lab) lab = list.find((l, i) => !used.has(l.id) && i < 3);
            if (lab) { used.add(lab.id); r.assignments[lab.id] = resource; }
        }
    }
    state().rooms = next;
}
function roomState(name) { return Memory.guardBoosts && Memory.guardBoosts.rooms[name]; }
function reserved(name, resource) { const r = roomState(name); return r && r.need[resource] || 0; }
function assignment(name, id) { const r = roomState(name); return r && r.assignments[id]; }
function empireNeed() {
    const out = {};
    for (const r of Object.values(Memory.guardBoosts && Memory.guardBoosts.rooms || {})) add(out, r.need);
    return out;
}
function shortages(name) {
    const r = roomState(name), room = Game.rooms[name], out = {};
    if (r) for (const mineral in r.need) out[mineral] = Math.max(0, r.need[mineral] - stock(room, mineral));
    return out;
}
let usedTick, usedLabs = new Set();
function boost(creep) {
    const m = creep.memory;
    if (m.guardBoostDone) return false;
    if (creep.spawning) return true;
    if (m.guardBoostStart === undefined) m.guardBoostStart = Game.time;
    const deadline = Math.min(m.guardBoostStart + 100, m.guardDeparture === undefined ? Infinity : m.guardDeparture);
    const finish = () => { m.guardBoostDone = true; m.guardPhase = 'assembling'; return false; };
    if (Game.time >= deadline || creep.room.name !== m.homeRoom) return finish();
    if (usedTick !== Game.time) { usedTick = Game.time; usedLabs = new Set(); }
    const needed = requirements(creep.body);
    const room = creep.room, r = roomState(room.name);
    if (!r) return finish();
    m.guardSkipped = m.guardSkipped || [];
    for (const resource in needed) {
        if (m.guardSkipped.includes(resource)) continue;
        const labId = Object.keys(r.assignments).find(id => r.assignments[id] === resource);
        const lab = labId && Game.getObjectById(labId);
        if (!lab || stock(room, resource) < 30) { m.guardSkipped.push(resource); continue; }
        m.guardPhase = 'boosting';
        if (usedLabs.has(lab.id)) return true;
        const count = Math.min(needed[resource] / 30, Math.floor((lab.store[resource] || 0) / 30),
            Math.floor((lab.store[RESOURCE_ENERGY] || 0) / 20));
        if (!count) return true; // locally available: give the lab worker its bounded preparation window
        if (!creep.pos.isNearTo(lab)) { creep.travelTo(lab, { range: 1, maxRooms: 1 }); return true; }
        const result = lab.boostCreep(creep, count);
        if (result === OK) usedLabs.add(lab.id);
        else if (result !== ERR_NOT_ENOUGH_RESOURCES && result !== ERR_TIRED) m.guardSkipped.push(resource);
        return true;
    }
    return finish();
}
module.exports = { prepare, stock, requirements, reserved, assignment, empireNeed, shortages, roomState, boost };
// Lease hauling runs before legacy instructions. It also releases any stale legacy lab task.
function workLabs(creep) {
    const room = creep.room, r = roomState(room.name);
    const leaseIds = r ? Object.keys(r.assignments) : [];
    const old = creep.memory.guardLabTask;
    if (!leaseIds.length && !old) return false;
    const carried = creep.store || creep.carry || {};
    const cargo = Object.keys(carried).find(resource => carried[resource] > 0);
    const act = (method, target, resource, amount) => {
        const result = creep[method](target, resource, amount);
        if (result === ERR_NOT_IN_RANGE) creep.travelTo(target, { range: 1, maxRooms: 1 });
        return result;
    };
    if (old) {
        const lab = Game.getObjectById(old.lab);
        if (cargo) {
            const accepted = lab && assignment(room.name, lab.id) &&
                (cargo === RESOURCE_ENERGY || assignment(room.name, lab.id) === cargo) &&
                (!lab.mineralType || lab.mineralType === cargo || cargo === RESOURCE_ENERGY);
            const target = accepted && lab.store.getFreeCapacity(cargo) > 0 ? lab :
                [room.terminal, room.storage].find(s => s && s.store.getFreeCapacity(cargo) > 0);
            if (target) act('transfer', target, cargo);
            else delete creep.memory.guardLabTask;
            return !!target;
        }
        delete creep.memory.guardLabTask;
    }
    if (cargo) return false;
    const capacity = creep.store && creep.store.getFreeCapacity ? creep.store.getFreeCapacity() : creep.carryCapacity;
    for (const id of leaseIds) {
        const lab = Game.getObjectById(id), mineral = r.assignments[id];
        if (!lab) continue;
        if (lab.mineralType && lab.mineralType !== mineral && lab.mineralAmount > 0) {
            const result = act('withdraw', lab, lab.mineralType);
            if (result === OK || result === ERR_NOT_IN_RANGE) {
                creep.memory.guardLabTask = { lab: id, flush: true };
                delete creep.memory.structureTarget; delete creep.memory.direction;
                return true;
            }
        }
        for (const resource of [RESOURCE_ENERGY, mineral]) {
            const want = resource === RESOURCE_ENERGY ? 2000 : Math.min(3000, r.need[mineral]);
            const missing = want - (lab.store[resource] || 0);
            if (missing <= 0) continue;
            const source = [room.terminal, room.storage].find(s => s && s.store[resource] > 0);
            if (!source) continue;
            const amount = Math.min(capacity, missing, source.store[resource]);
            if (amount <= 0) continue;
            const result = act('withdraw', source, resource, amount);
            if (result === OK || result === ERR_NOT_IN_RANGE) {
                creep.memory.guardLabTask = { lab: id };
                delete creep.memory.structureTarget; delete creep.memory.direction;
                delete creep.memory.idleUntil;
                return true;
            }
        }
    }
    // Do not execute an instruction that was issued before the lab became leased.
    if (creep.memory.structureTarget && leaseIds.includes(creep.memory.structureTarget)) {
        delete creep.memory.structureTarget; delete creep.memory.direction;
    }
    return false;
}
module.exports.workLabs = workLabs;
