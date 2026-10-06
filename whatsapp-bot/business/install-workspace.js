const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const npmCli = process.env.npm_execpath;

function run(args, cwd) {
    const result = spawnSync(process.execPath, [npmCli, ...args], {
        cwd, env: process.env, stdio: 'inherit', windowsHide: true,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Workspace build command failed (${result.signal || result.status}): npm ${args.join(' ')}`);
}

try {
    if (process.env.BUSINESS_WORKSPACE_ENABLED === 'false') {
        console.log('[workspace] Build skipped: the team workspace is disabled.');
    } else {
        if (!npmCli || !fs.existsSync(npmCli)) throw new Error('Run this setup through npm install or npm ci.');
        console.log('[workspace] Installing and building the team workspace for deployment...');
        // Render sets NODE_ENV=production. Build tools are still needed here.
        for (const directory of ['backend', 'frontend']) {
            run(['ci', '--include=dev', '--no-audit', '--no-fund'], path.join(__dirname, directory));
        }
        run(['run', 'build'], root);
        for (const file of ['business/backend/dist/integration.js', 'business/frontend/.next/BUILD_ID']) {
            if (!fs.existsSync(path.join(root, file))) throw new Error(`Workspace build output is missing: ${file}`);
        }
        console.log('[workspace] Deployment build complete.');
    }
} catch (error) {
    console.error('[workspace] Deployment build failed:', error.message);
    process.exitCode = 1;
}
