export type AdminTask = { id: string; text: string; target_date: string; author: string; author_id: number; status: "pending" | "completed" };
export type AdminPlan = { id: string; month: string; name: string; dates: string; author: string; author_id: number };
export type AdminHoliday = { date: string; name: string; desc: string; category: string };
export type AdminBooking = { date: string; total: number; persons: number; status: string };
export type AdminTour = { id: number; title: string; pdf_url: string };
export type AdminWorkspace = {
  api_version: "2.0.0"; user: { id: number; name: string }; today: string; nonce: string;
  tasks: AdminTask[]; plans: AdminPlan[]; holidays: AdminHoliday[]; bookings: AdminBooking[]; tours: AdminTour[];
  intro: string; capabilities: { analytics: boolean; email: boolean; ai: boolean }; analytics_limit: number;
};
export const ADMIN_ACTIONS = ["add_todo", "toggle_todo", "delete_todo", "add_future_trip", "delete_future_trip", "generate_preset_holidays", "clear_all_holidays", "send_tour_itinerary_email"] as const;
export type AdminAction = typeof ADMIN_ACTIONS[number];
export const ADMIN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const rupees = (value: number) => "₹" + value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function dashboardAnalytics(rows: AdminBooking[], currentYear: number, year: string, month: string) {
  let count = 0, revenue = 0, persons = 0;
  const current = Array<number>(12).fill(0), previous = Array<number>(12).fill(0);
  const years = new Set([currentYear, currentYear - 1]);
  for (const row of rows) {
    const rowYear = Number(row.date.slice(0, 4)), rowMonth = Number(row.date.slice(5, 7)) - 1;
    if (rowYear > 2000) years.add(rowYear);
    if (!["fully paid", "partially paid"].includes(row.status.trim().toLowerCase())) continue;
    if ((year === "all" || rowYear === Number(year)) && (month === "all" || rowMonth === Number(month))) {
      count++; revenue += row.total; persons += row.persons;
    }
    if (rowMonth >= 0 && rowMonth < 12) {
      if (rowYear === currentYear) current[rowMonth] += row.total;
      else if (rowYear === currentYear - 1) previous[rowMonth] += row.total;
    }
  }
  return { count, revenue, persons, current, previous, years: [...years].sort((a, b) => b - a) };
}
export function taskTimeframe(task: AdminTask, today: string) {
  if (!task.target_date) return "none";
  return task.target_date < today ? "overdue" : task.target_date === today ? "today" : "upcoming";
}
