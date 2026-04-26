// Audit log viewer — admin OR any encargada (global) reads the immutable log
// produced by every domain mutation. Module 12 of the constitution.
//
// Filters: by user (the actor) and by store (resolved from payload.storeId,
// payload.toStoreId, or entity=Store + entityId — see BE repository docs).

export interface AuditLogRow {
  id: string;
  /** When the action was recorded (ISO 8601 UTC). */
  timestamp: string;
  /** Actor id, null for system or unauthenticated events. */
  userId: string | null;
  /** Display label for the actor (fullName || email), null if anonymous. */
  userLabel: string | null;
  /** Action code from AuditAction enum (e.g. SALE_CREATED). */
  action: string;
  /** Affected domain entity (e.g. Sale, Delivery, Stock). */
  entity: string;
  entityId: string | null;
  /**
   * Loosely typed event metadata — varies per action. UI shows a compact
   * key:value summary plus a "ver detalle" expand for the full JSON.
   */
  payload: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
}

export interface AuditLogListResponse {
  items: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditLogFilters {
  /** Filter by actor user id. */
  userId?: string;
  /** Filter by store affected (matches payload.storeId, payload.toStoreId,
   *  or entity=Store with entityId equal to the supplied id). */
  storeId?: string;
  page?: number;
  pageSize?: number;
}
