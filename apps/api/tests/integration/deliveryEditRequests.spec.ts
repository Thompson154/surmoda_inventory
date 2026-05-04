// Integration: /api/v1/deliveries/:id/edit-requests + /api/v1/delivery-edit-requests
// Wave 5 — vendedora/encargada submit edit requests on sent deliveries; admin reviews.

import request from 'supertest';
import { buildServer } from '../../src/server';
import { disconnectPrisma, getPrisma } from '../../src/infrastructure/database';
import { resetTestState } from './_shared/dbReset';
import { loginAs, bearer } from './_shared/fixtures';

const app = buildServer();
const db = getPrisma();

const VALID_REASON =
  'La cantidad enviada no coincide con la realidad porque el lote llegó con paquetes dañados que necesitan revisión.';

let adminToken: string;
let encargadaToken: string;

let warehouseId: string;
let pradoStoreId: string;
let testVariantA: string;
let sentDeliveryId: string;

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

beforeAll(async () => {
  adminToken = await loginAs(app, 'admin');
  encargadaToken = await loginAs(app, 'encargadaPrado');

  const wh = await db.store.findFirst({ where: { code: 'ALMACEN' } });
  const prado = await db.store.findFirst({ where: { code: 'PRADO' } });
  if (!wh || !prado) throw new Error('Seed missing ALMACEN/PRADO');
  warehouseId = wh.id;
  pradoStoreId = prado.id;

  const variants = await db.variant.findMany({
    where: { product: { code: 'JN001' } },
    take: 1,
  });
  if (variants.length < 1) throw new Error('Need ≥1 variant on JN001');
  testVariantA = variants[0]!.id;

  await resetTestState({ db, resetStockFor: 'all' });

  // Seed warehouse stock + create a sent delivery to PRADO.
  await db.stockBySite.update({
    where: { variantId_storeId: { variantId: testVariantA, storeId: warehouseId } },
    data: { quantity: 100 },
  });
  const sent = await request(app)
    .post(`/api/v1/stores/${pradoStoreId}/deliveries`)
    .set(bearer(encargadaToken))
    .send({
      items: [{ variantId: testVariantA, quantity: 5 }],
      title: 'Wave 5 sent delivery',
    });
  if (sent.status !== 201) {
    throw new Error(`Failed to seed sent delivery: ${sent.status} ${JSON.stringify(sent.body)}`);
  }
  sentDeliveryId = sent.body.id as string;
});

afterAll(async () => {
  await db.deliveryEditRequest.deleteMany({});
  await resetTestState({ db, resetStockFor: 'all' });
  await disconnectPrisma();
});

beforeEach(async () => {
  await db.deliveryEditRequest.deleteMany({});
});

// ─── POST /api/v1/deliveries/:deliveryId/edit-requests ────────────────────────

describe('POST /api/v1/deliveries/:deliveryId/edit-requests', () => {
  it('201: encargada can submit an edit request', async () => {
    const res = await request(app)
      .post(`/api/v1/deliveries/${sentDeliveryId}/edit-requests`)
      .set(bearer(encargadaToken))
      .send({ reason: VALID_REASON });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.deliveryId).toBe(sentDeliveryId);
    expect(await waitForAudit('DELIVERY_EDIT_REQUEST_CREATE')).toBe(true);
  });

  it('400: rejects reason shorter than 50 chars', async () => {
    const res = await request(app)
      .post(`/api/v1/deliveries/${sentDeliveryId}/edit-requests`)
      .set(bearer(encargadaToken))
      .send({ reason: 'corto' });
    expect(res.status).toBe(400);
  });

  it('404: rejects unknown deliveryId', async () => {
    const res = await request(app)
      .post(`/api/v1/deliveries/no-existe/edit-requests`)
      .set(bearer(encargadaToken))
      .send({ reason: VALID_REASON });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('DELIVERY_NOT_FOUND');
  });
});

// ─── GET /api/v1/delivery-edit-requests (admin global queue) ──────────────────

describe('GET /api/v1/delivery-edit-requests', () => {
  it('200: admin sees the global queue', async () => {
    await request(app)
      .post(`/api/v1/deliveries/${sentDeliveryId}/edit-requests`)
      .set(bearer(encargadaToken))
      .send({ reason: VALID_REASON });

    const res = await request(app)
      .get('/api/v1/delivery-edit-requests?status=pending')
      .set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBeGreaterThan(0);
  });

  it('403: non-admin is forbidden from global queue', async () => {
    const res = await request(app)
      .get('/api/v1/delivery-edit-requests')
      .set(bearer(encargadaToken));
    expect(res.status).toBe(403);
  });
});

// ─── POST /:id/approve and /:id/reject ────────────────────────────────────────

describe('POST /api/v1/delivery-edit-requests/:id/approve|reject', () => {
  it('admin approves a pending request', async () => {
    const created = await request(app)
      .post(`/api/v1/deliveries/${sentDeliveryId}/edit-requests`)
      .set(bearer(encargadaToken))
      .send({ reason: VALID_REASON });
    const id = created.body.id as string;

    const res = await request(app)
      .post(`/api/v1/delivery-edit-requests/${id}/approve`)
      .set(bearer(adminToken))
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
    expect(await waitForAudit('DELIVERY_EDIT_REQUEST_APPROVE')).toBe(true);
  });

  it('admin rejects a pending request with reason', async () => {
    const created = await request(app)
      .post(`/api/v1/deliveries/${sentDeliveryId}/edit-requests`)
      .set(bearer(encargadaToken))
      .send({ reason: VALID_REASON });
    const id = created.body.id as string;

    const res = await request(app)
      .post(`/api/v1/delivery-edit-requests/${id}/reject`)
      .set(bearer(adminToken))
      .send({ rejectionReason: 'No procede según política.' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
    expect(await waitForAudit('DELIVERY_EDIT_REQUEST_REJECT')).toBe(true);
  });

  it('non-admin cannot approve', async () => {
    const created = await request(app)
      .post(`/api/v1/deliveries/${sentDeliveryId}/edit-requests`)
      .set(bearer(encargadaToken))
      .send({ reason: VALID_REASON });
    const id = created.body.id as string;

    const res = await request(app)
      .post(`/api/v1/delivery-edit-requests/${id}/approve`)
      .set(bearer(encargadaToken))
      .send({});
    expect(res.status).toBe(403);
  });
});
