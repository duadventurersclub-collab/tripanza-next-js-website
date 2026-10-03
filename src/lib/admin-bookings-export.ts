import { BOOKING_COLUMNS, bookingSummary, type AdminBooking } from "./admin-bookings-types";
// Loaded only after an explicit Export click. Customer records stay in the browser;
// no HTML renderer, iframe, CDN script or external PDF service receives them.
export async function exportBookingReport(rows: AdminBooking[], hidden: number[], note: string, filters: string) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth(), h = doc.internal.pageSize.getHeight(), margin = 40;
  const summary = bookingSummary(rows), now = new Date(), part = (value: number) => String(value).padStart(2, "0");
  const reportId = `TZ-${now.getFullYear()}${part(now.getMonth() + 1)}${part(now.getDate())}-${part(now.getHours())}${part(now.getMinutes())}`;
  // Standard PDF fonts do not contain the rupee glyph. Use INR rather than a broken glyph.
  const fmt = (value: number) => value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const clean = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/[\u2010-\u2015]/g, "-");
  function header() {
    doc.setFillColor(23, 21, 28); doc.rect(0, 0, w, 112, "F"); doc.setFillColor(49, 87, 213); doc.rect(0, 0, 7, 112, "F");
    doc.setFillColor(208, 229, 98); doc.circle(w - margin, 18, 4, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.text("Tripanza", margin, 32);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(174, 169, 181); doc.text("A unit of DU Adventurers Club", margin, 45); doc.text("hello@tripanza.com | 8130117254 | 9910637622", margin, 58);
    doc.setTextColor(208, 229, 98); doc.setFontSize(7); doc.text("OPERATIONS REPORT", w - margin, 31, { align: "right" });
    doc.setTextColor(255, 255, 255); doc.setFontSize(17); doc.setFont("helvetica", "bold"); doc.text("Global Booking History", w - margin, 49, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(174, 169, 181); doc.text(`Generated ${now.toLocaleString("en-IN")} | ${reportId}`, w - margin, 64, { align: "right" }); doc.text(`${rows.length} bookings | ${summary.persons} travellers`, w - margin, 77, { align: "right" });
    doc.setDrawColor(57, 54, 64); doc.line(margin, 86, w - margin, 86); doc.setTextColor(203, 200, 208); doc.setFontSize(7); doc.text(doc.splitTextToSize(`Current view: ${clean(filters)}`, w - margin * 2)[0], margin, 101);
  }
  header(); let y = 125;
  if (note.trim()) {
    const lines: string[] = doc.splitTextToSize(clean(note.trim()), w - margin * 2 - 24);
    doc.setTextColor(23, 21, 28); doc.setFontSize(8);
    for (const line of lines) { if (y > h - 55) { doc.addPage(); header(); y = 125; } doc.text(line, margin + 12, y); y += 11; } y += 14;
  }
  const cards = [{ title: "Guests", lines: [`Total Male: ${summary.male}`, `Total Female: ${summary.female}`] }, { title: "Persons", lines: [`Quad: ${summary.quad}`, `Triple: ${summary.triple}`, `Twin: ${summary.twin}`] }, { title: "Rooms Required", lines: [`Total Rooms: ${summary.quadRooms + summary.tripleRooms + summary.twinRooms}`, `Quad: ${summary.quadRooms}`, `Triple: ${summary.tripleRooms}`, `Twin: ${summary.twinRooms}`] }, { title: "Money", lines: [[8, `Total: ${fmt(summary.total)}`], [9, `Advance: ${fmt(summary.advance)}`], [10, `Balance: ${fmt(summary.balance)}`]].filter(([index]) => !hidden.includes(Number(index))).map(([, text]) => String(text)) }];
  if (y + 110 > h - 45) { doc.addPage(); header(); y = 125; }
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(23, 21, 28); doc.text("Filtered summary", margin, y); y += 12;
  const cardW = (w - margin * 2 - 30) / 4;
  cards.forEach((card, index) => { const x = margin + index * (cardW + 10); doc.setFillColor(248, 249, 253); doc.setDrawColor(228, 227, 232); doc.roundedRect(x, y, cardW, 82, 9, 9, "FD"); doc.setFontSize(8); doc.setTextColor(49, 87, 213); doc.text(card.title.toUpperCase(), x + 10, y + 17); doc.setTextColor(23, 21, 28); doc.setFont("helvetica", "normal"); doc.setFontSize(8); card.lines.forEach((line, n) => doc.text(line, x + 10, y + 33 + n * 11)); });
  y += 97;
  if (!hidden.includes(7) && summary.addons.length) {
    doc.setFontSize(8); doc.setTextColor(23, 21, 28);
    for (const item of summary.addons) {
      const lines: string[] = doc.splitTextToSize(clean(`${item.label}: ${item.qty} ${item.unit}`), w - margin * 2);
      for (const line of lines) { if (y > h - 55) { doc.addPage(); header(); y = 125; } doc.text(line, margin, y); y += 11; }
    } y += 10;
  }
  const columns = BOOKING_COLUMNS.map((_, index) => index).filter(index => index < 14 && !hidden.includes(index));
  if (columns.length) {
    const body = rows.map((row, index) => {
      const cells = [String(index + 1), String(row.id), `${row.departure}\nDuration: ${row.duration}`, row.trip_label, `${row.customer}${row.guests.length ? `\nGuests: ${row.guests.join(", ")}` : ""}`, row.phone, `${row.sharing}\nTotal: ${row.persons}`, row.addons.map(item => `${item.label} (${item.qty} ${item.unit})`).join("\n") || "No Add-ons", fmt(row.total), fmt(row.advance), fmt(row.balance), fmt(row.adjustment), row.status, row.status];
      return columns.map(col => clean(cells[col]));
    });
    const foot = columns.map(col => col === 8 ? fmt(summary.total) : col === 9 ? fmt(summary.advance) : col === 10 ? fmt(summary.balance) : ""); if (!foot[0]) foot[0] = "TOTALS";
    autoTable(doc, { head: [columns.map(col => BOOKING_COLUMNS[col])], body, foot: [foot], startY: y, margin: { top: 122, left: margin, right: margin, bottom: 40 }, showHead: "everyPage", showFoot: "lastPage", rowPageBreak: "avoid", theme: "grid", styles: { fontSize: 7.5, cellPadding: 5, lineColor: [228, 227, 232], lineWidth: .4, textColor: [23, 21, 28], overflow: "linebreak", valign: "middle" }, headStyles: { fillColor: [49, 87, 213], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" }, footStyles: { fillColor: [238, 242, 255], textColor: [32, 61, 167], fontStyle: "bold" }, alternateRowStyles: { fillColor: [250, 250, 251] }, willDrawPage: header });
  }
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page); doc.setDrawColor(226, 232, 240); doc.line(margin, h - 24, w - margin, h - 24); doc.setFontSize(6); doc.setTextColor(109, 105, 117); doc.text("Confidential: This report contains customer information. Share only with authorised Tripanza team members.", margin, h - 12); doc.setFontSize(8); doc.text(`${reportId} | Page ${page}`, w - margin, h - 12, { align: "right" });
  }
  doc.save(`Tripanza-Booking-Report-${reportId}.pdf`);
}
