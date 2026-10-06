import { z } from "zod";

/** Date-only Gregorian input. No Date parsing, timezone or rollover coercion. */
export function calendarDay(value: unknown): number | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) return undefined;
  return year * 10000 + month * 100 + day;
}

export const CalendarDateSchema = z.string().refine(value => calendarDay(value) !== undefined, {
  message: "Enter a real calendar date in YYYY-MM-DD format.",
});
