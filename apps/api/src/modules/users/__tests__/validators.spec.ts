// Production-grade password rules verification.
// Constitution PARTE IV requires the user CRUD layer to enforce these.

import { CreateUserSchema, ResetPasswordSchema } from '../validators';

describe('CreateUserSchema — strong password policy', () => {
  const baseValid = {
    email: 'new@demo.local',
    fullName: 'Test User',
    isAdmin: true,
  } as const;

  it('accepts a 12-char password with letters and digits', () => {
    const r = CreateUserSchema.safeParse({ ...baseValid, password: 'AbCdEf123456' });
    expect(r.success).toBe(true);
  });

  it('rejects passwords shorter than 12 chars', () => {
    const r = CreateUserSchema.safeParse({ ...baseValid, password: 'Short1' });
    expect(r.success).toBe(false);
  });

  it('rejects passwords without any digit', () => {
    const r = CreateUserSchema.safeParse({ ...baseValid, password: 'OnlyLettersHere' });
    expect(r.success).toBe(false);
  });

  it('rejects passwords without any letter', () => {
    const r = CreateUserSchema.safeParse({ ...baseValid, password: '1234567890123' });
    expect(r.success).toBe(false);
  });

  it('rejects empty password', () => {
    const r = CreateUserSchema.safeParse({ ...baseValid, password: '' });
    expect(r.success).toBe(false);
  });
});

describe('ResetPasswordSchema — same policy', () => {
  it('accepts a strong new password', () => {
    const r = ResetPasswordSchema.safeParse({ newPassword: 'AbCdEf123456' });
    expect(r.success).toBe(true);
  });
  it('rejects a weak new password', () => {
    const r = ResetPasswordSchema.safeParse({ newPassword: 'short' });
    expect(r.success).toBe(false);
  });
});
