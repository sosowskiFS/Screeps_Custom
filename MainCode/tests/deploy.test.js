const test = require('node:test');
const assert = require('node:assert/strict');
const deploy = require('../tools/deploy');

test('options: a world is required; branch defaults to "default"', () => {
    assert.throws(() => deploy.args([]), /--world must be one of/);
    assert.deepEqual(deploy.args(['--world', 'season']), { world: 'season', branch: 'default', dryRun: false });
    assert.deepEqual(deploy.args(['--world', 'ptr', '--branch', 'test', '--dry-run']), { world: 'ptr', branch: 'test', dryRun: true });
    assert.equal(deploy.WORLDS.season, 'https://screeps.com/season/api/');
});

test('modules are the top-level .js files (tests and tools stay behind), named without .js', () => {
    const mods = deploy.modules();
    assert.ok(mods.main && mods['runtime.world'] && mods['system.shardX']);
    assert.ok(!('deploy' in mods) && !('check' in mods) && !Object.keys(mods).some(n => n.endsWith('.test')), 'tools/ and tests/ are not modules');
    const body = JSON.parse(deploy.payload('default', { main: 'x' }));
    assert.deepEqual(body, { branch: 'default', modules: { main: 'x' } });
});

test('push: the branch must exist; the code goes to user/code with the token; a refused token says what to do', async () => {
    const saved = global.fetch;
    process.env.SCREEPS_SEASON_TOKEN = 'tkn';
    const calls = [];
    const reply = (status, data) => ({ ok: status === 200, status, text: async () => JSON.stringify(data) });
    try {
        global.fetch = async (url, opts) => {
            calls.push([url, opts.method || 'GET', opts.headers['X-Token']]);
            if (url.endsWith('user/branches')) return reply(200, { ok: 1, list: [{ branch: 'default', activeWorld: true }] });
            return reply(200, { ok: 1 });
        };
        const out = await deploy.deploy({ world: 'season', branch: 'default' }, () => {});
        assert.equal(out.pushed, true);
        assert.deepEqual(calls.map(c => c.slice(0, 2)), [['https://screeps.com/season/api/user/branches', 'GET'], ['https://screeps.com/season/api/user/code', 'POST']]);
        assert.equal(calls[1][2], 'tkn');

        calls.length = 0;
        await assert.rejects(deploy.deploy({ world: 'season', branch: 'nope' }, () => {}), /no branch "nope"/);
        assert.equal(calls.filter(c => c[1] === 'POST').length, 0, 'nothing pushed to a missing branch');

        global.fetch = async () => reply(401, { error: 'unauthorized' });
        await assert.rejects(deploy.deploy({ world: 'season', branch: 'default' }, () => {}), /seasontoken\.env/);

        calls.length = 0;
        global.fetch = async (url, opts) => { calls.push(url); return reply(200, { ok: 1 }); };
        const dry = await deploy.deploy({ world: 'season', branch: 'default', dryRun: true }, () => {});
        assert.equal(dry.dryRun, true);
        assert.equal(calls.length, 0, 'a dry run sends nothing');
    } finally {
        global.fetch = saved;
        delete process.env.SCREEPS_SEASON_TOKEN;
    }
});
