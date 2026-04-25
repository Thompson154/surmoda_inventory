import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { loadConfig } from './config';

export interface AccessTokenPayload {
  sub: string;
  isAdmin: boolean;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const config = loadConfig();
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: `${config.ACCESS_TOKEN_TTL_MIN}m`,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const config = loadConfig();
  const decoded = jwt.verify(token, config.JWT_SECRET) as jwt.JwtPayload;
  if (typeof decoded.sub !== 'string' || typeof decoded.isAdmin !== 'boolean') {
    throw new jwt.JsonWebTokenError('Malformed token payload');
  }
  return { sub: decoded.sub, isAdmin: decoded.isAdmin };
}

// WHY: opaque refresh tokens — random bytes shown to client, only the hash kept in DB.
export function generateRefreshTokenOpaque(): string {
  return randomBytes(64).toString('hex');
}

export function hashRefreshToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

export function refreshTokenExpiresAt(): Date {
  const config = loadConfig();
  return new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export { jwt };
