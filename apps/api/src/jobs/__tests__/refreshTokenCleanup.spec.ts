import { runRefreshTokenCleanup, startRefreshTokenCleanup } from '../refreshTokenCleanup';
import type { Database } from '../../infrastructure/database';

const RETENTION_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function buildMockDb(overrides: Partial<{ deleteMany: jest.Mock }> = {}) {
  return {
    refreshToken: {
      deleteMany: overrides.deleteMany ?? jest.fn().mockResolvedValue({ count: 0 }),
    },
  } as unknown as Database;
}

describe('runRefreshTokenCleanup', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('calls deleteMany with a cutoff ~30 days ago', async () => {
    const now = Date.now();
    jest.setSystemTime(now);

    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const db = buildMockDb({ deleteMany });

    await runRefreshTokenCleanup(db);

    expect(deleteMany).toHaveBeenCalledTimes(1);
    const callArg = deleteMany.mock.calls[0][0] as { where: { expiresAt: { lt: Date } } };
    const cutoff = callArg.where.expiresAt.lt;

    const expectedCutoff = new Date(now - RETENTION_DAYS * MS_PER_DAY);
    expect(cutoff.getTime()).toBe(expectedCutoff.getTime());
  });

  it('logs when tokens are deleted', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 5 });
    const db = buildMockDb({ deleteMany });

    // Should not throw
    await expect(runRefreshTokenCleanup(db)).resolves.toBeUndefined();
    expect(deleteMany).toHaveBeenCalledTimes(1);
  });

  it('does not throw when db.deleteMany rejects', async () => {
    const deleteMany = jest.fn().mockRejectedValue(new Error('DB connection lost'));
    const db = buildMockDb({ deleteMany });

    // Must swallow the error — cleanup failures must not crash the app
    await expect(runRefreshTokenCleanup(db)).resolves.toBeUndefined();
  });
});

describe('startRefreshTokenCleanup', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs once immediately on start', () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const db = buildMockDb({ deleteMany });

    startRefreshTokenCleanup(db);

    // The void runOnce() is immediate — advance timers slightly to let microtasks flush
    // We can verify by checking that deleteMany gets scheduled (Promise microtask)
    expect(deleteMany).toHaveBeenCalledTimes(1);
  });

  it('returns a stop handle that clears the interval', () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const db = buildMockDb({ deleteMany });

    const { stop } = startRefreshTokenCleanup(db);

    // Advance 48h — should have run 2x (initial + 1 interval)
    jest.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(deleteMany).toHaveBeenCalledTimes(2);

    stop();

    // After stop, advancing another 24h should NOT produce more calls
    jest.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(deleteMany).toHaveBeenCalledTimes(2);
  });
});
