const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const files = fs.readdirSync(root).filter(n => n.endsWith('.js'));
for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    new vm.Script(source, { filename: file });
    for (const [, id] of source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '').matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
        if (!fs.existsSync(path.join(root, id + '.js'))) throw new Error(`${file}: missing module ${id}`);
    }
}
console.log(`Syntax and module references valid: ${files.length} Screeps modules.`);
