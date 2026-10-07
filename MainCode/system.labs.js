// system.labs — empire reaction planner.
//
// Replaces the fixed per-room producer flags. Every PLAN_INTERVAL ticks it totals the empire's
// stock, walks the recipe tree down from the most-needed end products and hands each lab room
// (2 reagent labs + output labs) the most useful reaction whose inputs exist right now. Rooms
// keep their reaction while it is still useful, so labs are not flushed every check, and prefer
// reactions whose inputs are already in their own terminal so less has to be shipped around.
//
// Memory.labJobs[room] = { p: product, a: input (lab 4), b: input (lab 5), since: tick }
// Memory.labOverride[room] = product  pins a room to one reaction (manual control).

const PLAN_INTERVAL = 100;
const MIN_INPUT = 1000;          // empire stock of each input needed to start a reaction
const ROOM_BATCH = 6000;         // one extra room per this much missing product
const MAX_ROOMS_PER_PRODUCT = 2;
const SURPLUS_FACTOR = 2;        // with every target met, keep making T3 for the market up to this
const SELL_FACTOR = 1.5;         // ...and sell what is above this
const MIN_TERMINAL_FREE = 10000; // too full to take on a new reaction

// Stock to keep per lab room (scaled by the number of lab rooms).
const TARGET_PER_ROOM = {
    [RESOURCE_CATALYZED_KEANIUM_ALKALIDE]: 5000,   // ranged (defenders)
    [RESOURCE_CATALYZED_LEMERGIUM_ACID]: 5000,     // repair
    [RESOURCE_CATALYZED_GHODIUM_ACID]: 4000,       // upgrade
    [RESOURCE_CATALYZED_GHODIUM_ALKALIDE]: 3000,   // tough
    [RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE]: 3000,  // move
    [RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE]: 3000, // heal
    [RESOURCE_CATALYZED_UTRIUM_ACID]: 2000,        // attack
    [RESOURCE_CATALYZED_ZYNTHIUM_ACID]: 2000,      // dismantle
    [RESOURCE_GHODIUM]: 3000,                      // nukers
};

let recipes;
// product -> [inputA, inputB], derived from the game's REACTIONS table.
function recipeOf(product) {
    if (!recipes) {
        recipes = {};
        for (const a in REACTIONS) {
            for (const b in REACTIONS[a]) {
                const p = REACTIONS[a][b];
                if (!recipes[p]) recipes[p] = [a, b];
            }
        }
    }
    return recipes[product];
}

function labRooms() {
    const rooms = [];
    for (const name in Game.rooms) {
        const room = Game.rooms[name];
        // Retiring rooms (system.retire) are emptying their terminal: no reactions there.
        if (room.controller && room.controller.my && room.terminal && !require('system.retire').retiring(name) &&
            Memory.labList && Memory.labList[name] && Memory.labList[name].length >= 6) {
            rooms.push(room);
        }
    }
    return rooms;
}

function addStore(stock, store) {
    if (!store) return;
    for (const res in store) {
        if (res !== RESOURCE_ENERGY && store[res] > 0) stock[res] = (stock[res] || 0) + store[res];
    }
}

// Terminal + storage + lab contents of every owned room with a terminal.
function empireStock() {
    const stock = {};
    for (const name in Game.rooms) {
        const room = Game.rooms[name];
        if (!room.controller || !room.controller.my || !room.terminal) continue;
        addStore(stock, room.terminal.store);
        if (room.storage) addStore(stock, room.storage.store);
        for (const id of (Memory.labList && Memory.labList[name]) || []) {
            const lab = Game.getObjectById(id);
            if (lab && lab.mineralType) stock[lab.mineralType] = (stock[lab.mineralType] || 0) + lab.mineralAmount;
        }
    }
    return stock;
}

function targets(roomCount) {
    const out = {};
    const n = Math.max(1, roomCount);
    for (const res in TARGET_PER_ROOM) out[res] = TARGET_PER_ROOM[res] * n;
    return out;
}

// Reactions worth running, most important first. Each end product short of its target is
// expanded down its recipe tree; a "virtual" stock that higher-priority demands have already
// drawn from decides how much of each intermediate is still missing. Every node whose inputs
// are on hand (real stock: shared reagents like H/O/X must not be locked up by the first
// demand while other labs idle) becomes a candidate.
// Returns { list: [{ p, a, b, missing }], wanted: Set(product) }.
function candidates(stock, goal, surplus) {
    const virtual = Object.assign({}, stock);
    const byProduct = {};
    const list = [];
    const wanted = new Set();

    function want(product, amount, depth) {
        const have = virtual[product] || 0;
        const take = Math.min(have, amount);
        virtual[product] = have - take;
        const missing = amount - take;
        const recipe = recipeOf(product);
        if (missing <= 0 || !recipe || depth > 6) return;
        wanted.add(product);
        const [a, b] = recipe;
        const need = Math.min(MIN_INPUT, missing);
        if ((stock[a] || 0) >= need && (stock[b] || 0) >= need) {
            if (byProduct[product]) {
                byProduct[product].missing += missing;
            } else {
                byProduct[product] = { p: product, a, b, missing };
                list.push(byProduct[product]);
            }
        }
        want(a, missing, depth + 1);
        want(b, missing, depth + 1);
    }

    const demands = Object.keys(goal)
        .map(res => ({ res, ratio: (stock[res] || 0) / goal[res] }))
        .sort((x, y) => x.ratio - y.ratio);
    for (const { res, ratio } of demands) {
        if (ratio < 1) want(res, goal[res], 0);
    }
    // Labs would otherwise idle: make sellable T3 up to SURPLUS_FACTOR x target.
    if (surplus && !list.length) {
        for (const { res } of demands) {
            if (res === RESOURCE_GHODIUM) continue;
            want(res, goal[res] * SURPLUS_FACTOR, 0);
        }
    }
    return { list, wanted };
}

function labsLoaded(roomName, job) {
    const ids = Memory.labList[roomName] || [];
    const la = Game.getObjectById(ids[3]);
    const lb = Game.getObjectById(ids[4]);
    return !!(la && lb && la.mineralType === job.a && lb.mineralType === job.b &&
        la.mineralAmount >= LAB_REACTION_AMOUNT && lb.mineralAmount >= LAB_REACTION_AMOUNT);
}

// Inputs already in this room (terminal or storage) save shipping.
function localScore(room, c) {
    const have = res => ((room.terminal.store[res] || 0) + ((room.storage && room.storage.store[res]) || 0));
    const need = Math.min(MIN_INPUT, c.missing);
    return (have(c.a) >= need ? 1 : 0) + (have(c.b) >= need ? 1 : 0);
}

function plan() {
    if (!Memory.labJobs) Memory.labJobs = {};
    const jobs = Memory.labJobs;
    const overrides = Memory.labOverride || {};
    const rooms = labRooms();
    const roomNames = new Set(rooms.map(r => r.name));
    for (const name in jobs) {
        if (!roomNames.has(name)) delete jobs[name];
    }

    const stock = empireStock();
    const goal = targets(rooms.length);
    let { list, wanted } = candidates(stock, goal, false);
    if (!list.length) ({ list, wanted } = candidates(stock, goal, true));

    const slots = {};
    for (const c of list) {
        slots[c.p] = Math.max(1, Math.min(MAX_ROOMS_PER_PRODUCT, Math.ceil(c.missing / ROOM_BATCH)));
    }

    const idle = [];
    for (const room of rooms) {
        const name = room.name;
        const pinned = overrides[name] && recipeOf(overrides[name]);
        if (pinned) {
            const [a, b] = pinned;
            if (!jobs[name] || jobs[name].p !== overrides[name]) jobs[name] = { p: overrides[name], a, b, since: Game.time };
            continue;
        }
        const job = jobs[name];
        if (job && slots[job.p] > 0) {
            slots[job.p]--;
        } else if (job && wanted.has(job.p) && labsLoaded(name, job)) {
            // Inputs ran dry elsewhere but the labs still hold a batch: finish it.
        } else {
            delete jobs[name];
            idle.push(room);
        }
    }

    for (const room of idle) {
        // Too full to take on a reaction only if neither the terminal nor the storage has room
        // (a nearly full terminal used to idle the labs of a room whose storage held the inputs).
        if (room.terminal.store.getFreeCapacity() < MIN_TERMINAL_FREE &&
            !(room.storage && room.storage.store.getFreeCapacity() >= MIN_TERMINAL_FREE)) continue;
        let best;
        let bestScore = Infinity;
        list.forEach((c, rank) => {
            if (!(slots[c.p] > 0)) return;
            // Two inputs already in this terminal are worth skipping a few priority places.
            const score = rank - 2 * localScore(room, c);
            if (score < bestScore) {
                bestScore = score;
                best = c;
            }
        });
        if (best) {
            slots[best.p]--;
            jobs[room.name] = { p: best.p, a: best.a, b: best.b, since: Game.time };
        }
    }
    return jobs;
}

function run() {
    // First run after a deploy plans at once so labWorkers never see an empty plan and flush labs.
    if (!Memory.labJobs || Game.time % PLAN_INTERVAL === 0) plan();
}

function jobFor(roomName) {
    if (require('system.retire').retiring(roomName)) return null;
    return (Memory.labJobs && Memory.labJobs[roomName]) || null;
}

// Empire stock above what the labs keep for boosting; what the market may sell.
function surplus(resource, stock) {
    const goal = targets(labRooms().length)[resource];
    if (!goal) return 0;
    const have = (stock || empireStock())[resource] || 0;
    return Math.max(0, Math.floor(have - goal * SELL_FACTOR));
}

const SELLABLE = Object.keys(TARGET_PER_ROOM).filter(res => res !== RESOURCE_GHODIUM);

module.exports = { run, plan, jobFor, surplus, recipeOf, candidates, targets, empireStock, SELLABLE, TARGET_PER_ROOM };
