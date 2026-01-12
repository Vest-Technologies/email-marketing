import { PrismaClient } from '@/generated/prisma';
import { PrismaLibSql } from '@prisma/adapter-libsql';

// Create Prisma adapter with file URL - using absolute path for reliability
const dbUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';

// Create Prisma adapter
const adapter = new PrismaLibSql({
  url: dbUrl,
});

// Create global reference for Prisma client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create PrismaClient with libSQL adapter
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
