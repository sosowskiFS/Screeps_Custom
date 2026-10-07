// runtime.heapMemory — Memory keys kept in heap (global) only.
//
// Memory is serialized at the end of every tick and parsed at the start of the next. These keys
// are rebuilt from the game every few ticks anyway (structure id lists, cached room configs,
// tower and remote-mining caches, per-room CPU averages), so carrying them through Memory only
// costs CPU. Each tick the main loop attaches them to Memory (same object every tick, so all
// code keeps using Memory.labList etc. unchanged) and detaches them before Memory is saved.
//
// After a global reset the heap is empty: these keys start out missing, exactly as on a fresh
// Memory, and are rebuilt by their owners on first use (room scans run before creeps act).
const HEAP_KEYS = ['labList', 'linkList', 'sourceList', 'mineralList', 'extractorList', 'powerSpawnList',
    'factoryList', 'nukerList', 'observerList', 'roomConfigs', 'structureScanTick', 'repairTarget',
    'towerTargetTick', 'towerPickedTarget', 'towerNeedEnergy', 'mineralTotals', 'remotePlan', 'roomCPU',
    'isSpawning'];

const heap = Object.create(null);

// Start of tick (after memory initialization): put the heap copies on Memory.
function attach() {
    for (const key of HEAP_KEYS) {
        if (heap[key] === undefined && Memory[key] !== undefined) heap[key] = Memory[key];   // first tick
        if (heap[key] !== undefined) Memory[key] = heap[key];
    }
}

// End of tick: keep whatever object the key holds now (some code replaces it), then take it
// out of Memory so it is not serialized.
function detach() {
    for (const key of HEAP_KEYS) {
        if (Memory[key] !== undefined) heap[key] = Memory[key];
        delete Memory[key];
    }
}

// Read a heap-only key from outside the tick loop (console commands, tests).
function get(key) {
    return Memory[key] !== undefined ? Memory[key] : heap[key];
}

module.exports = { attach, detach, get, HEAP_KEYS };
