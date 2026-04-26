import { sanitizeAuditPayload } from '../sanitize';

describe('sanitizeAuditPayload', () => {
  it('passes through a payload with no sensitive keys unchanged in shape', () => {
    const out = sanitizeAuditPayload({ storeId: 's1', quantity: 5, code: 'JN001' });
    expect(out).toEqual({ storeId: 's1', quantity: 5, code: 'JN001' });
  });

  it('redacts exact-match sensitive keys (case-insensitive)', () => {
    const out = sanitizeAuditPayload({
      Password: 'plaintextLeak',
      AccessToken: 'eyJhbGc...',
      refreshToken: 'def502...',
      Authorization: 'Bearer xxx',
      cookie: 'session=abc',
      apiKey: 'k_live_123',
    });
    expect(out).toEqual({
      Password: '[REDACTED]',
      AccessToken: '[REDACTED]',
      refreshToken: '[REDACTED]',
      Authorization: '[REDACTED]',
      cookie: '[REDACTED]',
      apiKey: '[REDACTED]',
    });
  });

  it('redacts substring matches (oldPassword, bearerToken)', () => {
    const out = sanitizeAuditPayload({
      oldPassword: 'a',
      newPasswordHash: 'b',
      myBearerToken: 'c',
      otherSecretValue: 'd',
    });
    expect(out).toEqual({
      oldPassword: '[REDACTED]',
      newPasswordHash: '[REDACTED]',
      myBearerToken: '[REDACTED]',
      otherSecretValue: '[REDACTED]',
    });
  });

  it('recurses into nested objects', () => {
    const out = sanitizeAuditPayload({
      user: { id: 'u1', password: 'leak' },
      meta: { nested: { token: 'xx', safe: 1 } },
    });
    expect(out).toEqual({
      user: { id: 'u1', password: '[REDACTED]' },
      meta: { nested: { token: '[REDACTED]', safe: 1 } },
    });
  });

  it('recurses into arrays', () => {
    const out = sanitizeAuditPayload({
      logins: [
        { email: 'a@b.com', password: '1' },
        { email: 'c@d.com', password: '2' },
      ],
    });
    expect(out).toEqual({
      logins: [
        { email: 'a@b.com', password: '[REDACTED]' },
        { email: 'c@d.com', password: '[REDACTED]' },
      ],
    });
  });

  it('handles null / undefined / empty payload safely', () => {
    expect(sanitizeAuditPayload(null)).toEqual({});
    expect(sanitizeAuditPayload(undefined)).toEqual({});
    expect(sanitizeAuditPayload({})).toEqual({});
  });

  it('does not mutate the input', () => {
    const input = { password: 'x', other: 1 };
    const before = JSON.stringify(input);
    sanitizeAuditPayload(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('keeps primitive values intact for safe keys', () => {
    const out = sanitizeAuditPayload({ count: 0, active: false, name: '' });
    expect(out).toEqual({ count: 0, active: false, name: '' });
  });
});
