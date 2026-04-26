// Defense-in-depth scrubber for audit payloads. Even if a future caller
// accidentally puts a secret in the payload, this function redacts it before
// the row hits the audit_logs table.
//
// Sensitive keys are matched case-insensitively. Detection covers:
//   - exact matches: password, passwordhash, accesstoken, refreshtoken,
//     authorization, secret, token, jwt, cookie, apikey, api_key
//   - substring matches via *_PATTERNS so things like `oldPassword`,
//     `newPasswordHash`, `bearerToken` also redact.
//
// Redaction value is `'[REDACTED]'` so reviewers know "something was here but
// we removed it" instead of silently dropping the key.

const REDACTED = '[REDACTED]';

const EXACT_KEYS = new Set(
  [
    'password',
    'passwordhash',
    'oldpassword',
    'newpassword',
    'currentpassword',
    'accesstoken',
    'refreshtoken',
    'bearertoken',
    'authorization',
    'auth',
    'secret',
    'token',
    'jwt',
    'cookie',
    'apikey',
    'api_key',
    'csrf',
    'session',
  ].map((s) => s.toLowerCase()),
);

// Substring patterns — match if any of these appears in the key (already
// lower-cased). Lets us catch things like `myPasswordOverride` or
// `extraTokenForX`. Kept short to avoid false positives.
const SUBSTRING_PATTERNS = ['password', 'token', 'secret', 'apikey'];

function shouldRedact(key: string): boolean {
  const lower = key.toLowerCase();
  if (EXACT_KEYS.has(lower)) return true;
  return SUBSTRING_PATTERNS.some((p) => lower.includes(p));
}

/**
 * Returns a deep clone of `payload` where any sensitive key is replaced with
 * `'[REDACTED]'`. Idempotent: safe to call multiple times. Does not mutate
 * the input. Arrays are recursed into; primitives (strings, numbers, booleans,
 * null) pass through unchanged.
 */
export function sanitizeAuditPayload(
  payload: Record<string, unknown> | undefined | null,
): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {};
  return walkObject(payload) as Record<string, unknown>;
}

function walkObject(input: unknown): unknown {
  if (input === null || typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map(walkObject);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (shouldRedact(key)) {
      out[key] = REDACTED;
      continue;
    }
    out[key] = walkObject(value);
  }
  return out;
}
