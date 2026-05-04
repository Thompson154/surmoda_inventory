import { httpClient } from '@/shared/services/httpClient';

export interface CreateDeliveryEditRequestPayload {
  reason: string;
}

export interface DeliveryEditRequest {
  id: string;
  deliveryId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
}

export const deliveryEditRequestService = {
  create: (deliveryId: string, payload: CreateDeliveryEditRequestPayload) =>
    httpClient.post<DeliveryEditRequest>(`/deliveries/${deliveryId}/edit-requests`, payload),
};
