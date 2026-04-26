// T102 — useAssignments hook tests (R4 MSW)
// WHY: verify that assignment list, add, change role, and remove hooks
//      call the correct endpoints and handle the confirm flag properly.

import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, it, expect } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useAssignments,
  useAddAssignment,
  useChangeAssignmentRole,
  useRemoveAssignment,
} from '../useAssignments';
import { server } from '@/test/server';
import { makeQueryClient } from '@/test/utils';

const USER_ID = 'user-1';

function makeWrapper() {
  const client = makeQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return QueryClientProvider({ client, children }) as JSX.Element;
  };
}

describe('useAssignments', () => {
  it('fetches assignments list for a userId', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/users/:userId/assignments', () =>
        HttpResponse.json({
          items: [
            {
              id: 'asgn-1',
              userId: USER_ID,
              storeId: 'store-prado-seed',
              role: 'vendedora',
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          ],
        }),
      ),
    );

    const { result } = renderHook(() => useAssignments(USER_ID), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const items = result.current.data?.items ?? [];
    expect(items).toHaveLength(1);
    expect(items.at(0)?.storeId).toBe('store-prado-seed');
  });

  it('useAddAssignment POSTs to the assignments endpoint', async () => {
    let postCalled = false;
    server.use(
      http.post('http://localhost:3000/api/v1/users/:userId/assignments', () => {
        postCalled = true;
        return HttpResponse.json(
          {
            id: 'asgn-new',
            userId: USER_ID,
            storeId: 'store-zsur-seed',
            role: 'encargada',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          { status: 201 },
        );
      }),
    );

    const { result } = renderHook(() => useAddAssignment(USER_ID), { wrapper: makeWrapper() });

    result.current.mutate({ storeId: 'store-zsur-seed', role: 'encargada' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(postCalled).toBe(true);
  });

  it('useChangeAssignmentRole PATCHes the correct assignment', async () => {
    let patchedAssignmentId = '';
    server.use(
      http.patch('http://localhost:3000/api/v1/users/:userId/assignments/:id', ({ params }) => {
        patchedAssignmentId = params.id as string;
        return HttpResponse.json({
          id: params.id,
          userId: USER_ID,
          storeId: 'store-prado-seed',
          role: 'encargada',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        });
      }),
    );

    const { result } = renderHook(() => useChangeAssignmentRole(USER_ID), {
      wrapper: makeWrapper(),
    });

    result.current.mutate({ assignmentId: 'asgn-42', payload: { role: 'encargada' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(patchedAssignmentId).toBe('asgn-42');
  });

  it('useRemoveAssignment DELETEs with ?confirm=true when confirm flag is set', async () => {
    let deletedUrl = '';
    server.use(
      http.delete('http://localhost:3000/api/v1/users/:userId/assignments/:id', ({ request }) => {
        deletedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useRemoveAssignment(USER_ID), { wrapper: makeWrapper() });

    result.current.mutate({ assignmentId: 'asgn-99', confirm: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deletedUrl).toContain('confirm=true');
  });
});
