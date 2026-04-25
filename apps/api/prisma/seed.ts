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
    variants: [
      { size: Size.standard, color: 'beish', priceCents: 35000 },
    ],
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
    create: { id: STORE_ALMACEN, code: 'ALMACEN', name: 'Almacén Central', kind: StoreKind.warehouse },
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

  // eslint-disable-next-line no-console
  console.info(
    `Seed OK — admin: ${admin.email}; staff: 4 users; assignments: ${assignments.length}; ` +
      `placeholder stores: ${STORE_PRADO}, ${STORE_ZSUR}, ${STORE_ALMACEN}; ` +
      `products: ${productCount}; variants created: ${variantCount}`,
  );
}

main()
  .catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
