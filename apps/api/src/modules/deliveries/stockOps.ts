// Stock movement primitives for the delivery lifecycle.
//
// Locked decision Q2-D (modules-11-12-14): origin stock leaves at SENT;
// destination stock arrives at RECEIVED. Holding fictitious stock at origin
// while a transfer is in transit violates the perpetual-inventory invariant
// (constitution rule #4 — Inventario Perpetuo). Splitting the movement at
// the two transitions keeps every store's StockBySite balance consistent
// with the physical reality at every moment.
//
// Layout:
//   - `applyOriginDebit`       runs at draft→sent (or born-sent on create);
//                              validates origin has enough stock; decrements
//                              by the FULL declared quantity; emits
//                              `delivery_out` movements.
//   - `applyDestinationCredit` runs at sent→received|partial (or born-received
//                              for warehouse intake); increments destination
//                              by the ACTUAL receivedQuantity per line;
//                              emits `delivery_in` movements.
//
// Both helpers receive a Prisma serializable transaction `tx` so the caller
// owns atomicity. They never start their own tx.

import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import type { DeliveryRepository, DeliveryTx } from './repository';

export interface ItemQty {
  variantId: string;
  /** Quantity to move. For origin debit this is the FULL declared qty; for
   *  destination credit this is the ACTUAL receivedQuantity. */
  quantity: number;
}

export interface OriginDebitArgs {
  fromStoreId: string;
  toStoreId: string;
  /** Items aggregated by variantId (the caller is responsible for collapsing
   *  duplicate variants). */
  items: ItemQty[];
  userId: string;
}

export interface DestinationCreditArgs {
  toStoreId: string;
  /** Origin store id when present (distribution); null for reception/intake. */
  fromStoreId: string | null;
  kind: 'reception' | 'distribution';
  items: ItemQty[];
  userId: string;
}

/**
 * Decrement origin stock by the full declared quantity. Used when a delivery
 * transitions to `sent` (or is born `sent` on create).
 *
 * Throws DELIVERY_INSUFFICIENT_STOCK if the origin balance is short for any
 * variant — caught by the controller and surfaced as 409.
 */
export async function applyOriginDebit(
  repo: DeliveryRepository,
  args: OriginDebitArgs,
  tx: DeliveryTx,
): Promise<void> {
  if (args.items.length === 0) return;

  const variantIds = args.items.map((i) => i.variantId);
  const stockMap = await repo.loadStockForVariants(args.fromStoreId, variantIds, tx);

  for (const { variantId, quantity } of args.items) {
    if (quantity <= 0) continue;
    const available = stockMap.get(variantId) ?? 0;
    if (available < quantity) {
      throw new AppError(
        409,
        ERROR_CODES.DELIVERY_INSUFFICIENT_STOCK,
        'Stock insuficiente en la sede de origen al confirmar el envío.',
        { variantId, available, requested: quantity },
      );
    }
  }

  for (const { variantId, quantity } of args.items) {
    if (quantity <= 0) continue;
    const after = await repo.decrementStock(args.fromStoreId, variantId, quantity, tx);
    await repo.createMovement(
      {
        storeId: args.fromStoreId,
        variantId,
        userId: args.userId,
        type: 'delivery_out',
        payload: { quantity, balanceAfter: after, toStoreId: args.toStoreId },
      },
      tx,
    );
  }
}

/**
 * Increment destination stock by the actual receivedQuantity. Used when a
 * delivery transitions to `received` or `partial` (and at create time for
 * reception kind). Origin debit is NOT performed here — that already
 * happened at the sent transition.
 */
export async function applyDestinationCredit(
  repo: DeliveryRepository,
  args: DestinationCreditArgs,
  tx: DeliveryTx,
): Promise<void> {
  for (const { variantId, quantity } of args.items) {
    if (quantity <= 0) continue;
    const after = await repo.incrementStock(args.toStoreId, variantId, quantity, tx);
    await repo.createMovement(
      {
        storeId: args.toStoreId,
        variantId,
        userId: args.userId,
        type: 'delivery_in',
        payload: {
          quantity,
          balanceAfter: after,
          fromStoreId: args.fromStoreId,
          kind: args.kind,
        },
      },
      tx,
    );
  }
}

/** Aggregates items by variantId. Caller-side helper used by service.ts. */
export function aggregateItems(rows: Iterable<{ variantId: string; quantity: number }>): ItemQty[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.variantId, (map.get(r.variantId) ?? 0) + r.quantity);
  }
  return Array.from(map.entries()).map(([variantId, quantity]) => ({ variantId, quantity }));
}
