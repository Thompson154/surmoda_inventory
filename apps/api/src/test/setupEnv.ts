// WHY: inject test env vars BEFORE any source module loads. Required because
// `infrastructure/config.ts` validates env on first import and several modules
// (logger, jwt, database) import it eagerly.

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-only-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/proyectodegrado_test';
process.env.BCRYPT_SALT_ROUNDS ??= '4';
process.env.LOG_LEVEL ??= 'silent';
process.env.RATE_LIMIT_LOGIN_PER_MIN ??= '100';
process.env.RATE_LIMIT_REFRESH_PER_MIN ??= '300';

export {};
