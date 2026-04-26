// Production-grade config validation. We test the hardening rules added in
// Tier 1 (bcrypt floor in prod) plus the existing image-storage cross-field
// rule that prior code shipped without coverage.

import { loadConfig, resetConfigForTests } from '../config';

const BASE_ENV = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://u:p@h:5432/d',
  JWT_SECRET: 'a'.repeat(40),
  COOKIE_DOMAIN: 'surmoda.com',
  FE_ORIGIN: 'https://surmoda.com',
  LOG_LEVEL: 'info',
  IMAGE_STORAGE: 'local',
} satisfies NodeJS.ProcessEnv;

beforeEach(() => resetConfigForTests());

describe('loadConfig — Tier 1 production hardening', () => {
  it('rejects BCRYPT_SALT_ROUNDS < 12 in production', () => {
    expect(() => loadConfig({ ...BASE_ENV, BCRYPT_SALT_ROUNDS: '4' })).toThrow(
      /BCRYPT_SALT_ROUNDS.*12.*production/i,
    );
  });

  it('accepts BCRYPT_SALT_ROUNDS=12 in production', () => {
    const cfg = loadConfig({ ...BASE_ENV, BCRYPT_SALT_ROUNDS: '12' });
    expect(cfg.BCRYPT_SALT_ROUNDS).toBe(12);
  });

  it('accepts low BCRYPT_SALT_ROUNDS in development (test speed)', () => {
    const cfg = loadConfig({
      ...BASE_ENV,
      NODE_ENV: 'development',
      BCRYPT_SALT_ROUNDS: '4',
    });
    expect(cfg.BCRYPT_SALT_ROUNDS).toBe(4);
  });

  it('accepts low BCRYPT_SALT_ROUNDS in test environment', () => {
    const cfg = loadConfig({
      ...BASE_ENV,
      NODE_ENV: 'test',
      BCRYPT_SALT_ROUNDS: '4',
    });
    expect(cfg.BCRYPT_SALT_ROUNDS).toBe(4);
  });

  it('rejects cloudinary mode without all three credentials', () => {
    expect(() =>
      loadConfig({
        ...BASE_ENV,
        IMAGE_STORAGE: 'cloudinary',
        CLOUDINARY_CLOUD_NAME: 'demo',
      }),
    ).toThrow(/CLOUDINARY_API_KEY/);
  });

  it('rejects JWT_SECRET shorter than 32 chars', () => {
    expect(() => loadConfig({ ...BASE_ENV, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('AUDIT_RETENTION_DAYS defaults to 0 (disabled)', () => {
    const cfg = loadConfig({ ...BASE_ENV, BCRYPT_SALT_ROUNDS: '12' });
    expect(cfg.AUDIT_RETENTION_DAYS).toBe(0);
  });

  it('AUDIT_RETENTION_DAYS rejects values >3650', () => {
    expect(() =>
      loadConfig({
        ...BASE_ENV,
        BCRYPT_SALT_ROUNDS: '12',
        AUDIT_RETENTION_DAYS: '5000',
      }),
    ).toThrow();
  });
});
