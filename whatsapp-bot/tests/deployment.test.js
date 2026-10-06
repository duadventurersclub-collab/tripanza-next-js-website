const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'business', 'install-workspace.js'), 'utf8');

function simulate({ failAt = -1, missingFrontend = false, disabled = false } = {}) {
    const commands = [], errors = [];
    const process = { execPath: '/node', env: { npm_execpath: '/npm-cli.js', NODE_ENV: 'production', ...(disabled ? { BUSINESS_WORKSPACE_ENABLED: 'false' } : {}) } };
    vm.runInNewContext(source, {
        __dirname: path.join(root, 'business'), process,
        console: { log() {}, error(...args) { errors.push(args.join(' ')); } },
        require(name) {
            if (name === 'node:path') return path;
            if (name === 'node:fs') return { existsSync(file) { return !(missingFrontend && file.endsWith('BUILD_ID')); } };
            if (name === 'node:child_process') return { spawnSync(command, args, options) { commands.push({ command, args: Array.from(args), options }); return { status: commands.length - 1 === failAt ? 1 : 0 }; } };
            throw new Error('Unexpected dependency');
        },
    });
    return { process, commands, errors };
}

test('production installs build both workspace modules automatically', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
    const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json')));
    assert.equal(pkg.scripts.postinstall, 'node business/install-workspace.js');
    assert.equal(lock.packages[''].hasInstallScript, true);
    const result = simulate();
    assert.equal(result.process.exitCode, undefined);
    assert.equal(result.commands.length, 3);
    for (const command of result.commands.slice(0, 2)) {
        assert(command.args.includes('--include=dev'), 'Production builds need TypeScript and Tailwind tools');
        assert.equal(command.options.env.NODE_ENV, 'production');
    }
    assert.deepEqual(result.commands[2].args, ['/npm-cli.js', 'run', 'build']);
});

test('failed installs or missing frontend output fail deployment instead of serving an incomplete workspace', () => {
    const failed = simulate({ failAt: 0 });
    assert.equal(failed.process.exitCode, 1);
    assert.equal(failed.commands.length, 1);
    assert.match(failed.errors[0], /Deployment build failed/);
    const incomplete = simulate({ missingFrontend: true });
    assert.equal(incomplete.process.exitCode, 1);
    assert.match(incomplete.errors[0], /BUILD_ID/);
    assert.equal(simulate({ disabled: true }).commands.length, 0);
});
