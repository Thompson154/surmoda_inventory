import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearQueue,
  enqueueSale,
  listPending,
  listPendingForStore,
  recordFailedAttempt,
  removePending,
} from '../offlineQueue';

const STORE = 'store-prado-seed';

const SAMPLE_PAYLOAD = {
  items: [{ variantId: 'v1', quantity: 1, subtotalCents: 100 }],
  paymentMethod: 'cash' as const,
};

describe('offlineQueue', () => {
  beforeEach(() => {
    clearQueue();
  });
  afterEach(() => {
    clearQueue();
  });

  it('enqueueSale persists the entry with a generated id and idempotency key', () => {
    const entry = enqueueSale(STORE, SAMPLE_PAYLOAD);
    expect(entry.id).toMatch(/[0-9a-f-]+/);
    expect(entry.body.idempotencyKey).toBeDefined();
    expect(entry.attempts).toBe(0);
    const all = listPending();
    expect(all).toHaveLength(1);
    expect(all[0]?.storeId).toBe(STORE);
  });

  it('preserves a caller-supplied idempotencyKey instead of generating one', () => {
    const key = '11111111-1111-4111-8111-111111111111';
    const entry = enqueueSale(STORE, { ...SAMPLE_PAYLOAD, idempotencyKey: key });
    expect(entry.body.idempotencyKey).toBe(key);
  });

  it('listPendingForStore filters by store id', () => {
    enqueueSale(STORE, SAMPLE_PAYLOAD);
    enqueueSale('store-zsur-seed', SAMPLE_PAYLOAD);
    expect(listPendingForStore(STORE)).toHaveLength(1);
    expect(listPendingForStore('store-zsur-seed')).toHaveLength(1);
  });

  it('removePending drops a single entry by id', () => {
    const a = enqueueSale(STORE, SAMPLE_PAYLOAD);
    const b = enqueueSale(STORE, SAMPLE_PAYLOAD);
    removePending(a.id);
    const remaining = listPending();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(b.id);
  });

  it('recordFailedAttempt increments the counter without dropping below MAX_ATTEMPTS', () => {
    const e = enqueueSale(STORE, SAMPLE_PAYLOAD);
    const r = recordFailedAttempt(e.id);
    expect(r.dropped).toBe(false);
    expect(listPending()[0]?.attempts).toBe(1);
  });

  it('drops the entry after MAX_ATTEMPTS (10) transient failures', () => {
    const e = enqueueSale(STORE, SAMPLE_PAYLOAD);
    let lastDropped = false;
    for (let i = 0; i < 10; i += 1) {
      lastDropped = recordFailedAttempt(e.id).dropped;
    }
    expect(lastDropped).toBe(true);
    expect(listPending()).toHaveLength(0);
  });

  it('survives a corrupt localStorage value (returns empty queue)', () => {
    window.localStorage.setItem('surmoda:offline-sales-queue:v1', '{not json}');
    expect(listPending()).toEqual([]);
  });

  it('safeWrite handles quota errors gracefully', () => {
    const original = window.localStorage.setItem.bind(window.localStorage);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    // Should not throw even though setItem fails.
    expect(() => enqueueSale(STORE, SAMPLE_PAYLOAD)).not.toThrow();
    spy.mockRestore();
    void original;
  });
});
