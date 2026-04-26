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

// `namespace Express` is the canonical way Express types are augmented; the
// no-namespace lint rule doesn't have an ES-module equivalent for this case.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
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
