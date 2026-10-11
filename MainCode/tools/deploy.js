#!/usr/bin/env node
// Push the code to a Screeps world through the commit API (docs.screeps.com/commit.html), for
// worlds the GitHub sync doesn't reach (the Seasonal World).
//
//   node tools/deploy.js --world season --dry-run    what would be sent (no network)
//   node tools/deploy.js --world season              push to the season's "default" branch
//   node tools/deploy.js --world season --branch b   push to branch b (must exist there)
//   npm run deploy:season                            the same as the second line
//
// Worlds: season (screeps.com/season), ptr (screeps.com/ptr), mmo (screeps.com).
// Modules: every top-level .js file in MainCode (what tools/check.js validates); tests/ and tools/
// stay behind. The check runs first, and nothing is sent if it fails. The branch must already
// exist in that world; the tool says which branch the world is running.
// Token (never printed): see tools/token.js (SCREEPS_SEASON_TOKEN / seasontoken.env for the season).
const fs = require('fs');
const path = require('path');
const { token } = require('./token');

const ROOT = path.join(__dirname, '..');
const WORLDS = {
    mmo: 'https://screeps.com/api/',
    season: 'https://screeps.com/season/api/',
    ptr: 'https://screeps.com/ptr/api/',
};
const MAX_BYTES = 5 * 1024 * 1024;   // the server's code size limit

function args(argv) {
    const out = { world: null, branch: 'default', dryRun: false };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--world') out.world = argv[++i];
        else if (argv[i] === '--branch') out.branch = argv[++i];
        else if (argv[i] === '--dry-run') out.dryRun = true;
        else throw new Error('unknown option ' + argv[i]);
    }
    if (!WORLDS[out.world]) throw new Error('--world must be one of: ' + Object.keys(WORLDS).join(', '));
    if (!out.branch) throw new Error('--branch needs a name');
    return out;
}

// { moduleName: source } for every top-level .js file.
function modules(root = ROOT) {
    const out = {};
    for (const file of fs.readdirSync(root).filter(n => n.endsWith('.js')).sort()) {
        out[file.slice(0, -3)] = fs.readFileSync(path.join(root, file), 'utf8');
    }
    return out;
}

function payload(branch, mods) {
    const body = JSON.stringify({ branch, modules: mods });
    if (Buffer.byteLength(body) > MAX_BYTES) throw new Error('code is ' + Buffer.byteLength(body) + ' bytes, over the 5 MB limit');
    return body;
}

async function call(world, endpoint, options = {}) {
    const res = await fetch(WORLDS[world] + endpoint, Object.assign({}, options, {
        headers: Object.assign({ 'X-Token': token(world), 'X-Username': 'x', 'Content-Type': 'application/json; charset=utf-8' }, options.headers || {}),
    }));
    const text = await res.text();
    if (res.status === 401 || res.status === 403) {
        throw new Error(world + ': the token was refused (HTTP ' + res.status + ').' +
            (world === 'season' ? ' Create an auth token in the Seasonal World\'s account settings and put it in seasontoken.env (repo root) or SCREEPS_SEASON_TOKEN.' : ''));
    }
    if (!res.ok) throw new Error(world + ' ' + endpoint + ': HTTP ' + res.status + ' ' + text.slice(0, 200));
    const data = JSON.parse(text);
    if (!data.ok) throw new Error(world + ' ' + endpoint + ': ' + text.slice(0, 200));
    return data;
}

async function deploy(opts, log = console.log) {
    require('./check.js');   // syntax and require() references; throws (nothing sent) on failure
    const mods = modules();
    const body = payload(opts.branch, mods);
    const kb = (Buffer.byteLength(body) / 1024).toFixed(0);
    if (opts.dryRun) {
        log(`dry run: ${Object.keys(mods).length} modules (${kb} KB) for ${opts.world}, branch "${opts.branch}"; nothing sent`);
        return { dryRun: true, modules: Object.keys(mods).length };
    }
    const branches = await call(opts.world, 'user/branches');
    const list = branches.list || [];
    const target = list.find(b => b.branch === opts.branch);
    if (!target) throw new Error(`${opts.world}: no branch "${opts.branch}" (branches: ${list.map(b => b.branch).join(', ') || 'none'})`);
    const active = list.find(b => b.activeWorld);
    await call(opts.world, 'user/code', { method: 'POST', body });
    log(`pushed ${Object.keys(mods).length} modules (${kb} KB) to ${opts.world}, branch "${opts.branch}"` +
        (active ? (active.branch === opts.branch ? ' (the running branch)' : `; the world runs "${active.branch}", not this one`) : ''));
    return { pushed: true, modules: Object.keys(mods).length, active: active && active.branch };
}

if (require.main === module) {
    let opts;
    try {
        opts = args(process.argv.slice(2));
    } catch (e) {
        console.error(e.message);
        process.exit(2);
    }
    deploy(opts).catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { args, modules, payload, deploy, WORLDS };
