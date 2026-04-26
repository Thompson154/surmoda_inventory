// Bolivia timezone smoke test for the dailyLock cron. The cron runs in UTC
// inside the container; the lock and release hours are interpreted in
// Bolivia local (UTC-4). This test pins the offset math so a future
// timezone refactor can't silently shift the lock window.

import { startDailyLockJob } from '../dailyLock';
import type { Database } from '../../infrastructure/database';

function mockDb(): { db: Database; updateMany: jest.Mock } {
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const db = { store: { updateMany } } as unknown as Database;
  return { db, updateMany };
}

/** Build a Date that, interpreted in Bolivia local, has the given hour. */
function boliviaTime(boliviaHour: number, day = 1): Date {
  // Bolivia is UTC-4. So 22:00 Bolivia ⇔ 02:00 UTC the next day.
  const utcHour = (boliviaHour + 4) % 24;
  // Use a fixed reference day to keep the test deterministic.
  const d = new Date(Date.UTC(2026, 4, day, utcHour, 0, 0));
  return d;
}

describe('dailyLock — Bolivia timezone smoke', () => {
  it('locks active branches at 22:00 Bolivia (lockHour default)', async () => {
    const { db, updateMany } = mockDb();
    const handle = startDailyLockJob({ db });
    updateMany.mockClear(); // strip the immediate boot tick
    await handle.runOnce(boliviaTime(22));
    handle.stop();

    expect(updateMany).toHaveBeenCalledTimes(1);
    const call = updateMany.mock.calls[0]?.[0] as {
      where: { salesLockedAt: null; kind: string; isActive: boolean };
      data: { salesLockedAt: Date };
    };
    expect(call.where.kind).toBe('branch');
    expect(call.where.isActive).toBe(true);
    expect(call.where.salesLockedAt).toBeNull();
    expect(call.data.salesLockedAt).toBeInstanceOf(Date);
  });

  it('releases the lock at 00:00 Bolivia (releaseHour default)', async () => {
    const { db, updateMany } = mockDb();
    const handle = startDailyLockJob({ db });
    updateMany.mockClear();
    await handle.runOnce(boliviaTime(0));
    handle.stop();

    expect(updateMany).toHaveBeenCalledTimes(1);
    const call = updateMany.mock.calls[0]?.[0] as {
      where: { salesLockedAt: { not: null } };
      data: { salesLockedAt: null };
    };
    expect(call.data.salesLockedAt).toBeNull();
  });

  it('is a no-op at any other Bolivia hour (e.g. 09:00)', async () => {
    const { db, updateMany } = mockDb();
    const handle = startDailyLockJob({ db });
    updateMany.mockClear();
    await handle.runOnce(boliviaTime(9));
    handle.stop();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('respects custom lockHour and releaseHour overrides', async () => {
    const { db, updateMany } = mockDb();
    const handle = startDailyLockJob({ db, lockHour: 18, releaseHour: 6 });
    updateMany.mockClear();
    await handle.runOnce(boliviaTime(18));
    expect(updateMany).toHaveBeenCalledTimes(1);
    updateMany.mockClear();
    await handle.runOnce(boliviaTime(6));
    expect(updateMany).toHaveBeenCalledTimes(1);
    updateMany.mockClear();
    await handle.runOnce(boliviaTime(12));
    expect(updateMany).not.toHaveBeenCalled();
    handle.stop();
  });

  it('swallows DB errors so the cron never crashes the process', async () => {
    const updateMany = jest.fn().mockRejectedValue(new Error('boom'));
    const db = { store: { updateMany } } as unknown as Database;
    const handle = startDailyLockJob({ db });
    await expect(handle.runOnce(boliviaTime(22))).resolves.toBeUndefined();
    handle.stop();
  });
});
