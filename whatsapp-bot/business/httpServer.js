// Node's HTTP request event does not catch rejected async request listeners.
// Keep a failed page/QR request from terminating the WhatsApp service.
function safeRequestHandler(handler, log = console) {
    return async function (req, res) {
        try { await handler(req, res); }
        catch (error) {
            // Error messages, URLs and raw objects may contain private values.
            const category = error instanceof TypeError ? 'TypeError' : 'RequestError';
            log.error(`[http] ${category}; request failed. Private details omitted.`);
            if (res.destroyed || res.writableEnded) return;
            if (res.headersSent) { res.destroy(); return; }
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end('This request could not be completed. Please try again.');
        }
    };
}
function configureHttpServer(server) {
    // Render's proxy can reuse sockets for longer than Node's 5-second default.
    server.keepAliveTimeout = 120000;
    server.headersTimeout = 125000;
}
module.exports = { safeRequestHandler, configureHttpServer };
