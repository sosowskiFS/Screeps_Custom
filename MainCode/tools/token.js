// Screeps auth tokens for the tools. Never printed.
//
// Persistent world: SCREEPS_TOKEN, else the bare token in viewtoken.env at the repo root.
// Seasonal World:   SCREEPS_SEASON_TOKEN, else seasontoken.env at the repo root, else the
//                   persistent-world token (the season server may accept it). All token files are
//                   git-ignored.
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');

function fromFile(name) {
    const file = path.join(REPO, name);
    if (!fs.existsSync(file)) return null;
    const text = fs.readFileSync(file, 'utf8').trim();
    // Bare token, or KEY=value
    const match = /^(?:[A-Z_]+\s*=\s*)?["']?([^"'\s]+)["']?$/m.exec(text);
    if (!match) throw new Error(name + ': could not read a token');
    return match[1];
}

function token(world = 'mmo') {
    if (world === 'season') {
        if (process.env.SCREEPS_SEASON_TOKEN) return process.env.SCREEPS_SEASON_TOKEN.trim();
        const season = fromFile('seasontoken.env');
        if (season) return season;
    }
    if (process.env.SCREEPS_TOKEN) return process.env.SCREEPS_TOKEN.trim();
    const main = fromFile('viewtoken.env');
    if (main) return main;
    throw new Error('No token: set SCREEPS_TOKEN or create viewtoken.env at the repo root' +
        (world === 'season' ? ' (or SCREEPS_SEASON_TOKEN / seasontoken.env for the Seasonal World)' : ''));
}

module.exports = { token, REPO };
