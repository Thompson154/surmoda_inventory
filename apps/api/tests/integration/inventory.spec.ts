// Integration: /api/v1/stores/:storeId/{inventory|movements|edit-permission}
// Full RBAC matrix + audit emission + atomic update.

import request from 'supertest';
import { buildServer } from '../../src/server';
import { disconnectPrisma, getPrisma } from '../../src/infrastructure/database';

const app = buildServer();
const db = getPrisma();

const ADMIN_EMAIL = 'admin@demo.local';
const ADMIN_PASSWORD = 'Admin1234';
const ENCARGADA_PRADO_EMAIL = 'encargada.prado@demo.local';
const VENDEDORA_PRADO_EMAIL = 'vendedora.prado@demo.local';
const VENDEDORA_ZSUR_EMAIL = 'vendedora.zsur@demo.local';
const STAFF_PASSWORD = 'Pass1234';

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

async function waitForAudit(action: string, attempts = 20): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    const row = await db.auditLog.findFirst({
      where: { action },
      orderBy: { timestamp: 'desc' },
    });
    if (row) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
}

let adminToken: string;
let encargadaPradoToken: string;
let vendedoraPradoToken: string;
let vendedoraZsurToken: string;

let pradoStoreId: string;
let zsurStoreId: string;
let testVariantId: string;

beforeAll(async () => {
  adminToken = await loginToken(ADMIN_EMAIL, ADMIN_PASSWORD);
  encargadaPradoToken = await loginToken(ENCARGADA_PRADO_EMAIL, STAFF_PASSWORD);
  vendedoraPradoToken = await loginToken(VENDEDORA_PRADO_EMAIL, STAFF_PASSWORD);
  vendedoraZsurToken = await loginToken(VENDEDORA_ZSUR_EMAIL, STAFF_PASSWORD);

  const prado = await db.store.findFirst({ where: { code: 'PRADO' } });
  const zsur = await db.store.findFirst({ where: { code: 'ZSUR' } });
  if (!prado || !zsur) throw new Error('Seed missing PRADO/ZSUR stores');
  pradoStoreId = prado.id;
  zsurStoreId = zsur.id;

  const variant = await db.variant.findFirst({ where: { product: { code: 'JN001' } } });
  if (!variant) throw new Error('Seed missing JN001 variant');
  testVariantId = variant.id;

  // Self-contained: reset state we depend on regardless of suite order.
  await db.stockMovement.deleteMany({});
  await db.stockBySite.updateMany({ data: { quantity: 0 } });
});

afterAll(async () => {
  // Reset state
  await db.stockMovement.deleteMany({});
  await db.storeEditPermission.deleteMany({});
  await db.stockBySite.updateMany({ data: { quantity: 0 } });
  await db.auditLog.deleteMany({ where: { entity: { in: ['Stock', 'StoreEditPermission'] } } });
  await disconnectPrisma();
});

describe('GET /api/v1/stores/:storeId/inventory', () => {
  it('admin lists PRADO inventory (200)', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/inventory`)
      .set(await bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items[0]).toHaveProperty('barcode');
    expect(res.body.items[0]).toHaveProperty('quantity');
  });

  it('vendedora PRADO can list her store (200)', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/inventory`)
      .set(await bearer(vendedoraPradoToken));
    expect(res.status).toBe(200);
  });

  it('vendedora PRADO gets 404 when listing ZSUR (no leak)', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${zsurStoreId}/inventory`)
      .set(await bearer(vendedoraPradoToken));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('STOCK_NOT_FOUND');
  });

  it('search by product code matches', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/inventory?q=JN001`)
      .set(await bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((r: { productCode: string }) => r.productCode === 'JN001')).toBe(true);
  });
});

describe('PATCH /api/v1/stores/:storeId/inventory/:variantId', () => {
  it('admin adjusts quantity, emits audit + movement', async () => {
    const res = await request(app)
      .patch(`/api/v1/stores/${pradoStoreId}/inventory/${testVariantId}`)
      .set(await bearer(adminToken))
      .send({ quantity: 50, reason: 'recepción' });

    expect(res.status).toBe(200);
    expect(res.body.quantity).toBe(50);
    expect(res.body.delta).toBe(50);
    expect(res.body.previous).toBe(0);
    expect(await waitForAudit('INVENTORY_QUANTITY_ADJUSTED')).toBe(true);

    const movement = await db.stockMovement.findFirst({
      where: { storeId: pradoStoreId, variantId: testVariantId, type: 'adjusted' },
      orderBy: { createdAt: 'desc' },
    });
    expect(movement).not.toBeNull();
    expect((movement?.payload as { delta: number }).delta).toBe(50);
  });

  it('vendedora is blocked when toggle is OFF (default)', async () => {
    const res = await request(app)
      .patch(`/api/v1/stores/${pradoStoreId}/inventory/${testVariantId}`)
      .set(await bearer(vendedoraPradoToken))
      .send({ quantity: 99 });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('STOCK_VENDEDORA_EDIT_DISABLED');
  });

  it('vendedora can adjust after encargada toggles ON', async () => {
    const toggleRes = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/edit-permission`)
      .set(await bearer(encargadaPradoToken))
      .send({ isEnabled: true });
    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.isEnabled).toBe(true);

    const res = await request(app)
      .patch(`/api/v1/stores/${pradoStoreId}/inventory/${testVariantId}`)
      .set(await bearer(vendedoraPradoToken))
      .send({ quantity: 75 });

    expect(res.status).toBe(200);
    expect(res.body.quantity).toBe(75);

    // Reset for downstream tests
    await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/edit-permission`)
      .set(await bearer(encargadaPradoToken))
      .send({ isEnabled: false });
  });

  it('rejects negative quantity (400)', async () => {
    const res = await request(app)
      .patch(`/api/v1/stores/${pradoStoreId}/inventory/${testVariantId}`)
      .set(await bearer(adminToken))
      .send({ quantity: -1 });
    expect(res.status).toBe(400);
  });

  it('vendedora ZSUR cannot adjust PRADO (404)', async () => {
    const res = await request(app)
      .patch(`/api/v1/stores/${pradoStoreId}/inventory/${testVariantId}`)
      .set(await bearer(vendedoraZsurToken))
      .send({ quantity: 100 });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/stores/:storeId/inventory/by-barcode/:barcode', () => {
  it('returns variant by barcode for assigned vendedora', async () => {
    const variant = await db.variant.findFirst({ where: { product: { code: 'JN001' } } });
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/inventory/by-barcode/${variant?.barcode}`)
      .set(await bearer(vendedoraPradoToken));
    expect(res.status).toBe(200);
    expect(res.body.barcode).toBe(variant?.barcode);
  });

  it('returns 404 when barcode unknown', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/inventory/by-barcode/UNKNOWN12`)
      .set(await bearer(adminToken));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('STOCK_BARCODE_NOT_FOUND');
  });
});

describe('GET /api/v1/stores/:storeId/movements', () => {
  it('admin lists movements desc', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/movements`)
      .set(await bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items[0]).toHaveProperty('userFullName');
    expect(res.body.items[0]).toHaveProperty('type');
  });

  it('vendedora is blocked (403)', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/movements`)
      .set(await bearer(vendedoraPradoToken));
    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/stores/:storeId/edit-permission', () => {
  it('encargada toggles, audit emitted', async () => {
    const res = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/edit-permission`)
      .set(await bearer(encargadaPradoToken))
      .send({ isEnabled: true });
    expect(res.status).toBe(200);
    expect(res.body.isEnabled).toBe(true);
    expect(await waitForAudit('STORE_EDIT_PERMISSION_TOGGLED')).toBe(true);
    // Cleanup
    await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/edit-permission`)
      .set(await bearer(encargadaPradoToken))
      .send({ isEnabled: false });
  });

  it('vendedora cannot toggle (403)', async () => {
    const res = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/edit-permission`)
      .set(await bearer(vendedoraPradoToken))
      .send({ isEnabled: true });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/stores/:storeId/edit-permission', () => {
  it('returns current state for assigned user', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/edit-permission`)
      .set(await bearer(vendedoraPradoToken));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('isEnabled');
  });
});

describe('Encargada is global operator (RBAC update)', () => {
  it('encargada PRADO can list ZSUR inventory (encargada acts globally)', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${zsurStoreId}/inventory`)
      .set(await bearer(encargadaPradoToken));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('encargada PRADO can view ZSUR movements', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${zsurStoreId}/movements`)
      .set(await bearer(encargadaPradoToken));
    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/stores/:storeId/inventory/grouped', () => {
  it('returns one row per product code with totalQuantity and variantsCount', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/inventory/grouped`)
      .set(await bearer(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
    const first = res.body.items[0];
    expect(first).toHaveProperty('productCode');
    expect(first).toHaveProperty('totalQuantity');
    expect(first).toHaveProperty('variantsCount');
  });

  it('search filters by product code', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/inventory/grouped?q=JN001`)
      .set(await bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.items.every((r: { productCode: string }) => r.productCode === 'JN001')).toBe(true);
  });
});

describe('GET /api/v1/stores/:storeId/inventory/grouped/:productId', () => {
  it('returns the variants of that product in the store', async () => {
    const product = await db.product.findFirst({ where: { code: 'JN001' } });
    expect(product).not.toBeNull();

    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/inventory/grouped/${product?.id}`)
      .set(await bearer(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items[0]).toHaveProperty('quantity');
    expect(res.body.items[0]).toHaveProperty('barcode');
  });

  it('returns 404 INVENTORY_PRODUCT_NOT_IN_STORE for unknown product', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/inventory/grouped/missing-prod-id`)
      .set(await bearer(adminToken));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INVENTORY_PRODUCT_NOT_IN_STORE');
  });
});
