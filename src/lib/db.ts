import { Prisma, PrismaClient } from '@prisma/client';

// Prisma-Client als Singleton. Verhindert in der Entwicklung mehrere Verbindungspools bei Hot Reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

export type Tx = Prisma.TransactionClient;
