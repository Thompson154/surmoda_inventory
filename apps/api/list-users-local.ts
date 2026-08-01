import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ 
    select: { email: true, fullName: true, isAdmin: true } 
  });
  console.log("USERS_IN_LOCAL_DB:", JSON.stringify(users, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
