// Whole local days in the plant's time zone (Asia/Colombo), whatever the server or phone clock is set to.
export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Colombo";
export const RANGES = ["today", "7d", "30d", "month", "all", "custom"];

// Minutes the zone is ahead of UTC at that instant.
function offsetMinutes(date, tz) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).formatToParts(date).map((p) => [p.type, p.value]));
  return (Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - Math.floor(date.getTime() / 1000) * 1000) / 60000;
}

// "2026-10-22" in the zone for an instant.
export const localDate = (date, tz = APP_TIMEZONE) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

export function addDays(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// First and last millisecond of a local day.
export function dayStart(ymd, tz = APP_TIMEZONE) {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  return new Date(guess - offsetMinutes(new Date(guess), tz) * 60000);
}
export const dayEnd = (ymd, tz = APP_TIMEZONE) => new Date(dayStart(addDays(ymd, 1), tz).getTime() - 1);

// { range, from, to } from the report -> { $gte, $lte } for doneAt (or null for all time).
export function dateWindow({ range, from, to } = {}, now = new Date(), tz = APP_TIMEZONE) {
  const today = localDate(now, tz);
  const span = (a, b) => ({ $gte: dayStart(a, tz), $lte: dayEnd(b, tz) });
  switch (range) {
    case "today": return span(today, today);
    case "7d": return span(addDays(today, -6), today);
    case "30d": return span(addDays(today, -29), today);
    case "month": return span(`${today.slice(0, 7)}-01`, today);
    case "all": return null;
    default: {
      if (!from && !to) return null;
      return { ...(from ? { $gte: dayStart(from, tz) } : {}), ...(to ? { $lte: dayEnd(to, tz) } : {}) };
    }
  }
}
