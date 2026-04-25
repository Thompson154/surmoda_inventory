import { http, HttpResponse } from 'msw';

const BASE = 'http://localhost:3000/api/v1';

const STORE_FIXTURES = [
  {
    id: 'store-almacen-seed',
    code: 'ALMACEN',
    name: 'Almacén Central',
    kind: 'warehouse' as const,
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'store-prado-seed',
    code: 'PRADO',
    name: 'Sucursal Prado',
    kind: 'branch' as const,
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'store-zsur-seed',
    code: 'ZSUR',
    name: 'Sucursal Zona Sur',
    kind: 'branch' as const,
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

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

  // Stores
  http.get(`${BASE}/stores`, ({ request }) => {
    const url = new URL(request.url);
    const kind = url.searchParams.get('kind');
    const items = kind ? STORE_FIXTURES.filter((s) => s.kind === kind) : STORE_FIXTURES;
    return HttpResponse.json({ items, total: items.length, page: 1, pageSize: 20 });
  }),

  http.get(`${BASE}/stores/:id`, ({ params }) => {
    const store = STORE_FIXTURES.find((s) => s.id === params.id);
    if (!store) return HttpResponse.json({ code: 'STORE_NOT_FOUND' }, { status: 404 });
    return HttpResponse.json(store);
  }),

  http.post(`${BASE}/stores`, () => HttpResponse.json(STORE_FIXTURES[0], { status: 201 })),

  http.patch(`${BASE}/stores/:id`, () => HttpResponse.json(STORE_FIXTURES[0])),

  http.post(`${BASE}/stores/:id/deactivate`, () =>
    HttpResponse.json({ ...STORE_FIXTURES[1], isActive: false }),
  ),

  http.post(`${BASE}/stores/:id/reactivate`, () =>
    HttpResponse.json({ ...STORE_FIXTURES[1], isActive: true }),
  ),

  // Products
  http.get(`${BASE}/products`, () =>
    HttpResponse.json({
      items: [
        {
          id: 'prod-1',
          code: 'JN001',
          name: 'Jean Bota Recta',
          isActive: true,
          variantsCount: 3,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'prod-2',
          code: 'CHQ001',
          name: 'Chaqueta clásica',
          isActive: true,
          variantsCount: 2,
          createdAt: '2024-01-02T00:00:00.000Z',
        },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    }),
  ),

  http.get(`${BASE}/products/:id`, ({ params }) =>
    HttpResponse.json({
      id: params.id,
      code: 'JN001',
      name: 'Jean Bota Recta',
      description: 'Producto de prueba',
      isActive: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      variants: [
        {
          id: 'var-1',
          productId: params.id,
          size: '30',
          color: 'azul',
          barcode: 'ABC123ABC123',
          priceCents: 25000,
          imagePath: 'imagesTest/JeanAzulBotaRecta.png',
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    }),
  ),

  http.post(`${BASE}/products`, () =>
    HttpResponse.json(
      {
        id: 'new-prod',
        code: 'NEW01',
        name: 'Producto Nuevo',
        description: null,
        isActive: true,
        createdAt: '2024-01-03T00:00:00.000Z',
        updatedAt: '2024-01-03T00:00:00.000Z',
      },
      { status: 201 },
    ),
  ),

  http.patch(`${BASE}/products/:id`, ({ params }) =>
    HttpResponse.json({
      id: params.id,
      code: 'JN001',
      name: 'Renombrado',
      description: null,
      isActive: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }),
  ),

  http.post(`${BASE}/products/:id/deactivate`, ({ params }) =>
    HttpResponse.json({
      id: params.id,
      code: 'JN001',
      name: 'X',
      description: null,
      isActive: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }),
  ),

  http.post(`${BASE}/products/:id/reactivate`, ({ params }) =>
    HttpResponse.json({
      id: params.id,
      code: 'JN001',
      name: 'X',
      description: null,
      isActive: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }),
  ),

  http.post(`${BASE}/products/:productId/variants`, ({ params }) =>
    HttpResponse.json(
      {
        id: 'var-new',
        productId: params.productId,
        size: 'm',
        color: 'negro',
        barcode: 'ABCDEF123456',
        priceCents: 25000,
        imagePath: null,
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      { status: 201 },
    ),
  ),

  http.patch(`${BASE}/variants/:id`, ({ params }) =>
    HttpResponse.json({
      id: params.id,
      productId: 'prod-1',
      size: 'm',
      color: 'negro',
      barcode: 'ABCDEF123456',
      priceCents: 30000,
      imagePath: null,
      isActive: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }),
  ),

  http.post(`${BASE}/variants/:id/deactivate`, ({ params }) =>
    HttpResponse.json({
      id: params.id,
      productId: 'prod-1',
      size: 'm',
      color: 'negro',
      barcode: 'ABCDEF123456',
      priceCents: 25000,
      imagePath: null,
      isActive: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }),
  ),

  http.post(`${BASE}/variants/:id/reactivate`, ({ params }) =>
    HttpResponse.json({
      id: params.id,
      productId: 'prod-1',
      size: 'm',
      color: 'negro',
      barcode: 'ABCDEF123456',
      priceCents: 25000,
      imagePath: null,
      isActive: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }),
  ),
];
