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

export const PASSWORD_MIN_LENGTH = 8;
