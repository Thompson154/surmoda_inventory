import { Prisma } from '@prisma/client';
import {
  buildProductService,
  type ProductService,
} from '../service.product';
import type { ProductRepository, ProductTx } from '../repository.product';
import type { VariantRepository } from '../repository.variant';
import type { ProductDTO, VariantDTO } from '../types';

interface MockProductsRepo {
  findById: jest.Mock;
  findByCode: jest.Mock;
  list: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  setActive: jest.Mock;
  countActiveVariants: jest.Mock;
  runSerializable: jest.Mock;
}

interface MockVariantsRepo {
  findById: jest.Mock;
  findByBarcode: jest.Mock;
  listActiveByProduct: jest.Mock;
  listAllByProduct: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  setActive: jest.Mock;
}

const FAKE_TX = {} as ProductTx;

const buildProduct = (overrides: Partial<ProductDTO> = {}): ProductDTO => ({
  id: overrides.id ?? 'prod-1',
  code: overrides.code ?? 'JN001',
  name: overrides.name ?? 'Jean Bota Recta',
  description: overrides.description ?? null,
  isActive: overrides.isActive ?? true,
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  updatedAt: overrides.updatedAt ?? new Date().toISOString(),
});

const buildVariant = (overrides: Partial<VariantDTO> = {}): VariantDTO => ({
  id: overrides.id ?? 'var-1',
  productId: overrides.productId ?? 'prod-1',
  size: overrides.size ?? '30',
  color: overrides.color ?? 'azul',
  barcode: overrides.barcode ?? 'ABC123ABC123',
  priceCents: overrides.priceCents ?? 25000,
  imagePath: overrides.imagePath ?? null,
  isActive: overrides.isActive ?? true,
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  updatedAt: overrides.updatedAt ?? new Date().toISOString(),
});

let products: MockProductsRepo;
let variants: MockVariantsRepo;
let service: ProductService;

beforeEach(() => {
  products = {
    findById: jest.fn(),
    findByCode: jest.fn(),
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
    countActiveVariants: jest.fn(),
    runSerializable: jest.fn(async (fn: (tx: ProductTx) => Promise<unknown>) => fn(FAKE_TX)),
  };
  variants = {
    findById: jest.fn(),
    findByBarcode: jest.fn(),
    listActiveByProduct: jest.fn(),
    listAllByProduct: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
  };
  service = buildProductService({
    products: products as unknown as ProductRepository,
    variants: variants as unknown as VariantRepository,
  });
});

describe('ProductService.create', () => {
  it('uppercases the code and persists the product', async () => {
    products.create.mockResolvedValue(buildProduct());

    const result = await service.create({ code: 'jn001', name: 'Jean Bota Recta' });

    expect(products.create).toHaveBeenCalledWith({
      code: 'JN001',
      name: 'Jean Bota Recta',
      description: null,
    });
    expect(result.code).toBe('JN001');
  });

  it('maps Prisma P2002 to PRODUCT_DUPLICATE_CODE (409)', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
    });
    products.create.mockRejectedValue(p2002);

    await expect(
      service.create({ code: 'JN001', name: 'X' }),
    ).rejects.toMatchObject({ code: 'PRODUCT_DUPLICATE_CODE', statusCode: 409 });
  });
});

describe('ProductService.list', () => {
  it('forwards the query to the repository', async () => {
    products.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    await service.list({ page: 2, pageSize: 50, q: 'jean' });
    expect(products.list).toHaveBeenCalledWith({ page: 2, pageSize: 50, q: 'jean' });
  });
});

describe('ProductService.getById', () => {
  it('returns product with active variants by default', async () => {
    products.findById.mockResolvedValue(buildProduct());
    variants.listActiveByProduct.mockResolvedValue([buildVariant()]);

    const result = await service.getById('prod-1');

    expect(variants.listActiveByProduct).toHaveBeenCalledWith('prod-1');
    expect(result.variants).toHaveLength(1);
  });

  it('returns ALL variants when includeInactiveVariants=true', async () => {
    products.findById.mockResolvedValue(buildProduct());
    variants.listAllByProduct.mockResolvedValue([buildVariant(), buildVariant({ isActive: false })]);

    const result = await service.getById('prod-1', true);

    expect(variants.listAllByProduct).toHaveBeenCalledWith('prod-1');
    expect(result.variants).toHaveLength(2);
  });

  it('throws PRODUCT_NOT_FOUND when missing', async () => {
    products.findById.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
    });
  });
});

describe('ProductService.update', () => {
  it('uppercases the code on update and persists the change', async () => {
    products.findById.mockResolvedValue(buildProduct());
    products.update.mockResolvedValue(buildProduct({ code: 'NEW01' }));

    await service.update('prod-1', { code: 'new01' });

    expect(products.update).toHaveBeenCalledWith('prod-1', { code: 'NEW01' });
  });

  it('maps duplicate code to PRODUCT_DUPLICATE_CODE', async () => {
    products.findById.mockResolvedValue(buildProduct());
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
    });
    products.update.mockRejectedValue(p2002);

    await expect(
      service.update('prod-1', { code: 'DUP' }),
    ).rejects.toMatchObject({ code: 'PRODUCT_DUPLICATE_CODE', statusCode: 409 });
  });

  it('throws PRODUCT_NOT_FOUND when product missing', async () => {
    products.findById.mockResolvedValue(null);
    await expect(service.update('missing', { name: 'x' })).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
    });
    expect(products.update).not.toHaveBeenCalled();
  });
});

describe('ProductService.deactivate', () => {
  it('deactivates when there are no active variants', async () => {
    products.findById.mockResolvedValue(buildProduct({ isActive: true }));
    products.countActiveVariants.mockResolvedValue(0);
    products.setActive.mockResolvedValue(buildProduct({ isActive: false }));

    const result = await service.deactivate('prod-1');

    expect(products.setActive).toHaveBeenCalledWith('prod-1', false, FAKE_TX);
    expect(result.isActive).toBe(false);
  });

  it('blocks when active variants exist (PRODUCT_HAS_ACTIVE_VARIANTS)', async () => {
    products.findById.mockResolvedValue(buildProduct({ isActive: true }));
    products.countActiveVariants.mockResolvedValue(2);

    await expect(service.deactivate('prod-1')).rejects.toMatchObject({
      code: 'PRODUCT_HAS_ACTIVE_VARIANTS',
      statusCode: 409,
      details: { activeVariantsCount: 2 },
    });
    expect(products.setActive).not.toHaveBeenCalled();
  });

  it('is idempotent when already inactive', async () => {
    products.findById.mockResolvedValue(buildProduct({ isActive: false }));
    const result = await service.deactivate('prod-1');
    expect(products.setActive).not.toHaveBeenCalled();
    expect(result.isActive).toBe(false);
  });

  it('throws PRODUCT_NOT_FOUND when missing', async () => {
    products.findById.mockResolvedValue(null);
    await expect(service.deactivate('missing')).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
    });
  });
});

describe('ProductService.reactivate', () => {
  it('reactivates an inactive product', async () => {
    products.findById.mockResolvedValue(buildProduct({ isActive: false }));
    products.setActive.mockResolvedValue(buildProduct({ isActive: true }));

    const result = await service.reactivate('prod-1');

    expect(products.setActive).toHaveBeenCalledWith('prod-1', true);
    expect(result.isActive).toBe(true);
  });

  it('is idempotent when already active', async () => {
    products.findById.mockResolvedValue(buildProduct({ isActive: true }));
    await service.reactivate('prod-1');
    expect(products.setActive).not.toHaveBeenCalled();
  });
});
