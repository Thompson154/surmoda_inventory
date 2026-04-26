// Single source of truth for test fixtures shared across the integration
// suite. Every spec used to redeclare these constants; consolidating here
// removes the drift risk (two specs disagreeing on what "admin password" is)
// and shrinks the boilerplate at the top of each file.
//
// Values match the seed in `apps/api/prisma/seed.ts`. If the seed changes the
// test users, update only this file.

import request from 'supertest';
import type { Express } from 'express';

export const TEST_CREDENTIALS = {
  admin: { email: 'admin@demo.local', password: 'Admin1234' },
  encargadaPrado: { email: 'encargada.prado@demo.local', password: 'Pass1234' },
  encargadaZsur: { email: 'encargada.zsur@demo.local', password: 'Pass1234' },
  vendedoraPrado: { email: 'vendedora.prado@demo.local', password: 'Pass1234' },
  vendedoraZsur: { email: 'vendedora.zsur@demo.local', password: 'Pass1234' },
} as const;

export type TestRole = keyof typeof TEST_CREDENTIALS;

interface LoginResponse {
  accessToken: string;
}

/**
 * Logs the named test user in via the real auth endpoint and returns the
 * access token. Throws (with the response status + body) if login fails so
 * test failures point at the actual cause instead of a downstream 401.
 */
export async function loginAs(app: Express, role: TestRole): Promise<string> {
  const { email, password } = TEST_CREDENTIALS[role];
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login as ${role} failed: HTTP ${res.status} ${JSON.stringify(res.body)}`);
  }
  return (res.body as LoginResponse).accessToken;
}

/** Bearer token header builder. Avoids re-typing the `Authorization` shape. */
export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
