// Integration tests: Wave 2 RBAC overhaul + sales business rules.
// Verifies correct authorization across roles and the 30% discount cap.

import request from 'supertest';
import { buildServer } from '../../src/server';
import { disconnectPrisma, getPrisma } from '../../src/infrastructure/database';
import { resetTestState } from './_shared/dbReset';
import { loginAs, bearer } from './_shared/fixtures';

const app = buildServer();
const db = getPrisma();

let adminToken: string;
let encargadaToken: string;
let vendedoraToken: string;
let pradoStoreId: string;
let testVariantId: string;
let testPriceCents: number;

beforeAll(async () => {
  adminToken = await loginAs(app, 'admin');
  encargadaToken = await loginAs(app, 'encargadaPrado');
  vendedoraToken = await loginAs(app, 'vendedoraPrado');

  const prado = await db.store.findFirst({ where: { code: 'PRADO' } });
  if (!prado) throw new Error('Seed missing PRADO store');
  pradoStoreId = prado.id;

  const variant = await db.variant.findFirst({
    where: { product: { code: 'JN001' } },
  });
  if (!variant) throw new Error('Need JN001 variant in seed');
  testVariantId = variant.id;
  testPriceCents = variant.priceCents;

  await resetTestState({ db, resetStockFor: 'all' });

  await db.stockBySite.update({
    where: { variantId_storeId: { variantId: testVariantId, storeId: pradoStoreId } },
    data: { quantity: 100 },
  });
});

afterAll(async () => {
  await resetTestState({ db, resetStockFor: 'all' });
  await disconnectPrisma();
});

// ---------------------------------------------------------------------------
// RBAC: daily-reports close-today
// ---------------------------------------------------------------------------
describe('RBAC — POST /daily-reports/close-today', () => {
  beforeEach(async () => {
    await db.dailyReport.deleteMany({ where: { storeId: pradoStoreId } });
  });

  it('vendedora can close today (200)', async () => {
    const res = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/daily-reports/close-today`)
      .set(bearer(vendedoraToken));
    expect(res.status).toBe(200);
  });

  it('admin can close today (200)', async () => {
    await db.dailyReport.deleteMany({ where: { storeId: pradoStoreId } });
    const res = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/daily-reports/close-today`)
      .set(bearer(adminToken));
    expect(res.status).toBe(200);
  });

  it('encargada is forbidden (403 DAILY_REPORT_FORBIDDEN)', async () => {
    const res = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/daily-reports/close-today`)
      .set(bearer(encargadaToken));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('DAILY_REPORT_FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// RBAC: daily-reports GET (historical)
// ---------------------------------------------------------------------------
describe('RBAC — GET /daily-reports', () => {
  it('vendedora can list reports (200)', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/daily-reports`)
      .set(bearer(vendedoraToken));
    expect(res.status).toBe(200);
  });

  it('encargada can list reports (200)', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/daily-reports`)
      .set(bearer(encargadaToken));
    expect(res.status).toBe(200);
  });

  it('admin can list reports (200)', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/daily-reports`)
      .set(bearer(adminToken));
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// RBAC: sales create
// ---------------------------------------------------------------------------
describe('RBAC — POST /sales', () => {
  it('vendedora can create a sale (201)', async () => {
    const res = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/sales`)
      .set(bearer(vendedoraToken))
      .send({ items: [{ variantId: testVariantId, quantity: 1 }], paymentMethod: 'cash' });
    expect(res.status).toBe(201);
  });

  it('admin can create a sale (201)', async () => {
    const res = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/sales`)
      .set(bearer(adminToken))
      .send({ items: [{ variantId: testVariantId, quantity: 1 }], paymentMethod: 'cash' });
    expect(res.status).toBe(201);
  });

  // WHY: encargada cannot create sales — vendedora-only per RBAC matrix.
  it('encargada is forbidden from creating a sale (403)', async () => {
    const res = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/sales`)
      .set(bearer(encargadaToken))
      .send({ items: [{ variantId: testVariantId, quantity: 1 }], paymentMethod: 'cash' });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// RBAC: sales GET
// ---------------------------------------------------------------------------
describe('RBAC — GET /sales', () => {
  it('vendedora can list sales (200)', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/sales`)
      .set(bearer(vendedoraToken));
    expect(res.status).toBe(200);
  });

  it('encargada can list sales (200)', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/sales`)
      .set(bearer(encargadaToken));
    expect(res.status).toBe(200);
  });

  it('admin can list sales (200)', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/sales`)
      .set(bearer(adminToken));
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Sales business rules: 30% discount cap
// ---------------------------------------------------------------------------
describe('Sales business rules — 30% discount cap', () => {
  it('rejects subtotal that is 35% below total (400 SALE_DISCOUNT_EXCEEDS_LIMIT)', async () => {
    // 65% of totalCents → exceeds 30% discount limit.
    const subtotalCents = Math.floor(testPriceCents * 0.65);

    const res = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/sales`)
      .set(bearer(vendedoraToken))
      .send({
        items: [{ variantId: testVariantId, quantity: 1, subtotalCents }],
        paymentMethod: 'cash',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SALE_DISCOUNT_EXCEEDS_LIMIT');
  });

  it('accepts subtotal at exactly 70% (30% discount — at the limit)', async () => {
    const subtotalCents = Math.ceil(testPriceCents * 0.7);

    const res = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/sales`)
      .set(bearer(vendedoraToken))
      .send({
        items: [{ variantId: testVariantId, quantity: 1, subtotalCents }],
        paymentMethod: 'cash',
      });

    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// Sales business rules: default subtotalCents = totalCents
// ---------------------------------------------------------------------------
describe('Sales business rules — default subtotalCents', () => {
  it('persists subtotalCents = totalCents when no subtotal provided', async () => {
    const res = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/sales`)
      .set(bearer(vendedoraToken))
      .send({
        items: [{ variantId: testVariantId, quantity: 1 }], // no subtotalCents
        paymentMethod: 'cash',
      });

    expect(res.status).toBe(201);
    const item = res.body.items[0];
    // WHY: without subtotalCents, BE defaults to qty × catalogPrice.
    expect(item.subtotalCents).toBe(testPriceCents * 1);
    // totalCents is not exposed in SaleItemDTO contract — only subtotalCents.
    expect(item.subtotalCents).toBeGreaterThan(0);
  });
});
