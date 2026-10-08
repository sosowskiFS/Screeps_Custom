// Helper: builds up a young room (auto-expansion, SendHelper flags, shardX). Everything is aimed at
// building speed:
//   gather  (when empty)  storage/terminal; else the nearest loose energy in the room (dropped,
//           containers, tombstones, ruins: picking up is instant, harvesting a load takes ~50
//           ticks); else the nearest source with energy and a free harvesting tile. A helper never
//           waits on an empty source while it carries energy, and only waits for one that refills
//           within REGEN_WAIT ticks.
//   work    (when full, or when no more energy is close at hand) in this order: spawn energy below
//           half (the room makes its own creeps), a controller about to downgrade, towers below
//           TOWER_MIN, walls around the controller below CONTROLLER_WALL_HITS x RCL, then
//           construction ONE SITE AT A TIME (spawn, walls (1 energy each), tower, extension,
//           storage, container, then the rest; the furthest along first, then the nearest) so
//           structures finish one by one, then upgrading. While the controller cannot be upgraded
//           (attacked), the builder places the rest of the base instead (base.builder).
// Builds and upgrades from range 3; any tick it actually works in place it is parked (onPoint), so
// other creeps neither swap it off its tile nor path through it.
const runtimeCache = require('runtime.cache');
const { loadForTrip } = require('creep.logistics');

const WORK_RANGE = 3;
const SLOT_CACHE_TICKS = 1500;
const REGEN_WAIT = 20;
const LOOSE_MIN = 50;
const NEAR_LOOT = 3;             // loose energy this close is worth a partial top-up
const STORE_MIN = 400;
const TOWER_MIN = 500;
const DOWNGRADE_MIN = 3000;
const SITE_ORDER = [STRUCTURE_SPAWN, STRUCTURE_WALL, STRUCTURE_TOWER, STRUCTURE_EXTENSION, STRUCTURE_STORAGE, STRUCTURE_CONTAINER];
const CONTROLLER_WALL_HITS = 10000;   // x RCL: walls around the controller (base.builder) are kept at this
const SIGN = '「輝く猫」(ﾐⓛᆽⓛﾐ)✧';

const slotCache = Object.create(null);   // source id -> { n: open tiles around it, t }

// Tiles around a source a creep can stand on to harvest (terrain and blocking structures).
function harvestSlots(source) {
    const hit = slotCache[source.id];
    if (hit && Game.time - hit.t < SLOT_CACHE_TICKS) return hit.n;
    const terrain = source.room.getTerrain();
    const blocked = new Set();
    for (const s of source.room.lookForAtArea(LOOK_STRUCTURES, source.pos.y - 1, source.pos.x - 1, source.pos.y + 1, source.pos.x + 1, true)) {
        const type = s.structure.structureType;
        if (type !== STRUCTURE_ROAD && type !== STRUCTURE_CONTAINER && type !== STRUCTURE_RAMPART) blocked.add(s.x * 50 + s.y);
    }
    let n = 0;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const x = source.pos.x + dx, y = source.pos.y + dy;
            if ((dx || dy) && x > 0 && x < 49 && y > 0 && y < 49 && !(terrain.get(x, y) & TERRAIN_MASK_WALL) && !blocked.has(x * 50 + y)) n++;
        }
    }
    slotCache[source.id] = { n, t: Game.time };
    return n;
}

// Creeps of ours working a source: helpers (targetSource), the room's harvesters and miners.
function claimed(source, self) {
    let n = 0;
    for (const c of runtimeCache.find(source.room, FIND_MY_CREEPS)) {
        if (c === self) continue;
        const m = c.memory;
        if (m.targetSource === source.id || m.mineSource === source.id || m.sourceLocation === source.id) n++;
    }
    return n;
}

function energyIn(target) {
    if (target.amount !== undefined) return target.resourceType === RESOURCE_ENERGY ? target.amount : 0;
    return target.store ? target.store[RESOURCE_ENERGY] || 0 : 0;
}

// Energy in the target that other helpers are already on their way to take (their free capacity).
function reservedBy(target, self) {
    let n = 0;
    for (const c of runtimeCache.find(target.room || self.room, FIND_MY_CREEPS)) {
        if (c !== self && c.memory.lootTarget === target.id) n += c.store.getFreeCapacity(RESOURCE_ENERGY);
    }
    return n;
}

// The nearest loose energy worth the trip: what is left after other helpers' claims must fill this
// helper, or lie within NEAR_LOOT (a cheap detour) with at least LOOSE_MIN. Helpers used to all
// beeline for any container with a little energy instead of harvesting.
function looseEnergy(creep) {
    const room = creep.room;
    const need = creep.store.getFreeCapacity(RESOURCE_ENERGY);
    const worth = t => {
        const left = energyIn(t) - reservedBy(t, creep);
        return left >= need || (left >= LOOSE_MIN && creep.pos.inRangeTo(t, NEAR_LOOT));
    };
    const found = [].concat(
        runtimeCache.find(room, FIND_DROPPED_RESOURCES).filter(r => r.resourceType === RESOURCE_ENERGY),
        runtimeCache.find(room, FIND_TOMBSTONES),
        runtimeCache.find(room, FIND_RUINS),
        runtimeCache.find(room, FIND_STRUCTURES).filter(s => s.structureType === STRUCTURE_CONTAINER))
        .filter(t => energyIn(t) >= LOOSE_MIN && worth(t));
    return found.length ? creep.pos.findClosestByRange(found) : null;
}

// The loose energy this helper is already heading for, while something is left for it.
function currentLoot(creep) {
    const target = creep.memory.lootTarget ? Game.getObjectById(creep.memory.lootTarget) : null;
    if (target && energyIn(target) - reservedBy(target, creep) > 0) return target;
    delete creep.memory.lootTarget;
    return null;
}

function sourceUsable(source, creep) {
    if (source.energy > 0) return creep.pos.isNearTo(source) || claimed(source, creep) < harvestSlots(source);
    // Empty: worth waiting beside only if it refills soon and the creep has nothing to spend.
    return creep.pos.isNearTo(source) && creep.store.getUsedCapacity() === 0 && (source.ticksToRegeneration || Infinity) <= REGEN_WAIT;
}

function pickSource(creep) {
    const sources = runtimeCache.find(creep.room, FIND_SOURCES).filter(s => s.energy > 0 && claimed(s, creep) < harvestSlots(s));
    return sources.length ? creep.pos.findClosestByRange(sources) : null;
}

// Drop this helper's claims: its harvesting tile and the loose energy it was heading for.
function release(creep) {
    delete creep.memory.targetSource;
    delete creep.memory.lootTarget;
}

// One gathering step. Returns false when nothing is available right now.
function gather(creep) {
    const room = creep.room;
    const want = creep.store.getFreeCapacity(RESOURCE_ENERGY);
    for (const store of [room.storage, room.terminal]) {
        if (store && store.my && store.store[RESOURCE_ENERGY] >= Math.min(STORE_MIN, want)) {
            release(creep);
            if (creep.withdraw(store, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.travelTo(store, { range: 1 });
            return true;
        }
    }
    // Already harvesting a usable source: keep at it (no trips for a few dropped units).
    let source = creep.memory.targetSource ? Game.getObjectById(creep.memory.targetSource) : null;
    if (source && !sourceUsable(source, creep)) {
        release(creep);
        source = null;
    }
    if (!source || !creep.pos.isNearTo(source)) {
        const loose = currentLoot(creep) || looseEnergy(creep);
        if (loose) {
            release(creep);
            creep.memory.lootTarget = loose.id;
            const result = loose.amount !== undefined ? creep.pickup(loose) : creep.withdraw(loose, RESOURCE_ENERGY);
            if (result === ERR_NOT_IN_RANGE) creep.travelTo(loose, { range: 1 });
            return true;
        }
    }
    if (!source) {
        source = pickSource(creep);
        if (!source) return false;
        creep.memory.targetSource = source.id;
    }
    delete creep.memory.lootTarget;
    const result = creep.harvest(source);
    if (result === ERR_NOT_IN_RANGE) creep.travelTo(source, { range: 1 });
    else if (result === OK) creep._working = true;
    return true;
}

// ---------------------------------------------------------------- work

function siteRank(site) {
    const i = SITE_ORDER.indexOf(site.structureType);
    return i === -1 ? SITE_ORDER.length : i;
}

// The site every helper works on: by type, then furthest along, then nearest.
function pickSite(creep) {
    const sites = runtimeCache.find(creep.room, FIND_MY_CONSTRUCTION_SITES);
    if (!sites.length) return null;
    let best = null;
    for (const site of sites) {
        if (!best) { best = site; continue; }
        const byType = siteRank(site) - siteRank(best);
        const byProgress = best.progress / best.progressTotal - site.progress / site.progressTotal;
        const byRange = creep.pos.getRangeTo(site) - creep.pos.getRangeTo(best);
        if (byType < 0 || (byType === 0 && (byProgress < 0 || (byProgress === 0 && byRange < 0)))) best = site;
    }
    return best;
}

function fill(creep, target) {
    if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.travelTo(target, { range: 1 });
}

function workAt(creep, target, action) {
    if (action === ERR_NOT_IN_RANGE) creep.travelTo(target, { range: WORK_RANGE, maxRooms: 1 });
    else if (action === OK) creep._working = true;
}

// One working step.
function work(creep) {
    const room = creep.room;
    const controller = room.controller;
    if (room.energyAvailable < room.energyCapacityAvailable / 2) {
        const sink = creep.pos.findClosestByRange(runtimeCache.find(room, FIND_MY_STRUCTURES).filter(s =>
            (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0));
        if (sink) return fill(creep, sink);
    }
    if (controller && controller.my && controller.ticksToDowngrade < DOWNGRADE_MIN) {
        return workAt(creep, controller, creep.upgradeController(controller));
    }
    const tower = creep.pos.findClosestByRange(runtimeCache.find(room, FIND_MY_STRUCTURES).filter(s =>
        s.structureType === STRUCTURE_TOWER && s.store[RESOURCE_ENERGY] < TOWER_MIN));
    if (tower) return fill(creep, tower);
    if (controller && controller.my) {
        const wall = creep.pos.findClosestByRange(runtimeCache.find(room, FIND_STRUCTURES).filter(s =>
            s.structureType === STRUCTURE_WALL && s.pos.inRangeTo(controller.pos, 1) && s.hits < CONTROLLER_WALL_HITS * controller.level));
        if (wall) return workAt(creep, wall, creep.repair(wall));
    }
    let site = creep.memory.siteTarget ? Game.getObjectById(creep.memory.siteTarget) : null;
    if (!site || Game.time % 10 === 0) site = pickSite(creep);   // re-ranked now and then
    if (site) {
        creep.memory.siteTarget = site.id;
        return workAt(creep, site, creep.build(site));
    }
    delete creep.memory.siteTarget;
    if (controller && controller.my && !(controller.upgradeBlocked > 0)) {
        workAt(creep, controller, creep.upgradeController(controller));
        if (creep.pos.isNearTo(controller) && (!controller.sign || controller.sign.username !== creep.owner.username)) {
            creep.signController(controller, SIGN);
        }
    }
}

// ---------------------------------------------------------------- travel

function travel(creep) {
    let portal;
    if (Game.flags.TakePortal && Game.flags.TakePortal.pos.roomName === creep.pos.roomName) {
        portal = creep.pos.findClosestByRange(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_PORTAL } });
    }
    const path = creep.memory.path;
    if (path && path.length && path[0] === creep.room.name) path.splice(0, 1);
    if (portal) creep.travelTo(portal);
    else if (path && path.length) creep.travelTo(new RoomPosition(25, 25, path[0]));
    else creep.travelTo(new RoomPosition(25, 25, creep.memory.destination));
}

var creep_Helper = {
    run: function(creep) {
        creep._working = false;           // set by a successful harvest/build/repair/upgrade this tick
        if (loadForTrip(creep)) return;   // a full load from home first
        if (creep.room.name !== creep.memory.destination) {
            delete creep.memory.onPoint;
            travel(creep);
            return;
        }
        this.act(creep);
        // Actually working in place this tick (a harvest, build, repair or upgrade that succeeded):
        // parked, so other creeps neither swap it off its tile nor path through it. Never merely
        // for standing still: two helpers blocked in each other's way were both marked parked,
        // became walls to each other's paths and froze for good (shardX E29N36).
        if (creep._working) creep.memory.onPoint = 1;
        else delete creep.memory.onPoint;
    },

    act: function(creep) {
        const flag = creep.memory.homeRoom && Game.flags[creep.memory.homeRoom + 'SendHelper'];
        if (flag && creep.room.controller && creep.room.controller.level >= 4) flag.remove();

        const carried = creep.store.getUsedCapacity();
        if (carried === 0) creep.memory.currentState = 1;
        else if (creep.store.getFreeCapacity() === 0) creep.memory.currentState = 2;

        if (creep.memory.currentState !== 2) {
            if (gather(creep)) return;
            if (carried === 0) {
                // Nothing at all to take: wait out of the way, 3 tiles from the nearest source.
                const near = creep.pos.findClosestByRange(runtimeCache.find(creep.room, FIND_SOURCES));
                if (near && !creep.pos.inRangeTo(near, 3)) creep.travelTo(near, { range: 3 });
                return;
            }
            creep.memory.currentState = 2;   // spend what it has instead of waiting
        }
        release(creep);
        work(creep);
    }
};

module.exports = creep_Helper;
