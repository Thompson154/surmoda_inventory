// Operational alerts surfaced to admin / encargada. Computed runtime — no
// dedicated table — so they always reflect current state without write paths
// having to remember to emit notification rows.

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AlertKind =
  /** Variant with quantity ≤ threshold at a store. */
  | 'STOCK_LOW'
  /** Variant out of stock (quantity = 0) that sold in the last 7 days. */
  | 'STOCK_OUT_HOT'
  /** Yesterday in Bolivia local has no DailyReport for an active store. */
  | 'CIERRE_MISSING';

export interface AlertDTO {
  /** Stable id derived from kind + payload — clients use it as React key. */
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  /** Spanish message ready to display. */
  message: string;
  /** Where the FE should navigate when the user clicks the alert. */
  link: string;
  /** ISO timestamp the alert was computed. */
  detectedAt: string;
  /** Free-form payload for the consumer (storeId, variantId, etc.). */
  meta: Record<string, string | number>;
}

export interface AlertsResponse {
  items: AlertDTO[];
  /** Sum of items.length per kind so the bell can render a count w/o iterating. */
  countsByKind: Record<AlertKind, number>;
}
