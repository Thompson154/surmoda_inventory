// Hooks for the sales report feature.
//   useGenerateReportPreview — query that fetches a JSON preview
//   useDownloadXlsx          — mutation that triggers a browser file download

import { useMutation, useQuery } from '@tanstack/react-query';
import { salesReportService } from '../services/salesReportService';
import type { GenerateReportArgs } from '../types';

export function useGenerateReportPreview(args: GenerateReportArgs | null) {
  return useQuery({
    queryKey: ['reports', 'sales', 'preview', args],
    queryFn: () => salesReportService.getPreview(args!),
    enabled: !!args,
    staleTime: 60_000, // 1 minute — report data doesn't change mid-session
  });
}

export function useDownloadXlsx() {
  return useMutation({
    mutationFn: salesReportService.downloadXlsx,
    onSuccess: ({ blob, filename }) => {
      // Trigger a browser download without navigating away
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });
}
