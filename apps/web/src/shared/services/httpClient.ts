import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { config } from '@/shared/config';

const BASE_URL = config.VITE_API_BASE_URL;

export interface HttpError extends Error {
  status: number;
  code?: string;
  details?: unknown;
}

interface RequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

let refreshInflight: Promise<boolean> | null = null;

async function ensureAccessToken(): Promise<boolean> {
  if (refreshInflight) return refreshInflight;
  refreshInflight = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { accessToken?: string };
      if (!data.accessToken) return false;
      useAuthStore.getState().setAccessToken(data.accessToken);
      return true;
    } catch (err) {
      // Network error or CORS preflight rejection. Surface to console so devtools
      // shows *why* the silent auto-logout happened — production telemetry can
      // hook in here later (Sentry, etc.).

      console.warn('[httpClient] refresh failed:', err);
      return false;
    } finally {
      refreshInflight = null;
    }
  })();
  return refreshInflight;
}

async function rawRequest<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const { skipAuth, body, headers, ...rest } = opts;
  const token = useAuthStore.getState().accessToken;
  const finalHeaders: Record<string, string> = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(token && !skipAuth ? { Authorization: `Bearer ${token}` } : {}),
    ...(headers ?? {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: finalHeaders,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...rest,
  });

  if (res.status === 401 && !skipAuth) {
    const refreshed = await ensureAccessToken();
    if (refreshed) {
      // Retry WITH the fresh token — skipAuth:true would suppress the
      // Authorization header, causing another 401 and destroying the session.
      return rawRequest<T>(method, path, opts);
    }
    useAuthStore.getState().clearAuth();
  }

  if (!res.ok) {
    const data = await safeJson(res);
    const err: HttpError = Object.assign(new Error(data?.message ?? res.statusText), {
      status: res.status,
      code: data?.code,
      details: data?.details,
    });
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function safeJson(
  res: Response,
): Promise<{ code?: string; message?: string; details?: unknown } | null> {
  try {
    return (await res.json()) as { code?: string; message?: string; details?: unknown };
  } catch (err) {
    // Non-JSON error response (HTML 502 page, empty body, etc.). Logging keeps
    // this from being a debug black hole when the BE returns something unexpected.

    console.warn('[httpClient] non-JSON error response:', res.status, err);
    return null;
  }
}

export const httpClient = {
  get: <T>(path: string, opts?: RequestOptions) => rawRequest<T>('GET', path, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    rawRequest<T>('POST', path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    rawRequest<T>('PATCH', path, { ...opts, body }),
  delete: <T>(path: string, opts?: RequestOptions) => rawRequest<T>('DELETE', path, opts),
};
