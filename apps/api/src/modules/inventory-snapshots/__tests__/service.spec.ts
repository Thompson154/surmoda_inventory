// Unit tests for InventorySnapshotService — TDD RED phase.
// Repository is mocked; no DB required.

import { buildInventorySnapshotService } from '../service';
import type { InventorySnapshotRepository } from '../repository';
import type { InventorySnapshotService } from '../service';

// ─── Helpers ────────────────────────────────────────────────────────────────

type MockRepo = {
  [K in keyof InventorySnapshotRepository]: jest.Mock;
};

function buildMockRepo(): MockRepo {
  return {
    getActiveStoreIds: jest.fn(),
    getStockRowsForStore: jest.fn(),
    bulkInsertSnapshots: jest.fn(),
    getNearestSnapshot: jest.fn(),
    getSnapshotForStoreAt: jest.fn(),
  };
}

// ─── captureSnapshot ─────────────────────────────────────────────────────────

describe('InventorySnapshotService.captureSnapshot', () => {
  let repo: MockRepo;
  let service: InventorySnapshotService;

  beforeEach(() => {
    repo = buildMockRepo();
    service = buildInventorySnapshotService({
      snapshots: repo as unknown as InventorySnapshotRepository,
    });
  });

  it('captures all stores when no storeId provided', async () => {
    repo.getActiveStoreIds.mockResolvedValue(['store-a', 'store-b']);
    repo.getStockRowsForStore.mockResolvedValue([
      { variantId: 'var-1', quantity: 10 },
      { variantId: 'var-2', quantity: 5 },
    ]);
    repo.bulkInsertSnapshots.mockResolvedValue(undefined);

    const result = await service.captureSnapshot({});

    expect(repo.getActiveStoreIds).toHaveBeenCalledTimes(1);
    expect(repo.getStockRowsForStore).toHaveBeenCalledTimes(2); // once per store
    // 2 stores × 2 variants = 4 rows snapshotted
    expect(result.snapshotted).toBe(4);
    expect(result.capturedAt).toBeInstanceOf(Date);
  });

  it('captures only the given store when storeId provided', async () => {
    repo.getStockRowsForStore.mockResolvedValue([{ variantId: 'var-1', quantity: 3 }]);
    repo.bulkInsertSnapshots.mockResolvedValue(undefined);

    const result = await service.captureSnapshot({ storeId: 'store-a' });

    expect(repo.getActiveStoreIds).not.toHaveBeenCalled();
    expect(repo.getStockRowsForStore).toHaveBeenCalledWith('store-a');
    expect(result.snapshotted).toBe(1);
  });

  it('respects the capturedAt timestamp when provided', async () => {
    const fixedDate = new Date('2024-01-14T03:00:00.000Z');
    repo.getActiveStoreIds.mockResolvedValue(['store-a']);
    repo.getStockRowsForStore.mockResolvedValue([{ variantId: 'var-1', quantity: 7 }]);
    repo.bulkInsertSnapshots.mockResolvedValue(undefined);

    const result = await service.captureSnapshot({ capturedAt: fixedDate });

    expect(result.capturedAt).toEqual(fixedDate);

    // The rows passed to bulkInsert must carry the exact capturedAt
    const insertCall = repo.bulkInsertSnapshots.mock.calls[0] as [unknown[]];
    const insertedRows = insertCall[0] as Array<{ capturedAt: Date }>;
    expect(insertedRows[0]!.capturedAt).toEqual(fixedDate);
  });

  it('returns snapshotted=0 when a store has no stock rows', async () => {
    repo.getActiveStoreIds.mockResolvedValue(['store-empty']);
    repo.getStockRowsForStore.mockResolvedValue([]);
    repo.bulkInsertSnapshots.mockResolvedValue(undefined);

    const result = await service.captureSnapshot({});

    expect(result.snapshotted).toBe(0);
    // bulkInsert should still be called (with empty array or skipped gracefully)
    // — either is fine as long as snapshotted=0
  });

  it('all rows within a single batch share the same capturedAt', async () => {
    repo.getActiveStoreIds.mockResolvedValue(['store-a', 'store-b']);
    repo.getStockRowsForStore.mockResolvedValue([{ variantId: 'var-1', quantity: 1 }]);
    repo.bulkInsertSnapshots.mockResolvedValue(undefined);

    await service.captureSnapshot({});

    const calls = repo.bulkInsertSnapshots.mock.calls as Array<[Array<{ capturedAt: Date }>]>;
    const timestamps = calls.flatMap(([rows]) => rows.map((r) => r.capturedAt.toISOString()));
    const unique = new Set(timestamps);
    expect(unique.size).toBe(1);
  });
});

// ─── getNearestSnapshot ───────────────────────────────────────────────────────

describe('InventorySnapshotService.getNearestSnapshot', () => {
  let repo: MockRepo;
  let service: InventorySnapshotService;

  beforeEach(() => {
    repo = buildMockRepo();
    service = buildInventorySnapshotService({
      snapshots: repo as unknown as InventorySnapshotRepository,
    });
  });

  it('returns quantity and capturedAt when a snapshot exists at or before date', async () => {
    const snap = { quantity: 42, capturedAt: new Date('2024-01-10T03:00:00Z') };
    repo.getNearestSnapshot.mockResolvedValue(snap);

    const result = await service.getNearestSnapshot({
      storeId: 'store-a',
      variantId: 'var-1',
      at: new Date('2024-01-15T00:00:00Z'),
    });

    expect(result).toEqual(snap);
    expect(repo.getNearestSnapshot).toHaveBeenCalledWith('store-a', 'var-1', expect.any(Date));
  });

  it('returns null when no snapshot exists at or before the given date', async () => {
    repo.getNearestSnapshot.mockResolvedValue(null);

    const result = await service.getNearestSnapshot({
      storeId: 'store-a',
      variantId: 'var-1',
      at: new Date('2020-01-01T00:00:00Z'),
    });

    expect(result).toBeNull();
  });
});

// ─── getSnapshotForStoreAt ────────────────────────────────────────────────────

describe('InventorySnapshotService.getSnapshotForStoreAt', () => {
  let repo: MockRepo;
  let service: InventorySnapshotService;

  beforeEach(() => {
    repo = buildMockRepo();
    service = buildInventorySnapshotService({
      snapshots: repo as unknown as InventorySnapshotRepository,
    });
  });

  it('returns one row per variant (no duplicates across multiple captures)', async () => {
    const rows = [
      { variantId: 'var-1', quantity: 10, capturedAt: new Date('2024-01-12T03:00:00Z') },
      { variantId: 'var-2', quantity: 3, capturedAt: new Date('2024-01-12T03:00:00Z') },
    ];
    repo.getSnapshotForStoreAt.mockResolvedValue(rows);

    const result = await service.getSnapshotForStoreAt({
      storeId: 'store-a',
      at: new Date('2024-01-15T00:00:00Z'),
    });

    expect(result).toHaveLength(2);
    const variantIds = result.map((r) => r.variantId);
    expect(new Set(variantIds).size).toBe(2); // no duplicates
  });

  it('returns empty array when no snapshots exist for that store', async () => {
    repo.getSnapshotForStoreAt.mockResolvedValue([]);

    const result = await service.getSnapshotForStoreAt({
      storeId: 'store-empty',
      at: new Date(),
    });

    expect(result).toEqual([]);
  });
});
