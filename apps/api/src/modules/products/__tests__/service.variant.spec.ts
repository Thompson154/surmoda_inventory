import { Prisma } from '@prisma/client';
import { buildVariantService, type VariantService } from '../service.variant';
import type { ProductRepository, ProductTx } from '../repository.product';
import type { VariantRepository } from '../repository.variant';
import type { ImageStorage, UploadInput } from '../imageStorage';
import { generateBarcode } from '../barcode';
import type { ProductDTO, VariantDTO } from '../types';

interface MockProductsRepo {
  findById: jest.Mock;
  runSerializable: jest.Mock;
  // Other methods unused in these tests but required by the interface shape.
  findByCode: jest.Mock;
  list: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  setActive: jest.Mock;
  countActiveVariants: jest.Mock;
}

interface MockVariantsRepo {
  findById: jest.Mock;
  findByBarcode: jest.Mock;
  findActiveByTuple: jest.Mock;
  listActiveByProduct: jest.Mock;
  listAllByProduct: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  setActive: jest.Mock;
}

interface MockImageStorage {
  save: jest.Mock;
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
let imageStorage: MockImageStorage;
let service: VariantService;

beforeEach(() => {
  products = {
    findById: jest.fn(),
    runSerializable: jest.fn(async (fn: (tx: ProductTx) => Promise<unknown>) => fn(FAKE_TX)),
    findByCode: jest.fn(),
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
    countActiveVariants: jest.fn(),
  };
  variants = {
    findById: jest.fn(),
    findByBarcode: jest.fn(),
    findActiveByTuple: jest.fn().mockResolvedValue(null),
    listActiveByProduct: jest.fn(),
    listAllByProduct: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
  };
  imageStorage = { save: jest.fn() };
  service = buildVariantService({
    products: products as unknown as ProductRepository,
    variants: variants as unknown as VariantRepository,
    imageStorage: imageStorage as unknown as ImageStorage,
  });
});

const pngImage = (sizeBytes = 1024): UploadInput => ({
  buffer: Buffer.alloc(sizeBytes, 0),
  mimetype: 'image/png',
  originalName: 'foo.png',
});

describe('VariantService.create', () => {
  it('generates a deterministic barcode and persists the variant (no image)', async () => {
    products.findById.mockResolvedValue(buildProduct());
    variants.create.mockImplementation(async (data) => buildVariant({ ...data }));

    const result = await service.create('prod-1', {
      size: '30',
      color: 'Azul',
      priceCents: 25000,
    });

    const expectedBarcode = generateBarcode('JN001', '30', 'Azul');
    expect(variants.create).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'prod-1',
        size: '30',
        color: 'Azul',
        barcode: expectedBarcode,
        priceCents: 25000,
      }),
      FAKE_TX,
    );
    expect(result.barcode).toBe(expectedBarcode);
    expect(imageStorage.save).not.toHaveBeenCalled();
  });

  it('persists imagePath when an image is provided', async () => {
    products.findById.mockResolvedValue(buildProduct());
    imageStorage.save.mockResolvedValue('imagesTest/jn001-30-azul-123.png');
    variants.create.mockImplementation(async (data) => buildVariant({ ...data }));

    const result = await service.create(
      'prod-1',
      { size: '30', color: 'azul', priceCents: 25000 },
      pngImage(),
    );

    expect(imageStorage.save).toHaveBeenCalledTimes(1);
    expect(result.imagePath).toBe('imagesTest/jn001-30-azul-123.png');
  });

  it('throws VARIANT_PRODUCT_NOT_FOUND when product missing', async () => {
    products.findById.mockResolvedValue(null);
    await expect(
      service.create('missing', { size: '30', color: 'azul', priceCents: 25000 }),
    ).rejects.toMatchObject({ code: 'VARIANT_PRODUCT_NOT_FOUND', statusCode: 404 });
    expect(variants.create).not.toHaveBeenCalled();
  });

  it('throws VARIANT_PRODUCT_NOT_FOUND when product is inactive', async () => {
    products.findById.mockResolvedValue(buildProduct({ isActive: false }));
    await expect(
      service.create('prod-1', { size: '30', color: 'azul', priceCents: 25000 }),
    ).rejects.toMatchObject({ code: 'VARIANT_PRODUCT_NOT_FOUND', statusCode: 404 });
  });

  it('rejects images larger than the cap (VARIANT_IMAGE_TOO_LARGE)', async () => {
    await expect(
      service.create(
        'prod-1',
        { size: '30', color: 'azul', priceCents: 25000 },
        pngImage(6 * 1024 * 1024),
      ),
    ).rejects.toMatchObject({ code: 'VARIANT_IMAGE_TOO_LARGE', statusCode: 400 });
    expect(products.findById).not.toHaveBeenCalled();
  });

  it('rejects unsupported MIME types (VARIANT_IMAGE_INVALID_TYPE)', async () => {
    const badImage: UploadInput = {
      buffer: Buffer.alloc(100),
      mimetype: 'application/pdf' as unknown as UploadInput['mimetype'],
      originalName: 'bad.pdf',
    };
    await expect(
      service.create('prod-1', { size: '30', color: 'azul', priceCents: 25000 }, badImage),
    ).rejects.toMatchObject({ code: 'VARIANT_IMAGE_INVALID_TYPE', statusCode: 400 });
  });

  it('throws VARIANT_DUPLICATE_TUPLE when an active variant with same (size, color) exists', async () => {
    products.findById.mockResolvedValue(buildProduct());
    variants.findActiveByTuple.mockResolvedValue(buildVariant());

    await expect(
      service.create('prod-1', { size: '30', color: 'azul', priceCents: 25000 }),
    ).rejects.toMatchObject({ code: 'VARIANT_DUPLICATE_TUPLE', statusCode: 409 });
    expect(variants.create).not.toHaveBeenCalled();
  });

  it('maps a residual P2002 on barcode to BARCODE_COLLISION (defensive fallback)', async () => {
    products.findById.mockResolvedValue(buildProduct());
    variants.findActiveByTuple.mockResolvedValue(null);
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['barcode'] },
    });
    variants.create.mockRejectedValue(p2002);

    await expect(
      service.create('prod-1', { size: '30', color: 'azul', priceCents: 25000 }),
    ).rejects.toMatchObject({ code: 'BARCODE_COLLISION', statusCode: 409 });
  });
});

describe('VariantService.update', () => {
  it('updates priceCents only', async () => {
    variants.findById.mockResolvedValue(buildVariant());
    variants.update.mockResolvedValue(buildVariant({ priceCents: 30000 }));

    const result = await service.update('var-1', { priceCents: 30000 });

    expect(variants.update).toHaveBeenCalledWith('var-1', {
      priceCents: 30000,
      imagePath: undefined,
    });
    expect(result.priceCents).toBe(30000);
  });

  it('uploads new image and persists path on re-upload', async () => {
    variants.findById.mockResolvedValue(buildVariant());
    products.findById.mockResolvedValue(buildProduct());
    imageStorage.save.mockResolvedValue('imagesTest/jn001-30-azul-456.png');
    variants.update.mockImplementation(async (_id, data) =>
      buildVariant({ imagePath: data.imagePath ?? null }),
    );

    const result = await service.update('var-1', {}, pngImage());

    expect(imageStorage.save).toHaveBeenCalledTimes(1);
    expect(result.imagePath).toBe('imagesTest/jn001-30-azul-456.png');
  });

  it('throws VARIANT_NOT_FOUND when variant missing', async () => {
    variants.findById.mockResolvedValue(null);
    await expect(service.update('missing', { priceCents: 30000 })).rejects.toMatchObject({
      code: 'VARIANT_NOT_FOUND',
      statusCode: 404,
    });
    expect(variants.update).not.toHaveBeenCalled();
  });
});

describe('VariantService.deactivate / reactivate', () => {
  it('deactivates an active variant', async () => {
    variants.findById.mockResolvedValue(buildVariant({ isActive: true }));
    variants.setActive.mockResolvedValue(buildVariant({ isActive: false }));

    const result = await service.deactivate('var-1');

    expect(variants.setActive).toHaveBeenCalledWith('var-1', false);
    expect(result.isActive).toBe(false);
  });

  it('is idempotent when already inactive', async () => {
    variants.findById.mockResolvedValue(buildVariant({ isActive: false }));
    await service.deactivate('var-1');
    expect(variants.setActive).not.toHaveBeenCalled();
  });

  it('reactivates an inactive variant', async () => {
    variants.findById.mockResolvedValue(buildVariant({ isActive: false }));
    variants.setActive.mockResolvedValue(buildVariant({ isActive: true }));

    const result = await service.reactivate('var-1');

    expect(variants.setActive).toHaveBeenCalledWith('var-1', true);
    expect(result.isActive).toBe(true);
  });

  it('throws VARIANT_NOT_FOUND on missing variant for both ops', async () => {
    variants.findById.mockResolvedValue(null);
    await expect(service.deactivate('missing')).rejects.toMatchObject({
      code: 'VARIANT_NOT_FOUND',
      statusCode: 404,
    });
    await expect(service.reactivate('missing')).rejects.toMatchObject({
      code: 'VARIANT_NOT_FOUND',
      statusCode: 404,
    });
  });
});
