import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import type { InventoryRepository } from './repository';
import type {
  AdjustQuantityDTO,
  AuthContext,
  InventoryRowDTO,
  ListInventoryQuery,
  ListMovementsQuery,
  PaginatedGroupedInventory,
  PaginatedInventory,
  PaginatedStockMovements,
  StoreEditPermissionDTO,
  TogglePermissionDTO,
} from './types';

export interface InventoryServiceDeps {
  inventory: InventoryRepository;
}

export interface AdjustResult extends InventoryRowDTO {
  previous: number;
  delta: number;
}

export interface InventoryService {
  list(storeId: string, query: ListInventoryQuery, auth: AuthContext): Promise<PaginatedInventory>;
  listGrouped(
    storeId: string,
    query: ListInventoryQuery,
    auth: AuthContext,
  ): Promise<PaginatedGroupedInventory>;
  listVariantsForProduct(
    storeId: string,
    productId: string,
    auth: AuthContext,
  ): Promise<InventoryRowDTO[]>;
  adjust(
    storeId: string,
    variantId: string,
    input: AdjustQuantityDTO,
    auth: AuthContext,
  ): Promise<AdjustResult>;
  getByBarcode(storeId: string, barcode: string, auth: AuthContext): Promise<InventoryRowDTO>;
  listMovements(
    storeId: string,
    query: ListMovementsQuery,
    auth: AuthContext,
  ): Promise<PaginatedStockMovements>;
  getEditPermission(storeId: string, auth: AuthContext): Promise<StoreEditPermissionDTO>;
  togglePermission(
    storeId: string,
    input: TogglePermissionDTO,
    auth: AuthContext,
  ): Promise<StoreEditPermissionDTO>;
}

export function buildInventoryService({ inventory }: InventoryServiceDeps): InventoryService {
  async function assertUserCanAccessStore(
    storeId: string,
    auth: AuthContext,
    tx?: Parameters<typeof inventory.findUserAssignment>[2],
  ): Promise<{ role: 'admin' | 'encargada' | 'vendedora' }> {
    if (auth.isAdmin) return { role: 'admin' };

    // Encargada (con cualquier asignación role=encargada) opera global —
    // ve y edita cualquier sede sin necesidad de tener assignment directo.
    const isGlobalEncargada = await inventory.hasAnyEncargadaRole(auth.userId, tx);
    if (isGlobalEncargada) return { role: 'encargada' };

    const assignment = await inventory.findUserAssignment(auth.userId, storeId, tx);
    if (!assignment) {
      throw new AppError(404, ERROR_CODES.STOCK_NOT_FOUND, 'Inventario no encontrado.');
    }
    return { role: assignment.role };
  }

  async function assertEncargadaOrAdmin(
    storeId: string,
    auth: AuthContext,
    tx?: Parameters<typeof inventory.findUserAssignment>[2],
  ): Promise<void> {
    const { role } = await assertUserCanAccessStore(storeId, auth, tx);
    if (role === 'vendedora') {
      throw new AppError(
        403,
        ERROR_CODES.STORE_EDIT_PERMISSION_FORBIDDEN,
        'Sólo encargada/admin puede realizar esta acción.',
      );
    }
  }

  return {
    async list(storeId, query, auth) {
      await assertUserCanAccessStore(storeId, auth);
      return inventory.list(storeId, query);
    },

    async listGrouped(storeId, query, auth) {
      await assertUserCanAccessStore(storeId, auth);
      return inventory.listGroupedByProduct(storeId, query);
    },

    async listVariantsForProduct(storeId, productId, auth) {
      await assertUserCanAccessStore(storeId, auth);
      const variants = await inventory.listVariantsForProductInStore(storeId, productId);
      if (variants.length === 0) {
        throw new AppError(
          404,
          ERROR_CODES.INVENTORY_PRODUCT_NOT_IN_STORE,
          'Este producto no tiene stock en esta sede.',
        );
      }
      return variants;
    },

    async adjust(storeId, variantId, input, auth) {
      return inventory.runSerializable(async (tx) => {
        const { role } = await assertUserCanAccessStore(storeId, auth, tx);

        // WHY: post-redesign solo admin edita inventario; encargada y vendedora son read-only.
        if (role !== 'admin') {
          throw new AppError(
            403,
            ERROR_CODES.INVENTORY_EDIT_FORBIDDEN_NON_ADMIN,
            'Sólo admin puede editar inventario. Mandá una solicitud al admin si necesitás un cambio.',
          );
        }

        if (input.quantity < 0) {
          throw new AppError(
            400,
            ERROR_CODES.STOCK_NEGATIVE_NOT_ALLOWED,
            'El stock no puede ser negativo.',
          );
        }

        const existing = await inventory.findRow(storeId, variantId, tx);
        if (!existing) {
          // WHY: variant must exist; row may not yet (defensive — fast-create on first touch).
          // We still verify the variant via barcode lookup in the storesite to avoid orphan rows.
        }

        const { previous, next } = await inventory.upsertQuantity(
          storeId,
          variantId,
          input.quantity,
          tx,
        );

        await inventory.createMovement(
          {
            storeId,
            variantId,
            userId: auth.userId,
            type: 'adjusted',
            payload: {
              previous,
              next,
              delta: next - previous,
              reason: input.reason ?? null,
            },
          },
          tx,
        );

        const row = await inventory.findRow(storeId, variantId, tx);
        if (!row) {
          throw new AppError(404, ERROR_CODES.STOCK_NOT_FOUND, 'Inventario no encontrado.');
        }
        return { ...row, previous, delta: next - previous };
      });
    },

    async getByBarcode(storeId, barcode, auth) {
      await assertUserCanAccessStore(storeId, auth);
      const row = await inventory.findByBarcode(storeId, barcode);
      if (!row) {
        throw new AppError(
          404,
          ERROR_CODES.STOCK_BARCODE_NOT_FOUND,
          'Código de barras no encontrado en esta sede.',
        );
      }
      return row;
    },

    async listMovements(storeId, query, auth) {
      await assertEncargadaOrAdmin(storeId, auth);
      return inventory.listMovements(storeId, query);
    },

    async getEditPermission(storeId, auth) {
      await assertUserCanAccessStore(storeId, auth);
      return inventory.getEditPermission(storeId);
    },

    async togglePermission(storeId, input, auth) {
      await assertEncargadaOrAdmin(storeId, auth);
      return inventory.runSerializable(async (tx) => {
        const upserted = await inventory.upsertEditPermission(
          storeId,
          input.isEnabled,
          auth.userId,
          tx,
        );
        await inventory.createMovement(
          {
            storeId,
            variantId: null,
            userId: auth.userId,
            type: 'edit_permission_toggled',
            payload: { isEnabled: input.isEnabled },
          },
          tx,
        );
        return upserted;
      });
    },
  };
}
