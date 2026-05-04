import type {
  InventorySnapshotRepository,
  NearestSnapshotRow,
  StoreSnapshotRow,
} from './repository';

export interface InventorySnapshotServiceDeps {
  snapshots: InventorySnapshotRepository;
}

export interface CaptureSnapshotResult {
  snapshotted: number;
  capturedAt: Date;
}

export interface InventorySnapshotService {
  /**
   * Captures inventory state for a specific store, or all stores if no storeId given.
   * Returns count of variants snapshotted and the logical capture timestamp.
   * All rows in the batch share the same capturedAt (set once at call time or via override).
   */
  captureSnapshot(args: { storeId?: string; capturedAt?: Date }): Promise<CaptureSnapshotResult>;

  /**
   * Returns the snapshot closest to (but not after) a given date for a store/variant.
   * Returns null if no snapshot exists at or before that date.
   */
  getNearestSnapshot(args: {
    storeId: string;
    variantId: string;
    at: Date;
  }): Promise<NearestSnapshotRow | null>;

  /**
   * Returns all variants for a store at the most recent capture batch
   * whose capturedAt is ≤ at. One row per variant.
   */
  getSnapshotForStoreAt(args: { storeId: string; at: Date }): Promise<StoreSnapshotRow[]>;
}

export function buildInventorySnapshotService({
  snapshots,
}: InventorySnapshotServiceDeps): InventorySnapshotService {
  return {
    async captureSnapshot({ storeId, capturedAt }) {
      // All rows in this batch share the same logical timestamp
      const batchTimestamp = capturedAt ?? new Date();

      const storeIds = storeId ? [storeId] : await snapshots.getActiveStoreIds();

      let totalSnapshotted = 0;

      for (const id of storeIds) {
        const rows = await snapshots.getStockRowsForStore(id);
        if (rows.length === 0) continue;

        const insertRows = rows.map((row) => ({
          storeId: id,
          variantId: row.variantId,
          quantity: row.quantity,
          capturedAt: batchTimestamp,
        }));

        await snapshots.bulkInsertSnapshots(insertRows);
        totalSnapshotted += insertRows.length;
      }

      return { snapshotted: totalSnapshotted, capturedAt: batchTimestamp };
    },

    async getNearestSnapshot({ storeId, variantId, at }) {
      return snapshots.getNearestSnapshot(storeId, variantId, at);
    },

    async getSnapshotForStoreAt({ storeId, at }) {
      return snapshots.getSnapshotForStoreAt(storeId, at);
    },
  };
}
