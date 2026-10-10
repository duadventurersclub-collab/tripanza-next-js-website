const MAX_PDF_BYTES = 10 * 1024 * 1024;

function tripanzaPdfUrl(value) {
    let url;
    try { url = new URL(value); } catch { throw new Error('Invalid itinerary PDF URL'); }
    if (url.protocol !== 'https:' || !['tripanza.com', 'www.tripanza.com'].includes(url.hostname)
        || url.port || url.username || url.password
        || url.searchParams.get('generate_pdf') !== '1' || url.searchParams.get('pdf_ready') !== '1') {
        throw new Error('Unapproved itinerary PDF URL');
    }
    return url;
}

async function loadTripanzaPdf(value, fetchPdf = fetch) {
    const url = tripanzaPdfUrl(value);
    const response = await fetchPdf(url, { redirect: 'manual', signal: AbortSignal.timeout(120000) });
    if (!response.ok || !String(response.headers.get('content-type') || '').toLowerCase().includes('application/pdf')) {
        throw new Error('Itinerary PDF is unavailable');
    }
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > MAX_PDF_BYTES) throw new Error('Itinerary PDF is too large');
    if (!response.body) throw new Error('Itinerary PDF is empty');
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
        size += chunk.length;
        if (size > MAX_PDF_BYTES) {
            await response.body.cancel().catch(() => {});
            throw new Error('Itinerary PDF is too large');
        }
        chunks.push(chunk);
    }
    const pdf = Buffer.concat(chunks, size);
    if (pdf.length < 5 || pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error('Invalid itinerary PDF');
    return pdf;
}

module.exports = { loadTripanzaPdf, tripanzaPdfUrl };
