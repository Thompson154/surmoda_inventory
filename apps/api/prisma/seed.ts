import { PrismaClient, Role, Size, StoreKind } from '@prisma/client';
import bcrypt from 'bcrypt';
import { generateBarcode } from '../src/modules/products/barcode';

const prisma = new PrismaClient();

interface VariantSeed {
  size: Size;
  color: string;
  priceCents: number;
}

interface ProductSeed {
  code: string;
  name: string;
  description?: string;
  imageFileName: string;
  variants: VariantSeed[];
}

const PRODUCT_SEEDS: ProductSeed[] = [
  {
    code: 'CHQ001',
    name: 'Chaqueta clásica',
    description: 'Chaqueta de uso diario, corte regular.',
    imageFileName: 'chaqueta.png',
    variants: [
      { size: Size.m, color: 'negro', priceCents: 45000 },
      { size: Size.l, color: 'negro', priceCents: 45000 },
    ],
  },
  {
    code: 'CHQ002',
    name: 'Chaqueta cintura cuero',
    description: 'Chaqueta con detalle de cuero en cintura.',
    imageFileName: 'chaquetaCinturaCuero.png',
    variants: [
      { size: Size.s, color: 'beish', priceCents: 65000 },
      { size: Size.m, color: 'beish', priceCents: 65000 },
    ],
  },
  {
    code: 'CHQ003',
    name: 'Chaqueta negra',
    description: 'Chaqueta negra entallada.',
    imageFileName: 'chaquetaNegra.png',
    variants: [
      { size: Size.s, color: 'negro', priceCents: 50000 },
      { size: Size.m, color: 'negro', priceCents: 50000 },
      { size: Size.l, color: 'negro', priceCents: 50000 },
    ],
  },
  {
    code: 'CHQ004',
    name: 'Chaqueta polo negro',
    description: 'Chaqueta tipo polo color negro.',
    imageFileName: 'chaquetaPoloNegro.png',
    variants: [
      { size: Size.m, color: 'negro', priceCents: 40000 },
      { size: Size.l, color: 'negro', priceCents: 40000 },
    ],
  },
  {
    code: 'JN001',
    name: 'Jean azul bota recta',
    description: 'Jean clásico color azul, bota recta.',
    imageFileName: 'JeanAzulBotaRecta.png',
    variants: [
      { size: Size.size_28, color: 'azul', priceCents: 30000 },
      { size: Size.size_30, color: 'azul', priceCents: 30000 },
      { size: Size.size_32, color: 'azul', priceCents: 30000 },
    ],
  },
  {
    code: 'PNT001',
    name: 'Pantalón deportivo beish',
    description: 'Pantalón deportivo color beish.',
    imageFileName: 'PantalonDeportivoBeish.png',
    variants: [
      { size: Size.m, color: 'beish', priceCents: 28000 },
      { size: Size.l, color: 'beish', priceCents: 28000 },
    ],
  },
  {
    code: 'PNT002',
    name: 'Pantalón jean',
    description: 'Pantalón jean clásico.',
    imageFileName: 'PantalonJean.png',
    variants: [
      { size: Size.size_30, color: 'azul', priceCents: 32000 },
      { size: Size.size_32, color: 'azul', priceCents: 32000 },
      { size: Size.size_34, color: 'azul', priceCents: 32000 },
    ],
  },
  {
    code: 'PNT003',
    name: 'Pantalón tela beish',
    description: 'Pantalón de tela formal color beish.',
    imageFileName: 'PantalonTelaBeish.png',
    variants: [{ size: Size.standard, color: 'beish', priceCents: 35000 }],
  },
];

const STORE_PRADO = 'store-prado-seed';
const STORE_ZSUR = 'store-zsur-seed';
const STORE_ALMACEN = 'store-almacen-seed';

async function main(): Promise<void> {
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);
  const adminPasswordHash = await bcrypt.hash('Admin1234', saltRounds);
  const staffPasswordHash = await bcrypt.hash('Pass1234', saltRounds);

  await prisma.store.upsert({
    where: { code: 'ALMACEN' },
    update: {},
    create: {
      id: STORE_ALMACEN,
      code: 'ALMACEN',
      name: 'Almacén Central',
      kind: StoreKind.warehouse,
    },
  });
  await prisma.store.upsert({
    where: { code: 'PRADO' },
    update: {},
    create: { id: STORE_PRADO, code: 'PRADO', name: 'Sucursal Prado', kind: StoreKind.branch },
  });
  await prisma.store.upsert({
    where: { code: 'ZSUR' },
    update: {},
    create: { id: STORE_ZSUR, code: 'ZSUR', name: 'Sucursal Zona Sur', kind: StoreKind.branch },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.local' },
    update: {},
    create: {
      email: 'admin@demo.local',
      passwordHash: adminPasswordHash,
      fullName: 'Admin Demo',
      isAdmin: true,
      isActive: true,
    },
  });

  const encargadaPrado = await prisma.user.upsert({
    where: { email: 'encargada.prado@demo.local' },
    update: {},
    create: {
      email: 'encargada.prado@demo.local',
      passwordHash: staffPasswordHash,
      fullName: 'Encargada Prado',
      isAdmin: false,
      isActive: true,
    },
  });

  const vendedoraPrado = await prisma.user.upsert({
    where: { email: 'vendedora.prado@demo.local' },
    update: {},
    create: {
      email: 'vendedora.prado@demo.local',
      passwordHash: staffPasswordHash,
      fullName: 'Vendedora Prado',
      isAdmin: false,
      isActive: true,
    },
  });

  const vendedoraZsur = await prisma.user.upsert({
    where: { email: 'vendedora.zsur@demo.local' },
    update: {},
    create: {
      email: 'vendedora.zsur@demo.local',
      passwordHash: staffPasswordHash,
      fullName: 'Vendedora Z. Sur',
      isAdmin: false,
      isActive: true,
    },
  });

  const multi = await prisma.user.upsert({
    where: { email: 'multi@demo.local' },
    update: {},
    create: {
      email: 'multi@demo.local',
      passwordHash: staffPasswordHash,
      fullName: 'Multi-Store Demo',
      isAdmin: false,
      isActive: true,
    },
  });

  const assignments: Array<{ userId: string; storeId: string; role: Role }> = [
    { userId: encargadaPrado.id, storeId: STORE_PRADO, role: Role.encargada },
    { userId: vendedoraPrado.id, storeId: STORE_PRADO, role: Role.vendedora },
    { userId: vendedoraZsur.id, storeId: STORE_ZSUR, role: Role.vendedora },
    { userId: multi.id, storeId: STORE_PRADO, role: Role.encargada },
    { userId: multi.id, storeId: STORE_ZSUR, role: Role.vendedora },
  ];

  for (const a of assignments) {
    const existing = await prisma.userStore.findFirst({
      where: { userId: a.userId, storeId: a.storeId, deletedAt: null },
    });
    if (!existing) {
      await prisma.userStore.create({ data: a });
    }
  }

  let productCount = 0;
  let variantCount = 0;

  for (const seed of PRODUCT_SEEDS) {
    const product = await prisma.product.upsert({
      where: { code: seed.code },
      update: {},
      create: {
        code: seed.code,
        name: seed.name,
        description: seed.description,
      },
    });
    productCount += 1;

    for (const v of seed.variants) {
      const barcode = generateBarcode(seed.code, v.size, v.color);
      const existing = await prisma.variant.findFirst({
        where: { productId: product.id, size: v.size, color: v.color, deletedAt: null },
      });
      if (!existing) {
        await prisma.variant.create({
          data: {
            productId: product.id,
            size: v.size,
            color: v.color,
            barcode,
            priceCents: v.priceCents,
            imagePath: `imagesTest/${seed.imageFileName}`,
          },
        });
        variantCount += 1;
      }
    }
  }

  // Pre-create StockBySite rows for every (variant × active store) combination,
  // so adjustments are simple updates. Idempotent.
  const allVariants = await prisma.variant.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });
  const allStores = await prisma.store.findMany({
    where: { deletedAt: null, isActive: true },
    select: { id: true },
  });

  // WHY: warehouse gets a non-zero starting stock so deliveries to branches can be tested
  // out of the box. Branches stay at 0 until distribution moves stock to them.
  const WAREHOUSE_DEFAULT_QTY = 50;
  const warehouseStore = allStores.find((s) => s.id === STORE_ALMACEN);

  let stockRowsCreated = 0;
  for (const v of allVariants) {
    for (const s of allStores) {
      const existing = await prisma.stockBySite.findUnique({
        where: { variantId_storeId: { variantId: v.id, storeId: s.id } },
      });
      if (!existing) {
        const isWarehouse = warehouseStore?.id === s.id;
        await prisma.stockBySite.create({
          data: {
            variantId: v.id,
            storeId: s.id,
            quantity: isWarehouse ? WAREHOUSE_DEFAULT_QTY : 0,
          },
        });
        stockRowsCreated += 1;
      }
    }
  }

  // Refill warehouse rows that ended up at 0 (e.g. after integration tests cleared stock).
  // Only touches still-empty rows so real operations are never overwritten.
  let warehouseRefilled = 0;
  if (warehouseStore) {
    const empty = await prisma.stockBySite.findMany({
      where: { storeId: warehouseStore.id, quantity: 0 },
      select: { id: true },
    });
    for (const row of empty) {
      await prisma.stockBySite.update({
        where: { id: row.id },
        data: { quantity: WAREHOUSE_DEFAULT_QTY },
      });
      warehouseRefilled += 1;
    }
  }

  // -----------------------------------------------------------------------------
  // Historical sales + daily-report seed (feature 007 demo flow).
  // Idempotent: only runs when the store has no DailyReport rows yet.
  // -----------------------------------------------------------------------------
  let demoSalesCreated = 0;
  let demoReportsCreated = 0;
  for (const branchId of [STORE_PRADO, STORE_ZSUR]) {
    const existingReports = await prisma.dailyReport.count({ where: { storeId: branchId } });
    if (existingReports > 0) continue;

    const branchVariants = await prisma.variant.findMany({
      where: { deletedAt: null },
      select: { id: true, priceCents: true },
      take: 6,
    });
    if (branchVariants.length === 0) continue;

    const branchSeller = branchId === STORE_PRADO ? vendedoraPrado.id : vendedoraZsur.id;
    const branchEncargada = encargadaPrado.id; // closes both branches in demo
    const TZ_OFFSET_MS = 4 * 60 * 60 * 1000;
    const PMS = ['cash', 'qr', 'card'] as const;
    const today = new Date();
    const todayBoliviaIso = new Date(today.getTime() - TZ_OFFSET_MS).toISOString().slice(0, 10);
    const todayKey = new Date(`${todayBoliviaIso}T00:00:00.000Z`);

    // Generate 14 days of sales (oldest → today). Cierre snapshots cover days 1..7
    // (i.e. the 7 days before today). Today is left open so the user can close it.
    for (let i = 14; i >= 0; i -= 1) {
      const dayKey = new Date(todayKey.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStartUtc = new Date(dayKey.getTime() + TZ_OFFSET_MS); // 00:00 Bolivia
      const salesPerDay = 3 + ((i * 7 + (branchId === STORE_PRADO ? 0 : 1)) % 4); // 3..6

      let totalCents = 0;
      let qrCents = 0;
      let cardCents = 0;
      let cashCents = 0;
      let itemCount = 0;

      for (let s = 0; s < salesPerDay; s += 1) {
        const variant = branchVariants[(i + s) % branchVariants.length]!;
        const qty = 1 + ((i + s) % 3); // 1..3
        const pm = PMS[(i + s) % PMS.length]!;
        const lineTotal = variant.priceCents * qty;
        const createdAt = new Date(dayStartUtc.getTime() + (8 + s * 2) * 60 * 60 * 1000);

        await prisma.sale.create({
          data: {
            storeId: branchId,
            recordedByUserId: branchSeller,
            paymentMethod: pm,
            totalCents: lineTotal,
            createdAt,
            items: {
              create: [
                {
                  variantId: variant.id,
                  quantity: qty,
                  priceAtSaleCents: variant.priceCents,
                  subtotalCents: lineTotal,
                },
              ],
            },
          },
        });
        demoSalesCreated += 1;

        totalCents += lineTotal;
        itemCount += qty;
        if (pm === 'qr') qrCents += lineTotal;
        else if (pm === 'card') cardCents += lineTotal;
        else cashCents += lineTotal;
      }

      // Close every past day (i ≥ 1). Mix manual + auto so the UI badge is visible.
      if (i >= 1) {
        const isAuto = i % 2 === 0;
        const closedAt = new Date(dayStartUtc.getTime() + 23 * 60 * 60 * 1000 + 59 * 60 * 1000);
        await prisma.dailyReport.create({
          data: {
            storeId: branchId,
            date: dayKey,
            totalCents,
            qrCents,
            cardCents,
            cashCents,
            itemCount,
            transactionsCount: salesPerDay,
            closedByUserId: isAuto ? null : branchEncargada,
            closedAt,
            autoClosed: isAuto,
          },
        });
        demoReportsCreated += 1;
      }
    }
  }

  // eslint-disable-next-line no-console
  console.info(
    `Seed OK — admin: ${admin.email}; staff: 4 users; assignments: ${assignments.length}; ` +
      `placeholder stores: ${STORE_PRADO}, ${STORE_ZSUR}, ${STORE_ALMACEN}; ` +
      `products: ${productCount}; variants created: ${variantCount}; ` +
      `stock rows created: ${stockRowsCreated}; ` +
      `warehouse rows refilled to ${WAREHOUSE_DEFAULT_QTY}: ${warehouseRefilled}; ` +
      `demo sales: ${demoSalesCreated}; demo daily reports: ${demoReportsCreated}`,
  );
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
