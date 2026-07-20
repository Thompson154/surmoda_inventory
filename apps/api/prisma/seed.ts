import { PrismaClient, Role, StoreKind } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

const STORE_PRADO = 'store-prado-seed';
const STORE_ZSUR = 'store-zsur-seed';
const STORE_ALMACEN = 'store-almacen-seed';

async function main(): Promise<void> {
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);
  const pwdThompson = await bcrypt.hash('Th0mp$on_88_xZ!2026', saltRounds);
  const pwdMagdalena = await bcrypt.hash('M4gd@lena_Jef4_#91kL', saltRounds);
  const pwdLiz = await bcrypt.hash('L1z_Prad0_%77_sTr', saltRounds);
  const pwdGloria = await bcrypt.hash('Gl0r!a_Zsur_#22_bTr', saltRounds);
  const pwdNoemi = await bcrypt.hash('N0emi_Satel!te_88$x', saltRounds);
  const pwdVendPrado = await bcrypt.hash('Vend_Pr@do_2026!Wq', saltRounds);
  const pwdVendZsur = await bcrypt.hash('Vend_Zsur_%99_Lp$', saltRounds);
  const pwdVendSatelite = await bcrypt.hash('Vend_Sat_#44_Jk!', saltRounds);
  const pwdVendOnline = await bcrypt.hash('Vend_Onl!ne_55*Tr', saltRounds);

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
  await prisma.store.upsert({
    where: { code: 'SATELITE' },
    update: {},
    create: {
      id: 'store-satelite-seed',
      code: 'SATELITE',
      name: 'Sucursal Satélite',
      kind: StoreKind.branch,
    },
  });
  await prisma.store.upsert({
    where: { code: 'ONLINE' },
    update: {},
    create: {
      id: 'store-online-seed',
      code: 'ONLINE',
      name: 'Ventas Online',
      kind: StoreKind.branch,
    },
  });

  await prisma.user.upsert({
    where: { email: 'thompson@surmoda.com.bo' },
    update: { passwordHash: pwdThompson },
    create: {
      email: 'thompson@surmoda.com.bo',
      passwordHash: pwdThompson,
      fullName: 'Administrador Thompson',
      isAdmin: true,
      isActive: true,
    },
  });

  const encargadaPrado = await prisma.user.upsert({
    where: { email: 'liz@surmoda.com.bo' },
    update: { passwordHash: pwdLiz },
    create: {
      email: 'liz@surmoda.com.bo',
      passwordHash: pwdLiz,
      fullName: 'Liz Encargada',
      isAdmin: false,
      isActive: true,
    },
  });

  const encargadaZsur = await prisma.user.upsert({
    where: { email: 'gloria@surmoda.com.bo' },
    update: { passwordHash: pwdGloria },
    create: {
      email: 'gloria@surmoda.com.bo',
      passwordHash: pwdGloria,
      fullName: 'Gloria Encargada',
      isAdmin: false,
      isActive: true,
    },
  });

  const encargadaSatelite = await prisma.user.upsert({
    where: { email: 'noemi@surmoda.com.bo' },
    update: { passwordHash: pwdNoemi },
    create: {
      email: 'noemi@surmoda.com.bo',
      passwordHash: pwdNoemi,
      fullName: 'Noemi Encargada',
      isAdmin: false,
      isActive: true,
    },
  });

  const encargadaJefa = await prisma.user.upsert({
    where: { email: 'magdalena@surmoda.com.bo' },
    update: { passwordHash: pwdMagdalena },
    create: {
      email: 'magdalena@surmoda.com.bo',
      passwordHash: pwdMagdalena,
      fullName: 'Magdalena Encargada Jefa',
      isAdmin: true,
      isActive: true,
    },
  });

  const vendedoraPrado = await prisma.user.upsert({
    where: { email: 'vendedora.prado@surmoda.com.bo' },
    update: { passwordHash: pwdVendPrado },
    create: {
      email: 'vendedora.prado@surmoda.com.bo',
      passwordHash: pwdVendPrado,
      fullName: 'Vendedora Prado',
      isAdmin: false,
      isActive: true,
    },
  });

  const vendedoraZsur = await prisma.user.upsert({
    where: { email: 'vendedora.zsur@surmoda.com.bo' },
    update: { passwordHash: pwdVendZsur },
    create: {
      email: 'vendedora.zsur@surmoda.com.bo',
      passwordHash: pwdVendZsur,
      fullName: 'Vendedora Zona Sur',
      isAdmin: false,
      isActive: true,
    },
  });

  const vendedoraSatelite = await prisma.user.upsert({
    where: { email: 'vendedora.satelite@surmoda.com.bo' },
    update: { passwordHash: pwdVendSatelite },
    create: {
      email: 'vendedora.satelite@surmoda.com.bo',
      passwordHash: pwdVendSatelite,
      fullName: 'Vendedora Satelite',
      isAdmin: false,
      isActive: true,
    },
  });

  const vendedoraOnline = await prisma.user.upsert({
    where: { email: 'vendedora.online@surmoda.com.bo' },
    update: { passwordHash: pwdVendOnline },
    create: {
      email: 'vendedora.online@surmoda.com.bo',
      passwordHash: pwdVendOnline,
      fullName: 'Vendedora Online',
      isAdmin: false,
      isActive: true,
    },
  });

  const assignments: Array<{ userId: string; storeId: string; role: Role }> = [
    { userId: encargadaPrado.id, storeId: STORE_PRADO, role: Role.encargada },
    { userId: vendedoraPrado.id, storeId: STORE_PRADO, role: Role.vendedora },
    { userId: encargadaZsur.id, storeId: STORE_ZSUR, role: Role.encargada },
    { userId: vendedoraZsur.id, storeId: STORE_ZSUR, role: Role.vendedora },
    { userId: encargadaSatelite.id, storeId: 'store-satelite-seed', role: Role.encargada },
    { userId: vendedoraSatelite.id, storeId: 'store-satelite-seed', role: Role.vendedora },
    { userId: vendedoraOnline.id, storeId: 'store-online-seed', role: Role.vendedora },
    // Magdalena is admin, but assigning her to warehouse as well if she needs store scope:
    { userId: encargadaJefa.id, storeId: STORE_ALMACEN, role: Role.encargada },
  ];

  for (const a of assignments) {
    const existing = await prisma.userStore.findFirst({
      where: { userId: a.userId, storeId: a.storeId, deletedAt: null },
    });
    if (!existing) {
      await prisma.userStore.create({ data: a });
    }
  }

  console.info(`Seed OK — production users and stores initialized.`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
