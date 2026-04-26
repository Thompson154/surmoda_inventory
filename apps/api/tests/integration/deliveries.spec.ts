// Integration: /api/v1/stores/:storeId/deliveries — receptions to warehouse +
// distributions warehouse → branch with atomic stock movements + audit.

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
const STAFF_PASSWORD = 'Pass1234';

interface LoginResponse {
  accessToken: string;
}

async function loginToken(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return (res.body as LoginResponse).accessToken;
}

function bearer(token: string) {
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
let encargadaToken: string;
let vendedoraToken: string;
let warehouseId: string;
let pradoStoreId: string;
let testVariantA: string;
let testVariantB: string;

beforeAll(async () => {
  adminToken = await loginToken(ADMIN_EMAIL, ADMIN_PASSWORD);
  encargadaToken = await loginToken(ENCARGADA_EMAIL, STAFF_PASSWORD);
  vendedoraToken = await loginToken(VENDEDORA_EMAIL, STAFF_PASSWORD);

  const wh = await db.store.findFirst({ where: { code: 'ALMACEN' } });
  const prado = await db.store.findFirst({ where: { code: 'PRADO' } });
  if (!wh || !prado) throw new Error('Seed missing ALMACEN/PRADO');
  warehouseId = wh.id;
  pradoStoreId = prado.id;

  const variants = await db.variant.findMany({
    where: { product: { code: 'JN001' } },
    take: 2,
  });
  if (variants.length < 2) throw new Error('Need ≥2 variants on JN001');
  testVariantA = variants[0]!.id;
  testVariantB = variants[1]!.id;

  // Reset stock to 0 across all stores so the test is deterministic.
  await resetTestState({ db, resetStockFor: 'all' });
});

afterAll(async () => {
  await resetTestState({ db, resetStockFor: 'all' });
  await disconnectPrisma();
});

describe('POST /api/v1/stores/:storeId/deliveries (reception)', () => {
  it('admin creates a reception in warehouse: stock increments + audit + delivery_in', async () => {
    const res = await request(app)
      .post(`/api/v1/stores/${warehouseId}/deliveries`)
      .set(bearer(adminToken))
      .send({
        items: [
          { variantId: testVariantA, quantity: 30 },
          { variantId: testVariantB, quantity: 20 },
        ],
        note: 'lote chile',
      });

    expect(res.status).toBe(201);
    expect(res.body.kind).toBe('reception');
    expect(res.body.fromStoreId).toBeNull();
    expect(res.body.toStoreId).toBe(warehouseId);
    expect(res.body.totalUnits).toBe(50);
    expect(res.body.itemCount).toBe(2);

    const stockA = await db.stockBySite.findUnique({
      where: { variantId_storeId: { variantId: testVariantA, storeId: warehouseId } },
    });
    expect(stockA?.quantity).toBe(30);

    expect(await waitForAudit('DELIVERY_CREATED')).toBe(true);

    const movements = await db.stockMovement.findMany({
      where: { storeId: warehouseId, type: 'delivery_in' },
    });
    expect(movements.length).toBeGreaterThanOrEqual(2);
  });

  it('encargada (global) can create reception', async () => {
    const res = await request(app)
      .post(`/api/v1/stores/${warehouseId}/deliveries`)
      .set(bearer(encargadaToken))
      .send({ items: [{ variantId: testVariantA, quantity: 10 }] });
    expect(res.status).toBe(201);
  });

  it('vendedora is blocked (403 DELIVERY_FORBIDDEN)', async () => {
    const res = await request(app)
      .post(`/api/v1/stores/${warehouseId}/deliveries`)
      .set(bearer(vendedoraToken))
      .send({ items: [{ variantId: testVariantA, quantity: 1 }] });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('DELIVERY_FORBIDDEN');
  });

  it('rejects empty items (400 VALIDATION_ERROR)', async () => {
    const res = await request(app)
      .post(`/api/v1/stores/${warehouseId}/deliveries`)
      .set(bearer(adminToken))
      .send({ items: [] });
    expect(res.status).toBe(400);
  });

  it('rejects unknown variant (404 DELIVERY_VARIANT_NOT_FOUND)', async () => {
    const res = await request(app)
      .post(`/api/v1/stores/${warehouseId}/deliveries`)
      .set(bearer(adminToken))
      .send({ items: [{ variantId: 'no-existo', quantity: 1 }] });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('DELIVERY_VARIANT_NOT_FOUND');
  });
});

describe('POST /api/v1/stores/:storeId/deliveries (distribution)', () => {
  it('encargada distributes from warehouse to PRADO: decrement+increment+2 movements', async () => {
    // Reset and seed 100 in warehouse
    await db.stockBySite.update({
      where: { variantId_storeId: { variantId: testVariantA, storeId: warehouseId } },
      data: { quantity: 100 },
    });

    // Feature 011: distribution now follows draft → sent → received. Stock is
    // applied at reception, not at creation. The full flow is: encargada
    // creates (sent) → vendedora at PRADO marks received → stock moves.
    const created = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/deliveries`)
      .set(bearer(encargadaToken))
      .send({ items: [{ variantId: testVariantA, quantity: 25 }] });

    expect(created.status).toBe(201);
    expect(created.body.kind).toBe('distribution');
    expect(created.body.status).toBe('sent');
    expect(created.body.fromStoreId).toBe(warehouseId);
    expect(created.body.toStoreId).toBe(pradoStoreId);

    // Stock NOT yet applied while in `sent`.
    const whSent = await db.stockBySite.findUnique({
      where: { variantId_storeId: { variantId: testVariantA, storeId: warehouseId } },
    });
    expect(whSent?.quantity).toBe(100);

    // Vendedora confirms reception with the original quantities.
    const itemId = (created.body.items as Array<{ id: string; variantId: string }>).find(
      (i) => i.variantId === testVariantA,
    )!.id;
    const received = await request(app)
      .post(`/api/v1/deliveries/${created.body.id as string}/receive`)
      .set(bearer(vendedoraToken))
      .send({ items: [{ deliveryItemId: itemId, receivedQuantity: 25 }] });
    expect(received.status).toBe(200);
    expect(received.body.status).toBe('received');

    const wh = await db.stockBySite.findUnique({
      where: { variantId_storeId: { variantId: testVariantA, storeId: warehouseId } },
    });
    const prado = await db.stockBySite.findUnique({
      where: { variantId_storeId: { variantId: testVariantA, storeId: pradoStoreId } },
    });
    expect(wh?.quantity).toBe(75);
    expect(prado?.quantity).toBe(25);

    const out = await db.stockMovement.findMany({
      where: { storeId: warehouseId, type: 'delivery_out', variantId: testVariantA },
    });
    const inMov = await db.stockMovement.findMany({
      where: { storeId: pradoStoreId, type: 'delivery_in', variantId: testVariantA },
    });
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(inMov.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects when warehouse has insufficient stock at reception (409 DELIVERY_INSUFFICIENT_STOCK)', async () => {
    // Feature 011: stock validation moved from "create" to "receive". Create
    // succeeds because stock isn't reserved yet; only at reception time, when
    // the actual movement happens, do we re-check warehouse balance.
    await db.stockBySite.update({
      where: { variantId_storeId: { variantId: testVariantB, storeId: warehouseId } },
      data: { quantity: 5 },
    });
    const created = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/deliveries`)
      .set(bearer(adminToken))
      .send({ items: [{ variantId: testVariantB, quantity: 10 }] });
    expect(created.status).toBe(201);

    const itemId = (created.body.items as Array<{ id: string; variantId: string }>).find(
      (i) => i.variantId === testVariantB,
    )!.id;
    const recv = await request(app)
      .post(`/api/v1/deliveries/${created.body.id as string}/receive`)
      .set(bearer(vendedoraToken))
      .send({ items: [{ deliveryItemId: itemId, receivedQuantity: 10 }] });
    expect(recv.status).toBe(409);
    expect(recv.body.code).toBe('DELIVERY_INSUFFICIENT_STOCK');
    expect(recv.body.details).toMatchObject({ available: 5, requested: 10 });
  });
});

describe('GET /api/v1/stores/:storeId/deliveries (history)', () => {
  it('lists deliveries for the destination store', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/deliveries`)
      .set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items[0]).toHaveProperty('totalUnits');
    expect(res.body.items[0]).toHaveProperty('createdByFullName');
  });

  it('vendedora can read PRADO deliveries (read-only access)', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/deliveries`)
      .set(bearer(vendedoraToken));
    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/stores/:storeId/deliveries/grouped', () => {
  it('returns one row per product code with totalUnits', async () => {
    const res = await request(app)
      .get(`/api/v1/stores/${pradoStoreId}/deliveries/grouped`)
      .set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items[0]).toHaveProperty('productCode');
    expect(res.body.items[0]).toHaveProperty('totalUnits');
  });
});

describe('GET /api/v1/deliveries/:id', () => {
  it('returns the delivery detail with items', async () => {
    const created = await request(app)
      .post(`/api/v1/stores/${warehouseId}/deliveries`)
      .set(bearer(adminToken))
      .send({ items: [{ variantId: testVariantA, quantity: 1 }] });
    expect(created.status).toBe(201);

    const detail = await request(app)
      .get(`/api/v1/deliveries/${created.body.id}`)
      .set(bearer(adminToken));
    expect(detail.status).toBe(200);
    expect(detail.body.items).toHaveLength(1);
    expect(detail.body.items[0]).toHaveProperty('productCode');
    expect(detail.body.items[0]).toHaveProperty('size');
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/api/v1/deliveries/no-existo')
      .set(bearer(adminToken));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('DELIVERY_NOT_FOUND');
  });
});


describe("Distribution flow: draft → confirm → receive (full + partial)", () => {
  it("draft can be edited, confirmed, then received without adjustments", async () => {
    await db.stockBySite.update({
      where: { variantId_storeId: { variantId: testVariantA, storeId: warehouseId } },
      data: { quantity: 200 },
    });

    // 1. Encargada creates a draft.
    const draft = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/deliveries`)
      .set(bearer(encargadaToken))
      .send({
        items: [{ variantId: testVariantA, quantity: 5 }],
        title: "Reposición lunes",
        asDraft: true,
      });
    expect(draft.status).toBe(201);
    expect(draft.body.status).toBe("draft");

    // 2. Encargada updates the draft items (changed mind).
    const patched = await request(app)
      .patch(`/api/v1/deliveries/${draft.body.id as string}/draft`)
      .set(bearer(encargadaToken))
      .send({ items: [{ variantId: testVariantA, quantity: 7 }] });
    expect(patched.status).toBe(200);
    expect(patched.body.items[0].quantity).toBe(7);

    // 3. Encargada confirms → sent.
    const confirmed = await request(app)
      .post(`/api/v1/deliveries/${draft.body.id as string}/confirm`)
      .set(bearer(encargadaToken))
      .send({});
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.status).toBe("sent");
    expect(confirmed.body.sentAt).not.toBeNull();

    // Stock NOT applied yet.
    const whSent = await db.stockBySite.findUnique({
      where: { variantId_storeId: { variantId: testVariantA, storeId: warehouseId } },
    });
    expect(whSent?.quantity).toBe(200);

    // 4. Vendedora receives with original quantities → received (no partial).
    const itemId = (confirmed.body.items as Array<{ id: string; variantId: string }>).find(
      (i) => i.variantId === testVariantA,
    )!.id;
    const received = await request(app)
      .post(`/api/v1/deliveries/${draft.body.id as string}/receive`)
      .set(bearer(vendedoraToken))
      .send({ items: [{ deliveryItemId: itemId, receivedQuantity: 7 }] });
    expect(received.status).toBe(200);
    expect(received.body.status).toBe("received");
    expect(received.body.adjustments).toHaveLength(0);

    // Stock now applied.
    const whAfter = await db.stockBySite.findUnique({
      where: { variantId_storeId: { variantId: testVariantA, storeId: warehouseId } },
    });
    expect(whAfter?.quantity).toBe(193);
    expect(await waitForAudit("DELIVERY_RECEIVED")).toBe(true);
  });

  it("partial reception records adjustments + emits delivery_received_adjusted movement", async () => {
    await db.stockBySite.update({
      where: { variantId_storeId: { variantId: testVariantA, storeId: warehouseId } },
      data: { quantity: 200 },
    });

    const sent = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/deliveries`)
      .set(bearer(encargadaToken))
      .send({
        items: [{ variantId: testVariantA, quantity: 10 }],
        title: "Mock partial",
      });
    expect(sent.body.status).toBe("sent");

    const itemId = (sent.body.items as Array<{ id: string; variantId: string }>).find(
      (i) => i.variantId === testVariantA,
    )!.id;
    const recv = await request(app)
      .post(`/api/v1/deliveries/${sent.body.id as string}/receive`)
      .set(bearer(vendedoraToken))
      .send({
        items: [
          { deliveryItemId: itemId, receivedQuantity: 8, reason: "2 dañadas" },
        ],
      });
    expect(recv.status).toBe(200);
    expect(recv.body.status).toBe("partial");
    expect(recv.body.adjustments).toHaveLength(1);
    expect(recv.body.adjustments[0]).toMatchObject({
      expectedQty: 10,
      actualQty: 8,
      reason: "2 dañadas",
    });

    const adjMovement = await db.stockMovement.findFirst({
      where: {
        storeId: pradoStoreId,
        type: "delivery_received_adjusted",
        variantId: testVariantA,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(adjMovement).not.toBeNull();
    expect(await waitForAudit("DELIVERY_RECEIVED_PARTIAL")).toBe(true);
  });

  it("rejects receive when received quantity exceeds sent quantity", async () => {
    await db.stockBySite.update({
      where: { variantId_storeId: { variantId: testVariantA, storeId: warehouseId } },
      data: { quantity: 100 },
    });
    const sent = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/deliveries`)
      .set(bearer(encargadaToken))
      .send({ items: [{ variantId: testVariantA, quantity: 5 }], title: "test" });
    const itemId = (sent.body.items as Array<{ id: string; variantId: string }>).find(
      (i) => i.variantId === testVariantA,
    )!.id;
    const recv = await request(app)
      .post(`/api/v1/deliveries/${sent.body.id as string}/receive`)
      .set(bearer(vendedoraToken))
      .send({ items: [{ deliveryItemId: itemId, receivedQuantity: 999 }] });
    expect(recv.status).toBe(400);
  });

  it("rejects double reception (received → sent transition not allowed)", async () => {
    await db.stockBySite.update({
      where: { variantId_storeId: { variantId: testVariantA, storeId: warehouseId } },
      data: { quantity: 100 },
    });
    const sent = await request(app)
      .post(`/api/v1/stores/${pradoStoreId}/deliveries`)
      .set(bearer(encargadaToken))
      .send({ items: [{ variantId: testVariantA, quantity: 1 }], title: "x" });
    const itemId = (sent.body.items as Array<{ id: string; variantId: string }>).find(
      (i) => i.variantId === testVariantA,
    )!.id;
    await request(app)
      .post(`/api/v1/deliveries/${sent.body.id as string}/receive`)
      .set(bearer(vendedoraToken))
      .send({ items: [{ deliveryItemId: itemId, receivedQuantity: 1 }] });
    const second = await request(app)
      .post(`/api/v1/deliveries/${sent.body.id as string}/receive`)
      .set(bearer(vendedoraToken))
      .send({ items: [{ deliveryItemId: itemId, receivedQuantity: 1 }] });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("DELIVERY_INVALID_STATE");
  });
});
