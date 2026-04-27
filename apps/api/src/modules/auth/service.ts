import bcrypt from 'bcryptjs';
import type { Database } from '../../infrastructure/database';
import {
  generateRefreshTokenOpaque,
  hashRefreshToken,
  refreshTokenExpiresAt,
  signAccessToken,
} from '../../infrastructure/jwt';
import {
  InvalidCredentialsError,
  RefreshTokenExpiredError,
  RefreshTokenNotFoundError,
  TokenReplayError,
  UserInactiveError,
} from '../../shared/errors/authErrors';
import type {
  AuthUserDTO,
  IssuedRefreshToken,
  LoginDTO,
  LoginResponse,
  RefreshResponse,
} from './types';
import type { RefreshTokenRepository } from './repository';

export interface AuthServiceDeps {
  db: Database;
  refreshTokens: RefreshTokenRepository;
}

export interface AuthService {
  login(
    input: LoginDTO,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<LoginResponse & { refreshToken: IssuedRefreshToken }>;
  refresh(
    plaintext: string,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<RefreshResponse & { refreshToken: IssuedRefreshToken }>;
  logout(plaintext: string): Promise<void>;
  me(userId: string): Promise<AuthUserDTO>;
}

export function buildAuthService({ db, refreshTokens }: AuthServiceDeps): AuthService {
  return {
    async login(input, meta) {
      const user = await db.user.findUnique({
        where: { email: input.email },
        include: { assignments: true },
      });
      if (!user) throw new InvalidCredentialsError();
      const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
      if (!passwordOk) throw new InvalidCredentialsError();
      if (!user.isActive) throw new UserInactiveError();

      const plaintext = generateRefreshTokenOpaque();
      const tokenHash = hashRefreshToken(plaintext);
      const expiresAt = refreshTokenExpiresAt();
      await refreshTokens.create({
        userId: user.id,
        tokenHash,
        expiresAt,
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
      });
      const accessToken = signAccessToken({ sub: user.id, isAdmin: user.isAdmin });
      return {
        accessToken,
        user: toAuthUserDTO(user),
        refreshToken: { plaintext, expiresAt },
      };
    },

    async refresh(plaintext, meta) {
      const tokenHash = hashRefreshToken(plaintext);
      const any = await refreshTokens.findAnyByHash(tokenHash);
      if (!any) throw new RefreshTokenNotFoundError();

      if (any.revokedAt) {
        // WHY: a revoked token presented again indicates replay.
        // Revoke the entire family to neutralise the leaked branch.
        await refreshTokens.revokeFamily(any.id);
        throw new TokenReplayError();
      }
      if (any.expiresAt.getTime() < Date.now()) {
        throw new RefreshTokenExpiredError();
      }

      const user = await db.user.findUnique({ where: { id: any.userId } });
      if (!user) throw new RefreshTokenNotFoundError();
      if (!user.isActive) throw new UserInactiveError();

      const newPlain = generateRefreshTokenOpaque();
      const newHash = hashRefreshToken(newPlain);
      const expiresAt = refreshTokenExpiresAt();
      await refreshTokens.rotate(any, {
        userId: user.id,
        tokenHash: newHash,
        expiresAt,
        parentTokenId: any.id,
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
      });
      const accessToken = signAccessToken({ sub: user.id, isAdmin: user.isAdmin });
      return {
        accessToken,
        refreshToken: { plaintext: newPlain, expiresAt },
      };
    },

    async logout(plaintext) {
      const tokenHash = hashRefreshToken(plaintext);
      const any = await refreshTokens.findAnyByHash(tokenHash);
      if (!any) return; // idempotent
      if (any.revokedAt) return;
      await refreshTokens.revokeOne(any.id);
    },

    async me(userId) {
      const user = await db.user.findUnique({
        where: { id: userId },
        include: { assignments: true },
      });
      if (!user) throw new RefreshTokenNotFoundError();
      if (!user.isActive) throw new UserInactiveError();
      return toAuthUserDTO(user);
    },
  };
}

function toAuthUserDTO(user: {
  id: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  assignments: Array<{ storeId: string; role: 'encargada' | 'vendedora' }>;
}): AuthUserDTO {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    isAdmin: user.isAdmin,
    assignments: user.assignments.map((a) => ({ storeId: a.storeId, role: a.role })),
  };
}
