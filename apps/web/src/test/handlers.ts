import { http, HttpResponse } from 'msw';

const BASE = 'http://localhost:3000/api/v1';

const fakeUser = {
  id: 'user-1',
  email: 'test@test.local',
  fullName: 'Test User',
  isAdmin: false,
  isActive: true,
  assignments: [],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const fakeAuthUser = {
  id: 'user-1',
  email: 'test@test.local',
  fullName: 'Test User',
  isAdmin: false,
  assignments: [],
};

const fakeAssignment = {
  id: 'asgn-1',
  userId: 'user-1',
  storeId: 'store-prado-seed',
  role: 'vendedora',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

export const handlers = [
  // Auth
  http.post(`${BASE}/auth/login`, () =>
    HttpResponse.json({ accessToken: 'fake-jwt', user: fakeAuthUser }),
  ),

  http.post(`${BASE}/auth/logout`, () => new HttpResponse(null, { status: 204 })),

  http.post(`${BASE}/auth/refresh`, () =>
    HttpResponse.json({ accessToken: 'fresh-jwt' }),
  ),

  http.get(`${BASE}/auth/me`, () => HttpResponse.json(fakeAuthUser)),

  // Users
  http.get(`${BASE}/users`, () =>
    HttpResponse.json({
      items: [
        {
          id: 'user-1',
          email: 'test@test.local',
          fullName: 'Test User',
          isAdmin: false,
          isActive: true,
          assignmentsCount: 0,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    }),
  ),

  http.post(`${BASE}/users`, () => HttpResponse.json(fakeUser, { status: 201 })),

  http.get(`${BASE}/users/:id`, () => HttpResponse.json(fakeUser)),

  http.patch(`${BASE}/users/:id`, () => HttpResponse.json(fakeUser)),

  http.post(`${BASE}/users/:id/deactivate`, () => HttpResponse.json({ ...fakeUser, isActive: false })),

  http.post(`${BASE}/users/:id/reactivate`, () => HttpResponse.json({ ...fakeUser, isActive: true })),

  http.post(`${BASE}/users/:id/password-reset`, () => new HttpResponse(null, { status: 204 })),

  // Assignments
  http.get(`${BASE}/users/:userId/assignments`, () =>
    HttpResponse.json({ items: [] }),
  ),

  http.post(`${BASE}/users/:userId/assignments`, () =>
    HttpResponse.json(fakeAssignment, { status: 201 }),
  ),

  http.patch(`${BASE}/users/:userId/assignments/:id`, () =>
    HttpResponse.json(fakeAssignment),
  ),

  http.delete(`${BASE}/users/:userId/assignments/:id`, () =>
    new HttpResponse(null, { status: 204 }),
  ),
];
