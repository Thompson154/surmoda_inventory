import { buildInventoryService, type InventoryService } from '../service';
import type { InventoryRepository, InventoryTx } from '../repository';
import type { InventoryRowDTO } from '../types';

interface MockRepo {
  findUserAssignment: jest.Mock;
  hasAnyEncargadaRole: jest.Mock;
  list: jest.Mock;
  listGroupedByProduct: jest.Mock;
  listVariantsForProductInStore: jest.Mock;
  findRow: jest.Mock;
  findByBarcode: jest.Mock;
  upsertQuantity: jest.Mock;
  createMovement: jest.Mock;
  listMovements: jest.Mock;
  getEditPermission: jest.Mock;
  upsertEditPermission: jest.Mock;
  runSerializable: jest.Mock;
}

const FAKE_TX = {} as InventoryTx;

const buildRow = (overrides: Partial<InventoryRowDTO> = {}): InventoryRowDTO => ({
  variantId: overrides.variantId ?? 'var-1',
  productId: overrides.productId ?? 'prod-1',
  productCode: overrides.productCode ?? 'JN001',
  productName: overrides.productName ?? 'Jean Bota',
  size: overrides.size ?? '30',
  color: overrides.color ?? 'azul',
  barcode: overrides.barcode ?? 'AAAAAAAAAAAA',
  priceCents: overrides.priceCents ?? 25000,
  imagePath: overrides.imagePath ?? null,
  quantity: overrides.quantity ?? 0,
});

let repo: MockRepo;
let service: InventoryService;

beforeEach(() => {
  repo = {
    findUserAssignment: jest.fn(),
    hasAnyEncargadaRole: jest.fn().mockResolvedValue(false),
    list: jest.fn(),
    listGroupedByProduct: jest.fn(),
    listVariantsForProductInStore: jest.fn(),
    findRow: jest.fn(),
    findByBarcode: jest.fn(),
    upsertQuantity: jest.fn(),
    createMovement: jest.fn().mockResolvedValue(undefined),
    listMovements: jest.fn(),
    getEditPermission: jest.fn(),
    upsertEditPermission: jest.fn(),
    runSerializable: jest.fn(async (fn: (tx: InventoryTx) => Promise<unknown>) => fn(FAKE_TX)),
  };
  service = buildInventoryService({ inventory: repo as unknown as InventoryRepository });
});

describe('InventoryService.list', () => {
  it('admin can list any store', async () => {
    repo.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    await service.list(
      'store-prado-seed',
      { page: 1, pageSize: 20 },
      { userId: 'admin', isAdmin: true },
    );
    expect(repo.list).toHaveBeenCalledWith('store-prado-seed', { page: 1, pageSize: 20 });
    expect(repo.findUserAssignment).not.toHaveBeenCalled();
  });

  it('staff with valid assignment can list', async () => {
    repo.findUserAssignment.mockResolvedValue({
      userId: 'u1',
      storeId: 'store-prado-seed',
      role: 'vendedora',
    });
    repo.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    await service.list(
      'store-prado-seed',
      { page: 1, pageSize: 20 },
      { userId: 'u1', isAdmin: false },
    );
    expect(repo.list).toHaveBeenCalled();
  });

  it('staff without assignment gets 404 (no leak)', async () => {
    repo.findUserAssignment.mockResolvedValue(null);
    await expect(
      service.list('store-zsur-seed', { page: 1, pageSize: 20 }, { userId: 'u1', isAdmin: false }),
    ).rejects.toMatchObject({ code: 'STOCK_NOT_FOUND', statusCode: 404 });
  });
});

describe('InventoryService.adjust', () => {
  it('admin adjusts inventory successfully', async () => {
    repo.findRow.mockResolvedValue(buildRow({ quantity: 50 }));
    repo.upsertQuantity.mockResolvedValue({ previous: 0, next: 50 });

    const result = await service.adjust(
      'store-prado-seed',
      'var-1',
      { quantity: 50 },
      { userId: 'admin-1', isAdmin: true },
    );

    expect(repo.upsertQuantity).toHaveBeenCalledWith('store-prado-seed', 'var-1', 50, FAKE_TX);
    expect(repo.createMovement).toHaveBeenCalled();
    expect(result.quantity).toBe(50);
    expect(result.delta).toBe(50);
    expect(result.previous).toBe(0);
  });

  it('encargada is BLOCKED (INVENTORY_EDIT_FORBIDDEN_NON_ADMIN) — post-redesign solo admin edita', async () => {
    repo.findUserAssignment.mockResolvedValue({
      userId: 'u1',
      storeId: 'store-prado-seed',
      role: 'encargada',
    });

    await expect(
      service.adjust(
        'store-prado-seed',
        'var-1',
        { quantity: 5 },
        { userId: 'u1', isAdmin: false },
      ),
    ).rejects.toMatchObject({ code: 'INVENTORY_EDIT_FORBIDDEN_NON_ADMIN', statusCode: 403 });
    expect(repo.upsertQuantity).not.toHaveBeenCalled();
  });

  it('vendedora is BLOCKED (INVENTORY_EDIT_FORBIDDEN_NON_ADMIN) — post-redesign solo admin edita', async () => {
    repo.findUserAssignment.mockResolvedValue({
      userId: 'u1',
      storeId: 'store-prado-seed',
      role: 'vendedora',
    });

    await expect(
      service.adjust(
        'store-prado-seed',
        'var-1',
        { quantity: 5 },
        { userId: 'u1', isAdmin: false },
      ),
    ).rejects.toMatchObject({ code: 'INVENTORY_EDIT_FORBIDDEN_NON_ADMIN', statusCode: 403 });
    expect(repo.upsertQuantity).not.toHaveBeenCalled();
  });

  it('rejects out-of-scope store with 404 (asserted before role check)', async () => {
    repo.findUserAssignment.mockResolvedValue(null);
    await expect(
      service.adjust('store-zsur-seed', 'var-1', { quantity: 5 }, { userId: 'u1', isAdmin: false }),
    ).rejects.toMatchObject({ code: 'STOCK_NOT_FOUND', statusCode: 404 });
  });

  it('admin write writes a movement row with delta/previous/next/reason', async () => {
    repo.findRow.mockResolvedValue(buildRow({ quantity: 100 }));
    repo.upsertQuantity.mockResolvedValue({ previous: 50, next: 100 });

    await service.adjust(
      'store-prado-seed',
      'var-1',
      { quantity: 100, reason: 'recepción de mercadería' },
      { userId: 'admin-1', isAdmin: true },
    );

    expect(repo.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'adjusted',
        payload: { previous: 50, next: 100, delta: 50, reason: 'recepción de mercadería' },
      }),
      FAKE_TX,
    );
  });
});

describe('InventoryService.getByBarcode', () => {
  it('returns the inventory row when found', async () => {
    repo.findUserAssignment.mockResolvedValue({
      userId: 'u1',
      storeId: 'store-prado-seed',
      role: 'vendedora',
    });
    repo.findByBarcode.mockResolvedValue(buildRow());

    const result = await service.getByBarcode('store-prado-seed', 'AAAAAAAAAAAA', {
      userId: 'u1',
      isAdmin: false,
    });
    expect(result.barcode).toBe('AAAAAAAAAAAA');
  });

  it('throws STOCK_BARCODE_NOT_FOUND when no match', async () => {
    repo.findUserAssignment.mockResolvedValue({
      userId: 'u1',
      storeId: 'store-prado-seed',
      role: 'vendedora',
    });
    repo.findByBarcode.mockResolvedValue(null);

    await expect(
      service.getByBarcode('store-prado-seed', 'NOPE', { userId: 'u1', isAdmin: false }),
    ).rejects.toMatchObject({ code: 'STOCK_BARCODE_NOT_FOUND', statusCode: 404 });
  });
});

describe('InventoryService.listMovements', () => {
  it('admin can list movements', async () => {
    repo.listMovements.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    await service.listMovements(
      'store-prado-seed',
      { page: 1, pageSize: 20 },
      { userId: 'admin', isAdmin: true },
    );
    expect(repo.listMovements).toHaveBeenCalled();
  });

  it('vendedora is blocked (403)', async () => {
    repo.findUserAssignment.mockResolvedValue({
      userId: 'u1',
      storeId: 'store-prado-seed',
      role: 'vendedora',
    });
    await expect(
      service.listMovements(
        'store-prado-seed',
        { page: 1, pageSize: 20 },
        { userId: 'u1', isAdmin: false },
      ),
    ).rejects.toMatchObject({ code: 'STORE_EDIT_PERMISSION_FORBIDDEN', statusCode: 403 });
  });
});

describe('InventoryService.togglePermission', () => {
  it('encargada toggles + writes movement', async () => {
    repo.findUserAssignment.mockResolvedValue({
      userId: 'u1',
      storeId: 'store-prado-seed',
      role: 'encargada',
    });
    repo.upsertEditPermission.mockResolvedValue({
      storeId: 'store-prado-seed',
      isEnabled: true,
      toggledByUserId: 'u1',
      toggledAt: new Date().toISOString(),
    });

    const result = await service.togglePermission(
      'store-prado-seed',
      { isEnabled: true },
      { userId: 'u1', isAdmin: false },
    );

    expect(result.isEnabled).toBe(true);
    expect(repo.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'edit_permission_toggled',
        payload: { isEnabled: true },
      }),
      FAKE_TX,
    );
  });

  it('vendedora cannot toggle (403)', async () => {
    repo.findUserAssignment.mockResolvedValue({
      userId: 'u1',
      storeId: 'store-prado-seed',
      role: 'vendedora',
    });
    await expect(
      service.togglePermission(
        'store-prado-seed',
        { isEnabled: true },
        { userId: 'u1', isAdmin: false },
      ),
    ).rejects.toMatchObject({ code: 'STORE_EDIT_PERMISSION_FORBIDDEN', statusCode: 403 });
  });
});

describe('InventoryService.getEditPermission', () => {
  it('returns default disabled when row missing', async () => {
    repo.findUserAssignment.mockResolvedValue({
      userId: 'u1',
      storeId: 'store-prado-seed',
      role: 'vendedora',
    });
    repo.getEditPermission.mockResolvedValue({
      storeId: 'store-prado-seed',
      isEnabled: false,
      toggledByUserId: null,
      toggledAt: null,
    });

    const result = await service.getEditPermission('store-prado-seed', {
      userId: 'u1',
      isAdmin: false,
    });
    expect(result.isEnabled).toBe(false);
  });
});

describe('InventoryService — global encargada', () => {
  it('encargada with role=encargada in any store can access any store', async () => {
    repo.hasAnyEncargadaRole.mockResolvedValue(true);
    repo.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

    await service.list(
      'store-zsur-seed',
      { page: 1, pageSize: 20 },
      { userId: 'u1', isAdmin: false },
    );
    expect(repo.list).toHaveBeenCalledWith('store-zsur-seed', { page: 1, pageSize: 20 });
    expect(repo.findUserAssignment).not.toHaveBeenCalled();
  });

  it('encargada can list movements of any store', async () => {
    repo.hasAnyEncargadaRole.mockResolvedValue(true);
    repo.listMovements.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    await service.listMovements(
      'store-zsur-seed',
      { page: 1, pageSize: 20 },
      { userId: 'u1', isAdmin: false },
    );
    expect(repo.listMovements).toHaveBeenCalled();
  });
});

describe('InventoryService.listGrouped', () => {
  it('returns the grouped result for an authorized user', async () => {
    repo.hasAnyEncargadaRole.mockResolvedValue(true);
    const grouped = {
      items: [
        {
          productId: 'p1',
          productCode: 'JN001',
          productName: 'Jean',
          imagePath: null,
          totalQuantity: 12,
          variantsCount: 3,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    repo.listGroupedByProduct.mockResolvedValue(grouped);

    const result = await service.listGrouped(
      'store-prado-seed',
      { page: 1, pageSize: 20 },
      { userId: 'u1', isAdmin: false },
    );
    expect(result).toEqual(grouped);
  });
});

describe('InventoryService.listVariantsForProduct', () => {
  it('returns variants when present', async () => {
    repo.hasAnyEncargadaRole.mockResolvedValue(true);
    repo.listVariantsForProductInStore.mockResolvedValue([
      buildRow({ size: 'm', color: 'azul', quantity: 5 }),
    ]);
    const variants = await service.listVariantsForProduct('store-prado-seed', 'p1', {
      userId: 'u1',
      isAdmin: false,
    });
    expect(variants).toHaveLength(1);
  });

  it('throws INVENTORY_PRODUCT_NOT_IN_STORE when no variants exist for the product in the store', async () => {
    repo.hasAnyEncargadaRole.mockResolvedValue(true);
    repo.listVariantsForProductInStore.mockResolvedValue([]);
    await expect(
      service.listVariantsForProduct('store-prado-seed', 'p-missing', {
        userId: 'u1',
        isAdmin: false,
      }),
    ).rejects.toMatchObject({ code: 'INVENTORY_PRODUCT_NOT_IN_STORE', statusCode: 404 });
  });
});
