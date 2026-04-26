// Integration: GET /api/v1/alerts — operational alerts.

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

interface LoginResponse { accessToken: string }
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

describe('GET /api/v1/alerts', () => {
  it('admin gets a structured response with items + countsByKind', async () => {
    const res = await request(app).get('/api/v1/alerts').set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body).toHaveProperty('countsByKind');
    expect(res.body.countsByKind).toHaveProperty('STOCK_LOW');
    expect(res.body.countsByKind).toHaveProperty('STOCK_OUT_HOT');
    expect(res.body.countsByKind).toHaveProperty('CIERRE_MISSING');
  });

  it('encargada (global) is allowed', async () => {
    const res = await request(app).get('/api/v1/alerts').set(bearer(encargadaToken));
    expect(res.status).toBe(200);
  });

  it('vendedora is blocked (403 STORE_FORBIDDEN)', async () => {
    const res = await request(app).get('/api/v1/alerts').set(bearer(vendedoraToken));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('STORE_FORBIDDEN');
  });

  it('items have required shape: id, kind, severity, message, link, detectedAt, meta', async () => {
    const res = await request(app).get('/api/v1/alerts').set(bearer(adminToken));
    expect(res.status).toBe(200);
    for (const a of res.body.items as Array<Record<string, unknown>>) {
      expect(a).toHaveProperty('id');
      expect(a).toHaveProperty('kind');
      expect(a).toHaveProperty('severity');
      expect(a).toHaveProperty('message');
      expect(a).toHaveProperty('link');
      expect(a).toHaveProperty('detectedAt');
      expect(a).toHaveProperty('meta');
    }
  });
});
