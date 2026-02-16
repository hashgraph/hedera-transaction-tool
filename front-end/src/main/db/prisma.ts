import * as path from 'path';

import { app } from 'electron';

import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

let prisma: PrismaClient;

export const dbPath = path.join(app.getPath('userData'), 'database.db');

export function getPrismaClient() {
  if (!prisma) {
    prisma = createPrismaClient();
  }
  return prisma;
}

export function setPrismaClient(prismaClient: PrismaClient) {
  prisma = prismaClient;
}

export function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({
    url: `file:${dbPath}`,
  });
  // Type assertion needed because generated Prisma 7 client types
  // don't properly expose the adapter option from the runtime
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
}
