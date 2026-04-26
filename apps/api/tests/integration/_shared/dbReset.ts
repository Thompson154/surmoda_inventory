// Shared DB-state helpers for integration tests.
//
// The integration suites share a single Postgres test DB (proyectodegrado_test).
// Without coordination, side-effects from one suite leak into the next via
// stockBySite balances, audit rows, etc. — which is the root of the historical
// "this test passes alone but fails in the full suite" flakes.
//
// Each suite calls `resetTestState({ db })` in its `beforeAll`/`afterAll`. The
// helper resets ONLY the data domains that integration tests own; seed-managed
// rows (users, stores, products, variants, stockBySite skeleton) survive.

import type { PrismaClient } from '@prisma/client';

interface ResetOptions {
  db: PrismaClient;
  /** Variants whose stockBySite quantity should be reset (typically the ones
   *  the suite mutated). Pass `'all'` to reset every row to 0. */
  resetStockFor?: 'all' | { variantIds: string[]; storeIds: string[] };
}

/**
 * Idempotent reset of mutable integration-test state.
 *
 * Order matters because of FK relations:
 *   1. children (saleItem/deliveryItem) before parents (sale/delivery)
 *   2. stockMovement (no FK from anything else)
 *   3. dailyReport (audit references it)
 *   4. auditLog scoped to entities the integration tests own
 *   5. stockBySite if asked
 */
export async function resetTestState({ db, resetStockFor }: ResetOptions): Promise<void> {
  await db.saleItem.deleteMany({});
  await db.sale.deleteMany({});
  await db.deliveryItem.deleteMany({});
  await db.delivery.deleteMany({});
  await db.dailyReport.deleteMany({});
  await db.stockMovement.deleteMany({});
  await db.storeEditPermission.deleteMany({});
  await db.auditLog.deleteMany({
    where: {
      entity: {
        in: ['Sale', 'Delivery', 'Stock', 'StoreEditPermission', 'DailyReport'],
      },
    },
  });

  if (resetStockFor === 'all') {
    await db.stockBySite.updateMany({ data: { quantity: 0 } });
  } else if (resetStockFor) {
    await db.stockBySite.updateMany({
      where: {
        variantId: { in: resetStockFor.variantIds },
        storeId: { in: resetStockFor.storeIds },
      },
      data: { quantity: 0 },
    });
  }
}
