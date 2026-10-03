// Optional QA renderer when Poppler is not installed on Windows.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const optional = createRequire(path.join(os.tmpdir(), 'tripanza-studio-validation/node_modules/fixture.cjs'));
const { createCanvas, DOMMatrix, ImageData, Path2D } = optional('@napi-rs/canvas');
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const pdfjs = await import(pathToFileURL(optional.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);
const input = process.argv[2] || path.join(os.tmpdir(), 'tripanza-booking-verification/booking-report.pdf');
const output = path.join(path.dirname(input), 'pdf-render'); fs.mkdirSync(output, { recursive: true });
const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(input)), useSystemFonts: true }).promise;
let text = '';
for (let number = 1; number <= pdf.numPages; number++) {
  const page = await pdf.getPage(number), viewport = page.getViewport({ scale: 1.5 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  fs.writeFileSync(path.join(output, `page-${number}.png`), canvas.toBuffer('image/png'));
  text += (await page.getTextContent()).items.map(item => item.str || '').join(' ') + '\n';
}
for (const expected of ['Global Booking History', 'Filtered summary', 'Rooms Required', 'Fixture PDF note', 'Confidential:', 'Page 1']) if (!text.toLowerCase().includes(expected.toLowerCase())) throw Error('PDF content missing: ' + expected);
console.log(`PASS ${pdf.numPages} PDF page(s), branded header, summary, note, table and confidential footer text`);
console.log(output);
