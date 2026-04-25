import type { Role } from '@prisma/client';

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AssignmentDTO {
  storeId: string;
  role: Role;
}

export interface AuthUserDTO {
  id: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  assignments: AssignmentDTO[];
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUserDTO;
}

export interface RefreshResponse {
  accessToken: string;
}

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
    }
  }
}
