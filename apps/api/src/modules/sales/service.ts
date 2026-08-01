import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import {
  assertCanActOnStore,
  assertEncargadaOrAdmin,
  assertVendedoraOrAdmin,
  type StoreScopeRepo,
} from '../../shared/auth/storeScope';
import type { SaleRepository } from './repository';
import type {
  AuthContext,
  CreateSaleDTO,
  ListSalesQuery,
  PaginatedSales,
  SalesDashboard,
  SaleWithItems,
} from './types';

export interface SaleServiceDeps {
  sales: SaleRepository;
  assignments: StoreScopeRepo;
  /** Feature 012 — when true the service refuses sale creation while
   *  Store.salesLockedAt is non-null. Default false (dark-launch). */
  dailyLockEnabled?: boolean;
}

export interface SaleService {
  create(storeId: string, input: CreateSaleDTO, auth: AuthContext): Promise<SaleWithItems>;
  list(storeId: string, query: ListSalesQuery, auth: AuthContext): Promise<PaginatedSales>;
  getById(saleId: string, auth: AuthContext): Promise<SaleWithItems>;
  getDashboard(storeId: string, auth: AuthContext): Promise<SalesDashboard>;
}

export function buildSaleService({
  sales,
  assignments,
  dailyLockEnabled = false,
}: SaleServiceDeps): SaleService {
  // WHY: read access (list/getById) allows encargada; create is vendedora-only.
  async function ensureCanReadStore(storeId: string, auth: AuthContext): Promise<void> {
    await assertCanActOnStore(
      assignments,
      storeId,
      auth,
      'STORE_FORBIDDEN',
      'No tenés acceso a esta sede.',
    );
  }

  // WHY: sales creation is vendedora-only — encargada oversees but doesn't sell.
  async function ensureCanCreateSale(storeId: string, auth: AuthContext): Promise<void> {
    await assertVendedoraOrAdmin(
      assignments,
      storeId,
      auth,
      'STORE_FORBIDDEN',
      'Solo vendedora/admin puede registrar ventas.',
    );
  }

  async function ensureEncargadaOrAdmin(_storeId: string, auth: AuthContext): Promise<void> {
    await assertEncargadaOrAdmin(
      assignments,
      auth,
      'SALE_DASHBOARD_FORBIDDEN',
      'Sólo encargada/admin puede ver el dashboard de ventas.',
    );
  }

  return {
    async create(storeId, input, auth) {
      await ensureCanCreateSale(storeId, auth);

      if (!input.items || input.items.length === 0) {
        throw new AppError(400, ERROR_CODES.SALE_EMPTY_ITEMS, 'Agregá al menos un ítem.');
      }

      // Tier 3.A.3 — idempotency. The FE sends a UUID v4 once per checkout
      // attempt. If the network drops between request-sent and response-
      // received and the FE retries, we look up the cached saleId and
      // return the EXACT SAME row instead of creating a duplicate sale.
      // The (storeId, key) uniqueness lives at the DB level too — a parallel
      // retry race ends with one INSERT winning and the loser receiving
      // P2002 on the unique violation, which we translate into the same
      // "return cached sale" path.
      if (input.idempotencyKey) {
        const cached = await sales.findIdempotentSale(storeId, input.idempotencyKey);
        if (cached) {
          const full = await sales.findById(cached.saleId);
          if (full) return full;
          // Sale was deleted (cascade from store deactivation, etc.); the
          // cached entry will be cleaned up by the retention cron — fall
          // through and let the new sale create itself.
        }
      }

      // Aggregate quantities + (optional) per-line subtotals per variantId in case the
      // FE sent duplicates. `subtotalCents` is null for that variant only when every
      // payload row for it omitted the field — in that case the BE defaults to qty*unitPrice.
      const aggregated = new Map<string, { quantity: number; subtotalCents: number | null }>();
      for (const it of input.items) {
        const prev = aggregated.get(it.variantId);
        const incomingSub = it.subtotalCents ?? null;
        if (!prev) {
          aggregated.set(it.variantId, { quantity: it.quantity, subtotalCents: incomingSub });
          continue;
        }
        const nextSub =
          prev.subtotalCents === null || incomingSub === null
            ? null
            : prev.subtotalCents + incomingSub;
        aggregated.set(it.variantId, {
          quantity: prev.quantity + it.quantity,
          subtotalCents: nextSub,
        });
      }
      const variantIds = Array.from(aggregated.keys());

      const full = await sales.runSerializable(async (tx) => {
        // Feature 012 — daily sales lock. Gated by ENABLE_DAILY_SALES_LOCK so
        // the column exists in dev/prod without enforcing the behaviour until
        // product flips the switch. Lock is applied by the dailyLock cron at
        // 22:00 Bolivia and cleared at 00:00 Bolivia.
        if (dailyLockEnabled) {
          const lockState = await sales.loadStoreLockState(storeId, tx);
          if (lockState?.salesLockedAt) {
            throw new AppError(
              423,
              ERROR_CODES.SALES_LOCKED,
              'El registro de ventas está bloqueado. Cerrá el día primero.',
              { lockedAt: lockState.salesLockedAt.toISOString() },
            );
          }
        }

        // Validate every variant exists + is active.
        const existing = await sales.variantsExistAndActive(variantIds, tx);
        const missing = variantIds.filter((id) => !existing.has(id));
        if (missing.length > 0) {
          throw new AppError(
            404,
            ERROR_CODES.SALE_VARIANT_NOT_FOUND,
            `Variante(s) no encontradas o inactivas: ${missing.join(', ')}`,
          );
        }

        // Validate stock available in this store.
        const stockMap = await sales.loadStockForVariants(storeId, variantIds, tx);
        for (const [variantId, { quantity: qty }] of aggregated.entries()) {
          const available = stockMap.get(variantId) ?? 0;
          if (available < qty) {
            throw new AppError(
              409,
              ERROR_CODES.SALE_INSUFFICIENT_STOCK,
              'Stock insuficiente en esta sede.',
              { variantId, available, requested: qty },
            );
          }
        }

        // Snapshot prices + compute final subtotal per line.
        const priceMap = await sales.loadVariantPrices(variantIds, tx);

        let totalCents = 0;
        // WHY: totalCents = undiscounted line total; subtotalCents = what was charged.
        const itemRows: Array<{
          variantId: string;
          quantity: number;
          priceAtSaleCents: number;
          totalCents: number;
          subtotalCents: number;
        }> = [];
        for (const [
          variantId,
          { quantity: qty, subtotalCents: providedSub },
        ] of aggregated.entries()) {
          const unitPrice = priceMap.get(variantId) ?? 0;
          const gross = unitPrice * qty;
          const subtotal = providedSub ?? gross;
          if (subtotal < 0) {
            throw new AppError(
              400,
              ERROR_CODES.VALIDATION_ERROR,
              'El subtotal de un ítem no puede ser negativo.',
              { variantId },
            );
          }
          // Guard against accidental over-charging: a positive markup beyond catalog
          // price is almost always a UI bug, not a real intent.
          if (subtotal > gross) {
            throw new AppError(
              400,
              ERROR_CODES.VALIDATION_ERROR,
              'El subtotal no puede superar el precio de catálogo.',
              { variantId, gross, subtotal },
            );
          }
          // WHY: 30% discount cap — subtotal must be ≥70% of undiscounted line total.
          const minAllowed = Math.ceil(0.7 * gross);
          if (subtotal < minAllowed) {
            throw new AppError(
              400,
              ERROR_CODES.SALE_DISCOUNT_EXCEEDS_LIMIT,
              'Descuento excede límite del 30%',
              { variantId, gross, subtotal, minAllowed },
            );
          }
          totalCents += subtotal;
          itemRows.push({
            variantId,
            quantity: qty,
            priceAtSaleCents: unitPrice,
            totalCents: gross,
            subtotalCents: subtotal,
          });
        }

        // Decrement stock + write sale_out movement per variant.
        for (const [variantId, { quantity: qty }] of aggregated.entries()) {
          const after = await sales.decrementStock(storeId, variantId, qty, tx);
          await sales.createMovement(
            {
              storeId,
              variantId,
              userId: auth.userId,
              payload: { quantity: qty, balanceAfter: after, paymentMethod: input.paymentMethod },
            },
            tx,
          );
        }

        const created = await sales.createSale(
          {
            storeId,
            recordedByUserId: auth.userId,
            paymentMethod: input.paymentMethod,
            totalCents,
          },
          itemRows,
          tx,
        );

        // Persist the idempotency mapping inside the same transaction so the
        // sale + its key land atomically. The DB unique index (storeId,key)
        // is the final defense against parallel retries — a concurrent
        // request that races past the early-return check ends up here, and
        // the second INSERT raises P2002 which the controller converts to
        // a 409 (the FE retries idempotently anyway).
        if (input.idempotencyKey) {
          await sales.recordIdempotencyKey(storeId, input.idempotencyKey, created.id, tx);
        }

        return sales.findSale(created.id, tx);
      });

      if (!full) {
        throw new AppError(500, ERROR_CODES.INTERNAL_ERROR, 'No se pudo recuperar la venta.');
      }
      return full;
    },

    async list(storeId, query, auth) {
      await ensureCanReadStore(storeId, auth);
      return sales.list(storeId, query);
    },

    async getById(saleId, auth) {
      const sale = await sales.findSale(saleId);
      if (!sale) throw new AppError(404, ERROR_CODES.SALE_NOT_FOUND, 'Venta no encontrada.');
      await ensureCanReadStore(sale.storeId, auth);
      return sale;
    },

    async getDashboard(storeId, auth) {
      await ensureEncargadaOrAdmin(storeId, auth);
      return sales.buildDashboard(storeId, new Date());
    },
  };
}
