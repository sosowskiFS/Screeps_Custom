#!/usr/bin/env node
// Read-only Screeps API client for debugging (never runs code on the account).
//
// Token: SCREEPS_TOKEN env var, else the bare token in viewtoken.env at the repo root
// (git-ignored). The token has full access to the account, so this client only ever makes read
// requests (GET); it is sent only to screeps.com and never printed.
//
//   node tools/screeps.js me                     account check (username, GCL, CPU)
//   node tools/screeps.js memory [path]          Memory or one dot path, e.g. rooms.E27N43
//   node tools/screeps.js keys [path]            top-level keys of Memory/path with sizes
//   node tools/screeps.js room E27N43            room objects summary
//   node tools/screeps.js room E27N43 --json     full room objects
//   node tools/screeps.js rooms                  owned rooms overview
// Options: --shard shard2 (default); --season reads the Seasonal World (shard shardSeason)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const HOST = 'https://screeps.com';
const SEASON = process.argv.includes('--season');
const API = SEASON ? '/season/api/' : '/api/';

const { token } = require('./token');

async function get(endpoint, params = {}) {
    const url = new URL(API + endpoint, HOST);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, v);
    const res = await fetch(url, { headers: { 'X-Token': token(SEASON ? 'season' : 'mmo'), 'X-Username': 'x' } });
    const remaining = res.headers.get('x-ratelimit-remaining');
    const body = await res.text();
    if (!res.ok) throw new Error(`${endpoint}: HTTP ${res.status} ${body.slice(0, 200)}`);
    const data = JSON.parse(body);
    if (!data.ok) throw new Error(`${endpoint}: ${body.slice(0, 200)}`);
    if (remaining !== null) data._rateRemaining = remaining;
    return data;
}

function unzip(value) {
    if (typeof value === 'string' && value.startsWith('gz:')) {
        return JSON.parse(zlib.gunzipSync(Buffer.from(value.slice(3), 'base64')).toString());
    }
    return value;
}

function size(value) {
    return value === undefined ? 0 : JSON.stringify(value).length;
}

async function memory(memPath, shard) {
    const data = await get('user/memory', { path: memPath, shard });
    return { value: unzip(data.data), rate: data._rateRemaining };
}

function summarizeRoom(objects) {
    const out = { structures: {}, creeps: [], sites: {}, other: {} };
    for (const o of objects) {
        if (o.type === 'creep') {
            out.creeps.push(`${o.name} @${o.x},${o.y} ${o.user === objects.me ? '' : ''}hits ${o.hits}/${o.hitsMax}` +
                (o.store && Object.keys(o.store).length ? ' carry ' + JSON.stringify(o.store) : ''));
        } else if (o.type === 'constructionSite') {
            out.sites[o.structureType] = (out.sites[o.structureType] || 0) + 1;
        } else if (o.type === 'road' || o.type === 'constructedWall' || o.type === 'rampart') {
            // Many tiles: count and weakest only.
            const s = out.structures[o.type] || (out.structures[o.type] = { count: 0, minHits: Infinity });
            s.count++;
            s.minHits = Math.min(s.minHits, o.hits);
        } else if (o.store !== undefined || o.hits !== undefined) {
            const s = out.structures[o.type] || (out.structures[o.type] = []);
            const store = o.store && Object.keys(o.store).length ? ' ' + JSON.stringify(o.store) : '';
            s.push(`@${o.x},${o.y}${store}`);
        } else {
            out.other[o.type] = (out.other[o.type] || 0) + 1;
        }
    }
    return out;
}

async function main() {
    const args = process.argv.slice(2).filter(a => a !== '--season');
    const shardIdx = args.indexOf('--shard');
    const shard = shardIdx >= 0 ? args.splice(shardIdx, 2)[1] : SEASON ? 'shardSeason' : 'shard2';
    const json = args.includes('--json');
    const [cmd, arg] = args.filter(a => a !== '--json');

    switch (cmd) {
    case 'me': {
        const me = await get('auth/me');
        console.log(JSON.stringify({ username: me.username, gcl: me.gcl, cpu: me.cpu, cpuShard: me.cpuShard, rate: me._rateRemaining }, null, 1));
        break;
    }
    case 'memory': {
        const { value, rate } = await memory(arg, shard);
        console.log(JSON.stringify(value, null, 1));
        console.error(`(memory reads left today: ${rate})`);
        break;
    }
    case 'keys': {
        const { value, rate } = await memory(arg, shard);
        if (!value || typeof value !== 'object') { console.log(value); break; }
        const rows = Object.keys(value).map(k => [k, size(value[k])]).sort((a, b) => b[1] - a[1]);
        console.log(`${arg || 'Memory'}: ${rows.length} keys, ~${size(value)} chars`);
        for (const [k, n] of rows) console.log(`  ${k}: ${n}`);
        console.error(`(memory reads left today: ${rate})`);
        break;
    }
    case 'room': {
        if (!arg) throw new Error('usage: room <roomName>');
        const data = await get('game/room-objects', { room: arg, shard });
        if (json) console.log(JSON.stringify(data.objects, null, 1));
        else console.log(JSON.stringify(summarizeRoom(data.objects), null, 1));
        break;
    }
    case 'rooms': {
        const me = await get('auth/me');
        const rooms = await get('user/rooms', { id: me._id });
        console.log(JSON.stringify(rooms.shards || rooms, null, 1));
        break;
    }
    default:
        console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 15).join('\n'));
    }
}

main().catch(e => { console.error(e.message); process.exit(1); });
