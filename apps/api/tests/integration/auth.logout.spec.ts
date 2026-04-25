// T090 — Integration: POST /api/v1/auth/logout
// WHY: verifies the HTTP layer clears the cookie and is idempotent (second call still 204).

import request from 'supertest';
import bcrypt from 'bcrypt';
import { buildServer } from '../../src/server';
import { getPrisma, disconnectPrisma } from '../../src/infrastructure/database';

const app = buildServer();
const db = getPrisma();

async function createUserAndLogin() {
  const passwordHash = await bcrypt.hash('Test1234', 4);
  const user = await db.user.create({
    data: {
      email: `logout-t090-${Date.now()}@test.local`,
      passwordHash,
      fullName: 'Logout Tester',
      isAdmin: false,
    },
  });

  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test1234' });

  return { user, cookie: loginRes.headers['set-cookie'] as string[] | undefined };
}

afterAll(async () => {
  await db.refreshToken.deleteMany({});
  await db.user.deleteMany({ where: { email: { contains: 'logout-t090' } } });
  await disconnectPrisma();
});

describe('POST /api/v1/auth/logout', () => {
  it('returns 204 and clears the refreshToken cookie when cookie is present', async () => {
    const { cookie } = await createUserAndLogin();

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie ?? []);

    expect(res.status).toBe(204);
    // The Set-Cookie header should clear the refresh_token cookie (maxAge=0 or Expires in past)
    const setCookieHeader = res.headers['set-cookie'] as string[] | string | undefined;
    const cookieArr = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : setCookieHeader
        ? [setCookieHeader]
        : [];
    const refreshCookie = cookieArr.find((c) => c.startsWith('refreshToken='));
    expect(refreshCookie).toBeDefined();
    // A cleared cookie has an empty value or expires in the past
    expect(refreshCookie).toMatch(/refreshToken=;|refreshToken=$/);
  });

  it('returns 204 (idempotent) when called again after already logged out', async () => {
    const { cookie } = await createUserAndLogin();

    // First logout
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie ?? []);

    // Second logout with same (now-revoked) cookie — still 204
    const secondRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie ?? []);

    expect(secondRes.status).toBe(204);
  });

  it('returns 204 (idempotent) when called without any cookie', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(204);
  });

  it('revokes the refresh token so a subsequent refresh fails', async () => {
    const { cookie } = await createUserAndLogin();

    await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie ?? []);

    // After logout the refresh token must be revoked → refresh should fail
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie ?? []);

    expect(refreshRes.status).not.toBe(200);
  });
});
