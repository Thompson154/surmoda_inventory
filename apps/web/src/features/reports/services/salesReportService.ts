// Service for the POST /api/v1/reports/sales endpoint.
// Two modes:
//   - preview (JSON): returns SalesReportPreview
//   - xlsx (binary): returns Blob + filename extracted from Content-Disposition

import type { GenerateReportArgs, SalesReportPreview } from '../types';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { httpClient } from '@/shared/services/httpClient';
import { config } from '@/shared/config';

const BASE_URL = config.VITE_API_BASE_URL;

export const salesReportService = {
  /** Fetch a preview (JSON) of the sales report. */
  async getPreview(args: GenerateReportArgs): Promise<SalesReportPreview> {
    return httpClient.post<SalesReportPreview>('/reports/sales', {
      ...args,
      format: 'preview',
    });
  },

  /** Download the xlsx binary. Returns the Blob and the suggested filename. */
  async downloadXlsx(args: GenerateReportArgs): Promise<{ blob: Blob; filename: string }> {
    // The shared httpClient only handles JSON. For binary downloads we need raw
    // fetch so we can read the Blob body without JSON.parse blowing up.
    const token = useAuthStore.getState().accessToken;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const res = await fetch(`${BASE_URL}/reports/sales`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ ...args, format: 'xlsx' }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Failed to download xlsx: ${res.status} ${text}`);
    }

    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') ?? '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] ?? 'reporte-ventas.xlsx';

    return { blob, filename };
  },
};
