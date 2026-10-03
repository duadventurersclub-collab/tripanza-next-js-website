export function adminDashboardFixture() {
  return {
    api_version: "2.0.0", user: { id: 1, name: "Fixture Admin" }, today: "2026-10-03", nonce: "fixture-nonce",
    capabilities: { analytics: true, email: true, ai: true }, analytics_limit: 1000, intro: "",
    tasks: [{ id: "1", text: "Call the group", target_date: "2026-10-03", author: "Fixture Admin", author_id: 1, status: "pending" }, { id: "2", text: "Other admin task", target_date: "2026-10-01", author: "Colleague", author_id: 2, status: "pending" }],
    plans: [{ id: "3", name: "Manali plan", month: "october", dates: "4th October 2026", author: "Fixture Admin", author_id: 1 }],
    holidays: [{ date: "Oct 2 - Oct 4", name: "Corporate weekend", desc: "Planning window", category: "corporate" }],
    bookings: [{ date: "2026-10-04", total: 12000, persons: 3, status: "Fully Paid" }, { date: "2026-09-20", total: 8000, persons: 2, status: "Partially Paid" }, { date: "2025-10-02", total: 5000, persons: 1, status: "Fully Paid" }, { date: "2026-10-04", total: 90000, persons: 10, status: "Pending" }],
    tours: [{ id: 42, title: "Fixture mountain escape", pdf_url: "http://127.0.0.1/fixture-tour/?generate_pdf=1" }, { id: 43, title: "Spiti escape", pdf_url: "http://127.0.0.1/spiti/?generate_pdf=1" }],
  };
}
