// T101 — useUsers hook tests (R4 MSW)
// WHY: verify that list, create, and update hooks call the correct endpoints
//      and integrate with TanStack Query correctly.

import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, it, expect, vi } from 'vitest';
import { useUsers, useCreateUser, useUpdateUser } from '../useUsers';
import { server } from '@/test/server';
import { makeQueryClient } from '@/test/utils';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

function makeWrapper() {
  const client = makeQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return QueryClientProvider({ client, children }) as JSX.Element;
  };
}

describe('useUsers', () => {
  it('fetches users list and returns data', async () => {
    const { result } = renderHook(() => useUsers(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const items = result.current.data?.items ?? [];
    expect(items).toHaveLength(1);
    expect(items.at(0)?.email).toBe('test@test.local');
  });

  it('useCreateUser POSTs to /users and returns the created user', async () => {
    let requestCalled = false;
    server.use(
      http.post('http://localhost:3000/api/v1/users', () => {
        requestCalled = true;
        return HttpResponse.json(
          {
            id: 'new-user-1',
            email: 'new@test.local',
            fullName: 'New User',
            isAdmin: false,
            isActive: true,
            assignments: [],
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          { status: 201 },
        );
      }),
    );

    const { result } = renderHook(() => useCreateUser(), { wrapper: makeWrapper() });

    result.current.mutate({
      email: 'new@test.local',
      password: 'password123',
      fullName: 'New User',
      isAdmin: false,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestCalled).toBe(true);
  });

  it('useCreateUser({ onSuccess }) calls the callback with the created user', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useCreateUser({ onSuccess }), {
      wrapper: makeWrapper(),
    });

    result.current.mutate({
      email: 'new@test.local',
      password: 'password123',
      fullName: 'New User',
      isAdmin: false,
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    const [firstCallArgs] = onSuccess.mock.calls;
    expect(firstCallArgs?.[0].email).toBe('test@test.local');
  });

  it('useUpdateUser PATCHes the correct endpoint', async () => {
    let patchedId = '';
    server.use(
      http.patch('http://localhost:3000/api/v1/users/:id', ({ params }) => {
        patchedId = params.id as string;
        return HttpResponse.json({
          id: params.id,
          email: 'test@test.local',
          fullName: 'Updated Name',
          isAdmin: false,
          isActive: true,
          assignments: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        });
      }),
    );

    const { result } = renderHook(() => useUpdateUser('user-abc'), { wrapper: makeWrapper() });

    result.current.mutate({ fullName: 'Updated Name' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(patchedId).toBe('user-abc');
  });
});
