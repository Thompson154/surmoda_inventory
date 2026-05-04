// Helpers to convert a YYYY-MM-DD string (from <input type="date">)
// into an ISO 8601 datetime string with timezone info (required by the backend).
// We use local-time construction so the day boundaries are in the local timezone.

/**
 * Returns the ISO 8601 string for the START of a calendar day.
 * e.g. '2026-04-27' → '2026-04-27T00:00:00.000-04:00' (local)
 */
export function toIsoStartOfDay(yyyymmdd: string): string {
  return new Date(`${yyyymmdd}T00:00:00`).toISOString();
}

/**
 * Returns the ISO 8601 string for the END of a calendar day (last ms).
 * e.g. '2026-04-27' → '2026-04-27T23:59:59.999-04:00' (local)
 */
export function toIsoEndOfDay(yyyymmdd: string): string {
  return new Date(`${yyyymmdd}T23:59:59.999`).toISOString();
}
