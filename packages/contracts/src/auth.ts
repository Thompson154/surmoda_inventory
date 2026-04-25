import type { Role } from './roles';

export interface AuthAssignment {
  storeId: string;
  role: Role;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  assignments: AuthAssignment[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface RefreshResponse {
  accessToken: string;
}
