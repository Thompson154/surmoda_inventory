// Integration: /api/v1/audit-logs — admin/encargada read access to the
// immutable audit log produced by every domain mutation.
// Module 12 of the constitution.

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
  if (res.status !== 200) throw new Error(`Login failed: ${res.status}`);
  return (res.body as LoginResponse).accessToken;
}

const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

let adminToken: string;
let encargadaToken: string;
let vendedoraToken: string;

beforeAll(async () => {
  adminToken = await loginToken(ADMIN_EMAIL, ADMIN_PASSWORD);
  encargadaToken = await loginToken(ENCARGADA_EMAIL, STAFF_PASSWORD);
  vendedoraToken = await loginToken(VENDEDORA_EMAIL, STAFF_PASSWORD);
});

afterAll(async () => {
  await resetTestState({ db, resetStockFor: 'all' });
  await disconnectPrisma();
});

describe('GET /api/v1/audit-logs', () => {
  it('admin gets a paginated list with totals', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs?page=1&pageSize=10')
      .set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total');
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(10);
    expect(Array.isArray(res.body.items)).toBe(true);
    if (res.body.items.length > 0) {
      const first = res.body.items[0];
      expect(first).toHaveProperty('action');
      expect(first).toHaveProperty('entity');
      expect(first).toHaveProperty('timestamp');
    }
  });

  it('encargada (global) is allowed', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs?pageSize=5')
      .set(bearer(encargadaToken));
    expect(res.status).toBe(200);
  });

  it('vendedora is forbidden (403 STORE_FORBIDDEN)', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs')
      .set(bearer(vendedoraToken));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('STORE_FORBIDDEN');
  });

  it('rejects an unauthenticated request (401)', async () => {
    const res = await request(app).get('/api/v1/audit-logs');
    expect(res.status).toBe(401);
  });

  it('clamps pageSize to the 200 maximum', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs?pageSize=999')
      .set(bearer(adminToken));
    // Validator rejects > 200 outright with a 400 (zod max).
    expect(res.status).toBe(400);
  });
});
