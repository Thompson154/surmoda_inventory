import { create } from 'zustand';

export interface AuthAssignment {
  storeId: string;
  role: 'encargada' | 'vendedora';
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  assignments: AuthAssignment[];
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  setAuth: (input: { accessToken: string; user: AuthUser }) => void;
  setAccessToken: (token: string) => void;
  setUser: (user: AuthUser | null) => void;
  clearAuth: () => void;
}

// WHY: access token MUST live in memory only — never localStorage (Constitution PARTE IV).
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setAuth: ({ accessToken, user }) => set({ accessToken, user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  clearAuth: () => set({ accessToken: null, user: null }),
}));
