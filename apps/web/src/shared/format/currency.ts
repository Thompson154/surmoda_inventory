// Bolivian boliviano (BOB) formatters. All amounts are stored as integer cents.

/** Bs. 1.234,56 — full precision, two decimals. Default for forms / detail rows. */
export function formatBs(cents: number): string {
  return `Bs. ${(cents / 100).toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Bs 1.234 — rounded to whole units. For dashboards / hero numbers / cards. */
export function formatBsBig(cents: number): string {
  return `Bs ${Math.round(cents / 100).toLocaleString('es-BO')}`;
}

/** Bs. 1.234 — no decimals, with locale-grouped thousands. */
export function formatBsShort(cents: number): string {
  return `Bs. ${Math.round(cents / 100).toLocaleString('es-BO')}`;
}
