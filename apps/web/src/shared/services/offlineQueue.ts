// Tier 3.A.2 — offline-write queue for POST /sales.
//
// The boutique's in-store wifi will drop mid-checkout. Without this, every
// POST attempt during a network blip = lost sale: the cart evaporates and
// the cashier re-types it once wifi returns. With this:
//
//   1. submit() builds the payload and tries POST first.
//   2. On network error (TypeError / no response) we ENQUEUE the payload in
//      localStorage with a stable idempotencyKey + timestamp.
//   3. The toast surface tells the cashier the sale is queued; she can keep
//      working.
//   4. On the next 'online' event a sync hook drains the queue, replaying
//      each entry as a real POST. Success = remove from queue.
//
// Why localStorage and not IndexedDB:
//   - Sale payloads are small (~500B). A cashier in offline-mode for an
//     hour at 1 sale/min = 60 entries × ~500B = 30KB; well under the 5MB
//     localStorage budget.
//   - localStorage is synchronous and trivial to reason about.
//   - Idempotency-key on the BE means a retry that succeeds + a duplicate
//     drain are both safe — the BE returns the cached sale row.
//
// The queue is keyed by storeId so each branch's offline queue is isolated.

import type { CreateSalePayload } from '@surmoda/contracts';

export interface OfflineSaleEntry {
  /** Stable id stored in the queue — used to remove the entry on success. */
  id: string;
  storeId: string;
  /** Payload as the BE expects it (already includes idempotencyKey). */
  body: CreateSalePayload;
  /** ISO timestamp of when the sale was first attempted. */
  enqueuedAt: string;
  /** How many drain attempts have failed so far. */
  attempts: number;
}

const STORAGE_KEY = 'surmoda:offline-sales-queue:v1';
const MAX_ATTEMPTS = 10;

function safeRead(): OfflineSaleEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as OfflineSaleEntry[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(entries: OfflineSaleEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Quota exceeded or storage disabled. The submit caller should fall
    // back to the immediate error path — losing a sale is better than
    // silently dropping into a black hole.
  }
}

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Adds a sale to the queue. Returns the entry so the UI can show its id. */
export function enqueueSale(storeId: string, body: CreateSalePayload): OfflineSaleEntry {
  // The BE expects idempotencyKey on every offline-replayed sale so that the
  // duplicate-drain case (same entry replayed twice) is a no-op. If the
  // caller didn't already attach one, generate it now so the same UUID is
  // used for every retry of THIS entry.
  const ensuredBody: CreateSalePayload = {
    ...body,
    idempotencyKey: body.idempotencyKey ?? genId(),
  };
  const entry: OfflineSaleEntry = {
    id: genId(),
    storeId,
    body: ensuredBody,
    enqueuedAt: new Date().toISOString(),
    attempts: 0,
  };
  const entries = safeRead();
  entries.push(entry);
  safeWrite(entries);
  return entry;
}

/** Returns the current queue snapshot. */
export function listPending(): OfflineSaleEntry[] {
  return safeRead();
}

/** Returns just the entries for one store. */
export function listPendingForStore(storeId: string): OfflineSaleEntry[] {
  return safeRead().filter((e) => e.storeId === storeId);
}

/** Removes an entry by id (called on successful drain). */
export function removePending(id: string): void {
  const entries = safeRead().filter((e) => e.id !== id);
  safeWrite(entries);
}

/** Increments the attempt counter; if the entry has reached MAX_ATTEMPTS we
 *  drop it from the queue so a permanently-bad payload doesn't loop forever.
 *  The caller should log the drop so ops can investigate. */
export function recordFailedAttempt(id: string): { dropped: boolean } {
  const entries = safeRead();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return { dropped: false };
  const next = { ...entries[idx]!, attempts: entries[idx]!.attempts + 1 };
  if (next.attempts >= MAX_ATTEMPTS) {
    entries.splice(idx, 1);
    safeWrite(entries);
    return { dropped: true };
  }
  entries[idx] = next;
  safeWrite(entries);
  return { dropped: false };
}

/** Test/admin helper — wipes the queue. Not surfaced in the UI. */
export function clearQueue(): void {
  safeWrite([]);
}
