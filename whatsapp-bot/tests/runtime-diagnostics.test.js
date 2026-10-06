const test = require('node:test');
const assert = require('node:assert/strict');
const { startRuntimeDiagnostics } = require('../business/runtimeDiagnostics');

test('startup and periodic memory logs include heap/container limits without printing environment values', () => {
    const mib = 1024 * 1024;
    const logs = [];
    let callback, interval, unref = false, canceled;
    const timer = { unref() { unref = true; } };
    const diagnostics = startRuntimeDiagnostics({
        runtime: {
            env: { SECRET: 'PRIVATE' },
            memoryUsage: () => ({ rss: 230 * mib, heapUsed: 105 * mib, heapTotal: 128 * mib, external: 8 * mib }),
            constrainedMemory: () => 512 * mib,
        },
        heapStatistics: () => ({ heap_size_limit: 256 * mib }),
        log: { log: value => logs.push(value) },
        schedule(fn, ms) { callback = fn; interval = ms; return timer; },
        cancel(value) { canceled = value; },
    });
    assert.equal(interval, 60000);
    assert.equal(unref, true);
    assert.match(logs[0], /startup rss=230MiB heap=105MiB\/128MiB heapLimit=256MiB external=8MiB containerLimit=512MiB/);
    diagnostics.report('workspace-ready');
    callback();
    assert.match(logs[1], /workspace-ready/);
    assert.match(logs[2], /periodic/);
    assert(logs.every(value => !/PRIVATE|SECRET/.test(value)));
    diagnostics.stop();
    assert.equal(canceled, timer);
});

test('unknown container limits and failed diagnostics cannot prevent startup', () => {
    const logs = [];
    let fail = false;
    const diagnostics = startRuntimeDiagnostics({
        runtime: { memoryUsage() {
            if (fail) throw new Error('PRIVATE_ERROR');
            return { rss: 0, heapUsed: 0, heapTotal: 0, external: 0 };
        } },
        heapStatistics: () => ({ heap_size_limit: 128 }),
        log: { log: value => logs.push(value) }, schedule() { return {}; }, cancel() {},
    });
    assert.match(logs[0], /containerLimit=unknown/);
    fail = true;
    assert.doesNotThrow(() => diagnostics.report());
    assert.equal(logs.length, 1);
});
