// Unit coverage for the audit-retention cron. The job is opt-in via env
// (AUDIT_RETENTION_DAYS); the disabled path is a hard requirement so dev /
// thesis-demo environments don't lose history unintentionally.
//
// Tier 3.A.5 — the cron now batches deletes (findMany id-page → deleteMany
// by id, BATCH_SIZE=1000, BATCH_PAUSE_MS=100) so the year-cliff doesn't
// lock the audit_logs table for minutes during cierre.

import { runAuditRetention, startAuditRetentionJob } from '../auditRetention';
import type { Database } from '../../infrastructure/database';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface DbMocks {
  findMany: jest.Mock;
  deleteMany: jest.Mock;
}

function buildMockDb(mocks: DbMocks) {
  return {
    auditLog: {
      findMany: mocks.findMany,
      deleteMany: mocks.deleteMany,
    },
  } as unknown as Database;
}

/** Helper: build a findMany impl that yields N pages of ids of size pageSize,
 *  then an empty page so the loop terminates. */
function pagedFindMany(totalRows: number, pageSize: number) {
  let cursor = 0;
  return jest.fn(async () => {
    const remaining = totalRows - cursor;
    const take = Math.min(pageSize, remaining);
    const ids = Array.from({ length: take }, (_, i) => ({ id: `id-${cursor + i}` }));
    cursor += take;
    return ids;
  });
}

describe('runAuditRetention', () => {
  beforeEach(() => jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }));
  afterEach(() => jest.useRealTimers());

  it('skips entirely when retentionDays is 0', async () => {
    const findMany = jest.fn();
    const deleteMany = jest.fn();
    await runAuditRetention(buildMockDb({ findMany, deleteMany }), 0);
    expect(findMany).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('skips when retentionDays is negative', async () => {
    const findMany = jest.fn();
    const deleteMany = jest.fn();
    await runAuditRetention(buildMockDb({ findMany, deleteMany }), -5);
    expect(findMany).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('uses the correct cutoff (now - retentionDays)', async () => {
    const now = Date.now();
    jest.setSystemTime(now);
    const findMany = jest.fn().mockResolvedValue([]);
    const deleteMany = jest.fn();
    await runAuditRetention(buildMockDb({ findMany, deleteMany }), 365);
    const arg = findMany.mock.calls[0]?.[0] as {
      where: { timestamp: { lt: Date } };
      take: number;
    };
    expect(arg.where.timestamp.lt.getTime()).toBe(now - 365 * MS_PER_DAY);
    expect(arg.take).toBe(1_000);
  });

  it('terminates immediately when no rows match the cutoff', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const deleteMany = jest.fn();
    await runAuditRetention(buildMockDb({ findMany, deleteMany }), 365);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('batches deletes in 1000-row chunks across multiple iterations', async () => {
    const findMany = pagedFindMany(2_500, 1_000); // 3 pages: 1000, 1000, 500
    const deleteMany = jest.fn().mockImplementation(async (q) => ({
      count: (q.where.id.in as string[]).length,
    }));
    const promise = runAuditRetention(buildMockDb({ findMany, deleteMany }), 365);
    // Drain the inter-batch setTimeout pauses so the loop can finish.
    await jest.runAllTimersAsync();
    await promise;
    expect(findMany).toHaveBeenCalledTimes(3);
    expect(deleteMany).toHaveBeenCalledTimes(3);
    const totalDeleted = deleteMany.mock.results.reduce(
      async (acc, r) => (await acc) + (await r.value).count,
      Promise.resolve(0),
    );
    expect(await totalDeleted).toBe(2_500);
  });

  it('swallows DB errors so the cron never crashes the process', async () => {
    const findMany = jest.fn().mockRejectedValue(new Error('boom'));
    const deleteMany = jest.fn();
    await expect(
      runAuditRetention(buildMockDb({ findMany, deleteMany }), 365),
    ).resolves.toBeUndefined();
  });
});

describe('startAuditRetentionJob', () => {
  beforeEach(() => jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }));
  afterEach(() => jest.useRealTimers());

  it('returns a no-op handle when retentionDays is 0 (cron disabled)', () => {
    const findMany = jest.fn();
    const deleteMany = jest.fn();
    const handle = startAuditRetentionJob(buildMockDb({ findMany, deleteMany }), 0);
    handle.stop(); // must not throw
    jest.advanceTimersByTime(48 * 60 * 60 * 1000);
    expect(findMany).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('runs once immediately and then every 24h', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const deleteMany = jest.fn();
    const { stop } = startAuditRetentionJob(buildMockDb({ findMany, deleteMany }), 90);
    // Initial tick is sync-scheduled via void runAuditRetention(...).
    await Promise.resolve(); // let the microtask flush
    expect(findMany).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(24 * 60 * 60 * 1000);
    await Promise.resolve();
    expect(findMany).toHaveBeenCalledTimes(2);
    stop();
    jest.advanceTimersByTime(24 * 60 * 60 * 1000);
    await Promise.resolve();
    expect(findMany).toHaveBeenCalledTimes(2);
  });
});
