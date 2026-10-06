const { getHeapStatistics } = require('node:v8');

// Log memory figures only: never environment values, credentials or messages.
function startRuntimeDiagnostics({ runtime = process, heapStatistics = getHeapStatistics,
    log = console, schedule = setInterval, cancel = clearInterval } = {}) {
    const mib = bytes => `${Math.round(bytes / 1024 / 1024)}MiB`;
    function report(phase = 'periodic') {
        try {
            const memory = runtime.memoryUsage();
            const limit = heapStatistics().heap_size_limit;
            const constrained = runtime.constrainedMemory?.() || 0;
            log.log(`[memory] ${phase} rss=${mib(memory.rss)} heap=${mib(memory.heapUsed)}/${mib(memory.heapTotal)}`
                + ` heapLimit=${mib(limit)} external=${mib(memory.external)}`
                + ` containerLimit=${constrained ? mib(constrained) : 'unknown'}`);
        } catch { /* Diagnostic collection must not stop the server. */ }
    }
    report('startup');
    const timer = schedule(() => report(), 60000);
    timer?.unref?.();
    return { report, stop: () => cancel(timer) };
}

module.exports = { startRuntimeDiagnostics };
