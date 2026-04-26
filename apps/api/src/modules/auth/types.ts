import type {
  AuthAssignment as AuthAssignmentContract,
  AuthUser as AuthUserContract,
  LoginCredentials,
  LoginResponse as LoginResponseContract,
  RefreshResponse as RefreshResponseContract,
} from '@surmoda/contracts';

export type LoginDTO = LoginCredentials;
export type AssignmentDTO = AuthAssignmentContract;
export type AuthUserDTO = AuthUserContract;
export type LoginResponse = LoginResponseContract;
export type RefreshResponse = RefreshResponseContract;

// These are BE-only types (no FE equivalent):

export interface IssuedRefreshToken {
  plaintext: string;
  expiresAt: Date;
}

export interface AuthContext {
  userId: string;
  isAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      /** Correlation id stamped by `requestIdMiddleware`. */
      id?: string;
      /** Pino child logger pre-bound to the request id. */
      log?: import('pino').Logger;
    }
  }
}
