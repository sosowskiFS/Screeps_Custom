// system.links — link roles and transfers.
//
// Roles (Memory.linkRoles[room], set with the structure lists, system.industry):
//   up      the upgrade receiver: the link the upgraders draw from (nearest within 4 of the controller)
//   store   the storage receiver: the hub link beside the storage, where every home energy collector
//           takes first (creep.logistics.overflowSource)
//   senders every other link (by the sources, the upgrade miner's spot, anywhere else)
// Creeps ask by purpose (upgradeLink, storageLink) instead of by position in Memory.linkList.
//
// Transfers (every tick, runLinks): each sender off cooldown sends to a receiver with room enough to
// be worth a transfer (MIN_SEND: a link loses 3% and cools down a tick per tile): the upgrade link
// first, then the storage link. A full sender also sends a smaller load (MIN_FULL_SEND) so the
// miner beside it never has to drop its energy. Receivers are filled once per tick (what is already
// on its way counts). This replaced fixed pairs (first source link -> controller or storage link
// under 400): with three links (RCL6) the storage link took the second source link's place and
// received nothing, the upgrade miner dropped its energy whenever the controller link was full, and
// every such room kept a scraper.
const MIN_SEND = 400;
const MIN_FULL_SEND = 100;
const FULL = 700;

function roles(roomName) {
    return (Memory.linkRoles && Memory.linkRoles[roomName]) || { senders: [] };
}

function get(id) {
    return id ? Game.getObjectById(id) : null;
}

function upgradeLink(room) {
    return get(roles(room.name || room).up);
}

function storageLink(room) {
    return get(roles(room.name || room).store);
}

function senders(room) {
    return (roles(room.name || room).senders || []).map(get).filter(Boolean);
}

// Sender links within range of a position (the upgrade miner's spot, a source).
function sendersNear(room, pos, range = 2) {
    return senders(room).filter(l => l.pos.inRangeTo(pos, range));
}

// Classify a room's links: { up, store, senders } (ids). storageLinkId / controllerLinkId: as chosen
// by the structure lists (system.industry).
function classify(links, storageLinkId, controllerLinkId) {
    return {
        up: controllerLinkId || null,
        store: storageLinkId || null,
        senders: links.filter(l => l.id !== storageLinkId && l.id !== controllerLinkId).map(l => l.id),
    };
}

function free(link) {
    return link.store ? link.store.getFreeCapacity(RESOURCE_ENERGY) : 800 - (link.energy || 0);
}
function energy(link) {
    return link.store ? link.store[RESOURCE_ENERGY] || 0 : link.energy || 0;
}

// One tick of transfers for a room; returns the transfers made ([senderId, receiverId, amount]).
function runLinks(room) {
    const r = roles(room.name);
    const receivers = [get(r.up), get(r.store)].filter(Boolean);
    if (!receivers.length) return [];
    const room8 = room.controller && room.controller.level >= 8;
    const incoming = new Map();
    const space = link => free(link) - (incoming.get(link.id) || 0);
    const made = [];
    const list = senders(room).filter(l => !l.cooldown && energy(l) > 0).sort((a, b) => energy(b) - energy(a));
    for (const sender of list) {
        const have = energy(sender);
        const full = have >= FULL;
        if (have < MIN_SEND && !full) continue;
        let target = null;
        for (const rec of receivers) {
            // At RCL8 the upgrade link only takes what an upgrader there draws: none full is fine.
            const room8Up = room8 && rec.id === r.up;
            const amount = Math.min(have, space(rec));
            if (amount >= MIN_SEND && !room8Up) { target = rec; break; }
            if (amount >= MIN_SEND && room8Up && !target) target = rec;
        }
        if (!target && full) target = receivers.find(rec => Math.min(have, space(rec)) >= MIN_FULL_SEND) || null;
        if (!target) continue;
        const amount = Math.min(have, space(target));
        if (sender.transferEnergy(target, amount) === OK) {
            incoming.set(target.id, (incoming.get(target.id) || 0) + amount);
            made.push([sender.id, target.id, amount]);
        }
    }
    return made;
}

module.exports = { roles, upgradeLink, storageLink, senders, sendersNear, classify, runLinks, MIN_SEND, MIN_FULL_SEND };
