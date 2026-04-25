import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { httpClient } from '@/shared/services/httpClient';
import type {
  CreateProductPayload,
  ListProductsFilters,
  PaginatedProducts,
  Product,
  ProductWithVariants,
  Size,
  UpdateProductPayload,
  Variant,
} from '@surmoda/contracts';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

function buildQueryString(filters: ListProductsFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.isActive !== undefined) params.set('isActive', String(filters.isActive));
  if (filters.includeInactive !== undefined) {
    params.set('includeInactive', String(filters.includeInactive));
  }
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export interface CreateVariantArgs {
  size: Size;
  color: string;
  priceCents: number;
  image?: File | null;
}

export interface UpdateVariantArgs {
  priceCents?: number;
  image?: File | null;
}

interface HttpErrorBody {
  code?: string;
  message?: string;
  details?: unknown;
}

interface VariantHttpError extends Error {
  status: number;
  code?: string;
  details?: unknown;
}

/**
 * Sends a multipart/form-data request to the variant endpoints.
 * httpClient doesn't yet support multipart — this helper handles auth + refresh
 * the same way for these specific routes.
 */
async function multipartRequest<T>(
  method: 'POST' | 'PATCH',
  path: string,
  fields: Record<string, string | number | undefined>,
  image?: File | null,
): Promise<T> {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) formData.append(key, String(value));
  }
  if (image) formData.append('image', image);

  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as HttpErrorBody | null;
    const err: VariantHttpError = Object.assign(new Error(body?.message ?? res.statusText), {
      status: res.status,
      code: body?.code,
      details: body?.details,
    });
    throw err;
  }

  return (await res.json()) as T;
}

export const productsService = {
  list: (filters: ListProductsFilters = {}) =>
    httpClient.get<PaginatedProducts>(`/products${buildQueryString(filters)}`),
  getById: (id: string) => httpClient.get<ProductWithVariants>(`/products/${id}`),
  create: (payload: CreateProductPayload) => httpClient.post<Product>('/products', payload),
  update: (id: string, payload: UpdateProductPayload) =>
    httpClient.patch<Product>(`/products/${id}`, payload),
  deactivate: (id: string) => httpClient.post<Product>(`/products/${id}/deactivate`, undefined),
  reactivate: (id: string) => httpClient.post<Product>(`/products/${id}/reactivate`, undefined),

  createVariant: (productId: string, args: CreateVariantArgs) =>
    multipartRequest<Variant>(
      'POST',
      `/products/${productId}/variants`,
      { size: args.size, color: args.color, priceCents: args.priceCents },
      args.image,
    ),
  updateVariant: (variantId: string, args: UpdateVariantArgs) =>
    multipartRequest<Variant>(
      'PATCH',
      `/variants/${variantId}`,
      { priceCents: args.priceCents },
      args.image,
    ),
  deactivateVariant: (variantId: string) =>
    httpClient.post<Variant>(`/variants/${variantId}/deactivate`, undefined),
  reactivateVariant: (variantId: string) =>
    httpClient.post<Variant>(`/variants/${variantId}/reactivate`, undefined),
};

export const productsQueryKeys = {
  all: ['products'] as const,
  list: (filters: ListProductsFilters) => ['products', 'list', filters] as const,
  detail: (id: string) => ['products', 'detail', id] as const,
};

/**
 * Resolves the public URL for an image path stored in the DB.
 * - Absolute http(s) URLs (Cloudinary) are returned as-is.
 * - Relative paths (local storage) are mapped through the BE static route.
 */
export function getImageUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  const apiBase = BASE_URL.replace(/\/api\/v\d+$/, '');
  const trimmed = imagePath.replace(/^imagesTest\//, '');
  return `${apiBase}/static/images/${trimmed}`;
}
