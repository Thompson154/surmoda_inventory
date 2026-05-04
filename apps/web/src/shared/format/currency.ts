// Bolivian boliviano (BOB) formatters. All amounts are stored as integer cents,
// but the operator never sells with sub-Bs precision so every formatter rounds
// to whole bolivianos. Sub-cents in the DB only happen for proportional splits
// (totals from rounded item prices) — those round transparently here.

/** Bs. 1.234 — default everywhere; whole bolivianos, locale-grouped thousands. */
export function formatBs(cents: number): string {
  return `Bs. ${Math.round(cents / 100).toLocaleString('es-BO')}`;
}

/** Bs 1.234 — same as formatBs but without the dot, for hero numbers in cards. */
export function formatBsBig(cents: number): string {
  return `Bs ${Math.round(cents / 100).toLocaleString('es-BO')}`;
}

/** Alias of formatBs — kept so existing call sites compile. */
export function formatBsShort(cents: number): string {
  return formatBs(cents);
}

/**
 * Bs. 1.234,56 — exact two-decimal precision for bank-facing reports.
 * Use ONLY when sub-Bs precision matters (totals across many sales accumulate
 * rounding error otherwise). For operator-facing UI use formatBs (rounded).
 */
export function formatBsExact(cents: number): string {
  const value = cents / 100;
  return `Bs. ${value.toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
