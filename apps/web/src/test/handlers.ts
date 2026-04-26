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

  // Inventory
  http.get(`${BASE}/stores/:storeId/inventory`, () =>
    HttpResponse.json({
      items: [
        {
          variantId: 'var-1',
          productId: 'prod-1',
          productCode: 'JN001',
          productName: 'Jean Bota Recta',
          size: '30',
          color: 'azul',
          barcode: 'ABC123ABC123',
          priceCents: 25000,
          imagePath: 'imagesTest/JeanAzulBotaRecta.png',
          quantity: 12,
        },
        {
          variantId: 'var-2',
          productId: 'prod-2',
          productCode: 'CHQ001',
          productName: 'Chaqueta clásica',
          size: 'm',
          color: 'negro',
          barcode: 'XYZ987XYZ987',
          priceCents: 45000,
          imagePath: 'imagesTest/chaqueta.png',
          quantity: 5,
        },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    }),
  ),

  http.patch(`${BASE}/stores/:storeId/inventory/:variantId`, async ({ request, params }) => {
    const body = (await request.json()) as { quantity: number; reason?: string };
    return HttpResponse.json({
      variantId: params.variantId,
      productId: 'prod-1',
      productCode: 'JN001',
      productName: 'Jean Bota Recta',
      size: '30',
      color: 'azul',
      barcode: 'ABC123ABC123',
      priceCents: 25000,
      imagePath: null,
      quantity: body.quantity,
      previous: 0,
      delta: body.quantity,
    });
  }),

  http.get(`${BASE}/stores/:storeId/inventory/by-barcode/:barcode`, ({ params }) =>
    HttpResponse.json({
      variantId: 'var-1',
      productId: 'prod-1',
      productCode: 'JN001',
      productName: 'Jean Bota Recta',
      size: '30',
      color: 'azul',
      barcode: params.barcode,
      priceCents: 25000,
      imagePath: null,
      quantity: 10,
    }),
  ),

  http.get(`${BASE}/stores/:storeId/movements`, () =>
    HttpResponse.json({
      items: [
        {
          id: 'mv-1',
          storeId: 'store-prado-seed',
          variantId: 'var-1',
          userId: 'admin-1',
          userFullName: 'Admin Demo',
          type: 'adjusted',
          payload: { delta: 50, previous: 0, next: 50, reason: 'recepción' },
          productCode: 'JN001',
          barcode: 'ABC123ABC123',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    }),
  ),

  http.get(`${BASE}/stores/:storeId/edit-permission`, ({ params }) =>
    HttpResponse.json({
      storeId: params.storeId,
      isEnabled: false,
      toggledByUserId: null,
      toggledAt: null,
    }),
  ),

  http.post(`${BASE}/stores/:storeId/edit-permission`, async ({ request, params }) => {
    const body = (await request.json()) as { isEnabled: boolean };
    return HttpResponse.json({
      storeId: params.storeId,
      isEnabled: body.isEnabled,
      toggledByUserId: 'user-1',
      toggledAt: new Date().toISOString(),
    });
  }),

  // Deliveries
  http.get(`${BASE}/stores/:storeId/deliveries/grouped`, () =>
    HttpResponse.json({
      items: [
        {
          productId: 'prod-1',
          productCode: 'JN001',
          productName: 'Jean Bota Recta',
          imagePath: 'imagesTest/JeanAzulBotaRecta.png',
          totalUnits: 30,
          deliveryCount: 2,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    }),
  ),

  http.get(`${BASE}/stores/:storeId/deliveries`, () =>
    HttpResponse.json({
      items: [
        {
          id: 'del-1',
          number: 1,
          kind: 'distribution',
          status: 'received',
          title: 'Reposición enero',
          fromStoreId: 'store-almacen-seed',
          fromStoreName: 'Almacén Central',
          toStoreId: 'store-prado-seed',
          toStoreName: 'Sucursal Prado',
          createdByUserId: 'user-1',
          createdByFullName: 'Admin Demo',
          receivedByUserId: 'user-2',
          receivedByFullName: 'Vendedora Prado',
          note: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          sentAt: '2024-01-01T00:00:00.000Z',
          receivedAt: '2024-01-01T00:00:00.000Z',
          itemCount: 2,
          totalUnits: 30,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    }),
  ),

  http.get(`${BASE}/deliveries/:id`, ({ params }) =>
    HttpResponse.json({
      id: params.id,
      number: 1,
      kind: 'distribution',
      status: 'received',
      title: 'Reposición enero',
      fromStoreId: 'store-almacen-seed',
      fromStoreName: 'Almacén Central',
      toStoreId: 'store-prado-seed',
      toStoreName: 'Sucursal Prado',
      createdByUserId: 'user-1',
      createdByFullName: 'Admin Demo',
      receivedByUserId: 'user-2',
      receivedByFullName: 'Vendedora Prado',
      note: 'lote enero',
      createdAt: '2024-01-01T00:00:00.000Z',
      sentAt: '2024-01-01T00:00:00.000Z',
      receivedAt: '2024-01-01T00:00:00.000Z',
      itemCount: 1,
      totalUnits: 10,
      items: [
        {
          id: 'di-1',
          variantId: 'var-1',
          quantity: 10,
          receivedQuantity: 10,
          productId: 'prod-1',
          productCode: 'JN001',
          productName: 'Jean Bota Recta',
          size: '30',
          color: 'azul',
          barcode: 'ABC123ABC123',
          imagePath: null,
        },
      ],
      adjustments: [],
    }),
  ),

  http.get(`${BASE}/stores/:storeId/deliveries/intake/lookup`, ({ request }) => {
    const url = new URL(request.url);
    const code = String(url.searchParams.get('code') ?? '').toUpperCase();
    if (code === 'JN001') {
      return HttpResponse.json({
        exists: true,
        productId: 'prod-1',
        productCode: 'JN001',
        productName: 'Jean Bota Recta',
        variants: [
          {
            variantId: 'var-1',
            size: '30',
            color: 'azul',
            priceCents: 30000,
            warehouseQuantity: 12,
            imagePath: null,
          },
        ],
      });
    }
    return HttpResponse.json({
      exists: false,
      productId: null,
      productCode: code,
      productName: null,
      variants: [],
    });
  }),

  http.post(`${BASE}/stores/:storeId/deliveries/intake`, () =>
    HttpResponse.json(
      {
        id: 'del-intake',
        number: 999,
        kind: 'reception',
        status: 'received',
        title: 'Mock intake',
        fromStoreId: null,
        fromStoreName: null,
        toStoreId: 'store-almacen-seed',
        toStoreName: 'Almacén Central',
        createdByUserId: 'user-1',
        createdByFullName: 'Admin Demo',
        receivedByUserId: null,
        receivedByFullName: null,
        note: null,
        createdAt: new Date().toISOString(),
        sentAt: new Date().toISOString(),
        receivedAt: new Date().toISOString(),
        itemCount: 1,
        totalUnits: 20,
        items: [],
        adjustments: [],
      },
      { status: 201 },
    ),
  ),

  http.post(`${BASE}/stores/:storeId/deliveries`, () =>
    HttpResponse.json(
      {
        id: 'del-new',
        number: 99,
        kind: 'distribution',
        status: 'sent',
        title: null,
        fromStoreId: 'store-almacen-seed',
        fromStoreName: 'Almacén Central',
        toStoreId: 'store-prado-seed',
        toStoreName: 'Sucursal Prado',
        createdByUserId: 'user-1',
        createdByFullName: 'Admin Demo',
        receivedByUserId: null,
        receivedByFullName: null,
        note: null,
        createdAt: new Date().toISOString(),
        sentAt: new Date().toISOString(),
        receivedAt: null,
        itemCount: 1,
        totalUnits: 5,
        items: [],
        adjustments: [],
      },
      { status: 201 },
    ),
  ),

  // Sales
  http.get(`${BASE}/stores/:storeId/sales`, () =>
    HttpResponse.json({
      items: [
        {
          id: 'sale-1',
          storeId: 'store-prado-seed',
          storeName: 'Sucursal Prado',
          recordedByUserId: 'user-1',
          recordedByFullName: 'Vendedora Prado',
          paymentMethod: 'cash',
          totalCents: 50000,
          itemCount: 2,
          totalUnits: 3,
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    }),
  ),

  http.post(`${BASE}/stores/:storeId/sales`, () =>
    HttpResponse.json(
      {
        id: 'sale-new',
        storeId: 'store-prado-seed',
        storeName: 'Sucursal Prado',
        recordedByUserId: 'user-1',
        recordedByFullName: 'Vendedora Prado',
        paymentMethod: 'cash',
        totalCents: 25000,
        itemCount: 1,
        totalUnits: 1,
        createdAt: new Date().toISOString(),
        items: [],
      },
      { status: 201 },
    ),
  ),

  http.get(`${BASE}/stores/:storeId/daily-reports`, ({ params }) =>
    HttpResponse.json({
      items: [
        {
          id: 'dr-1',
          storeId: params.storeId,
          date: '2024-01-07',
          totalCents: 448000,
          qrCents: 150000,
          cardCents: 100000,
          cashCents: 198000,
          itemCount: 18,
          transactionsCount: 12,
          closedByUserId: 'user-encargada',
          closedByFullName: 'María Encargada',
          closedAt: '2024-01-08T03:30:00.000Z',
          autoClosed: false,
          attendees: [],
        },
      ],
      total: 1,
      page: 1,
      pageSize: 31,
    }),
  ),

  http.get(`${BASE}/stores/:storeId/daily-reports/:date`, ({ params }) =>
    HttpResponse.json({
      id: 'dr-1',
      storeId: params.storeId,
      date: params.date,
      totalCents: 448000,
      qrCents: 150000,
      cardCents: 100000,
      cashCents: 198000,
      itemCount: 18,
      transactionsCount: 12,
      closedByUserId: 'user-encargada',
      closedByFullName: 'María Encargada',
      closedAt: '2024-01-08T03:30:00.000Z',
      autoClosed: false,
      attendees: [],
    }),
  ),

  http.get(`${BASE}/stores/:storeId/daily-reports/:date/items`, ({ params }) =>
    HttpResponse.json({
      date: params.date,
      items: [
        {
          variantId: 'v-1',
          productCode: 'JN001',
          productName: 'Jeans clásico',
          size: '30',
          color: 'azul',
          barcode: '7770100100012',
          quantity: 5,
          totalCents: 250000,
        },
        {
          variantId: 'v-2',
          productCode: 'CHQ001',
          productName: 'Chaqueta clásica',
          size: 'M',
          color: 'negro',
          barcode: '7770100100029',
          quantity: 2,
          totalCents: 90000,
        },
      ],
    }),
  ),

  http.get(`${BASE}/stores/:storeId/daily-reports/staff`, () =>
    HttpResponse.json({
      items: [
        { userId: 'user-encargada', fullName: 'María Encargada', role: 'encargada' },
        { userId: 'user-vendedora-1', fullName: 'Lucía Vendedora', role: 'vendedora' },
        { userId: 'user-vendedora-2', fullName: 'Sofía Vendedora', role: 'vendedora' },
      ],
    }),
  ),

  http.post(`${BASE}/stores/:storeId/daily-reports/close-today`, ({ params }) =>
    HttpResponse.json({
      id: 'dr-today',
      storeId: params.storeId,
      date: new Date(new Date().getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10),
      totalCents: 60000,
      qrCents: 20000,
      cardCents: 20000,
      cashCents: 20000,
      itemCount: 4,
      transactionsCount: 3,
      closedByUserId: 'user-encargada',
      closedByFullName: 'María Encargada',
      closedAt: new Date().toISOString(),
      autoClosed: false,
      attendees: [],
    }),
  ),

  http.get(`${BASE}/alerts`, () =>
    HttpResponse.json({
      items: [
        {
          id: 'CIERRE_MISSING:store-prado-seed:2026-04-25',
          kind: 'CIERRE_MISSING',
          severity: 'warning',
          message: 'Sucursal Prado: cierre de 2026-04-25 no fue registrado.',
          link: '/sedes/store-prado-seed/ventas',
          detectedAt: new Date().toISOString(),
          meta: { storeId: 'store-prado-seed', date: '2026-04-25' },
        },
        {
          id: 'STOCK_LOW:store-prado-seed:v-1',
          kind: 'STOCK_LOW',
          severity: 'warning',
          message: 'Stock bajo en Sucursal Prado: JN001 · 30 · azul (3 u.)',
          link: '/sedes/store-prado-seed/inventario',
          detectedAt: new Date().toISOString(),
          meta: { storeId: 'store-prado-seed', variantId: 'v-1', productCode: 'JN001', quantity: 3 },
        },
      ],
      countsByKind: { STOCK_LOW: 1, STOCK_OUT_HOT: 0, CIERRE_MISSING: 1 },
    }),
  ),

  http.get(`${BASE}/reports/summary`, ({ request }) => {
    const url = new URL(request.url);
    const from = url.searchParams.get('from') ?? '2026-04-01';
    const to = url.searchParams.get('to') ?? '2026-04-07';
    return HttpResponse.json({
      range: { from, to },
      totals: {
        totalCents: 1_540_000,
        qrCents: 620_000,
        cardCents: 480_000,
        cashCents: 440_000,
        transactionsCount: 84,
        itemCount: 132,
        averageTicketCents: 18333,
      },
      byStore: [
        { storeId: 'store-prado-seed', storeName: 'Sucursal Prado', storeCode: 'PRADO', totalCents: 920_000, transactionsCount: 51 },
        { storeId: 'store-zsur-seed', storeName: 'Sucursal Zona Sur', storeCode: 'ZSUR', totalCents: 620_000, transactionsCount: 33 },
      ],
      topProducts: [
        { variantId: 'v-1', productCode: 'JN001', productName: 'Jeans clásico', size: '30', color: 'azul', quantitySold: 12, totalCents: 360_000 },
        { variantId: 'v-2', productCode: 'CHQ001', productName: 'Chaqueta clásica', size: 'm', color: 'negro', quantitySold: 6, totalCents: 270_000 },
      ],
      topSellers: [
        { userId: 'user-vendedora-1', fullName: 'Lucía Vendedora', transactionsCount: 30, totalCents: 540_000 },
        { userId: 'user-vendedora-2', fullName: 'Sofía Vendedora', transactionsCount: 24, totalCents: 410_000 },
      ],
    });
  }),

  http.get(`${BASE}/stores/:storeId/sales/dashboard`, () =>
    HttpResponse.json({
      todayCents: 448000,
      yesterdayCents: 312000,
      deltaPct: 43.6,
      weekCents: 2206000,
      transactionsCount: 46,
      averageTicketCents: 48000,
      last7Days: [
        { date: '2024-01-01', totalCents: 100000 },
        { date: '2024-01-02', totalCents: 200000 },
        { date: '2024-01-03', totalCents: 150000 },
        { date: '2024-01-04', totalCents: 80000 },
        { date: '2024-01-05', totalCents: 220000 },
        { date: '2024-01-06', totalCents: 280000 },
        { date: '2024-01-07', totalCents: 448000 },
      ],
      dailyBreakdown: Array.from({ length: 5 }).map((_, i) => ({
        date: `2024-01-0${5 - i}`,
        qrCents: 20000,
        cardCents: 20000,
        cashCents: 20000,
        totalCents: 60000,
      })),
      weeklyBreakdown: Array.from({ length: 4 }).map((_, i) => ({
        weekStart: `2024-01-0${1 + i * 7}`.slice(0, 10),
        weekEnd: `2024-01-0${7 + i * 7}`.slice(0, 10),
        qrCents: 200000,
        cardCents: 200000,
        cashCents: 200000,
        totalCents: 600000,
      })),
    }),
  ),
];
