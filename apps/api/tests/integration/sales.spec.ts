// Integration: /api/v1/stores/:storeId/sales — register sale + history + dashboard.

import request from 'supertest';
import { buildServer } from '../../src/server';
import { disconnectPrisma, getPrisma } from '../../src/infrastructure/database';
import { resetTestState } from './_shared/dbReset';

const app = buildServer();
const db = getPrisma();

const ADMIN_EMAIL = 'admin@demo.local';
const ADMIN_PASSWORD = 'Admin1234';
const ENCARGADA_EMAIL = 'encargada.prado@demo.local';
const VENDEDORA_EMAIL = 'vendedora.prado@demo.local';
const VENDEDORA_ZSUR_EMAIL = 'vendedora.zsur@demo.local';
const STAFF_PASSWORD = 'Pass1234';

interface LoginResponse { accessToken: string }

async function loginToken(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return (res.body as LoginResponse).accessToken;
}

const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

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
let encargadaToken: string;
let vendedoraToken: string;
let vendedoraZsurToken: string;
let pradoStoreId: string;
let testVariantA: string;
let testVariantB: string;
let priceA: number;
let priceB: number;

beforeAll(async () => {
  adminToken = await loginToken(ADMIN_EMAIL, ADMIN_PASSWORD);
  encargadaToken = await loginToken(ENCARGADA_EMAIL, STAFF_PASSWORD);
  vendedoraToken = await loginToken(VENDEDORA_EMAIL, STAFF_PASSWORD);
  vendedoraZsurToken = await loginToken(VENDEDORA_ZSUR_EMAIL, STAFF_PASSWORD);

  const prado = await db.store.findFirst({ where: { code: 'PRADO' } });
  if (!prado) throw new Error('Seed missing PRADO');
  pradoStoreId = prado.id;

  const variants = await db.variant.findMany({
    where: { product: { code: 'JN001' } },
    take: 2,
  });
  if (variants.length < 2) throw new Error('Need ≥2 variants on JN001');
  testVariantA = variants[0]!.id;
  testVariantB = variants[1]!.id;
  priceA = variants[0]!.priceCents;
  priceB = variants[1]!.priceCents;

  await resetTestState({ db, resetStockFor: 'all' });

  // Seed PRADO with stock for the test variants.
  await db.stockBySite.update({
    where: { variantId_storeId: { variantId: testVariantA, storeId: pradoStoreId } },
    data: { quantity: 50 },
  });
  await db.stockBySite.update({
    where: { variantId_storeId: { variantId: testVariantB, storeId: pradoStoreId } },
    data: { quantity: 50 },
  });
});

afterAll(async () => {
  await resetTestState({ db, resetStockFor: 'all' });
  await disconnectPrisma();
});

describe('POST /api/v1/stores/:storeId/sales', () => {
  it('vendedora registers a sale: stock decrements + audit + total snapshot', async () => {
    const res = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/sales`)
      .set(bearer(vendedoraToken))
      .send({
        items: [
          { variantId: testVariantA, quantity: 2 },
          { variantId: testVariantB, quantity: 1 },
        ],
        paymentMethod: 'cash',
      });

    expect(res.status).toBe(201);
    expect(res.body.totalCents).toBe(priceA * 2 + priceB);
    expect(res.body.paymentMethod).toBe('cash');
    expect(res.body.itemCount).toBe(2);
    expect(res.body.totalUnits).toBe(3);

    expect(await waitForAudit('SALE_CREATED')).toBe(true);

    const stock = await db.stockBySite.findUnique({
      where: { variantId_storeId: { variantId: testVariantA, storeId: pradoStoreId } },
    });
    expect(stock?.quantity).toBe(48);

    const movements = await db.stockMovement.findMany({
      where: { storeId: pradoStoreId, type: 'sale_out' },
    });
    expect(movements.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects insufficient stock (409)', async () => {
    const res = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/sales`)
      .set(bearer(adminToken))
      .send({ items: [{ variantId: testVariantA, quantity: 9999 }], paymentMethod: 'qr' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SALE_INSUFFICIENT_STOCK');
  });

  it('rejects unknown variant (404)', async () => {
    const res = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/sales`)
      .set(bearer(adminToken))
      .send({ items: [{ variantId: 'nope', quantity: 1 }], paymentMethod: 'qr' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('SALE_VARIANT_NOT_FOUND');
  });

  it('rejects empty items (400)', async () => {
    const res = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/sales`)
      .set(bearer(adminToken))
      .send({ items: [], paymentMethod: 'cash' });
    expect(res.status).toBe(400);
  });

  it('vendedora ZSUR cannot register sale in PRADO (403 STORE_FORBIDDEN)', async () => {
    const res = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/sales`)
      .set(bearer(vendedoraZsurToken))
      .send({ items: [{ variantId: testVariantA, quantity: 1 }], paymentMethod: 'cash' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('STORE_FORBIDDEN');
  });
});

describe('GET /api/v1/stores/:storeId/sales', () => {
  it('lists sales for the store (vendedora has access)', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/sales`)
      .set(bearer(vendedoraToken));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
  });
});

describe('GET /api/v1/stores/:storeId/sales/:saleId', () => {
  it('returns the sale detail with items', async () => {
    const created = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/sales`)
      .set(bearer(adminToken))
      .send({ items: [{ variantId: testVariantA, quantity: 1 }], paymentMethod: 'card' });

    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/sales/${created.body.id}`)
      .set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toHaveProperty('priceAtSaleCents');
  });
});

describe('GET /api/v1/stores/:storeId/sales/dashboard', () => {
  it('admin/encargada gets dashboard aggregates', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/sales/dashboard`)
      .set(bearer(encargadaToken));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('todayCents');
    expect(res.body).toHaveProperty('weekCents');
    expect(res.body).toHaveProperty('last7Days');
    expect(res.body.last7Days).toHaveLength(7);
    expect(res.body.dailyBreakdown).toHaveLength(5);
    expect(res.body.weeklyBreakdown).toHaveLength(5);
  });

  it('vendedora is blocked (403)', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/sales/dashboard`)
      .set(bearer(vendedoraToken));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SALE_DASHBOARD_FORBIDDEN');
  });
});
