const { visualsEnabled } = require('runtime.config');
const roomCpu = require('runtime.roomCpu');
const maintenance = require('system.maintenance');
// system.visuals — the room HUD and the world-map cards (Memory.settings.visuals = false: off).
//
// Room view, every room (drawn once with new RoomVisual()):
//   top right     shard panel: GCL, bucket, shard CPU against the limit, credits, tick; a chip
//                 while the CPU governor sheds work.
//   bottom left   boosts: each T3 boost against its lab target (system.labs), as a bar.
//   bottom right  base minerals, coloured as in game; red when below the buying threshold
//                 (system.mineralBuy) for the lab rooms.
//   bottom        the latest notification and how long ago it came.
// Owned rooms, top left: the room panel: RCL (and progress below 8), stored energy, what the
//   room may spend a tick (system.energyFlow), its CPU, its weakest rampart or wall, its spawns,
//   and chips for what needs attention (attacked, safe mode, maintenance, low energy).
// World map, owned rooms: a card with stored energy and RCL, the weakest defence and power, an
//   RCL progress bar below 8, and a coloured frame for an attacked room or low energy.

const C = {
    bg: '#0b1118', edge: '#2a3646', text: '#dfe7ef', dim: '#8494a6', track: '#1d2733',
    good: '#3ecf8e', warn: '#f0b54a', bad: '#ff5f5f', accent: '#5aa9ff', violet: '#a98bff',
};
const MINERAL_COLOUR = {
    H: '#d9d9d9', O: '#d9d9d9', U: '#4dc3e8', L: '#3ad48f', K: '#9d82ff', Z: '#f3cf8a', X: '#ff7f7f', G: '#ffffff',
};
const LOW_ENERGY = 40000;
const ROW = 0.78;

// ---------------------------------------------------------------- drawing helpers

function panel(vis, x, y, w, h, accent) {
    vis.rect(x, y, w, h, { fill: C.bg, opacity: 0.78, stroke: C.edge, strokeWidth: 0.05 });
    if (accent) vis.rect(x, y, 0.14, h, { fill: accent, opacity: 0.95 });
}
function text(vis, s, x, y, opts) {
    vis.text(String(s), x, y, Object.assign({ font: 0.5, color: C.text, align: 'left' }, opts));
}
function bar(vis, x, y, w, frac, colour) {
    vis.rect(x, y - 0.33, w, 0.3, { fill: C.track, opacity: 0.95 });
    const f = Math.max(0, Math.min(1, frac || 0));
    if (f > 0) vis.rect(x, y - 0.33, w * f, 0.3, { fill: colour, opacity: 0.95 });
}
function chip(vis, label, x, y, colour) {
    const w = label.length * 0.3 + 0.4;
    vis.rect(x, y - 0.42, w, 0.56, { fill: colour, opacity: 0.22, stroke: colour, strokeWidth: 0.04 });
    text(vis, label, x + w / 2, y, { font: 0.4, color: colour, align: 'center' });
    return w + 0.2;
}
// Green when high is good (reverse) or when low is good; amber in between.
function scale(frac, highIsGood) {
    const v = highIsGood ? frac : 1 - frac;
    return v >= 0.5 ? C.good : v >= 0.2 ? C.warn : C.bad;
}

function formatNumber(number) {
    if (!number) return number === 0 ? '0' : number;
    const abs = Math.abs(number);
    const fmt = (n, s) => (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10) + s;
    if (abs >= 1e9) return fmt(number / 1e9, 'B');
    if (abs >= 1e6) return fmt(number / 1e6, 'M');
    if (abs >= 1e3) return fmt(number / 1e3, 'k');
    return String(Math.round(number * 100) / 100);
}

// ---------------------------------------------------------------- shard panel (all rooms)

function displayGeneralPieGraphs() {
    if (!visualsEnabled()) return;
    const vis = new RoomVisual();
    const x = 36.6, w = 12.8;
    const gov = Memory.cpuGov;
    const shed = gov && gov.shed > 0;
    const rows = 5 + (shed ? 1 : 0);
    panel(vis, x, 0.4, w, rows * ROW + 0.3, C.accent);
    let y = 1.15;
    text(vis, (Game.shard && Game.shard.name) || 'shard', x + 0.45, y, { font: 0.6, color: C.accent });
    text(vis, 'tick ' + Game.time, x + w - 0.3, y, { font: 0.45, color: C.dim, align: 'right' });
    const row = (label, frac, colour, value) => {
        y += ROW;
        text(vis, label, x + 0.45, y, { font: 0.45, color: C.dim });
        bar(vis, x + 3.2, y, 6.2, frac, colour);
        text(vis, value, x + w - 0.3, y, { font: 0.45, align: 'right' });
    };
    const gcl = Game.gcl.progress / Game.gcl.progressTotal;
    row('GCL ' + Game.gcl.level, gcl, C.violet, Math.floor(gcl * 100) + '%');
    row('Bucket', Game.cpu.bucket / 10000, scale(Game.cpu.bucket / 10000, true), formatNumber(Game.cpu.bucket));
    const avg = (Memory.CPUAverages && Memory.CPUAverages.TotalCPU && Memory.CPUAverages.TotalCPU.CPU) || 0;
    row('CPU', avg / Game.cpu.limit, scale(avg / Game.cpu.limit, false), Math.round(avg) + '/' + Game.cpu.limit);
    const credits = Game.market && typeof Game.market.credits === 'number' ? Game.market.credits : undefined;
    y += ROW;
    text(vis, 'Credits', x + 0.45, y, { font: 0.45, color: C.dim });
    text(vis, credits === undefined ? '-' : formatNumber(credits), x + w - 0.3, y, { font: 0.45, align: 'right' });
    if (shed) {
        y += ROW;
        chip(vis, 'CPU SHED ' + gov.shed + ' (' + Math.round(gov.ema) + ' avg)', x + 0.45, y, C.warn);
    }
}

// ---------------------------------------------------------------- room panel (owned rooms)

function spawnLine(room) {
    const spawns = require('runtime.cache').find(room, FIND_MY_SPAWNS);
    return spawns.map(sp => {
        if (!sp.spawning) return { busy: false };
        const m = Memory.creeps && Memory.creeps[sp.spawning.name];
        const role = ((m && m.priority) || 'creep').replace('NearDeath', '');
        const done = 1 - sp.spawning.remainingTime / sp.spawning.needTime;
        return { busy: true, role, done };
    });
}

function weakestDefence(room) {
    const id = Memory.repairTarget && Memory.repairTarget[room.name];
    const s = id && Game.getObjectById(id);
    return s && (s.structureType === STRUCTURE_RAMPART || s.structureType === STRUCTURE_WALL) ? s.hits : undefined;
}

function displayRoomInfo(thisRoom) {
    const storage = thisRoom.storage;
    const energy = storage ? storage.store[RESOURCE_ENERGY] || 0 : 0;
    if (storage && energy <= LOW_ENERGY) {
        Memory.LastNotification = Game.time.toString() + ' : ' + thisRoom.name + ' Energy levels are critically low!';
    }
    if (!visualsEnabled()) return;
    const vis = new RoomVisual(thisRoom.name);
    const c = thisRoom.controller;
    const attacked = (Memory.roomsUnderAttack || []).includes(thisRoom.name);
    const chips = [];
    if (attacked) chips.push(['UNDER ATTACK', C.bad]);
    if (c && c.safeMode) chips.push(['SAFE MODE ' + c.safeMode, C.accent]);
    if (maintenance.inMaintenance(thisRoom.name)) chips.push(['MAINTENANCE', C.dim]);
    if (storage && energy <= LOW_ENERGY) chips.push(['LOW ENERGY', C.warn]);

    const x = 0.4, w = 12.4;
    const flow = storage ? require('system.energyFlow').budget(thisRoom) : null;
    const defence = weakestDefence(thisRoom);
    const spawns = spawnLine(thisRoom);
    const rows = 1 + (chips.length ? 1 : 0) + (storage ? 1 : 0) + (flow !== null ? 1 : 0) + (c && c.level < 8 ? 1 : 0) +
        (roomCpu.enabled() ? 1 : 0) + (defence !== undefined ? 1 : 0) + (spawns.length ? 1 : 0);
    panel(vis, x, 0.4, w, rows * ROW + 0.15, attacked ? C.bad : C.good);
    let y = 1.15;
    text(vis, thisRoom.name, x + 0.45, y, { font: 0.65, color: C.text });
    text(vis, c ? 'RCL ' + c.level : '', x + w - 0.3, y, { font: 0.5, color: C.violet, align: 'right' });
    if (chips.length) {
        y += ROW;
        let cx = x + 0.45;
        for (const [label, colour] of chips) cx += chip(vis, label, cx, y, colour);
    }
    const row = (label, frac, colour, value, valueColour) => {
        y += ROW;
        text(vis, label, x + 0.45, y, { font: 0.45, color: C.dim });
        if (frac !== undefined) bar(vis, x + 3.0, y, 5.8, frac, colour);
        text(vis, value, x + w - 0.3, y, { font: 0.45, align: 'right', color: valueColour || C.text });
    };
    if (storage) {
        const frac = energy / Math.max(1, storage.store.getCapacity ? storage.store.getCapacity() : 1000000);
        row('Energy', frac, energy <= LOW_ENERGY ? C.bad : C.warn, formatNumber(energy));
    }
    if (flow !== null) {
        row('Budget', undefined, null, (flow >= 0 ? '+' : '') + (Math.round(flow * 10) / 10) + ' /tick', flow >= 0 ? C.good : C.bad);
    }
    if (c && c.level < 8) {
        const p = c.progress / c.progressTotal;
        row('Controller', p, C.violet, Math.floor(p * 100) + '%');
    }
    if (roomCpu.enabled()) {
        const avg = roomCpu.average(thisRoom.name);
        const shard = (Memory.CPUAverages && Memory.CPUAverages.TotalCPU && Memory.CPUAverages.TotalCPU.CPU) || 0;
        row('Room CPU', shard ? avg / shard : 0, C.accent, (Math.round(avg * 10) / 10) + (shard ? ' (' + Math.round(avg / shard * 100) + '%)' : ''));
    }
    if (defence !== undefined) row('Weakest wall', undefined, null, formatNumber(defence));
    if (spawns.length) {
        y += ROW;
        text(vis, 'Spawns', x + 0.45, y, { font: 0.45, color: C.dim });
        let sx = x + 3.0;
        for (const sp of spawns) {
            vis.circle(sx + 0.15, y - 0.17, { radius: 0.15, fill: sp.busy ? C.good : C.track, opacity: 1, stroke: C.edge, strokeWidth: 0.03 });
            if (sp.busy) {
                const label = sp.role.slice(0, 7) + ' ' + Math.floor(sp.done * 100) + '%';
                text(vis, label, sx + 0.4, y, { font: 0.38 });
                sx += label.length * 0.21 + 0.75;
            } else {
                sx += 0.5;
            }
        }
    }
    displayMapCard(thisRoom, energy, defence, attacked);
}

// ---------------------------------------------------------------- world map card (owned rooms)

function displayMapCard(room, energy, defence, attacked) {
    if (!Game.map || !Game.map.visual) return;
    const mv = Game.map.visual;
    const name = room.name;
    const c = room.controller;
    const low = room.storage && energy <= LOW_ENERGY;
    if (attacked || low) {
        mv.rect(new RoomPosition(0, 0, name), 50, 50, { fill: 'transparent', stroke: attacked ? C.bad : C.warn, strokeWidth: 1.2, opacity: 0.9 });
    }
    mv.rect(new RoomPosition(1, 1, name), 48, 11, { fill: C.bg, opacity: 0.72, stroke: C.edge, strokeWidth: 0.4 });
    const style = (colour, align) => ({ color: colour, fontSize: 6, align, opacity: 1 });
    if (room.storage) mv.text('⚡' + formatNumber(energy), new RoomPosition(3, 8, name), style(low ? C.bad : C.text, 'left'));
    if (c) mv.text('RCL' + c.level, new RoomPosition(47, 8, name), style(C.violet, 'right'));
    if (c && c.level < 8) {
        const p = Math.max(0, Math.min(1, c.progress / c.progressTotal));
        mv.rect(new RoomPosition(2, 10, name), 46, 1, { fill: C.track, opacity: 0.9 });
        if (p > 0) mv.rect(new RoomPosition(2, 10, name), 46 * p, 1, { fill: C.violet, opacity: 0.95 });
    }
    const power = room.storage && room.storage.store[RESOURCE_POWER];
    if (defence !== undefined || power) {
        mv.rect(new RoomPosition(1, 40, name), 48, 9, { fill: C.bg, opacity: 0.72, stroke: C.edge, strokeWidth: 0.4 });
        if (defence !== undefined) mv.text('\u{1F6E1}' + formatNumber(defence), new RoomPosition(3, 46.5, name), style(C.text, 'left'));
        if (power) mv.text('☢' + formatNumber(power), new RoomPosition(47, 46.5, name), style(C.bad, 'right'));
    }
}

// ---------------------------------------------------------------- world map: rooms we know of

// Cards for rooms we do not own, from what memory holds: other players' rooms, our remotes (and
// their state), the expansion target, rooms reserved by others, keeper rooms, and other scouted
// rooms with sources. Rebuilt every INTEL_EVERY ticks (heap), drawn every tick; at most MAX_INTEL.
const INTEL_EVERY = 25;
const MAX_INTEL = 250;
let intelCache = { t: -Infinity, cards: [] };

function age(t) {
    if (t === undefined) return '';
    const a = Game.time - t;
    return (a < 1000 ? a : formatNumber(a)) + ' ago';
}

function intelCards() {
    if (Game.time - intelCache.t < INTEL_EVERY && Game.time >= intelCache.t) return intelCache.cards;
    const remote = Memory.remoteIntel || {}, expand = Memory.expandIntel || {}, bad = Memory.badRooms || {};
    const status = Memory.remoteStatus || {}, attacked = new Set(Memory.FarRoomsUnderAttack || []);
    const plans = Memory.remotePlan || {};
    const mined = {};
    for (const home in plans) {
        for (const n of (plans[home] && plans[home].list) || []) {
            const m = mined[n.r] || (mined[n.r] = { home, nodes: 0 });
            m.nodes++;
        }
    }
    const names = new Set(Object.keys(remote).concat(Object.keys(bad), Object.keys(mined), Object.keys(expand)));
    const exp = Memory.expansion && Memory.expansion.t;
    if (exp) names.add(exp);
    const cards = [];
    for (const name of names) {
        const live = Game.rooms[name];
        if (live && live.controller && live.controller.my) continue;   // owned: its own card
        const ri = remote[name] || {}, ei = expand[name] || {}, bi = bad[name];
        const owner = (bi && bi.o) || ri.o || ei.o;
        const reserver = ri.r || ei.r;
        const sources = (ri.s && ri.s.length) || ei.n || 0;
        const seen = Math.max(ri.t || 0, ei.t || 0, (bi && bi.t) || 0) || undefined;
        const st = status[name];
        const off = st && Game.time < (st.until || 0);
        let card;
        if (owner) card = { k: 0, colour: C.bad, main: '👑' + owner.slice(0, 10), side: ri.tw ? '🗼' + ri.tw : '' };
        else if (mined[name]) card = { k: 1, colour: off ? C.bad : C.good,
            main: '⛏' + mined[name].nodes + '/' + (sources || mined[name].nodes) + ' ' + mined[name].home,
            side: off ? 'OFF x' + st.strikes : (reserver && reserver !== 'Invader' ? '' : reserver === 'Invader' ? 'INV' : '') };
        else if (name === exp) card = { k: 2, colour: C.violet, main: (Memory.expansion.st || 'target') + ' →', side: '' };
        else if (reserver) card = { k: 3, colour: reserver === 'Invader' ? C.dim : C.warn, main: '🚩' + reserver.slice(0, 10), side: sources ? sources + ' src' : '' };
        else if (ri.k || ei.k) card = { k: 4, colour: C.dim, main: 'SK', side: sources ? sources + ' src' : '' };
        else if (sources) card = { k: 5, colour: C.dim, main: sources + ' src', side: '', faint: true };
        else continue;
        card.name = name;
        card.age = age(seen);
        card.alarm = attacked.has(name);
        cards.push(card);
    }
    cards.sort((a, b) => a.k - b.k);
    intelCache = { t: Game.time, cards: cards.slice(0, MAX_INTEL) };
    return intelCache.cards;
}

function displayMapIntel() {
    if (!visualsEnabled() || !Game.map || !Game.map.visual) return;
    const mv = Game.map.visual;
    for (const c of intelCards()) {
        const at = (x, y) => new RoomPosition(x, y, c.name);
        if (c.alarm) mv.rect(at(0, 0), 50, 50, { fill: 'transparent', stroke: C.bad, strokeWidth: 1.2, opacity: 0.9 });
        // Two lines: what it is, then the details and how long ago it was seen.
        mv.rect(at(1, 1), 48, 13, { fill: C.bg, opacity: c.faint ? 0.45 : 0.7, stroke: C.edge, strokeWidth: 0.4 });
        mv.rect(at(1, 1), 1.4, 13, { fill: c.colour, opacity: 0.95 });
        mv.text(c.main, at(4, 6.6), { color: c.colour, fontSize: 5, align: 'left', opacity: c.faint ? 0.7 : 1 });
        const detail = [c.side, c.age].filter(Boolean).join('  ');
        if (detail) mv.text(detail, at(4, 12), { color: C.dim, fontSize: 3.8, align: 'left', opacity: 0.9 });
    }
}

// ---------------------------------------------------------------- boosts, minerals, news (all rooms)

const BOOSTS = () => [
    ['Attack', RESOURCE_CATALYZED_UTRIUM_ACID, MINERAL_COLOUR.U],
    ['Ranged', RESOURCE_CATALYZED_KEANIUM_ALKALIDE, MINERAL_COLOUR.K],
    ['Heal', RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE, MINERAL_COLOUR.L],
    ['Dismantle', RESOURCE_CATALYZED_ZYNTHIUM_ACID, MINERAL_COLOUR.Z],
    ['Move', RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE, MINERAL_COLOUR.Z],
    ['Tough', RESOURCE_CATALYZED_GHODIUM_ALKALIDE, MINERAL_COLOUR.G],
    ['Repair', RESOURCE_CATALYZED_LEMERGIUM_ACID, MINERAL_COLOUR.L],
    ['Upgrade', RESOURCE_CATALYZED_GHODIUM_ACID, MINERAL_COLOUR.G],
];
const BASES = () => [['H', RESOURCE_HYDROGEN], ['O', RESOURCE_OXYGEN], ['U', RESOURCE_UTRIUM], ['L', RESOURCE_LEMERGIUM],
    ['K', RESOURCE_KEANIUM], ['Z', RESOURCE_ZYNTHIUM], ['X', RESOURCE_CATALYST], ['G', RESOURCE_GHODIUM]];

let labCache = { t: -Infinity, n: 0 };
function labRoomCount() {
    if (Game.time - labCache.t >= 100) {
        let n = 0;
        try { n = require('system.labs').labRooms().length; } catch (e) { n = 0; }
        labCache = { t: Game.time, n };
    }
    return labCache.n;
}

function DisplayBoostTotals() {
    if (!visualsEnabled()) return;
    displayMapIntel();
    const vis = new RoomVisual();
    const totals = Memory.mineralTotals || {};
    const labRooms = Math.max(1, labRoomCount());
    let targets = {};
    try { targets = require('system.labs').TARGET_PER_ROOM; } catch (e) { targets = {}; }

    // Boosts against their lab targets.
    const boosts = BOOSTS();
    const bx = 0.4, bw = 12.4, bh = boosts.length * 0.68 + 1.15, by = 49.4 - bh;
    panel(vis, bx, by, bw, bh, C.violet);
    text(vis, 'Boosts', bx + 0.45, by + 0.72, { font: 0.5, color: C.violet });
    text(vis, 'stock / target', bx + bw - 0.3, by + 0.72, { font: 0.38, color: C.dim, align: 'right' });
    boosts.forEach(([label, res, colour], i) => {
        const y = by + 1.45 + i * 0.68;
        const have = totals[res] || 0;
        const goal = (targets[res] || 0) * labRooms;
        text(vis, label, bx + 0.45, y, { font: 0.42, color: colour });
        const status = !goal || have >= goal ? C.good : have >= goal * 0.25 ? C.warn : C.bad;
        bar(vis, bx + 3.4, y, 5.2, goal ? have / goal : 0, status);
        text(vis, formatNumber(have), bx + bw - 0.3, y, { font: 0.42, align: 'right', color: status === C.good ? C.text : status });
    });

    // Base minerals, two columns; red below the buying threshold for the lab rooms.
    const bases = BASES();
    const mw = 7.2, mh = Math.ceil(bases.length / 2) * 0.68 + 1.15, mx = 49.6 - mw, my = 49.4 - mh;
    panel(vis, mx, my, mw, mh, C.accent);
    text(vis, 'Minerals', mx + 0.45, my + 0.72, { font: 0.5, color: C.accent });
    let critical = 3000;
    try { critical = require('system.mineralBuy').CRITICAL_PER_ROOM; } catch (e) { critical = 3000; }
    bases.forEach(([sym, res], i) => {
        const col = i % 2, line = Math.floor(i / 2);
        const x = mx + 0.45 + col * 3.4, y = my + 1.45 + line * 0.68;
        const have = totals[res] || 0;
        const low = res !== RESOURCE_GHODIUM && have < critical * labRooms;
        text(vis, sym, x, y, { font: 0.45, color: MINERAL_COLOUR[sym] });
        text(vis, formatNumber(have), x + 2.7, y, { font: 0.42, align: 'right', color: low ? C.bad : C.text });
    });

    // The latest notification, with its age.
    const nx = bx + bw + 0.4, nw = mx - 0.4 - nx;
    panel(vis, nx, 48.35, nw, 1.05);
    const note = Memory.LastNotification;
    if (note) {
        const m = /^(\d+)\s*:\s*(.*)$/.exec(String(note));
        const age = m ? Game.time - Number(m[1]) : undefined;
        const body = m ? m[2] : String(note);
        const alarm = /tresspass|trespass|attack|critical|lost/i.test(body);
        text(vis, body.length > 70 ? body.slice(0, 69) + '…' : body, nx + 0.35, 49.05, { font: 0.45, color: alarm ? C.bad : C.text });
        if (age !== undefined) text(vis, age < 1000 ? age + 't ago' : formatNumber(age) + 't ago', nx + nw - 0.3, 49.05, { font: 0.38, color: C.dim, align: 'right' });
    } else {
        text(vis, 'No news.', nx + 0.35, 49.05, { font: 0.45, color: C.dim });
    }
}

// Kept for callers of the old pie API: a labelled value with a bar.
function drawPie(vis, val, max, title, colour, centerx, centery) {
    const y = centery * 4.5;
    text(vis, title, centerx - 1, y, { font: 0.45, color: C.dim });
    bar(vis, centerx - 1, y + 0.5, 3, max ? val / max : 0, colour);
    text(vis, Number.isFinite(val) ? formatNumber(val) : val, centerx + 2.2, y + 0.5, { font: 0.45, align: 'right' });
}
const getColourByPercentage = (percentage, reverse) => scale(percentage, reverse);

module.exports = { displayGeneralPieGraphs, displayRoomInfo, DisplayBoostTotals, drawPie, getColourByPercentage, formatNumber, displayMapCard, displayMapIntel, intelCards };
