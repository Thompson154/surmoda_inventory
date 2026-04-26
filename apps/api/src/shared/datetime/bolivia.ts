// Single source of truth for Bolivia timezone math (UTC-4, no DST).
//
// Concepts:
//   - dayKey: 00:00 UTC Date used as the canonical key for the "Bolivia local day".
//             Stored in Postgres `DATE` columns (e.g. daily_reports.date).
//   - dayWindow: the [start, end) UTC range containing every timestamp that falls
//             on that Bolivia-local day. Used to filter `Sale.createdAt`, etc.

export const BOLIVIA_OFFSET_MS = 4 * 60 * 60 * 1000;

/** YYYY-MM-DD of the Bolivia-local day containing `now`. */
export function isoDateBolivia(now: Date): string {
  const local = new Date(now.getTime() - BOLIVIA_OFFSET_MS);
  return local.toISOString().slice(0, 10);
}

/** 00:00 UTC of the Bolivia-local day containing `now`. */
export function boliviaDayKey(now: Date): Date {
  return new Date(`${isoDateBolivia(now)}T00:00:00.000Z`);
}

/** Parses a YYYY-MM-DD into the matching dayKey. */
export function parseBoliviaDayKey(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** [start, end) UTC range covering the Bolivia-local day identified by dayKey. */
export function boliviaDayWindow(dayKey: Date): { start: Date; end: Date } {
  const start = new Date(dayKey.getTime() + BOLIVIA_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** dayKey of "yesterday" relative to `now`. */
export function previousBoliviaDayKey(now: Date): Date {
  const today = boliviaDayKey(now);
  return new Date(today.getTime() - 24 * 60 * 60 * 1000);
}

/** UTC timestamp at 00:00 Bolivia of `date`'s local day (i.e. 04:00 UTC). */
export function startOfDayBolivia(date: Date): Date {
  return new Date(boliviaDayKey(date).getTime() + BOLIVIA_OFFSET_MS);
}

/** UTC timestamp at end of Bolivia day (= start + 24h). */
export function endOfDayBolivia(date: Date): Date {
  return new Date(startOfDayBolivia(date).getTime() + 24 * 60 * 60 * 1000);
}

/** UTC timestamp of 00:00 Bolivia on the Monday of `date`'s ISO week. */
export function startOfBoliviaWeekMonday(date: Date): Date {
  const start = startOfDayBolivia(date);
  const local = new Date(start.getTime() - BOLIVIA_OFFSET_MS);
  const dow = local.getUTCDay(); // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow;
  local.setUTCDate(local.getUTCDate() + diff);
  return new Date(local.getTime() + BOLIVIA_OFFSET_MS);
}

/** YYYY-MM-DD label of `date` in Bolivia local time. Alias of `isoDateBolivia`. */
export function isoLocalDate(date: Date): string {
  return isoDateBolivia(date);
}
