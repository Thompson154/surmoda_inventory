import { useMutation, useQueryClient } from '@tanstack/react-query';
import { saleReturnService, type CreateSaleReturnPayload } from '../services/saleReturnService';
import { salesQueryKeys } from '../services/salesService';
import { inventoryQueryKeys } from '@/features/inventory/services/inventoryService';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import type { HttpError } from '@/shared/services/httpClient';

export function useSaleReturn() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (payload: CreateSaleReturnPayload) => saleReturnService.create(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: inventoryQueryKeys.all });
      // WHY: sales dashboard totals reflect returns — keep them fresh.
      void qc.invalidateQueries({ queryKey: salesQueryKeys.all });
    },
  });

  const spanishError = useErrorMessage(mutation.error as HttpError | null | undefined);

  return { ...mutation, spanishError };
}
