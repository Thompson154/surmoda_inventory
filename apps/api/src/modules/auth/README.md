# Module: `auth`

## Responsibility

JWT-based session management. Issues short-lived **access tokens** (HS256, 15 min)
and rotating **refresh tokens** (random 256 bits, 7 days, hashed at rest, family
revocation on replay). Only this module knows how the secret is signed; every
other module that needs `auth.userId` reads `req.auth` populated by `authGuard`.

## Public surface

- `POST /api/v1/auth/login` — email + password → `{ accessToken, user }`, sets
  `refreshToken` httpOnly cookie.
- `POST /api/v1/auth/refresh` — reads cookie → `{ accessToken }`, rotates the
  cookie. Replay (same token used twice) revokes the entire family.
- `POST /api/v1/auth/logout` — revokes only THIS device's refresh token, clears
  cookie.
- `GET  /api/v1/auth/me` — returns the authenticated user.

## Key types

- `LoginInput`, `LoginResult` — `validators.ts` + `service.ts`.
- `AuthContext` — `{ userId, isAdmin }` exposed via `req.auth`.
- `RefreshToken` — Prisma model with `family`, `parentId`, `revokedAt`,
  `replacedByTokenId`. The family graph is what makes replay detection work.

## Invariants (do NOT break)

1. **Tokens never appear in audit payloads.** `auditing/sanitize.ts` redacts
   `token`/`password`/`secret` keys defensively, but services should never
   pass them in the first place.
2. **Refresh-token rotation is single-use.** Receiving the same plaintext twice
   trips replay → the entire family (every refresh token derived from the
   same login) is revoked atomically.
3. **The cookie path is `/api/v1/auth`.** Narrowing breaks logout
   per-device-revocation. See `auth/controller.ts:9` for the rationale.
4. **bcrypt rounds in production must be ≥ 12.** Enforced at boot via
   `infrastructure/config.ts` superRefine.
5. **Login schema accepts any non-empty password** — the strong-password
   policy applies at user creation, not at login (don't lock out legacy
   accounts; don't leak policy through error messages).

## Tests

- Unit: `__tests__/service.spec.ts`, `__tests__/logout.spec.ts`.
- Integration: `tests/integration/auth.logout.spec.ts`,
  `auth.logout.multidevice.spec.ts`.

## Related

- RBAC for store-scoped operations: `apps/api/src/shared/auth/storeScope.ts`.
- Token cleanup cron: `apps/api/src/jobs/refreshTokenCleanup.ts` (deletes
  expired refresh tokens older than 30 days).
