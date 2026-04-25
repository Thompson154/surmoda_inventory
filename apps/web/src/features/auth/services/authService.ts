import { httpClient } from '@/shared/services/httpClient';
import type { LoginCredentials, LoginResponse, RefreshResponse } from '../types';
import type { AuthUser } from '../stores/useAuthStore';

export const authService = {
  login: (creds: LoginCredentials) =>
    httpClient.post<LoginResponse>('/auth/login', creds, { skipAuth: true }),
  refresh: () => httpClient.post<RefreshResponse>('/auth/refresh', undefined, { skipAuth: true }),
  logout: () => httpClient.post<void>('/auth/logout', undefined, { skipAuth: true }),
  me: () => httpClient.get<AuthUser>('/auth/me'),
};
