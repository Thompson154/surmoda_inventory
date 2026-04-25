// Integration: /api/v1/stores — full RBAC matrix + invariants + audit emission.

import request from 'supertest';
import { buildServer } from '../../src/server';
import { getPrisma, disconnectPrisma } from '../../src/infrastructure/database';

const app = buildServer();
const db = getPrisma();

const ADMIN_EMAIL = 'admin@demo.local';
const ADMIN_PASSWORD = 'Admin1234';
const ENCARGADA_PRADO_EMAIL = 'encargada.prado@demo.local';
const VENDEDORA_PRADO_EMAIL = 'vendedora.prado@demo.local';
const VENDEDORA_ZSUR_EMAIL = 'vendedora.zsur@demo.local';
const STAFF_PASSWORD = 'Pass1234';

// WHY: integration tests must not collide with seed/demo store codes (PRADO, ZSUR, ALMACEN).
// All test-created stores use the IT_ prefix and are cleaned up by afterAll.
const TEST_PREFIX = 'IT_';

interface LoginResponse {
  accessToken: string;
}

async function loginToken(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: status=${res.status} body=${JSON.stringify(res.body)}`);
  }
  return (res.body as LoginResponse).accessToken;
}

let adminToken: string;

async function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function waitForAudit(action: string, entityId: string, attempts = 20): Promise<boolean> {
  // WHY: audit writes are fire-and-forget via setImmediate. Poll briefly to avoid flakes.
  for (let i = 0; i < attempts; i += 1) {
    const row = await db.auditLog.findFirst({
      where: { action, entity: 'Store', entityId },
      orderBy: { timestamp: 'desc' },
    });
    if (row) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
}

beforeAll(async () => {
  adminToken = await loginToken(ADMIN_EMAIL, ADMIN_PASSWORD);
});

afterAll(async () => {
  // Hard-cleanup test artifacts before disconnect.
  await db.auditLog.deleteMany({ where: { entity: 'Store' } });
  await db.userStore.deleteMany({ where: { store: { code: { startsWith: TEST_PREFIX } } } });
  await db.store.deleteMany({ where: { code: { startsWith: TEST_PREFIX } } });
  await disconnectPrisma();
});

describe('POST /api/v1/stores', () => {
  it('admin creates a branch store (201) and emits STORE_CREATED audit', async () => {
    const code = `${TEST_PREFIX}NEW1`;
    const res = await request(app)
      .post('/api/v1/stores')
      .set(await bearer(adminToken))
      .send({ code, name: 'Nueva Sucursal', kind: 'branch' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ code, kind: 'branch', isActive: true });
    expect(res.body.id).toBeDefined();

    const audited = await waitForAudit('STORE_CREATED', res.body.id);
    expect(audited).toBe(true);
  });

  it('admin cannot create a SECOND active warehouse (409 STORE_WAREHOUSE_ALREADY_EXISTS)', async () => {
    const res = await request(app)
      .post('/api/v1/stores')
      .set(await bearer(adminToken))
      .send({ code: `${TEST_PREFIX}WH2`, name: 'Almacén Secundario', kind: 'warehouse' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('STORE_WAREHOUSE_ALREADY_EXISTS');
  });

  it('rejects duplicate code (409 STORE_DUPLICATE_CODE)', async () => {
    const code = `${TEST_PREFIX}DUP`;
    const first = await request(app)
      .post('/api/v1/stores')
      .set(await bearer(adminToken))
      .send({ code, name: 'Primero', kind: 'branch' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/v1/stores')
      .set(await bearer(adminToken))
      .send({ code, name: 'Repetido', kind: 'branch' });

    expect(second.status).toBe(409);
    expect(second.body.code).toBe('STORE_DUPLICATE_CODE');
  });

  it('rejects payload with invalid code pattern (400 VALIDATION_ERROR)', async () => {
    const res = await request(app)
      .post('/api/v1/stores')
      .set(await bearer(adminToken))
      .send({ code: 'lower-case', name: 'Nombre', kind: 'branch' });

    expect(res.status).toBe(400);
  });

  it('rejects encargada (non-admin) with 403', async () => {
    const encargadaToken = await loginToken(ENCARGADA_PRADO_EMAIL, STAFF_PASSWORD);

    const res = await request(app)
      .post('/api/v1/stores')
      .set(await bearer(encargadaToken))
      .send({ code: `${TEST_PREFIX}DENY`, name: 'Denegada', kind: 'branch' });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/stores (RBAC scope)', () => {
  it('admin sees all active stores by default', async () => {
    const res = await request(app)
      .get('/api/v1/stores')
      .set(await bearer(adminToken));

    expect(res.status).toBe(200);
    const codes = res.body.items.map((s: { code: string }) => s.code);
    expect(codes).toEqual(expect.arrayContaining(['ALMACEN', 'PRADO', 'ZSUR']));
  });

  it('vendedora sees only her assigned store', async () => {
    const token = await loginToken(VENDEDORA_PRADO_EMAIL, STAFF_PASSWORD);
    const res = await request(app)
      .get('/api/v1/stores')
      .set(await bearer(token));

    expect(res.status).toBe(200);
    const codes = res.body.items.map((s: { code: string }) => s.code);
    expect(codes).toEqual(['PRADO']);
  });

  it('vendedora ZSUR sees only her assigned store', async () => {
    const token = await loginToken(VENDEDORA_ZSUR_EMAIL, STAFF_PASSWORD);
    const res = await request(app)
      .get('/api/v1/stores')
      .set(await bearer(token));

    expect(res.status).toBe(200);
    const codes = res.body.items.map((s: { code: string }) => s.code);
    expect(codes).toEqual(['ZSUR']);
  });
});

describe('GET /api/v1/stores/:id (RBAC scope)', () => {
  it('vendedora hits 404 (no leak) on a store she is not assigned to', async () => {
    const zsur = await db.store.findFirst({ where: { code: 'ZSUR' } });
    expect(zsur).not.toBeNull();
    const token = await loginToken(VENDEDORA_PRADO_EMAIL, STAFF_PASSWORD);

    const res = await request(app)
      .get(`/api/v1/stores/${zsur?.id}`)
      .set(await bearer(token));

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('STORE_NOT_FOUND');
  });

  it('admin retrieves any store by id (200)', async () => {
    const zsur = await db.store.findFirst({ where: { code: 'ZSUR' } });
    expect(zsur).not.toBeNull();

    const res = await request(app)
      .get(`/api/v1/stores/${zsur?.id}`)
      .set(await bearer(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.code).toBe('ZSUR');
  });
});

describe('PATCH /api/v1/stores/:id', () => {
  it('admin updates the name and emits STORE_UPDATED', async () => {
    const code = `${TEST_PREFIX}UPD1`;
    const created = await request(app)
      .post('/api/v1/stores')
      .set(await bearer(adminToken))
      .send({ code, name: 'Original', kind: 'branch' });
    expect(created.status).toBe(201);

    const res = await request(app)
      .patch(`/api/v1/stores/${created.body.id}`)
      .set(await bearer(adminToken))
      .send({ name: 'Renombrada' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renombrada');
    expect(await waitForAudit('STORE_UPDATED', created.body.id)).toBe(true);
  });

  it('rejects `kind` in the body (400 — kind is immutable)', async () => {
    const code = `${TEST_PREFIX}UPD2`;
    const created = await request(app)
      .post('/api/v1/stores')
      .set(await bearer(adminToken))
      .send({ code, name: 'Inmutable', kind: 'branch' });
    expect(created.status).toBe(201);

    const res = await request(app)
      .patch(`/api/v1/stores/${created.body.id}`)
      .set(await bearer(adminToken))
      .send({ kind: 'warehouse' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/stores/:id/deactivate', () => {
  it('blocks deactivation when active assignments exist (409 STORE_HAS_ACTIVE_ASSIGNMENTS)', async () => {
    const prado = await db.store.findFirst({ where: { code: 'PRADO' } });
    expect(prado).not.toBeNull();

    const res = await request(app)
      .post(`/api/v1/stores/${prado?.id}/deactivate`)
      .set(await bearer(adminToken));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('STORE_HAS_ACTIVE_ASSIGNMENTS');
    expect(res.body.details.activeAssignmentsCount).toBeGreaterThan(0);
  });

  it('deactivates a store with no active assignments and emits STORE_DEACTIVATED', async () => {
    const code = `${TEST_PREFIX}DEACT`;
    const created = await request(app)
      .post('/api/v1/stores')
      .set(await bearer(adminToken))
      .send({ code, name: 'A desactivar', kind: 'branch' });
    expect(created.status).toBe(201);

    const res = await request(app)
      .post(`/api/v1/stores/${created.body.id}/deactivate`)
      .set(await bearer(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
    expect(await waitForAudit('STORE_DEACTIVATED', created.body.id)).toBe(true);
  });
});

describe('POST /api/v1/stores/:id/reactivate', () => {
  it('reactivates an inactive branch store and emits STORE_REACTIVATED', async () => {
    const code = `${TEST_PREFIX}REACT`;
    const created = await request(app)
      .post('/api/v1/stores')
      .set(await bearer(adminToken))
      .send({ code, name: 'Reactivable', kind: 'branch' });
    expect(created.status).toBe(201);

    await request(app)
      .post(`/api/v1/stores/${created.body.id}/deactivate`)
      .set(await bearer(adminToken));

    const res = await request(app)
      .post(`/api/v1/stores/${created.body.id}/reactivate`)
      .set(await bearer(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(true);
    expect(await waitForAudit('STORE_REACTIVATED', created.body.id)).toBe(true);
  });
});
