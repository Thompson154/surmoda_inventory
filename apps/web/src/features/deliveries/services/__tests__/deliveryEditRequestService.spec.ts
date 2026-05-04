import { describe, it, expect, vi, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { deliveryEditRequestService } from '../deliveryEditRequestService';
import { server } from '@/test/server';

const BASE = 'http://localhost:3000/api/v1';

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe('deliveryEditRequestService.create', () => {
  it('posts to /deliveries/:id/edit-requests with reason', async () => {
    const captured = vi.fn();
    server.use(
      http.post(`${BASE}/deliveries/del-1/edit-requests`, async ({ request }) => {
        const body = await request.json();
        captured(body);
        return HttpResponse.json(
          {
            id: 'der-1',
            deliveryId: 'del-1',
            reason: 'necesito ajustar las cantidades porque...',
            status: 'pending',
          },
          { status: 201 },
        );
      }),
    );

    const result = await deliveryEditRequestService.create('del-1', {
      reason: 'necesito ajustar las cantidades porque...',
    });

    expect(captured).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'necesito ajustar las cantidades porque...' }),
    );
    expect(result).toMatchObject({ id: 'der-1', deliveryId: 'del-1' });
  });

  it('throws on 400 error from the API', async () => {
    server.use(
      http.post(`${BASE}/deliveries/del-1/edit-requests`, () =>
        HttpResponse.json(
          { code: 'DELIVERY_EDIT_REQUEST_CREATE_REASON_TOO_SHORT', message: 'too short' },
          { status: 400 },
        ),
      ),
    );

    await expect(
      deliveryEditRequestService.create('del-1', { reason: 'corto' }),
    ).rejects.toMatchObject({ code: 'DELIVERY_EDIT_REQUEST_CREATE_REASON_TOO_SHORT' });
  });
});
