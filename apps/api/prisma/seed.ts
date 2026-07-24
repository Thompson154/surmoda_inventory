import { PrismaClient, Role, StoreKind } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

const STORE_PRADO = 'store-prado-seed';
const STORE_ZSUR = 'store-zsur-seed';
const STORE_ALMACEN = 'store-almacen-seed';
const STORE_SATELITE = 'store-satelite-seed';
const STORE_ONLINE = 'store-online-seed';

async function main(): Promise<void> {
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);

  // Admin (mantener)
  const pwdThompson = await bcrypt.hash('Th0mp$on_88_xZ!2026', saltRounds);
  // Encargadas
  const pwdGloria = await bcrypt.hash('EIq0m3M7tfq7v3zs', saltRounds);
  const pwdLiz = await bcrypt.hash('Jtebe4miNV97iG/w', saltRounds);
  const pwdNoemi = await bcrypt.hash('yfA/obU5gTZlUXdF', saltRounds);
  const pwdMalena = await bcrypt.hash('qBc5FrmOV8EcVN4+', saltRounds);
  // Vendedoras
  const pwdCaricia = await bcrypt.hash('QuucXx0rKhnEVOD8', saltRounds);
  const pwdCorina = await bcrypt.hash('3WGQja0pf0TbTZTF', saltRounds);
  const pwdJhesica = await bcrypt.hash('BCar+kMj7gGaHOzH', saltRounds);
  const pwdDiana = await bcrypt.hash('xTdwUze3wGDVjkiP', saltRounds);
  const pwdAleida = await bcrypt.hash('4S61/l/72KD1fSzw', saltRounds);
  const pwdErika = await bcrypt.hash('HN61udDhnoLAbr6S', saltRounds);

  // ── Stores ──────────────────────────────────────────────────────────
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
      id: STORE_SATELITE,
      code: 'SATELITE',
      name: 'Sucursal Satélite',
      kind: StoreKind.branch,
    },
  });
  await prisma.store.upsert({
    where: { code: 'ONLINE' },
    update: {},
    create: { id: STORE_ONLINE, code: 'ONLINE', name: 'Ventas Online', kind: StoreKind.branch },
  });

  // ── Users ────────────────────────────────────────────────────────────
  // Admin (mantener)
  await prisma.user.upsert({
    where: { email: 'thompson@surmoda.com.bo' },
    update: { passwordHash: pwdThompson },
    create: {
      email: 'thompson@surmoda.com.bo',
      passwordHash: pwdThompson,
      fullName: 'Adrián Thompson',
      isAdmin: true,
      isActive: true,
    },
  });

  const gloria = await prisma.user.upsert({
    where: { email: 'gloria@surmoda.com.bo' },
    update: { passwordHash: pwdGloria },
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
    update: { passwordHash: pwdLiz },
    create: {
      email: 'liz@surmoda.com.bo',
      passwordHash: pwdLiz,
      fullName: 'Liz Huanca',
      isAdmin: false,
      isActive: true,
    },
  });

  const noemi = await prisma.user.upsert({
    where: { email: 'noemi@surmoda.com.bo' },
    update: { passwordHash: pwdNoemi },
    create: {
      email: 'noemi@surmoda.com.bo',
      passwordHash: pwdNoemi,
      fullName: 'Noemi Huanca',
      isAdmin: false,
      isActive: true,
    },
  });

  const malena = await prisma.user.upsert({
    where: { email: 'malena@surmoda.com.bo' },
    update: { passwordHash: pwdMalena },
    create: {
      email: 'malena@surmoda.com.bo',
      passwordHash: pwdMalena,
      fullName: 'Malena Machaca',
      isAdmin: true,
      isActive: true,
    },
  });

  const caricia = await prisma.user.upsert({
    where: { email: 'caricia@surmoda.com.bo' },
    update: { passwordHash: pwdCaricia },
    create: {
      email: 'caricia@surmoda.com.bo',
      passwordHash: pwdCaricia,
      fullName: 'Caricia Llanos',
      isAdmin: false,
      isActive: true,
    },
  });

  const corina = await prisma.user.upsert({
    where: { email: 'corina@surmoda.com.bo' },
    update: { passwordHash: pwdCorina },
    create: {
      email: 'corina@surmoda.com.bo',
      passwordHash: pwdCorina,
      fullName: 'Corina Limachi',
      isAdmin: false,
      isActive: true,
    },
  });

  const jhesica = await prisma.user.upsert({
    where: { email: 'jhesica@surmoda.com.bo' },
    update: { passwordHash: pwdJhesica },
    create: {
      email: 'jhesica@surmoda.com.bo',
      passwordHash: pwdJhesica,
      fullName: 'Jhesica Yapuchura',
      isAdmin: false,
      isActive: true,
    },
  });

  const diana = await prisma.user.upsert({
    where: { email: 'diana@surmoda.com.bo' },
    update: { passwordHash: pwdDiana },
    create: {
      email: 'diana@surmoda.com.bo',
      passwordHash: pwdDiana,
      fullName: 'Diana Blanco',
      isAdmin: false,
      isActive: true,
    },
  });

  const aleida = await prisma.user.upsert({
    where: { email: 'aleida@surmoda.com.bo' },
    update: { passwordHash: pwdAleida },
    create: {
      email: 'aleida@surmoda.com.bo',
      passwordHash: pwdAleida,
      fullName: 'Aleida Riquelme',
      isAdmin: false,
      isActive: true,
    },
  });

  const erika = await prisma.user.upsert({
    where: { email: 'erika@surmoda.com.bo' },
    update: { passwordHash: pwdErika },
    create: {
      email: 'erika@surmoda.com.bo',
      passwordHash: pwdErika,
      fullName: 'Erika Domingo',
      isAdmin: false,
      isActive: true,
    },
  });

  // ── UserStore assignments ───────────────────────────────────────────
  const assignments: Array<{ userId: string; storeId: string; role: Role }> = [
    // Gloria — encargada en SATELITE y PRADO
    { userId: gloria.id, storeId: STORE_SATELITE, role: Role.encargada },
    { userId: gloria.id, storeId: STORE_PRADO, role: Role.encargada },
    // Liz — encargada + vendedora en ONLINE
    { userId: liz.id, storeId: STORE_ONLINE, role: Role.encargada },
    { userId: liz.id, storeId: STORE_ONLINE, role: Role.vendedora },
    // Noemi — encargada en SATELITE y PRADO
    { userId: noemi.id, storeId: STORE_SATELITE, role: Role.encargada },
    { userId: noemi.id, storeId: STORE_PRADO, role: Role.encargada },
    // Malena — admin + encargada en ALMACEN
    { userId: malena.id, storeId: STORE_ALMACEN, role: Role.encargada },
    // Caricia — vendedora en SATELITE
    { userId: caricia.id, storeId: STORE_SATELITE, role: Role.vendedora },
    // Corina — vendedora en ZONA SUR
    { userId: corina.id, storeId: STORE_ZSUR, role: Role.vendedora },
    // Jhesica — vendedora en PRADO
    { userId: jhesica.id, storeId: STORE_PRADO, role: Role.vendedora },
    // Diana — vendedora en PRADO y SATELITE
    { userId: diana.id, storeId: STORE_PRADO, role: Role.vendedora },
    { userId: diana.id, storeId: STORE_SATELITE, role: Role.vendedora },
    // Aleida — vendedora en PRADO
    { userId: aleida.id, storeId: STORE_PRADO, role: Role.vendedora },
    // Erika — vendedora en PRADO
    { userId: erika.id, storeId: STORE_PRADO, role: Role.vendedora },
  ];

  for (const a of assignments) {
    const existing = await prisma.userStore.findFirst({
      where: { userId: a.userId, storeId: a.storeId, deletedAt: null },
    });
    if (!existing) {
      await prisma.userStore.create({ data: a });
    }
  }

  console.info(`Seed OK — ${assignments.length} store assignments configured.`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
