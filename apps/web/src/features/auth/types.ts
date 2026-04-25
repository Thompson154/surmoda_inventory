export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    isAdmin: boolean;
    assignments: Array<{ storeId: string; role: 'encargada' | 'vendedora' }>;
  };
}

export interface RefreshResponse {
  accessToken: string;
}
