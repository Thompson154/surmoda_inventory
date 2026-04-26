// WHY: Bolivia operates on UTC-4 year-round (no DST). The "store-local day" is the
// 24h window starting at 00:00 Bolivia (04:00 UTC). Two distinct concepts here:
//
//   - dayKey: a UTC-midnight Date used as the unique key for `daily_reports.date`
//             (a Postgres `DATE` column). Identifies which Bolivia-local day is
//             being reported on. Always 00:00 UTC.
//
//   - dayWindow: the [start, end) UTC range that contains all sales for that day.
//             Used to filter Sale.createdAt. Spans 04:00 UTC → next-day 04:00 UTC.

const TZ_OFFSET_MS = 4 * 60 * 60 * 1000;

/** YYYY-MM-DD of the Bolivia-local day containing `now`. */
export function isoDateBolivia(now: Date): string {
  const local = new Date(now.getTime() - TZ_OFFSET_MS);
  return local.toISOString().slice(0, 10);
}

/** Returns 00:00 UTC of the Bolivia-local day containing `now` — used as the
 *  daily-report row key. */
export function boliviaDayKey(now: Date): Date {
  return new Date(`${isoDateBolivia(now)}T00:00:00.000Z`);
}

/** Parses a YYYY-MM-DD into the matching dayKey (00:00 UTC). */
export function parseBoliviaDayKey(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** [start, end) UTC range that contains every sale dated within the Bolivia-local
 *  day identified by the given dayKey. */
export function boliviaDayWindow(dayKey: Date): { start: Date; end: Date } {
  const start = new Date(dayKey.getTime() + TZ_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Convenience: dayKey of the Bolivia-local "yesterday" relative to `now`. */
export function previousBoliviaDayKey(now: Date): Date {
  const today = boliviaDayKey(now);
  return new Date(today.getTime() - 24 * 60 * 60 * 1000);
}

// Legacy helpers kept for callers that still expect a UTC timestamp anchored at
// midnight in Bolivia local time. New code should prefer the dayKey/dayWindow
// helpers above.
export function startOfDayBolivia(date: Date): Date {
  const local = new Date(date.getTime() - TZ_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + TZ_OFFSET_MS);
}

export function endOfDayBolivia(date: Date): Date {
  const start = startOfDayBolivia(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export function parseDateBolivia(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00.000-04:00`);
}
