import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import {
  assertCanActOnStore,
  assertEncargadaOrAdmin,
  type StoreScopeRepo,
} from '../../shared/auth/storeScope';
import type { DeliveryRepository } from './repository';
import type {
  AuthContext,
  CreateDeliveryDTO,
  DeliveryWithItems,
  ListDeliveriesQuery,
  PaginatedDeliveries,
  PaginatedDeliveryGroups,
} from './types';

interface StoreLookup {
  findById(id: string): Promise<{ id: string; kind: 'warehouse' | 'branch' } | null>;
}

export interface DeliveryServiceDeps {
  deliveries: DeliveryRepository;
  stores: StoreLookup;
  assignments: StoreScopeRepo;
}

export interface DeliveryService {
  create(toStoreId: string, input: CreateDeliveryDTO, auth: AuthContext): Promise<DeliveryWithItems>;
  list(storeId: string, query: ListDeliveriesQuery, auth: AuthContext): Promise<PaginatedDeliveries>;
  listGrouped(
    storeId: string,
    query: ListDeliveriesQuery,
    auth: AuthContext,
  ): Promise<PaginatedDeliveryGroups>;
  getById(deliveryId: string, auth: AuthContext): Promise<DeliveryWithItems>;
}

export function buildDeliveryService({
  deliveries,
  stores,
  assignments,
}: DeliveryServiceDeps): DeliveryService {
  async function ensureCanReadStore(storeId: string, auth: AuthContext): Promise<void> {
    await assertCanActOnStore(
      assignments,
      storeId,
      auth,
      'STORE_FORBIDDEN',
      'No tenés acceso a esta sede.',
    );
  }

  async function ensureCanWriteStore(_storeId: string, auth: AuthContext): Promise<void> {
    // Regla locked #10: vendedora cannot create deliveries.
    await assertEncargadaOrAdmin(
      assignments,
      auth,
      'DELIVERY_FORBIDDEN',
      'Sólo encargada/admin puede crear entregas.',
    );
  }

  return {
    async create(toStoreId, input, auth) {
      await ensureCanWriteStore(toStoreId, auth);

      if (!input.items || input.items.length === 0) {
        throw new AppError(400, ERROR_CODES.DELIVERY_EMPTY_ITEMS, 'Agregá al menos un ítem.');
      }

      const toStore = await stores.findById(toStoreId);
      if (!toStore) throw new AppError(404, ERROR_CODES.STORE_NOT_FOUND, 'Sede destino no encontrada.');

      // Aggregate quantities per variantId in case the FE sent duplicates.
      const aggregated = new Map<string, number>();
      for (const it of input.items) {
        aggregated.set(it.variantId, (aggregated.get(it.variantId) ?? 0) + it.quantity);
      }
      const variantIds = Array.from(aggregated.keys());

      const deliveryId = await deliveries.runSerializable(async (tx) => {
        const existing = await deliveries.variantsExistAndActive(variantIds, tx);
        const missing = variantIds.filter((id) => !existing.has(id));
        if (missing.length > 0) {
          throw new AppError(
            404,
            ERROR_CODES.DELIVERY_VARIANT_NOT_FOUND,
            `Variante(s) no encontradas o inactivas: ${missing.join(', ')}`,
          );
        }

        const isReception = toStore.kind === 'warehouse';
        let fromStoreId: string | null = null;

        if (!isReception) {
          // Distribution: source is the unique active warehouse.
          const wh = await deliveries.findActiveWarehouse(tx);
          if (!wh) {
            throw new AppError(
              409,
              ERROR_CODES.DELIVERY_NO_WAREHOUSE,
              'No hay un almacén activo configurado.',
            );
          }
          fromStoreId = wh.id;

          // Validate stock available in warehouse for every aggregated item.
          const stockMap = await deliveries.loadStockForVariants(
            fromStoreId,
            variantIds,
            tx,
          );
          for (const [variantId, qty] of aggregated.entries()) {
            const available = stockMap.get(variantId) ?? 0;
            if (available < qty) {
              throw new AppError(
                409,
                ERROR_CODES.DELIVERY_INSUFFICIENT_STOCK,
                'Stock insuficiente en el almacén.',
                { variantId, available, requested: qty },
              );
            }
          }

          // Decrement warehouse + write delivery_out movement per variant.
          for (const [variantId, qty] of aggregated.entries()) {
            const after = await deliveries.decrementStock(fromStoreId, variantId, qty, tx);
            await deliveries.createMovement(
              {
                storeId: fromStoreId,
                variantId,
                userId: auth.userId,
                type: 'delivery_out',
                payload: { quantity: qty, balanceAfter: after, toStoreId },
              },
              tx,
            );
          }
        }

        // Increment destination + write delivery_in per variant.
        for (const [variantId, qty] of aggregated.entries()) {
          const after = await deliveries.incrementStock(toStoreId, variantId, qty, tx);
          await deliveries.createMovement(
            {
              storeId: toStoreId,
              variantId,
              userId: auth.userId,
              type: 'delivery_in',
              payload: {
                quantity: qty,
                balanceAfter: after,
                fromStoreId,
                kind: isReception ? 'reception' : 'distribution',
              },
            },
            tx,
          );
        }

        const createdItems = Array.from(aggregated.entries()).map(([variantId, quantity]) => ({
          variantId,
          quantity,
        }));

        const created = await deliveries.createDelivery(
          {
            kind: isReception ? 'reception' : 'distribution',
            fromStoreId,
            toStoreId,
            createdByUserId: auth.userId,
            note: input.note ?? null,
          },
          createdItems,
          tx,
        );

        return created.id;
      });

      const full = await deliveries.findDelivery(deliveryId);
      if (!full) throw new AppError(500, ERROR_CODES.INTERNAL_ERROR, 'Delivery no se pudo recuperar.');
      return full;
    },

    async list(storeId, query, auth) {
      await ensureCanReadStore(storeId, auth);
      return deliveries.list(storeId, query);
    },

    async listGrouped(storeId, query, auth) {
      await ensureCanReadStore(storeId, auth);
      return deliveries.listGroupedByProduct(storeId, query);
    },

    async getById(deliveryId, auth) {
      const delivery = await deliveries.findDelivery(deliveryId);
      if (!delivery) throw new AppError(404, ERROR_CODES.DELIVERY_NOT_FOUND, 'Entrega no encontrada.');
      await ensureCanReadStore(delivery.toStoreId, auth);
      return delivery;
    },
  };
}
