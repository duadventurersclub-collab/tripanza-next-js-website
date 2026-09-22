type DateParts = { year: number; month: number; day: number };

function partsFrom(value: string): DateParts | null {
  const input = value.trim();
  const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };

  const traveler = input.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (traveler) return { year: Number(traveler[3]), month: Number(traveler[2]), day: Number(traveler[1]) };

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return { year: parsed.getUTCFullYear(), month: parsed.getUTCMonth() + 1, day: parsed.getUTCDate() };
}

function utcDate(value: string) {
  const parts = partsFrom(value);
  return parts ? new Date(Date.UTC(parts.year, parts.month - 1, parts.day)) : null;
}

export function formatTourDate(
  value: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
) {
  const date = utcDate(value);
  return date ? new Intl.DateTimeFormat("en-IN", { ...options, timeZone: "UTC" }).format(date) : value;
}

export function formatTourDateWithOrdinal(value: string) {
  const parts = partsFrom(value);
  if (!parts) return value;
  const remainder = parts.day % 100;
  const suffix = remainder >= 11 && remainder <= 13
    ? "th"
    : parts.day % 10 === 1
      ? "st"
      : parts.day % 10 === 2
        ? "nd"
        : parts.day % 10 === 3
          ? "rd"
          : "th";
  const monthYear = formatTourDate(value, { month: "long", year: "numeric" });
  return `${parts.day}${suffix} ${monthYear}`;
}
