import type { Database } from '../../infrastructure/database';

export interface StockRow {
  variantId: string;
  quantity: number;
}

export interface SnapshotInsertRow {
  storeId: string;
  variantId: string;
  quantity: number;
  capturedAt: Date;
}

export interface NearestSnapshotRow {
  quantity: number;
  capturedAt: Date;
}

export interface StoreSnapshotRow {
  variantId: string;
  quantity: number;
  capturedAt: Date;
}

export interface InventorySnapshotRepository {
  /** Returns IDs of all non-deleted, active stores. */
  getActiveStoreIds(): Promise<string[]>;

  /** Returns all stock rows (variantId, quantity) for the given store. */
  getStockRowsForStore(storeId: string): Promise<StockRow[]>;

  /**
   * Bulk-inserts snapshot rows using createMany with skipDuplicates so
   * concurrent calls don't explode on the unique constraint.
   */
  bulkInsertSnapshots(rows: SnapshotInsertRow[]): Promise<void>;

  /**
   * Returns the snapshot row whose capturedAt is closest to (≤) `at`
   * for the given (storeId, variantId). Returns null if none exists.
   */
  getNearestSnapshot(
    storeId: string,
    variantId: string,
    at: Date,
  ): Promise<NearestSnapshotRow | null>;

  /**
   * Returns one row per variant for the given store, using the most
   * recent capturedAt that is ≤ `at`. Implements the "latest batch before date"
   * semantic by fetching the MAX(capturedAt) ≤ at and then filtering rows.
   */
  getSnapshotForStoreAt(storeId: string, at: Date): Promise<StoreSnapshotRow[]>;
}

export function buildInventorySnapshotRepository(db: Database): InventorySnapshotRepository {
  return {
    async getActiveStoreIds() {
      const stores = await db.store.findMany({
        where: { isActive: true, deletedAt: null },
        select: { id: true },
      });
      return stores.map((s) => s.id);
    },

    async getStockRowsForStore(storeId) {
      const rows = await db.stockBySite.findMany({
        where: { storeId },
        select: { variantId: true, quantity: true },
      });
      return rows;
    },

    async bulkInsertSnapshots(rows) {
      if (rows.length === 0) return;
      await db.inventorySnapshot.createMany({
        data: rows,
        skipDuplicates: true,
      });
    },

    async getNearestSnapshot(storeId, variantId, at) {
      const row = await db.inventorySnapshot.findFirst({
        where: {
          storeId,
          variantId,
          capturedAt: { lte: at },
        },
        orderBy: { capturedAt: 'desc' },
        select: { quantity: true, capturedAt: true },
      });
      if (!row) return null;
      return { quantity: row.quantity, capturedAt: row.capturedAt };
    },

    async getSnapshotForStoreAt(storeId, at) {
      // Step 1: find the most recent capturedAt ≤ at for this store
      const latest = await db.inventorySnapshot.findFirst({
        where: { storeId, capturedAt: { lte: at } },
        orderBy: { capturedAt: 'desc' },
        select: { capturedAt: true },
      });
      if (!latest) return [];

      // Step 2: return all rows from that exact batch
      const rows = await db.inventorySnapshot.findMany({
        where: { storeId, capturedAt: latest.capturedAt },
        select: { variantId: true, quantity: true, capturedAt: true },
        orderBy: { variantId: 'asc' },
      });
      return rows.map((r) => ({
        variantId: r.variantId,
        quantity: r.quantity,
        capturedAt: r.capturedAt,
      }));
    },
  };
}
