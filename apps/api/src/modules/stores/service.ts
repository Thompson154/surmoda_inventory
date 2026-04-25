import { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';
import type { StoreRepository } from './repository';
import type {
  AuthContext,
  CreateStoreDTO,
  ListStoresQuery,
  PaginatedStores,
  StoreDTO,
  UpdateStoreDTO,
} from './types';

export interface AssignmentScopeRepository {
  listActiveByUser(userId: string): Promise<Array<{ storeId: string; role: 'encargada' | 'vendedora' }>>;
}

export interface StoreServiceDeps {
  stores: StoreRepository;
  assignments: AssignmentScopeRepository;
}

export interface StoreService {
  create(input: CreateStoreDTO): Promise<StoreDTO>;
  list(query: ListStoresQuery, auth: AuthContext): Promise<PaginatedStores>;
  getById(id: string, auth: AuthContext): Promise<StoreDTO>;
  update(id: string, input: UpdateStoreDTO): Promise<StoreDTO>;
  deactivate(id: string): Promise<StoreDTO>;
  reactivate(id: string): Promise<StoreDTO>;
}

export function buildStoreService({ stores, assignments }: StoreServiceDeps): StoreService {
  function mapDuplicateCode(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(
        409,
        ERROR_CODES.STORE_DUPLICATE_CODE,
        'Ese código ya está en uso.',
      );
    }
    throw err;
  }

  return {
    async create(input) {
      const code = input.code.toUpperCase();

      return stores.runSerializable(async (tx) => {
        if (input.kind === 'warehouse') {
          const existing = await stores.countActiveWarehouses(undefined, tx);
          if (existing > 0) {
            throw new AppError(
              409,
              ERROR_CODES.STORE_WAREHOUSE_ALREADY_EXISTS,
              'Solo puede existir un almacén central activo.',
            );
          }
        }

        try {
          return await stores.create({ code, name: input.name, kind: input.kind }, tx);
        } catch (err) {
          mapDuplicateCode(err);
        }
      });
    },

    async list(query, auth) {
      // WHY: encargada con cualquier asignación de role=encargada se trata como
      // operadora global — ve todas las sedes (incluido el almacén). Vendedora
      // mantiene scope estricto a sus assignments.
      const userAssignments = auth.isAdmin ? [] : await assignments.listActiveByUser(auth.userId);
      const isGlobalOperator = auth.isAdmin || userAssignments.some((a) => a.role === 'encargada');

      if (isGlobalOperator) {
        const adminQuery: ListStoresQuery = { ...query };
        if (!adminQuery.includeInactive && adminQuery.isActive === undefined) {
          adminQuery.isActive = true;
        }
        return stores.list(adminQuery);
      }

      const staffQuery: ListStoresQuery = { ...query, isActive: true };
      const allowedIds = Array.from(new Set(userAssignments.map((a) => a.storeId)));
      return stores.list(staffQuery, allowedIds);
    },

    async getById(id, auth) {
      const store = await stores.findById(id);
      if (!store) {
        throw new AppError(404, ERROR_CODES.STORE_NOT_FOUND, 'Tienda no encontrada.');
      }

      if (!auth.isAdmin) {
        const userAssignments = await assignments.listActiveByUser(auth.userId);
        const isGlobalOperator = userAssignments.some((a) => a.role === 'encargada');
        const hasDirectAccess = userAssignments.some((a) => a.storeId === id);
        if (!isGlobalOperator && !hasDirectAccess) {
          // WHY: same 404 as not-found avoids leaking existence (matches User.getById pattern).
          throw new AppError(404, ERROR_CODES.STORE_NOT_FOUND, 'Tienda no encontrada.');
        }
      }

      return store;
    },

    async update(id, input) {
      const current = await stores.findById(id);
      if (!current) {
        throw new AppError(404, ERROR_CODES.STORE_NOT_FOUND, 'Tienda no encontrada.');
      }

      const data: UpdateStoreDTO = {};
      if (input.code !== undefined) data.code = input.code.toUpperCase();
      if (input.name !== undefined) data.name = input.name;

      try {
        return await stores.update(id, data);
      } catch (err) {
        mapDuplicateCode(err);
      }
    },

    async deactivate(id) {
      return stores.runSerializable(async (tx) => {
        const store = await stores.findById(id, tx);
        if (!store) {
          throw new AppError(404, ERROR_CODES.STORE_NOT_FOUND, 'Tienda no encontrada.');
        }
        if (!store.isActive) return store;

        const activeAssignmentsCount = await stores.countActiveAssignments(id, tx);
        if (activeAssignmentsCount > 0) {
          throw new AppError(
            409,
            ERROR_CODES.STORE_HAS_ACTIVE_ASSIGNMENTS,
            `Hay ${activeAssignmentsCount} usuario(s) asignados. Reasigná o desactivá esos usuarios primero.`,
            { activeAssignmentsCount },
          );
        }

        return stores.setActive(id, false, tx);
      });
    },

    async reactivate(id) {
      return stores.runSerializable(async (tx) => {
        const store = await stores.findById(id, tx);
        if (!store) {
          throw new AppError(404, ERROR_CODES.STORE_NOT_FOUND, 'Tienda no encontrada.');
        }
        if (store.isActive) return store;

        if (store.kind === 'warehouse') {
          const otherActive = await stores.countActiveWarehouses({ excludeId: id }, tx);
          if (otherActive > 0) {
            throw new AppError(
              409,
              ERROR_CODES.STORE_WAREHOUSE_ALREADY_EXISTS,
              'Solo puede existir un almacén central activo.',
            );
          }
        }

        return stores.setActive(id, true, tx);
      });
    },
  };
}
