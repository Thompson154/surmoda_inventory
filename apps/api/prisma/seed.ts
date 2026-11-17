import { PrismaClient, Role, StoreKind } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const STORE_ALMACEN = 'store-almacen-seed';
const STORE_PRADO = 'store-prado-seed';
const STORE_ZSUR = 'store-zsur-seed';
const STORE_SATELITE = 'store-satelite-seed';
const STORE_ONLINE = 'store-online-seed';

async function main(): Promise<void> {
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);

  // Contraseñas predecibles para el entorno de producción/demo inicial
  const pwdThompson = await bcrypt.hash('Th0mp$on_88_xZ!2026', saltRounds);
  const pwdMagdalena = await bcrypt.hash('Magda_Surmoda_2026!', saltRounds);
  const pwdGloria = await bcrypt.hash('Gloria_Almacen_2026!', saltRounds);
  const pwdLiz = await bcrypt.hash('Liz_Online_2026!', saltRounds);
  const pwdJessy = await bcrypt.hash('Jessy_Prado_2026!', saltRounds);
  const pwdCorina = await bcrypt.hash('Corina_ZSur_2026!', saltRounds);
  const pwdCaricia = await bcrypt.hash('Caricia_Satelite_2026!', saltRounds);

  const pwdVendedoraPrado = await bcrypt.hash('Ventas_Prado_2026!', saltRounds);
  const pwdVendedoraZSur = await bcrypt.hash('Ventas_ZSur_2026!', saltRounds);
  const pwdVendedoraSatelite = await bcrypt.hash('Ventas_Satelite_2026!', saltRounds);
  const pwdVendedoraOnline = await bcrypt.hash('Ventas_Online_2026!', saltRounds);

  // ── 1. Stores ────────────────────────────────────────────────────────
  await prisma.store.upsert({
    where: { code: 'ALMACEN' },
    update: { name: 'Almacén Central', kind: StoreKind.warehouse },
    create: {
      id: STORE_ALMACEN,
      code: 'ALMACEN',
      name: 'Almacén Central',
      kind: StoreKind.warehouse,
    },
  });

  await prisma.store.upsert({
    where: { code: 'PRADO' },
    update: { name: 'Sucursal Prado', kind: StoreKind.branch },
    create: {
      id: STORE_PRADO,
      code: 'PRADO',
      name: 'Sucursal Prado',
      kind: StoreKind.branch,
    },
  });

  await prisma.store.upsert({
    where: { code: 'ZSUR' },
    update: { name: 'Sucursal Zona Sur', kind: StoreKind.branch },
    create: {
      id: STORE_ZSUR,
      code: 'ZSUR',
      name: 'Sucursal Zona Sur',
      kind: StoreKind.branch,
    },
  });

  await prisma.store.upsert({
    where: { code: 'SATELITE' },
    update: { name: 'Sucursal Satélite', kind: StoreKind.branch },
    create: {
      id: STORE_SATELITE,
      code: 'SATELITE',
      name: 'Sucursal Satélite',
      kind: StoreKind.branch,
    },
  });

  await prisma.store.upsert({
    where: { code: 'ONLINE' },
    update: { name: 'Ventas Online', kind: StoreKind.branch },
    create: {
      id: STORE_ONLINE,
      code: 'ONLINE',
      name: 'Ventas Online',
      kind: StoreKind.branch,
    },
  });

  // ── 2. Administradores ───────────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: 'thompson@surmoda.com.bo' },
    update: { fullName: 'Adrián Thompson', isAdmin: true, isActive: true },
    create: {
      email: 'thompson@surmoda.com.bo',
      passwordHash: pwdThompson,
      fullName: 'Adrián Thompson',
      isAdmin: true,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'magdalena@surmoda.com.bo' },
    update: { fullName: 'Magdalena Machaca', isAdmin: true, isActive: true },
    create: {
      email: 'magdalena@surmoda.com.bo',
      passwordHash: pwdMagdalena,
      fullName: 'Magdalena Machaca',
      isAdmin: true,
      isActive: true,
    },
  });

  // Alias para mantener compatibilidad con malena@
  await prisma.user.upsert({
    where: { email: 'malena@surmoda.com.bo' },
    update: { fullName: 'Magdalena Machaca', isAdmin: true, isActive: true },
    create: {
      email: 'malena@surmoda.com.bo',
      passwordHash: pwdMagdalena,
      fullName: 'Magdalena Machaca',
      isAdmin: true,
      isActive: true,
    },
  });

  // ── 3. Encargadas de Inventario ──────────────────────────────────────
  const gloria = await prisma.user.upsert({
    where: { email: 'gloria@surmoda.com.bo' },
    update: { fullName: 'Gloria Atahuichi', isAdmin: false, isActive: true },
    create: {
      email: 'gloria@surmoda.com.bo',
      passwordHash: pwdGloria,
      fullName: 'Gloria Atahuichi',
      isAdmin: false,
      isActive: true,
    },
  });

  const liz = await prisma.user.upsert({
    where: { email: 'liz@surmoda.com.bo' },
    update: { fullName: 'Liz Huanca', isAdmin: false, isActive: true },
    create: {
      email: 'liz@surmoda.com.bo',
      passwordHash: pwdLiz,
      fullName: 'Liz Huanca',
      isAdmin: false,
      isActive: true,
    },
  });

  const jessy = await prisma.user.upsert({
    where: { email: 'jessy@surmoda.com.bo' },
    update: { fullName: 'Jhesica Yapuchura', isAdmin: false, isActive: true },
    create: {
      email: 'jessy@surmoda.com.bo',
      passwordHash: pwdJessy,
      fullName: 'Jhesica Yapuchura',
      isAdmin: false,
      isActive: true,
    },
  });

  // Alias para jhesica@
  await prisma.user.upsert({
    where: { email: 'jhesica@surmoda.com.bo' },
    update: { fullName: 'Jhesica Yapuchura', isAdmin: false, isActive: true },
    create: {
      email: 'jhesica@surmoda.com.bo',
      passwordHash: pwdJessy,
      fullName: 'Jhesica Yapuchura',
      isAdmin: false,
      isActive: true,
    },
  });

  const corina = await prisma.user.upsert({
    where: { email: 'corina@surmoda.com.bo' },
    update: { fullName: 'Corina Limachi', isAdmin: false, isActive: true },
    create: {
      email: 'corina@surmoda.com.bo',
      passwordHash: pwdCorina,
      fullName: 'Corina Limachi',
      isAdmin: false,
      isActive: true,
    },
  });

  const caricia = await prisma.user.upsert({
    where: { email: 'caricia@surmoda.com.bo' },
    update: { fullName: 'Caricia Llanos', isAdmin: false, isActive: true },
    create: {
      email: 'caricia@surmoda.com.bo',
      passwordHash: pwdCaricia,
      fullName: 'Caricia Llanos',
      isAdmin: false,
      isActive: true,
    },
  });

  // ── 4. Cuentas Genéricas de Vendedoras por Sucursal ─────────────────
  const vendedoraPrado = await prisma.user.upsert({
    where: { email: 'vendedora.prado@surmoda.com.bo' },
    update: { fullName: 'Vendedora Prado', isAdmin: false, isActive: true },
    create: {
      email: 'vendedora.prado@surmoda.com.bo',
      passwordHash: pwdVendedoraPrado,
      fullName: 'Vendedora Prado',
      isAdmin: false,
      isActive: true,
    },
  });

  const vendedoraZSur = await prisma.user.upsert({
    where: { email: 'vendedora.zonasur@surmoda.com.bo' },
    update: { fullName: 'Vendedora Zona Sur', isAdmin: false, isActive: true },
    create: {
      email: 'vendedora.zonasur@surmoda.com.bo',
      passwordHash: pwdVendedoraZSur,
      fullName: 'Vendedora Zona Sur',
      isAdmin: false,
      isActive: true,
    },
  });

  const vendedoraSatelite = await prisma.user.upsert({
    where: { email: 'vendedora.satelite@surmoda.com.bo' },
    update: { fullName: 'Vendedora Satélite', isAdmin: false, isActive: true },
    create: {
      email: 'vendedora.satelite@surmoda.com.bo',
      passwordHash: pwdVendedoraSatelite,
      fullName: 'Vendedora Satélite',
      isAdmin: false,
      isActive: true,
    },
  });

  const vendedoraOnline = await prisma.user.upsert({
    where: { email: 'vendedora.online@surmoda.com.bo' },
    update: { fullName: 'Vendedora Online', isAdmin: false, isActive: true },
    create: {
      email: 'vendedora.online@surmoda.com.bo',
      passwordHash: pwdVendedoraOnline,
      fullName: 'Vendedora Online',
      isAdmin: false,
      isActive: true,
    },
  });

  // ── 5. UserStore assignments ─────────────────────────────────────────
  const assignments: Array<{ userId: string; storeId: string; role: Role }> = [
    // Gloria: Almacén Central + visibilidad en todas las sucursales (puede ver todos los inventarios)
    { userId: gloria.id, storeId: STORE_ALMACEN, role: Role.encargada },
    { userId: gloria.id, storeId: STORE_PRADO, role: Role.encargada },
    { userId: gloria.id, storeId: STORE_ZSUR, role: Role.encargada },
    { userId: gloria.id, storeId: STORE_SATELITE, role: Role.encargada },
    { userId: gloria.id, storeId: STORE_ONLINE, role: Role.encargada },

    // Liz: Únicamente Tienda Online (Encargada + Vendedora para registrar ventas)
    { userId: liz.id, storeId: STORE_ONLINE, role: Role.encargada },
    { userId: liz.id, storeId: STORE_ONLINE, role: Role.vendedora },

    // Jessy: Únicamente Prado (Encargada + Vendedora para registrar ventas)
    { userId: jessy.id, storeId: STORE_PRADO, role: Role.encargada },
    { userId: jessy.id, storeId: STORE_PRADO, role: Role.vendedora },

    // Corina: Únicamente Zona Sur (Encargada + Vendedora para registrar ventas)
    { userId: corina.id, storeId: STORE_ZSUR, role: Role.encargada },
    { userId: corina.id, storeId: STORE_ZSUR, role: Role.vendedora },

    // Caricia: Únicamente Satélite (Encargada + Vendedora para registrar ventas)
    { userId: caricia.id, storeId: STORE_SATELITE, role: Role.encargada },
    { userId: caricia.id, storeId: STORE_SATELITE, role: Role.vendedora },

    // Vendedoras por sucursal (1 por sede, solo rol vendedora)
    { userId: vendedoraPrado.id, storeId: STORE_PRADO, role: Role.vendedora },
    { userId: vendedoraZSur.id, storeId: STORE_ZSUR, role: Role.vendedora },
    { userId: vendedoraSatelite.id, storeId: STORE_SATELITE, role: Role.vendedora },
    { userId: vendedoraOnline.id, storeId: STORE_ONLINE, role: Role.vendedora },
  ];

  for (const a of assignments) {
    const existing = await prisma.userStore.findFirst({
      where: { userId: a.userId, storeId: a.storeId, role: a.role, deletedAt: null },
    });
    if (!existing) {
      await prisma.userStore.create({ data: a });
    }
  }

  console.info(`Seed OK — ${assignments.length} asignaciones de sedes y roles configuradas.`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
