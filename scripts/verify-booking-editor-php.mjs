import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const optional = createRequire(path.join(os.tmpdir(), 'tripanza-studio-validation/node_modules/fixture.cjs'));
const { PHP, loadPHPRuntime } = optional('@php-wasm/universal');
const { getPHPLoaderModule } = optional('@php-wasm/node-8-3');
const php = new PHP(await loadPHPRuntime(await getPHPLoaderModule()));
try {
  for (const file of ['bookings.php', 'booking-editor.php', 'booking-editor-calculations.php']) await php.writeFile('/' + file, fs.readFileSync('wordpress/tripanza-headless-admin/includes/' + file, 'utf8'));
  await php.writeFile('/fixture.php', fs.readFileSync('scripts/fixtures/booking-editor.php', 'utf8'));
  const result = await php.run({ scriptPath: '/fixture.php' });
  assert.equal(result.exitCode, 0, result.text + '\n' + result.errors);
  assert.ok(result.text.startsWith('PASS'), result.text + '\n' + result.errors);
  console.log(result.text.trim());
  console.log('Isolated stub WordPress/storage environment: real PHP code executes, but no production DB or messages are used.');
} finally { php.exit(); }
