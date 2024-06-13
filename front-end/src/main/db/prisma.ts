import path from 'path';

import electron from 'electron';

import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

export const dbPath = path.join(electron.app.getPath('userData'), 'database.db');

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
  return new PrismaClient({
    datasources: {
      db: {
        url: `file:${dbPath}`,
      },
    },
  });
}
