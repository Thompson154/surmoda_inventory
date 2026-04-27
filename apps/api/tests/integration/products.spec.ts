// Integration: /api/v1/products + /api/v1/variants — RBAC matrix, invariants, audit, image upload.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { buildServer } from '../../src/server';
import { disconnectPrisma, getPrisma } from '../../src/infrastructure/database';

// Configure local image storage to a temp dir BEFORE the server boots.
const TEMP_IMAGES_DIR = join(tmpdir(), `surmoda-it-${Date.now()}`);
process.env.IMAGE_STORAGE = 'local';
process.env.IMAGE_STORAGE_LOCAL_DIR = TEMP_IMAGES_DIR;

const app = buildServer();
const db = getPrisma();

const ADMIN_EMAIL = 'admin@demo.local';
const ADMIN_PASSWORD = 'Admin1234';
const VENDEDORA_EMAIL = 'vendedora.prado@demo.local';
const STAFF_PASSWORD = 'Pass1234';

const TEST_PREFIX = 'IT_PRD_';

interface LoginResponse {
  accessToken: string;
}

async function loginToken(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return (res.body as LoginResponse).accessToken;
}

async function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function waitForAudit(action: string, entityId: string, attempts = 20): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    const row = await db.auditLog.findFirst({
      where: { action, entityId },
      orderBy: { timestamp: 'desc' },
    });
    if (row) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
}

let adminToken: string;

beforeAll(async () => {
  await mkdtemp(TEMP_IMAGES_DIR);
  adminToken = await loginToken(ADMIN_EMAIL, ADMIN_PASSWORD);
});

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { entity: 'Variant' } });
  await db.auditLog.deleteMany({ where: { entity: 'Product' } });
  await db.variant.deleteMany({
    where: { product: { code: { startsWith: TEST_PREFIX } } },
  });
  await db.product.deleteMany({ where: { code: { startsWith: TEST_PREFIX } } });
  await rm(TEMP_IMAGES_DIR, { recursive: true, force: true });
  await disconnectPrisma();
});

describe('POST /api/v1/products', () => {
  it('admin creates a product (201) and emits PRODUCT_CREATED audit', async () => {
    const code = `${TEST_PREFIX}NEW1`;
    const res = await request(app)
      .post('/api/v1/products')
      .set(await bearer(adminToken))
      .send({ code, name: 'Producto Nuevo', description: 'descripción' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ code, name: 'Producto Nuevo', isActive: true });
    expect(await waitForAudit('PRODUCT_CREATED', res.body.id)).toBe(true);
  });

  it('rejects duplicate code (409 PRODUCT_DUPLICATE_CODE)', async () => {
    const code = `${TEST_PREFIX}DUP`;
    const first = await request(app)
      .post('/api/v1/products')
      .set(await bearer(adminToken))
      .send({ code, name: 'Primero' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/v1/products')
      .set(await bearer(adminToken))
      .send({ code, name: 'Repetido' });

    expect(second.status).toBe(409);
    expect(second.body.code).toBe('PRODUCT_DUPLICATE_CODE');
  });

  it('rejects invalid code pattern (400)', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set(await bearer(adminToken))
      .send({ code: 'lower', name: 'X' });
    expect(res.status).toBe(400);
  });

  it('rejects vendedora (non-admin) with 403', async () => {
    const vendedoraToken = await loginToken(VENDEDORA_EMAIL, STAFF_PASSWORD);
    const res = await request(app)
      .post('/api/v1/products')
      .set(await bearer(vendedoraToken))
      .send({ code: `${TEST_PREFIX}DENY`, name: 'X' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/products', () => {
  it('admin lists all active products', async () => {
    const res = await request(app)
      .get('/api/v1/products')
      .set(await bearer(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('vendedora can read the catalog (200)', async () => {
    const vendedoraToken = await loginToken(VENDEDORA_EMAIL, STAFF_PASSWORD);
    const res = await request(app)
      .get('/api/v1/products')
      .set(await bearer(vendedoraToken));
    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/v1/products/:id', () => {
  it('admin updates the name and emits PRODUCT_UPDATED', async () => {
    const code = `${TEST_PREFIX}UPD1`;
    const created = await request(app)
      .post('/api/v1/products')
      .set(await bearer(adminToken))
      .send({ code, name: 'Original' });
    expect(created.status).toBe(201);

    const res = await request(app)
      .patch(`/api/v1/products/${created.body.id}`)
      .set(await bearer(adminToken))
      .send({ name: 'Renombrado' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renombrado');
    expect(await waitForAudit('PRODUCT_UPDATED', created.body.id)).toBe(true);
  });

  it('rejects unknown fields (400 — strict schema)', async () => {
    const code = `${TEST_PREFIX}UPD2`;
    const created = await request(app)
      .post('/api/v1/products')
      .set(await bearer(adminToken))
      .send({ code, name: 'Producto' });
    expect(created.status).toBe(201);

    const res = await request(app)
      .patch(`/api/v1/products/${created.body.id}`)
      .set(await bearer(adminToken))
      .send({ kind: 'whatever' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/products/:productId/variants', () => {
  it('admin creates a variant with a deterministic barcode (no image)', async () => {
    const code = `${TEST_PREFIX}VRT1`;
    const created = await request(app)
      .post('/api/v1/products')
      .set(await bearer(adminToken))
      .send({ code, name: 'Producto VRT' });
    expect(created.status).toBe(201);

    const res = await request(app)
      .post(`/api/v1/products/${created.body.id}/variants`)
      .set(await bearer(adminToken))
      .field('size', '30')
      .field('color', 'azul')
      .field('priceCents', '25000');

    expect(res.status).toBe(201);
    expect(res.body.barcode).toMatch(/^[0-9A-F]{12}$/);
    expect(res.body.size).toBe('30');
    expect(res.body.color).toBe('azul');
    expect(await waitForAudit('VARIANT_CREATED', res.body.id)).toBe(true);
  });

  it('rejects duplicate (size, color) tuple (409 VARIANT_DUPLICATE_TUPLE)', async () => {
    const code = `${TEST_PREFIX}VRT2`;
    const created = await request(app)
      .post('/api/v1/products')
      .set(await bearer(adminToken))
      .send({ code, name: 'Producto Dup Tuple' });
    expect(created.status).toBe(201);

    const first = await request(app)
      .post(`/api/v1/products/${created.body.id}/variants`)
      .set(await bearer(adminToken))
      .field('size', 'm')
      .field('color', 'negro')
      .field('priceCents', '30000');
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/api/v1/products/${created.body.id}/variants`)
      .set(await bearer(adminToken))
      .field('size', 'm')
      .field('color', 'negro')
      .field('priceCents', '32000');

    expect(second.status).toBe(409);
    expect(second.body.code).toBe('VARIANT_DUPLICATE_TUPLE');
  });

  it('uploads an image and persists the path (local storage)', async () => {
    const code = `${TEST_PREFIX}VRT3`;
    const created = await request(app)
      .post('/api/v1/products')
      .set(await bearer(adminToken))
      .send({ code, name: 'Producto IMG' });
    expect(created.status).toBe(201);

    // 1x1 PNG fixture
    const pngBuffer = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000005000150bd4e9b0000000049454e44ae426082',
      'hex',
    );

    const res = await request(app)
      .post(`/api/v1/products/${created.body.id}/variants`)
      .set(await bearer(adminToken))
      .field('size', 'l')
      .field('color', 'rojo')
      .field('priceCents', '40000')
      .attach('image', pngBuffer, { filename: 'tiny.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.imagePath).toMatch(/^imagesTest\/.*\.png$/);
  });

  it('rejects an image with invalid MIME type (400)', async () => {
    const code = `${TEST_PREFIX}VRT4`;
    const created = await request(app)
      .post('/api/v1/products')
      .set(await bearer(adminToken))
      .send({ code, name: 'Producto Bad MIME' });
    expect(created.status).toBe(201);

    const res = await request(app)
      .post(`/api/v1/products/${created.body.id}/variants`)
      .set(await bearer(adminToken))
      .field('size', 'm')
      .field('color', 'negro')
      .field('priceCents', '30000')
      .attach('image', Buffer.from('%PDF-1.4'), {
        filename: 'doc.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VARIANT_IMAGE_INVALID_TYPE');
  });

  it('rejects priceCents missing (400 VALIDATION_ERROR)', async () => {
    const code = `${TEST_PREFIX}VRT5`;
    const created = await request(app)
      .post('/api/v1/products')
      .set(await bearer(adminToken))
      .send({ code, name: 'Producto Sin Precio' });
    expect(created.status).toBe(201);

    const res = await request(app)
      .post(`/api/v1/products/${created.body.id}/variants`)
      .set(await bearer(adminToken))
      .field('size', 'm')
      .field('color', 'negro');

    expect(res.status).toBe(400);
  });

  it('rejects creating a variant on an unknown product (404 VARIANT_PRODUCT_NOT_FOUND)', async () => {
    const res = await request(app)
      .post('/api/v1/products/non-existent-id/variants')
      .set(await bearer(adminToken))
      .field('size', 'm')
      .field('color', 'negro')
      .field('priceCents', '30000');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('VARIANT_PRODUCT_NOT_FOUND');
  });
});

describe('PATCH /api/v1/variants/:id', () => {
  it('updates priceCents and emits VARIANT_UPDATED', async () => {
    const code = `${TEST_PREFIX}VUP1`;
    const product = await request(app)
      .post('/api/v1/products')
      .set(await bearer(adminToken))
      .send({ code, name: 'Producto Update Variant' });
    const variant = await request(app)
      .post(`/api/v1/products/${product.body.id}/variants`)
      .set(await bearer(adminToken))
      .field('size', 'm')
      .field('color', 'verde')
      .field('priceCents', '20000');
    expect(variant.status).toBe(201);

    const res = await request(app)
      .patch(`/api/v1/variants/${variant.body.id}`)
      .set(await bearer(adminToken))
      .send({ priceCents: 22000 });

    expect(res.status).toBe(200);
    expect(res.body.priceCents).toBe(22000);
    expect(await waitForAudit('VARIANT_UPDATED', variant.body.id)).toBe(true);
  });

  it('updates size + color and regenerates the barcode', async () => {
    const code = `${TEST_PREFIX}VSC1`;
    const product = await request(app)
      .post('/api/v1/products')
      .set(await bearer(adminToken))
      .send({ code, name: 'Producto SizeColor' });
    const variant = await request(app)
      .post(`/api/v1/products/${product.body.id}/variants`)
      .set(await bearer(adminToken))
      .field('size', 'm')
      .field('color', 'azul')
      .field('priceCents', '20000');
    const originalBarcode = variant.body.barcode;

    const res = await request(app)
      .patch(`/api/v1/variants/${variant.body.id}`)
      .set(await bearer(adminToken))
      .send({ size: 'l', color: 'rojo' });

    expect(res.status).toBe(200);
    expect(res.body.size).toBe('l');
    expect(res.body.color).toBe('rojo');
    expect(res.body.barcode).not.toBe(originalBarcode);
    expect(typeof res.body.barcode).toBe('string');
    expect(res.body.barcode.length).toBe(12);
  });

  it('rejects (size,color) clash with another active variant of the same product (409)', async () => {
    const code = `${TEST_PREFIX}VCL1`;
    const product = await request(app)
      .post('/api/v1/products')
      .set(await bearer(adminToken))
      .send({ code, name: 'Producto Clash' });
    // Variant A occupies (m, blanco)
    await request(app)
      .post(`/api/v1/products/${product.body.id}/variants`)
      .set(await bearer(adminToken))
      .field('size', 'm')
      .field('color', 'blanco')
      .field('priceCents', '15000');
    // Variant B starts at (s, negro), then we try to move it to (m, blanco)
    const variantB = await request(app)
      .post(`/api/v1/products/${product.body.id}/variants`)
      .set(await bearer(adminToken))
      .field('size', 's')
      .field('color', 'negro')
      .field('priceCents', '15000');

    const res = await request(app)
      .patch(`/api/v1/variants/${variantB.body.id}`)
      .set(await bearer(adminToken))
      .send({ size: 'm', color: 'blanco' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('VARIANT_DUPLICATE_TUPLE');
  });
});

describe('PATCH /api/v1/products/:id (code change cascade)', () => {
  it('regenerates barcodes of all active variants when product code changes', async () => {
    const code = `${TEST_PREFIX}CC01`;
    const product = await request(app)
      .post('/api/v1/products')
      .set(await bearer(adminToken))
      .send({ code, name: 'Producto Code Cascade' });
    const v1 = await request(app)
      .post(`/api/v1/products/${product.body.id}/variants`)
      .set(await bearer(adminToken))
      .field('size', 'm')
      .field('color', 'azul')
      .field('priceCents', '15000');
    const v2 = await request(app)
      .post(`/api/v1/products/${product.body.id}/variants`)
      .set(await bearer(adminToken))
      .field('size', 'l')
      .field('color', 'rojo')
      .field('priceCents', '15000');

    const newCode = `${TEST_PREFIX}CC02`;
    const res = await request(app)
      .patch(`/api/v1/products/${product.body.id}`)
      .set(await bearer(adminToken))
      .send({ code: newCode });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(newCode);

    const v1After = await request(app)
      .get(`/api/v1/products/${product.body.id}`)
      .set(await bearer(adminToken));
    const variantsAfter = v1After.body.variants as Array<{ id: string; barcode: string }>;
    const v1Reloaded = variantsAfter.find((v) => v.id === v1.body.id);
    const v2Reloaded = variantsAfter.find((v) => v.id === v2.body.id);
    expect(v1Reloaded?.barcode).toBeDefined();
    expect(v2Reloaded?.barcode).toBeDefined();
    expect(v1Reloaded?.barcode).not.toBe(v1.body.barcode);
    expect(v2Reloaded?.barcode).not.toBe(v2.body.barcode);
  });
});

describe('POST /api/v1/products/:id/deactivate', () => {
  it('blocks deactivation when the product has active variants (409)', async () => {
    const code = `${TEST_PREFIX}DEA1`;
    const product = await request(app)
      .post('/api/v1/products')
      .set(await bearer(adminToken))
      .send({ code, name: 'Producto Bloqueado' });
    await request(app)
      .post(`/api/v1/products/${product.body.id}/variants`)
      .set(await bearer(adminToken))
      .field('size', 'standard')
      .field('color', 'negro')
      .field('priceCents', '15000');

    const res = await request(app)
      .post(`/api/v1/products/${product.body.id}/deactivate`)
      .set(await bearer(adminToken));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PRODUCT_HAS_ACTIVE_VARIANTS');
    expect(res.body.details.activeVariantsCount).toBeGreaterThan(0);
  });

  it('deactivates a product after all variants are deactivated', async () => {
    const code = `${TEST_PREFIX}DEA2`;
    const product = await request(app)
      .post('/api/v1/products')
      .set(await bearer(adminToken))
      .send({ code, name: 'Producto Deactivable' });
    const variant = await request(app)
      .post(`/api/v1/products/${product.body.id}/variants`)
      .set(await bearer(adminToken))
      .field('size', 'standard')
      .field('color', 'negro')
      .field('priceCents', '15000');

    await request(app)
      .post(`/api/v1/variants/${variant.body.id}/deactivate`)
      .set(await bearer(adminToken));

    const res = await request(app)
      .post(`/api/v1/products/${product.body.id}/deactivate`)
      .set(await bearer(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
    expect(await waitForAudit('PRODUCT_DEACTIVATED', product.body.id)).toBe(true);
  });
});
