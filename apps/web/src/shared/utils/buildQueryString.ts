/**
 * Builds a URL query string from a plain filters object.
 *
 * Rules:
 * - null / undefined values are skipped.
 * - String values are trimmed; empty strings after trimming are skipped.
 * - Booleans and numbers are serialised via String().
 * - Returns '' when no params survive (no leading '?').
 * - Returns '?key=value&...' otherwise.
 */
export function buildQueryString(
  filters: Record<string, string | number | boolean | null | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined) continue;
    const str = typeof value === 'string' ? value.trim() : String(value);
    if (str === '') continue;
    params.set(key, str);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
