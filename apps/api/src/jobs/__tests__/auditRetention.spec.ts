// Unit coverage for the audit-retention cron. The job is opt-in via env
// (AUDIT_RETENTION_DAYS); the disabled path is a hard requirement so dev /
// thesis-demo environments don't lose history unintentionally.

import { runAuditRetention, startAuditRetentionJob } from '../auditRetention';
import type { Database } from '../../infrastructure/database';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function buildMockDb(deleteMany: jest.Mock) {
  return {
    auditLog: { deleteMany },
  } as unknown as Database;
}

describe('runAuditRetention', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('skips entirely when retentionDays is 0', async () => {
    const deleteMany = jest.fn();
    await runAuditRetention(buildMockDb(deleteMany), 0);
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('skips when retentionDays is negative', async () => {
    const deleteMany = jest.fn();
    await runAuditRetention(buildMockDb(deleteMany), -5);
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('deletes rows older than the cutoff (365 days)', async () => {
    const now = Date.now();
    jest.setSystemTime(now);
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    await runAuditRetention(buildMockDb(deleteMany), 365);
    const arg = deleteMany.mock.calls[0]?.[0] as {
      where: { timestamp: { lt: Date } };
    };
    expect(arg.where.timestamp.lt.getTime()).toBe(now - 365 * MS_PER_DAY);
  });

  it('swallows DB errors so the cron never crashes the process', async () => {
    const deleteMany = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(
      runAuditRetention(buildMockDb(deleteMany), 365),
    ).resolves.toBeUndefined();
  });
});

describe('startAuditRetentionJob', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('returns a no-op handle when retentionDays is 0 (cron disabled)', () => {
    const deleteMany = jest.fn();
    const handle = startAuditRetentionJob(buildMockDb(deleteMany), 0);
    handle.stop(); // must not throw
    jest.advanceTimersByTime(48 * 60 * 60 * 1000);
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('runs once immediately and then every 24h', () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const { stop } = startAuditRetentionJob(buildMockDb(deleteMany), 90);
    expect(deleteMany).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(deleteMany).toHaveBeenCalledTimes(2);
    stop();
    jest.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(deleteMany).toHaveBeenCalledTimes(2);
  });
});
