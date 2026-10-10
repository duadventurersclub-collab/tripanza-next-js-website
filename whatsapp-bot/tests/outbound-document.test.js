const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadTripanzaPdf, tripanzaPdfUrl } = require('../outboundDocument');

const pdfUrl = 'https://tripanza.com/tours/test/?generate_pdf=1&pdf_ready=1';

test('only the Tripanza raw itinerary endpoint may be fetched', () => {
    assert.equal(tripanzaPdfUrl(pdfUrl).hostname, 'tripanza.com');
    for (const url of [
        'http://tripanza.com/tours/test/?generate_pdf=1&pdf_ready=1',
        'https://tripanza.com.evil.test/tours/test/?generate_pdf=1&pdf_ready=1',
        'https://tripanza.com/tours/test/?generate_pdf=1',
        'https://tripanza.com:8443/tours/test/?generate_pdf=1&pdf_ready=1',
    ]) assert.throws(() => tripanzaPdfUrl(url));
});

test('a valid PDF is buffered without following redirects', async () => {
    const bytes = await loadTripanzaPdf(pdfUrl, async (_url, options) => {
        assert.equal(options.redirect, 'manual');
        return new Response('%PDF-1.7\ncontent', { headers: { 'Content-Type': 'application/pdf' } });
    });
    assert.equal(bytes.toString(), '%PDF-1.7\ncontent');
    await assert.rejects(loadTripanzaPdf(pdfUrl, async () => Response.redirect(pdfUrl)));
    await assert.rejects(loadTripanzaPdf(pdfUrl, async () => new Response('not a PDF', { headers: { 'Content-Type': 'application/pdf' } })));
});

test('oversized PDFs are rejected before sending', async () => {
    await assert.rejects(loadTripanzaPdf(pdfUrl, async () => new Response('%PDF-', {
        headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(11 * 1024 * 1024) },
    })));
});
