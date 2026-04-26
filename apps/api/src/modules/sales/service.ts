import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import type { SaleRepository } from './repository';
import type {
  AuthContext,
  CreateSaleDTO,
  ListSalesQuery,
  PaginatedSales,
  SalesDashboard,
  SaleWithItems,
} from './types';

interface AssignmentScope {
  findActiveAssignment(userId: string, storeId: string): Promise<{ role: 'encargada' | 'vendedora' } | null>;
  hasAnyEncargadaRole(userId: string): Promise<boolean>;
}

export interface SaleServiceDeps {
  sales: SaleRepository;
  assignments: AssignmentScope;
}

export interface SaleService {
  create(storeId: string, input: CreateSaleDTO, auth: AuthContext): Promise<SaleWithItems>;
  list(storeId: string, query: ListSalesQuery, auth: AuthContext): Promise<PaginatedSales>;
  getById(saleId: string, auth: AuthContext): Promise<SaleWithItems>;
  getDashboard(storeId: string, auth: AuthContext): Promise<SalesDashboard>;
}

export function buildSaleService({ sales, assignments }: SaleServiceDeps): SaleService {
  async function ensureAssignedOrEncargada(storeId: string, auth: AuthContext): Promise<void> {
    if (auth.isAdmin) return;
    if (await assignments.hasAnyEncargadaRole(auth.userId)) return;
    const a = await assignments.findActiveAssignment(auth.userId, storeId);
    if (!a) throw new AppError(404, ERROR_CODES.STOCK_NOT_FOUND, 'Sede no encontrada.');
  }

  async function ensureEncargadaOrAdmin(storeId: string, auth: AuthContext): Promise<void> {
    if (auth.isAdmin) return;
    if (await assignments.hasAnyEncargadaRole(auth.userId)) return;
    // Vendedora can create + read sales but cannot see the dashboard aggregates.
    void storeId;
    throw new AppError(
      403,
      ERROR_CODES.SALE_DASHBOARD_FORBIDDEN,
      'Sólo encargada/admin puede ver el dashboard de ventas.',
    );
  }

  return {
    async create(storeId, input, auth) {
      await ensureAssignedOrEncargada(storeId, auth);

      if (!input.items || input.items.length === 0) {
        throw new AppError(400, ERROR_CODES.SALE_EMPTY_ITEMS, 'Agregá al menos un ítem.');
      }

      // Aggregate quantities per variantId in case the FE sent duplicates.
      const aggregated = new Map<string, number>();
      for (const it of input.items) {
        aggregated.set(it.variantId, (aggregated.get(it.variantId) ?? 0) + it.quantity);
      }
      const variantIds = Array.from(aggregated.keys());

      const saleId = await sales.runSerializable(async (tx) => {
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
        for (const [variantId, qty] of aggregated.entries()) {
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

        // Snapshot prices.
        const priceMap = await sales.loadVariantPrices(variantIds, tx);

        let totalCents = 0;
        const itemRows = [] as Array<{ variantId: string; quantity: number; priceAtSaleCents: number }>;
        for (const [variantId, qty] of aggregated.entries()) {
          const unitPrice = priceMap.get(variantId) ?? 0;
          totalCents += unitPrice * qty;
          itemRows.push({ variantId, quantity: qty, priceAtSaleCents: unitPrice });
        }

        // Decrement stock + write sale_out movement per variant.
        for (const [variantId, qty] of aggregated.entries()) {
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

        return created.id;
      });

      const full = await sales.findSale(saleId);
      if (!full) {
        throw new AppError(500, ERROR_CODES.INTERNAL_ERROR, 'No se pudo recuperar la venta.');
      }
      return full;
    },

    async list(storeId, query, auth) {
      await ensureAssignedOrEncargada(storeId, auth);
      return sales.list(storeId, query);
    },

    async getById(saleId, auth) {
      const sale = await sales.findSale(saleId);
      if (!sale) throw new AppError(404, ERROR_CODES.SALE_NOT_FOUND, 'Venta no encontrada.');
      await ensureAssignedOrEncargada(sale.storeId, auth);
      return sale;
    },

    async getDashboard(storeId, auth) {
      await ensureEncargadaOrAdmin(storeId, auth);
      return sales.buildDashboard(storeId, new Date());
    },
  };
}
