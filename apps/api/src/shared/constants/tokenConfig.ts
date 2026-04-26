import { loadConfig } from '../../infrastructure/config';

export function accessTokenTtlMin(): number {
  return loadConfig().ACCESS_TOKEN_TTL_MIN;
}

export function refreshTokenTtlDays(): number {
  return loadConfig().REFRESH_TOKEN_TTL_DAYS;
}

export function bcryptSaltRounds(): number {
  return loadConfig().BCRYPT_SALT_ROUNDS;
}

// Production-grade password rules.
// 12 chars + at least one letter + at least one digit. We deliberately do NOT
// require special chars or mixed case — research consistently shows complexity
// rules push users to predictable patterns. Length is the dominant factor.
// References: NIST SP 800-63B §5.1.1, OWASP ASVS 4.0 V2.1.
export const PASSWORD_MIN_LENGTH = 12;

/** Validates that the candidate password meets the production policy. */
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{12,}$/;
export const PASSWORD_RULES_MESSAGE =
  'La contraseña debe tener al menos 12 caracteres, incluir al menos una letra y un dígito.';
