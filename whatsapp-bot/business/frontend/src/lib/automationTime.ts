export function zonedIso(local: string, timezone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error("Choose a valid scheduled date and time");
  const wanted = local.replace("T", " ") + ":00";
  const formatter = new Intl.DateTimeFormat("sv-SE", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  let instant = Date.parse(local + ":00Z");
  for (let i = 0; i < 3; i++) instant += Date.parse(wanted.replace(" ", "T") + "Z") - Date.parse(formatter.format(new Date(instant)).replace(" ", "T") + "Z");
  if (!Number.isFinite(instant) || formatter.format(new Date(instant)) !== wanted) throw new Error("This local time does not exist in the selected timezone. Choose another time.");
  return new Date(instant).toISOString();
}
