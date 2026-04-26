// Delivery service.
//
// Lifecycle (distribution kind):
//   create(asDraft=true)  → status='draft', no stock change
//   create(asDraft=false) → status='sent', no stock change
//   updateDraft           → only mutates header + items while in draft
//   confirmDraft          → draft → sent
//   receive               → sent → received|partial; applies stock now
//
// Reception kind (warehouse intake from supplier) skips draft/sent and goes
// straight to `received` at create-time, applying stock then. That's the
// historical behaviour and matches how the operator already uses the screen.

import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import {
  assertCanActOnStore,
  assertEncargadaOrAdmin,
  type StoreScopeRepo,
} from '../../shared/auth/storeScope';
import type { DeliveryRepository, DeliveryTx } from './repository';
import type { ProductRepository } from '../products/repository.product';
import type { VariantRepository } from '../products/repository.variant';
import { generateBarcode } from '../products/barcode';
import {
  ALLOWED_MIME_TYPES,
  MAX_IMAGE_BYTES,
  extensionFromMime,
  type ImageMimeType,
  type ImageStorage,
} from '../products/imageStorage/types';
import type {
  WarehouseIntakeLookupResponse,
  WarehouseIntakePayload,
} from '@surmoda/contracts';
import type {
  AuthContext,
  ConfirmDraftDTO,
  CreateDeliveryDTO,
  DeliveryStatus,
  DeliveryWithItems,
  ListDeliveriesQuery,
  PaginatedDeliveries,
  PaginatedDeliveryGroups,
  ReceiveDeliveryDTO,
  UpdateDraftDeliveryDTO,
} from './types';

interface StoreLookup {
  findById(id: string): Promise<{ id: string; kind: 'warehouse' | 'branch' } | null>;
}

export interface DeliveryServiceDeps {
  deliveries: DeliveryRepository;
  stores: StoreLookup;
  assignments: StoreScopeRepo;
  /** Optional — only required for the warehouse-intake endpoints. */
  products?: ProductRepository;
  variants?: VariantRepository;
  imageStorage?: ImageStorage;
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
  updateDraft(deliveryId: string, input: UpdateDraftDeliveryDTO, auth: AuthContext): Promise<DeliveryWithItems>;
  confirmDraft(deliveryId: string, input: ConfirmDraftDTO, auth: AuthContext): Promise<DeliveryWithItems>;
  receive(deliveryId: string, input: ReceiveDeliveryDTO, auth: AuthContext): Promise<DeliveryWithItems>;
  intakeLookup(warehouseId: string, productCode: string, auth: AuthContext): Promise<WarehouseIntakeLookupResponse>;
  intake(warehouseId: string, input: WarehouseIntakePayload, auth: AuthContext): Promise<DeliveryWithItems>;
}

export function buildDeliveryService({
  deliveries,
  stores,
  assignments,
  products,
  variants,
  imageStorage,
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

  /**
   * Aggregate items by variantId. Validate every variant exists. Returns a
   * Map<variantId, qty> ready to be persisted.
   */
  async function aggregateAndValidateItems(
    items: Array<{ variantId: string; quantity: number }>,
    tx: DeliveryTx,
  ): Promise<Map<string, number>> {
    const agg = new Map<string, number>();
    for (const it of items) {
      agg.set(it.variantId, (agg.get(it.variantId) ?? 0) + it.quantity);
    }
    const variantIds = Array.from(agg.keys());
    const existing = await deliveries.variantsExistAndActive(variantIds, tx);
    const missing = variantIds.filter((id) => !existing.has(id));
    if (missing.length > 0) {
      throw new AppError(
        404,
        ERROR_CODES.DELIVERY_VARIANT_NOT_FOUND,
        `Variante(s) no encontradas o inactivas: ${missing.join(', ')}`,
      );
    }
    return agg;
  }

  /**
   * Apply stock for a delivery: decrement source warehouse + increment destination,
   * emit movement rows. Used when a delivery transitions to received|partial,
   * and also for reception-kind deliveries at creation time.
   *
   * `quantitiesByItem` is the map of receivedQuantity per delivery line.
   */
  async function applyStockForReception(
    args: {
      kind: 'reception' | 'distribution';
      fromStoreId: string | null;
      toStoreId: string;
      quantitiesByItem: Map<string, { variantId: string; receivedQuantity: number }>;
      userId: string;
    },
    tx: DeliveryTx,
  ): Promise<void> {
    const aggregated = new Map<string, number>();
    for (const { variantId, receivedQuantity } of args.quantitiesByItem.values()) {
      aggregated.set(variantId, (aggregated.get(variantId) ?? 0) + receivedQuantity);
    }

    if (args.kind === 'distribution') {
      if (!args.fromStoreId) {
        throw new AppError(500, ERROR_CODES.INTERNAL_ERROR, 'Distribución sin sede de origen.');
      }
      // Re-check stock at receive time — between draft and reception inventory
      // could have moved (other deliveries, manual adjustments).
      const stockMap = await deliveries.loadStockForVariants(
        args.fromStoreId,
        Array.from(aggregated.keys()),
        tx,
      );
      for (const [variantId, qty] of aggregated.entries()) {
        if (qty <= 0) continue;
        const available = stockMap.get(variantId) ?? 0;
        if (available < qty) {
          throw new AppError(
            409,
            ERROR_CODES.DELIVERY_INSUFFICIENT_STOCK,
            'Stock insuficiente en el almacén al confirmar la recepción.',
            { variantId, available, requested: qty },
          );
        }
      }
      for (const [variantId, qty] of aggregated.entries()) {
        if (qty <= 0) continue;
        const after = await deliveries.decrementStock(args.fromStoreId, variantId, qty, tx);
        await deliveries.createMovement(
          {
            storeId: args.fromStoreId,
            variantId,
            userId: args.userId,
            type: 'delivery_out',
            payload: { quantity: qty, balanceAfter: after, toStoreId: args.toStoreId },
          },
          tx,
        );
      }
    }

    for (const [variantId, qty] of aggregated.entries()) {
      if (qty <= 0) continue;
      const after = await deliveries.incrementStock(args.toStoreId, variantId, qty, tx);
      await deliveries.createMovement(
        {
          storeId: args.toStoreId,
          variantId,
          userId: args.userId,
          type: 'delivery_in',
          payload: {
            quantity: qty,
            balanceAfter: after,
            fromStoreId: args.fromStoreId,
            kind: args.kind,
          },
        },
        tx,
      );
    }
  }

  function assertDistributionTransition(current: DeliveryStatus, target: DeliveryStatus): void {
    const allowed: Record<DeliveryStatus, DeliveryStatus[]> = {
      draft: ['sent'],
      sent: ['received', 'partial'],
      received: [],
      partial: [],
    };
    if (!allowed[current].includes(target)) {
      throw new AppError(
        409,
        ERROR_CODES.DELIVERY_INVALID_STATE,
        `No se puede pasar de ${current} a ${target}.`,
      );
    }
  }

  return {
    async create(toStoreId, input, auth) {
      await ensureCanWriteStore(toStoreId, auth);

      if (!input.items || input.items.length === 0) {
        throw new AppError(400, ERROR_CODES.DELIVERY_EMPTY_ITEMS, 'Agregá al menos un ítem.');
      }

      const toStore = await stores.findById(toStoreId);
      if (!toStore) {
        throw new AppError(404, ERROR_CODES.STORE_NOT_FOUND, 'Sede destino no encontrada.');
      }

      const isReception = toStore.kind === 'warehouse';
      const startAsDraft = !isReception && Boolean(input.asDraft);
      const targetStatus: DeliveryStatus = isReception
        ? 'received'
        : startAsDraft
          ? 'draft'
          : 'sent';
      // Title is optional everywhere — UI flows recommend it but legacy callers
      // and reception kind can omit it. The mandatory check fires only when an
      // explicit confirm-draft transition is requested without one set.

      const deliveryId = await deliveries.runSerializable(async (tx) => {
        const aggregated = await aggregateAndValidateItems(input.items, tx);

        // Resolve origin (`fromStoreId`):
        //   - reception (intake): no origin, stock is born at the warehouse.
        //   - distribution from explicit origin (module 11 — lateral / return):
        //       caller passed `input.fromStoreId`. Validate it exists and the
        //       actor can write to it (encargada-of-origin or admin per Q1=A).
        //   - distribution legacy (warehouse → branch): caller omitted
        //       `fromStoreId`; we resolve it from the active warehouse.
        let fromStoreId: string | null = null;
        if (!isReception) {
          if (input.fromStoreId) {
            const fromStore = await stores.findById(input.fromStoreId);
            if (!fromStore) {
              throw new AppError(
                404,
                ERROR_CODES.STORE_NOT_FOUND,
                'Sede de origen no encontrada.',
              );
            }
            if (fromStore.id === toStoreId) {
              throw new AppError(
                400,
                ERROR_CODES.VALIDATION_ERROR,
                'La sede de origen no puede ser la misma que la destino.',
              );
            }
            // Encargada-of-origin (or admin) authorizes per locked decision Q1=A.
            await assertCanActOnStore(
              assignments,
              fromStore.id,
              auth,
              'DELIVERY_FORBIDDEN',
              'Sólo la encargada de la sede de origen puede iniciar la transferencia.',
            );
            fromStoreId = fromStore.id;
          } else {
            const wh = await deliveries.findActiveWarehouse(tx);
            if (!wh) {
              throw new AppError(
                409,
                ERROR_CODES.DELIVERY_NO_WAREHOUSE,
                'No hay un almacén activo configurado.',
              );
            }
            fromStoreId = wh.id;
          }
        }

        const created = await deliveries.createDelivery(
          {
            kind: isReception ? 'reception' : 'distribution',
            status: targetStatus,
            title: input.title ?? null,
            fromStoreId,
            toStoreId,
            createdByUserId: auth.userId,
            note: input.note ?? null,
            receivedAtNow: targetStatus === 'received',
          },
          Array.from(aggregated.entries()).map(([variantId, quantity]) => ({
            variantId,
            quantity,
          })),
          tx,
        );

        // Stock is applied only when the delivery is born `received` (legacy
        // reception flow). Draft + sent leave stock untouched until reception.
        if (targetStatus === 'received') {
          // Reload items so we have the freshly-generated DeliveryItem ids.
          const fresh = await deliveries.loadForUpdate(created.id, tx);
          if (!fresh) throw new AppError(500, ERROR_CODES.INTERNAL_ERROR, 'Entrega recién creada no se pudo recuperar.');
          const qtyMap = new Map(
            fresh.items.map((i) => [i.id, { variantId: i.variantId, receivedQuantity: i.quantity }]),
          );
          await applyStockForReception(
            {
              kind: isReception ? 'reception' : 'distribution',
              fromStoreId,
              toStoreId,
              quantitiesByItem: qtyMap,
              userId: auth.userId,
            },
            tx,
          );
        }

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

    async updateDraft(deliveryId, input, auth) {
      const updated = await deliveries.runSerializable(async (tx) => {
        const current = await deliveries.loadForUpdate(deliveryId, tx);
        if (!current) {
          throw new AppError(404, ERROR_CODES.DELIVERY_NOT_FOUND, 'Entrega no encontrada.');
        }
        if (current.status !== 'draft') {
          throw new AppError(
            409,
            ERROR_CODES.DELIVERY_INVALID_STATE,
            'Sólo se pueden editar entregas en borrador.',
          );
        }
        // Only the encargada/admin who can write to the destination can edit.
        await ensureCanWriteStore(current.toStoreId, auth);

        const headerPatch: { title?: string | null; note?: string | null } = {};
        if (input.title !== undefined) headerPatch.title = input.title;
        if (input.note !== undefined) headerPatch.note = input.note;
        if (Object.keys(headerPatch).length > 0) {
          await deliveries.updateDraftHeader(deliveryId, headerPatch, tx);
        }

        if (input.items) {
          const aggregated = await aggregateAndValidateItems(input.items, tx);
          await deliveries.replaceDraftItems(
            deliveryId,
            Array.from(aggregated.entries()).map(([variantId, quantity]) => ({
              variantId,
              quantity,
            })),
            tx,
          );
        }
        return deliveryId;
      });
      const full = await deliveries.findDelivery(updated);
      if (!full) throw new AppError(500, ERROR_CODES.INTERNAL_ERROR, 'Delivery no se pudo recuperar.');
      return full;
    },

    async confirmDraft(deliveryId, input, auth) {
      const id = await deliveries.runSerializable(async (tx) => {
        const current = await deliveries.loadForUpdate(deliveryId, tx);
        if (!current) {
          throw new AppError(404, ERROR_CODES.DELIVERY_NOT_FOUND, 'Entrega no encontrada.');
        }
        await ensureCanWriteStore(current.toStoreId, auth);
        assertDistributionTransition(current.status, 'sent');

        // Title becomes mandatory at confirm time.
        const finalTitle = input.title?.trim() || current.title?.trim() || '';
        if (!finalTitle) {
          throw new AppError(
            400,
            ERROR_CODES.VALIDATION_ERROR,
            'El título de la entrega es requerido al confirmarla.',
          );
        }
        if (input.title && input.title !== current.title) {
          await deliveries.updateDraftHeader(deliveryId, { title: finalTitle }, tx);
        }
        await deliveries.setStatus(deliveryId, 'sent', { sentAt: new Date() }, null, tx);
        return deliveryId;
      });
      const full = await deliveries.findDelivery(id);
      if (!full) throw new AppError(500, ERROR_CODES.INTERNAL_ERROR, 'Delivery no se pudo recuperar.');
      return full;
    },

    async receive(deliveryId, input, auth) {
      const id = await deliveries.runSerializable(async (tx) => {
        const current = await deliveries.loadForUpdate(deliveryId, tx);
        if (!current) {
          throw new AppError(404, ERROR_CODES.DELIVERY_NOT_FOUND, 'Entrega no encontrada.');
        }
        // Vendedora assigned to the destination store (or admin/encargada-anywhere).
        await ensureCanReadStore(current.toStoreId, auth);
        if (current.status !== 'sent') {
          throw new AppError(
            409,
            ERROR_CODES.DELIVERY_INVALID_STATE,
            'Sólo se pueden recibir entregas enviadas.',
          );
        }

        // Map payload by deliveryItemId for fast lookup.
        const payloadById = new Map(
          input.items.map((it) => [
            it.deliveryItemId,
            { receivedQuantity: it.receivedQuantity, reason: it.reason ?? null },
          ]),
        );

        // Every line must be acknowledged (even if unchanged) so the user can't
        // partially-confirm a delivery and forget lines.
        const expectedIds = new Set(current.items.map((i) => i.id));
        for (const id of payloadById.keys()) {
          if (!expectedIds.has(id)) {
            throw new AppError(
              400,
              ERROR_CODES.VALIDATION_ERROR,
              `Línea no pertenece a la entrega: ${id}`,
            );
          }
        }
        const missing = current.items.filter((i) => !payloadById.has(i.id));
        if (missing.length > 0) {
          throw new AppError(
            400,
            ERROR_CODES.VALIDATION_ERROR,
            'Falta confirmar todas las líneas de la entrega.',
          );
        }

        const adjustments: Array<{
          deliveryItemId: string;
          expectedQty: number;
          actualQty: number;
          reason: string | null;
          adjustedByUserId: string;
        }> = [];
        const qtyMap = new Map<string, { variantId: string; receivedQuantity: number }>();
        let isPartial = false;

        for (const item of current.items) {
          const p = payloadById.get(item.id)!;
          const actual = p.receivedQuantity;
          if (actual > item.quantity) {
            // Vendedoras cannot inflate; that would require an admin manual adjust.
            throw new AppError(
              400,
              ERROR_CODES.VALIDATION_ERROR,
              'La cantidad recibida no puede superar la cantidad enviada.',
              { deliveryItemId: item.id, sent: item.quantity, received: actual },
            );
          }
          await deliveries.setReceivedQuantity(item.id, actual, tx);
          qtyMap.set(item.id, { variantId: item.variantId, receivedQuantity: actual });
          if (actual !== item.quantity) {
            isPartial = true;
            adjustments.push({
              deliveryItemId: item.id,
              expectedQty: item.quantity,
              actualQty: actual,
              reason: p.reason,
              adjustedByUserId: auth.userId,
            });
            await deliveries.createMovement(
              {
                storeId: current.toStoreId,
                variantId: item.variantId,
                userId: auth.userId,
                type: 'delivery_received_adjusted',
                payload: {
                  deliveryId,
                  deliveryItemId: item.id,
                  expectedQty: item.quantity,
                  actualQty: actual,
                  reason: p.reason,
                },
              },
              tx,
            );
          }
        }

        await deliveries.recordAdjustments(deliveryId, adjustments, tx);

        await applyStockForReception(
          {
            kind: current.kind,
            fromStoreId: current.fromStoreId,
            toStoreId: current.toStoreId,
            quantitiesByItem: qtyMap,
            userId: auth.userId,
          },
          tx,
        );

        const finalStatus: DeliveryStatus = isPartial ? 'partial' : 'received';
        await deliveries.setStatus(
          deliveryId,
          finalStatus,
          { receivedAt: new Date() },
          auth.userId,
          tx,
        );

        return deliveryId;
      });
      const full = await deliveries.findDelivery(id);
      if (!full) throw new AppError(500, ERROR_CODES.INTERNAL_ERROR, 'Delivery no se pudo recuperar.');
      return full;
    },

    async intakeLookup(warehouseId, productCode, auth) {
      // Both endpoints (lookup + intake) are warehouse-only and require
      // encargada/admin. Vendedoras don't intake from supplier.
      await ensureCanWriteStore(warehouseId, auth);
      const store = await stores.findById(warehouseId);
      if (!store) throw new AppError(404, ERROR_CODES.STORE_NOT_FOUND, 'Sede no encontrada.');
      if (store.kind !== 'warehouse') {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Lookup sólo aplica al almacén.');
      }
      if (!products || !variants) {
        throw new AppError(500, ERROR_CODES.INTERNAL_ERROR, 'Intake deps not wired.');
      }

      const product = await products.findByCode(productCode);
      if (!product) {
        return {
          exists: false,
          productId: null,
          productCode,
          productName: null,
          variants: [],
        };
      }

      // Pull variants + their warehouse stock in one query for the FE table.
      const stockRows = await deliveries.runSerializable(async (tx) => {
        return tx.stockBySite.findMany({
          where: {
            storeId: warehouseId,
            variant: {
              productId: product.id,
              deletedAt: null,
              isActive: true,
            },
          },
          include: { variant: true },
        });
      });

      return {
        exists: true,
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        variants: stockRows.map((r) => ({
          variantId: r.variantId,
          size: r.variant.size as WarehouseIntakeLookupResponse['variants'][number]['size'],
          color: r.variant.color,
          priceCents: r.variant.priceCents,
          warehouseQuantity: r.quantity,
          imagePath: r.variant.imagePath,
        })),
      };
    },

    async intake(warehouseId, input, auth) {
      await ensureCanWriteStore(warehouseId, auth);
      const store = await stores.findById(warehouseId);
      if (!store) throw new AppError(404, ERROR_CODES.STORE_NOT_FOUND, 'Sede no encontrada.');
      if (store.kind !== 'warehouse') {
        throw new AppError(
          400,
          ERROR_CODES.VALIDATION_ERROR,
          'La toma de mercadería sólo aplica al almacén.',
        );
      }
      if (!products || !variants || !imageStorage) {
        throw new AppError(500, ERROR_CODES.INTERNAL_ERROR, 'Intake deps not wired.');
      }

      // Reject duplicates within the same submission (same size+color twice).
      const seen = new Set<string>();
      for (const v of input.variants) {
        const key = `${v.size}|${v.color.trim().toLowerCase()}`;
        if (seen.has(key)) {
          throw new AppError(
            400,
            ERROR_CODES.VALIDATION_ERROR,
            `Variante duplicada en el formulario: ${v.size} · ${v.color}`,
          );
        }
        seen.add(key);
      }

      // Decode + validate images BEFORE the transaction (cheap fail-fast).
      type PreparedImage = { buffer: Buffer; mimetype: ImageMimeType };
      const imagesByIndex = new Map<number, PreparedImage>();
      for (let i = 0; i < input.variants.length; i += 1) {
        const v = input.variants[i]!;
        if (!v.imageBase64) continue;
        const match = /^data:(image\/\w+);base64,(.*)$/.exec(v.imageBase64);
        if (!match) {
          throw new AppError(
            400,
            ERROR_CODES.VARIANT_IMAGE_INVALID_TYPE,
            `Imagen ${i + 1}: formato inválido (esperado data URL base64).`,
          );
        }
        const mime = match[1] as ImageMimeType;
        if (!ALLOWED_MIME_TYPES.has(mime)) {
          throw new AppError(
            400,
            ERROR_CODES.VARIANT_IMAGE_INVALID_TYPE,
            `Imagen ${i + 1}: formato no soportado.`,
          );
        }
        const buf = Buffer.from(match[2]!, 'base64');
        if (buf.byteLength > MAX_IMAGE_BYTES) {
          throw new AppError(
            400,
            ERROR_CODES.VARIANT_IMAGE_TOO_LARGE,
            `Imagen ${i + 1}: supera ${MAX_IMAGE_BYTES} bytes.`,
          );
        }
        imagesByIndex.set(i, { buffer: buf, mimetype: mime });
      }

      const deliveryId = await deliveries.runSerializable(async (tx) => {
        // 1. Upsert product. If new, create with provided name + description.
        //    If existing and a productDescription was sent, update it (encargada
        //    can refine the description on each intake).
        let product = await products.findByCode(input.productCode, tx);
        const desc = input.productDescription?.trim() || null;
        if (!product) {
          product = await products.create(
            {
              code: input.productCode,
              name: (input.productName?.trim() || input.productCode),
              description: desc,
            },
            tx,
          );
        } else if (desc !== null && desc !== product.description) {
          await tx.product.update({
            where: { id: product.id },
            data: { description: desc },
          });
        }

        // 2. For each payload variant: find or create. Resolve final priceCents
        //    + imagePath (preserving existing values per the product decision).
        type ResolvedLine = { variantId: string; quantity: number };
        const lines: ResolvedLine[] = [];
        for (let i = 0; i < input.variants.length; i += 1) {
          const v = input.variants[i]!;
          const existing = await variants.findActiveByTuple(
            product.id,
            v.size,
            v.color,
            tx,
          );

          let variantId: string;
          if (existing) {
            // Reposición: keep DB price; only set image if currently null and
            // the operator provided one in this intake.
            if (!existing.imagePath && imagesByIndex.has(i)) {
              const img = imagesByIndex.get(i)!;
              const path = await imageStorage.save(
                {
                  buffer: img.buffer,
                  mimetype: img.mimetype,
                  originalName: `intake.${extensionFromMime(img.mimetype)}`,
                },
                { productCode: product.code, size: v.size, color: v.color },
              );
              await tx.variant.update({
                where: { id: existing.id },
                data: { imagePath: path },
              });
            }
            variantId = existing.id;
          } else {
            // Nueva variante. Use provided price + (optional) image.
            let imagePath: string | null = null;
            if (imagesByIndex.has(i)) {
              const img = imagesByIndex.get(i)!;
              imagePath = await imageStorage.save(
                {
                  buffer: img.buffer,
                  mimetype: img.mimetype,
                  originalName: `intake.${extensionFromMime(img.mimetype)}`,
                },
                { productCode: product.code, size: v.size, color: v.color },
              );
            }
            const created = await variants.create(
              {
                productId: product.id,
                size: v.size,
                color: v.color,
                barcode: generateBarcode(product.code, v.size, v.color),
                priceCents: v.priceCents,
                imagePath,
              },
              tx,
            );
            variantId = created.id;
          }
          lines.push({ variantId, quantity: v.quantity });
        }

        // 3. Aggregate any duplicates the form snuck through (defensive — the
        //    pre-check should have caught them).
        const aggregated = new Map<string, number>();
        for (const l of lines) {
          aggregated.set(l.variantId, (aggregated.get(l.variantId) ?? 0) + l.quantity);
        }

        // 4. Create the reception delivery in `received` state — applies stock.
        const created = await deliveries.createDelivery(
          {
            kind: 'reception',
            status: 'received',
            title: input.title ?? null,
            fromStoreId: null,
            toStoreId: warehouseId,
            createdByUserId: auth.userId,
            note: input.note ?? null,
            receivedAtNow: true,
          },
          Array.from(aggregated.entries()).map(([variantId, quantity]) => ({
            variantId,
            quantity,
          })),
          tx,
        );

        // 5. Apply stock + write delivery_in movements (kind=reception).
        const fresh = await deliveries.loadForUpdate(created.id, tx);
        if (!fresh) {
          throw new AppError(500, ERROR_CODES.INTERNAL_ERROR, 'Entrega recién creada no se pudo recuperar.');
        }
        const qtyMap = new Map(
          fresh.items.map((i) => [i.id, { variantId: i.variantId, receivedQuantity: i.quantity }]),
        );
        await applyStockForReception(
          {
            kind: 'reception',
            fromStoreId: null,
            toStoreId: warehouseId,
            quantitiesByItem: qtyMap,
            userId: auth.userId,
          },
          tx,
        );

        return created.id;
      });

      const full = await deliveries.findDelivery(deliveryId);
      if (!full) throw new AppError(500, ERROR_CODES.INTERNAL_ERROR, 'Delivery no se pudo recuperar.');
      return full;
    },
  };
}

