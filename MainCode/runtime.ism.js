// runtime.ism — shared access to InterShardMemory.
//
// Each shard has one InterShardMemory string. Several systems keep their own key in it
// (system.powerCreeps: 'pc', system.shardX: 'xs'). Each used to read the string, change its key and
// write it back; when two did so on the same tick, the later one wrote back a copy without the
// other's key (shardX's 'xs' was lost on every 100th tick, so shard2 never saw any candidates).
// Here the local data is parsed once and kept in heap: every set() changes that one object and
// writes it out whole, so no key is ever dropped. Remote shards are read at most once per tick.
// Without InterShardMemory (private servers, tests without a stub) everything is a no-op.
let local = null;
const remote = { tick: -1, data: Object.create(null) };

function available() {
    return typeof InterShardMemory !== 'undefined';
}

function parse(raw) {
    try {
        const data = raw ? JSON.parse(raw) : {};
        return data && typeof data === 'object' ? data : {};
    } catch (e) {
        return {};
    }
}

function localData() {
    if (!local) local = parse(InterShardMemory.getLocal());
    return local;
}

// This shard's value under `key`.
function getLocal(key) {
    if (!available()) return undefined;
    return localData()[key];
}

// Set (or with undefined/null, remove) this shard's `key`, keeping every other key.
function setLocal(key, value) {
    if (!available()) return;
    const data = localData();
    if (value === undefined || value === null) delete data[key];
    else data[key] = value;
    InterShardMemory.setLocal(JSON.stringify(data));
}

// Another shard's value under `key` (this shard: the local value).
function get(shard, key) {
    if (!available()) return undefined;
    if (shard === Game.shard.name) return getLocal(key);
    if (remote.tick !== Game.time) {
        remote.tick = Game.time;
        remote.data = Object.create(null);
    }
    if (!(shard in remote.data)) {
        let raw = null;
        try {
            raw = InterShardMemory.getRemote(shard);
        } catch (e) {
            raw = null;
        }
        remote.data[shard] = parse(raw);
    }
    return remote.data[shard][key];
}

// Tests: forget the heap copies.
function reset() {
    local = null;
    remote.tick = -1;
}

module.exports = { available, get, getLocal, setLocal, reset };
