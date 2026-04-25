import { PrismaClient, Role, StoreKind } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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

  // eslint-disable-next-line no-console
  console.info(
    `Seed OK — admin: ${admin.email}; staff: 4 users; assignments: ${assignments.length}; ` +
      `placeholder stores: ${STORE_PRADO}, ${STORE_ZSUR}, ${STORE_ALMACEN}`,
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
