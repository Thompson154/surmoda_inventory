import { Prisma } from '@prisma/client';
import {
  buildStoreService,
  type AssignmentScopeRepository,
  type StoreService,
} from '../service';
import type { StoreRepository, StoreTx } from '../repository';
import type { StoreDTO, StoreKind } from '../types';

interface MockStoresRepo {
  findById: jest.Mock;
  findByCode: jest.Mock;
  list: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  setActive: jest.Mock;
  countActiveAssignments: jest.Mock;
  countActiveWarehouses: jest.Mock;
  runSerializable: jest.Mock;
}

interface MockAssignmentScope {
  listActiveByUser: jest.Mock;
}

const FAKE_TX = {} as StoreTx;

const buildStore = (overrides: Partial<StoreDTO> = {}): StoreDTO => ({
  id: overrides.id ?? 'store-prado-seed',
  code: overrides.code ?? 'PRADO',
  name: overrides.name ?? 'Sucursal Prado',
  kind: (overrides.kind ?? 'branch') as StoreKind,
  isActive: overrides.isActive ?? true,
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  updatedAt: overrides.updatedAt ?? new Date().toISOString(),
});

let stores: MockStoresRepo;
let assignments: MockAssignmentScope;
let service: StoreService;

beforeEach(() => {
  stores = {
    findById: jest.fn(),
    findByCode: jest.fn(),
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
    countActiveAssignments: jest.fn(),
    countActiveWarehouses: jest.fn(),
    // WHY: pass-through tx executor — lets each test assert behavior without a real DB.
    runSerializable: jest.fn(async (fn: (tx: StoreTx) => Promise<unknown>) => fn(FAKE_TX)),
  };
  assignments = {
    listActiveByUser: jest.fn(),
  };
  service = buildStoreService({
    stores: stores as unknown as StoreRepository,
    assignments: assignments as unknown as AssignmentScopeRepository,
  });
});

describe('StoreService.create', () => {
  it('creates a branch store and uppercases the code', async () => {
    stores.create.mockResolvedValue(buildStore({ code: 'NEWBRANCH', kind: 'branch' }));

    const result = await service.create({ code: 'newBranch', name: 'New Branch', kind: 'branch' });

    expect(stores.runSerializable).toHaveBeenCalledTimes(1);
    expect(stores.countActiveWarehouses).not.toHaveBeenCalled();
    expect(stores.create).toHaveBeenCalledWith(
      { code: 'NEWBRANCH', name: 'New Branch', kind: 'branch' },
      FAKE_TX,
    );
    expect(result.code).toBe('NEWBRANCH');
  });

  it('blocks a second active warehouse (STORE_WAREHOUSE_ALREADY_EXISTS)', async () => {
    stores.countActiveWarehouses.mockResolvedValue(1);

    await expect(
      service.create({ code: 'WH2', name: 'Second WH', kind: 'warehouse' }),
    ).rejects.toMatchObject({
      code: 'STORE_WAREHOUSE_ALREADY_EXISTS',
      statusCode: 409,
    });
    expect(stores.create).not.toHaveBeenCalled();
  });

  it('creates the FIRST warehouse when none active', async () => {
    stores.countActiveWarehouses.mockResolvedValue(0);
    stores.create.mockResolvedValue(buildStore({ code: 'ALMACEN', kind: 'warehouse' }));

    const result = await service.create({
      code: 'ALMACEN',
      name: 'Almacén Central',
      kind: 'warehouse',
    });

    expect(result.kind).toBe('warehouse');
  });

  it('maps Prisma P2002 to STORE_DUPLICATE_CODE (409)', async () => {
    stores.countActiveWarehouses.mockResolvedValue(0);
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
    });
    stores.create.mockRejectedValue(p2002);

    await expect(
      service.create({ code: 'DUP', name: 'Dup', kind: 'branch' }),
    ).rejects.toMatchObject({
      code: 'STORE_DUPLICATE_CODE',
      statusCode: 409,
    });
  });
});

describe('StoreService.list', () => {
  it('admin without isActive defaults to active-only when includeInactive is false', async () => {
    stores.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

    await service.list(
      { page: 1, pageSize: 20 },
      { userId: 'admin1', isAdmin: true },
    );

    expect(stores.list).toHaveBeenCalledWith({ page: 1, pageSize: 20, isActive: true });
  });

  it('admin with includeInactive=true bypasses the isActive default', async () => {
    stores.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

    await service.list(
      { page: 1, pageSize: 20, includeInactive: true },
      { userId: 'admin1', isAdmin: true },
    );

    expect(stores.list).toHaveBeenCalledWith(
      expect.objectContaining({ includeInactive: true }),
    );
    const call = stores.list.mock.calls[0]?.[0] as { isActive?: boolean };
    expect(call.isActive).toBeUndefined();
  });

  it('vendedora is scoped to their assigned store ids and forced isActive=true', async () => {
    assignments.listActiveByUser.mockResolvedValue([
      { storeId: 'store-prado-seed', role: 'vendedora' },
      { storeId: 'store-zsur-seed', role: 'vendedora' },
      { storeId: 'store-prado-seed', role: 'vendedora' }, // duplicate -> deduped
    ]);
    stores.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

    await service.list(
      { page: 1, pageSize: 20 },
      { userId: 'staff1', isAdmin: false },
    );

    const allowedIds = stores.list.mock.calls[0]?.[1] as string[];
    expect(new Set(allowedIds)).toEqual(new Set(['store-prado-seed', 'store-zsur-seed']));
    const filters = stores.list.mock.calls[0]?.[0] as { isActive?: boolean };
    expect(filters.isActive).toBe(true);
  });

  it('staff with no assignments receives empty pagination', async () => {
    assignments.listActiveByUser.mockResolvedValue([]);
    stores.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

    const result = await service.list(
      { page: 1, pageSize: 20 },
      { userId: 'staff-no-store', isAdmin: false },
    );

    expect(stores.list).toHaveBeenCalledWith(expect.any(Object), []);
    expect(result.items).toEqual([]);
  });

  it('encargada (any role=encargada) sees ALL stores regardless of assignments', async () => {
    assignments.listActiveByUser.mockResolvedValue([
      { storeId: 'store-prado-seed', role: 'encargada' },
    ]);
    stores.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

    await service.list(
      { page: 1, pageSize: 20 },
      { userId: 'encargada-1', isAdmin: false },
    );

    // Encargada acts as global operator: receives ONE list-arg (no allowedIds filter).
    expect(stores.list).toHaveBeenCalledTimes(1);
    expect(stores.list.mock.calls[0]).toHaveLength(1);
  });
});

describe('StoreService.getById', () => {
  it('returns the store for an admin', async () => {
    stores.findById.mockResolvedValue(buildStore());

    const result = await service.getById('store-prado-seed', { userId: 'admin1', isAdmin: true });

    expect(result.id).toBe('store-prado-seed');
    expect(assignments.listActiveByUser).not.toHaveBeenCalled();
  });

  it('returns the store for vendedora with a valid assignment', async () => {
    stores.findById.mockResolvedValue(buildStore());
    assignments.listActiveByUser.mockResolvedValue([
      { storeId: 'store-prado-seed', role: 'vendedora' },
    ]);

    const result = await service.getById('store-prado-seed', { userId: 'u1', isAdmin: false });

    expect(result.id).toBe('store-prado-seed');
  });

  it('encargada accesses any store, even without direct assignment', async () => {
    stores.findById.mockResolvedValue(buildStore({ id: 'store-zsur-seed' }));
    assignments.listActiveByUser.mockResolvedValue([
      { storeId: 'store-prado-seed', role: 'encargada' },
    ]);

    const result = await service.getById('store-zsur-seed', { userId: 'u1', isAdmin: false });

    expect(result.id).toBe('store-zsur-seed');
  });

  it('throws STORE_NOT_FOUND when store is missing', async () => {
    stores.findById.mockResolvedValue(null);

    await expect(
      service.getById('missing', { userId: 'admin1', isAdmin: true }),
    ).rejects.toMatchObject({ code: 'STORE_NOT_FOUND', statusCode: 404 });
  });

  it('throws STORE_NOT_FOUND (no leak) when vendedora has no assignment to that store', async () => {
    stores.findById.mockResolvedValue(buildStore({ id: 'store-zsur-seed' }));
    assignments.listActiveByUser.mockResolvedValue([
      { storeId: 'store-prado-seed', role: 'vendedora' },
    ]);

    await expect(
      service.getById('store-zsur-seed', { userId: 'u1', isAdmin: false }),
    ).rejects.toMatchObject({ code: 'STORE_NOT_FOUND', statusCode: 404 });
  });
});

describe('StoreService.update', () => {
  it('updates the name only', async () => {
    stores.findById.mockResolvedValue(buildStore());
    stores.update.mockResolvedValue(buildStore({ name: 'Renamed' }));

    const result = await service.update('store-prado-seed', { name: 'Renamed' });

    expect(stores.update).toHaveBeenCalledWith('store-prado-seed', { name: 'Renamed' });
    expect(result.name).toBe('Renamed');
  });

  it('uppercases the code on update', async () => {
    stores.findById.mockResolvedValue(buildStore());
    stores.update.mockResolvedValue(buildStore({ code: 'NEWCODE' }));

    await service.update('store-prado-seed', { code: 'newCode' });

    expect(stores.update).toHaveBeenCalledWith('store-prado-seed', { code: 'NEWCODE' });
  });

  it('maps Prisma P2002 to STORE_DUPLICATE_CODE (409)', async () => {
    stores.findById.mockResolvedValue(buildStore());
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
    });
    stores.update.mockRejectedValue(p2002);

    await expect(
      service.update('store-prado-seed', { code: 'DUP' }),
    ).rejects.toMatchObject({ code: 'STORE_DUPLICATE_CODE', statusCode: 409 });
  });

  it('throws STORE_NOT_FOUND when store is missing', async () => {
    stores.findById.mockResolvedValue(null);

    await expect(service.update('missing', { name: 'X' })).rejects.toMatchObject({
      code: 'STORE_NOT_FOUND',
      statusCode: 404,
    });
    expect(stores.update).not.toHaveBeenCalled();
  });
});

describe('StoreService.deactivate', () => {
  it('deactivates the store when there are no active assignments', async () => {
    stores.findById.mockResolvedValue(buildStore({ isActive: true }));
    stores.countActiveAssignments.mockResolvedValue(0);
    stores.setActive.mockResolvedValue(buildStore({ isActive: false }));

    const result = await service.deactivate('store-prado-seed');

    expect(stores.setActive).toHaveBeenCalledWith('store-prado-seed', false, FAKE_TX);
    expect(result.isActive).toBe(false);
  });

  it('blocks deactivation when active assignments exist (STORE_HAS_ACTIVE_ASSIGNMENTS)', async () => {
    stores.findById.mockResolvedValue(buildStore({ isActive: true }));
    stores.countActiveAssignments.mockResolvedValue(3);

    await expect(service.deactivate('store-prado-seed')).rejects.toMatchObject({
      code: 'STORE_HAS_ACTIVE_ASSIGNMENTS',
      statusCode: 409,
      details: { activeAssignmentsCount: 3 },
    });
    expect(stores.setActive).not.toHaveBeenCalled();
  });

  it('is idempotent when already inactive', async () => {
    stores.findById.mockResolvedValue(buildStore({ isActive: false }));

    const result = await service.deactivate('store-prado-seed');

    expect(stores.setActive).not.toHaveBeenCalled();
    expect(stores.countActiveAssignments).not.toHaveBeenCalled();
    expect(result.isActive).toBe(false);
  });

  it('throws STORE_NOT_FOUND when store is missing', async () => {
    stores.findById.mockResolvedValue(null);

    await expect(service.deactivate('missing')).rejects.toMatchObject({
      code: 'STORE_NOT_FOUND',
      statusCode: 404,
    });
  });
});

describe('StoreService.reactivate', () => {
  it('reactivates an inactive branch store', async () => {
    stores.findById.mockResolvedValue(buildStore({ kind: 'branch', isActive: false }));
    stores.setActive.mockResolvedValue(buildStore({ isActive: true }));

    const result = await service.reactivate('store-prado-seed');

    expect(stores.setActive).toHaveBeenCalledWith('store-prado-seed', true, FAKE_TX);
    expect(result.isActive).toBe(true);
  });

  it('blocks reactivating a warehouse when another active warehouse exists', async () => {
    stores.findById.mockResolvedValue(
      buildStore({ id: 'store-old-wh', kind: 'warehouse', isActive: false }),
    );
    stores.countActiveWarehouses.mockResolvedValue(1);

    await expect(service.reactivate('store-old-wh')).rejects.toMatchObject({
      code: 'STORE_WAREHOUSE_ALREADY_EXISTS',
      statusCode: 409,
    });
    expect(stores.countActiveWarehouses).toHaveBeenCalledWith({ excludeId: 'store-old-wh' }, FAKE_TX);
    expect(stores.setActive).not.toHaveBeenCalled();
  });

  it('reactivates a warehouse when no other warehouse is active', async () => {
    stores.findById.mockResolvedValue(
      buildStore({ id: 'store-almacen-seed', kind: 'warehouse', isActive: false }),
    );
    stores.countActiveWarehouses.mockResolvedValue(0);
    stores.setActive.mockResolvedValue(
      buildStore({ id: 'store-almacen-seed', kind: 'warehouse', isActive: true }),
    );

    const result = await service.reactivate('store-almacen-seed');

    expect(result.isActive).toBe(true);
  });

  it('is idempotent when already active', async () => {
    stores.findById.mockResolvedValue(buildStore({ isActive: true }));

    const result = await service.reactivate('store-prado-seed');

    expect(stores.setActive).not.toHaveBeenCalled();
    expect(stores.countActiveWarehouses).not.toHaveBeenCalled();
    expect(result.isActive).toBe(true);
  });

  it('throws STORE_NOT_FOUND when store is missing', async () => {
    stores.findById.mockResolvedValue(null);

    await expect(service.reactivate('missing')).rejects.toMatchObject({
      code: 'STORE_NOT_FOUND',
      statusCode: 404,
    });
  });
});
